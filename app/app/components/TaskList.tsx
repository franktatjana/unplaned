"use client";

import { useState, useEffect } from "react";
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
  const [showDone, setShowDone] = useState(false);

  // Auto-refresh every 5 seconds to pick up status changes (e.g., from focus mode)
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  // Separate active tasks from completed ones
  const activeTasks = tasks.filter(t => !t.completedAt);
  const doneTasks = tasks.filter(t => t.completedAt);

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
      {/* Active tasks */}
      {activeTasks.map((task) => {
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

      {/* Done section */}
      {doneTasks.length > 0 && (
        <div style={styles.doneSection}>
          <button
            onClick={() => setShowDone(!showDone)}
            style={styles.doneToggle}
          >
            <span style={styles.doneLabel}>Done ({doneTasks.length})</span>
            <span>{showDone ? "▾" : "▸"}</span>
          </button>

          {showDone && (
            <div style={styles.doneList}>
              {doneTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={() => handleDelete(task.id)}
                  isDone
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state for active tasks only */}
      {activeTasks.length === 0 && doneTasks.length > 0 && (
        <div style={styles.allDone}>
          <p style={styles.allDoneText}>All tasks done!</p>
        </div>
      )}
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
  doneSection: {
    marginTop: "0.5rem",
  },
  doneToggle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "0.625rem 0.875rem",
    fontSize: "0.8rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  doneLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  doneList: {
    marginTop: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  allDone: {
    padding: "2rem 1.5rem",
    textAlign: "center",
    background: "var(--bg-secondary)",
    borderRadius: "10px",
    border: "1px solid #28a745",
  },
  allDoneText: {
    fontSize: "1rem",
    color: "#28a745",
    margin: 0,
  },
};
