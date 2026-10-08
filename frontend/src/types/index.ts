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
