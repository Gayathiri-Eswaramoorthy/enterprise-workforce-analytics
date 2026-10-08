"""
PredictionService: Coordinates ML inference, PredictionHistory logging, and risk alerts.
"""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from app.database import (
    NotificationType,
    PredictionType,
    RiskLevel,
)
from app.models import (
    Employee,
    ModelRegistry,
    Notification,
    PredictionHistory,
    User,
)
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.prediction_repository import PredictionRepository
from app.repositories.user_repository import UserRepository
from app.schemas.prediction import (
    ModelRegistryResponse,
    PredictionFactor,
    PredictionHistoryResponse,
    PredictionResult,
)
from app.security import HR_ROLES
from fastapi import HTTPException, status
from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session, selectinload

from ml.predict import (
    FALLBACK_ALGORITHM,
    FALLBACK_MODEL_VERSION,
    MODEL_PATH,
    load_model_artifact,
    predict_employee_risk,
)

MODEL_NAME = "Workforce Attrition & Risk Predictor"
ALERT_RISK_LEVELS = (RiskLevel.HIGH, RiskLevel.CRITICAL)


def _pct(value: float) -> Decimal:
    return Decimal(str(round(value * 100, 2)))


def register_model_from_metadata(db: Session, metadata: dict, model_path: str) -> ModelRegistry:
    """
    Upsert the model described by a training-metadata dict into the registry and make it
    the only active model. Metrics are the held-out test-set metrics from training.
    """
    metrics = metadata["final_test_metrics"]
    fields = {
        "model_name": MODEL_NAME,
        "algorithm": metadata["algorithm"],
        "training_dataset": f"Synthetic Workforce Dataset ({metadata['dataset_size']} samples)",
        "accuracy": _pct(metrics["accuracy"]),
        "precision_score": _pct(metrics["precision"]),
        "recall_score": _pct(metrics["recall"]),
        "f1_score": _pct(metrics["f1"]),
        "model_file_path": model_path,
        "is_active": True,
        "deployed_at": datetime.now(timezone.utc),
    }

    db.execute(update(ModelRegistry).values(is_active=False))
    entry = db.execute(
        select(ModelRegistry).where(ModelRegistry.model_version == metadata["version"])
    ).scalar_one_or_none()
    if entry:
        for key, value in fields.items():
            setattr(entry, key, value)
    else:
        entry = ModelRegistry(model_version=metadata["version"], **fields)
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


class PredictionService:
    def __init__(self):
        self.repository = PredictionRepository()
        self.employee_repo = EmployeeRepository()
        self.user_repo = UserRepository()

    def get_active_model(self, db: Session) -> ModelRegistry:
        """
        Return the registry entry for the model that will actually serve predictions.

        The trained artifact on disk is the source of truth: if the active registry entry
        doesn't match its version (e.g. the artifact shipped with the repo was never
        registered in this database), it is registered from the artifact's own metadata.
        """
        active = self.repository.get_active_model(db)
        _, metadata = load_model_artifact()

        if metadata and metadata.get("final_test_metrics"):
            if active is None or active.model_version != metadata["version"]:
                active = register_model_from_metadata(db, metadata, MODEL_PATH)
            return active

        if active is None or active.model_version != FALLBACK_MODEL_VERSION:
            # No trained artifact: register the rule-based fallback honestly, without
            # claiming evaluation metrics it was never measured against.
            db.execute(update(ModelRegistry).values(is_active=False))
            active = self.repository.get_model_by_version(db, FALLBACK_MODEL_VERSION)
            if active is None:
                active = ModelRegistry(
                    model_name=MODEL_NAME,
                    model_version=FALLBACK_MODEL_VERSION,
                    algorithm=FALLBACK_ALGORITHM,
                    training_dataset="None (heuristic rules)",
                    accuracy=Decimal("0"),
                    precision_score=Decimal("0"),
                    recall_score=Decimal("0"),
                    f1_score=Decimal("0"),
                )
                db.add(active)
            active.is_active = True
            active.deployed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(active)
        return active

    def predict_for_employee(
        self,
        db: Session,
        employee_id: UUID,
        pred_type: PredictionType = PredictionType.ATTRITION,
        active_model: ModelRegistry | None = None,
    ) -> PredictionResult:
        emp = self.employee_repo.get_by_id_with_relations(db, employee_id)
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found",
            )

        active_model = active_model or self.get_active_model(db)

        previous_risk = db.execute(
            select(PredictionHistory.risk_level)
            .where(
                PredictionHistory.employee_id == emp.id,
                PredictionHistory.prediction_type == pred_type,
            )
            .order_by(desc(PredictionHistory.generated_at))
            .limit(1)
        ).scalar_one_or_none()

        # Run inference
        result = predict_employee_risk(emp)

        # Save immutable record to PredictionHistory
        history = PredictionHistory(
            employee_id=emp.id,
            model_registry_id=active_model.id,
            prediction_type=pred_type,
            prediction_score=Decimal(str(result["score"])),
            confidence_score=Decimal(str(result["confidence"])),
            risk_level=result["risk_level"],
            prediction_result=result["result_str"],
            prediction_reason=result["reason_str"],
        )
        db.add(history)
        db.commit()
        db.refresh(history)

        # Alert HR users when an employee newly escalates to HIGH or CRITICAL risk. Re-running
        # predictions for someone already flagged doesn't re-alert, so repeated batch runs
        # don't flood inboxes. Only HR roles are notified: attrition risk is confidential.
        newly_escalated = (
            result["risk_level"] in ALERT_RISK_LEVELS and previous_risk not in ALERT_RISK_LEVELS
        )
        if newly_escalated:
            hr_users = (
                db.execute(
                    select(User).where(
                        User.is_active == True, User.role.in_(HR_ROLES)
                    )  # noqa: E712
                )
                .scalars()
                .all()
            )
            for hr_user in hr_users:
                notif = Notification(
                    user_id=hr_user.id,
                    title=f"⚠️ {result['risk_level'].value} Risk Alert: {emp.first_name} {emp.last_name}",
                    message=(
                        f"Employee {emp.first_name} {emp.last_name} ({emp.employee_code}) has been evaluated at "
                        f"{result['score']}% risk ({result['result_str']}). Drivers: {result['reason_str']}."
                    ),
                    notification_type=NotificationType.ALERT,
                )
                db.add(notif)
            db.commit()

        # Build response
        factors = [PredictionFactor(**f) for f in result["factors"]]
        return PredictionResult(
            id=history.id,
            employee_id=emp.id,
            employee_name=f"{emp.first_name} {emp.last_name}",
            employee_code=emp.employee_code,
            department_name=emp.department.name if emp.department else None,
            job_role_title=emp.job_role.title if emp.job_role else None,
            model_version=active_model.model_version,
            algorithm=active_model.algorithm,
            prediction_type=pred_type,
            prediction_score=result["score"],
            confidence_score=result["confidence"],
            risk_level=result["risk_level"],
            prediction_result=result["result_str"],
            prediction_reason=result["reason_str"],
            contributing_factors=factors,
            generated_at=history.generated_at,
        )

    def predict_all_employees(
        self,
        db: Session,
        department_id: UUID | None = None,
        pred_type: PredictionType = PredictionType.ATTRITION,
    ) -> list[PredictionResult]:
        stmt = (
            select(Employee)
            .where(Employee.is_deleted == False)
            .options(
                selectinload(Employee.department),
                selectinload(Employee.job_role),
                selectinload(Employee.performance_reviews),
                selectinload(Employee.training_enrollments),
                selectinload(Employee.employee_skills),
            )
        )
        if department_id:
            stmt = stmt.where(Employee.department_id == department_id)

        employees = db.execute(stmt).scalars().all()
        active_model = self.get_active_model(db)
        results = []
        for emp in employees:
            results.append(self.predict_for_employee(db, emp.id, pred_type, active_model))
        return results

    def list_history(
        self,
        db: Session,
        employee_id: UUID | None = None,
        risk_level: RiskLevel | None = None,
        prediction_type: PredictionType | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[PredictionHistoryResponse], int]:
        skip = (page - 1) * page_size
        items, total = self.repository.list_history(
            db,
            employee_id=employee_id,
            risk_level=risk_level,
            prediction_type=prediction_type,
            skip=skip,
            limit=page_size,
        )
        responses = []
        for h in items:
            resp = PredictionHistoryResponse.model_validate(h)
            if h.employee:
                resp.employee_name = f"{h.employee.first_name} {h.employee.last_name}"
                resp.employee_code = h.employee.employee_code
            if h.model:
                resp.model_version = h.model.model_version
            responses.append(resp)
        return responses, total

    def risk_trend(self, db: Session, months: int = 6) -> list[dict]:
        return self.repository.monthly_risk_trend(db, months=months)

    def list_models(self, db: Session) -> list[ModelRegistryResponse]:
        self.get_active_model(db)  # make sure the serving model is registered
        models = self.repository.list_models(db)
        return [ModelRegistryResponse.model_validate(m) for m in models]
