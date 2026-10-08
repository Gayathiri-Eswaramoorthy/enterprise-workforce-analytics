# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **HR admins and HR managers** (primary). They open the tool during the working day to see who is
  likely to leave, understand why, and act: accept or reject retention and training actions,
  re-score the workforce, and review skills coverage across departments. HR admins additionally
  review the audit log.
- **Employees** (secondary). They sign in to a self-service view of their own skill profile
  against their role's requirements, enroll in courses that close their gaps, and read their own
  performance reviews. They never see attrition risk or anyone else's data.
- **Presentation audience.** The project (an S7 college project) is evaluated by professional
  designers, so craft and finish are judged as closely as function.

## Product Purpose

Workforce Analytics predicts employee attrition risk with a trained ML model, explains the drivers
behind each score, maps every employee's skills against their role's requirements, and turns both
into concrete retention and training actions HR can accept, reject, or complete. Success: HR can
see who needs attention and act on it in one sitting, and an employee can see exactly which course
closes their gap.

## Positioning

One loop instead of three tools: the same screen connects a person's predicted attrition risk,
the skill gaps and performance trend that drive it, and the specific course or retention action
that addresses it.

## Operating Context

- Desktop browser during office hours is the main scene; phones must work for quick checks.
- HR works through lists of people sorted by risk, then drills into an individual profile.
- Batch re-scoring and recommendation generation are on-demand actions; HR is alerted when someone
  newly escalates to high or critical risk.

## Capabilities and Constraints

- Roles: HR_ADMIN, HR_MANAGER, EMPLOYEE, with strict data scoping (employees see only their own
  records; org-wide data is HR-only).
- Risk levels: Low, Medium, High, Critical (score 0–100%). Model: Random Forest, v1.1.0, 84.1%
  held-out test accuracy, trained on a 5,000-row synthetic dataset.
- Stack: React 19 + Vite + TypeScript + Tailwind CSS 3 + Recharts frontend; FastAPI + PostgreSQL
  backend.
- Terminology in the UI: "attrition risk", "skill gap", "action" (a recommendation), "re-score".

## Brand Commitments

- Product name in the UI: **Workforce Analytics**.
- The login page keeps one-click demo logins for the Admin, Manager, and Employee accounts.

## Evidence on Hand

- Seeded demo data: 50 employees across Engineering, Product & Design, Growth & Marketing,
  Enterprise Sales, and Human Resources; 15 skills; 8 training courses; performance reviews;
  model predictions and generated recommendations (`backend/app/database/seed.py`).
- Real model evaluation metrics in `ml/artifacts/model_metadata.joblib`.
- No customers, testimonials, or benchmarks exist; none may be invented.

## Product Principles

1. Lead with who needs attention, not with vanity totals.
2. Every risk score is explained; a number without its drivers is not shown alone.
3. Every insight offers its next action in place.
4. Privacy by role: attrition risk is HR-only, always.
