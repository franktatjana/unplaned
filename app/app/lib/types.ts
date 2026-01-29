export type Priority = "low" | "medium" | "high";
export type Duration = 15 | 30 | 45 | 60;
export type Personality = "stoic" | "coach" | "drill" | "friend";

export interface Subtask {
  id: string;
  text: string;
  cta?: string;        // Immediate action to start this step
  deliverable?: string; // Concrete output when step is complete
  soWhat?: string;     // Why this deliverable matters - the value
  guidance?: string;   // Pragmatic action advice (displayed in Focus mode)
  completed: boolean;
}

export interface TaskNote {
  id: string;
  timestamp: string;
  source: "ai-analysis" | "ai-refine" | "ai-extract" | "manual";
  content: string;
}

export interface Task {
  id: string;
  text: string;
  why: string;
  coreWhy: string;
  doneMeans?: string[]; // 1-3 items: the "long tail" (notify, log, follow-up)
  subtasks: Subtask[];
  duration: Duration;
  priority: Priority;
  personality: Personality;
  tags: string[];
  notes: TaskNote[];
  dueDate?: string;
  blocker?: string;
  createdAt: string;
  completedAt?: string;
  acceptedValueStatement?: string; // Stored brag value statement - avoids AI regeneration
  acceptedOverallImpact?: string; // Stored overall impact statement for brag
}

export interface Session {
  id: string;
  taskId: string;
  startedAt: string;
  completedAt?: string;
  currentSubtaskIndex: number;
  completedSubtasks: string[];
}

export interface TaskStore {
  tasks: Task[];
  sessions: Session[];
}

export interface TemplateSubtask {
  text: string;
  cta?: string;
  deliverable?: string;
  soWhat?: string;
  guidance?: string;
}

export interface Template {
  id: string;
  name: string;
  why: string;
  coreWhy: string;
  doneMeans?: string[];
  subtasks: TemplateSubtask[];
  duration: Duration;
  priority: Priority;
  personality: Personality;
  tags: string[];
  createdAt: string;
  usedCount: number;
}

export interface TemplateStore {
  templates: Template[];
}

// ============================================
// Brag List / Performance Review Types
// ============================================

export type BragSeniorityMode = "ic" | "senior" | "lead";
export type BragWordingToggle = "safe" | "ambitious";

export interface OutcomeConfirmations {
  proposal_submitted?: boolean;
  proposal_accepted?: boolean;
  deal_progressed?: boolean;
  shipped_to_production?: boolean;
  client_approved?: boolean;
  metric_improved?: boolean;
  [key: string]: boolean | undefined;
}

export interface BragGeneratorInput {
  task_title: string;
  steps: string[];
  time_spent_minutes: number | null;
  category_tag: string;
  user_role_mode: BragSeniorityMode;
  wording_toggle: BragWordingToggle;
  outcome_confirmations: OutcomeConfirmations;
  optional_notes: string;
}

export interface BragGeneratorOutput {
  headline: string;
  impact_sentence: string;
  scope_context: string;
  evidence: string[];
  confidence: "high" | "medium" | "low";
  disallowed_claims: string[];
  copy_text: string;
}

export interface BragEntry {
  title: string;
  bullet: string;
  metrics: string;
  category: string;
  tags?: string[];           // Multiple category tags (e.g., ["DELIVERY", "PLANNING", "COMMUNICATION"])
  overallImpact?: string;    // Per-entry impact statement
  taskIds: number[];
  frequency: string;
  confidence: "high" | "medium" | "low";
}

export interface BragResponse {
  entries: BragEntry[];
  summary: {
    totalTasks: number;
    totalTimeInvested: string;
    topCategory: string;
    overallImpact: string;
  };
  source: "ollama" | "fallback";
}
