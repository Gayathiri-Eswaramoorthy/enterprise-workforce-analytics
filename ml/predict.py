"""
Workforce Risk Inference & Transparent Factor Explanation Engine.

PROVENANCE NOTE:
Inference utilizes a Random Forest classifier trained on the publicly available, fictional
IBM HR Analytics Employee Attrition benchmark dataset. Model features are derived from
the application's employee entities using explicit, documented transformations.
"""

import os
from datetime import date
from typing import Any

import joblib
import pandas as pd
from app.database import Gender, OvertimeFrequency, RiskLevel
from app.models import Employee

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
    Extract model features and contextual attributes from a live SQLAlchemy Employee entity.

    Feature Alignment & Mapping Decisions:
      1. Age: Computed from employee.date_of_birth in completed years. If None, imputed by pipeline.
      2. Gender: Mapped to 'Male' or 'Female' from employee.gender enum.
      3. Department: Grouped to align with IBM benchmark domains:
           - 'Engineering', 'Product & Design' -> 'Research & Development'
           - 'Enterprise Sales', 'Growth & Marketing' -> 'Sales'
           - 'Human Resources' -> 'Human Resources'
         Unknown or unmapped departments are handled gracefully by OneHotEncoder(handle_unknown='ignore').
      4. JobLevel: Derived from JobRole.grade_level (1..10 scale mapped to 1..5 scale via `(grade + 1) // 2`).
      5. YearsAtCompany: Computed from employee.date_of_joining in completed years.
      6. OverTime: Mapped from OvertimeFrequency (OCCASIONAL or FREQUENT -> 'Yes', NONE -> 'No').
      7. PerformanceRating: Taken directly from latest performance review overall_rating (unconstrained 1..5).
         If employee has no reviews, None is passed and handled explicitly by the pipeline's median imputer.
      8. TrainingTimesLastYear: Count of employee training enrollments.
    """
    today = date.today()

    # 1. Age (in completed years)
    if employee.date_of_birth:
        age: int | None = int((today - employee.date_of_birth).days // 365.25)
    else:
        age = None

    # 2. Gender
    if employee.gender == Gender.MALE:
        gender: str | None = "Male"
    elif employee.gender == Gender.FEMALE:
        gender = "Female"
    else:
        gender = None

    # 3. Department mapping
    dept_name = employee.department.name if employee.department else None
    if dept_name in ("Engineering", "Product & Design"):
        department: str | None = "Research & Development"
    elif dept_name in ("Enterprise Sales", "Growth & Marketing"):
        department = "Sales"
    elif dept_name == "Human Resources":
        department = "Human Resources"
    else:
        department = dept_name

    # 4. JobLevel (1 to 5 scale derived from 1 to 10 grade_level)
    if employee.job_role and employee.job_role.grade_level is not None:
        grade = employee.job_role.grade_level
        job_level: int | None = int(min(5, max(1, (grade + 1) // 2)))
    else:
        job_level = None

    # 5. YearsAtCompany
    if employee.date_of_joining:
        years_at_company: int | None = max(
            0, int((today - employee.date_of_joining).days // 365.25)
        )
    else:
        years_at_company = None

    # 6. OverTime
    if employee.overtime_frequency in (
        OvertimeFrequency.OCCASIONAL,
        OvertimeFrequency.FREQUENT,
    ):
        overtime: str | None = "Yes"
    elif employee.overtime_frequency == OvertimeFrequency.NONE:
        overtime = "No"
    else:
        overtime = None

    # 7. Performance Reviews
    reviews = sorted(employee.performance_reviews, key=lambda r: r.review_date, reverse=True)
    if reviews:
        latest_rating: int | None = reviews[0].overall_rating
        ratings = [r.overall_rating for r in reviews]
        scores = [float(r.performance_score) for r in reviews]
        average_rating: float = round(sum(ratings) / len(ratings), 2)
        performance_score: float = round(sum(scores) / len(scores), 2)
        rating_change: float = float(ratings[0] - ratings[1]) if len(ratings) >= 2 else 0.0
    else:
        latest_rating = None
        average_rating = 3.0
        performance_score = 65.0
        rating_change = 0.0

    # 8. Training Enrollments
    enrollments = employee.training_enrollments
    trainings_enrolled = len(enrollments)
    trainings_completed = sum(1 for e in enrollments if e.enrollment_status.value == "COMPLETED")
    training_completion_rate = (
        round(trainings_completed / trainings_enrolled, 2) if trainings_enrolled > 0 else 0.0
    )
    training_times_last_year = trainings_enrolled

    # 9. Skill Gaps (Retained for organizational explainability & recommendation alignment)
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

    # Core 8-feature dictionary matching the trained pipeline schema
    model_features = {
        "Department": department,
        "Gender": gender,
        "OverTime": overtime,
        "Age": age,
        "JobLevel": job_level,
        "YearsAtCompany": years_at_company,
        "PerformanceRating": latest_rating,
        "TrainingTimesLastYear": training_times_last_year,
    }

    # Contextual dictionary for explanations and fallback heuristics
    context = {
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
        "overtime_frequency": (
            employee.overtime_frequency.value if employee.overtime_frequency else "NONE"
        ),
        "department_name": dept_name,
        "years_at_company": years_at_company or 0,
    }

    return {
        "model_features": model_features,
        "context": context,
    }


def predict_employee_risk(employee: Employee) -> dict[str, Any]:
    """
    Run ML inference on an employee record and produce risk score, risk level,
    transparent factor explanations, and confidence metrics.
    """
    extracted = extract_features_from_employee(employee)
    model_features = extracted["model_features"]
    context = extracted["context"]

    model, meta = load_model_artifact()

    if model is not None:
        df_feat = pd.DataFrame([model_features])
        probs = model.predict_proba(df_feat)[0]
        # Class 1 probability (At-Risk of Attrition)
        prob_risk = float(probs[1]) if len(probs) > 1 else float(probs[0])
        score = round(prob_risk * 100.0, 1)
        # Calibrated confidence: distance from ambiguous decision boundary (0.50)
        confidence = round(max(prob_risk, 1.0 - prob_risk), 2)
        version = meta.get("version", "v2.0.0-ibm")
        algorithm = meta.get("algorithm", "Random Forest Classifier")
    else:
        # Rule-based fallback if model artifact not present on disk
        score = 20.0
        if context["latest_rating"] is not None and context["latest_rating"] <= 2:
            score += 35.0
        if context["rating_change"] < 0:
            score += 20.0
        if context["mandatory_gaps"] >= 2:
            score += 25.0
        if context["total_skill_gaps"] >= 3:
            score += 15.0
        if context["overtime_frequency"] == "FREQUENT":
            score += 15.0
        score = min(95.0, score)
        confidence = 0.5  # heuristic rules carry no calibrated probability confidence
        version = FALLBACK_MODEL_VERSION
        algorithm = FALLBACK_ALGORITHM

    # Map score to standardized enterprise RiskLevel
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

    # Derive transparent, feature-based factor explanations
    factors = []
    reasons = []

    # Overtime factor (key driver in the benchmark)
    if model_features["OverTime"] == "Yes":
        factors.append(
            {
                "factor": "Overtime Burden",
                "impact": "NEGATIVE",
                "description": "Employee works overtime schedule, a primary flight risk contributor in attrition benchmarks.",
            }
        )
        reasons.append("Overtime workload")
    elif model_features["OverTime"] == "No":
        factors.append(
            {
                "factor": "Work-Life Schedule",
                "impact": "POSITIVE",
                "description": "Standard working schedule with no overtime burden.",
            }
        )

    # Performance trend and evaluation
    if context["rating_change"] < 0:
        factors.append(
            {
                "factor": "Performance Trend",
                "impact": "NEGATIVE",
                "description": f"Declining performance rating (recent change: {context['rating_change']:+.1f}).",
            }
        )
        reasons.append("Declining performance trend")
    elif context["rating_change"] > 0:
        factors.append(
            {
                "factor": "Performance Trend",
                "impact": "POSITIVE",
                "description": f"Improving performance rating (recent change: {context['rating_change']:+.1f}).",
            }
        )

    if context["latest_rating"] is not None:
        if context["latest_rating"] <= 2:
            factors.append(
                {
                    "factor": "Latest Evaluation",
                    "impact": "NEGATIVE",
                    "description": f"Low recent evaluation score ({context['latest_rating']}/5).",
                }
            )
            reasons.append("Low performance evaluation")
        elif context["latest_rating"] >= 4:
            factors.append(
                {
                    "factor": "Latest Evaluation",
                    "impact": "POSITIVE",
                    "description": f"High recent evaluation score ({context['latest_rating']}/5).",
                }
            )

    # Tenure dynamics
    years = context["years_at_company"]
    if years <= 1:
        factors.append(
            {
                "factor": "Tenure Milestone",
                "impact": "NEGATIVE",
                "description": f"Early tenure ({years} yr at organization), a documented attrition vulnerability window.",
            }
        )
        reasons.append("Early tenure milestone")
    elif years >= 7:
        factors.append(
            {
                "factor": "Tenure Stability",
                "impact": "POSITIVE",
                "description": f"Established organizational tenure ({years} years with company).",
            }
        )

    # Training and skill gap context
    if context["mandatory_gaps"] >= 2:
        factors.append(
            {
                "factor": "Skill Gap Severity",
                "impact": "NEGATIVE",
                "description": f"Has {context['mandatory_gaps']} mandatory role skill gaps requiring attention.",
            }
        )
        reasons.append(f"{context['mandatory_gaps']} critical skill gaps")
    elif context["total_skill_gaps"] >= 3:
        factors.append(
            {
                "factor": "Skill Readiness",
                "impact": "NEGATIVE",
                "description": f"Has {context['total_skill_gaps']} total skill proficiency gaps.",
            }
        )
        reasons.append("High overall skill gap")

    if context["trainings_enrolled"] > 0 and context["training_completion_rate"] < 0.5:
        factors.append(
            {
                "factor": "Training Engagement",
                "impact": "NEGATIVE",
                "description": f"Low training completion rate ({context['training_completion_rate']*100:.0f}%).",
            }
        )
        reasons.append("Low training completion")
    elif context["training_completion_rate"] >= 0.8 and context["trainings_completed"] >= 2:
        factors.append(
            {
                "factor": "Training Engagement",
                "impact": "POSITIVE",
                "description": f"High training completion rate ({context['training_completion_rate']*100:.0f}%).",
            }
        )

    # If risk is elevated, check remaining Random Forest input features for driver attribution
    if score >= 50.0:
        if context.get("job_level") is not None and context["job_level"] <= 2:
            factors.append(
                {
                    "factor": "Job Level Vulnerability",
                    "impact": "NEGATIVE",
                    "description": f"Early job grade (Level {context['job_level']}/5) with elevated turnover rate in benchmarks.",
                }
            )
            reasons.append("Junior job level mobility")
        if context.get("age") is not None and context["age"] <= 26:
            factors.append(
                {
                    "factor": "Early Career Window",
                    "impact": "NEGATIVE",
                    "description": f"Early career stage (Age {context['age']}) with high external mobility.",
                }
            )
            reasons.append("Early career mobility")
        if model_features.get("Department") in ("Sales", "Human Resources"):
            factors.append(
                {
                    "factor": "Department Dynamics",
                    "impact": "NEGATIVE",
                    "description": f"Benchmark turnover rate is elevated in {model_features['Department']}.",
                }
            )
            reasons.append(f"{model_features['Department']} turnover benchmark")
        if model_features.get("TrainingTimesLastYear", 0) == 0:
            factors.append(
                {
                    "factor": "Training Opportunity",
                    "impact": "NEGATIVE",
                    "description": "No formal training enrollments recorded in the preceding cycle.",
                }
            )
            reasons.append("Zero training engagement")

    if not reasons:
        if score >= 50.0:
            reasons.append("Elevated multivariate flight risk profile")
        else:
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
