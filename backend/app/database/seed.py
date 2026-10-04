"""
Deterministic development database seeder for Enterprise Workforce Predictive Analytics.

NOTE: This script seeds organizational structure, users, skills, employees,
reviews, and training courses, then scores every employee with the trained ML model
and generates recommendations so the app is fully populated on first launch.
Per project architecture, ML model training is decoupled and executed separately via ml/training/train.py.
"""

import os
import sys
from datetime import date, timedelta
from decimal import Decimal

# Add backend directory (for `app`) and repo root (for the sibling `ml` package) to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
repo_root = os.path.dirname(backend_dir)
for path in (backend_dir, repo_root):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.database import (
    DifficultyLevel,
    EmploymentStatus,
    EmploymentType,
    EnrollmentStatus,
    Gender,
    OvertimeFrequency,
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
    ModelRegistry,
    Notification,
    PerformanceReview,
    PredictionHistory,
    Recommendation,
    RoleSkill,
    Skill,
    TrainingCourse,
    TrainingEnrollment,
    TrainingSkill,
    User,
)
from app.security import hash_password

# Employee record owned by the demo EMPLOYEE login (demo@workforce.local)
DEMO_EMPLOYEE_CODE = "EMP-ENG-018"


def generate_50_employees():
    import random
    from datetime import date

    rng = random.Random(42)

    roles_by_dept = {
        "ENG": ["SR-SWE", "LEAD-SWE", "ML-ENG", "FE-ENG"],
        "PROD": ["SR-PM"],
        "MKT": ["MKT-LEAD"],
        "SALES": ["ENT-AE"],
        "HR": ["HR-BP"],
    }

    dept_targets = {"ENG": 22, "PROD": 8, "MKT": 8, "SALES": 7, "HR": 5}

    # Detemine OT, Emp Type, Work Mode arrays beforehand to ensure exact counts
    frequent_indices = [48, 49, 50, 43, 44, 45, 46]
    occasional_indices = [30, 31, 32, 33, 34, 35, 42, 47, 1, 3, 5, 7, 9, 11, 13]

    contract_indices = [10, 20, 30, 40, 50]
    parttime_indices = [15, 25, 35]

    office_indices = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
    remote_indices = [2, 4, 6, 8, 12, 14, 16, 18, 22, 24, 26, 28, 32, 34, 36, 38]

    first_names_male = [
        "James",
        "John",
        "Robert",
        "Michael",
        "William",
        "David",
        "Richard",
        "Joseph",
        "Thomas",
        "Charles",
        "Christopher",
        "Daniel",
        "Matthew",
        "Anthony",
        "Mark",
        "Donald",
        "Steven",
        "Paul",
        "Andrew",
        "Joshua",
        "Kenneth",
        "Kevin",
        "Brian",
        "George",
        "Edward",
    ]
    first_names_female = [
        "Mary",
        "Patricia",
        "Jennifer",
        "Linda",
        "Elizabeth",
        "Barbara",
        "Susan",
        "Jessica",
        "Sarah",
        "Karen",
        "Lisa",
        "Nancy",
        "Betty",
        "Sandra",
        "Margaret",
        "Ashley",
        "Kimberly",
        "Emily",
        "Donna",
        "Michelle",
        "Carol",
        "Amanda",
        "Dorothy",
        "Melissa",
        "Deborah",
    ]
    last_names = [
        "Smith",
        "Johnson",
        "Williams",
        "Brown",
        "Jones",
        "Garcia",
        "Miller",
        "Davis",
        "Rodriguez",
        "Martinez",
        "Hernandez",
        "Lopez",
        "Gonzalez",
        "Wilson",
        "Anderson",
        "Thomas",
        "Taylor",
        "Moore",
        "Jackson",
        "Martin",
        "Lee",
        "Perez",
        "Thompson",
        "White",
        "Harris",
        "Sanchez",
        "Clark",
        "Ramirez",
        "Lewis",
        "Robinson",
    ]

    employees = []
    managers_by_dept = {}
    emp_index = 1

    for dept_code, target_count in dept_targets.items():
        for i in range(target_count):
            code = f"EMP-{dept_code}-{i+1:03d}"

            gender = rng.choice([Gender.MALE, Gender.FEMALE])
            first_name = (
                rng.choice(first_names_male)
                if gender == Gender.MALE
                else rng.choice(first_names_female)
            )
            last_name = rng.choice(last_names)

            if dept_code == "ENG" and i == 0:
                role = "LEAD-SWE"
            else:
                role_options = roles_by_dept[dept_code]
                role = rng.choice(role_options)

            # Overtime frequency
            if emp_index in frequent_indices:
                ot = OvertimeFrequency.FREQUENT
            elif emp_index in occasional_indices:
                ot = OvertimeFrequency.OCCASIONAL
            else:
                ot = OvertimeFrequency.NONE

            # Employment Type
            if emp_index in contract_indices:
                emp_type = EmploymentType.CONTRACT
            elif emp_index in parttime_indices:
                emp_type = EmploymentType.PART_TIME
            else:
                emp_type = EmploymentType.FULL_TIME

            # Work Mode
            if emp_index in office_indices:
                mode = WorkMode.OFFICE
            elif emp_index in remote_indices:
                mode = WorkMode.REMOTE
            else:
                mode = WorkMode.HYBRID

            # Risk Tier mapping
            if emp_index in [48, 49, 50]:
                risk_tier = "CRITICAL"
            elif emp_index in [42, 43, 44, 45, 46, 47]:
                risk_tier = "HIGH"
            elif emp_index in [30, 31, 32, 33, 34, 35]:
                risk_tier = "MEDIUM"
            else:
                risk_tier = "LOW"

            if i == 0:
                manager_code = None
                managers_by_dept[dept_code] = code
            else:
                manager_code = managers_by_dept.get(dept_code)

            dob = date(rng.randint(1975, 2000), rng.randint(1, 12), rng.randint(1, 28))

            if risk_tier in ["CRITICAL", "HIGH"]:
                doj = date(
                    rng.choice([2021, 2022, 2023, 2024]), rng.randint(1, 12), rng.randint(1, 28)
                )
            else:
                doj = date(rng.randint(2015, 2023), rng.randint(1, 12), rng.randint(1, 28))

            skills = []
            reviews = []
            enrollments = []

            role_skills = {
                "SR-SWE": [
                    ("SK-PY", 4, True),
                    ("SK-SQL", 4, True),
                    ("SK-DOCKER", 3, True),
                    ("SK-CLOUD", 3, False),
                    ("SK-AGILE", 3, False),
                ],
                "LEAD-SWE": [
                    ("SK-PY", 5, True),
                    ("SK-CLOUD", 5, True),
                    ("SK-SQL", 5, True),
                    ("SK-LEAD", 4, True),
                    ("SK-SEC", 4, True),
                ],
                "ML-ENG": [
                    ("SK-PY", 5, True),
                    ("SK-ML", 5, True),
                    ("SK-SQL", 4, True),
                    ("SK-CLOUD", 4, False),
                ],
                "FE-ENG": [("SK-REACT", 4, True), ("SK-COMM", 3, False), ("SK-AGILE", 3, True)],
                "SR-PM": [
                    ("SK-PRODMG", 5, True),
                    ("SK-BI", 4, True),
                    ("SK-COMM", 5, True),
                    ("SK-AGILE", 4, True),
                ],
                "HR-BP": [
                    ("SK-TALENT", 4, True),
                    ("SK-COMM", 4, True),
                    ("SK-LEAD", 3, False),
                    ("SK-BI", 3, False),
                ],
                "ENT-AE": [("SK-NEGOT", 5, True), ("SK-COMM", 5, True), ("SK-LEAD", 3, False)],
                "MKT-LEAD": [("SK-SEO", 5, True), ("SK-BI", 4, True), ("SK-COMM", 4, True)],
            }

            r_skills = role_skills[role]

            # Gaps count setup
            if emp_index <= 15:
                # 0 gaps
                for s_code, req, mand in r_skills:
                    skills.append(
                        (s_code, req + rng.randint(0, 5 - req), rng.uniform(3.0, 8.0), True)
                    )
            elif emp_index <= 35:
                # 1-2 gaps
                target_gaps = 1 if emp_index <= 25 else 2
                gaps_count = 0
                for s_code, req, mand in r_skills:
                    if gaps_count < target_gaps:
                        skills.append((s_code, req - 1, rng.uniform(1.0, 4.0), False))
                        gaps_count += 1
                    else:
                        skills.append(
                            (s_code, req, rng.uniform(2.0, 6.0), rng.choice([True, False]))
                        )
            elif emp_index <= 45:
                # 3-4 gaps
                target_gaps = 3 if emp_index <= 40 else 4
                gaps_count = 0
                for s_code, req, mand in r_skills:
                    if gaps_count < target_gaps:
                        skills.append(
                            (s_code, rng.randint(1, req - 1), rng.uniform(0.5, 3.0), False)
                        )
                        gaps_count += 1
                    else:
                        skills.append(
                            (s_code, req, rng.uniform(2.0, 5.0), rng.choice([True, False]))
                        )
            else:
                # 5+ gaps
                for s_code, req, mand in r_skills:
                    skills.append((s_code, 1, rng.uniform(0.5, 2.0), False))

            # Reviews setup:
            num_revs = rng.randint(2, 3)
            if risk_tier == "CRITICAL":
                ratings = [4, 3, 2] if num_revs == 3 else [3, 2]
                scores = (
                    [Decimal("82.00"), Decimal("71.00"), Decimal("58.00")]
                    if num_revs == 3
                    else [Decimal("72.00"), Decimal("59.00")]
                )
            elif risk_tier == "HIGH":
                ratings = [4, 3, 3] if num_revs == 3 else [3, 2]
                scores = (
                    [Decimal("83.00"), Decimal("73.00"), Decimal("71.00")]
                    if num_revs == 3
                    else [Decimal("70.00"), Decimal("62.00")]
                )
            elif risk_tier == "LOW" and emp_index <= 6:
                ratings = [3, 4, 5] if num_revs == 3 else [4, 5]
                scores = (
                    [Decimal("74.00"), Decimal("86.00"), Decimal("95.00")]
                    if num_revs == 3
                    else [Decimal("85.00"), Decimal("96.00")]
                )
            elif risk_tier == "LOW" and emp_index > 6 and emp_index <= 12:
                ratings = [2, 3, 4] if num_revs == 3 else [3, 4]
                scores = (
                    [Decimal("60.00"), Decimal("74.00"), Decimal("85.00")]
                    if num_revs == 3
                    else [Decimal("75.00"), Decimal("86.00")]
                )
            elif risk_tier == "LOW":
                ratings = [5, 5, 5] if num_revs == 3 else [5, 5]
                scores = (
                    [Decimal("94.00"), Decimal("95.00"), Decimal("96.00")]
                    if num_revs == 3
                    else [Decimal("94.00"), Decimal("96.00")]
                )
            else:
                ratings = [3, 3, 3] if num_revs == 3 else [3, 3]
                scores = (
                    [Decimal("75.00"), Decimal("76.00"), Decimal("77.00")]
                    if num_revs == 3
                    else [Decimal("75.00"), Decimal("76.00")]
                )

            for j in range(num_revs):
                cycle = ReviewCycle.QUARTERLY if j < 2 else ReviewCycle.ANNUAL
                period = f"Q{j+1} 2025" if cycle == ReviewCycle.QUARTERLY else "Annual 2025"
                rev_date = (
                    date(2025, 3 + j * 3, 28)
                    if cycle == ReviewCycle.QUARTERLY
                    else date(2025, 12, 15)
                )
                reviews.append(
                    (
                        cycle,
                        period,
                        rev_date,
                        scores[j],
                        ratings[j],
                        "Consistent output and technical focus.",
                        "Keep driving team objectives and training.",
                    )
                )

            # Training enrollments setup:
            has_training = True
            if risk_tier in ["CRITICAL", "HIGH"]:
                has_training = False
            elif risk_tier == "MEDIUM" and emp_index == 30:
                has_training = False

            if has_training:
                course_by_skill = {
                    "SK-PY": "TR-PY-ADV",
                    "SK-CLOUD": "TR-GCP-ARCH",
                    "SK-ML": "TR-MLOPS",
                    "SK-REACT": "TR-REACT-TS",
                    "SK-BI": "TR-DATA-BI",
                    "SK-LEAD": "TR-EXEC-LEAD",
                    "SK-SEC": "TR-SEC-IAM",
                    "SK-PRODMG": "TR-PROD-STRAT",
                }

                target_skill = r_skills[0][0]
                course_code = course_by_skill.get(target_skill, "TR-PY-ADV")

                if risk_tier == "LOW":
                    enrollments.append(
                        (
                            course_code,
                            date(2025, 5, 10),
                            date(2025, 6, 20),
                            EnrollmentStatus.COMPLETED,
                            Decimal("92.00"),
                            True,
                            5,
                        )
                    )
                else:  # MEDIUM
                    enrollments.append(
                        (
                            course_code,
                            date(2025, 8, 1),
                            None,
                            EnrollmentStatus.IN_PROGRESS,
                            None,
                            False,
                            None,
                        )
                    )

            employees.append(
                {
                    "code": code,
                    "first_name": first_name,
                    "last_name": last_name,
                    "dob": dob,
                    "gender": gender,
                    "phone": f"+1-555-0{emp_index:03d}",
                    "email": f"{first_name.lower()}.{last_name.lower()}{emp_index}@workforce.local",
                    "dept": dept_code,
                    "role": role,
                    "manager_code": manager_code,
                    "doj": doj,
                    "status": EmploymentStatus.ACTIVE,
                    "type": emp_type,
                    "mode": mode,
                    "loc": "San Francisco, CA" if dept_code != "SALES" else "New York, NY",
                    "overtime_frequency": ot,
                    "skills": skills,
                    "reviews": reviews,
                    "enrollments": enrollments,
                }
            )
            emp_index += 1

    return employees


def seed_database():
    print("[Seed] Starting deterministic database seeding...")
    db = SessionLocal()

    try:
        # Clear child and employee-related tables safely to prevent duplicates and remove test contamination
        print("[Seed] Safely resetting employee and predictive analytics tables...")
        db.query(Recommendation).delete()
        db.query(PredictionHistory).delete()
        # Registry is re-populated from the trained artifact on the first prediction below
        db.query(ModelRegistry).delete()
        db.query(Notification).delete()
        db.query(PerformanceReview).delete()
        db.query(TrainingEnrollment).delete()
        db.query(EmployeeSkill).delete()
        db.query(Employee).delete()
        db.commit()

        # 1. Seed Demo Users
        print("[Seed] 1/7 Seeding Users...")
        default_pwd_hash = hash_password("demo1234")

        users_data = [
            {
                "username": "admin",
                "email": "admin@workforce.local",
                "display_name": "Eleanor Vance",
                "role": UserRole.HR_ADMIN,
                "password_hash": default_pwd_hash,
                "is_active": True,
            },
            {
                "username": "user",
                "email": "user@workforce.local",
                "display_name": "Marcus Thorne",
                "role": UserRole.HR_MANAGER,
                "password_hash": default_pwd_hash,
                "is_active": True,
            },
            {
                "username": "demo",
                "email": "demo@workforce.local",
                # Linked to employee DEMO_EMPLOYEE_CODE below for the self-service view
                "display_name": "Sarah Johnson",
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
                existing.display_name = u_data["display_name"]
                existing.password_hash = default_pwd_hash
                existing.role = u_data["role"]
                existing.is_active = True
                existing.failed_login_attempts = 0
                existing.locked_until = None
                db.flush()
                user_map[u_data["username"]] = existing

        # 2. Seed Departments
        print("[Seed] 2/7 Seeding Departments...")
        departments_data = [
            {
                "department_code": "ENG",
                "name": "Engineering",
                "description": "Software architecture, cloud infrastructure, and product development.",
                "hr_manager_user_id": user_map["user"].id,
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
                "hr_manager_user_id": user_map["user"].id,
            },
            {
                "department_code": "SALES",
                "name": "Enterprise Sales",
                "description": "Commercial client relations, enterprise partnerships, and revenue generation.",
                "hr_manager_user_id": user_map["user"].id,
            },
            {
                "department_code": "MKT",
                "name": "Growth & Marketing",
                "description": "Brand strategy, performance marketing, and market analytics.",
                "hr_manager_user_id": user_map["user"].id,
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
        employees_data = generate_50_employees()

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
                    overtime_frequency=e_data["overtime_frequency"],
                    is_deleted=False,
                )
                db.add(emp)
                db.flush()
                emp_map[e_data["code"]] = emp
            else:
                existing.overtime_frequency = e_data["overtime_frequency"]
                db.flush()
                emp_map[e_data["code"]] = existing

        # Second pass: Assign manager references
        for e_data in employees_data:
            if e_data["manager_code"]:
                emp = emp_map[e_data["code"]]
                mgr = emp_map.get(e_data["manager_code"])
                if mgr:
                    emp.manager_id = mgr.id

        # Link the demo EMPLOYEE account to its employee record (self-service access)
        emp_map[DEMO_EMPLOYEE_CODE].user_id = user_map["demo"].id
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

        # Imported here: the services import app.database, which this module is part of
        from app.services.prediction_service import PredictionService
        from app.services.recommendation_service import RecommendationService

        print("[Seed] 7/7 Running ML risk predictions & generating recommendations...")
        predictions = PredictionService().predict_all_employees(db)
        at_risk = sum(1 for p in predictions if p.risk_level.value in ("HIGH", "CRITICAL"))
        created_recs = RecommendationService().generate_recommendations_for_all(db)
        print(
            f"[Seed]   {len(predictions)} employees scored ({at_risk} high/critical risk), "
            f"{created_recs} recommendations created."
        )
        print("[Seed] Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[Seed] Error during database seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
