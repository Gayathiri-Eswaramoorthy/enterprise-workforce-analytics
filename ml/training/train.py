"""
ML Training Pipeline for IBM HR Analytics Employee Attrition Benchmark.

Evaluates Random Forest models on:
  1. The full 30-feature IBM HR Analytics dataset.
  2. The 8-feature subset derivable from the application's employee database.
Compares both against a naive baseline classifier, exports the deployable pipeline artifact
(preprocessing + classifier together), and registers metadata into PostgreSQL ModelRegistry.

PROVENANCE NOTE:
The IBM HR Analytics Employee Attrition dataset is a publicly available, fictional benchmark dataset
created by IBM data scientists. It does NOT represent records from a genuine live organization.
Likewise, existing database employee records are seeded demonstration data.
"""

import os
import sys
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
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


def train_and_register_model(version: str = "v2.0.0-ibm"):
    """
    Execute end-to-end ML model training, evaluation on held-out test splits,
    artifact export, and database model registry synchronization.
    """
    csv_path = os.path.join(ml_dir, "datasets", "WA_Fn-UseC_-HR-Employee-Attrition.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"IBM HR Analytics dataset not found at expected path: {csv_path}")

    print(f"[ML Pipeline] Loading IBM HR Analytics dataset from: {csv_path}")
    df = pd.read_csv(csv_path)
    total_records = len(df)
    print(f"[ML Pipeline] Loaded {total_records} rows, {df.shape[1]} columns.")

    # 1. Target Definition: Attrition ("Yes" -> 1, "No" -> 0)
    target_col = "Attrition"
    y = (df[target_col].astype(str).str.strip().str.lower() == "yes").astype(int)
    pos_count = int(y.sum())
    neg_count = total_records - pos_count
    pos_pct = (pos_count / total_records) * 100.0
    print(
        f"[ML Pipeline] Target distribution: No={neg_count} ({100-pos_pct:.2f}%), "
        f"Yes={pos_count} ({pos_pct:.2f}%). Class ratio: {neg_count/pos_count:.2f}:1"
    )

    # 2. Exclude identifiers and constants that have zero predictive variance
    # EmployeeNumber: row-level ID; EmployeeCount: constant 1; Over18: constant 'Y'; StandardHours: constant 80
    dropped_cols = ["Attrition", "EmployeeNumber", "EmployeeCount", "Over18", "StandardHours"]
    X_full = df.drop(columns=dropped_cols)

    # Identify categorical and numerical features for the full 30-feature experiment
    cat_full = [
        "BusinessTravel",
        "Department",
        "EducationField",
        "Gender",
        "JobRole",
        "MaritalStatus",
        "OverTime",
    ]
    num_full = [c for c in X_full.columns if c not in cat_full]

    # 3. Stratified Train / Test Split (80% train, 20% untouched held-out test)
    # Using fixed random seed 42 and stratification on y to prevent data leakage and preserve class distribution
    X_train_full, X_test_full, y_train, y_test = train_test_split(
        X_full, y, test_size=0.20, random_state=42, stratify=y
    )
    print(
        f"[ML Pipeline] Stratified split -> Train: {len(X_train_full)} rows, Test: {len(X_test_full)} rows."
    )

    # ---------------------------------------------------------
    # EXPERIMENT A: Baseline Classifier (Majority Class Dummy)
    # ---------------------------------------------------------
    dummy = DummyClassifier(strategy="most_frequent")
    dummy.fit(X_train_full, y_train)
    dummy_test_preds = dummy.predict(X_test_full)
    baseline_metrics = {
        "accuracy": float(accuracy_score(y_test, dummy_test_preds)),
        "precision": float(precision_score(y_test, dummy_test_preds, zero_division=0)),
        "recall": float(recall_score(y_test, dummy_test_preds, zero_division=0)),
        "f1": float(f1_score(y_test, dummy_test_preds, zero_division=0)),
        "roc_auc": 0.5,
        "confusion_matrix": confusion_matrix(y_test, dummy_test_preds).tolist(),
    }
    print("\n--- BASELINE CLASSIFIER (Majority Class) ---")
    print(f"Accuracy:  {baseline_metrics['accuracy']:.4f} (predicts 100% negative)")
    print(f"Recall:    {baseline_metrics['recall']:.4f}")
    print(f"F1-Score:  {baseline_metrics['f1']:.4f}")
    print("Confusion Matrix:\n", confusion_matrix(y_test, dummy_test_preds))

    # ---------------------------------------------------------
    # EXPERIMENT B: Full IBM Feature Set (30 Features)
    # ---------------------------------------------------------
    preprocessor_full = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                num_full,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                        (
                            "encoder",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                cat_full,
            ),
        ]
    )

    rf_full_pipeline = Pipeline(
        [
            ("preprocessor", preprocessor_full),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=100,
                    max_depth=8,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    # 5-fold Stratified CV on training set
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_full_scores = {"accuracy": [], "precision": [], "recall": [], "f1": [], "roc_auc": []}
    X_train_full_reset = X_train_full.reset_index(drop=True)
    y_train_reset = y_train.reset_index(drop=True)

    for train_idx, val_idx in skf.split(X_train_full_reset, y_train_reset):
        X_fold_tr, X_fold_val = (
            X_train_full_reset.iloc[train_idx],
            X_train_full_reset.iloc[val_idx],
        )
        y_fold_tr, y_fold_val = y_train_reset.iloc[train_idx], y_train_reset.iloc[val_idx]

        rf_full_pipeline.fit(X_fold_tr, y_fold_tr)
        f_preds = rf_full_pipeline.predict(X_fold_val)
        f_probs = rf_full_pipeline.predict_proba(X_fold_val)[:, 1]

        cv_full_scores["accuracy"].append(accuracy_score(y_fold_val, f_preds))
        cv_full_scores["precision"].append(precision_score(y_fold_val, f_preds, zero_division=0))
        cv_full_scores["recall"].append(recall_score(y_fold_val, f_preds, zero_division=0))
        cv_full_scores["f1"].append(f1_score(y_fold_val, f_preds, zero_division=0))
        cv_full_scores["roc_auc"].append(roc_auc_score(y_fold_val, f_probs))

    # Fit on all 80% train and evaluate on 20% held-out test
    rf_full_pipeline.fit(X_train_full, y_train)
    full_test_preds = rf_full_pipeline.predict(X_test_full)
    full_test_probs = rf_full_pipeline.predict_proba(X_test_full)[:, 1]

    full_experiment_metrics = {
        "cv_metrics": {k: float(np.mean(v)) for k, v in cv_full_scores.items()},
        "test_metrics": {
            "accuracy": float(accuracy_score(y_test, full_test_preds)),
            "precision": float(precision_score(y_test, full_test_preds, zero_division=0)),
            "recall": float(recall_score(y_test, full_test_preds, zero_division=0)),
            "f1": float(f1_score(y_test, full_test_preds, zero_division=0)),
            "roc_auc": float(roc_auc_score(y_test, full_test_probs)),
            "confusion_matrix": confusion_matrix(y_test, full_test_preds).tolist(),
        },
    }

    print("\n--- FULL 30-FEATURE MODEL (Benchmark Experiment) ---")
    print(
        f"CV 5-Fold -> Acc: {full_experiment_metrics['cv_metrics']['accuracy']:.4f}, "
        f"F1: {full_experiment_metrics['cv_metrics']['f1']:.4f}, "
        f"ROC-AUC: {full_experiment_metrics['cv_metrics']['roc_auc']:.4f}"
    )
    print(
        f"Held-out Test -> Acc: {full_experiment_metrics['test_metrics']['accuracy']:.4f}, "
        f"Precision: {full_experiment_metrics['test_metrics']['precision']:.4f}, "
        f"Recall: {full_experiment_metrics['test_metrics']['recall']:.4f}, "
        f"F1: {full_experiment_metrics['test_metrics']['f1']:.4f}, "
        f"ROC-AUC: {full_experiment_metrics['test_metrics']['roc_auc']:.4f}"
    )
    print("Confusion Matrix:\n", confusion_matrix(y_test, full_test_preds))

    # ---------------------------------------------------------
    # EXPERIMENT C: Application-Derived Feature Set (8 Features)
    # Features derivable from database without fabricating unavailable fields:
    #   Categorical: Department, Gender, OverTime
    #   Numerical: Age, JobLevel, YearsAtCompany, PerformanceRating, TrainingTimesLastYear
    # ---------------------------------------------------------
    cat_8 = ["Department", "Gender", "OverTime"]
    num_8 = ["Age", "JobLevel", "YearsAtCompany", "PerformanceRating", "TrainingTimesLastYear"]

    X_train_8 = X_train_full[cat_8 + num_8]
    X_test_8 = X_test_full[cat_8 + num_8]

    preprocessor_8 = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="median")),
                        ("scaler", StandardScaler()),
                    ]
                ),
                num_8,
            ),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
                        (
                            "encoder",
                            OneHotEncoder(handle_unknown="ignore", sparse_output=False),
                        ),
                    ]
                ),
                cat_8,
            ),
        ]
    )

    rf_8_pipeline = Pipeline(
        [
            ("preprocessor", preprocessor_8),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=100,
                    max_depth=6,
                    class_weight="balanced",
                    random_state=42,
                ),
            ),
        ]
    )

    # 5-fold Stratified CV on 8-feature training data
    cv_8_scores = {"accuracy": [], "precision": [], "recall": [], "f1": [], "roc_auc": []}
    X_train_8_reset = X_train_8.reset_index(drop=True)

    for train_idx, val_idx in skf.split(X_train_8_reset, y_train_reset):
        X_fold_tr, X_fold_val = X_train_8_reset.iloc[train_idx], X_train_8_reset.iloc[val_idx]
        y_fold_tr, y_fold_val = y_train_reset.iloc[train_idx], y_train_reset.iloc[val_idx]

        rf_8_pipeline.fit(X_fold_tr, y_fold_tr)
        preds_8 = rf_8_pipeline.predict(X_fold_val)
        probs_8 = rf_8_pipeline.predict_proba(X_fold_val)[:, 1]

        cv_8_scores["accuracy"].append(accuracy_score(y_fold_val, preds_8))
        cv_8_scores["precision"].append(precision_score(y_fold_val, preds_8, zero_division=0))
        cv_8_scores["recall"].append(recall_score(y_fold_val, preds_8, zero_division=0))
        cv_8_scores["f1"].append(f1_score(y_fold_val, preds_8, zero_division=0))
        cv_8_scores["roc_auc"].append(roc_auc_score(y_fold_val, probs_8))

    # Fit 8-feature pipeline on full 80% train and evaluate on 20% test
    rf_8_pipeline.fit(X_train_8, y_train)
    test_preds_8 = rf_8_pipeline.predict(X_test_8)
    test_probs_8 = rf_8_pipeline.predict_proba(X_test_8)[:, 1]

    test_acc_8 = accuracy_score(y_test, test_preds_8)
    test_prec_8 = precision_score(y_test, test_preds_8, zero_division=0)
    test_rec_8 = recall_score(y_test, test_preds_8, zero_division=0)
    test_f1_8 = f1_score(y_test, test_preds_8, zero_division=0)
    test_roc_auc_8 = roc_auc_score(y_test, test_probs_8)
    test_cm_8 = confusion_matrix(y_test, test_preds_8)

    print("\n--- DEPLOYABLE 8-FEATURE MODEL (Application Database Compatible) ---")
    print(
        f"CV 5-Fold -> Acc: {np.mean(cv_8_scores['accuracy']):.4f}, "
        f"F1: {np.mean(cv_8_scores['f1']):.4f}, "
        f"ROC-AUC: {np.mean(cv_8_scores['roc_auc']):.4f}"
    )
    print("Held-out Test (20%):")
    print(f"Accuracy:  {test_acc_8:.4f}")
    print(f"Precision: {test_prec_8:.4f}")
    print(
        f"Recall:    {test_rec_8:.4f} (detects {test_cm_8[1, 1]}/{pos_count // 5} at-risk records)"
    )
    print(f"F1-Score:  {test_f1_8:.4f}")
    print(f"ROC-AUC:   {test_roc_auc_8:.4f}")
    print("Confusion Matrix:\n", test_cm_8)

    # 4. Feature Importances for 8-feature model
    cat_transformed_names = (
        rf_8_pipeline.named_steps["preprocessor"]
        .named_transformers_["cat"]
        .named_steps["encoder"]
        .get_feature_names_out(cat_8)
        .tolist()
    )
    all_feature_names = num_8 + cat_transformed_names
    importances = rf_8_pipeline.named_steps["classifier"].feature_importances_
    feature_importances_dict = {
        name: float(round(imp, 4))
        for name, imp in sorted(
            zip(all_feature_names, importances), key=lambda x: x[1], reverse=True
        )
    }

    # 5. Serialize Artifacts
    # Save the 8-feature pipeline (preprocessor + model together) as the serving artifact
    artifacts_dir = os.path.join(ml_dir, "artifacts")
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "workforce_risk_model.joblib")
    joblib.dump(rf_8_pipeline, model_path)
    print(f"\n[ML Pipeline] Trained 8-feature pipeline serialized to: {model_path}")

    # Build comprehensive metadata document
    meta_path = os.path.join(artifacts_dir, "model_metadata.joblib")
    metadata = {
        "version": version,
        "algorithm": "Random Forest Classifier",
        "dataset_name": "IBM HR Analytics Employee Attrition (Fictional Benchmark)",
        "dataset_size": total_records,
        "training_date": datetime.now(timezone.utc).isoformat(),
        "random_state": 42,
        "target": "Attrition (Yes=1, No=0)",
        "feature_schema": {
            "categorical_features": cat_8,
            "numerical_features": num_8,
            "all_features": cat_8 + num_8,
        },
        "baseline_metrics": baseline_metrics,
        "full_30_feature_experiment": full_experiment_metrics,
        "cv_metrics": {k: float(np.mean(v)) for k, v in cv_8_scores.items()},
        "final_test_metrics": {
            "accuracy": float(test_acc_8),
            "precision": float(test_prec_8),
            "recall": float(test_rec_8),
            "f1": float(test_f1_8),
            "roc_auc": float(test_roc_auc_8),
            "confusion_matrix": test_cm_8.tolist(),
        },
        "feature_importances": feature_importances_dict,
        "assumptions_and_provenance": {
            "dataset_nature": "Publicly available fictional HR benchmark dataset from IBM.",
            "application_records": "Seeded demonstrative records for enterprise analytics evaluation.",
            "feature_mapping_notes": (
                "Department mapped to standard R&D / Sales / HR categories. "
                "JobLevel derived from JobRole grade_level (1..10 scale mapped to 1..5 scale). "
                "OverTime derived from OvertimeFrequency (OCCASIONAL/FREQUENT -> 'Yes', NONE -> 'No'). "
                "PerformanceRating uses unconstrained review rating, with pipeline median imputation if reviews are absent."
            ),
        },
    }
    joblib.dump(metadata, meta_path)
    print(f"[ML Pipeline] Model metadata serialized to: {meta_path}")

    # 6. Register in PostgreSQL ModelRegistry table
    try:
        with SessionLocal() as db:
            register_model_from_metadata(db, metadata, model_path)
            print(f"[ML Pipeline] Successfully registered model {version} in ModelRegistry table.")
    except Exception as e:
        print(f"[ML Pipeline] Warning: Could not register model in DB during training: {e}")

    return {
        "version": version,
        "algorithm": "Random Forest Classifier",
        "test_metrics": metadata["final_test_metrics"],
        "model_path": model_path,
    }


if __name__ == "__main__":
    train_and_register_model()
