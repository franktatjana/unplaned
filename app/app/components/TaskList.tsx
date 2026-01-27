"use client";

import { useRouter } from "next/navigation";
import { Task, Session } from "../lib/types";
import { removeTask, startFocusSession } from "../lib/actions";
import TaskCard from "./TaskCard";

interface Props {
  tasks: Task[];
  activeSessions: Session[];
}

export default function TaskList({ tasks, activeSessions }: Props) {
  const router = useRouter();

  const handleDelete = async (id: string) => {
    await removeTask(id);
    router.refresh();
  };

  const handleStart = async (id: string) => {
    const sessionId = await startFocusSession(id);
    router.push(`/focus/${sessionId}`);
  };

  const handleResume = (sessionId: string) => {
    router.push(`/focus/${sessionId}`);
  };

  if (tasks.length === 0) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No tasks yet.</p>
        <p style={styles.emptyHint}>Add a task above to get started.</p>
      </div>
    );
  }

  return (
    <div style={styles.list}>
      {tasks.map((task) => {
        const activeSession = activeSessions.find(s => s.taskId === task.id);
        return (
          <TaskCard
            key={task.id}
            task={task}
            activeSession={activeSession}
            onStart={() => handleStart(task.id)}
            onResume={activeSession ? () => handleResume(activeSession.id) : undefined}
            onDelete={() => handleDelete(task.id)}
          />
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  empty: {
    padding: "3rem 1.5rem",
    textAlign: "center",
    background: "var(--bg-secondary)",
    borderRadius: "10px",
    border: "1px dashed var(--border)",
  },
  emptyText: {
    fontSize: "1rem",
    color: "var(--fg-secondary)",
    marginBottom: "0.5rem",
  },
  emptyHint: {
    fontSize: "0.85rem",
    color: "var(--fg-muted)",
  },
};
