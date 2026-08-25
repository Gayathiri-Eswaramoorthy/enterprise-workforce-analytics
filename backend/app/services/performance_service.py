"""
Performance service for reviews and historical trend analytics.
"""

from uuid import UUID

from app.database import ReviewCycle
from app.models import PerformanceReview, User
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.performance_repository import PerformanceRepository
from app.repositories.user_repository import UserRepository
from app.schemas.performance import (
    PerformanceReviewCreate,
    PerformanceReviewResponse,
    PerformanceTrendSummary,
)
from fastapi import HTTPException, status
from sqlalchemy.orm import Session


class PerformanceService:
    def __init__(self):
        self.repository = PerformanceRepository()
        self.employee_repo = EmployeeRepository()
        self.user_repo = UserRepository()

    def get_review(self, db: Session, review_id: UUID) -> PerformanceReview:
        review = self.repository.get_by_id_with_relations(db, review_id)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Performance review not found",
            )
        return review

    def create_review(
        self, db: Session, review_in: PerformanceReviewCreate, current_user: User
    ) -> PerformanceReviewResponse:
        # Validate employee
        emp = self.employee_repo.get_by_id(db, review_in.employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        review_data = review_in.model_dump()
        review = PerformanceReview(**review_data)
        review = self.repository.create(db, review)
        return self._format_review_response(review)

    def list_reviews(
        self,
        db: Session,
        employee_id: UUID | None = None,
        reviewer_id: UUID | None = None,
        review_cycle: ReviewCycle | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[PerformanceReviewResponse], int]:
        skip = (page - 1) * page_size
        reviews, total = self.repository.list_reviews(
            db,
            employee_id=employee_id,
            reviewer_id=reviewer_id,
            review_cycle=review_cycle,
            skip=skip,
            limit=page_size,
        )
        return [self._format_review_response(r) for r in reviews], total

    def get_employee_performance_summary(
        self, db: Session, employee_id: UUID
    ) -> PerformanceTrendSummary:
        emp = self.employee_repo.get_by_id(db, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        reviews = self.repository.get_employee_reviews(db, employee_id)
        if not reviews:
            return PerformanceTrendSummary(
                employee_id=employee_id,
                total_reviews=0,
                trend="STABLE",
                recent_reviews=[],
            )

        # reviews are ordered desc by review_date
        ratings = [r.overall_rating for r in reviews]
        scores = [float(r.performance_score) for r in reviews]

        latest_rating = ratings[0]
        latest_score = scores[0]
        avg_rating = round(sum(ratings) / len(ratings), 2)
        avg_score = round(sum(scores) / len(scores), 2)

        # Determine trend
        if len(ratings) >= 2:
            rating_change = float(ratings[0] - ratings[1])
            if rating_change > 0:
                trend = "IMPROVING"
            elif rating_change < 0:
                trend = "DECLINING"
            else:
                trend = "STABLE"
        else:
            rating_change = 0.0
            trend = "STABLE"

        recent_responses = [self._format_review_response(r) for r in reviews[:5]]

        return PerformanceTrendSummary(
            employee_id=employee_id,
            total_reviews=len(reviews),
            latest_rating=latest_rating,
            latest_score=latest_score,
            average_rating=avg_rating,
            average_score=avg_score,
            rating_change=rating_change,
            trend=trend,
            recent_reviews=recent_responses,
        )

    def _format_review_response(self, review: PerformanceReview) -> PerformanceReviewResponse:
        resp = PerformanceReviewResponse.model_validate(review)
        if review.employee:
            resp.employee_name = f"{review.employee.first_name} {review.employee.last_name}"
            resp.employee_code = review.employee.employee_code
        if review.reviewer:
            resp.reviewer_name = review.reviewer.display_name or review.reviewer.username
        return resp
