"""
Extended User Seeder for Enterprise Workforce Predictive Analytics.

Populates 55 comprehensive, role-diverse enterprise user profiles across:
- 5 HR Administrators (Governance, compliance, and user administration)
- 15 HR Managers / Department Heads (Managerial org tree, team risk, interventions)
- 35 Employees across all 8 departments (Self-service dashboard, skills, learning, requests)

Every user profile is linked directly to a corresponding real employee record where applicable,
with deterministic credentials ('demo1234') for seamless live demonstrations.
"""

from app.database import UserRole
from app.models import Employee, User
from app.security import hash_password
from sqlalchemy.orm import Session

# Specific manager employees to create HR_MANAGER accounts for
MANAGER_EMPLOYEE_CODES = [
    "EMP-ENG-001",  # James White (Lead Software Architect, Engineering Head)
    "EMP-PROD-001",  # Jennifer Perez (Senior Product Manager, Product Head)
    "EMP-MKT-001",  # Thomas Wilson (Growth Marketing Lead, Marketing Head)
    "EMP-SALES-001",  # Barbara Thomas (Enterprise Account Executive, Sales Head)
    "EMP-HR-001",  # Dorothy Martin (HR Business Partner, HR Head)
    "EMP-FIN-001",  # Harper Russo (Finance Manager, Finance Head)
    "EMP-OPS-001",  # Maya Simon (Director of Operations, Operations Head)
    "EMP-LEGAL-001",  # Nora Johansson (Senior Corporate Counsel, Legal Head)
    "EMP-ENG-004",  # Daniel Lopez (Lead Software Architect)
    "EMP-PROD-007",  # Lisa Hernandez (Senior Product Manager)
    "EMP-SALES-004",  # Richard Martinez (Enterprise Account Executive)
    "EMP-HR-002",  # Linda Moore (HR Business Partner)
    "EMP-MKT-003",  # Sarah Clark (Growth Marketing Lead)
]

# Employee codes per department to convert into EMPLOYEE self-service user accounts
EMPLOYEE_SELECTION_BY_DEPT = {
    "ENG": [
        "EMP-ENG-003",  # Paul Martinez (Senior Machine Learning Engineer)
        "EMP-ENG-006",  # Jessica Jones (Frontend Engineer)
        "EMP-ENG-009",  # George Thomas (Senior Software Engineer)
        "EMP-ENG-012",  # Matthew Taylor (Senior Machine Learning Engineer)
        "EMP-ENG-014",  # Anthony Davies (Senior Software Engineer)
        "EMP-ENG-016",  # Mark Martin (Senior Software Engineer)
        "EMP-ENG-020",  # Steven Evans (Frontend Engineer)
        "EMP-ENG-022",  # Paul Roberts (Senior Machine Learning Engineer)
    ],
    "PROD": [
        "EMP-PROD-003",  # Margaret Harris (Senior Product Manager)
        "EMP-PROD-005",  # Donna Robinson (Senior Product Manager)
        "EMP-PROD-008",  # Deborah Jackson (Senior Product Manager)
        "EMP-PROD-010",  # Kimberly Lewis (Senior Product Manager)
    ],
    "MKT": [
        "EMP-MKT-002",  # Nancy Lee (Growth Marketing Lead)
        "EMP-MKT-004",  # Betty Walker (Growth Marketing Lead)
        "EMP-MKT-006",  # Ashley Hall (Growth Marketing Lead)
        "EMP-MKT-008",  # Emily Young (Growth Marketing Lead)
    ],
    "SALES": [
        "EMP-SALES-002",  # Carol Thompson (Enterprise Account Executive)
        "EMP-SALES-003",  # Dorothy Anderson (Enterprise Account Executive)
        "EMP-SALES-005",  # Joseph White (Enterprise Account Executive)
        "EMP-SALES-006",  # William Jones (Enterprise Account Executive)
        "EMP-SALES-007",  # Charles Brown (Enterprise Account Executive)
    ],
    "HR": [
        "EMP-HR-003",  # Linda Anderson (HR Business Partner)
        "EMP-HR-004",  # Patricia Taylor (HR Business Partner)
        "EMP-HR-005",  # Andrew Wilson (HR Business Partner)
    ],
    "FIN": [
        "EMP-FIN-002",  # Liam Chen (Senior Financial Analyst)
        "EMP-FIN-003",  # Sophia Patel (Senior Financial Analyst)
        "EMP-FIN-005",  # Isabella Morales (Financial Analyst)
        "EMP-FIN-007",  # Olivia Kim (Financial Analyst)
    ],
    "OPS": [
        "EMP-OPS-002",  # Ethan Brooks (Business Operations Lead)
        "EMP-OPS-004",  # Noah Vance (Systems Administrator)
        "EMP-OPS-006",  # Lucas Meyer (Systems Administrator)
    ],
    "LEGAL": [
        "EMP-LEGAL-002",  # Zachary Price (Senior Corporate Counsel)
        "EMP-LEGAL-003",  # Zoe Bennett (Regulatory Compliance Specialist)
    ],
}


def _safe_link_user(db: Session, user: User, emp: Employee) -> bool:
    """
    Safely link an employee to a user account, handling the unique constraint on user_id.
    """
    if not user or not emp:
        return False
    if emp.user_id == user.id:
        return False

    # Unlink any other employee currently holding this user_id
    conflicting = db.query(Employee).filter(Employee.user_id == user.id).all()
    for ce in conflicting:
        if ce.id != emp.id:
            ce.user_id = None
    db.flush()

    emp.user_id = user.id
    db.flush()
    return True


def seed_extended_users(db: Session) -> dict[str, int]:
    """
    Seed 55 diverse enterprise user accounts into the database idempotently.
    Ensures passwords are set to 'demo1234' and employees are linked to their user profiles.
    """
    default_pwd_hash = hash_password("demo1234")
    stats = {"created": 0, "updated": 0, "linked": 0}

    # 1. Base Demo Accounts (HR_ADMIN, HR_MANAGER, EMPLOYEE)
    core_accounts = [
        {
            "username": "admin",
            "email": "admin@workforce.local",
            "display_name": "Eleanor Vance (Chief People Officer)",
            "role": UserRole.HR_ADMIN,
        },
        {
            "username": "clara.adams",
            "email": "clara.adams@workforce.local",
            "display_name": "Clara Adams (VP of People & Culture)",
            "role": UserRole.HR_ADMIN,
        },
        {
            "username": "marcus.admin",
            "email": "marcus.admin@workforce.local",
            "display_name": "Marcus Thorne (HR Operations & Governance)",
            "role": UserRole.HR_ADMIN,
        },
        {
            "username": "priya.sharma",
            "email": "priya.sharma@workforce.local",
            "display_name": "Priya Sharma (HRIS & Compliance Director)",
            "role": UserRole.HR_ADMIN,
        },
        {
            "username": "samuel.green",
            "email": "samuel.green@workforce.local",
            "display_name": "Samuel Green (Head of Global Talent)",
            "role": UserRole.HR_ADMIN,
        },
        {
            "username": "user",
            "email": "user@workforce.local",
            "display_name": "Marcus Thorne (People Partner Lead)",
            "role": UserRole.HR_MANAGER,
        },
        {
            "username": "hrmanager",
            "email": "manager@workforce.local",
            "display_name": "Marcus Thorne (HR Manager)",
            "role": UserRole.HR_MANAGER,
        },
        {
            "username": "demo",
            "email": "demo@workforce.local",
            "display_name": "Sarah Johnson (Senior Software Engineer)",
            "role": UserRole.EMPLOYEE,
        },
        {
            "username": "employee",
            "email": "employee@workforce.local",
            "display_name": "Sarah Connor (Staff Engineer)",
            "role": UserRole.EMPLOYEE,
        },
    ]

    for acc in core_accounts:
        user = (
            db.query(User)
            .filter((User.email == acc["email"]) | (User.username == acc["username"]))
            .first()
        )

        if not user:
            user = User(
                username=acc["username"],
                email=acc["email"],
                display_name=acc["display_name"],
                role=acc["role"],
                password_hash=default_pwd_hash,
                is_active=True,
            )
            db.add(user)
            db.flush()
            stats["created"] += 1
        else:
            user.display_name = acc["display_name"]
            user.role = acc["role"]
            user.password_hash = default_pwd_hash
            user.is_active = True
            db.flush()
            stats["updated"] += 1

    # Link demo to EMP-ENG-018
    demo_user = db.query(User).filter(User.username == "demo").first()
    demo_emp = db.query(Employee).filter(Employee.employee_code == "EMP-ENG-018").first()
    if demo_user and demo_emp and _safe_link_user(db, demo_user, demo_emp):
        stats["linked"] += 1

    # Link employee user to EMP-ENG-006 (Jessica Jones)
    emp_user = db.query(User).filter(User.username == "employee").first()
    emp_target = db.query(Employee).filter(Employee.employee_code == "EMP-ENG-006").first()
    if emp_user and emp_target and _safe_link_user(db, emp_user, emp_target):
        stats["linked"] += 1

    # 2. Manager User Profiles (HR_MANAGER) for Department Heads & Team Leads
    for code in MANAGER_EMPLOYEE_CODES:
        emp = db.query(Employee).filter(Employee.employee_code == code).first()
        if not emp:
            continue

        username = emp.official_email.split("@")[0]
        user = (
            db.query(User)
            .filter((User.email == emp.official_email) | (User.username == username))
            .first()
        )

        title_suffix = f" ({emp.job_role.title})" if emp.job_role else ""
        display_name = f"{emp.first_name} {emp.last_name}{title_suffix}"

        if not user:
            user = User(
                username=username,
                email=emp.official_email,
                display_name=display_name,
                role=UserRole.HR_MANAGER,
                password_hash=default_pwd_hash,
                is_active=True,
            )
            db.add(user)
            db.flush()
            stats["created"] += 1
        else:
            user.display_name = display_name
            user.role = UserRole.HR_MANAGER
            user.password_hash = default_pwd_hash
            user.is_active = True
            db.flush()
            stats["updated"] += 1

        if _safe_link_user(db, user, emp):
            stats["linked"] += 1

    # 3. Employee User Profiles (EMPLOYEE) across all departments
    for dept_code, codes in EMPLOYEE_SELECTION_BY_DEPT.items():
        for code in codes:
            emp = db.query(Employee).filter(Employee.employee_code == code).first()
            if not emp:
                continue

            username = emp.official_email.split("@")[0]
            user = (
                db.query(User)
                .filter((User.email == emp.official_email) | (User.username == username))
                .first()
            )

            title_suffix = f" ({emp.job_role.title})" if emp.job_role else ""
            display_name = f"{emp.first_name} {emp.last_name}{title_suffix}"

            if not user:
                user = User(
                    username=username,
                    email=emp.official_email,
                    display_name=display_name,
                    role=UserRole.EMPLOYEE,
                    password_hash=default_pwd_hash,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                stats["created"] += 1
            else:
                user.display_name = display_name
                user.role = UserRole.EMPLOYEE
                user.password_hash = default_pwd_hash
                user.is_active = True
                db.flush()
                stats["updated"] += 1

            if _safe_link_user(db, user, emp):
                stats["linked"] += 1

    db.commit()
    return stats
