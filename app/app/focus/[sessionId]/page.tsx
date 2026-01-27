"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Task, Subtask } from "../../lib/types";

interface FocusData {
  task: Task | null;
  error: string | null;
}

function parseTimeFromSubtask(text: string): number {
  const match = text.match(/\(~?(\d+)\s*min\)$/i);
  return match ? parseInt(match[1], 10) : 10; // Default 10 min if no estimate
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatCompactTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs}s`;
  }
  if (secs === 0) {
    return `${mins}m`;
  }
  return `${mins}m ${secs}s`;
}

export default function FocusPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params;
  const router = useRouter();
  const [data, setData] = useState<FocusData>({ task: null, error: null });
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);

  // Time tracking for individual subtasks
  const [subtaskTimes, setSubtaskTimes] = useState<Record<string, {
    startedAt: number | null;
    elapsedSeconds: number;
    estimatedSeconds: number;
  }>>({});

  // Load session and task data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/focus/${sessionId}`);
        if (!response.ok) {
          throw new Error("Session not found");
        }
        const result = await response.json();
        setData({ task: result.task, error: null });
        setSubtasks(result.task.subtasks);

        // Initialize time tracking for each subtask
        const initialTimes: Record<string, { startedAt: number | null; elapsedSeconds: number; estimatedSeconds: number }> = {};
        result.task.subtasks.forEach((st: Subtask) => {
          initialTimes[st.id] = {
            startedAt: null,
            elapsedSeconds: 0,
            estimatedSeconds: parseTimeFromSubtask(st.text) * 60,
          };
        });
        setSubtaskTimes(initialTimes);

        // Calculate total time from subtask estimates
        const totalMinutes = result.task.subtasks.reduce(
          (sum: number, st: Subtask) => sum + parseTimeFromSubtask(st.text),
          0
        );
        setTimeRemaining(totalMinutes * 60);
      } catch (err) {
        setData({ task: null, error: err instanceof Error ? err.message : "Failed to load" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [sessionId]);

  // Timer countdown
  useEffect(() => {
    if (isPaused || timeRemaining <= 0 || loading) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, timeRemaining, loading]);

  // Track elapsed time for active subtask
  useEffect(() => {
    if (!activeSubtaskId || isPaused) return;

    const interval = setInterval(() => {
      setSubtaskTimes((prev) => {
        const current = prev[activeSubtaskId];
        if (!current) return prev;
        return {
          ...prev,
          [activeSubtaskId]: {
            ...current,
            elapsedSeconds: current.elapsedSeconds + 1,
          },
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSubtaskId, isPaused]);

  // Handle subtask click: inactive → active (working) → completed → inactive
  const handleSubtaskClick = useCallback(async (subtaskId: string) => {
    if (!data.task) return;

    const subtask = subtasks.find(s => s.id === subtaskId);
    if (!subtask) return;

    if (subtask.completed) {
      // Completed → back to inactive
      const updatedSubtasks = subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: false } : st
      );
      setSubtasks(updatedSubtasks);
      setActiveSubtaskId(null);

      try {
        await fetch(`/api/focus/${sessionId}/subtask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtaskId, completed: false }),
        });
      } catch (err) {
        console.error("Failed to save subtask:", err);
      }
    } else if (activeSubtaskId === subtaskId) {
      // Active → completed
      const updatedSubtasks = subtasks.map((st) =>
        st.id === subtaskId ? { ...st, completed: true } : st
      );
      setSubtasks(updatedSubtasks);
      setActiveSubtaskId(null);

      try {
        await fetch(`/api/focus/${sessionId}/subtask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtaskId, completed: true }),
        });
      } catch (err) {
        console.error("Failed to save subtask:", err);
      }
    } else {
      // Inactive → active (start tracking time)
      setActiveSubtaskId(subtaskId);
      setSubtaskTimes((prev) => ({
        ...prev,
        [subtaskId]: {
          ...prev[subtaskId],
          startedAt: prev[subtaskId]?.startedAt || Date.now(),
        },
      }));
    }
  }, [data.task, subtasks, sessionId, activeSubtaskId]);

  const handleEndSession = useCallback(() => {
    router.push("/");
  }, [router]);

  const completedCount = subtasks.filter((st) => st.completed).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = completedCount === totalCount && totalCount > 0;
  const timeUp = timeRemaining === 0;
  const isUrgent = timeRemaining > 0 && timeRemaining <= 300; // Under 5 minutes
  const isCritical = timeRemaining > 0 && timeRemaining <= 60; // Under 1 minute

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.loading}>Loading...</div>
      </main>
    );
  }

  if (data.error || !data.task) {
    return (
      <main style={styles.main}>
        <div style={styles.errorContainer}>
          <p style={styles.errorText}>{data.error || "Task not found"}</p>
          <button onClick={() => router.push("/")} style={styles.backBtn}>
            Back to Tasks
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        {/* Why statement - highlighted at top */}
        <div style={styles.whyBanner}>
          <p style={styles.whyText}>{data.task.why}</p>
        </div>

        {/* Task title */}
        <h1 style={styles.taskTitle}>{data.task.text}</h1>

        {/* Timer */}
        <div style={styles.timerSection}>
          <div style={{
            ...styles.timer,
            ...(timeUp ? styles.timerDone : {}),
            ...(isPaused ? styles.timerPaused : {}),
            ...(isCritical ? styles.timerCritical : isUrgent ? styles.timerUrgent : {}),
          }}>
            {formatTime(timeRemaining)}
          </div>
          {timeUp && (
            <p style={styles.timeUpMessage}>Time's up!</p>
          )}
          {isUrgent && !timeUp && (
            <p style={styles.urgentMessage}>
              {isCritical ? "Final minute!" : "Less than 5 minutes left"}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBar}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <span style={styles.progressText}>{completedCount}/{totalCount} steps</span>
        </div>

        {/* Hint - above subtask list */}
        {!activeSubtaskId && subtasks.some(st => !st.completed) && (
          <p style={styles.hint}>Click a step to start working on it, click again to mark done</p>
        )}

        {/* Subtask list */}
        <div style={styles.subtaskList}>
          {subtasks.map((st) => {
            const timeEstimate = parseTimeFromSubtask(st.text);
            const cleanText = st.text.replace(/\s*\(~?\d+\s*min\)$/i, "");
            const isActive = activeSubtaskId === st.id;
            const timeData = subtaskTimes[st.id];
            const elapsedSeconds = timeData?.elapsedSeconds || 0;
            const estimatedSeconds = timeData?.estimatedSeconds || timeEstimate * 60;
            const progressPercent = Math.min((elapsedSeconds / estimatedSeconds) * 100, 100);
            const isOvertime = elapsedSeconds > estimatedSeconds;
            const overtimeSeconds = isOvertime ? elapsedSeconds - estimatedSeconds : 0;

            return (
              <div key={st.id} style={styles.subtaskWrapper}>
                <button
                  onClick={() => handleSubtaskClick(st.id)}
                  style={{
                    ...styles.subtaskItem,
                    ...(st.completed ? styles.subtaskCompleted : {}),
                    ...(isActive && !st.completed ? styles.subtaskActive : {}),
                    ...(isOvertime && isActive ? styles.subtaskOvertime : {}),
                  }}
                >
                  <span style={{
                    ...styles.checkbox,
                    ...(isActive && !st.completed ? styles.checkboxActive : {}),
                  }}>
                    {st.completed ? "✓" : isActive ? "▶" : "○"}
                  </span>
                  <span style={{
                    ...styles.subtaskText,
                    ...(st.completed ? styles.subtaskTextCompleted : {}),
                    ...(isActive && !st.completed ? styles.subtaskTextActive : {}),
                  }}>
                    {cleanText}
                  </span>
                  <div style={styles.timeInfo}>
                    {(isActive || elapsedSeconds > 0) && (
                      <span style={{
                        ...styles.elapsedTime,
                        ...(isOvertime ? styles.elapsedTimeOvertime : {}),
                      }}>
                        {formatCompactTime(elapsedSeconds)}
                        {isOvertime && ` +${formatCompactTime(overtimeSeconds)}`}
                      </span>
                    )}
                    <span style={{
                      ...styles.subtaskTime,
                      ...(isActive && !st.completed ? styles.subtaskTimeActive : {}),
                    }}>{timeEstimate}m</span>
                  </div>
                </button>
                {/* Progress gauge for active subtask */}
                {isActive && !st.completed && (
                  <div style={styles.gaugeContainer}>
                    <div style={{
                      ...styles.gaugeFill,
                      width: `${progressPercent}%`,
                      ...(isOvertime ? styles.gaugeFillOvertime : progressPercent > 80 ? styles.gaugeFillWarning : {}),
                    }} />
                  </div>
                )}
                {/* Show elapsed time for completed subtasks */}
                {st.completed && elapsedSeconds > 0 && (
                  <div style={styles.completedTimeRow}>
                    <span style={styles.completedTimeLabel}>
                      Took {formatCompactTime(elapsedSeconds)} of {timeEstimate}m estimate
                      {isOvertime && <span style={styles.overtimeLabel}> (+{formatCompactTime(overtimeSeconds)})</span>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div style={styles.controls}>
          {!showEndConfirm ? (
            <>
              <button
                onClick={() => router.push("/")}
                style={styles.homeBtn}
                title="Back to tasks"
              >
                ←
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                style={styles.pauseBtn}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              {(allComplete || timeUp) ? (
                <button onClick={handleEndSession} style={styles.doneBtn}>
                  Done
                </button>
              ) : (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  style={styles.endBtn}
                >
                  End Early
                </button>
              )}
            </>
          ) : (
            <div style={styles.confirmRow}>
              <span style={styles.confirmText}>End session?</span>
              <button onClick={handleEndSession} style={styles.confirmYes}>
                Yes, end
              </button>
              <button onClick={() => setShowEndConfirm(false)} style={styles.confirmNo}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem 1rem",
    background: "var(--bg-primary)",
  },
  container: {
    width: "100%",
    maxWidth: "700px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
  },
  loading: {
    fontSize: "1rem",
    color: "var(--fg-muted)",
  },
  errorContainer: {
    textAlign: "center",
  },
  errorText: {
    fontSize: "1rem",
    color: "#dc3545",
    marginBottom: "1.5rem",
  },
  backBtn: {
    padding: "0.75rem 1.5rem",
    fontSize: "0.95rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-primary)",
    cursor: "pointer",
  },
  whyBanner: {
    width: "100%",
    padding: "0.875rem 1.25rem",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    borderLeft: "3px solid var(--fg-primary)",
  },
  whyText: {
    margin: 0,
    fontSize: "0.95rem",
    fontStyle: "italic",
    color: "var(--fg-primary)",
    textAlign: "center",
  },
  taskTitle: {
    margin: 0,
    fontSize: "1.4rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
    textAlign: "center",
    lineHeight: 1.3,
  },
  timerSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.375rem",
    marginTop: "0.25rem",
  },
  timer: {
    fontSize: "3.5rem",
    fontWeight: 700,
    fontFamily: "monospace",
    color: "var(--fg-primary)",
    letterSpacing: "0.03em",
    lineHeight: 1,
  },
  timerPaused: {
    opacity: 0.5,
  },
  timerDone: {
    color: "#28a745",
  },
  timerUrgent: {
    color: "#ffc107",
  },
  timerCritical: {
    color: "#dc3545",
    animation: "pulse 1s ease-in-out infinite",
  },
  timeUpMessage: {
    margin: 0,
    fontSize: "1rem",
    color: "#28a745",
    fontWeight: 500,
  },
  urgentMessage: {
    margin: 0,
    fontSize: "0.9rem",
    color: "#ffc107",
    fontWeight: 500,
  },
  progressContainer: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "0.25rem",
  },
  progressBar: {
    flex: 1,
    height: "5px",
    background: "var(--bg-secondary)",
    borderRadius: "3px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--fg-primary)",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    whiteSpace: "nowrap",
  },
  subtaskList: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "0.625rem",
  },
  subtaskWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
  },
  subtaskItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.875rem 1rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    width: "100%",
  },
  subtaskCompleted: {
    background: "rgba(40, 167, 69, 0.1)",
    borderColor: "rgba(40, 167, 69, 0.3)",
  },
  subtaskActive: {
    background: "rgba(255, 255, 0, 0.1)",
    borderColor: "rgba(255, 255, 0, 0.5)",
    animation: "glow 2s ease-in-out infinite",
  },
  subtaskOvertime: {
    background: "rgba(220, 53, 69, 0.15)",
    borderColor: "rgba(220, 53, 69, 0.5)",
    animation: "none",
  },
  checkbox: {
    fontSize: "1.1rem",
    color: "var(--fg-muted)",
    width: "1.25rem",
    textAlign: "center",
    flexShrink: 0,
  },
  checkboxActive: {
    color: "#FFFF00",
  },
  subtaskText: {
    flex: 1,
    fontSize: "0.95rem",
    color: "var(--fg-primary)",
    lineHeight: 1.4,
  },
  subtaskTextCompleted: {
    textDecoration: "line-through",
    opacity: 0.6,
  },
  subtaskTextActive: {
    color: "#FFFF00",
    fontWeight: 500,
  },
  timeInfo: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    flexShrink: 0,
  },
  elapsedTime: {
    fontSize: "0.75rem",
    color: "#FFFF00",
    fontFamily: "monospace",
    fontWeight: 500,
  },
  elapsedTimeOvertime: {
    color: "#dc3545",
  },
  subtaskTime: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    flexShrink: 0,
  },
  subtaskTimeActive: {
    color: "#FFFF00",
  },
  gaugeContainer: {
    width: "100%",
    height: "3px",
    background: "var(--bg-tertiary)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  gaugeFill: {
    height: "100%",
    background: "#FFFF00",
    borderRadius: "2px",
    transition: "width 1s linear",
  },
  gaugeFillWarning: {
    background: "#ffc107",
  },
  gaugeFillOvertime: {
    background: "#dc3545",
    width: "100%",
  },
  completedTimeRow: {
    paddingLeft: "2rem",
  },
  completedTimeLabel: {
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
  },
  overtimeLabel: {
    color: "#dc3545",
  },
  hint: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    opacity: 0.6,
    margin: "0 0 -0.5rem 0",
    textAlign: "center",
  },
  controls: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  homeBtn: {
    padding: "0.75rem 1rem",
    fontSize: "1rem",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-muted)",
    cursor: "pointer",
    opacity: 0.5,
  },
  pauseBtn: {
    padding: "0.75rem 1.5rem",
    fontSize: "0.95rem",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-muted)",
    cursor: "pointer",
    opacity: 0.6,
  },
  endBtn: {
    padding: "0.75rem 1.5rem",
    fontSize: "0.95rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  doneBtn: {
    padding: "0.75rem 2rem",
    fontSize: "0.95rem",
    fontWeight: 500,
    background: "var(--fg-primary)",
    border: "none",
    borderRadius: "8px",
    color: "var(--bg-primary)",
    cursor: "pointer",
  },
  confirmRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  confirmText: {
    fontSize: "0.95rem",
    color: "var(--fg-secondary)",
  },
  confirmYes: {
    padding: "0.5rem 1rem",
    fontSize: "0.9rem",
    background: "#dc3545",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
  },
  confirmNo: {
    padding: "0.5rem 1rem",
    fontSize: "0.9rem",
    background: "var(--bg-tertiary)",
    border: "none",
    borderRadius: "6px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
};
