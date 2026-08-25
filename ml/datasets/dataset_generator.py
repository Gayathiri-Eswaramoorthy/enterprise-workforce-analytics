"""
Synthetic HR Workforce Dataset Generator.

NOTE: This synthetic dataset generator is designed strictly for development,
training, and automated testing of the Workforce Risk Prediction model.
It does NOT represent proprietary enterprise production records.
"""

import os
import random

import numpy as np
import pandas as pd


def generate_workforce_dataset(num_samples: int = 1200, random_seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic workforce records with realistic statistical correlations
    between tenure, performance scores, skill gaps, training participation, and attrition risk.
    """
    np.random.seed(random_seed)
    random.seed(random_seed)

    departments = ["Engineering", "Human Resources", "Sales", "Marketing", "Product"]
    work_modes = ["OFFICE", "REMOTE", "HYBRID"]
    employment_types = ["FULL_TIME", "CONTRACT", "PART_TIME"]

    records = []
    for i in range(num_samples):
        emp_id = f"EMP-SYNTH-{i+1:04d}"
        department = random.choice(departments)
        work_mode = random.choice(work_modes)
        employment_type = random.choice(employment_types)
        grade_level = random.randint(1, 10)

        # Tenure in years (0.5 to 15 years)
        tenure_years = round(random.uniform(0.5, 12.0), 1)

        # Performance evaluation history (1.0 to 5.0)
        latest_rating = random.choices([1, 2, 3, 4, 5], weights=[0.05, 0.15, 0.40, 0.30, 0.10])[0]
        avg_rating = round(max(1.0, min(5.0, latest_rating + random.uniform(-0.5, 0.5))), 2)
        performance_score = round(avg_rating * 20.0 + random.uniform(-5.0, 5.0), 2)

        # Performance trend: -1 for declining, 0 for stable, +1 for improving
        rating_change = round(random.choice([-1.0, -0.5, 0.0, 0.0, 0.5, 1.0]), 1)

        # Skill gap indicators
        total_skill_gaps = random.randint(0, 6)
        mandatory_gaps = random.randint(0, min(total_skill_gaps, 3))
        avg_skill_gap = round(random.uniform(0.0, 3.0) if total_skill_gaps > 0 else 0.0, 2)

        # Training indicators
        trainings_enrolled = random.randint(0, 8)
        trainings_completed = random.randint(0, trainings_enrolled)
        training_completion_rate = (
            round(trainings_completed / trainings_enrolled, 2) if trainings_enrolled > 0 else 0.0
        )

        # Overtime indicator
        overtime_frequency = random.choice(["NONE", "OCCASIONAL", "FREQUENT"])

        # Ground-truth risk probability calculation (realistic domain logic for synthetic ground truth)
        risk_score = 0.15  # baseline 15%

        # Risk drivers
        if latest_rating <= 2:
            risk_score += 0.25
        elif latest_rating >= 4:
            risk_score -= 0.10

        if rating_change < 0:
            risk_score += 0.18
        elif rating_change > 0:
            risk_score -= 0.08

        if mandatory_gaps >= 2:
            risk_score += 0.20
        elif total_skill_gaps >= 4:
            risk_score += 0.12

        if training_completion_rate < 0.4 and trainings_enrolled > 0:
            risk_score += 0.10
        elif training_completion_rate >= 0.8:
            risk_score -= 0.10

        if tenure_years < 1.5 or tenure_years > 8.0:
            risk_score += 0.08

        if overtime_frequency == "FREQUENT":
            risk_score += 0.12

        # Add noise
        risk_score = max(0.02, min(0.98, risk_score + random.gauss(0, 0.08)))

        # Target label: 1 if At-Risk (attrition/disengagement), 0 otherwise
        target_at_risk = 1 if risk_score >= 0.50 else 0

        records.append(
            {
                "employee_code": emp_id,
                "department": department,
                "work_mode": work_mode,
                "employment_type": employment_type,
                "grade_level": grade_level,
                "tenure_years": tenure_years,
                "latest_rating": latest_rating,
                "average_rating": avg_rating,
                "performance_score": performance_score,
                "rating_change": rating_change,
                "total_skill_gaps": total_skill_gaps,
                "mandatory_gaps": mandatory_gaps,
                "avg_skill_gap": avg_skill_gap,
                "trainings_enrolled": trainings_enrolled,
                "trainings_completed": trainings_completed,
                "training_completion_rate": training_completion_rate,
                "overtime_frequency": overtime_frequency,
                "target_at_risk": target_at_risk,
            }
        )

    df = pd.DataFrame(records)
    return df


if __name__ == "__main__":
    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_file = os.path.join(out_dir, "synthetic_workforce_data.csv")
    dataset = generate_workforce_dataset(1500)
    dataset.to_csv(out_file, index=False)
    print(f"Generated {len(dataset)} synthetic workforce records saved to: {out_file}")
