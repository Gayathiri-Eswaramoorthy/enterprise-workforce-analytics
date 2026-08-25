"""
Machine learning predictions and model registry router.
"""

from uuid import UUID

from app.database import PredictionType, RiskLevel, UserRole, get_db
from app.models import User
from app.schemas.prediction import (
    BatchPredictionRequest,
    ModelRegistryResponse,
    PredictionRequest,
    PredictionResult,
)
from app.security import get_current_active_user, require_roles
from app.services.audit_service import AuditService
from app.services.prediction_service import PredictionService
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

router = APIRouter()
prediction_service = PredictionService()
audit_service = AuditService()


@router.post(
    "/predict/{employee_id}",
    response_model=PredictionResult,
    status_code=status.HTTP_200_OK,
    summary="Predict Employee Risk",
    description="Run ML inference on an employee to predict workforce attrition risk with transparent factor explanations.",
)
def predict_employee(
    employee_id: UUID,
    request_data: PredictionRequest | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> PredictionResult:
    pred_type = request_data.prediction_type if request_data else PredictionType.ATTRITION
    result = prediction_service.predict_for_employee(
        db=db, employee_id=employee_id, pred_type=pred_type
    )
    audit_service.log_action(
        db=db,
        entity_name="PredictionHistory",
        entity_id=result.id,
        action="PREDICT",
        description=f"Generated {result.prediction_type.value} risk prediction for employee {employee_id} ({result.risk_level.value} - {result.prediction_score}%)",
        user=current_user,
        request=request,
    )
    return result


@router.post(
    "/predict-all",
    response_model=list[PredictionResult],
    status_code=status.HTTP_200_OK,
    summary="Batch Predict Workforce Risk",
    description="Run ML risk predictions across all employees or within a department. Restricted to HR roles.",
)
def predict_all(
    batch_req: BatchPredictionRequest | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.HR_ADMIN, UserRole.HR_MANAGER])),
) -> list[PredictionResult]:
    dept_id = batch_req.department_id if batch_req else None
    pred_type = batch_req.prediction_type if batch_req else PredictionType.ATTRITION
    results = prediction_service.predict_all_employees(
        db=db, department_id=dept_id, pred_type=pred_type
    )
    audit_service.log_action(
        db=db,
        entity_name="PredictionHistory",
        entity_id=current_user.id,
        action="BATCH_PREDICT",
        description=f"Triggered batch risk prediction for {len(results)} employees",
        user=current_user,
        request=request,
    )
    return results


@router.get(
    "/history",
    response_model=dict,
    status_code=status.HTTP_200_OK,
    summary="List Prediction History",
    description="Query historical prediction logs with filtering and pagination.",
)
def list_prediction_history(
    employee_id: UUID | None = Query(None, description="Filter by employee"),
    risk_level: RiskLevel | None = Query(None, description="Filter by risk level"),
    prediction_type: PredictionType | None = Query(None, description="Filter by prediction type"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict:
    items, total = prediction_service.list_history(
        db=db,
        employee_id=employee_id,
        risk_level=risk_level,
        prediction_type=prediction_type,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/models",
    response_model=list[ModelRegistryResponse],
    status_code=status.HTTP_200_OK,
    summary="List Model Registry",
    description="Inspect registered ML model versions and evaluation metrics.",
)
def list_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[ModelRegistryResponse]:
    return prediction_service.list_models(db=db)
