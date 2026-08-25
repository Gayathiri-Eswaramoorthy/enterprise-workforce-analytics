"""
Notification endpoints router.
"""

from uuid import UUID

from app.database import get_db
from app.models import User
from app.schemas.notification import NotificationResponse, UnreadCountResponse
from app.security import get_current_active_user
from app.services.notification_service import NotificationService
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

router = APIRouter()
notification_service = NotificationService()


@router.get(
    "",
    response_model=list[NotificationResponse],
    status_code=status.HTTP_200_OK,
    summary="List Notifications",
    description="Retrieve notifications for the current authenticated user.",
)
def list_notifications(
    unread_only: bool = Query(False, description="Filter unread notifications"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[NotificationResponse]:
    return notification_service.list_notifications(
        db=db,
        user_id=current_user.id,
        unread_only=unread_only,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Unread Notification Count",
    description="Retrieve total unread notifications count for badge display.",
)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> UnreadCountResponse:
    count = notification_service.get_unread_count(db=db, user_id=current_user.id)
    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Notification as Read",
    description="Mark a specific notification as read.",
)
def mark_read(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> NotificationResponse:
    notif = notification_service.mark_notification_read(
        db=db, notification_id=notification_id, user_id=current_user.id
    )
    return notif


@router.post(
    "/mark-all-read",
    status_code=status.HTTP_200_OK,
    summary="Mark All Notifications Read",
    description="Mark all unread notifications for the user as read.",
)
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    count = notification_service.mark_all_read(db=db, user_id=current_user.id)
    return {"message": "All notifications marked as read", "updated_count": count}
