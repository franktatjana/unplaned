export type Priority = "low" | "medium" | "high";
export type Duration = 15 | 30 | 45 | 60;
export type Personality = "stoic" | "coach" | "drill" | "friend";

export interface Subtask {
  id: string;
  text: string;
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
