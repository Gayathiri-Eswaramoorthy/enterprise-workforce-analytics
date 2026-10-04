"""
Workforce Risk Inference & Transparent Factor Explanation Engine.
"""

import os
from datetime import date
from typing import Any

import joblib
import pandas as pd
from app.database import RiskLevel
from app.models import (
    Employee,
)

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "workforce_risk_model.joblib")
META_PATH = os.path.join(ARTIFACTS_DIR, "model_metadata.joblib")

# (model mtime, model, metadata) - avoids re-reading the pickle from disk for every
# prediction, while still picking up a retrained artifact without a server restart.
_artifact_cache: tuple[float, Any, dict] | None = None

# Identity used when no trained artifact exists and the rule-based fallback runs
FALLBACK_MODEL_VERSION = "v0-rule-based"
FALLBACK_ALGORITHM = "Rule-based Risk Heuristic"


def load_model_artifact():
    """
    Load serialized pipeline and metadata from artifacts directory (cached).

    Returns:
        (model, metadata), or (None, None) if no trained artifact exists yet.
    """
    global _artifact_cache

    if not os.path.exists(MODEL_PATH):
        _artifact_cache = None
        return None, None

    mtime = os.path.getmtime(MODEL_PATH)
    if _artifact_cache is None or _artifact_cache[0] != mtime:
        model = joblib.load(MODEL_PATH)
        metadata = joblib.load(META_PATH) if os.path.exists(META_PATH) else {}
        _artifact_cache = (mtime, model, metadata)

    return _artifact_cache[1], _artifact_cache[2]


def extract_features_from_employee(employee: Employee) -> dict[str, Any]:
    """
    Construct model feature dict from live SQLAlchemy Employee entity.
    """
    # 1. Tenure in years
    today = date.today()
    tenure_days = (today - employee.date_of_joining).days
    tenure_years = round(max(0.1, tenure_days / 365.25), 2)

    # 2. Department & Job Role
    department = employee.department.name if employee.department else "Engineering"
    work_mode = employee.work_mode.value if employee.work_mode else "OFFICE"
    employment_type = employee.employment_type.value if employee.employment_type else "FULL_TIME"
    grade_level = employee.job_role.grade_level if employee.job_role else 3

    # 3. Performance Reviews
    reviews = sorted(employee.performance_reviews, key=lambda r: r.review_date, reverse=True)
    if reviews:
        latest_rating = reviews[0].overall_rating
        ratings = [r.overall_rating for r in reviews]
        scores = [float(r.performance_score) for r in reviews]
        average_rating = round(sum(ratings) / len(ratings), 2)
        performance_score = round(sum(scores) / len(scores), 2)
        rating_change = float(ratings[0] - ratings[1]) if len(ratings) >= 2 else 0.0
    else:
        latest_rating = 3
        average_rating = 3.0
        performance_score = 65.0
        rating_change = 0.0

    # 4. Skill Gaps
    emp_skills = {es.skill_id: es.proficiency_level for es in employee.employee_skills}
    role_skills = employee.job_role.role_skills if employee.job_role else []
    total_skill_gaps = 0
    mandatory_gaps = 0
    gaps_list = []
    for rs in role_skills:
        curr = emp_skills.get(rs.skill_id, 0)
        gap = max(0, rs.required_proficiency - curr)
        if gap > 0:
            total_skill_gaps += 1
            gaps_list.append(gap)
            if rs.mandatory:
                mandatory_gaps += 1

    avg_skill_gap = round(sum(gaps_list) / len(gaps_list), 2) if gaps_list else 0.0

    # 5. Training Enrollments
    enrollments = employee.training_enrollments
    trainings_enrolled = len(enrollments)
    trainings_completed = sum(1 for e in enrollments if e.enrollment_status.value == "COMPLETED")
    training_completion_rate = (
        round(trainings_completed / trainings_enrolled, 2) if trainings_enrolled > 0 else 0.0
    )

    overtime_frequency = (
        employee.overtime_frequency.value if employee.overtime_frequency else "NONE"
    )

    return {
        "department": department,
        "work_mode": work_mode,
        "employment_type": employment_type,
        "overtime_frequency": overtime_frequency,
        "grade_level": grade_level,
        "tenure_years": tenure_years,
        "latest_rating": latest_rating,
        "average_rating": average_rating,
        "performance_score": performance_score,
        "rating_change": rating_change,
        "total_skill_gaps": total_skill_gaps,
        "mandatory_gaps": mandatory_gaps,
        "avg_skill_gap": avg_skill_gap,
        "trainings_enrolled": trainings_enrolled,
        "trainings_completed": trainings_completed,
        "training_completion_rate": training_completion_rate,
    }


def predict_employee_risk(employee: Employee) -> dict[str, Any]:
    """
    Run ML inference on an employee record and produce risk score, category, and transparent explanations.
    """
    features = extract_features_from_employee(employee)
    df_feat = pd.DataFrame([features])

    model, meta = load_model_artifact()

    if model is not None:
        # Predict probability of class 1 (At-Risk)
        probs = model.predict_proba(df_feat)[0]
        # class 1 probability
        prob_risk = float(probs[1]) if len(probs) > 1 else float(probs[0])
        score = round(prob_risk * 100.0, 1)
        # Confidence in the predicted class: how far the probability is from a coin flip
        confidence = round(max(prob_risk, 1.0 - prob_risk), 2)
        version = meta.get("version", "v1.0.0")
        algorithm = meta.get("algorithm", "Unknown Classifier")
    else:
        # Rule-based fallback if model artifact not yet generated on disk
        score = 20.0
        if features["latest_rating"] <= 2:
            score += 35.0
        if features["rating_change"] < 0:
            score += 20.0
        if features["mandatory_gaps"] >= 2:
            score += 25.0
        if features["total_skill_gaps"] >= 3:
            score += 15.0
        score = min(95.0, score)
        confidence = 0.5  # heuristic rules carry no calibrated confidence
        version = FALLBACK_MODEL_VERSION
        algorithm = FALLBACK_ALGORITHM

    # Map to Categorical RiskLevel
    if score >= 75.0:
        risk_level = RiskLevel.CRITICAL
        result_str = "Critical Attrition Risk"
    elif score >= 50.0:
        risk_level = RiskLevel.HIGH
        result_str = "Elevated Flight Risk"
    elif score >= 25.0:
        risk_level = RiskLevel.MEDIUM
        result_str = "Moderate Risk"
    else:
        risk_level = RiskLevel.LOW
        result_str = "Stable Retained"

    # Derive transparent, feature-based explanations
    factors = []
    reasons = []

    if features["rating_change"] < 0:
        factors.append(
            {
                "factor": "Performance Trend",
                "impact": "NEGATIVE",
                "description": f"Declining performance rating (recent change: {features['rating_change']:+.1f})",
            }
        )
        reasons.append("Declining performance trend")
    elif features["rating_change"] > 0:
        factors.append(
            {
                "factor": "Performance Trend",
                "impact": "POSITIVE",
                "description": f"Improving performance rating (recent change: {features['rating_change']:+.1f})",
            }
        )

    if features["mandatory_gaps"] >= 2:
        factors.append(
            {
                "factor": "Skill Gap Severity",
                "impact": "NEGATIVE",
                "description": f"Has {features['mandatory_gaps']} mandatory role skill gaps",
            }
        )
        reasons.append(f"{features['mandatory_gaps']} critical skill gaps")
    elif features["total_skill_gaps"] >= 3:
        factors.append(
            {
                "factor": "Skill Readiness",
                "impact": "NEGATIVE",
                "description": f"Has {features['total_skill_gaps']} total skill proficiency gaps",
            }
        )
        reasons.append("High overall skill gap")

    if features["trainings_enrolled"] > 0 and features["training_completion_rate"] < 0.5:
        factors.append(
            {
                "factor": "Training Engagement",
                "impact": "NEGATIVE",
                "description": f"Low training completion rate ({features['training_completion_rate']*100:.0f}%)",
            }
        )
        reasons.append("Low training completion")
    elif features["training_completion_rate"] >= 0.8 and features["trainings_completed"] >= 2:
        factors.append(
            {
                "factor": "Training Engagement",
                "impact": "POSITIVE",
                "description": f"High training completion rate ({features['training_completion_rate']*100:.0f}%)",
            }
        )

    if features["latest_rating"] <= 2:
        factors.append(
            {
                "factor": "Latest Evaluation",
                "impact": "NEGATIVE",
                "description": f"Low recent evaluation score ({features['latest_rating']}/5)",
            }
        )
        reasons.append("Low performance evaluation")
    elif features["latest_rating"] >= 4:
        factors.append(
            {
                "factor": "Latest Evaluation",
                "impact": "POSITIVE",
                "description": f"High recent evaluation score ({features['latest_rating']}/5)",
            }
        )

    if not reasons:
        reasons.append("Normal workforce baseline metrics")

    reason_str = " • ".join(reasons)

    return {
        "score": score,
        "risk_level": risk_level,
        "result_str": result_str,
        "reason_str": reason_str,
        "factors": factors,
        "model_version": version,
        "algorithm": algorithm,
        "confidence": confidence,
    }
