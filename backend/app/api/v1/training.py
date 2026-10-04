"""
Training course and enrollment endpoints router.
"""

from uuid import UUID

from app.database import (
    DifficultyLevel,
    EnrollmentStatus,
    TrainingMode,
    UserRole,
    get_db,
)
from app.models import User
from app.schemas.training import (
    TrainingCourseCreate,
    TrainingCourseResponse,
    TrainingCourseUpdate,
    TrainingEnrollmentCreate,
    TrainingEnrollmentResponse,
    TrainingEnrollmentUpdate,
)
from app.security import (
    HR_ROLES,
    ensure_employee_access,
    get_current_active_user,
    require_roles,
    scope_employee_filter,
)
from app.services.audit_service import AuditService
from app.services.training_service import TrainingService
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
training_service = TrainingService()
audit_service = AuditService()

# Self-service limits: employees may start or drop their own courses and rate them,
# but completion, scores, and certificates are recorded by HR.
EMPLOYEE_SETTABLE_STATUSES = {EnrollmentStatus.IN_PROGRESS, EnrollmentStatus.DROPPED}
EMPLOYEE_SETTABLE_FIELDS = {"enrollment_status", "feedback_rating"}


@router.get(
    "/courses",
    response_model=list[TrainingCourseResponse],
    status_code=status.HTTP_200_OK,
    summary="List Training Courses",
    description="Retrieve available training courses with difficulty, mode, and keyword filters.",
)
def list_courses(
    difficulty: DifficultyLevel | None = Query(None, description="Filter difficulty"),
    mode: TrainingMode | None = Query(None, description="Filter delivery mode"),
    search: str | None = Query(None, description="Search course title or code"),
    active_only: bool = Query(False, description="Filter active courses only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[TrainingCourseResponse]:
    return training_service.list_courses(
        db=db,
        difficulty=difficulty,
        mode=mode,
        search=search,
        active_only=active_only,
    )


@router.post(
    "/courses",
    response_model=TrainingCourseResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Training Course",
    description="Add a new training course to the catalog and map targeted skills. Restricted to HR roles.",
)
def create_course(
    request_data: TrainingCourseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> TrainingCourseResponse:
    course = training_service.create_course(db=db, course_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="TrainingCourse",
        entity_id=course.id,
        action="CREATE",
        description=f"Created course '{course.title}' ({course.course_code})",
        user=current_user,
        request=request,
    )
    return course


@router.get(
    "/courses/{course_id}",
    response_model=TrainingCourseResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Training Course",
    description="Retrieve training course details and target skill mappings.",
)
def get_course(
    course_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TrainingCourseResponse:
    return training_service.get_course_response(db=db, course_id=course_id)


@router.put(
    "/courses/{course_id}",
    response_model=TrainingCourseResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Training Course",
    description="Update course details or targeted skills. Restricted to HR roles.",
)
def update_course(
    course_id: UUID,
    request_data: TrainingCourseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> TrainingCourseResponse:
    course = training_service.update_course(db=db, course_id=course_id, course_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="TrainingCourse",
        entity_id=course_id,
        action="UPDATE",
        description=f"Updated course '{course.title}' ({course.course_code})",
        user=current_user,
        request=request,
    )
    return course


# Enrollments
@router.get(
    "/enrollments",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Training Enrollments",
    description=(
        "Retrieve employee training enrollments with status filters. "
        "Employees only see their own enrollments."
    ),
)
def list_enrollments(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    course_id: UUID | None = Query(None, description="Filter by course"),
    status_filter: EnrollmentStatus | None = Query(
        None, alias="status", description="Filter by status"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    items, total = training_service.list_enrollments(
        db=db,
        employee_id=scope_employee_filter(db, current_user, employee_id),
        course_id=course_id,
        status=status_filter,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post(
    "/enrollments",
    response_model=TrainingEnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Enroll Employee in Course",
    description=(
        "Enroll an employee in an available training course. "
        "Employees may only enroll themselves, with status ENROLLED."
    ),
)
def enroll_employee(
    request_data: TrainingEnrollmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TrainingEnrollmentResponse:
    ensure_employee_access(db, current_user, request_data.employee_id)
    if current_user.role not in HR_ROLES:
        request_data.enrollment_status = EnrollmentStatus.ENROLLED
    enrollment = training_service.enroll_employee(db=db, enroll_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="TrainingEnrollment",
        entity_id=enrollment.id,
        action="ENROLL",
        description=f"Enrolled employee {enrollment.employee_id} in course {enrollment.training_course_id}",
        user=current_user,
        request=request,
    )
    return enrollment


@router.put(
    "/enrollments/{enrollment_id}",
    response_model=TrainingEnrollmentResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Enrollment Status",
    description=(
        "Update progress, completion score, or feedback for an enrollment. Employees may only "
        "update their own enrollments, and only to start/drop the course or leave a rating."
    ),
)
def update_enrollment(
    enrollment_id: UUID,
    request_data: TrainingEnrollmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> TrainingEnrollmentResponse:
    if current_user.role not in HR_ROLES:
        owner_id = training_service.get_enrollment_employee_id(db=db, enrollment_id=enrollment_id)
        ensure_employee_access(db, current_user, owner_id)
        changed = set(request_data.model_dump(exclude_unset=True))
        status_value = request_data.enrollment_status
        if not changed <= EMPLOYEE_SETTABLE_FIELDS or (
            status_value is not None and status_value not in EMPLOYEE_SETTABLE_STATUSES
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees can only start or drop a course and leave a rating",
            )
    enrollment = training_service.update_enrollment(
        db=db, enrollment_id=enrollment_id, enroll_in=request_data
    )
    audit_service.log_action(
        db=db,
        entity_name="TrainingEnrollment",
        entity_id=enrollment_id,
        action="UPDATE_ENROLLMENT",
        description=f"Updated enrollment status to {enrollment.enrollment_status.value} for employee {enrollment.employee_id}",
        user=current_user,
        request=request,
    )
    return enrollment
