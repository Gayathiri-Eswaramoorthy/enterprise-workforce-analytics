"""
Seed data module for Learning, Quizzes, Skill Assessments, and Retention Interventions.
Adds real educational lesson content, multiple-choice quizzes with explanations,
curated external learning resources (YouTube, Udemy, official docs),
before-and-after skill assessments, and retention follow-up tracking.
All operations are strictly idempotent.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
import uuid

from app.database import (
    AssessmentType,
    DifficultyLevel,
    EnrollmentStatus,
    InterventionStatus,
    RetentionOutcome,
    TrainingMode,
)
from app.models import (
    CourseLesson,
    CourseQuiz,
    Employee,
    EmployeeSkill,
    LessonCompletion,
    QuizAttempt,
    QuizOption,
    QuizQuestion,
    Recommendation,
    RetentionIntervention,
    RoleSkill,
    Skill,
    SkillAssessment,
    TrainingCourse,
    TrainingEnrollment,
    TrainingSkill,
    User,
)
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload


SAMPLE_COURSES = [
    {
        "course_code": "TR-PY-FUND",
        "title": "Python Fundamentals & Software Engineering",
        "description": "Comprehensive foundation in modern Python 3, object-oriented design, async patterns, and testing.",
        "provider": "Enterprise Academy",
        "duration_hours": Decimal("16.0"),
        "difficulty_level": DifficultyLevel.BEGINNER,
        "training_mode": TrainingMode.ONLINE,
        "target_skills": ["SK-PY"],
        "lessons": [
            {
                "title": "Python for Beginners - Full Video Tutorial",
                "description": "Hands-on video walk-through covering variables, conditionals, loops, functions, and standard data structures by freeCodeCamp.",
                "provider": "freeCodeCamp / YouTube",
                "skill_covered": "Python Core Syntax & Control Flow",
                "resource_type": "VIDEO",
                "access_type": "FREE",
                "external_url": "https://www.youtube.com/watch?v=eWRfhZUzrAc",
                "order_index": 1,
                "is_required": True,
                "estimated_minutes": 30,
                "content": """# Python Core Syntax, Data Structures & Type Hinting

Welcome to the foundation of modern Python application development. In this module, you master the essential language structures used across production enterprise services.

## 1. Built-in Data Structures
Python provides four primary built-in collection types:
- **Lists** (`[1, 2, 3]`): Mutable ordered sequences with $O(1)$ amortized append.
- **Tuples** (`(1, 2, 3)`): Immutable ordered sequences, ideal for fixed records and dictionary keys.
- **Dictionaries** (`{"key": "value"}`): Hash tables offering average $O(1)$ lookup, insertion, and deletion.
- **Sets** (`{1, 2, 3}`): Unordered collections of unique hashable elements with $O(1)$ membership checks.

```python
from typing import Dict, List, Optional

def filter_active_departments(headcounts: Dict[str, int], threshold: int = 15) -> List[str]:
    \"\"\"Return department names meeting minimum team staffing criteria.\"\"\"
    return [dept for dept, count in headcounts.items() if count >= threshold]
```

## 2. Type Hinting & Static Safety
Modern Python uses type hints to enable static verification, autocompletion, and maintainability:
```python
def resolve_employee_code(emp_id: str | None) -> str:
    if not emp_id:
        raise ValueError("Employee ID cannot be empty")
    return emp_id.strip().upper()
```
""",
            },
            {
                "title": "Official Python Tutorial: Data Structures & OOP",
                "description": "The Python Software Foundation official tutorial covering object-oriented architecture, dataclasses, and custom exceptions.",
                "provider": "Python Software Foundation",
                "skill_covered": "Object-Oriented Design & Clean Architecture",
                "resource_type": "DOCUMENTATION",
                "access_type": "FREE",
                "external_url": "https://docs.python.org/3/tutorial/",
                "order_index": 2,
                "is_required": True,
                "estimated_minutes": 25,
                "content": """# Object-Oriented Architecture & Clean Domain Models

Production enterprise services decouple domain logic from transport protocols using clean object-oriented patterns and immutable records.

## 1. Modern Data Classes
Instead of writing boilerplate `__init__`, `__repr__`, and equality checks, use `@dataclass`:

```python
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

@dataclass(frozen=True)
class EmployeeRecord:
    employee_code: str
    salary: Decimal
    hired_date: date

    @property
    def is_veteran(self) -> bool:
        return (date.today() - self.hired_date).days > 365 * 4
```

## 2. Explicit Domain Exceptions
Always define explicit domain exceptions rather than catching broad `Exception`:
```python
class WorkforceAnalyticsError(Exception):
    \"\"\"Base exception for workforce analytics services.\"\"\"
    pass

class EmployeeNotFoundError(WorkforceAnalyticsError):
    def __init__(self, emp_id: str):
        super().__init__(f"Employee {emp_id} does not exist in the active roster.")
```
""",
            },
            {
                "title": "Complete Python Bootcamp: Zero to Hero in Python",
                "description": "Comprehensive commercial curriculum covering professional Python tooling, virtual environments, modules, and automated testing.",
                "provider": "Udemy",
                "skill_covered": "Production Software Engineering & Testing",
                "resource_type": "COURSE",
                "access_type": "PAID",
                "external_url": "https://www.udemy.com/course/complete-python-bootcamp/",
                "order_index": 3,
                "is_required": True,
                "estimated_minutes": 45,
                "content": """# Writing Resilient Unit Tests with Pytest

Automated testing ensures workforce predictive analytics logic remains correct through continuous refactoring and feature additions.

## 1. Pytest Fixtures
Fixtures provide reusable, deterministic setup and teardown logic:
```python
import pytest

@pytest.fixture
def sample_metrics():
    return {"turnover_rate": 0.12, "headcount": 200, "satisfaction_score": 4.1}

def test_turnover_healthy(sample_metrics):
    assert sample_metrics["turnover_rate"] < 0.15
    assert sample_metrics["satisfaction_score"] >= 3.5
```

## 2. Parametrized Test Suites
Test edge cases and boundary conditions without duplicating assertions:
```python
@pytest.mark.parametrize("score,expected_band", [
    (0.85, "CRITICAL"),
    (0.65, "HIGH"),
    (0.35, "MEDIUM"),
    (0.10, "LOW"),
])
def test_risk_classification(score, expected_band):
    from app.services.prediction_service import classify_risk
    assert classify_risk(score) == expected_band
```
""",
            },
        ],
        "quiz": {
            "title": "Python Fundamentals Certification Quiz",
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "question_text": "Which Python collection type maintains insertion order and guarantees O(1) average key lookup time?",
                    "order_index": 1,
                    "explanation": "In modern Python (3.7+), dict retains insertion order while operating as an efficient hash map with O(1) average lookup time.",
                    "options": [
                        ("tuple", False, 1),
                        ("dict", True, 2),
                        ("set", False, 3),
                        ("heapq", False, 4),
                    ],
                },
                {
                    "question_text": "What is the primary architectural purpose of using Python dataclasses with frozen=True?",
                    "order_index": 2,
                    "explanation": "Setting frozen=True makes instances immutable, preventing accidental side-effects and allowing instances to be safely hashed and shared.",
                    "options": [
                        ("To create immutable, hashable value objects without boilerplate", True, 1),
                        ("To compile the class directly into C machine code", False, 2),
                        ("To bypass Python's Global Interpreter Lock (GIL)", False, 3),
                        ("To automatically persist instances into PostgreSQL", False, 4),
                    ],
                },
                {
                    "question_text": "When structuring test suites with Pytest, what is the best practice for testing functions against multiple inputs?",
                    "order_index": 3,
                    "explanation": "The @pytest.mark.parametrize decorator allows running a test function across multiple input-output tuples cleanly without duplicating test logic.",
                    "options": [
                        ("Writing a while loop inside a single test function", False, 1),
                        ("Using the @pytest.mark.parametrize decorator", True, 2),
                        ("Executing test scripts manually in the REPL", False, 3),
                        ("Hardcoding random seed generators", False, 4),
                    ],
                },
                {
                    "question_text": "How should custom application errors be structured in modern Python services?",
                    "order_index": 4,
                    "explanation": "Custom exceptions should inherit from a project-level base Exception class to allow callers to catch either specific errors or all domain errors cleanly.",
                    "options": [
                        ("By catching sys.exit() calls in every function", False, 1),
                        ("By inheriting from a shared project base Exception class", True, 2),
                        ("By defining global string variables instead of classes", False, 3),
                        ("By modifying Python built-in KeyError directly", False, 4),
                    ],
                },
            ],
        },
    },
    {
        "course_code": "TR-SQL-FUND",
        "title": "SQL and Relational Database Skills",
        "description": "Essential relational modeling, complex joins, indexing strategies, and transactional query design in PostgreSQL.",
        "provider": "Enterprise Academy",
        "duration_hours": Decimal("14.0"),
        "difficulty_level": DifficultyLevel.BEGINNER,
        "training_mode": TrainingMode.ONLINE,
        "target_skills": ["SK-SQL"],
        "lessons": [
            {
                "title": "SQL Tutorial - Full Database Course for Beginners",
                "description": "Comprehensive video course covering relational schemas, SELECT queries, WHERE filters, GROUP BY, and aggregates by freeCodeCamp.",
                "provider": "freeCodeCamp / YouTube",
                "skill_covered": "SQL Queries & Aggregations",
                "resource_type": "VIDEO",
                "access_type": "FREE",
                "external_url": "https://www.youtube.com/watch?v=HXV3zeRR3h4",
                "order_index": 1,
                "is_required": True,
                "estimated_minutes": 30,
                "content": """# Relational Data Modeling & Schema Constraints

Relational databases guarantee structural integrity through declarative schemas, foreign keys, and domain constraints.

## 1. Key Integrity Constraints
- **Primary Key (`PRIMARY KEY`)**: Uniquely identifies each record and prohibits `NULL` values.
- **Foreign Key (`FOREIGN KEY`)**: Enforces referential integrity between parent and child tables.
- **Check Constraints (`CHECK`)**: Enforces allowable domain values at the database storage engine.

```sql
CREATE TABLE employee_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    certification_name VARCHAR(255) NOT NULL,
    score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
    certified_date DATE NOT NULL
);
```
""",
            },
            {
                "title": "PostgreSQL Official Documentation: Joins & Indexes",
                "description": "Official documentation covering INNER, LEFT, and FULL joins, execution plans, and B-tree indexing in PostgreSQL.",
                "provider": "PostgreSQL Global Development Group",
                "skill_covered": "Relational Joins & Index Optimization",
                "resource_type": "DOCUMENTATION",
                "access_type": "FREE",
                "external_url": "https://www.postgresql.org/docs/current/tutorial.html",
                "order_index": 2,
                "is_required": True,
                "estimated_minutes": 25,
                "content": """# Aggregations & Analytical Window Functions

Analyzing workforce patterns requires deep knowledge of grouped aggregations and non-destructive window calculations.

## 1. Grouped Aggregation vs Window Functions
Standard `GROUP BY` collapses individual rows into summary buckets:
```sql
SELECT department_id, COUNT(*) AS head_count, AVG(salary) AS avg_salary
FROM employees
GROUP BY department_id
HAVING COUNT(*) > 5;
```

Window functions (`OVER (...)`) perform calculations across a partition while preserving individual row identity:
```sql
SELECT
    employee_code,
    department_id,
    salary,
    RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS dept_salary_rank
FROM employees;
```
""",
            },
            {
                "title": "The Complete SQL Bootcamp: Go from Zero to Hero",
                "description": "Comprehensive course on transactions, ACID properties, subqueries, and advanced PostgreSQL performance tuning.",
                "provider": "Udemy",
                "skill_covered": "Database Transactions & ACID Guarantees",
                "resource_type": "COURSE",
                "access_type": "PAID",
                "external_url": "https://www.udemy.com/course/the-complete-sql-bootcamp/",
                "order_index": 3,
                "is_required": True,
                "estimated_minutes": 45,
                "content": """# Query Optimization & Transaction Management

## 1. Reading Execution Plans with EXPLAIN
Always inspect execution costs before putting analytical queries into production:
```sql
EXPLAIN ANALYZE
SELECT e.employee_code, d.name
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.employment_status = 'ACTIVE';
```

## 2. ACID Guarantees
- **Atomicity**: All operations succeed or none do (`COMMIT` vs `ROLLBACK`).
- **Consistency**: Database transitions only between valid states.
- **Isolation**: Concurrent transactions do not produce dirty reads.
- **Durability**: Committed data survives system crashes.
""",
            },
        ],
        "quiz": {
            "title": "SQL and Relational Database Skills Assessment",
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "question_text": "Which SQL clause is used to filter aggregated group records after a GROUP BY operation?",
                    "order_index": 1,
                    "explanation": "WHERE filters rows before aggregation, while HAVING filters the grouped results after aggregation.",
                    "options": [
                        ("WHERE", False, 1),
                        ("HAVING", True, 2),
                        ("ORDER BY", False, 3),
                        ("DISTINCT", False, 4),
                    ],
                },
                {
                    "question_text": "How do SQL window functions (e.g. ROW_NUMBER, RANK) differ fundamentally from GROUP BY?",
                    "order_index": 2,
                    "explanation": "Window functions calculate across partitioned rows while retaining individual row identity, whereas GROUP BY collapses rows.",
                    "options": [
                        ("Window functions preserve row identities rather than collapsing them into single summary rows", True, 1),
                        ("Window functions cannot use mathematical calculations", False, 2),
                        ("Window functions only work on primary keys", False, 3),
                        ("Window functions can only run on SQLite", False, 4),
                    ],
                },
                {
                    "question_text": "In relational database ACID guarantees, what does Atomicity signify?",
                    "order_index": 3,
                    "explanation": "Atomicity ensures that all statements within a transaction either completely succeed together or are entirely rolled back upon failure.",
                    "options": [
                        ("All changes in a transaction succeed completely or are rolled back completely", True, 1),
                        ("Queries are executed at atomic sub-millisecond clock speeds", False, 2),
                        ("Tables are restricted to atomic data types like integers", False, 3),
                        ("Only one user can connect to the database at a time", False, 4),
                    ],
                },
                {
                    "question_text": "Which index type is the default and most versatile index in PostgreSQL for equality and range queries?",
                    "order_index": 4,
                    "explanation": "B-Tree (Balanced Tree) is the default PostgreSQL index type, ideal for sorting, comparisons (<, <=, =, >=, >), and BETWEEN ranges.",
                    "options": [
                        ("Hash Index", False, 1),
                        ("B-Tree Index", True, 2),
                        ("BRIN Index", False, 3),
                        ("GIN Index", False, 4),
                    ],
                },
            ],
        },
    },
    {
        "course_code": "TR-CLOUD-FUND",
        "title": "Cloud Architecture & Modern Infrastructure Fundamentals",
        "description": "Essential cloud concepts, containerization, VPC networking, scalable architectures, and least-privilege IAM.",
        "provider": "Enterprise Academy",
        "duration_hours": Decimal("16.0"),
        "difficulty_level": DifficultyLevel.BEGINNER,
        "training_mode": TrainingMode.ONLINE,
        "target_skills": ["SK-CLOUD"],
        "lessons": [
            {
                "title": "Google Cloud Fundamentals Explained",
                "description": "Official video from Google Cloud Tech breaking down compute, storage, virtual networking, and multi-region infrastructure.",
                "provider": "Google Cloud Tech / YouTube",
                "skill_covered": "Cloud Architecture & Core Services",
                "resource_type": "VIDEO",
                "access_type": "FREE",
                "external_url": "https://www.youtube.com/watch?v=kzDYfl_a9_Y",
                "order_index": 1,
                "is_required": True,
                "estimated_minutes": 20,
                "content": """# Cloud Delivery Models: IaaS, PaaS, and Serverless

Understanding cloud deployment models helps engineering teams select the optimal runtime environment.

## 1. Cloud Spectrum
- **Infrastructure as a Service (IaaS)**: Virtual machines, raw storage, and software-defined networks (e.g., GCE, AWS EC2).
- **Platform as a Service (PaaS)**: Managed app runtimes (e.g., Cloud Run, App Engine).
- **Serverless**: Event-driven computing that scales to zero and bills only for executed compute time.

## 2. Virtual Private Clouds (VPC)
A VPC provides an isolated private network topology where instances communicate securely without exposing internal endpoints to the public internet.
""",
            },
            {
                "title": "Google Cloud Architecture Center: Core Principles",
                "description": "Official architectural framework for designing resilient, high-availability, cost-effective cloud services.",
                "provider": "Google Cloud Documentation",
                "skill_covered": "Cloud Reliability & Scalability Framework",
                "resource_type": "DOCUMENTATION",
                "access_type": "FREE",
                "external_url": "https://cloud.google.com/architecture/framework",
                "order_index": 2,
                "is_required": True,
                "estimated_minutes": 25,
                "content": """# Containerization with Docker & Microservices

Containers package an application alongside all its operating system dependencies, guaranteeing identical execution across local dev and cloud production.

## 1. Multi-Stage Docker Builds
Multi-stage builds produce tiny, secure production container images:

```dockerfile
# Stage 1: Build dependencies
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Minimal runtime image
FROM python:3.11-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY app/ ./app
ENV PATH=/root/.local/bin:$PATH
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
""",
            },
            {
                "title": "Google Cloud Associate Cloud Engineer Course",
                "description": "Industry certification curriculum covering VPC networks, IAM governance, Cloud Run, and Kubernetes Engine.",
                "provider": "Udemy",
                "skill_covered": "Cloud Governance, Security & IAM",
                "resource_type": "COURSE",
                "access_type": "PAID",
                "external_url": "https://www.udemy.com/course/google-cloud-associate-cloud-engineer/",
                "order_index": 3,
                "is_required": True,
                "estimated_minutes": 45,
                "content": """# Security & High Availability Architectures

## 1. Principle of Least Privilege
Never grant broad administrative roles. Instead, assign granular service accounts with only required permissions:
- App service accounts should only have read/write access to their specific database schema and storage bucket.
- Human users must authenticate with multi-factor authentication (MFA) and role-based access control (RBAC).

## 2. Multi-Zone Redundancy
Distributing application instances across multiple Availability Zones protects against hardware failures and network partition events.
""",
            },
        ],
        "quiz": {
            "title": "Cloud Fundamentals & Architecture Quiz",
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "question_text": "What is the core principle of Identity and Access Management (IAM) known as 'Least Privilege'?",
                    "order_index": 1,
                    "explanation": "The principle of least privilege dictates granting users and services only the minimum permissions necessary to perform their required duties.",
                    "options": [
                        ("Granting root administrative access to all engineers", False, 1),
                        ("Assigning users and services only the minimum permissions necessary to perform their required duties", True, 2),
                        ("Disabling audit logging to decrease network latency", False, 3),
                        ("Sharing database credentials among microservices", False, 4),
                    ],
                },
                {
                    "question_text": "What is the primary operational benefit of multi-stage Docker builds?",
                    "order_index": 2,
                    "explanation": "Multi-stage builds separate compilers and build dependencies from the final image, producing dramatically smaller, more secure container artifacts.",
                    "options": [
                        ("Producing lightweight, minimal production images by omitting build-time tools and compilers", True, 1),
                        ("Running multiple Docker containers simultaneously on a single CPU core", False, 2),
                        ("Automatically converting Python code into Go", False, 3),
                        ("Eliminating the need for cloud networking", False, 4),
                    ],
                },
                {
                    "question_text": "Why do high-availability cloud deployments distribute services across multiple Availability Zones (AZs)?",
                    "order_index": 3,
                    "explanation": "Distributing services across separate physical data centers (zones) protects applications from downtime if a single data center suffers an outage.",
                    "options": [
                        ("To double database latency across network links", False, 1),
                        ("To ensure continuous operation even if an individual data center suffers a physical outage", True, 2),
                        ("Because cloud providers do not allow single-zone deployments", False, 3),
                        ("To bypass corporate compliance firewalls", False, 4),
                    ],
                },
                {
                    "question_text": "Which cloud computing model bills only for active compute execution and scales down to zero when idle?",
                    "order_index": 4,
                    "explanation": "Serverless (event-driven compute like Cloud Functions or Cloud Run) scales dynamically to handle incoming load and scales to zero when idle.",
                    "options": [
                        ("Dedicated Bare Metal", False, 1),
                        ("Serverless / Event-Driven Compute", True, 2),
                        ("Unmanaged Colocation", False, 3),
                        ("Static On-Premise Rack", False, 4),
                    ],
                },
            ],
        },
    },
    {
        "course_code": "TR-MLOPS",
        "title": "MLOps: Production Machine Learning Systems",
        "description": "Continuous delivery for ML, model monitoring, concept drift detection, and automated retraining pipelines.",
        "provider": "Enterprise Academy",
        "duration_hours": Decimal("18.0"),
        "difficulty_level": DifficultyLevel.INTERMEDIATE,
        "training_mode": TrainingMode.ONLINE,
        "target_skills": ["SK-ML", "SK-PY"],
        "lessons": [
            {
                "title": "Machine Learning Operations (MLOps) Full Course",
                "description": "Comprehensive video course on CI/CD pipelines for ML models, feature stores, and automated model tracking by freeCodeCamp.",
                "provider": "freeCodeCamp / YouTube",
                "skill_covered": "MLOps Lifecycle & Pipeline Automation",
                "resource_type": "VIDEO",
                "access_type": "FREE",
                "external_url": "https://www.youtube.com/watch?v=06-EW_CQCaI",
                "order_index": 1,
                "is_required": True,
                "estimated_minutes": 30,
                "content": """# MLOps Pipeline Automation & Lifecycle

Production machine learning differs from traditional software engineering because models degrade over time as the statistical properties of input data change.

## 1. Stages of the MLOps Lifecycle
1. **Data Ingestion & Feature Engineering**: Standardizing batch and streaming inputs.
2. **Experiment Tracking**: Logging hyperparameters, loss metrics, and ROC curves (e.g. MLflow, Vertex AI).
3. **Model Validation**: Evaluating models against test sets and fairness slices before deployment.
4. **Automated Deployment**: Containerizing models behind low-latency REST APIs.
5. **Continuous Telemetry**: Monitoring inference latency, feature distributions, and prediction drift.
""",
            },
            {
                "title": "Continuous Delivery & Automation in ML (Google Cloud)",
                "description": "Official Google Cloud architectural guide covering MLOps maturity levels 0, 1, and 2 with automated pipeline retraining.",
                "provider": "Google Cloud Documentation",
                "skill_covered": "Continuous Training & Concept Drift Monitoring",
                "resource_type": "DOCUMENTATION",
                "access_type": "FREE",
                "external_url": "https://cloud.google.com/architecture/mlops-continuous-delivery-and-automation-pipelines-in-machine-learning",
                "order_index": 2,
                "is_required": True,
                "estimated_minutes": 25,
                "content": """# Detecting Model Drift & Continuous Training

## 1. Types of Degradation
- **Data Drift (Covariate Shift)**: The distribution of input features $P(X)$ changes over time while relationship $P(Y|X)$ remains constant.
- **Concept Drift**: The statistical relationship between features and target labels $P(Y|X)$ changes over time (e.g., changes in employee tenure expectations).

## 2. Automated Retraining Triggers
Pipelines trigger automated retraining when:
- Statistical distance (e.g., Population Stability Index or Kolmogorov-Smirnov test) crosses threshold.
- Model performance metrics (accuracy, F1 score, AUC) drop below predefined SLA.
""",
            },
            {
                "title": "MLOps Fundamentals: CI/CD for Machine Learning",
                "description": "Hands-on commercial course covering Docker containerization, model serving, and Kubernetes deployment on Udemy.",
                "provider": "Udemy",
                "skill_covered": "Containerized Model Serving & Monitoring",
                "resource_type": "COURSE",
                "access_type": "PAID",
                "external_url": "https://www.udemy.com/course/mlops-fundamentals/",
                "order_index": 3,
                "is_required": True,
                "estimated_minutes": 40,
                "content": """# Containerized Model Serving with FastAPI & Docker

## 1. Production Model Packaging
Always bundle scikit-learn models with exact dependency versions:
```python
import joblib
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
model = joblib.load("models/attrition_rf_v2.joblib")

class EmployeeFeatures(BaseModel):
    monthly_income: float
    overtime_hours: float
    tenure_years: float

@app.post("/predict")
def predict_risk(features: EmployeeFeatures):
    X = [[features.monthly_income, features.overtime_hours, features.tenure_years]]
    prob = model.predict_proba(X)[0][1]
    return {"attrition_risk_score": round(prob, 4)}
```
""",
            },
        ],
        "quiz": {
            "title": "MLOps Systems & Production Governance Quiz",
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "question_text": "What is the primary difference between Data Drift and Concept Drift in production ML?",
                    "order_index": 1,
                    "explanation": "Data drift refers to changes in the distribution of input features P(X), whereas concept drift refers to changes in the actual relationship between inputs and targets P(Y|X).",
                    "options": [
                        ("Data drift alters the database schema, while concept drift renames columns", False, 1),
                        ("Data drift is changes in input feature distribution P(X); concept drift is changes in the relationship P(Y|X)", True, 2),
                        ("Data drift only occurs in neural networks, not Random Forests", False, 3),
                        ("Concept drift occurs only during model training, not inference", False, 4),
                    ],
                },
                {
                    "question_text": "In a mature MLOps pipeline, what role does a Model Registry fulfill?",
                    "order_index": 2,
                    "explanation": "A model registry serves as a centralized repository managing model versioning, lineage, approval stages (Staging/Production), and metadata.",
                    "options": [
                        ("It replaces the PostgreSQL database for all application storage", False, 1),
                        ("It tracks model versions, artifact lineage, evaluation metrics, and promotion stages", True, 2),
                        ("It automatically calculates employee salaries", False, 3),
                        ("It translates Python models directly into JavaScript", False, 4),
                    ],
                },
                {
                    "question_text": "Why should machine learning prediction APIs separate offline batch feature generation from online inference?",
                    "order_index": 3,
                    "explanation": "Separating heavy batch feature transformations from low-latency online inference ensures sub-100ms API response times.",
                    "options": [
                        ("To keep prediction API response times low and predictable", True, 1),
                        ("Because Python can only execute one function per day", False, 2),
                        ("To ensure training data is never logged", False, 3),
                        ("Because scikit-learn does not support REST APIs", False, 4),
                    ],
                },
                {
                    "question_text": "What is a Canary Deployment pattern in machine learning system releases?",
                    "order_index": 4,
                    "explanation": "Canary deployment routes a small percentage of live traffic (e.g. 5%) to the new candidate model while monitoring metrics before full rollout.",
                    "options": [
                        ("Deploying models exclusively to edge IoT hardware", False, 1),
                        ("Routing a small percentage of live traffic to the candidate model to verify stability before full rollout", True, 2),
                        ("Training models using simulated synthetic birds", False, 3),
                        ("Reverting all model updates permanently", False, 4),
                    ],
                },
            ],
        },
    },
    {
        "course_code": "TR-PY-ADV",
        "title": "Advanced Python & Asynchronous Architectures",
        "description": "High-performance Python, asyncio event loops, concurrency primitives, memory profiling, and cProfile optimization.",
        "provider": "Enterprise Academy",
        "duration_hours": Decimal("20.0"),
        "difficulty_level": DifficultyLevel.ADVANCED,
        "training_mode": TrainingMode.ONLINE,
        "target_skills": ["SK-PY"],
        "lessons": [
            {
                "title": "AsyncIO in Python - Full Video Tutorial",
                "description": "In-depth video walk-through on event loops, async/await coroutines, tasks, and non-blocking I/O in Python.",
                "provider": "YouTube",
                "skill_covered": "AsyncIO Event Loops & Coroutines",
                "resource_type": "VIDEO",
                "access_type": "FREE",
                "external_url": "https://www.youtube.com/watch?v=t5Bo1Je9EmE",
                "order_index": 1,
                "is_required": True,
                "estimated_minutes": 30,
                "content": """# Asynchronous Architecture & Asyncio Event Loops

Traditional synchronous Python blocks the operating system thread during network and database I/O. AsyncIO leverages single-threaded cooperative multitasking.

## 1. Coroutines and Tasks
```python
import asyncio
from typing import List

async def fetch_employee_metrics(emp_id: str) -> dict:
    await asyncio.sleep(0.05)  # Simulating async I/O
    return {"employee_id": emp_id, "satisfaction": 4.2}

async def fetch_all(emp_ids: List[str]) -> List[dict]:
    tasks = [fetch_employee_metrics(eid) for eid in emp_ids]
    return await asyncio.gather(*tasks)
```
""",
            },
            {
                "title": "Official Python AsyncIO Documentation & Concurrency Guide",
                "description": "Official documentation covering synchronization primitives (Locks, Semaphores), ThreadPoolExecutor interop, and cancellation.",
                "provider": "Python Software Foundation",
                "skill_covered": "Concurrency Primitives & Thread Offloading",
                "resource_type": "DOCUMENTATION",
                "access_type": "FREE",
                "external_url": "https://docs.python.org/3/library/asyncio.html",
                "order_index": 2,
                "is_required": True,
                "estimated_minutes": 25,
                "content": """# Concurrency Primitives & CPU-Bound Offloading

## 1. Running CPU-Bound Code in Async Services
Never run heavy machine learning inference or cryptographic hashing directly in the event loop thread. Offload CPU-bound work to a `ThreadPoolExecutor` or `ProcessPoolExecutor`:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)

def heavy_model_inference(features):
    # Synchronous CPU-intensive matrix operations
    return sum(features)

async def predict_endpoint(features):
    loop = asyncio.get_running_loop()
    # Runs in worker thread without blocking the event loop
    result = await loop.run_in_executor(executor, heavy_model_inference, features)
    return {"prediction": result}
```
""",
            },
            {
                "title": "Python Beyond the Basics: Advanced Metaprogramming",
                "description": "Commercial advanced course on decorators, context managers, descriptors, and memory profiling on Udemy.",
                "provider": "Udemy",
                "skill_covered": "Metaprogramming & Memory Profiling",
                "resource_type": "COURSE",
                "access_type": "PAID",
                "external_url": "https://www.udemy.com/course/python-beyond-the-basics/",
                "order_index": 3,
                "is_required": True,
                "estimated_minutes": 45,
                "content": """# Memory Profiling & High-Performance Optimization

## 1. Memory Optimization with `__slots__`
In high-throughput services instantiating millions of objects, using `__slots__` eliminates the default `__dict__` overhead, reducing memory by up to 60%:

```python
class CompactRecord:
    __slots__ = ("id", "score", "status")

    def __init__(self, id: str, score: float, status: str):
        self.id = id
        self.score = score
        self.status = status
```
""",
            },
        ],
        "quiz": {
            "title": "Advanced Python & Asynchronous Architectures Quiz",
            "passing_score": Decimal("70.00"),
            "max_attempts": 3,
            "questions": [
                {
                    "question_text": "What happens if a synchronous, CPU-intensive function is executed directly inside an asyncio coroutine?",
                    "order_index": 1,
                    "explanation": "Because asyncio runs on a single thread event loop, a blocking CPU operation freezes the entire loop, preventing all other concurrent tasks from progressing.",
                    "options": [
                        ("AsyncIO automatically spawns a background thread", False, 1),
                        ("It blocks the event loop, pausing all other concurrent tasks until it finishes", True, 2),
                        ("Python raises a SyntaxError at runtime", False, 3),
                        ("The function executes at double speed", False, 4),
                    ],
                },
                {
                    "question_text": "How should CPU-bound tasks (e.g. scikit-learn model inference) be executed inside an async service?",
                    "order_index": 2,
                    "explanation": "CPU-bound tasks should be delegated to a ThreadPoolExecutor or ProcessPoolExecutor via loop.run_in_executor to avoid blocking the event loop.",
                    "options": [
                        ("Using loop.run_in_executor with a ThreadPoolExecutor or ProcessPoolExecutor", True, 1),
                        ("Placing time.sleep() before every calculation", False, 2),
                        ("Calling sys.setrecursionlimit(100000)", False, 3),
                        ("Wrapping the calculation in a try/except block", False, 4),
                    ],
                },
                {
                    "question_text": "What is the primary memory optimization achieved by defining __slots__ in a Python class?",
                    "order_index": 3,
                    "explanation": "__slots__ tells Python not to create a dynamic __dict__ dictionary for each instance, saving significant memory when millions of instances are created.",
                    "options": [
                        ("It forces Python to store all attributes in Redis", False, 1),
                        ("It suppresses instance __dict__ creation, significantly lowering per-instance memory footprint", True, 2),
                        ("It compresses all strings into base64", False, 3),
                        ("It prevents class inheritance", False, 4),
                    ],
                },
                {
                    "question_text": "What is the difference between asyncio.gather() and asyncio.as_completed()?",
                    "order_index": 4,
                    "explanation": "asyncio.gather waits for all coroutines and returns results in original order; asyncio.as_completed yields results as each task finishes.",
                    "options": [
                        ("gather is deprecated in Python 3", False, 1),
                        ("gather returns results in the submitted order; as_completed yields tasks as they finish", True, 2),
                        ("as_completed can only run single-threaded calculations", False, 3),
                        ("They are identical aliases for each other", False, 4),
                    ],
                },
            ],
        },
    },
]


def seed_learning_and_retention(db: Session) -> None:
    """
    Seed rich learning resources, multiple-choice quizzes, assessments, and retention interventions.
    All operations are strictly idempotent.
    """
    print("[Seed] 6a Seeding Educational Courses, Lessons & Quizzes...")

    # Fetch existing skills map
    skills = db.scalars(select(Skill)).all()
    skill_map = {s.skill_code: s for s in skills}

    # 1. Seed or update each sample course, lessons, and quiz
    for c_info in SAMPLE_COURSES:
        course = db.scalar(
            select(TrainingCourse).where(TrainingCourse.course_code == c_info["course_code"])
        )
        if not course:
            course = TrainingCourse(
                course_code=c_info["course_code"],
                title=c_info["title"],
                description=c_info["description"],
                provider=c_info["provider"],
                duration_hours=c_info["duration_hours"],
                difficulty_level=c_info["difficulty_level"],
                training_mode=c_info["training_mode"],
                is_active=True,
            )
            db.add(course)
            db.flush()

            for sk_code in c_info["target_skills"]:
                if sk_code in skill_map:
                    ts = TrainingSkill(training_course_id=course.id, skill_id=skill_map[sk_code].id)
                    db.add(ts)
            db.flush()
        else:
            # Update metadata
            course.title = c_info["title"]
            course.description = c_info["description"]
            course.duration_hours = c_info["duration_hours"]
            course.difficulty_level = c_info["difficulty_level"]
            course.training_mode = c_info["training_mode"]
            course.is_active = True

        # Seed or update lessons
        for l_info in c_info["lessons"]:
            existing_lesson = db.scalar(
                select(CourseLesson).where(
                    CourseLesson.course_id == course.id,
                    CourseLesson.order_index == l_info["order_index"],
                )
            )
            if not existing_lesson:
                existing_lesson = db.scalar(
                    select(CourseLesson).where(
                        CourseLesson.course_id == course.id,
                        CourseLesson.title == l_info["title"],
                    )
                )

            if existing_lesson:
                existing_lesson.title = l_info["title"]
                existing_lesson.content = l_info["content"]
                existing_lesson.description = l_info.get("description")
                existing_lesson.provider = l_info.get("provider", "External")
                existing_lesson.skill_covered = l_info.get("skill_covered")
                existing_lesson.resource_type = l_info.get("resource_type", "VIDEO")
                existing_lesson.access_type = l_info.get("access_type", "FREE")
                existing_lesson.external_url = l_info.get("external_url")
                existing_lesson.order_index = l_info["order_index"]
                existing_lesson.is_required = l_info["is_required"]
                existing_lesson.estimated_minutes = l_info["estimated_minutes"]
                existing_lesson.is_active = True
            else:
                lesson = CourseLesson(
                    course_id=course.id,
                    title=l_info["title"],
                    content=l_info["content"],
                    description=l_info.get("description"),
                    provider=l_info.get("provider", "External"),
                    skill_covered=l_info.get("skill_covered"),
                    resource_type=l_info.get("resource_type", "VIDEO"),
                    access_type=l_info.get("access_type", "FREE"),
                    external_url=l_info.get("external_url"),
                    order_index=l_info["order_index"],
                    is_required=l_info["is_required"],
                    estimated_minutes=l_info["estimated_minutes"],
                    is_active=True,
                )
                db.add(lesson)
        db.flush()

        # Seed or update quiz
        q_info = c_info["quiz"]
        existing_quiz = db.scalar(
            select(CourseQuiz).where(CourseQuiz.course_id == course.id)
        )
        if not existing_quiz:
            quiz = CourseQuiz(
                course_id=course.id,
                title=q_info["title"],
                description=f"Demonstration knowledge assessment for {course.title}. Passing score: {q_info['passing_score']}%.",
                passing_score=q_info["passing_score"],
                max_attempts=q_info["max_attempts"],
                is_active=True,
            )
            db.add(quiz)
            db.flush()
        else:
            quiz = existing_quiz
            quiz.title = q_info["title"]
            quiz.passing_score = q_info["passing_score"]
            quiz.max_attempts = q_info["max_attempts"]
            quiz.is_active = True

        # Ensure quiz questions exist
        existing_questions = db.scalars(
            select(QuizQuestion).where(QuizQuestion.quiz_id == quiz.id)
        ).all()
        if not existing_questions:
            for qu_info in q_info["questions"]:
                question = QuizQuestion(
                    quiz_id=quiz.id,
                    question_text=qu_info["question_text"],
                    order_index=qu_info["order_index"],
                    explanation=qu_info["explanation"],
                )
                db.add(question)
                db.flush()

                for opt_text, is_corr, o_idx in qu_info["options"]:
                    opt = QuizOption(
                        question_id=question.id,
                        option_text=opt_text,
                        is_correct=is_corr,
                        order_index=o_idx,
                    )
                    db.add(opt)
            db.flush()

    # Ensure TR-GCP-ARCH has lessons but NO quiz, explicitly demonstrating the unpublished quiz state!
    gcp_arch = db.scalar(select(TrainingCourse).where(TrainingCourse.course_code == "TR-GCP-ARCH"))
    if gcp_arch:
        l1 = db.scalar(select(CourseLesson).where(CourseLesson.course_id == gcp_arch.id, CourseLesson.order_index == 1))
        if not l1:
            db.add(CourseLesson(
                course_id=gcp_arch.id,
                title="Designing High-Availability Cloud Networks on GCP",
                description="Google Cloud official architecture overview on VPC peering, Cloud Interconnect, and Global Load Balancing.",
                provider="Google Cloud Documentation",
                skill_covered="Cloud Networking",
                resource_type="DOCUMENTATION",
                access_type="FREE",
                external_url="https://cloud.google.com/architecture/framework",
                content="# Cloud Networking on GCP\nVPC peering, Cloud Interconnect, Shared VPC, and global load balancer topologies.",
                order_index=1,
                is_required=True,
                estimated_minutes=45,
                is_active=True,
            ))
        l2 = db.scalar(select(CourseLesson).where(CourseLesson.course_id == gcp_arch.id, CourseLesson.order_index == 2))
        if not l2:
            db.add(CourseLesson(
                course_id=gcp_arch.id,
                title="Cloud Security & Identity Governance",
                description="GCP IAM best practices, organization policies, service identity federation, and KMS key management.",
                provider="Google Cloud Documentation",
                skill_covered="Cloud Security Governance",
                resource_type="DOCUMENTATION",
                access_type="FREE",
                external_url="https://cloud.google.com/architecture/framework",
                content="# GCP Identity & Access Management\nOrganization policies, resource hierarchy, service identity federation, and KMS.",
                order_index=2,
                is_required=True,
                estimated_minutes=40,
                is_active=True,
            ))
        db.flush()

    db.commit()

    # 2. Ensure Demo Employee (Sarah Johnson, EMP-ENG-018) has varied course enrollments
    demo_emp = db.scalar(select(Employee).where(Employee.employee_code == "EMP-ENG-018"))
    if demo_emp:
        # 1. TR-PY-FUND -> In Progress (1 lesson completed, 1 opened, quiz ready)
        py_fund = db.scalar(select(TrainingCourse).where(TrainingCourse.course_code == "TR-PY-FUND"))
        if py_fund:
            enr_py = db.scalar(select(TrainingEnrollment).where(
                TrainingEnrollment.employee_id == demo_emp.id,
                TrainingEnrollment.training_course_id == py_fund.id,
            ))
            if not enr_py:
                enr_py = TrainingEnrollment(
                    employee_id=demo_emp.id,
                    training_course_id=py_fund.id,
                    enrollment_date=date.today() - timedelta(days=10),
                    enrollment_status=EnrollmentStatus.IN_PROGRESS,
                )
                db.add(enr_py)
                db.flush()

            # Mark lesson 1 completed, lesson 2 opened
            lessons_py = db.scalars(select(CourseLesson).where(CourseLesson.course_id == py_fund.id).order_by(CourseLesson.order_index)).all()
            if len(lessons_py) >= 1:
                comp1 = db.scalar(select(LessonCompletion).where(LessonCompletion.enrollment_id == enr_py.id, LessonCompletion.lesson_id == lessons_py[0].id))
                if not comp1:
                    db.add(LessonCompletion(
                        enrollment_id=enr_py.id,
                        lesson_id=lessons_py[0].id,
                        employee_id=demo_emp.id,
                        resource_opened=True,
                        opened_at=datetime.now() - timedelta(days=8),
                        is_completed=True,
                        completed_at=datetime.now() - timedelta(days=8),
                    ))
            if len(lessons_py) >= 2:
                comp2 = db.scalar(select(LessonCompletion).where(LessonCompletion.enrollment_id == enr_py.id, LessonCompletion.lesson_id == lessons_py[1].id))
                if not comp2:
                    db.add(LessonCompletion(
                        enrollment_id=enr_py.id,
                        lesson_id=lessons_py[1].id,
                        employee_id=demo_emp.id,
                        resource_opened=True,
                        opened_at=datetime.now() - timedelta(days=2),
                        is_completed=False,
                        completed_at=None,
                    ))

        # 2. TR-SQL-FUND -> Enrolled (Ready to start)
        sql_fund = db.scalar(select(TrainingCourse).where(TrainingCourse.course_code == "TR-SQL-FUND"))
        if sql_fund:
            enr_sql = db.scalar(select(TrainingEnrollment).where(
                TrainingEnrollment.employee_id == demo_emp.id,
                TrainingEnrollment.training_course_id == sql_fund.id,
            ))
            if not enr_sql:
                enr_sql = TrainingEnrollment(
                    employee_id=demo_emp.id,
                    training_course_id=sql_fund.id,
                    enrollment_date=date.today() - timedelta(days=3),
                    enrollment_status=EnrollmentStatus.ENROLLED,
                )
                db.add(enr_sql)
                db.flush()

        # 3. TR-GCP-ARCH -> In Progress, demonstrates unpublished quiz
        if gcp_arch:
            enr_gcp = db.scalar(select(TrainingEnrollment).where(
                TrainingEnrollment.employee_id == demo_emp.id,
                TrainingEnrollment.training_course_id == gcp_arch.id,
            ))
            if not enr_gcp:
                enr_gcp = TrainingEnrollment(
                    employee_id=demo_emp.id,
                    training_course_id=gcp_arch.id,
                    enrollment_date=date.today() - timedelta(days=14),
                    enrollment_status=EnrollmentStatus.IN_PROGRESS,
                )
                db.add(enr_gcp)
                db.flush()

        db.commit()

    # 3. Seed demonstration lesson completions & quiz attempts for existing enrollments
    print("[Seed] 6b Seeding Demonstration Lesson Progress & Quiz Attempts...")
    enrollments = db.scalars(
        select(TrainingEnrollment)
        .options(
            selectinload(TrainingEnrollment.training_course).selectinload(TrainingCourse.lessons),
            selectinload(TrainingEnrollment.training_course).selectinload(TrainingCourse.quiz).selectinload(CourseQuiz.questions).selectinload(QuizQuestion.options),
            selectinload(TrainingEnrollment.lesson_completions),
            selectinload(TrainingEnrollment.quiz_attempts),
        )
    ).all()

    for enr in enrollments:
        course = enr.training_course
        if not course or not course.lessons:
            continue

        # If completed, ensure all required lessons have completion records
        if enr.enrollment_status == EnrollmentStatus.COMPLETED:
            for lesson in course.lessons:
                existing_comp = next((lc for lc in enr.lesson_completions if lc.lesson_id == lesson.id), None)
                comp_time = datetime.combine(
                    enr.completion_date or enr.enrollment_date,
                    datetime.min.time(),
                )
                if not existing_comp:
                    db.add(
                        LessonCompletion(
                            enrollment_id=enr.id,
                            lesson_id=lesson.id,
                            employee_id=enr.employee_id,
                            resource_opened=True,
                            opened_at=comp_time,
                            is_completed=True,
                            completed_at=comp_time,
                        )
                    )
                else:
                    existing_comp.resource_opened = True
                    existing_comp.is_completed = True
                    if not existing_comp.completed_at:
                        existing_comp.completed_at = comp_time

            # Ensure a passing quiz attempt exists if course has a quiz
            if course.quiz and course.quiz.questions and not any(qa.passed for qa in enr.quiz_attempts):
                score_val = enr.completion_score or Decimal("85.00")
                breakdown = []
                for q in course.quiz.questions:
                    corr = next((o for o in q.options if o.is_correct), q.options[0])
                    breakdown.append({
                        "question_id": str(q.id),
                        "question_text": q.question_text,
                        "selected_option_id": str(corr.id),
                        "correct_option_id": str(corr.id),
                        "is_correct": True,
                        "explanation": q.explanation,
                    })

                db.add(
                    QuizAttempt(
                        quiz_id=course.quiz.id,
                        enrollment_id=enr.id,
                        employee_id=enr.employee_id,
                        attempt_number=1,
                        score=score_val,
                        passed=True,
                        answers_payload=breakdown,
                        attempted_at=datetime.combine(
                            enr.completion_date or enr.enrollment_date,
                            datetime.min.time(),
                        ),
                    )
                )

        elif enr.enrollment_status == EnrollmentStatus.IN_PROGRESS:
            # Mark first lesson opened and completed if no records exist
            if course.lessons and not enr.lesson_completions:
                first_lesson = course.lessons[0]
                comp_time = datetime.combine(
                    enr.enrollment_date + timedelta(days=2),
                    datetime.min.time(),
                )
                db.add(
                    LessonCompletion(
                        enrollment_id=enr.id,
                        lesson_id=first_lesson.id,
                        employee_id=enr.employee_id,
                        resource_opened=True,
                        opened_at=comp_time,
                        is_completed=True,
                        completed_at=comp_time,
                    )
                )

    db.commit()

    # 4. Seed Before-and-After Skill Assessments
    print("[Seed] 6c Seeding Demonstration Baseline & Post-Training Skill Assessments...")
    hr_admin = db.scalar(select(User).where(User.username == "admin"))
    evaluator_id = hr_admin.id if hr_admin else None

    # Enrollments with completed status
    completed_enrs = db.scalars(
        select(TrainingEnrollment)
        .options(
            selectinload(TrainingEnrollment.training_course).selectinload(TrainingCourse.training_skills),
            selectinload(TrainingEnrollment.employee),
        )
        .where(TrainingEnrollment.enrollment_status == EnrollmentStatus.COMPLETED)
        .limit(20)
    ).all()

    for enr in completed_enrs:
        emp = enr.employee
        course = enr.training_course
        if not emp or not course:
            continue

        for ts in course.training_skills:
            target_skill = ts.skill
            if not target_skill:
                continue

            # Check if assessments already seeded
            has_assessments = db.scalar(
                select(SkillAssessment).where(
                    SkillAssessment.employee_id == emp.id,
                    SkillAssessment.skill_id == target_skill.id,
                )
            )
            if not has_assessments:
                baseline_date = enr.enrollment_date - timedelta(days=7)
                post_date = enr.completion_date or (enr.enrollment_date + timedelta(days=30))

                # Baseline assessment
                baseline = SkillAssessment(
                    employee_id=emp.id,
                    skill_id=target_skill.id,
                    training_course_id=course.id,
                    assessment_type=AssessmentType.BASELINE,
                    score=Decimal("52.00"),
                    assessed_proficiency=2,
                    assessment_date=baseline_date,
                    evaluator_id=evaluator_id,
                    notes=f"[Demonstration Baseline] Pre-training diagnostic evaluation prior to '{course.title}'.",
                )
                db.add(baseline)

                # Post-training assessment showing measurable improvement
                post = SkillAssessment(
                    employee_id=emp.id,
                    skill_id=target_skill.id,
                    training_course_id=course.id,
                    assessment_type=AssessmentType.POST_TRAINING,
                    score=Decimal("84.00"),
                    assessed_proficiency=4,
                    assessment_date=post_date,
                    evaluator_id=evaluator_id,
                    notes=(
                        f"[Demonstration Post-Training] Practical reassessment following completion of '{course.title}'. "
                        "Demonstrated solid proficiency in applied project exercises."
                    ),
                )
                db.add(post)

                # Update employee skill proficiency upon authorized evaluation
                emp_skill = db.scalar(
                    select(EmployeeSkill).where(
                        EmployeeSkill.employee_id == emp.id,
                        EmployeeSkill.skill_id == target_skill.id,
                    )
                )
                if emp_skill:
                    emp_skill.proficiency_level = 4
                    emp_skill.last_assessed_date = post_date

    db.commit()

    # 5. Seed Retention Interventions linked to High-Priority Recommendations
    print("[Seed] 7b Seeding Demonstration Retention Interventions & Follow-ups...")
    high_priority_recs = db.scalars(
        select(Recommendation)
        .options(
            selectinload(Recommendation.employee),
            selectinload(Recommendation.retention_interventions),
        )
        .order_by(Recommendation.generated_at.desc())
        .limit(10)
    ).all()

    intervention_templates = [
        (
            "Workload Review & Overtime Reduction",
            "WORKLOAD_REVIEW",
            InterventionStatus.COMPLETED,
            RetentionOutcome.EMPLOYED,
            "Conducted workload rebalancing discussion. Capped sprint commitments and redistributed on-call coverage.",
            "[Demonstration Outcome] 90-day check-in completed. Employee reported improved work-life balance and sustained engagement.",
        ),
        (
            "1:1 Career Mentorship & Senior Coaching",
            "MENTORING",
            InterventionStatus.ACCEPTED,
            RetentionOutcome.PENDING,
            "Paired employee with Principal Architect for bi-weekly technical roadmap guidance and career pathing.",
            "[Demonstration Outcome] Mid-period check-in pending scheduled 6-month formal review.",
        ),
        (
            "Targeted Skill Development & Training Sponsorship",
            "TRAINING",
            InterventionStatus.COMPLETED,
            RetentionOutcome.EMPLOYED,
            "Sponsored specialized enterprise certification and allocated dedicated 4 hours/week learning bandwidth.",
            "[Demonstration Outcome] 180-day follow-up confirmed employee completed program and retained in role.",
        ),
        (
            "Compensation Parity & Role Realignment",
            "COMPENSATION_REVIEW",
            InterventionStatus.OFFERED,
            RetentionOutcome.PENDING,
            "Benchmarked market compensation for role grade level and submitted compensation adjustment proposal.",
            None,
        ),
    ]

    for idx, rec in enumerate(high_priority_recs):
        if rec.retention_interventions:
            continue

        tmpl = intervention_templates[idx % len(intervention_templates)]
        title, i_type, i_status, outcome, notes, outcome_notes = tmpl

        offered = rec.generated_at.date() + timedelta(days=2)
        completed = offered + timedelta(days=14) if i_status == InterventionStatus.COMPLETED else None
        follow_up = offered + timedelta(days=90)

        intervention = RetentionIntervention(
            recommendation_id=rec.id,
            employee_id=rec.employee_id,
            hr_user_id=evaluator_id or rec.employee_id,
            concern_summary=rec.title,
            intervention_type=i_type,
            status=i_status,
            offered_date=offered,
            completed_date=completed,
            follow_up_date=follow_up,
            notes=f"[Demonstration Data] {notes}",
            retention_outcome=outcome,
            outcome_recorded_date=follow_up if outcome != RetentionOutcome.PENDING else None,
            outcome_notes=outcome_notes,
        )
        db.add(intervention)

    db.commit()
    print("[Seed] Learning, Assessments, and Retention data successfully seeded!")
