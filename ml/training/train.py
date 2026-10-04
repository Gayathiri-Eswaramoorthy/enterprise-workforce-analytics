"""
Real ML Training Pipeline: Evaluates Random Forest and Gradient Boosting models,
serializes the best model artifact, and registers metadata into PostgreSQL ModelRegistry.
"""

import os
import sys

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
from app.services.prediction_service import register_model_from_metadata

from ml.datasets.dataset_generator import generate_workforce_dataset


def train_and_register_model(dataset_size: int = 5000, version: str = "v1.1.0"):
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

    # Split: 3-way split (70% train, 15% val, 15% untouched test)
    # First split off 15% untouched test
    X_train_val, X_test, y_train_val, y_test = train_test_split(
        X, y, test_size=0.15, random_state=42, stratify=y
    )
    # Second split: validation set (17.647% of 85% is exactly 15% of 100%)
    X_train, X_val, y_train, y_val = train_test_split(
        X_train_val, y_train_val, test_size=0.17647, random_state=42, stratify=y_train_val
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

    import numpy as np
    from sklearn.metrics import confusion_matrix, roc_auc_score
    from sklearn.model_selection import StratifiedKFold
    from sklearn.utils.class_weight import compute_sample_weight

    # Candidate 1: Random Forest Classifier
    rf_clf = RandomForestClassifier(
        n_estimators=100, max_depth=8, class_weight="balanced", random_state=42
    )
    rf_pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", rf_clf)])

    # Candidate 2: Gradient Boosting Classifier
    gb_clf = GradientBoostingClassifier(
        n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42
    )
    gb_pipeline = Pipeline([("preprocessor", preprocessor), ("classifier", gb_clf)])

    # 5-fold Stratified Cross-Validation on X_train (70%)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    rf_metrics = {"accuracy": [], "precision": [], "recall": [], "f1": [], "roc_auc": []}
    gb_metrics = {"accuracy": [], "precision": [], "recall": [], "f1": [], "roc_auc": []}

    X_train_reset = X_train.reset_index(drop=True)
    y_train_reset = y_train.reset_index(drop=True)

    for train_idx, val_idx in skf.split(X_train_reset, y_train_reset):
        X_fold_train, X_fold_val = X_train_reset.iloc[train_idx], X_train_reset.iloc[val_idx]
        y_fold_train, y_fold_val = y_train_reset.iloc[train_idx], y_train_reset.iloc[val_idx]

        # Fit Random Forest
        rf_pipeline.fit(X_fold_train, y_fold_train)
        rf_preds = rf_pipeline.predict(X_fold_val)
        rf_probs = rf_pipeline.predict_proba(X_fold_val)[:, 1]

        rf_metrics["accuracy"].append(accuracy_score(y_fold_val, rf_preds))
        rf_metrics["precision"].append(precision_score(y_fold_val, rf_preds, zero_division=0))
        rf_metrics["recall"].append(recall_score(y_fold_val, rf_preds, zero_division=0))
        rf_metrics["f1"].append(f1_score(y_fold_val, rf_preds, zero_division=0))
        rf_metrics["roc_auc"].append(roc_auc_score(y_fold_val, rf_probs))

        # Fit Gradient Boosting with sample weights
        sw = compute_sample_weight(class_weight="balanced", y=y_fold_train)
        gb_pipeline.fit(X_fold_train, y_fold_train, classifier__sample_weight=sw)
        gb_preds = gb_pipeline.predict(X_fold_val)
        gb_probs = gb_pipeline.predict_proba(X_fold_val)[:, 1]

        gb_metrics["accuracy"].append(accuracy_score(y_fold_val, gb_preds))
        gb_metrics["precision"].append(precision_score(y_fold_val, gb_preds, zero_division=0))
        gb_metrics["recall"].append(recall_score(y_fold_val, gb_preds, zero_division=0))
        gb_metrics["f1"].append(f1_score(y_fold_val, gb_preds, zero_division=0))
        gb_metrics["roc_auc"].append(roc_auc_score(y_fold_val, gb_probs))

    rf_mean_f1 = np.mean(rf_metrics["f1"])
    gb_mean_f1 = np.mean(gb_metrics["f1"])

    print(
        f"[CV Eval] Random Forest -> Mean F1: {rf_mean_f1:.4f}, Accuracy: {np.mean(rf_metrics['accuracy']):.4f}, Precision: {np.mean(rf_metrics['precision']):.4f}, Recall: {np.mean(rf_metrics['recall']):.4f}, ROC-AUC: {np.mean(rf_metrics['roc_auc']):.4f}"
    )
    print(
        f"[CV Eval] Gradient Boosting -> Mean F1: {gb_mean_f1:.4f}, Accuracy: {np.mean(gb_metrics['accuracy']):.4f}, Precision: {np.mean(gb_metrics['precision']):.4f}, Recall: {np.mean(gb_metrics['recall']):.4f}, ROC-AUC: {np.mean(gb_metrics['roc_auc']):.4f}"
    )

    # Model Selection based on CV F1 score
    if gb_mean_f1 >= rf_mean_f1:
        best_pipeline = gb_pipeline
        best_algorithm = "Gradient Boosting Classifier"
        # Train best model on training set (70%) to get validation scores
        sw_train = compute_sample_weight(class_weight="balanced", y=y_train)
        best_pipeline.fit(X_train, y_train, classifier__sample_weight=sw_train)

        # Validation evaluation
        val_preds = best_pipeline.predict(X_val)
        val_probs = best_pipeline.predict_proba(X_val)[:, 1]

        # Train final model on train_val (85%) for test evaluation
        final_pipeline = Pipeline(
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
        sw_train_val = compute_sample_weight(class_weight="balanced", y=y_train_val)
        final_pipeline.fit(X_train_val, y_train_val, classifier__sample_weight=sw_train_val)
    else:
        best_pipeline = rf_pipeline
        best_algorithm = "Random Forest Classifier"
        best_pipeline.fit(X_train, y_train)

        # Validation evaluation
        val_preds = best_pipeline.predict(X_val)
        val_probs = best_pipeline.predict_proba(X_val)[:, 1]

        # Train final model on train_val (85%) for test evaluation
        final_pipeline = Pipeline(
            [
                ("preprocessor", preprocessor),
                (
                    "classifier",
                    RandomForestClassifier(
                        n_estimators=100, max_depth=8, class_weight="balanced", random_state=42
                    ),
                ),
            ]
        )
        final_pipeline.fit(X_train_val, y_train_val)

    val_acc = accuracy_score(y_val, val_preds)
    val_prec = precision_score(y_val, val_preds, zero_division=0)
    val_rec = recall_score(y_val, val_preds, zero_division=0)
    val_f1 = f1_score(y_val, val_preds, zero_division=0)
    val_roc_auc = roc_auc_score(y_val, val_probs)

    print(
        f"[Validation Eval] Selected Model ({best_algorithm}) -> F1: {val_f1:.4f}, Accuracy: {val_acc:.4f}, Precision: {val_prec:.4f}, Recall: {val_rec:.4f}, ROC-AUC: {val_roc_auc:.4f}"
    )

    # Evaluate final selected model ONCE on the untouched 15% test set (X_test, y_test)
    test_preds = final_pipeline.predict(X_test)
    test_probs = final_pipeline.predict_proba(X_test)[:, 1]

    test_acc = accuracy_score(y_test, test_preds)
    test_prec = precision_score(y_test, test_preds, zero_division=0)
    test_rec = recall_score(y_test, test_preds, zero_division=0)
    test_f1 = f1_score(y_test, test_preds, zero_division=0)
    test_roc_auc = roc_auc_score(y_test, test_probs)
    test_cm = confusion_matrix(y_test, test_preds)

    print("\n=============================================")
    print("FINAL TEST METRICS (ON UNTOUCHED 15% TEST SET):")
    print(f"Accuracy:  {test_acc:.4f}")
    print(f"Precision: {test_prec:.4f}")
    print(f"Recall:    {test_rec:.4f}")
    print(f"F1 Score:  {test_f1:.4f}")
    print(f"ROC-AUC:   {test_roc_auc:.4f}")
    print("Confusion Matrix:")
    print(test_cm)
    print("=============================================\n")

    # Serialize Artifact (save the final pipeline trained on 85%)
    artifacts_dir = os.path.join(ml_dir, "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "workforce_risk_model.joblib")
    joblib.dump(final_pipeline, model_path)
    print(f"[ML Pipeline] Model artifact serialized to: {model_path}")

    # Save feature metadata with the artifact for explainability
    meta_path = os.path.join(artifacts_dir, "model_metadata.joblib")
    metadata = {
        "version": version,
        "algorithm": best_algorithm,
        "categorical_features": categorical_features,
        "numerical_features": numerical_features,
        "random_state": 42,
        "dataset_size": dataset_size,
        "cross_validation_folds": 5,
        "cv_metrics": {
            "rf": {k: float(np.mean(v)) for k, v in rf_metrics.items()},
            "gb": {k: float(np.mean(v)) for k, v in gb_metrics.items()},
        },
        "validation_metrics": {
            "accuracy": float(val_acc),
            "precision": float(val_prec),
            "recall": float(val_rec),
            "f1": float(val_f1),
            "roc_auc": float(val_roc_auc),
        },
        "final_test_metrics": {
            "accuracy": float(test_acc),
            "precision": float(test_prec),
            "recall": float(test_rec),
            "f1": float(test_f1),
            "roc_auc": float(test_roc_auc),
            "confusion_matrix": test_cm.tolist(),
        },
        "feature_importances": (
            dict(
                zip(
                    numerical_features,
                    final_pipeline.named_steps["classifier"].feature_importances_[
                        : len(numerical_features)
                    ],
                )
            )
            if hasattr(final_pipeline.named_steps["classifier"], "feature_importances_")
            else {}
        ),
    }
    joblib.dump(metadata, meta_path)

    # Register in PostgreSQL ModelRegistry. If the DB is unreachable now, the backend
    # registers the artifact from this metadata file on its first prediction instead.
    try:
        with SessionLocal() as db:
            register_model_from_metadata(db, metadata, model_path)
            print(f"[ML Pipeline] Successfully registered model {version} in ModelRegistry table.")
    except Exception as e:
        print(f"[ML Pipeline] Warning: Could not register model in DB: {e}")

    return {
        "version": version,
        "algorithm": best_algorithm,
        "accuracy": test_acc,
        "f1": test_f1,
        "model_path": model_path,
    }


if __name__ == "__main__":
    train_and_register_model()
