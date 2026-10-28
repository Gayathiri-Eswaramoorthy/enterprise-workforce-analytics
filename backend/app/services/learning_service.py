"""
Learning service handling lesson progress, quiz scoring, and course completion.
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.database import EnrollmentStatus
from app.models import (
    CourseLesson,
    CourseQuiz,
    LessonCompletion,
    QuizAttempt,
    QuizQuestion,
    TrainingCourse,
    TrainingEnrollment,
)
from app.schemas.learning import (
    CourseLessonResponse,
    CourseQuizPublicResponse,
    CourseResourceCreateRequest,
    CourseResourceUpdateRequest,
    HRLearningCourseSummary,
    HRLearningEnrollmentDetail,
    MyCourseProgressResponse,
    QuizAttemptResponse,
    QuizOptionPublicResponse,
    QuizQuestionPublicResponse,
    QuizQuestionResult,
    QuizSubmissionRequest,
)
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


class LearningService:
    def get_my_courses(self, db: Session, employee_id: UUID) -> list[MyCourseProgressResponse]:
        """
        Retrieve all enrolled courses for an employee with calculated progress metrics.
        """
        stmt = (
            select(TrainingEnrollment)
            .options(
                selectinload(TrainingEnrollment.training_course).selectinload(
                    TrainingCourse.lessons
                ),
                selectinload(TrainingEnrollment.training_course).selectinload(TrainingCourse.quiz),
                selectinload(TrainingEnrollment.training_course).selectinload(
                    TrainingCourse.training_skills
                ),
                selectinload(TrainingEnrollment.lesson_completions),
                selectinload(TrainingEnrollment.quiz_attempts),
            )
            .where(TrainingEnrollment.employee_id == employee_id)
            .order_by(TrainingEnrollment.enrollment_date.desc())
        )
        enrollments = db.scalars(stmt).all()

        results: list[MyCourseProgressResponse] = []
        for enr in enrollments:
            course = enr.training_course
            if not course:
                continue

            lessons = [lesson for lesson in (course.lessons or []) if lesson.is_active]
            required_lessons = [lesson for lesson in lessons if lesson.is_required]
            completed_lesson_ids = {c.lesson_id for c in enr.lesson_completions if c.is_completed}

            total_req = len(required_lessons)
            completed_req = sum(
                1 for lesson in required_lessons if lesson.id in completed_lesson_ids
            )

            if enr.enrollment_status == EnrollmentStatus.COMPLETED:
                progress_pct = Decimal("100.00")
            elif total_req > 0:
                progress_pct = Decimal(str(round((completed_req / total_req) * 100, 2)))
            else:
                progress_pct = Decimal("0.00")

            # Quiz details
            quiz = course.quiz
            quiz_available = quiz is not None and quiz.is_active and len(quiz.questions) > 0
            quiz_passed = any(att.passed for att in enr.quiz_attempts)
            best_quiz_score = (
                max([att.score for att in enr.quiz_attempts], default=None)
                if enr.quiz_attempts
                else None
            )

            # Skills
            skills = [ts.skill.name for ts in course.training_skills if ts.skill]

            can_complete = (
                total_req > 0
                and completed_req >= total_req
                and (not quiz_available or quiz_passed)
                and enr.enrollment_status != EnrollmentStatus.COMPLETED
            )

            results.append(
                MyCourseProgressResponse(
                    enrollment_id=enr.id,
                    course_id=course.id,
                    course_code=course.course_code,
                    title=course.title,
                    description=course.description,
                    provider=course.provider,
                    duration_hours=course.duration_hours,
                    difficulty_level=course.difficulty_level,
                    training_mode=course.training_mode,
                    enrollment_date=enr.enrollment_date,
                    completion_date=enr.completion_date,
                    enrollment_status=enr.enrollment_status,
                    total_lessons=len(lessons),
                    completed_lessons=len(completed_lesson_ids),
                    progress_percentage=progress_pct,
                    quiz_available=quiz_available,
                    quiz_passed=quiz_passed,
                    quiz_score=best_quiz_score,
                    can_complete=can_complete,
                    target_skills=skills,
                )
            )

        return results

    def get_course_lessons(
        self, db: Session, course_id: UUID, employee_id: UUID
    ) -> list[CourseLessonResponse]:
        """
        Get all lessons and external learning resources for a course with completion status for the specified employee.
        """
        # Validate course
        course = db.get(TrainingCourse, course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training course not found",
            )

        # Find enrollment
        stmt_enr = select(TrainingEnrollment).where(
            TrainingEnrollment.training_course_id == course_id,
            TrainingEnrollment.employee_id == employee_id,
        )
        enrollment = db.scalar(stmt_enr)

        completions_map: dict[UUID, LessonCompletion] = {}
        if enrollment:
            stmt_comp = select(LessonCompletion).where(
                LessonCompletion.enrollment_id == enrollment.id
            )
            comps = db.scalars(stmt_comp).all()
            for c in comps:
                completions_map[c.lesson_id] = c

        stmt_lessons = (
            select(CourseLesson)
            .where(
                CourseLesson.course_id == course_id, CourseLesson.is_active == True
            )  # noqa: E712
            .order_by(CourseLesson.order_index.asc())
        )
        lessons = db.scalars(stmt_lessons).all()

        responses: list[CourseLessonResponse] = []
        for lesson in lessons:
            comp = completions_map.get(lesson.id)
            is_comp = comp.is_completed if comp else False
            comp_at = comp.completed_at if comp else None
            is_opened = comp.resource_opened if comp else False
            opened_at = comp.opened_at if comp else None

            resp = CourseLessonResponse(
                id=lesson.id,
                course_id=lesson.course_id,
                title=lesson.title,
                content=lesson.content,
                description=lesson.description,
                provider=lesson.provider,
                skill_covered=lesson.skill_covered,
                resource_type=lesson.resource_type,
                access_type=lesson.access_type,
                order_index=lesson.order_index,
                is_required=lesson.is_required,
                estimated_minutes=lesson.estimated_minutes,
                external_url=lesson.external_url,
                is_active=lesson.is_active,
                resource_opened=is_opened,
                opened_at=opened_at,
                is_completed=is_comp,
                completed_at=comp_at,
            )
            responses.append(resp)

        return responses

    def open_resource(
        self, db: Session, lesson_id: UUID, employee_id: UUID
    ) -> CourseLessonResponse:
        """
        Record that an employee opened an external learning resource.
        Persists resource_opened=True, opened_at=now() without fabricating completion.
        """
        lesson = db.get(CourseLesson, lesson_id)
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning resource not found",
            )

        stmt_enr = select(TrainingEnrollment).where(
            TrainingEnrollment.training_course_id == lesson.course_id,
            TrainingEnrollment.employee_id == employee_id,
        )
        enrollment = db.scalar(stmt_enr)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee is not enrolled in the course for this resource",
            )

        stmt_comp = select(LessonCompletion).where(
            LessonCompletion.enrollment_id == enrollment.id,
            LessonCompletion.lesson_id == lesson_id,
        )
        completion = db.scalar(stmt_comp)

        now = datetime.now()
        if not completion:
            completion = LessonCompletion(
                enrollment_id=enrollment.id,
                lesson_id=lesson.id,
                employee_id=employee_id,
                resource_opened=True,
                opened_at=now,
                is_completed=False,
                completed_at=None,
            )
            db.add(completion)
        else:
            completion.resource_opened = True
            if not completion.opened_at:
                completion.opened_at = now

        if enrollment.enrollment_status == EnrollmentStatus.ENROLLED:
            enrollment.enrollment_status = EnrollmentStatus.IN_PROGRESS

        db.commit()
        db.refresh(completion)

        return CourseLessonResponse(
            id=lesson.id,
            course_id=lesson.course_id,
            title=lesson.title,
            content=lesson.content,
            description=lesson.description,
            provider=lesson.provider,
            skill_covered=lesson.skill_covered,
            resource_type=lesson.resource_type,
            access_type=lesson.access_type,
            order_index=lesson.order_index,
            is_required=lesson.is_required,
            estimated_minutes=lesson.estimated_minutes,
            external_url=lesson.external_url,
            is_active=lesson.is_active,
            resource_opened=True,
            opened_at=completion.opened_at,
            is_completed=completion.is_completed,
            completed_at=completion.completed_at,
        )

    def complete_lesson(
        self, db: Session, lesson_id: UUID, employee_id: UUID
    ) -> CourseLessonResponse:
        """
        Mark a lesson as completed by an employee, validating enrollment and updating progress.
        """
        lesson = db.get(CourseLesson, lesson_id)
        if not lesson:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lesson not found",
            )

        stmt_enr = select(TrainingEnrollment).where(
            TrainingEnrollment.training_course_id == lesson.course_id,
            TrainingEnrollment.employee_id == employee_id,
        )
        enrollment = db.scalar(stmt_enr)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee is not enrolled in the course for this lesson",
            )

        # Check existing completion
        stmt_comp = select(LessonCompletion).where(
            LessonCompletion.enrollment_id == enrollment.id,
            LessonCompletion.lesson_id == lesson_id,
        )
        completion = db.scalar(stmt_comp)

        now = datetime.now()
        if not completion:
            completion = LessonCompletion(
                enrollment_id=enrollment.id,
                lesson_id=lesson.id,
                employee_id=employee_id,
                resource_opened=True,
                opened_at=now,
                is_completed=True,
                completed_at=now,
            )
            db.add(completion)
            db.flush()
        else:
            completion.is_completed = True
            completion.completed_at = now
            completion.resource_opened = True
            if not completion.opened_at:
                completion.opened_at = now

        # Update enrollment status to IN_PROGRESS if ENROLLED
        if enrollment.enrollment_status == EnrollmentStatus.ENROLLED:
            enrollment.enrollment_status = EnrollmentStatus.IN_PROGRESS

        # Calculate progress and evaluate course completion
        stmt_all_req = select(CourseLesson).where(
            CourseLesson.course_id == lesson.course_id,
            CourseLesson.is_required == True,  # noqa: E712
            CourseLesson.is_active == True,  # noqa: E712
        )
        all_req_lessons = db.scalars(stmt_all_req).all()
        req_count = len(all_req_lessons)

        stmt_done = (
            select(LessonCompletion)
            .join(CourseLesson, LessonCompletion.lesson_id == CourseLesson.id)
            .where(
                LessonCompletion.enrollment_id == enrollment.id,
                CourseLesson.course_id == lesson.course_id,
                CourseLesson.is_required == True,  # noqa: E712
                CourseLesson.is_active == True,  # noqa: E712
                LessonCompletion.is_completed == True,  # noqa: E712
            )
        )
        done_count = len(db.scalars(stmt_done).all())

        # Check quiz requirement
        quiz = db.scalar(
            select(CourseQuiz).where(
                CourseQuiz.course_id == lesson.course_id, CourseQuiz.is_active == True
            )
        )  # noqa: E712
        quiz_passed = True
        if quiz:
            passing_attempt = db.scalar(
                select(QuizAttempt).where(
                    QuizAttempt.enrollment_id == enrollment.id,
                    QuizAttempt.passed == True,  # noqa: E712
                )
            )
            quiz_passed = passing_attempt is not None

        if req_count > 0 and done_count >= req_count and quiz_passed:
            enrollment.enrollment_status = EnrollmentStatus.COMPLETED
            if not enrollment.completion_date:
                enrollment.completion_date = date.today()
            enrollment.certificate_issued = True

        db.commit()
        db.refresh(completion)

        return CourseLessonResponse(
            id=lesson.id,
            course_id=lesson.course_id,
            title=lesson.title,
            content=lesson.content,
            description=lesson.description,
            provider=lesson.provider,
            skill_covered=lesson.skill_covered,
            resource_type=lesson.resource_type,
            access_type=lesson.access_type,
            order_index=lesson.order_index,
            is_required=lesson.is_required,
            estimated_minutes=lesson.estimated_minutes,
            external_url=lesson.external_url,
            is_active=lesson.is_active,
            resource_opened=completion.resource_opened,
            opened_at=completion.opened_at,
            is_completed=True,
            completed_at=completion.completed_at,
        )

    def get_course_quiz(
        self, db: Session, course_id: UUID, employee_id: UUID
    ) -> CourseQuizPublicResponse:
        """
        Get quiz for course without revealing correct answers.
        Returns quiz_available=False if not configured, allowing UI to display a clear explanation.
        """
        stmt_quiz = (
            select(CourseQuiz)
            .options(selectinload(CourseQuiz.questions).selectinload(QuizQuestion.options))
            .where(CourseQuiz.course_id == course_id, CourseQuiz.is_active == True)  # noqa: E712
        )
        quiz = db.scalar(stmt_quiz)
        if not quiz or not quiz.questions:
            return CourseQuizPublicResponse(
                id=quiz.id if quiz else None,
                course_id=course_id,
                title=quiz.title if quiz else "Course Assessment",
                description=(
                    quiz.description
                    if quiz
                    else "No active assessment currently published for this course."
                ),
                passing_score=quiz.passing_score if quiz else Decimal("70.00"),
                max_attempts=quiz.max_attempts if quiz else 3,
                questions_count=0,
                user_attempts_count=0,
                user_best_score=None,
                user_has_passed=False,
                can_attempt=False,
                quiz_available=False,
                message="An active certification quiz is not currently available for this course.",
                questions=[],
            )

        stmt_enr = select(TrainingEnrollment).where(
            TrainingEnrollment.training_course_id == course_id,
            TrainingEnrollment.employee_id == employee_id,
        )
        enrollment = db.scalar(stmt_enr)

        attempts_count = 0
        best_score = None
        has_passed = False
        if enrollment:
            stmt_attempts = (
                select(QuizAttempt)
                .where(QuizAttempt.enrollment_id == enrollment.id)
                .order_by(QuizAttempt.attempt_number.asc())
            )
            attempts = db.scalars(stmt_attempts).all()
            attempts_count = len(attempts)
            if attempts:
                best_score = max(a.score for a in attempts)
                has_passed = any(a.passed for a in attempts)

        can_attempt = attempts_count < quiz.max_attempts and not has_passed

        questions_pub: list[QuizQuestionPublicResponse] = []
        for q in quiz.questions:
            opts_pub = [
                QuizOptionPublicResponse(
                    id=opt.id,
                    option_text=opt.option_text,
                    order_index=opt.order_index,
                )
                for opt in q.options
            ]
            questions_pub.append(
                QuizQuestionPublicResponse(
                    id=q.id,
                    question_text=q.question_text,
                    order_index=q.order_index,
                    options=opts_pub,
                )
            )

        return CourseQuizPublicResponse(
            id=quiz.id,
            course_id=quiz.course_id,
            title=quiz.title,
            description=quiz.description,
            passing_score=quiz.passing_score,
            max_attempts=quiz.max_attempts,
            questions_count=len(quiz.questions),
            user_attempts_count=attempts_count,
            user_best_score=best_score,
            user_has_passed=has_passed,
            can_attempt=can_attempt,
            quiz_available=True,
            message=None,
            questions=questions_pub,
        )

    def submit_quiz(
        self,
        db: Session,
        course_id: UUID,
        employee_id: UUID,
        submission: QuizSubmissionRequest,
    ) -> QuizAttemptResponse:
        """
        Validate multiple-choice quiz submission on server, calculate score, check threshold and retakes.
        """
        # Validate enrollment
        stmt_enr = select(TrainingEnrollment).where(
            TrainingEnrollment.training_course_id == course_id,
            TrainingEnrollment.employee_id == employee_id,
        )
        enrollment = db.scalar(stmt_enr)
        if not enrollment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee must be enrolled in course to submit quiz",
            )

        # Validate quiz
        stmt_quiz = (
            select(CourseQuiz)
            .options(selectinload(CourseQuiz.questions).selectinload(QuizQuestion.options))
            .where(CourseQuiz.course_id == course_id, CourseQuiz.is_active == True)  # noqa: E712
        )
        quiz = db.scalar(stmt_quiz)
        if not quiz:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Active quiz not found for this course",
            )

        # Check existing attempts
        stmt_attempts = (
            select(QuizAttempt)
            .where(QuizAttempt.enrollment_id == enrollment.id)
            .order_by(QuizAttempt.attempt_number.asc())
        )
        attempts = db.scalars(stmt_attempts).all()
        if len(attempts) >= quiz.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum allowed quiz attempts ({quiz.max_attempts}) reached",
            )

        # Server-side scoring
        answers_map = {ans.question_id: ans.selected_option_id for ans in submission.answers}
        total_questions = len(quiz.questions)
        if total_questions == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quiz does not contain questions",
            )

        correct_count = 0
        breakdown: list[QuizQuestionResult] = []

        for q in quiz.questions:
            selected_opt_id = answers_map.get(q.id)
            correct_opt = next((o for o in q.options if o.is_correct), None)
            correct_opt_id = correct_opt.id if correct_opt else q.options[0].id

            is_correct = selected_opt_id is not None and selected_opt_id == correct_opt_id
            if is_correct:
                correct_count += 1

            breakdown.append(
                QuizQuestionResult(
                    question_id=q.id,
                    question_text=q.question_text,
                    selected_option_id=selected_opt_id or correct_opt_id,
                    correct_option_id=correct_opt_id,
                    is_correct=is_correct,
                    explanation=q.explanation,
                )
            )

        calculated_score = Decimal(str(round((correct_count / total_questions) * 100, 2)))
        passed = calculated_score >= quiz.passing_score

        new_attempt = QuizAttempt(
            quiz_id=quiz.id,
            enrollment_id=enrollment.id,
            employee_id=employee_id,
            attempt_number=len(attempts) + 1,
            score=calculated_score,
            passed=passed,
            answers_payload=[b.model_dump(mode="json") for b in breakdown],
        )
        db.add(new_attempt)
        db.flush()

        # Update enrollment completion score
        if enrollment.completion_score is None or calculated_score > enrollment.completion_score:
            enrollment.completion_score = calculated_score

        course_completed = False
        if passed:
            # Check if all required lessons are complete
            stmt_req = select(CourseLesson).where(
                CourseLesson.course_id == course_id,
                CourseLesson.is_required == True,  # noqa: E712
                CourseLesson.is_active == True,  # noqa: E712
            )
            req_lessons = db.scalars(stmt_req).all()
            total_req = len(req_lessons)

            stmt_done = (
                select(LessonCompletion)
                .join(CourseLesson, LessonCompletion.lesson_id == CourseLesson.id)
                .where(
                    LessonCompletion.enrollment_id == enrollment.id,
                    CourseLesson.course_id == course_id,
                    CourseLesson.is_required == True,  # noqa: E712
                    CourseLesson.is_active == True,  # noqa: E712
                    LessonCompletion.is_completed == True,  # noqa: E712
                )
            )
            done_count = len(db.scalars(stmt_done).all())

            if total_req > 0 and done_count >= total_req:
                enrollment.enrollment_status = EnrollmentStatus.COMPLETED
                if not enrollment.completion_date:
                    enrollment.completion_date = date.today()
                enrollment.certificate_issued = True
                course_completed = True

        db.commit()
        db.refresh(new_attempt)

        return QuizAttemptResponse(
            id=new_attempt.id,
            quiz_id=new_attempt.quiz_id,
            enrollment_id=new_attempt.enrollment_id,
            employee_id=new_attempt.employee_id,
            attempt_number=new_attempt.attempt_number,
            score=new_attempt.score,
            passed=new_attempt.passed,
            attempted_at=new_attempt.attempted_at,
            breakdown=breakdown,
            course_completed=course_completed,
        )

    def get_quiz_attempts(
        self, db: Session, course_id: UUID, employee_id: UUID
    ) -> list[QuizAttemptResponse]:
        stmt = (
            select(QuizAttempt)
            .join(TrainingEnrollment)
            .where(
                TrainingEnrollment.training_course_id == course_id,
                TrainingEnrollment.employee_id == employee_id,
            )
            .order_by(QuizAttempt.attempt_number.desc())
        )
        attempts = db.scalars(stmt).all()

        results: list[QuizAttemptResponse] = []
        for a in attempts:
            breakdown_data = None
            if isinstance(a.answers_payload, list):
                breakdown_data = [
                    QuizQuestionResult(**item)
                    for item in a.answers_payload
                    if isinstance(item, dict)
                ]
            results.append(
                QuizAttemptResponse(
                    id=a.id,
                    quiz_id=a.quiz_id,
                    enrollment_id=a.enrollment_id,
                    employee_id=a.employee_id,
                    attempt_number=a.attempt_number,
                    score=a.score,
                    passed=a.passed,
                    attempted_at=a.attempted_at,
                    breakdown=breakdown_data,
                    course_completed=(
                        a.enrollment.enrollment_status == EnrollmentStatus.COMPLETED
                        if a.enrollment
                        else False
                    ),
                )
            )
        return results

    def get_hr_learning_dashboard(self, db: Session) -> dict:
        """
        Aggregate learning metrics across courses and generate learner follow-up alerts.
        """
        courses = db.scalars(
            select(TrainingCourse)
            .options(
                selectinload(TrainingCourse.enrollments).selectinload(TrainingEnrollment.employee),
                selectinload(TrainingCourse.enrollments).selectinload(
                    TrainingEnrollment.lesson_completions
                ),
                selectinload(TrainingCourse.enrollments).selectinload(
                    TrainingEnrollment.quiz_attempts
                ),
                selectinload(TrainingCourse.lessons),
                selectinload(TrainingCourse.training_skills),
            )
            .order_by(TrainingCourse.title.asc())
        ).all()

        course_summaries: list[HRLearningCourseSummary] = []
        enrollment_details: list[HRLearningEnrollmentDetail] = []
        needs_support_count = 0

        today = date.today()

        for c in courses:
            total_enrolled = len(c.enrollments)
            not_started = 0
            in_progress = 0
            completed = 0
            overdue = 0
            progress_sum = Decimal("0.00")
            passed_quiz_count = 0
            attempted_quiz_count = 0

            req_lessons = [
                lesson for lesson in c.lessons if lesson.is_required and lesson.is_active
            ]
            req_count = len(req_lessons)

            for enr in c.enrollments:
                emp = enr.employee
                if not emp:
                    continue

                comp_ids = {lc.lesson_id for lc in enr.lesson_completions if lc.is_completed}
                done_req = sum(1 for lesson in req_lessons if lesson.id in comp_ids)
                if enr.enrollment_status == EnrollmentStatus.COMPLETED:
                    prog_pct = Decimal("100.00")
                elif req_count > 0:
                    prog_pct = Decimal(str(round((done_req / req_count) * 100, 2)))
                else:
                    prog_pct = Decimal("0.00")
                progress_sum += prog_pct

                # Check status
                if enr.enrollment_status == EnrollmentStatus.COMPLETED:
                    completed += 1
                elif enr.enrollment_status == EnrollmentStatus.ENROLLED:
                    not_started += 1
                else:
                    in_progress += 1

                # Check overdue (> 60 days since enrollment without completion)
                days_enrolled = (today - enr.enrollment_date).days
                is_overdue = (
                    days_enrolled > 60 and enr.enrollment_status != EnrollmentStatus.COMPLETED
                )
                if is_overdue:
                    overdue += 1

                # Quizzes
                latest_attempt = enr.quiz_attempts[-1] if enr.quiz_attempts else None
                has_passed = any(a.passed for a in enr.quiz_attempts)
                if enr.quiz_attempts:
                    attempted_quiz_count += 1
                    if has_passed:
                        passed_quiz_count += 1

                # Follow-up support criteria
                needs_supp = False
                supp_reason = None
                if is_overdue and prog_pct < Decimal("50.00"):
                    needs_supp = True
                    supp_reason = (
                        f"Enrolled {days_enrolled} days ago with only {prog_pct}% completion"
                    )
                elif latest_attempt and not latest_attempt.passed and len(enr.quiz_attempts) >= 2:
                    needs_supp = True
                    supp_reason = f"Repeated quiz struggle ({len(enr.quiz_attempts)} attempts, latest score {latest_attempt.score}%)"

                if needs_supp:
                    needs_support_count += 1

                enrollment_details.append(
                    HRLearningEnrollmentDetail(
                        enrollment_id=enr.id,
                        employee_id=emp.id,
                        employee_name=f"{emp.first_name} {emp.last_name}",
                        employee_code=emp.employee_code,
                        department_name=emp.department.name if emp.department else "General",
                        course_id=c.id,
                        course_title=c.title,
                        enrollment_date=enr.enrollment_date,
                        completion_date=enr.completion_date,
                        enrollment_status=enr.enrollment_status,
                        completed_lessons=len(comp_ids),
                        total_lessons=len(c.lessons),
                        progress_percentage=prog_pct,
                        latest_quiz_score=latest_attempt.score if latest_attempt else None,
                        quiz_passed=has_passed,
                        needs_support=needs_supp,
                        support_reason=supp_reason,
                    )
                )

            avg_prog = (
                Decimal(str(round(float(progress_sum) / total_enrolled, 2)))
                if total_enrolled > 0
                else Decimal("0.00")
            )
            quiz_pass_rate = (
                Decimal(str(round((passed_quiz_count / attempted_quiz_count) * 100, 2)))
                if attempted_quiz_count > 0
                else Decimal("0.00")
            )

            course_summaries.append(
                HRLearningCourseSummary(
                    course_id=c.id,
                    course_code=c.course_code,
                    title=c.title,
                    enrolled_count=total_enrolled,
                    not_started_count=not_started,
                    in_progress_count=in_progress,
                    completed_count=completed,
                    overdue_count=overdue,
                    avg_progress_percentage=avg_prog,
                    quiz_pass_rate=quiz_pass_rate,
                    target_skills=[ts.skill.name for ts in c.training_skills if ts.skill],
                )
            )

        return {
            "total_courses": len(courses),
            "total_enrollments": len(enrollment_details),
            "needs_support_count": needs_support_count,
            "course_summaries": course_summaries,
            "enrollments": enrollment_details,
        }

    def create_course_resource(
        self, db: Session, course_id: UUID, req: CourseResourceCreateRequest
    ) -> CourseLessonResponse:
        """
        Create a new learning resource/lesson for a training course (HR Admin / Manager).
        """
        course = db.get(TrainingCourse, course_id)
        if not course:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Training course not found",
            )

        resource = CourseLesson(
            course_id=course_id,
            title=req.title,
            description=req.description,
            content=req.content,
            provider=req.provider,
            skill_covered=req.skill_covered,
            resource_type=req.resource_type,
            access_type=req.access_type,
            order_index=req.order_index,
            is_required=req.is_required,
            estimated_minutes=req.estimated_minutes,
            external_url=req.external_url,
            is_active=req.is_active,
        )
        db.add(resource)
        db.commit()
        db.refresh(resource)

        return CourseLessonResponse(
            id=resource.id,
            course_id=resource.course_id,
            title=resource.title,
            content=resource.content,
            description=resource.description,
            provider=resource.provider,
            skill_covered=resource.skill_covered,
            resource_type=resource.resource_type,
            access_type=resource.access_type,
            order_index=resource.order_index,
            is_required=resource.is_required,
            estimated_minutes=resource.estimated_minutes,
            external_url=resource.external_url,
            is_active=resource.is_active,
            resource_opened=False,
            is_completed=False,
        )

    def update_course_resource(
        self, db: Session, resource_id: UUID, req: CourseResourceUpdateRequest
    ) -> CourseLessonResponse:
        """
        Update an existing learning resource/lesson (HR Admin / Manager).
        """
        resource = db.get(CourseLesson, resource_id)
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning resource not found",
            )

        if req.title is not None:
            resource.title = req.title
        if req.description is not None:
            resource.description = req.description
        if req.content is not None:
            resource.content = req.content
        if req.provider is not None:
            resource.provider = req.provider
        if req.skill_covered is not None:
            resource.skill_covered = req.skill_covered
        if req.resource_type is not None:
            resource.resource_type = req.resource_type
        if req.access_type is not None:
            resource.access_type = req.access_type
        if req.external_url is not None:
            resource.external_url = req.external_url
        if req.estimated_minutes is not None:
            resource.estimated_minutes = req.estimated_minutes
        if req.order_index is not None:
            resource.order_index = req.order_index
        if req.is_required is not None:
            resource.is_required = req.is_required
        if req.is_active is not None:
            resource.is_active = req.is_active

        db.commit()
        db.refresh(resource)

        return CourseLessonResponse(
            id=resource.id,
            course_id=resource.course_id,
            title=resource.title,
            content=resource.content,
            description=resource.description,
            provider=resource.provider,
            skill_covered=resource.skill_covered,
            resource_type=resource.resource_type,
            access_type=resource.access_type,
            order_index=resource.order_index,
            is_required=resource.is_required,
            estimated_minutes=resource.estimated_minutes,
            external_url=resource.external_url,
            is_active=resource.is_active,
            resource_opened=False,
            is_completed=False,
        )

    def delete_course_resource(self, db: Session, resource_id: UUID) -> bool:
        """
        Delete or deactivate a learning resource (HR Admin / Manager).
        """
        resource = db.get(CourseLesson, resource_id)
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Learning resource not found",
            )
        db.delete(resource)
        db.commit()
        return True
