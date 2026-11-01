"""
Learning module schemas for lessons, quizzes, attempts, and employee progress.
"""

import urllib.parse
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from app.database import DifficultyLevel, EnrollmentStatus, TrainingMode
from pydantic import BaseModel, ConfigDict, Field, field_validator


def validate_resource_url(url: str | None) -> str | None:
    if not url:
        return None
    url = url.strip()
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must start with http:// or https://")
    if not parsed.netloc or "." not in parsed.netloc:
        raise ValueError("URL must contain a valid domain name")
    return url


class CourseLessonResponse(BaseModel):
    id: UUID
    course_id: UUID
    title: str
    content: str
    description: str | None = None
    provider: str = "External"
    skill_covered: str | None = None
    resource_type: str = "VIDEO"
    access_type: str = "FREE"
    order_index: int
    is_required: bool
    estimated_minutes: int
    external_url: str | None = None
    is_active: bool = True
    resource_opened: bool = False
    opened_at: datetime | None = None
    is_completed: bool = False
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CourseLessonSummary(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    provider: str = "External"
    skill_covered: str | None = None
    resource_type: str = "VIDEO"
    access_type: str = "FREE"
    order_index: int
    is_required: bool
    estimated_minutes: int
    external_url: str | None = None
    is_active: bool = True
    resource_opened: bool = False
    is_completed: bool = False

    model_config = ConfigDict(from_attributes=True)


class CourseResourceCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    content: str = Field(default="", description="In-app key concepts or markdown summary")
    provider: str = Field(default="External", max_length=100)
    skill_covered: str | None = Field(default=None, max_length=150)
    resource_type: str = Field(
        default="VIDEO", description="VIDEO, COURSE, ARTICLE, or DOCUMENTATION"
    )
    access_type: str = Field(default="FREE", description="FREE, PAID, or ACCOUNT_REQUIRED")
    external_url: str | None = None
    estimated_minutes: int = Field(default=15, ge=1, le=1440)
    order_index: int = Field(default=1, ge=1)
    is_required: bool = True
    is_active: bool = True

    @field_validator("external_url")
    @classmethod
    def check_url(cls, v: str | None) -> str | None:
        return validate_resource_url(v)


class CourseResourceUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    content: str | None = None
    provider: str | None = None
    skill_covered: str | None = None
    resource_type: str | None = None
    access_type: str | None = None
    external_url: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=1440)
    order_index: int | None = Field(default=None, ge=1)
    is_required: bool | None = None
    is_active: bool | None = None

    @field_validator("external_url")
    @classmethod
    def check_url(cls, v: str | None) -> str | None:
        return validate_resource_url(v)


class QuizOptionPublicResponse(BaseModel):
    id: UUID
    option_text: str
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class QuizOptionFeedbackResponse(BaseModel):
    id: UUID
    option_text: str
    is_correct: bool
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class QuizQuestionPublicResponse(BaseModel):
    id: UUID
    question_text: str
    order_index: int
    options: list[QuizOptionPublicResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CourseQuizPublicResponse(BaseModel):
    id: UUID | None = None
    course_id: UUID
    title: str = ""
    description: str | None = None
    passing_score: Decimal = Decimal("70.00")
    max_attempts: int = 3
    questions_count: int = 0
    user_attempts_count: int = 0
    user_best_score: Decimal | None = None
    user_has_passed: bool = False
    can_attempt: bool = False
    quiz_available: bool = True
    message: str | None = None
    questions: list[QuizQuestionPublicResponse] = []

    model_config = ConfigDict(from_attributes=True)


class QuizSubmissionItem(BaseModel):
    question_id: UUID
    selected_option_id: UUID


class QuizSubmissionRequest(BaseModel):
    answers: list[QuizSubmissionItem]


class QuizQuestionResult(BaseModel):
    question_id: UUID
    question_text: str
    selected_option_id: UUID
    correct_option_id: UUID
    is_correct: bool
    explanation: str | None = None


class QuizAttemptResponse(BaseModel):
    id: UUID
    quiz_id: UUID
    enrollment_id: UUID
    employee_id: UUID
    attempt_number: int
    score: Decimal
    passed: bool
    attempted_at: datetime
    breakdown: list[QuizQuestionResult] | None = None
    course_completed: bool = False

    model_config = ConfigDict(from_attributes=True)


class MyCourseProgressResponse(BaseModel):
    enrollment_id: UUID
    course_id: UUID
    course_code: str
    title: str
    description: str | None = None
    provider: str
    duration_hours: Decimal
    difficulty_level: DifficultyLevel
    training_mode: TrainingMode
    enrollment_date: date
    completion_date: date | None = None
    enrollment_status: EnrollmentStatus
    total_lessons: int
    completed_lessons: int
    progress_percentage: Decimal
    quiz_available: bool = False
    quiz_passed: bool = False
    quiz_score: Decimal | None = None
    can_complete: bool = False
    target_skills: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class HRLearningCourseSummary(BaseModel):
    course_id: UUID
    course_code: str
    title: str
    enrolled_count: int
    not_started_count: int
    in_progress_count: int
    completed_count: int
    overdue_count: int
    avg_progress_percentage: Decimal
    quiz_pass_rate: Decimal
    target_skills: list[str] = []


class HRLearningEnrollmentDetail(BaseModel):
    enrollment_id: UUID
    employee_id: UUID
    employee_name: str
    employee_code: str
    department_name: str
    course_id: UUID
    course_title: str
    enrollment_date: date
    completion_date: date | None = None
    enrollment_status: EnrollmentStatus
    completed_lessons: int
    total_lessons: int
    progress_percentage: Decimal
    latest_quiz_score: Decimal | None = None
    quiz_passed: bool = False
    needs_support: bool = False
    support_reason: str | None = None
