"use server";

import { v4 as uuid } from "uuid";
import { Task, Subtask, Personality, Duration, TaskNote } from "./types";
import {
  createTask,
  updateTask,
  deleteTask,
  getTask,
  createSession,
  isUsingSampleData,
  clearAllData,
  loadSampleData,
} from "./storage";

export async function addTask(
  text: string,
  subtasks: string[],
  why: string,
  coreWhy: string,
  duration: Duration,
  personality: Personality
): Promise<Task> {
  const task: Task = {
    id: uuid(),
    text,
    why,
    coreWhy,
    subtasks: subtasks.map((st) => ({
      id: uuid(),
      text: st,
      completed: false,
    })),
    duration,
    priority: "medium",
    personality,
    tags: [],
    notes: [],
    createdAt: new Date().toISOString(),
  };
  return createTask(task);
}

export async function editTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  return updateTask(id, updates);
}

export async function removeTask(id: string): Promise<boolean> {
  return deleteTask(id);
}

export async function editSubtask(
  taskId: string,
  subtaskId: string,
  updates: Partial<Subtask>
): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  const subtasks = task.subtasks.map((st) =>
    st.id === subtaskId ? { ...st, ...updates } : st
  );
  return updateTask(taskId, { subtasks });
}

export async function addSubtaskToTask(taskId: string, text: string): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  const newSubtask: Subtask = {
    id: uuid(),
    text,
    completed: false,
  };
  return updateTask(taskId, { subtasks: [...task.subtasks, newSubtask] });
}

export async function removeSubtaskFromTask(taskId: string, subtaskId: string): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  const subtasks = task.subtasks.filter((st) => st.id !== subtaskId);
  return updateTask(taskId, { subtasks });
}

export async function reorderSubtasks(taskId: string, newOrder: string[]): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  const subtaskMap = new Map(task.subtasks.map((st) => [st.id, st]));
  const reordered = newOrder
    .map((id) => subtaskMap.get(id))
    .filter((st): st is Subtask => st !== undefined);

  return updateTask(taskId, { subtasks: reordered });
}

export async function addNoteToTask(
  taskId: string,
  content: string,
  source: TaskNote["source"]
): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  const note: TaskNote = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    source,
    content,
  };

  const notes = [...(task.notes || []), note];
  return updateTask(taskId, { notes });
}

export async function regenerateTaskWhy(taskId: string, personality: Personality): Promise<Task | undefined> {
  const task = await getTask(taskId);
  if (!task) return undefined;

  try {
    const response = await fetch(`${process.env.OLLAMA_URL || "http://localhost:11434"}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3",
        prompt: getWhyPrompt(task.text, task.coreWhy, personality),
        stream: false,
        options: { temperature: 0.7, num_predict: 100 },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const why = data.response?.trim() || task.why;
      return updateTask(taskId, { why, personality });
    }
  } catch {
    // Fall back to existing why
  }
  return updateTask(taskId, { personality });
}

function getWhyPrompt(task: string, coreWhy: string, personality: Personality): string {
  const styles: Record<Personality, string> = {
    stoic: "Like Marcus Aurelius - calm, philosophical, focused on what's in your control. Brief and wise.",
    coach: "Like an encouraging sports coach - energetic, supportive, believes in you. Motivating but not cheesy.",
    drill: "Like a firm but fair drill sergeant - direct, no excuses, discipline-focused. Short and commanding.",
    friend: "Like a supportive friend over coffee - warm, understanding, gentle nudge. Conversational.",
  };

  return `Task: "${task}"
Core reason: "${coreWhy}"

Write ONE short motivational sentence (max 15 words) in this style:
${styles[personality]}

Just the sentence, nothing else.`;
}

export async function startFocusSession(taskId: string): Promise<string> {
  const session = {
    id: uuid(),
    taskId,
    startedAt: new Date().toISOString(),
    currentSubtaskIndex: 0,
    completedSubtasks: [],
  };
  await createSession(session);
  return session.id;
}

// Sample data management
export async function checkIsSampleData(): Promise<boolean> {
  return isUsingSampleData();
}

export async function clearSampleData(): Promise<void> {
  await clearAllData();
}

export async function generateSampleData(): Promise<void> {
  await loadSampleData();
}
