"""
Machine learning model registry and prediction schemas.
"""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.database import PredictionType, RiskLevel
from pydantic import BaseModel, ConfigDict, Field


class ModelRegistryBase(BaseModel):
    model_name: str = Field(..., max_length=255)
    model_version: str = Field(..., max_length=50)
    algorithm: str = Field(..., max_length=100)
    training_dataset: str = Field(..., max_length=255)
    accuracy: Decimal = Field(..., ge=0, le=100)
    precision_score: Decimal = Field(..., ge=0, le=100)
    recall_score: Decimal = Field(..., ge=0, le=100)
    f1_score: Decimal = Field(..., ge=0, le=100)
    model_file_path: str | None = None
    is_active: bool = True
    deployed_at: datetime | None = None


class ModelRegistryCreate(ModelRegistryBase):
    pass


class ModelRegistryResponse(ModelRegistryBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    total_predictions_count: int | None = None

    model_config = ConfigDict(from_attributes=True)


class PredictionFactor(BaseModel):
    factor: str
    impact: str  # POSITIVE, NEGATIVE, NEUTRAL
    description: str


class PredictionRequest(BaseModel):
    employee_id: UUID
    prediction_type: PredictionType = PredictionType.ATTRITION


class BatchPredictionRequest(BaseModel):
    department_id: UUID | None = None
    prediction_type: PredictionType = PredictionType.ATTRITION


class PredictionResult(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str | None = None
    employee_code: str | None = None
    department_name: str | None = None
    job_role_title: str | None = None
    model_version: str
    algorithm: str
    prediction_type: PredictionType
    prediction_score: float
    confidence_score: float | None = None
    risk_level: RiskLevel
    prediction_result: str
    prediction_reason: str | None = None
    contributing_factors: list[PredictionFactor] = []
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PredictionHistoryResponse(BaseModel):
    id: UUID
    employee_id: UUID
    employee_name: str | None = None
    employee_code: str | None = None
    model_registry_id: UUID
    model_version: str | None = None
    prediction_type: PredictionType
    prediction_score: Decimal
    confidence_score: Decimal | None = None
    risk_level: RiskLevel
    prediction_result: str
    prediction_reason: str | None = None
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)
