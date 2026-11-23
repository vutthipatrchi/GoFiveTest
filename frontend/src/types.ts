export type Role = "hr" | "manager" | "employee";
export type Status = "employee" | "approval" | "manager" | "returned" | "hr" | "decided" | "published";
export type Team = "Operations" | "People" | "Finance";
export type ManagerId = Team | `${Team}-2`;

export interface GoalUpdate {
  actual: number;
  period: string;
  evidence: string;
  recordedOn?: string;
  note?: string;
}

export interface GoalDefinition {
  name: string;
  unit: string;
  weight: number;
  target: number;
  direction?: "lower";
  cutoffs?: number[];
  responsibility?: string;
  source?: "manual" | "work-delivery";
  /** "team" when the KPI comes from the team plan and is shared by every member. */
  scope?: "team";
}

export interface Goal extends GoalDefinition {
  actual: number;
  unmeasured?: boolean;
  evidence?: string;
  period?: string;
  updates?: GoalUpdate[];
  workSource?: WorkSource;
}

export interface KpiTemplate {
  id: string;
  title: string;
  version: number;
  goals: GoalDefinition[];
}

/** Saved by rounds created before templates became a shared library. */
export interface LegacyRoleKpiTemplate extends Omit<KpiTemplate, "id"> {
  team: Team;
}

export interface GoalTemplateReference {
  title: string;
  version: number;
  adjustmentReason?: string;
}

export interface GoalAssignment {
  goals: GoalDefinition[];
  assignedOn: string;
  assignedBy: string;
  template?: GoalTemplateReference;
}

export interface WorkAttempt {
  submittedAt: string;
  evidence: string;
  review?: { decision: "approved" | "changes"; at: string; notes: string };
}

export interface WorkItem {
  title: string;
  standard: string;
  dueAt: string;
  attempts: WorkAttempt[];
  demo?: boolean;
}

export interface WorkSource {
  from: string;
  asOf: string;
  records: WorkItem[];
}

export interface Review {
  rating: number;
  feedback: string;
  next: string;
}

export interface Decision {
  level?: number;
  proposed?: number;
  reason: string;
  next?: string;
  followUp?: string;
  kpi?: string;
  fit?: string;
  secondReviewAt?: string;
  calibrationId?: string;
}

export type FeedbackRatings = [number, number, number];

export interface ManagerFeedback {
  self?: FeedbackRatings;
  teamTotals: FeedbackRatings;
  respondedIds: string[];
}

export interface SecondReview {
  reviewer: string;
  rating: number;
  evidence: string;
  at: string;
}

export interface CalibrationKpi {
  goal: Goal;
  level: number | null;
  cited: boolean;
}

export interface CalibrationRecord {
  id: string;
  at: string;
  reviewer: string;
  cohort: string;
  previousLevel?: number;
  proposed: { overall: number; level: number };
  finalLevel: number;
  reason: string;
  resultWeight: number;
  workScore: number;
  manager: { name: string; rating: number; feedback: string; cited: boolean };
  secondReview?: SecondReview & { cited: boolean };
  kpis: CalibrationKpi[];
  template?: GoalTemplateReference;
}

export type AppealGround = "data" | "evidence" | "criteria" | "circumstance" | "fairness";

export interface Appeal {
  reason: string;
  /** The reviewer's answer. A saved response closes the appeal. */
  response?: string;
  ground?: AppealGround;
  evidence?: string;
  discussedWithManager?: boolean;
  submittedOn?: string;
  /** The manager sees only HR's question, never the employee's reason. */
  clarification?: { question: string; requestedOn: string; response?: string; respondedOn?: string };
  outcome?: "kept" | "raised";
  reviewer?: string;
  resolvedOn?: string;
  previousLevel?: number;
  finalLevel?: number;
}

export interface Person {
  kpiIssues?: { goalName: string; detail: string; reportedOn: string; response?: string; reviewedOn?: string }[];
  id: string;
  name: string;
  initials: string;
  title: string;
  team: Team;
  managerId?: ManagerId;
  cohort: string;
  status: Status;
  due: string;
  goals: Goal[];
  goalAssignment?: GoalAssignment;
  /** The day the current plan took effect. */
  goalsAcceptedOn?: string;
  /** The day this round's plan was first issued. HR's edit window counts from here. */
  planIssuedOn?: string;
  planQuestion?: { question: string; askedOn: string; response?: string; respondedOn?: string };
  acceptedGoalTemplate?: GoalTemplateReference;
  previousGoalPlans?: { replacedOn: string; goals: Goal[]; template?: GoalTemplateReference }[];
  activity: { role: Role; message: string; at: string }[];
  review?: Review;
  /** Behavior rating the manager saved early. HR and the employee see it only after it is sent. */
  reviewDraft?: Review;
  secondReview?: SecondReview;
  decision?: Decision;
  calibrationHistory?: CalibrationRecord[];
  summary?: string;
  submission?: {
    submittedOn: string;
    approvalDue: string;
    decision?: "approved" | "declined";
    decidedOn?: string;
    reason?: string;
  };
  returnReason?: string;
  reminded?: boolean;
  /** When HR last recorded a reminder about this person (ISO timestamp). */
  remindedAt?: string;
  acknowledged?: boolean;
  publishedOn?: string;
  appeal?: Appeal;
}

export interface Cycle {
  name: string;
  status: "draft" | "open" | "closed";
  closedAt?: string;
  teams: Team[];
  reviewers: Partial<Record<Team, string>>;
  secondaryReviewers?: Partial<Record<Team, string>>;
  employeeDue: string;
  managerDue: string;
  resultWeight: number;
  kpiTemplates?: KpiTemplate[];
  /** The template HR chose for each team, by template id. */
  teamTemplates?: Partial<Record<Team, string>>;
  roleKpiTemplate?: LegacyRoleKpiTemplate;
  managerFeedback?: Partial<Record<ManagerId, ManagerFeedback>>;
  /** Team-wide reminders HR sent to each manager (ISO timestamps). */
  managerReminders?: Partial<Record<ManagerId, string[]>>;
  /** Historical team templates from rounds that used team assignments. */
  teamGoals?: Partial<Record<Team, GoalDefinition[]>>;
}

export interface ReviewRound {
  people: Person[];
  cycle: Cycle;
}

export interface Workspace extends ReviewRound {
  history?: ReviewRound[];
}
