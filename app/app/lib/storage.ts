import { promises as fs } from "fs";
import path from "path";
import { TaskStore, Task, Session } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");
const EXAMPLE_FILE = path.join(DATA_DIR, "storage.example.json");
const EXPORT_DIR = path.join(DATA_DIR, "export");

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function ensureExportDir() {
  try {
    await fs.access(EXPORT_DIR);
  } catch {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
  }
}

function taskToMarkdown(task: Task): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${task.text}`);
  lines.push("");

  // Metadata
  lines.push("## Details");
  lines.push("");
  lines.push(`- **Duration:** ${task.duration} minutes`);
  lines.push(`- **Priority:** ${task.priority}`);
  if (task.dueDate) {
    lines.push(`- **Due:** ${new Date(task.dueDate).toLocaleDateString()}`);
  }
  if (task.blocker) {
    lines.push(`- **Blocker:** ${task.blocker}`);
  }
  if (task.tags.length > 0) {
    lines.push(`- **Tags:** ${task.tags.join(", ")}`);
  }
  lines.push(`- **Created:** ${new Date(task.createdAt).toLocaleString()}`);
  if (task.completedAt) {
    lines.push(`- **Completed:** ${new Date(task.completedAt).toLocaleString()}`);
  }
  lines.push("");

  // Why
  lines.push("## Why");
  lines.push("");
  lines.push(task.coreWhy || "This task needs to get done.");
  lines.push("");
  if (task.why) {
    lines.push(`> ${task.why}`);
    lines.push("");
  }

  // Subtasks
  lines.push("## Steps");
  lines.push("");
  task.subtasks.forEach((st, i) => {
    const checkbox = st.completed ? "[x]" : "[ ]";
    lines.push(`${i + 1}. ${checkbox} ${st.text}`);
  });
  lines.push("");

  // Footer
  lines.push("---");
  lines.push(`*Exported from Unplaned*`);

  return lines.join("\n");
}

function sanitizeFilename(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function saveTaskAsMarkdown(task: Task): Promise<void> {
  await ensureExportDir();
  const filename = `${sanitizeFilename(task.text)}-${task.id.slice(0, 8)}.md`;
  const filepath = path.join(EXPORT_DIR, filename);
  const markdown = taskToMarkdown(task);
  await fs.writeFile(filepath, markdown, "utf-8");
}

async function deleteTaskMarkdown(task: Task): Promise<void> {
  try {
    const filename = `${sanitizeFilename(task.text)}-${task.id.slice(0, 8)}.md`;
    const filepath = path.join(EXPORT_DIR, filename);
    await fs.unlink(filepath);
  } catch {
    // File might not exist, ignore
  }
}

async function readStore(): Promise<TaskStore> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(TASKS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return { tasks: [], sessions: [] };
  }
}

async function writeStore(store: TaskStore): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(TASKS_FILE, JSON.stringify(store, null, 2));
}

export async function getTasks(): Promise<Task[]> {
  const store = await readStore();
  return store.tasks;
}

export async function getTask(id: string): Promise<Task | undefined> {
  const store = await readStore();
  return store.tasks.find((t) => t.id === id);
}

export async function createTask(task: Task): Promise<Task> {
  const store = await readStore();
  store.tasks.push(task);
  await writeStore(store);
  // Auto-export to MD
  await saveTaskAsMarkdown(task);
  return task;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
  const store = await readStore();
  const index = store.tasks.findIndex((t) => t.id === id);
  if (index === -1) return undefined;
  store.tasks[index] = { ...store.tasks[index], ...updates };
  await writeStore(store);
  // Auto-export to MD
  await saveTaskAsMarkdown(store.tasks[index]);
  return store.tasks[index];
}

export async function deleteTask(id: string): Promise<boolean> {
  const store = await readStore();
  const index = store.tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  const task = store.tasks[index];
  store.tasks.splice(index, 1);
  await writeStore(store);
  // Remove MD file
  await deleteTaskMarkdown(task);
  return true;
}

export async function getSessions(): Promise<Session[]> {
  const store = await readStore();
  return store.sessions;
}

export async function getSession(id: string): Promise<Session | undefined> {
  const store = await readStore();
  return store.sessions.find((s) => s.id === id);
}

export async function createSession(session: Session): Promise<Session> {
  const store = await readStore();
  store.sessions.push(session);
  await writeStore(store);
  return session;
}

export async function updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
  const store = await readStore();
  const index = store.sessions.findIndex((s) => s.id === id);
  if (index === -1) return undefined;
  store.sessions[index] = { ...store.sessions[index], ...updates };
  await writeStore(store);
  return store.sessions[index];
}

// Check if using sample/example data (has sample IDs)
export async function isUsingSampleData(): Promise<boolean> {
  const store = await readStore();
  const sampleIds = ["sample-001", "sample-002", "sample-003"];
  return store.tasks.some((t) => sampleIds.includes(t.id));
}

// Clear all data (start fresh)
export async function clearAllData(): Promise<void> {
  const emptyStore: TaskStore = { tasks: [], sessions: [] };
  await writeStore(emptyStore);
  // Also clear export directory
  try {
    const files = await fs.readdir(EXPORT_DIR);
    for (const file of files) {
      if (file.endsWith(".md")) {
        await fs.unlink(path.join(EXPORT_DIR, file));
      }
    }
  } catch {
    // Export dir might not exist
  }
}

// Load sample data
export async function loadSampleData(): Promise<void> {
  try {
    const exampleContent = await fs.readFile(EXAMPLE_FILE, "utf-8");
    const data = JSON.parse(exampleContent) as TaskStore;
    await writeStore(data);
  } catch {
    // Example file doesn't exist or is invalid
    console.error("Failed to load sample data");
  }
}
