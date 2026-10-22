/**
 * TypeScript Data Models & API Interfaces for Enterprise Workforce Analytics
 */

export type UserRole = "HR_ADMIN" | "HR_MANAGER" | "EMPLOYEE";

export type EmploymentStatus = "ACTIVE" | "ON_LEAVE" | "TERMINATED" | "RESIGNED";
export type EmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "INTERN";
export type WorkMode = "OFFICE" | "REMOTE" | "HYBRID";
export type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PredictionType = "ATTRITION" | "FLIGHT_RISK" | "PROMOTION_READINESS" | "PERFORMANCE_DROP";
export type GapSeverity = "NONE" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RecommendationType = "RETENTION" | "TRAINING" | "PROMOTION" | "SKILL_DEVELOPMENT";
export type RecommendationStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "COMPLETED";
export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DifficultyLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
export type TrainingMode = "ONLINE" | "CLASSROOM" | "HYBRID" | "SELF_PACED";
export type EnrollmentStatus = "ENROLLED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "DROPPED";
export type ReviewCycle = "ANNUAL" | "SEMI_ANNUAL" | "QUARTERLY" | "MONTHLY" | "PROBATION";

export interface User {
  id: string;
  username: string;
  email: string;
  display_name?: string;
  role: UserRole;
  is_active: boolean;
  last_login?: string;
  /** Employee record owned by this login (self-service), if any */
  employee_id?: string | null;
}

export interface Department {
  id: string;
  department_code: string;
  name: string;
  description?: string;
  hr_manager_user_id?: string;
  is_active?: boolean;
  employee_count?: number | null;
  job_roles_count?: number | null;
  created_at: string;
  updated_at: string;
}

export interface JobRole {
  id: string;
  department_id: string;
  title: string;
  grade_level: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  role_skills?: RoleSkill[];
}

export interface RoleSkill {
  id: string;
  job_role_id: string;
  skill_id: string;
  required_proficiency: number;
  mandatory: boolean;
  skill?: Skill;
}

export interface Skill {
  id: string;
  skill_code: string;
  name: string;
  skill_category: string;
  description?: string | null;
  display_order: number;
  is_active?: boolean;
  created_at: string;
}

export interface EmployeeSkill {
  id: string;
  employee_id: string;
  skill_id: string;
  proficiency_level: number;
  years_of_experience: number;
  certification_status: boolean;
  last_assessed_date?: string;
  skill?: Skill;
}

export interface EmployeeListItem {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  official_email: string;
  phone_number: string;
  department_id: string;
  department_name?: string;
  job_role_id: string;
  job_role_title?: string;
  employment_status: EmploymentStatus;
  employment_type: EmploymentType;
  work_mode: WorkMode;
  work_location: string;
  overtime_frequency: string;
  date_of_joining: string;
  profile_photo_url?: string;
  manager_id?: string;
  manager_name?: string;
  latest_risk_level?: RiskLevel;
  latest_risk_score?: number;
  latest_prediction_reason?: string | null;
  open_recommendations_count?: number;
  is_deleted: boolean;
}

export interface EmployeeDetail {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  phone_number: string;
  alternate_phone?: string;
  personal_email?: string;
  official_email: string;
  department_id: string;
  job_role_id: string;
  manager_id?: string;
  date_of_joining: string;
  employment_status: EmploymentStatus;
  employment_type: EmploymentType;
  work_mode: WorkMode;
  work_location: string;
  overtime_frequency: string;
  profile_photo_url?: string;
  is_deleted: boolean;
  department?: Department;
  job_role?: JobRole;
  manager?: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    official_email: string;
  };
  subordinates?: Array<{
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    official_email: string;
  }>;
  employee_skills?: EmployeeSkill[];
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  reviewer_id: string;
  review_cycle: ReviewCycle;
  review_period: string;
  review_date: string;
  performance_score: number;
  overall_rating: number;
  strengths?: string;
  improvement_areas?: string;
  manager_comments?: string;
  created_at: string;
}

export interface PerformanceTrendSummary {
  employee_id: string;
  total_reviews: number;
  latest_rating?: number | null;
  latest_score?: number | null;
  average_rating?: number | null;
  average_score?: number | null;
  rating_change?: number | null;
  trend: "IMPROVING" | "STABLE" | "DECLINING";
  recent_reviews: PerformanceReview[];
}

export interface TrainingCourse {
  id: string;
  course_code: string;
  title: string;
  description?: string;
  provider?: string;
  duration_hours: number;
  difficulty_level: DifficultyLevel;
  training_mode: TrainingMode;
  is_active: boolean;
  created_at: string;
  enrolled_count?: number | null;
  completed_count?: number | null;
  lessons_count?: number | null;
  training_skills?: Array<{
    id: string;
    skill_id: string;
    skill?: Skill;
  }>;
}

export interface TrainingEnrollment {
  id: string;
  employee_id: string;
  training_course_id: string;
  enrollment_date: string;
  completion_date?: string;
  enrollment_status: EnrollmentStatus;
  completion_score?: number;
  certificate_issued: boolean;
  feedback_rating?: number;
  created_at: string;
  employee_name?: string;
  employee_code?: string;
  course?: TrainingCourse;
}

export interface SkillGapItem {
  skill_id: string;
  skill_code: string;
  skill_name: string;
  skill_category: string;
  required_proficiency: number;
  current_proficiency: number;
  gap: number;
  is_mandatory: boolean;
  severity: GapSeverity;
}

export interface EmployeeSkillGapReport {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  job_role_id?: string;
  job_role_title?: string;
  department_name?: string;
  total_required_skills: number;
  skills_with_gap: number;
  critical_gaps_count: number;
  overall_skill_match_percentage: number;
  gaps: SkillGapItem[];
}

export interface ModelRegistryEntry {
  id: string;
  model_name: string;
  model_version: string;
  algorithm: string;
  training_dataset: string;
  accuracy: string;
  precision_score: string;
  recall_score: string;
  f1_score: string;
  is_active: boolean;
  deployed_at?: string | null;
  created_at: string;
}

export interface ContributingFactor {
  factor: string;
  impact: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  description: string;
}

export interface PredictionResult {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  model_version: string;
  algorithm: string;
  prediction_type: PredictionType;
  prediction_score: number;
  confidence_score?: number | null;
  risk_level: RiskLevel;
  prediction_result: string;
  prediction_reason?: string | null;
  contributing_factors: ContributingFactor[];
  generated_at: string;
}

/** Stored prediction log row (no factor breakdown - that is only returned by a live run) */
export interface PredictionHistoryItem {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  model_version?: string;
  prediction_type: PredictionType;
  prediction_score: number | string;
  confidence_score?: number | string | null;
  risk_level: RiskLevel;
  prediction_result: string;
  prediction_reason?: string | null;
  generated_at: string;
}

export interface Recommendation {
  id: string;
  employee_id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  priority: PriorityLevel;
  action_plan?: string;
  recommended_course_id?: string;
  status: RecommendationStatus;
  generated_at: string;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  job_role_title?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  entity_name: string;
  entity_id?: string;
  action: string;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: {
    username: string;
    email: string;
    display_name?: string;
  };
}

export interface DashboardMetrics {
  total_employees: number;
  active_employees: number;
  high_risk_employees_count: number;
  average_performance_score: number;
  total_skill_gaps_count: number;
  critical_skill_gaps_count: number;
  pending_recommendations_count: number;
  training_completion_rate: number;
  total_training_courses: number;
  active_enrollments: number;
  department_distribution: Array<{
    department_id: string;
    name: string;
    code: string;
    headcount: number;
  }>;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  performance_trends: Array<{
    period: string;
    average_score: number;
    review_count: number;
  }>;
  top_skill_gaps: Array<{
    skill_id: string;
    skill_code: string;
    skill_name: string;
    affected_employees_count: number;
    avg_proficiency_gap: number;
    mandatory_gaps_count: number;
  }>;
}

export type AssessmentType = "BASELINE" | "POST_TRAINING";
export type InterventionStatus = "OFFERED" | "ACCEPTED" | "DECLINED" | "COMPLETED";
export type RetentionOutcome = "EMPLOYED" | "DEPARTED" | "PENDING";

export type ResourceType = "VIDEO" | "COURSE" | "ARTICLE" | "DOCUMENTATION";
export type AccessType = "FREE" | "PAID" | "ACCOUNT_REQUIRED";

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  content: string;
  description?: string | null;
  provider: string;
  skill_covered?: string | null;
  resource_type: ResourceType;
  access_type: AccessType;
  order_index: number;
  is_required: boolean;
  estimated_minutes: number;
  external_url?: string | null;
  is_active: boolean;
  resource_opened: boolean;
  opened_at?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
}

export interface QuizOption {
  id: string;
  option_text: string;
  order_index: number;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  order_index: number;
  options: QuizOption[];
}

export interface CourseQuiz {
  id?: string | null;
  course_id: string;
  title: string;
  description?: string | null;
  passing_score: number;
  max_attempts: number;
  questions_count: number;
  user_attempts_count: number;
  user_best_score?: number | null;
  user_has_passed: boolean;
  can_attempt: boolean;
  quiz_available: boolean;
  message?: string | null;
  questions: QuizQuestion[];
}

export interface QuizQuestionResult {
  question_id: string;
  question_text: string;
  selected_option_id: string;
  correct_option_id: string;
  is_correct: boolean;
  explanation?: string | null;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  enrollment_id: string;
  employee_id: string;
  attempt_number: number;
  score: number;
  passed: boolean;
  attempted_at: string;
  breakdown?: QuizQuestionResult[];
  course_completed: boolean;
}

export interface MyCourseProgress {
  enrollment_id: string;
  course_id: string;
  course_code: string;
  title: string;
  description?: string | null;
  provider: string;
  duration_hours: number;
  difficulty_level: DifficultyLevel;
  training_mode: TrainingMode;
  enrollment_date: string;
  completion_date?: string | null;
  enrollment_status: EnrollmentStatus;
  total_lessons: number;
  completed_lessons: number;
  progress_percentage: number;
  quiz_available: boolean;
  quiz_passed: boolean;
  quiz_score?: number | null;
  can_complete: boolean;
  target_skills: string[];
}

export interface SkillAssessmentResponse {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  skill_id: string;
  skill_name?: string | null;
  skill_category?: string | null;
  training_course_id?: string | null;
  course_title?: string | null;
  assessment_type: AssessmentType;
  score: number;
  assessed_proficiency?: number | null;
  assessment_date: string;
  evaluator_name?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface SkillAssessmentComparison {
  employee_id?: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  skill_id: string;
  skill_name: string;
  skill_category: string;
  course_id?: string | null;
  course_title?: string | null;
  baseline_score?: number | null;
  baseline_date?: string | null;
  post_score?: number | null;
  post_date?: string | null;
  score_delta?: number | null;
  score_change?: number | null;
  current_proficiency?: number | null;
  reassessed_proficiency?: number | null;
  required_proficiency?: number | null;
  role_required_proficiency?: number | null;
  remaining_skill_gap?: number | null;
  is_improved: boolean;
}

export interface RetentionIntervention {
  id: string;
  recommendation_id?: string | null;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  job_title?: string;
  hr_user_id: string;
  hr_user_name?: string;
  concern_summary: string;
  intervention_type: string;
  status: InterventionStatus;
  offered_date: string;
  completed_date?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  retention_outcome: RetentionOutcome;
  outcome_recorded_date?: string | null;
  outcome_notes?: string | null;
  intervention_effectiveness?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  job_title?: string;
  request_type: string;
  topic: string;
  notes?: string | null;
  status: string;
  reviewed_by_id?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  response_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HRLearningCourseSummary {
  course_id: string;
  course_code: string;
  title: string;
  enrolled_count: number;
  not_started_count: number;
  in_progress_count: number;
  completed_count: number;
  overdue_count: number;
  avg_progress_percentage: number;
  quiz_pass_rate: number;
  target_skills: string[];
}

export interface HRLearningEnrollmentDetail {
  enrollment_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  department_name: string;
  course_id: string;
  course_title: string;
  enrollment_date: string;
  completion_date?: string | null;
  enrollment_status: EnrollmentStatus;
  completed_lessons: number;
  total_lessons: number;
  progress_percentage: number;
  latest_quiz_score?: number | null;
  quiz_passed: boolean;
  needs_support: boolean;
  support_reason?: string | null;
}

export interface HRLearningDashboardData {
  total_courses: number;
  total_enrollments: number;
  needs_support_count: number;
  course_summaries: HRLearningCourseSummary[];
  enrollments: HRLearningEnrollmentDetail[];
}
