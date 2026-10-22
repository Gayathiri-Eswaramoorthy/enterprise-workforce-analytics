"""
Learning and quiz API endpoints for employees and HR administrators.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.assessment import SkillAssessmentComparison
from app.schemas.learning import (
    CourseLessonResponse,
    CourseQuizPublicResponse,
    CourseResourceCreateRequest,
    CourseResourceUpdateRequest,
    MyCourseProgressResponse,
    QuizAttemptResponse,
    QuizSubmissionRequest,
)
from app.security import (
    HR_ROLES,
    ensure_employee_access,
    get_current_active_user,
    get_linked_employee_id,
    require_hr,
    scope_employee_filter,
)
from app.services.assessment_service import AssessmentService
from app.services.audit_service import AuditService
from app.services.learning_service import LearningService
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
learning_service = LearningService()
assessment_service = AssessmentService()
audit_service = AuditService()


def _resolve_employee_id(db: Session, user: User, target_id: UUID | None = None) -> UUID:
    if user.role in HR_ROLES:
        if target_id:
            return target_id
        linked = get_linked_employee_id(db, user)
        if linked:
            return linked
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Employee ID required for HR administrative lookup",
        )
    linked = get_linked_employee_id(db, user)
    if not linked:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile linked to this user account",
        )
    if target_id and target_id != linked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees can only access their own learning progress",
        )
    return linked


@router.get(
    "/my-courses",
    response_model=list[MyCourseProgressResponse],
    status_code=status.HTTP_200_OK,
    summary="Get My Courses and Progress",
    description="Retrieve all courses the employee is enrolled in, with calculated progress %, quiz status, and deadlines.",
)
def get_my_courses(
    employee_id: UUID | None = Query(None, description="Employee ID (HR only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[MyCourseProgressResponse]:
    emp_id = _resolve_employee_id(db, current_user, employee_id)
    return learning_service.get_my_courses(db=db, employee_id=emp_id)


@router.get(
    "/courses/{course_id}/lessons",
    response_model=list[CourseLessonResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Course Lessons",
    description="List lessons for a course including completion status for the current employee.",
)
def get_course_lessons(
    course_id: UUID,
    employee_id: UUID | None = Query(None, description="Employee ID (HR only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[CourseLessonResponse]:
    emp_id = _resolve_employee_id(db, current_user, employee_id)
    return learning_service.get_course_lessons(db=db, course_id=course_id, employee_id=emp_id)


@router.post(
    "/lessons/{lesson_id}/open",
    response_model=CourseLessonResponse,
    status_code=status.HTTP_200_OK,
    summary="Record External Resource Opened",
    description="Track that an employee opened an external video, article, or course link.",
)
def open_resource(
    lesson_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CourseLessonResponse:
    emp_id = _resolve_employee_id(db, current_user)
    lesson_resp = learning_service.open_resource(db=db, lesson_id=lesson_id, employee_id=emp_id)
    audit_service.log_action(
        db=db,
        entity_name="CourseLesson",
        entity_id=lesson_id,
        action="OPEN_EXTERNAL_RESOURCE",
        description=f"Employee {emp_id} opened resource '{lesson_resp.title}' ({lesson_resp.provider})",
        user=current_user,
        request=request,
    )
    return lesson_resp


@router.post(
    "/lessons/{lesson_id}/complete",
    response_model=CourseLessonResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Lesson Complete",
    description="Mark a lesson as studied and completed. Recalculates course progress server-side.",
)
def complete_lesson(
    lesson_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CourseLessonResponse:
    emp_id = _resolve_employee_id(db, current_user)
    lesson_resp = learning_service.complete_lesson(db=db, lesson_id=lesson_id, employee_id=emp_id)
    audit_service.log_action(
        db=db,
        entity_name="CourseLesson",
        entity_id=lesson_id,
        action="COMPLETE_LESSON",
        description=f"Employee {emp_id} completed lesson '{lesson_resp.title}'",
        user=current_user,
        request=request,
    )
    return lesson_resp


@router.post(
    "/courses/{course_id}/resources",
    response_model=CourseLessonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add External Resource to Course (HR only)",
    description="Configure a new learning resource/tutorial link for a training course.",
)
def create_course_resource(
    course_id: UUID,
    resource_in: CourseResourceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> CourseLessonResponse:
    resource_resp = learning_service.create_course_resource(
        db=db, course_id=course_id, req=resource_in
    )
    audit_service.log_action(
        db=db,
        entity_name="CourseLesson",
        entity_id=resource_resp.id,
        action="CREATE_COURSE_RESOURCE",
        description=f"HR configured resource '{resource_resp.title}' for course {course_id}",
        user=current_user,
        request=request,
    )
    return resource_resp


@router.put(
    "/resources/{resource_id}",
    response_model=CourseLessonResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Course Learning Resource (HR only)",
    description="Update metadata, URL, duration, or active status of a learning resource.",
)
def update_course_resource(
    resource_id: UUID,
    resource_in: CourseResourceUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> CourseLessonResponse:
    resource_resp = learning_service.update_course_resource(
        db=db, resource_id=resource_id, req=resource_in
    )
    audit_service.log_action(
        db=db,
        entity_name="CourseLesson",
        entity_id=resource_id,
        action="UPDATE_COURSE_RESOURCE",
        description=f"HR updated resource '{resource_resp.title}'",
        user=current_user,
        request=request,
    )
    return resource_resp


@router.delete(
    "/resources/{resource_id}",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Delete Course Learning Resource (HR only)",
    description="Remove a learning resource from a course.",
)
def delete_course_resource(
    resource_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> dict:
    learning_service.delete_course_resource(db=db, resource_id=resource_id)
    audit_service.log_action(
        db=db,
        entity_name="CourseLesson",
        entity_id=resource_id,
        action="DELETE_COURSE_RESOURCE",
        description=f"HR deleted resource {resource_id}",
        user=current_user,
        request=request,
    )
    return {"success": True, "message": "Resource removed successfully"}


@router.get(
    "/courses/{course_id}/quiz",
    response_model=CourseQuizPublicResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Course Quiz",
    description="Retrieve multiple-choice questions for course quiz without exposing correct answers.",
)
def get_course_quiz(
    course_id: UUID,
    employee_id: UUID | None = Query(None, description="Employee ID (HR only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CourseQuizPublicResponse:
    emp_id = _resolve_employee_id(db, current_user, employee_id)
    return learning_service.get_course_quiz(db=db, course_id=course_id, employee_id=emp_id)


@router.post(
    "/courses/{course_id}/quiz/submit",
    response_model=QuizAttemptResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit Course Quiz",
    description="Submit quiz answers. Score is computed on the backend and checked against passing threshold.",
)
def submit_quiz(
    course_id: UUID,
    submission: QuizSubmissionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> QuizAttemptResponse:
    emp_id = _resolve_employee_id(db, current_user)
    attempt_resp = learning_service.submit_quiz(
        db=db,
        course_id=course_id,
        employee_id=emp_id,
        submission=submission,
    )
    audit_service.log_action(
        db=db,
        entity_name="CourseQuiz",
        entity_id=attempt_resp.quiz_id,
        action="SUBMIT_QUIZ",
        description=(
            f"Employee {emp_id} submitted quiz attempt #{attempt_resp.attempt_number} "
            f"with score {attempt_resp.score}% (Passed: {attempt_resp.passed})"
        ),
        user=current_user,
        request=request,
    )
    return attempt_resp


@router.get(
    "/courses/{course_id}/quiz/attempts",
    response_model=list[QuizAttemptResponse],
    status_code=status.HTTP_200_OK,
    summary="Get Quiz Attempts History",
    description="Retrieve historical quiz attempts, scores, and feedback for the course.",
)
def get_quiz_attempts(
    course_id: UUID,
    employee_id: UUID | None = Query(None, description="Employee ID (HR only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[QuizAttemptResponse]:
    emp_id = _resolve_employee_id(db, current_user, employee_id)
    return learning_service.get_quiz_attempts(db=db, course_id=course_id, employee_id=emp_id)


@router.get(
    "/assessments/my",
    response_model=list[SkillAssessmentComparison],
    status_code=status.HTTP_200_OK,
    summary="Get Employee Assessment Comparisons",
    description="Compare baseline vs post-training assessment scores with score deltas and remaining skill gaps.",
)
def get_my_assessments(
    employee_id: UUID | None = Query(None, description="Employee ID (HR only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillAssessmentComparison]:
    emp_id = _resolve_employee_id(db, current_user, employee_id)
    return assessment_service.get_employee_assessment_comparison(db=db, employee_id=emp_id)


@router.get(
    "/hr-dashboard",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="Get HR Learning Analytics Dashboard",
    description="Aggregated course metrics, completion rates, pass rates, and learners needing support queue.",
)
def get_hr_learning_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hr),
) -> dict:
    return learning_service.get_hr_learning_dashboard(db=db)
