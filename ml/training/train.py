"""
Real ML Training Pipeline: Evaluates Random Forest and Gradient Boosting models,
serializes the best model artifact, and registers metadata into PostgreSQL ModelRegistry.
"""

import os
import sys
from datetime import datetime, timezone
from decimal import Decimal

import joblib
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

current_dir = os.path.dirname(os.path.abspath(__file__))
ml_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(ml_dir)
backend_dir = os.path.join(root_dir, "backend")
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


from app.database import SessionLocal
from app.models import ModelRegistry

from ml.datasets.dataset_generator import generate_workforce_dataset


def train_and_register_model(dataset_size: int = 1500, version: str = "v1.0.0"):
    """
    Execute end-to-end ML model training, evaluation, artifact export, and database registration.
    """
    print(f"[ML Pipeline] Generating synthetic training dataset with {dataset_size} records...")
    df = generate_workforce_dataset(num_samples=dataset_size, random_seed=42)

    # Feature definitions
    categorical_features = ["department", "work_mode", "employment_type", "overtime_frequency"]
    numerical_features = [
        "grade_level",
        "tenure_years",
        "latest_rating",
        "average_rating",
        "performance_score",
        "rating_change",
        "total_skill_gaps",
        "mandatory_gaps",
        "avg_skill_gap",
        "trainings_enrolled",
        "trainings_completed",
        "training_completion_rate",
    ]
    target_col = "target_at_risk"

    X = df[categorical_features + numerical_features]
    y = df[target_col]

    # Split: 80% train, 20% test
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Preprocessing Pipeline
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), numerical_features),
            (
                "cat",
                OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                categorical_features,
            ),
        ]
    )

    # Candidate 1: Random Forest Classifier
    rf_pipeline = Pipeline(
        [
            ("preprocessor", preprocessor),
            ("classifier", RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)),
        ]
    )
    rf_pipeline.fit(X_train, y_train)
    rf_preds = rf_pipeline.predict(X_test)
    rf_acc = accuracy_score(y_test, rf_preds)
    rf_f1 = f1_score(y_test, rf_preds)
    rf_prec = precision_score(y_test, rf_preds)
    rf_rec = recall_score(y_test, rf_preds)

    print(
        f"[Model Eval] Random Forest -> Acc: {rf_acc:.4f}, F1: {rf_f1:.4f}, Prec: {rf_prec:.4f}, Rec: {rf_rec:.4f}"
    )

    # Candidate 2: Gradient Boosting Classifier
    gb_pipeline = Pipeline(
        [
            ("preprocessor", preprocessor),
            (
                "classifier",
                GradientBoostingClassifier(
                    n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42
                ),
            ),
        ]
    )
    gb_pipeline.fit(X_train, y_train)
    gb_preds = gb_pipeline.predict(X_test)
    gb_acc = accuracy_score(y_test, gb_preds)
    gb_f1 = f1_score(y_test, gb_preds)
    gb_prec = precision_score(y_test, gb_preds)
    gb_rec = recall_score(y_test, gb_preds)

    print(
        f"[Model Eval] Gradient Boosting -> Acc: {gb_acc:.4f}, F1: {gb_f1:.4f}, Prec: {gb_prec:.4f}, Rec: {gb_rec:.4f}"
    )

    # Select Best Model based on F1 Score
    if gb_f1 >= rf_f1:
        best_pipeline = gb_pipeline
        best_algorithm = "Gradient Boosting Classifier"
        best_acc, best_prec, best_rec, best_f1 = gb_acc, gb_prec, gb_rec, gb_f1
    else:
        best_pipeline = rf_pipeline
        best_algorithm = "Random Forest Classifier"
        best_acc, best_prec, best_rec, best_f1 = rf_acc, rf_prec, rf_rec, rf_f1

    print(f"[ML Pipeline] Selected Best Model: {best_algorithm} (F1 Score: {best_f1:.4f})")

    # Serialize Artifact
    artifacts_dir = os.path.join(ml_dir, "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "workforce_risk_model.joblib")
    joblib.dump(best_pipeline, model_path)
    print(f"[ML Pipeline] Model artifact serialized to: {model_path}")

    # Save feature metadata with the artifact for explainability
    meta_path = os.path.join(artifacts_dir, "model_metadata.joblib")
    joblib.dump(
        {
            "version": version,
            "algorithm": best_algorithm,
            "categorical_features": categorical_features,
            "numerical_features": numerical_features,
            "feature_importances": (
                dict(
                    zip(
                        numerical_features,
                        best_pipeline.named_steps["classifier"].feature_importances_[
                            : len(numerical_features)
                        ],
                    )
                )
                if hasattr(best_pipeline.named_steps["classifier"], "feature_importances_")
                else {}
            ),
        },
        meta_path,
    )

    # Register in PostgreSQL ModelRegistry
    try:
        with SessionLocal() as db:
            # Set older models inactive
            db.query(ModelRegistry).filter(ModelRegistry.is_active == True).update(
                {"is_active": False}
            )

            existing = (
                db.query(ModelRegistry).filter(ModelRegistry.model_version == version).first()
            )
            if existing:
                existing.model_name = "Workforce Attrition & Risk Predictor"
                existing.algorithm = best_algorithm
                existing.training_dataset = f"Synthetic Workforce Dataset ({dataset_size} samples)"
                existing.accuracy = Decimal(str(round(best_acc * 100, 2)))
                existing.precision_score = Decimal(str(round(best_prec * 100, 2)))
                existing.recall_score = Decimal(str(round(best_rec * 100, 2)))
                existing.f1_score = Decimal(str(round(best_f1 * 100, 2)))
                existing.model_file_path = model_path
                existing.is_active = True
                existing.deployed_at = datetime.now(timezone.utc)
            else:
                registry_entry = ModelRegistry(
                    model_name="Workforce Attrition & Risk Predictor",
                    model_version=version,
                    algorithm=best_algorithm,
                    training_dataset=f"Synthetic Workforce Dataset ({dataset_size} samples)",
                    accuracy=Decimal(str(round(best_acc * 100, 2))),
                    precision_score=Decimal(str(round(best_prec * 100, 2))),
                    recall_score=Decimal(str(round(best_rec * 100, 2))),
                    f1_score=Decimal(str(round(best_f1 * 100, 2))),
                    model_file_path=model_path,
                    is_active=True,
                    deployed_at=datetime.now(timezone.utc),
                )
                db.add(registry_entry)
            db.commit()
            print(f"[ML Pipeline] Successfully registered model {version} in ModelRegistry table.")
    except Exception as e:
        print(f"[ML Pipeline] Warning: Could not register model in DB: {e}")

    return {
        "version": version,
        "algorithm": best_algorithm,
        "accuracy": best_acc,
        "f1": best_f1,
        "model_path": model_path,
    }


if __name__ == "__main__":
    train_and_register_model()
