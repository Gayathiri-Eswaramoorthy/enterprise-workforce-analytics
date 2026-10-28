"""
End-to-End Workflow Integration Test:
Traces the complete workforce analytics lifecycle:
1. Recommendation inspection by HR Manager.
2. Creation of a Retention Intervention linked to employee and recommendation.
3. Intervention status updates (OFFERED -> ACCEPTED -> IN_PROGRESS).
4. Employee self-service learning progression (Open Resource -> Mark Complete).
5. Certification quiz submission and server-side evaluation.
6. Automatic course completion gate verification.
7. HR Manager documentation of factual follow-up retention outcome.
8. Querying and verifying persistent outcomes across APIs.
"""

from datetime import date

from app.database import (
    EnrollmentStatus,
    RecommendationStatus,
)
from app.models import (
    CourseQuiz,
    LessonCompletion,
    QuizAttempt,
    QuizQuestion,
    Recommendation,
    TrainingCourse,
    TrainingEnrollment,
    User,
)
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session


def test_complete_recommendation_to_outcome_workflow(
    client: TestClient,
    manager_headers: dict,
    employee_headers: dict,
    db_session: Session,
):
    # -------------------------------------------------------------------------
    # 1. Identity & Setup: Retrieve demo employee Sarah Johnson
    # -------------------------------------------------------------------------
    emp_user = db_session.scalars(select(User).where(User.username == "demo")).first()
    assert emp_user is not None and emp_user.employee_profile is not None
    demo_emp = emp_user.employee_profile
    emp_id = str(demo_emp.id)

    # -------------------------------------------------------------------------
    # 2. Recommendation: HR Manager inspects or seeds a pending recommendation
    # -------------------------------------------------------------------------
    rec = db_session.scalars(
        select(Recommendation)
        .where(Recommendation.employee_id == demo_emp.id)
        .where(Recommendation.status == RecommendationStatus.PENDING)
    ).first()

    if not rec:
        rec = Recommendation(
            employee_id=demo_emp.id,
            recommendation_type="RETENTION",
            priority="HIGH",
            status=RecommendationStatus.PENDING,
            title="Proactive Retention Mentoring & Upskilling",
            description="Discuss workload balance and provide technical growth coursework.",
        )
        db_session.add(rec)
        db_session.commit()
        db_session.refresh(rec)

    rec_id = str(rec.id)

    # HR Manager retrieves the recommendation via API
    recs_resp = client.get(f"/api/v1/recommendations?employee_id={emp_id}", headers=manager_headers)
    assert recs_resp.status_code == 200
    rec_items = recs_resp.json().get("items", [])
    assert any(r["id"] == rec_id for r in rec_items)

    # -------------------------------------------------------------------------
    # 3. Intervention Creation: HR Manager initiates proactive intervention
    # -------------------------------------------------------------------------
    intervention_payload = {
        "employee_id": emp_id,
        "recommendation_id": rec_id,
        "intervention_type": "Career & Learning Development",
        "concern_summary": "Offered flexible project assignment and sponsored certification curriculum.",
        "status": "OFFERED",
        "notes": "Discussed during quarterly 1-on-1 check-in.",
    }

    create_int_resp = client.post(
        "/api/v1/retention/interventions",
        headers=manager_headers,
        json=intervention_payload,
    )
    assert create_int_resp.status_code == 201
    int_data = create_int_resp.json()
    intervention_id = int_data["id"]
    assert int_data["employee_id"] == emp_id
    assert int_data["recommendation_id"] == rec_id
    assert int_data["status"] == "OFFERED"

    # -------------------------------------------------------------------------
    # 4. Status Update: Employee accepts, HR updates status to ACCEPTED
    # -------------------------------------------------------------------------
    update_int_resp = client.put(
        f"/api/v1/retention/interventions/{intervention_id}",
        headers=manager_headers,
        json={
            "status": "ACCEPTED",
            "notes": "Employee accepted learning track and commenced coursework.",
        },
    )
    assert update_int_resp.status_code == 200
    assert update_int_resp.json()["status"] == "ACCEPTED"

    # -------------------------------------------------------------------------
    # 5. Learning Track: Employee accesses enrolled course
    # -------------------------------------------------------------------------
    # Use SQL Fundamentals course
    course = db_session.scalars(
        select(TrainingCourse).where(TrainingCourse.course_code == "TR-SQL-FUND")
    ).first()
    assert course is not None
    course_id = str(course.id)

    enrollment = db_session.scalars(
        select(TrainingEnrollment)
        .where(TrainingEnrollment.employee_id == demo_emp.id)
        .where(TrainingEnrollment.training_course_id == course.id)
    ).first()

    if not enrollment:
        enrollment = TrainingEnrollment(
            employee_id=demo_emp.id,
            training_course_id=course.id,
            enrollment_status=EnrollmentStatus.IN_PROGRESS,
            enrollment_date=date.today(),
        )
        db_session.add(enrollment)
        db_session.commit()
    else:
        enrollment.enrollment_status = EnrollmentStatus.IN_PROGRESS
        enrollment.completion_date = None
        enrollment.certificate_issued = False
        db_session.commit()

    # Reset previous progress for isolated test
    db_session.query(LessonCompletion).filter(
        LessonCompletion.enrollment_id == enrollment.id
    ).delete()
    db_session.query(QuizAttempt).filter(QuizAttempt.enrollment_id == enrollment.id).delete()
    db_session.commit()

    # -------------------------------------------------------------------------
    # 6. Resource Opened Tracking: Employee opens external learning resource
    # -------------------------------------------------------------------------
    lessons_resp = client.get(
        f"/api/v1/learning/courses/{course_id}/lessons", headers=employee_headers
    )
    assert lessons_resp.status_code == 200
    lessons = lessons_resp.json()
    assert len(lessons) > 0

    first_lesson_id = lessons[0]["id"]
    open_resp = client.post(
        f"/api/v1/learning/lessons/{first_lesson_id}/open", headers=employee_headers
    )
    assert open_resp.status_code == 200
    open_json = open_resp.json()
    assert open_json["resource_opened"] is True

    # -------------------------------------------------------------------------
    # 7. Lessons Completion: Employee completes all required lessons
    # -------------------------------------------------------------------------
    for lesson in lessons:
        comp_resp = client.post(
            f"/api/v1/learning/lessons/{lesson['id']}/complete",
            headers=employee_headers,
        )
        assert comp_resp.status_code == 200

    # -------------------------------------------------------------------------
    # 8. Quiz Certification: Employee passes the certification quiz
    # -------------------------------------------------------------------------
    quiz = db_session.scalars(select(CourseQuiz).where(CourseQuiz.course_id == course.id)).first()
    assert quiz is not None

    questions = db_session.scalars(
        select(QuizQuestion)
        .where(QuizQuestion.quiz_id == quiz.id)
        .order_by(QuizQuestion.order_index.asc())
    ).all()
    assert len(questions) > 0

    answers = []
    for q in questions:
        correct_opt = next(o for o in q.options if o.is_correct)
        answers.append({"question_id": str(q.id), "selected_option_id": str(correct_opt.id)})

    quiz_resp = client.post(
        f"/api/v1/learning/courses/{course_id}/quiz/submit",
        headers=employee_headers,
        json={"answers": answers},
    )
    assert quiz_resp.status_code == 200
    quiz_res = quiz_resp.json()
    assert quiz_res["passed"] is True
    assert float(quiz_res["score"]) >= 70.0

    # Course completion gate: Enrollment is now COMPLETED
    db_session.refresh(enrollment)
    assert enrollment.enrollment_status == EnrollmentStatus.COMPLETED
    assert enrollment.completion_date is not None

    # -------------------------------------------------------------------------
    # 9. Outcome Follow-up: HR Manager documents documented retention outcome
    # -------------------------------------------------------------------------
    final_int_resp = client.put(
        f"/api/v1/retention/interventions/{intervention_id}",
        headers=manager_headers,
        json={
            "status": "COMPLETED",
            "completed_date": date.today().isoformat(),
            "retention_outcome": "EMPLOYED",
            "follow_up_date": date.today().isoformat(),
            "outcome_recorded_date": date.today().isoformat(),
            "outcome_notes": "Retained after learning milestone.",
            "notes": "Employee completed SQL certification, demonstrated high engagement, and reached 6-month retention milestone.",
        },
    )
    assert final_int_resp.status_code == 200
    final_data = final_int_resp.json()
    assert final_data["status"] == "COMPLETED"
    assert final_data["retention_outcome"] == "EMPLOYED"

    # -------------------------------------------------------------------------
    # 10. Verification: Query outcome reports
    # -------------------------------------------------------------------------
    outcome_list_resp = client.get(
        "/api/v1/retention/interventions?outcome=EMPLOYED",
        headers=manager_headers,
    )
    assert outcome_list_resp.status_code == 200
    outcomes = outcome_list_resp.json()
    assert any(item["id"] == intervention_id for item in outcomes)
