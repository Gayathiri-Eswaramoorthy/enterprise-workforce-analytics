"""
Deterministic development database seeder for Enterprise Workforce Predictive Analytics.

NOTE: This script seeds organizational structure, users, skills, employees,
reviews, and training courses.
Per project architecture, ML model training is decoupled and executed separately via ml/training/train.py.
"""

import os
import sys
from datetime import date, timedelta
from decimal import Decimal

# Add backend directory to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import (
    DifficultyLevel,
    EmploymentStatus,
    EmploymentType,
    EnrollmentStatus,
    Gender,
    ReviewCycle,
    SessionLocal,
    TrainingMode,
    UserRole,
    WorkMode,
)
from app.models import (
    Department,
    Employee,
    EmployeeSkill,
    JobRole,
    PerformanceReview,
    RoleSkill,
    Skill,
    TrainingCourse,
    TrainingEnrollment,
    TrainingSkill,
    User,
)
from app.security import hash_password


def seed_database():
    print("[Seed] Starting deterministic database seeding...")
    db = SessionLocal()

    try:
        # 1. Seed Demo Users
        print("[Seed] 1/7 Seeding Users...")
        default_pwd_hash = hash_password("Password123!")

        users_data = [
            {
                "username": "admin",
                "email": "admin@workforce.local",
                "display_name": "Eleanor Vance (HR Admin)",
                "role": UserRole.HR_ADMIN,
                "password_hash": default_pwd_hash,
                "is_active": True,
            },
            {
                "username": "hrmanager",
                "email": "manager@workforce.local",
                "display_name": "Marcus Thorne (HR Manager)",
                "role": UserRole.HR_MANAGER,
                "password_hash": default_pwd_hash,
                "is_active": True,
            },
            {
                "username": "employee",
                "email": "employee@workforce.local",
                "display_name": "Sarah Connor (Staff Engineer)",
                "role": UserRole.EMPLOYEE,
                "password_hash": default_pwd_hash,
                "is_active": True,
            },
        ]

        user_map = {}
        for u_data in users_data:
            existing = (
                db.query(User)
                .filter((User.email == u_data["email"]) | (User.username == u_data["username"]))
                .first()
            )
            if not existing:
                user = User(**u_data)
                db.add(user)
                db.flush()
                user_map[u_data["username"]] = user
            else:
                existing.email = u_data["email"]
                existing.password_hash = default_pwd_hash
                existing.role = u_data["role"]
                existing.is_active = True
                db.flush()
                user_map[u_data["username"]] = existing

        # 2. Seed Departments
        print("[Seed] 2/7 Seeding Departments...")
        departments_data = [
            {
                "department_code": "ENG",
                "name": "Engineering",
                "description": "Software architecture, cloud infrastructure, and product development.",
                "hr_manager_user_id": user_map["hrmanager"].id,
            },
            {
                "department_code": "HR",
                "name": "Human Resources",
                "description": "Talent acquisition, organizational development, and employee relations.",
                "hr_manager_user_id": user_map["admin"].id,
            },
            {
                "department_code": "PROD",
                "name": "Product & Design",
                "description": "Product management, UI/UX research, and user experience design.",
                "hr_manager_user_id": user_map["hrmanager"].id,
            },
            {
                "department_code": "SALES",
                "name": "Enterprise Sales",
                "description": "Commercial client relations, enterprise partnerships, and revenue generation.",
                "hr_manager_user_id": user_map["hrmanager"].id,
            },
            {
                "department_code": "MKT",
                "name": "Growth & Marketing",
                "description": "Brand strategy, performance marketing, and market analytics.",
                "hr_manager_user_id": user_map["hrmanager"].id,
            },
        ]

        dept_map = {}
        for d_data in departments_data:
            existing = (
                db.query(Department)
                .filter(Department.department_code == d_data["department_code"])
                .first()
            )
            if not existing:
                dept = Department(**d_data)
                db.add(dept)
                db.flush()
                dept_map[d_data["department_code"]] = dept
            else:
                dept_map[d_data["department_code"]] = existing

        # 3. Seed Skills
        print("[Seed] 3/7 Seeding Skills Catalog...")
        skills_data = [
            # Technical Skills
            {
                "skill_code": "SK-PY",
                "name": "Python Programming",
                "skill_category": "Technical",
                "display_order": 1,
            },
            {
                "skill_code": "SK-SQL",
                "name": "SQL & Data Modeling",
                "skill_category": "Technical",
                "display_order": 2,
            },
            {
                "skill_code": "SK-REACT",
                "name": "React & TypeScript",
                "skill_category": "Technical",
                "display_order": 3,
            },
            {
                "skill_code": "SK-CLOUD",
                "name": "Cloud Architecture (GCP/AWS)",
                "skill_category": "Technical",
                "display_order": 4,
            },
            {
                "skill_code": "SK-ML",
                "name": "Machine Learning & AI",
                "skill_category": "Technical",
                "display_order": 5,
            },
            {
                "skill_code": "SK-DOCKER",
                "name": "DevOps & Kubernetes",
                "skill_category": "Technical",
                "display_order": 6,
            },
            {
                "skill_code": "SK-BI",
                "name": "Power BI & Tableau",
                "skill_category": "Technical",
                "display_order": 7,
            },
            {
                "skill_code": "SK-SEC",
                "name": "Cybersecurity & IAM",
                "skill_category": "Technical",
                "display_order": 8,
            },
            # Soft & Leadership Skills
            {
                "skill_code": "SK-LEAD",
                "name": "Team Leadership & Mentorship",
                "skill_category": "Leadership",
                "display_order": 9,
            },
            {
                "skill_code": "SK-COMM",
                "name": "Executive Communication",
                "skill_category": "Soft Skills",
                "display_order": 10,
            },
            {
                "skill_code": "SK-AGILE",
                "name": "Agile & Scrum Delivery",
                "skill_category": "Domain",
                "display_order": 11,
            },
            {
                "skill_code": "SK-PRODMG",
                "name": "Product Discovery & Strategy",
                "skill_category": "Domain",
                "display_order": 12,
            },
            {
                "skill_code": "SK-TALENT",
                "name": "Talent Acquisition & Sourcing",
                "skill_category": "Domain",
                "display_order": 13,
            },
            {
                "skill_code": "SK-NEGOT",
                "name": "Commercial Negotiation",
                "skill_category": "Domain",
                "display_order": 14,
            },
            {
                "skill_code": "SK-SEO",
                "name": "Growth Analytics & SEO",
                "skill_category": "Domain",
                "display_order": 15,
            },
        ]

        skill_map = {}
        for s_data in skills_data:
            existing = db.query(Skill).filter(Skill.skill_code == s_data["skill_code"]).first()
            if not existing:
                skill = Skill(**s_data)
                db.add(skill)
                db.flush()
                skill_map[s_data["skill_code"]] = skill
            else:
                skill_map[s_data["skill_code"]] = existing

        # 4. Seed Job Roles & Role Skill Requirements
        print("[Seed] 4/7 Seeding Job Roles & Skill Requirements...")
        roles_data = [
            {
                "dept": "ENG",
                "code": "SR-SWE",
                "title": "Senior Software Engineer",
                "grade_level": 4,
                "description": "Designs core backend services, microservices, and databases.",
                "skills": [
                    ("SK-PY", 4, True),
                    ("SK-SQL", 4, True),
                    ("SK-DOCKER", 3, True),
                    ("SK-CLOUD", 3, False),
                    ("SK-AGILE", 3, False),
                ],
            },
            {
                "dept": "ENG",
                "code": "LEAD-SWE",
                "title": "Lead Software Architect",
                "grade_level": 6,
                "description": "Oversees system design, scalability, and engineering technical vision.",
                "skills": [
                    ("SK-PY", 5, True),
                    ("SK-CLOUD", 5, True),
                    ("SK-SQL", 5, True),
                    ("SK-LEAD", 4, True),
                    ("SK-SEC", 4, True),
                ],
            },
            {
                "dept": "ENG",
                "code": "ML-ENG",
                "title": "Senior Machine Learning Engineer",
                "grade_level": 5,
                "description": "Develops predictive AI pipelines, deep learning algorithms, and MLOps.",
                "skills": [
                    ("SK-PY", 5, True),
                    ("SK-ML", 5, True),
                    ("SK-SQL", 4, True),
                    ("SK-CLOUD", 4, False),
                ],
            },
            {
                "dept": "ENG",
                "code": "FE-ENG",
                "title": "Frontend Engineer",
                "grade_level": 3,
                "description": "Builds interactive web interfaces, design components, and user journeys.",
                "skills": [
                    ("SK-REACT", 4, True),
                    ("SK-COMM", 3, False),
                    ("SK-AGILE", 3, True),
                ],
            },
            {
                "dept": "PROD",
                "code": "SR-PM",
                "title": "Senior Product Manager",
                "grade_level": 5,
                "description": "Drives product strategy, customer analytics, and roadmap execution.",
                "skills": [
                    ("SK-PRODMG", 5, True),
                    ("SK-BI", 4, True),
                    ("SK-COMM", 5, True),
                    ("SK-AGILE", 4, True),
                ],
            },
            {
                "dept": "HR",
                "code": "HR-BP",
                "title": "HR Business Partner",
                "grade_level": 4,
                "description": "Partners with leadership on retention, performance reviews, and compensation.",
                "skills": [
                    ("SK-TALENT", 4, True),
                    ("SK-COMM", 4, True),
                    ("SK-LEAD", 3, False),
                    ("SK-BI", 3, False),
                ],
            },
            {
                "dept": "SALES",
                "code": "ENT-AE",
                "title": "Enterprise Account Executive",
                "grade_level": 4,
                "description": "Leads high-value B2B enterprise deals and strategic accounts.",
                "skills": [
                    ("SK-NEGOT", 5, True),
                    ("SK-COMM", 5, True),
                    ("SK-LEAD", 3, False),
                ],
            },
            {
                "dept": "MKT",
                "code": "MKT-LEAD",
                "title": "Growth Marketing Lead",
                "grade_level": 4,
                "description": "Executes digital acquisition, content marketing, and campaign optimization.",
                "skills": [
                    ("SK-SEO", 5, True),
                    ("SK-BI", 4, True),
                    ("SK-COMM", 4, True),
                ],
            },
        ]

        role_map = {}
        for r_data in roles_data:
            dept = dept_map[r_data["dept"]]
            existing = (
                db.query(JobRole)
                .filter(JobRole.department_id == dept.id, JobRole.title == r_data["title"])
                .first()
            )

            if not existing:
                role = JobRole(
                    department_id=dept.id,
                    title=r_data["title"],
                    grade_level=r_data["grade_level"],
                    description=r_data["description"],
                    is_active=True,
                )
                db.add(role)
                db.flush()
                role_map[r_data["code"]] = role

                # Attach skills
                for s_code, req_prof, mandatory in r_data["skills"]:
                    sk = skill_map[s_code]
                    rs = RoleSkill(
                        job_role_id=role.id,
                        skill_id=sk.id,
                        required_proficiency=req_prof,
                        mandatory=mandatory,
                    )
                    db.add(rs)
                db.flush()
            else:
                role_map[r_data["code"]] = existing

        # 5. Seed Training Courses & Skills
        print("[Seed] 5/7 Seeding Training Courses Catalog...")
        courses_data = [
            {
                "course_code": "TR-PY-ADV",
                "title": "Advanced Python & Asynchronous Architectures",
                "description": "Deep dive into asyncio, performance profiling, and distributed systems with Python.",
                "provider": "Pluralsight Enterprise",
                "duration_hours": Decimal("24.0"),
                "difficulty_level": DifficultyLevel.ADVANCED,
                "training_mode": TrainingMode.ONLINE,
                "target_skills": ["SK-PY"],
            },
            {
                "course_code": "TR-GCP-ARCH",
                "title": "Google Cloud Professional Cloud Architect Masterclass",
                "description": "Preparation for designing resilient, scalable infrastructure on GCP.",
                "provider": "Google Cloud Training",
                "duration_hours": Decimal("32.0"),
                "difficulty_level": DifficultyLevel.ADVANCED,
                "training_mode": TrainingMode.ONLINE,
                "target_skills": ["SK-CLOUD", "SK-DOCKER"],
            },
            {
                "course_code": "TR-MLOPS",
                "title": "MLOps: Production Machine Learning Systems",
                "description": "Continuous training, feature stores, model registry, and scalable inference.",
                "provider": "DeepLearning.AI",
                "duration_hours": Decimal("28.0"),
                "difficulty_level": DifficultyLevel.ADVANCED,
                "target_skills": ["SK-ML", "SK-PY"],
            },
            {
                "course_code": "TR-REACT-TS",
                "title": "Enterprise React 19 & TypeScript Architecture",
                "description": "State management, performance optimization, and custom hooks.",
                "provider": "Frontend Masters",
                "duration_hours": Decimal("16.0"),
                "difficulty_level": DifficultyLevel.INTERMEDIATE,
                "target_skills": ["SK-REACT"],
            },
            {
                "course_code": "TR-DATA-BI",
                "title": "Executive Data Storytelling & Power BI Masterclass",
                "description": "Transform data into actionable business intelligence dashboards.",
                "provider": "Coursera Enterprise",
                "duration_hours": Decimal("18.0"),
                "difficulty_level": DifficultyLevel.INTERMEDIATE,
                "target_skills": ["SK-BI", "SK-SQL"],
            },
            {
                "course_code": "TR-EXEC-LEAD",
                "title": "Strategic Leadership & Engineering Management",
                "description": "Building high-performing engineering teams, 1:1 coaching, and conflict resolution.",
                "provider": "Harvard Business Publishing",
                "duration_hours": Decimal("20.0"),
                "difficulty_level": DifficultyLevel.ADVANCED,
                "target_skills": ["SK-LEAD", "SK-COMM"],
            },
            {
                "course_code": "TR-SEC-IAM",
                "title": "Zero Trust Security & Cloud IAM Architecture",
                "description": "Authentication, authorization, secrets management, and compliance standards.",
                "provider": "SANS Institute",
                "duration_hours": Decimal("22.0"),
                "difficulty_level": DifficultyLevel.ADVANCED,
                "target_skills": ["SK-SEC"],
            },
            {
                "course_code": "TR-PROD-STRAT",
                "title": "Product Discovery & Hypothesis-Driven Development",
                "description": "User interviews, rapid prototyping, and metric-driven product roadmapping.",
                "provider": "Reforge",
                "duration_hours": Decimal("20.0"),
                "difficulty_level": DifficultyLevel.INTERMEDIATE,
                "target_skills": ["SK-PRODMG", "SK-AGILE"],
            },
        ]

        course_map = {}
        for c_data in courses_data:
            existing = (
                db.query(TrainingCourse)
                .filter(TrainingCourse.course_code == c_data["course_code"])
                .first()
            )
            if not existing:
                target_skills = c_data.pop("target_skills")
                if "training_mode" not in c_data:
                    c_data["training_mode"] = TrainingMode.ONLINE
                course = TrainingCourse(
                    is_active=True,
                    **c_data,
                )

                db.add(course)
                db.flush()
                course_map[c_data["course_code"]] = course

                for s_code in target_skills:
                    sk = skill_map[s_code]
                    ts = TrainingSkill(training_course_id=course.id, skill_id=sk.id)
                    db.add(ts)
                db.flush()
            else:
                course_map[c_data["course_code"]] = existing

        # 6. Seed Employees Hierarchy & Profiles
        print("[Seed] 6/7 Seeding 12+ Comprehensive Employee Profiles...")
        employees_data = [
            # Engineering Leadership & Seniors
            {
                "code": "EMP-ENG-001",
                "first_name": "Alexander",
                "last_name": "Wright",
                "dob": date(1985, 4, 12),
                "gender": Gender.MALE,
                "phone": "+1-555-0101",
                "email": "alexander.wright@workforce.local",
                "dept": "ENG",
                "role": "LEAD-SWE",
                "manager_code": None,
                "doj": date(2020, 1, 15),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.HYBRID,
                "loc": "San Francisco, CA",
                "skills": [
                    ("SK-PY", 5, 8.5, True),
                    ("SK-CLOUD", 5, 7.0, True),
                    ("SK-SQL", 5, 9.0, True),
                    ("SK-LEAD", 4, 4.0, False),
                    ("SK-SEC", 4, 3.5, True),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("95.00"),
                        5,
                        "Exemplary architectural leadership.",
                        "Continue mentoring senior engineers.",
                    ),
                    (
                        ReviewCycle.ANNUAL,
                        "Annual 2025",
                        date(2025, 12, 15),
                        Decimal("92.00"),
                        5,
                        "Solid track record.",
                        "Expand cloud cost governance.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-EXEC-LEAD",
                        date(2025, 6, 1),
                        date(2025, 7, 15),
                        EnrollmentStatus.COMPLETED,
                        Decimal("98.00"),
                        True,
                        5,
                    ),
                ],
            },
            {
                "code": "EMP-ENG-002",
                "first_name": "Sarah",
                "last_name": "Connor",
                "dob": date(1990, 8, 22),
                "gender": Gender.FEMALE,
                "phone": "+1-555-0102",
                "email": "sarah.connor@workforce.local",
                "dept": "ENG",
                "role": "SR-SWE",
                "manager_code": "EMP-ENG-001",
                "doj": date(2021, 3, 10),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.REMOTE,
                "loc": "Austin, TX",
                "skills": [
                    ("SK-PY", 4, 5.0, True),
                    ("SK-SQL", 4, 4.5, True),
                    ("SK-DOCKER", 3, 2.5, False),
                    ("SK-CLOUD", 2, 1.0, False),
                ],  # Gap in Cloud (2 vs req 3)
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("88.00"),
                        4,
                        "Reliable microservice delivery.",
                        "Needs more cloud deployment ownership.",
                    ),
                    (
                        ReviewCycle.ANNUAL,
                        "Annual 2025",
                        date(2025, 12, 15),
                        Decimal("85.00"),
                        4,
                        "Good performance.",
                        "Upskill in Kubernetes.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-GCP-ARCH",
                        date(2026, 1, 10),
                        None,
                        EnrollmentStatus.IN_PROGRESS,
                        None,
                        False,
                        None,
                    ),
                ],
            },
            {
                "code": "EMP-ENG-003",
                "first_name": "David",
                "last_name": "Chen",
                "dob": date(1993, 11, 5),
                "gender": Gender.MALE,
                "phone": "+1-555-0103",
                "email": "david.chen@workforce.local",
                "dept": "ENG",
                "role": "ML-ENG",
                "manager_code": "EMP-ENG-001",
                "doj": date(2022, 6, 1),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.HYBRID,
                "loc": "San Francisco, CA",
                "skills": [
                    ("SK-PY", 5, 4.0, True),
                    ("SK-ML", 4, 3.0, True),
                    ("SK-SQL", 4, 3.5, False),
                    ("SK-CLOUD", 3, 1.5, False),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("90.00"),
                        4,
                        "High quality feature engineering.",
                        "Automate model retraining pipeline.",
                    ),
                    (
                        ReviewCycle.ANNUAL,
                        "Annual 2025",
                        date(2025, 12, 15),
                        Decimal("86.00"),
                        4,
                        "Good AI modeling.",
                        "Document experimental findings.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-MLOPS",
                        date(2025, 9, 1),
                        date(2025, 10, 20),
                        EnrollmentStatus.COMPLETED,
                        Decimal("94.00"),
                        True,
                        5,
                    ),
                ],
            },
            {
                "code": "EMP-ENG-004",
                "first_name": "Elena",
                "last_name": "Rostova",
                "dob": date(1996, 2, 14),
                "gender": Gender.FEMALE,
                "phone": "+1-555-0104",
                "email": "elena.rostova@workforce.local",
                "dept": "ENG",
                "role": "FE-ENG",
                "manager_code": "EMP-ENG-001",
                "doj": date(2023, 8, 15),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.OFFICE,
                "loc": "San Francisco, CA",
                "skills": [
                    ("SK-REACT", 4, 3.0, True),
                    ("SK-AGILE", 3, 2.0, False),
                    ("SK-COMM", 3, 1.5, False),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("84.00"),
                        4,
                        "Great UI component polish.",
                        "Contribute more in sprint planning.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-REACT-TS",
                        date(2025, 11, 1),
                        date(2025, 11, 28),
                        EnrollmentStatus.COMPLETED,
                        Decimal("90.00"),
                        True,
                        4,
                    ),
                ],
            },
            # Employee with Attrition / Flight Risk Profile (Declining review, high skill gap)
            {
                "code": "EMP-ENG-005",
                "first_name": "Marcus",
                "last_name": "Brody",
                "dob": date(1989, 5, 18),
                "gender": Gender.MALE,
                "phone": "+1-555-0105",
                "email": "marcus.brody@workforce.local",
                "dept": "ENG",
                "role": "SR-SWE",
                "manager_code": "EMP-ENG-001",
                "doj": date(2022, 1, 10),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.REMOTE,
                "loc": "Chicago, IL",
                "skills": [
                    ("SK-PY", 3, 3.0, False),
                    ("SK-SQL", 3, 2.0, False),
                ],  # High gaps in Python (3 vs req 4), SQL (3 vs req 4), Docker (0 vs req 3)
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("62.00"),
                        2,
                        "Struggling with deadlines and system complexity.",
                        "Urgent need for upskilling in microservice design.",
                    ),
                    (
                        ReviewCycle.ANNUAL,
                        "Annual 2025",
                        date(2025, 12, 15),
                        Decimal("74.00"),
                        3,
                        "Met basic targets.",
                        "Improve communication with squad leads.",
                    ),
                ],
                "enrollments": [],
            },
            # Product Management
            {
                "code": "EMP-PROD-001",
                "first_name": "Maya",
                "last_name": "Lin",
                "dob": date(1988, 9, 30),
                "gender": Gender.FEMALE,
                "phone": "+1-555-0201",
                "email": "maya.lin@workforce.local",
                "dept": "PROD",
                "role": "SR-PM",
                "manager_code": None,
                "doj": date(2021, 5, 20),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.HYBRID,
                "loc": "New York, NY",
                "skills": [
                    ("SK-PRODMG", 5, 6.0, True),
                    ("SK-BI", 4, 4.0, True),
                    ("SK-COMM", 5, 7.0, True),
                    ("SK-AGILE", 4, 5.0, True),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("94.00"),
                        5,
                        "Outstanding product roadmap execution.",
                        "Expand client co-design sessions.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-PROD-STRAT",
                        date(2025, 4, 1),
                        date(2025, 5, 10),
                        EnrollmentStatus.COMPLETED,
                        Decimal("96.00"),
                        True,
                        5,
                    ),
                ],
            },
            # HR Team
            {
                "code": "EMP-HR-001",
                "first_name": "Eleanor",
                "last_name": "Vance",
                "dob": date(1987, 12, 4),
                "gender": Gender.FEMALE,
                "phone": "+1-555-0301",
                "email": "eleanor.vance@workforce.local",
                "dept": "HR",
                "role": "HR-BP",
                "manager_code": None,
                "doj": date(2019, 11, 1),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.HYBRID,
                "loc": "San Francisco, CA",
                "skills": [
                    ("SK-TALENT", 5, 8.0, True),
                    ("SK-COMM", 5, 7.0, True),
                    ("SK-LEAD", 4, 5.0, False),
                    ("SK-BI", 3, 2.0, False),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("96.00"),
                        5,
                        "Key contributor to organizational culture.",
                        "Drive new predictive HR adoption.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-DATA-BI",
                        date(2026, 2, 1),
                        None,
                        EnrollmentStatus.IN_PROGRESS,
                        None,
                        False,
                        None,
                    ),
                ],
            },
            # Sales Team
            {
                "code": "EMP-SALES-001",
                "first_name": "Jordan",
                "last_name": "Belfort",
                "dob": date(1991, 7, 19),
                "gender": Gender.MALE,
                "phone": "+1-555-0401",
                "email": "jordan.belfort@workforce.local",
                "dept": "SALES",
                "role": "ENT-AE",
                "manager_code": None,
                "doj": date(2022, 4, 15),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.OFFICE,
                "loc": "New York, NY",
                "skills": [
                    ("SK-NEGOT", 5, 6.0, True),
                    ("SK-COMM", 5, 5.5, True),
                    ("SK-LEAD", 3, 2.0, False),
                ],
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("91.00"),
                        5,
                        "Exceeded Q1 quota by 120%.",
                        "Focus on recurring enterprise contracts.",
                    ),
                ],
                "enrollments": [],
            },
            # Marketing Team
            {
                "code": "EMP-MKT-001",
                "first_name": "Chloe",
                "last_name": "Kim",
                "dob": date(1994, 3, 11),
                "gender": Gender.FEMALE,
                "phone": "+1-555-0501",
                "email": "chloe.kim@workforce.local",
                "dept": "MKT",
                "role": "MKT-LEAD",
                "manager_code": None,
                "doj": date(2023, 1, 10),
                "status": EmploymentStatus.ACTIVE,
                "type": EmploymentType.FULL_TIME,
                "mode": WorkMode.REMOTE,
                "loc": "Seattle, WA",
                "skills": [
                    ("SK-SEO", 5, 4.0, True),
                    ("SK-BI", 3, 2.0, False),
                    ("SK-COMM", 4, 3.5, True),
                ],  # Gap in BI (3 vs 4)
                "reviews": [
                    (
                        ReviewCycle.QUARTERLY,
                        "Q1 2026",
                        date(2026, 3, 31),
                        Decimal("85.00"),
                        4,
                        "Strong organic traffic acquisition.",
                        "Refine multi-channel attribution modeling.",
                    ),
                ],
                "enrollments": [
                    (
                        "TR-DATA-BI",
                        date(2026, 1, 15),
                        None,
                        EnrollmentStatus.IN_PROGRESS,
                        None,
                        False,
                        None,
                    ),
                ],
            },
        ]

        emp_map = {}
        # First pass: Create employees
        for e_data in employees_data:
            dept = dept_map[e_data["dept"]]
            role = role_map[e_data["role"]]
            existing = db.query(Employee).filter(Employee.employee_code == e_data["code"]).first()

            if not existing:
                emp = Employee(
                    employee_code=e_data["code"],
                    first_name=e_data["first_name"],
                    last_name=e_data["last_name"],
                    date_of_birth=e_data["dob"],
                    gender=e_data["gender"],
                    phone_number=e_data["phone"],
                    official_email=e_data["email"],
                    department_id=dept.id,
                    job_role_id=role.id,
                    date_of_joining=e_data["doj"],
                    employment_status=e_data["status"],
                    employment_type=e_data["type"],
                    work_mode=e_data["mode"],
                    work_location=e_data["loc"],
                    is_deleted=False,
                )
                db.add(emp)
                db.flush()
                emp_map[e_data["code"]] = emp
            else:
                emp_map[e_data["code"]] = existing

        # Second pass: Assign manager references
        for e_data in employees_data:
            if e_data["manager_code"]:
                emp = emp_map[e_data["code"]]
                mgr = emp_map.get(e_data["manager_code"])
                if mgr:
                    emp.manager_id = mgr.id
        db.flush()

        # Third pass: Assign Skills, Performance Reviews, and Enrollments
        reviewer = user_map["admin"]
        for e_data in employees_data:
            emp = emp_map[e_data["code"]]

            # Skills
            for s_code, prof, exp, cert in e_data["skills"]:
                sk = skill_map[s_code]
                existing_skill = (
                    db.query(EmployeeSkill)
                    .filter(EmployeeSkill.employee_id == emp.id, EmployeeSkill.skill_id == sk.id)
                    .first()
                )
                if not existing_skill:
                    es = EmployeeSkill(
                        employee_id=emp.id,
                        skill_id=sk.id,
                        proficiency_level=prof,
                        years_of_experience=Decimal(str(exp)),
                        certification_status=cert,
                        last_assessed_date=date.today() - timedelta(days=60),
                    )
                    db.add(es)

            # Performance reviews
            for cycle, period, r_date, score, rating, strengths, areas in e_data["reviews"]:
                existing_rev = (
                    db.query(PerformanceReview)
                    .filter(
                        PerformanceReview.employee_id == emp.id,
                        PerformanceReview.review_period == period,
                    )
                    .first()
                )
                if not existing_rev:
                    pr = PerformanceReview(
                        employee_id=emp.id,
                        reviewer_id=reviewer.id,
                        review_cycle=cycle,
                        review_period=period,
                        review_date=r_date,
                        performance_score=score,
                        overall_rating=rating,
                        strengths=strengths,
                        improvement_areas=areas,
                        manager_comments=f"Conducted by {reviewer.display_name}",
                    )
                    db.add(pr)

            # Enrollments
            for c_code, en_date, comp_date, status, score, cert, feedback in e_data["enrollments"]:
                course = course_map[c_code]
                existing_en = (
                    db.query(TrainingEnrollment)
                    .filter(
                        TrainingEnrollment.employee_id == emp.id,
                        TrainingEnrollment.training_course_id == course.id,
                    )
                    .first()
                )
                if not existing_en:
                    en = TrainingEnrollment(
                        employee_id=emp.id,
                        training_course_id=course.id,
                        enrollment_date=en_date,
                        completion_date=comp_date,
                        enrollment_status=status,
                        completion_score=score,
                        certificate_issued=cert,
                        feedback_rating=feedback,
                    )
                    db.add(en)

        db.commit()
        print("[Seed] 7/7 Database Seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[Seed] Error during database seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
