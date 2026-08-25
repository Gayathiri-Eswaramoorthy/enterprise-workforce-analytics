"""
Skill catalog endpoints router.
"""

from uuid import UUID

from app.database import UserRole, get_db
from app.models import User
from app.schemas.skill import SkillCreate, SkillResponse, SkillUpdate
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.skill_service import SkillService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
skill_service = SkillService()
audit_service = AuditService()


@router.get(
    "",
    response_model=list[SkillResponse],
    status_code=status.HTTP_200_OK,
    summary="List Skills",
    description="Retrieve skills catalog with optional category and keyword search.",
)
def list_skills(
    category: str | None = Query(None, description="Filter by skill category"),
    search: str | None = Query(None, description="Search skill name or code"),
    active_only: bool = Query(False, description="Filter active skills only"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[SkillResponse]:
    return skill_service.list_skills(
        db=db, category=category, search=search, active_only=active_only
    )


@router.post(
    "",
    response_model=SkillResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Skill",
    description="Register a new skill in the catalog. Restricted to HR roles.",
)
def create_skill(
    request_data: SkillCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> SkillResponse:
    skill = skill_service.create_skill(db=db, skill_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="Skill",
        entity_id=skill.id,
        action="CREATE",
        description=f"Created skill '{skill.name}' ({skill.skill_code})",
        user=current_user,
        request=request,
    )
    return skill


@router.get(
    "/{skill_id}",
    response_model=SkillResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Skill",
    description="Retrieve skill details by ID.",
)
def get_skill(
    skill_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SkillResponse:
    skill = skill_service.get_skill(db=db, skill_id=skill_id)
    return SkillResponse.model_validate(skill)


@router.put(
    "/{skill_id}",
    response_model=SkillResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Skill",
    description="Update skill details or active status. Restricted to HR roles.",
)
def update_skill(
    skill_id: UUID,
    request_data: SkillUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> SkillResponse:
    skill = skill_service.update_skill(db=db, skill_id=skill_id, skill_in=request_data)
    audit_service.log_action(
        db=db,
        entity_name="Skill",
        entity_id=skill_id,
        action="UPDATE",
        description=f"Updated skill '{skill.name}' ({skill.skill_code})",
        user=current_user,
        request=request,
    )
    return skill
