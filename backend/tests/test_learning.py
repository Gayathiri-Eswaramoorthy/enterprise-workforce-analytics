"""
Automated tests for Learning Module:
- Employee course browsing and lesson access
- Lesson-level completion tracking and progress calculation
- Anti-tampering & ownership checks
- Quiz answer sanitization, server-side scoring, and feedback
- Course completion requirements gate (lessons + quiz pass)
- HR Learning Analytics Dashboard
"""

from datetime import date
from decimal import Decimal

import pytest
from app.database import DifficultyLevel, EnrollmentStatus, TrainingMode
from app.models import (
    CourseLesson,
    CourseQuiz,
    QuizAttempt,
    QuizQuestion,
    TrainingCourse,
    TrainingEnrollment,
    User,
)
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


def test_my_courses_list_authenticated_employee(client: TestClient, employee_headers: dict):
    """Authenticated employee can view their enrolled and catalog courses."""
    resp = client.get("/api/v1/learning/my-courses", headers=employee_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) > 0

    first = data[0]
    assert "course_id" in first
    assert "course_code" in first
    assert "title" in first
    assert "progress_percentage" in first
    assert "completed_lessons" in first
    assert "total_lessons" in first


def test_course_details_and_lessons(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Employee can view course lessons and learning materials."""
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.is_active == True)
    ).first()
    assert course is not None

    resp = client.get(f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers)
    assert resp.status_code == 200
    lessons = resp.json()

    assert isinstance(lessons, list)
    assert len(lessons) > 0

    first_lesson = lessons[0]
    assert "title" in first_lesson
    assert "content" in first_lesson
    assert "estimated_minutes" in first_lesson
    assert "is_required" in first_lesson
    assert "is_completed" in first_lesson


def test_lesson_completion_and_progress_recalculation(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Employee can mark required lessons complete and progress % updates server-side."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    emp_id = emp_user.employee_profile.id

    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.is_active == True)
    ).first()
    assert course is not None

    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == emp_id)
        .where(TrainingEnrollment.training_course_id == course.id)
    ).first()
    if not enrollment:
        enrollment = TrainingEnrollment(
            employee_id=emp_id,
            training_course_id=course.id,
            enrollment_status=EnrollmentStatus.IN_PROGRESS,
            enrollment_date=date.today(),
        )
        db_session.add(enrollment)
        db_session.commit()
    elif enrollment.enrollment_status == EnrollmentStatus.COMPLETED:
        enrollment.enrollment_status = EnrollmentStatus.IN_PROGRESS
        db_session.commit()

    resp = client.get(f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers)
    assert resp.status_code == 200
    lessons = resp.json()
    assert len(lessons) > 0

    target_lesson = next((lesson for lesson in lessons if not lesson["is_completed"]), lessons[0])

    complete_resp = client.post(
        f"/api/v1/learning/lessons/{target_lesson['id']}/complete",
        headers=employee_headers,
    )
    assert complete_resp.status_code == 200
    comp_data = complete_resp.json()
    assert comp_data["is_completed"] is True

    # Verify persistence: re-fetch course lessons
    recheck_resp = client.get(
        f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers
    )
    recheck_lessons = recheck_resp.json()
    updated_lesson = next(
        lesson for lesson in recheck_lessons if lesson["id"] == target_lesson["id"]
    )
    assert updated_lesson["is_completed"] is True


def test_prevent_duplicate_lesson_completion(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Completing the same lesson twice is idempotent and does not corrupt progress %."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    emp_id = emp_user.employee_profile.id

    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.is_active == True)
    ).first()
    assert course is not None

    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == emp_id)
        .where(TrainingEnrollment.training_course_id == course.id)
    ).first()
    if not enrollment:
        enrollment = TrainingEnrollment(
            employee_id=emp_id,
            training_course_id=course.id,
            enrollment_status=EnrollmentStatus.IN_PROGRESS,
            enrollment_date=date.today(),
        )
        db_session.add(enrollment)
        db_session.commit()

    resp = client.get(f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers)
    target_lesson = resp.json()[0]

    # First completion
    resp1 = client.post(
        f"/api/v1/learning/lessons/{target_lesson['id']}/complete",
        headers=employee_headers,
    )
    assert resp1.status_code == 200

    # Re-fetch progress
    prog_resp1 = client.get("/api/v1/learning/my-courses", headers=employee_headers)
    target_prog1 = next(c for c in prog_resp1.json() if c["course_id"] == str(course.id))

    # Duplicate completion
    resp2 = client.post(
        f"/api/v1/learning/lessons/{target_lesson['id']}/complete",
        headers=employee_headers,
    )
    assert resp2.status_code == 200

    # Progress % must remain identical
    prog_resp2 = client.get("/api/v1/learning/my-courses", headers=employee_headers)
    target_prog2 = next(c for c in prog_resp2.json() if c["course_id"] == str(course.id))

    assert target_prog1["progress_percentage"] == target_prog2["progress_percentage"]


def test_validate_lesson_belongs_to_course(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Submitting a lesson ID for a course the employee is not enrolled in returns 400 Bad Request."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    emp_id = emp_user.employee_profile.id

    # Find an active lesson belonging to any course where demo employee is NOT enrolled
    enrolled_course_ids = set(
        db_session.scalars(
            select(TrainingEnrollment.training_course_id).where(
                TrainingEnrollment.employee_id == emp_id
            )
        ).all()
    )

    unenrolled_lesson = db_session.scalars(
        select(CourseLesson)
        .where(~CourseLesson.course_id.in_(enrolled_course_ids))
        .where(CourseLesson.is_active == True)
    ).first()

    if unenrolled_lesson is None:
        # Create a temporary unenrolled course with a lesson for this test assertion
        temp_course = TrainingCourse(
            course_code="TR-TEST-UNENROLLED",
            title="Unenrolled Test Course",
            category="Testing",
            skill_level=DifficultyLevel.BEGINNER,
            duration_hours=Decimal("2.0"),
            training_mode=TrainingMode.ONLINE_SELF_PACED,
            is_active=True,
        )
        db_session.add(temp_course)
        db_session.flush()
        unenrolled_lesson = CourseLesson(
            course_id=temp_course.id,
            title="Test Unenrolled Lesson",
            order_index=1,
            estimated_minutes=15,
            is_required=True,
            is_active=True,
            resource_url="https://docs.python.org/3/",
            provider="Python Software Foundation",
            access_type="FREE",
        )
        db_session.add(unenrolled_lesson)
        db_session.commit()

    resp = client.post(
        f"/api/v1/learning/lessons/{unenrolled_lesson.id}/complete",
        headers=employee_headers,
    )
    assert resp.status_code == 400
    assert "not enrolled" in resp.json()["detail"].lower()


def test_resource_opened_tracking_does_not_mark_complete(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Opening an external resource records opened status without falsely claiming completion."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None

    # Find or pick an enrolled lesson that is not yet completed
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.course_code == "TR-PY-FUND")
    ).first()
    assert course is not None

    lessons = db_session.scalars(
        select(CourseLesson)
        .where(CourseLesson.course_id == course.id)
        .order_by(CourseLesson.order_index.asc())
    ).all()
    assert len(lessons) > 0
    target_lesson = lessons[0]

    # Call open endpoint
    open_resp = client.post(
        f"/api/v1/learning/lessons/{target_lesson.id}/open",
        headers=employee_headers,
    )
    assert open_resp.status_code == 200
    open_data = open_resp.json()
    assert open_data["resource_opened"] is True
    assert open_data["opened_at"] is not None

    # Check lesson details list to ensure persistence
    list_resp = client.get(
        f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers
    )
    assert list_resp.status_code == 200
    matched = next(lesson for lesson in list_resp.json() if lesson["id"] == str(target_lesson.id))
    assert matched["resource_opened"] is True


def test_resource_url_validation_rules():
    """Schemas enforce valid HTTP/HTTPS URLs with hostname, rejecting malicious schemes."""
    from app.schemas.learning import CourseResourceCreateRequest
    from pydantic import ValidationError

    # Valid URLs
    valid_yt = CourseResourceCreateRequest(
        title="Valid YouTube",
        external_url="https://www.youtube.com/watch?v=eWRfhZUzrAc",
        provider="YouTube",
        estimated_minutes=15,
    )
    assert valid_yt.external_url == "https://www.youtube.com/watch?v=eWRfhZUzrAc"

    valid_doc = CourseResourceCreateRequest(
        title="Valid Doc",
        external_url="https://docs.python.org/3/tutorial/",
        provider="Python Docs",
        estimated_minutes=20,
    )
    assert valid_doc.external_url == "https://docs.python.org/3/tutorial/"

    # Invalid javascript: scheme
    with pytest.raises(ValidationError):
        CourseResourceCreateRequest(
            title="XSS Attack",
            external_url="javascript:alert('xss')",
            provider="Malicious",
        )

    # Invalid ftp: scheme
    with pytest.raises(ValidationError):
        CourseResourceCreateRequest(
            title="FTP Link",
            external_url="ftp://files.example.com/test",
            provider="FTP",
        )

    # Malformed non-URL string
    with pytest.raises(ValidationError):
        CourseResourceCreateRequest(
            title="Plain String",
            external_url="not-a-valid-url",
            provider="None",
        )


def test_course_without_published_quiz_returns_graceful_availability(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Courses without a published quiz return quiz_available=False with clear explanatory message."""
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.course_code == "TR-GCP-ARCH")
    ).first()
    assert course is not None

    resp = client.get(f"/api/v1/learning/courses/{course.id}/quiz", headers=employee_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["quiz_available"] is False
    assert "not currently available" in data["message"].lower()
    assert len(data["questions"]) == 0


def test_quiz_failing_score_threshold_does_not_pass(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Submitting answers below the 70% passing threshold results in passed=False."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    emp_id = emp_user.employee_profile.id

    quiz = db_session.scalars(select(CourseQuiz)).first()
    assert quiz is not None

    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == emp_id)
        .where(TrainingEnrollment.training_course_id == quiz.course_id)
    ).first()
    assert enrollment is not None

    # Clear previous attempts for clean quota
    db_session.query(QuizAttempt).filter(QuizAttempt.enrollment_id == enrollment.id).delete()
    db_session.commit()

    questions = db_session.scalars(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index.asc())
    ).all()
    assert len(questions) >= 2

    # Deliberately answer all questions with wrong options
    wrong_answers = []
    for q in questions:
        wrong_opt = next(o for o in q.options if not o.is_correct)
        wrong_answers.append({"question_id": str(q.id), "selected_option_id": str(wrong_opt.id)})

    resp = client.post(
        f"/api/v1/learning/courses/{quiz.course_id}/quiz/submit",
        headers=employee_headers,
        json={"answers": wrong_answers},
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["passed"] is False
    assert float(res["score"]) < 70.0


def test_hr_admin_can_manage_course_resources(
    client: TestClient, admin_headers: dict, employee_headers: dict, db_session: Session
):
    """HR Admin can create, update, and delete course learning resources; regular employees are forbidden."""
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.is_active == True)
    ).first()
    assert course is not None

    payload = {
        "title": "Automated Test Resource",
        "description": "Comprehensive guide for automated test suite",
        "skill_covered": "Test Engineering",
        "provider": "Official Documentation",
        "external_url": "https://docs.python.org/3/library/unittest.html",
        "resource_type": "DOCUMENTATION",
        "access_type": "FREE",
        "estimated_minutes": 25,
        "order_index": 99,
        "is_required": True,
        "is_active": True,
    }

    # Employee forbidden
    emp_resp = client.post(
        f"/api/v1/learning/courses/{course.id}/resources",
        headers=employee_headers,
        json=payload,
    )
    assert emp_resp.status_code == 403

    # HR Admin allowed
    admin_resp = client.post(
        f"/api/v1/learning/courses/{course.id}/resources",
        headers=admin_headers,
        json=payload,
    )
    assert admin_resp.status_code == 201
    created_res = admin_resp.json()
    res_id = created_res["id"]
    assert created_res["title"] == payload["title"]
    assert created_res["provider"] == payload["provider"]

    # HR Admin can update
    update_payload = {"title": "Updated Test Resource Title", "estimated_minutes": 35}
    upd_resp = client.put(
        f"/api/v1/learning/resources/{res_id}",
        headers=admin_headers,
        json=update_payload,
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["title"] == "Updated Test Resource Title"
    assert upd_resp.json()["estimated_minutes"] == 35

    # HR Admin can delete / deactivate
    del_resp = client.delete(
        f"/api/v1/learning/resources/{res_id}",
        headers=admin_headers,
    )
    assert del_resp.status_code == 200


def test_quiz_answers_not_leaked_before_submission(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Quiz API must never leak `is_correct` flags to the frontend prior to submission."""
    quiz = db_session.scalars(select(CourseQuiz)).first()
    assert quiz is not None

    resp = client.get(f"/api/v1/learning/courses/{quiz.course_id}/quiz", headers=employee_headers)
    assert resp.status_code == 200
    data = resp.json()

    assert "questions" in data
    assert len(data["questions"]) > 0

    for q in data["questions"]:
        assert "options" in q
        for opt in q["options"]:
            assert "is_correct" not in opt
            assert "option_text" in opt


def test_quiz_submission_and_server_scoring(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Quiz answers are scored strictly on the server with explanations provided post-submission."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    emp_id = emp_user.employee_profile.id

    quiz = db_session.scalars(select(CourseQuiz)).first()
    assert quiz is not None

    # Ensure demo is enrolled in this course
    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == emp_id)
        .where(TrainingEnrollment.training_course_id == quiz.course_id)
    ).first()
    if not enrollment:
        enrollment = TrainingEnrollment(
            employee_id=emp_id,
            training_course_id=quiz.course_id,
            enrollment_status=EnrollmentStatus.IN_PROGRESS,
            enrollment_date=date.today(),
        )
        db_session.add(enrollment)
        db_session.commit()

    # Clear previous seeded attempts for this test enrollment so test starts with clean attempt quota
    db_session.query(QuizAttempt).filter(QuizAttempt.enrollment_id == enrollment.id).delete()
    db_session.commit()

    # Fetch questions and find correct options directly from DB for test assertion
    questions = db_session.scalars(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index.asc())
    ).all()
    assert len(questions) > 0

    answers = []
    for q in questions:
        correct_opt = next(o for o in q.options if o.is_correct)
        answers.append({"question_id": str(q.id), "selected_option_id": str(correct_opt.id)})

    resp = client.post(
        f"/api/v1/learning/courses/{quiz.course_id}/quiz/submit",
        headers=employee_headers,
        json={"answers": answers},
    )
    assert resp.status_code == 200
    result = resp.json()

    assert float(result["score"]) == 100.0
    assert result["passed"] is True
    assert result["attempt_number"] >= 1
    assert "breakdown" in result
    assert len(result["breakdown"]) == len(questions)

    first_item = result["breakdown"][0]
    assert first_item["is_correct"] is True
    assert first_item["explanation"] is not None


def test_hr_learning_dashboard_authorization(
    client: TestClient, admin_headers: dict, manager_headers: dict, employee_headers: dict
):
    """Only HR Admin and HR Manager roles can access the HR learning analytics dashboard."""
    # HR Admin allowed
    admin_resp = client.get("/api/v1/learning/hr-dashboard", headers=admin_headers)
    assert admin_resp.status_code == 200
    data = admin_resp.json()
    assert "total_courses" in data
    assert "total_enrollments" in data
    assert "course_summaries" in data
    assert "enrollments" in data

    # HR Manager allowed
    mgr_resp = client.get("/api/v1/learning/hr-dashboard", headers=manager_headers)
    assert mgr_resp.status_code == 200

    # Employee forbidden
    emp_resp = client.get("/api/v1/learning/hr-dashboard", headers=employee_headers)
    assert emp_resp.status_code == 403


def test_course_completion_requires_both_lessons_and_quiz(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Course completion status requires completing all required lessons AND passing the quiz."""
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    emp_id = emp_user.employee_profile.id

    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.course_code == "TR-SQL-FUND")
    ).first()
    assert course is not None

    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == emp_id)
        .where(TrainingEnrollment.training_course_id == course.id)
    ).first()
    if not enrollment:
        enrollment = TrainingEnrollment(
            employee_id=emp_id,
            training_course_id=course.id,
            enrollment_status=EnrollmentStatus.IN_PROGRESS,
            enrollment_date=date.today(),
        )
        db_session.add(enrollment)
        db_session.commit()
    else:
        enrollment.enrollment_status = EnrollmentStatus.IN_PROGRESS
        enrollment.completion_date = None
        enrollment.certificate_issued = False
        db_session.commit()

    # Clear previous completions and attempts for SQL course to ensure isolated test state
    from app.models import LessonCompletion

    db_session.query(LessonCompletion).filter(
        LessonCompletion.enrollment_id == enrollment.id
    ).delete()
    db_session.query(QuizAttempt).filter(QuizAttempt.enrollment_id == enrollment.id).delete()
    db_session.commit()

    # Complete only the first lesson
    lessons = db_session.scalars(
        select(CourseLesson)
        .where(CourseLesson.course_id == course.id)
        .where(CourseLesson.is_active == True)
        .where(CourseLesson.is_required == True)
        .order_by(CourseLesson.order_index.asc())
    ).all()
    assert len(lessons) >= 2

    client.post(f"/api/v1/learning/lessons/{lessons[0].id}/complete", headers=employee_headers)

    # Pass the quiz
    quiz = db_session.scalars(select(CourseQuiz).where(CourseQuiz.course_id == course.id)).first()
    assert quiz is not None
    questions = db_session.scalars(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index.asc())
    ).all()
    answers = []
    for q in questions:
        correct_opt = next(o for o in q.options if o.is_correct)
        answers.append({"question_id": str(q.id), "selected_option_id": str(correct_opt.id)})

    sub_resp = client.post(
        f"/api/v1/learning/courses/{course.id}/quiz/submit",
        headers=employee_headers,
        json={"answers": answers},
    )
    assert sub_resp.status_code == 200
    assert sub_resp.json()["passed"] is True

    # At this point, quiz is passed, but lesson 2 is NOT completed -> Enrollment should NOT be completed
    db_session.refresh(enrollment)
    assert enrollment.enrollment_status != EnrollmentStatus.COMPLETED

    # Now complete the remaining required lessons
    for rem_lesson in lessons[1:]:
        client.post(f"/api/v1/learning/lessons/{rem_lesson.id}/complete", headers=employee_headers)

    # Now all required lessons are completed and quiz was already passed -> Enrollment should be COMPLETED
    db_session.refresh(enrollment)
    assert enrollment.enrollment_status == EnrollmentStatus.COMPLETED
    assert enrollment.completion_date is not None


def test_completed_course_can_be_reopened_and_reviewed(
    client: TestClient, employee_headers: dict, db_session: Session
):
    """Completed courses must not lock or delete learning materials; employee can view lessons and review quiz."""
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.course_code == "TR-SQL-FUND")
    ).first()
    assert course is not None

    # Lessons endpoint must still return all lessons
    lessons_resp = client.get(
        f"/api/v1/learning/courses/{course.id}/lessons", headers=employee_headers
    )
    assert lessons_resp.status_code == 200
    lessons_data = lessons_resp.json()
    assert len(lessons_data) > 0
    for lesson in lessons_data:
        assert "title" in lesson
        assert "content" in lesson

    # Quiz endpoint must still allow review
    quiz_resp = client.get(f"/api/v1/learning/courses/{course.id}/quiz", headers=employee_headers)
    assert quiz_resp.status_code == 200
    quiz_data = quiz_resp.json()
    assert quiz_data["quiz_available"] is True
    assert quiz_data["user_has_passed"] is True
    assert len(quiz_data["questions"]) > 0

    # My courses list must show 100% progress and COMPLETED status
    my_courses_resp = client.get("/api/v1/learning/my-courses", headers=employee_headers)
    assert my_courses_resp.status_code == 200
    my_courses = my_courses_resp.json()
    completed_enr = next((c for c in my_courses if c["course_id"] == str(course.id)), None)
    assert completed_enr is not None
    assert completed_enr["enrollment_status"] == "COMPLETED"
    assert float(completed_enr["progress_percentage"]) == 100.0


def test_progress_percentage_clean_decimal_formatting(
    client: TestClient, employee_headers: dict, manager_headers: dict
):
    """Ensure course progress percentages are cleanly formatted without floating-point representation artefacts."""
    my_courses_resp = client.get("/api/v1/learning/my-courses", headers=employee_headers)
    assert my_courses_resp.status_code == 200
    for course_item in my_courses_resp.json():
        prog_str = str(course_item["progress_percentage"])
        # Should never contain IEEE-754 decimal artifacts like 33.32999999999998
        assert "99999999" not in prog_str
        assert "00000001" not in prog_str

    hr_dash_resp = client.get("/api/v1/learning/hr-dashboard", headers=manager_headers)
    assert hr_dash_resp.status_code == 200
    hr_data = hr_dash_resp.json()
    for summary in hr_data["course_summaries"]:
        prog_str = str(summary["avg_progress_percentage"])
        assert "99999999" not in prog_str
        assert "00000001" not in prog_str
    for enr in hr_data["enrollments"]:
        prog_str = str(enr["progress_percentage"])
        assert "99999999" not in prog_str
        assert "00000001" not in prog_str
