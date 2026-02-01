"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Duration } from "../lib/types";
import { addTask } from "../lib/actions";

interface ParsedTask {
  title: string;
  suggestedDuration: Duration;
  suggestedTags: string[];
  originalLine: string;
  selected: boolean;
}

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const router = useRouter();
  const [rawText, setRawText] = useState("");
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState("");
  const [source, setSource] = useState<"ollama" | "fallback" | null>(null);

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setParsing(true);
    setError("");

    try {
      const response = await fetch("/api/parse-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse todo list");
      }

      const data = await response.json();
      setParsedTasks(
        data.tasks.map((t: Omit<ParsedTask, "selected">) => ({
          ...t,
          selected: true,
        }))
      );
      setSource(data.source);
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse todo list. Try again.");
    } finally {
      setParsing(false);
    }
  };

  const handleToggleTask = (index: number) => {
    setParsedTasks(prev =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleSelectAll = (selected: boolean) => {
    setParsedTasks(prev => prev.map(t => ({ ...t, selected })));
  };

  const handleUpdateTitle = (index: number, title: string) => {
    setParsedTasks(prev =>
      prev.map((t, i) => (i === index ? { ...t, title } : t))
    );
  };

  const handleUpdateDuration = (index: number, duration: Duration) => {
    setParsedTasks(prev =>
      prev.map((t, i) => (i === index ? { ...t, suggestedDuration: duration } : t))
    );
  };

  const handleCreateTasks = async () => {
    const selectedTasks = parsedTasks.filter(t => t.selected);
    if (selectedTasks.length === 0) return;

    setCreating(true);
    setProgress({ current: 0, total: selectedTasks.length });
    setError("");

    for (let i = 0; i < selectedTasks.length; i++) {
      const task = selectedTasks[i];
      setProgress({ current: i + 1, total: selectedTasks.length });

      try {
        // Call breakdown API for full subtask generation
        const response = await fetch("/api/breakdown", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: task.title,
            personality: "coach",
            duration: task.suggestedDuration,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          await addTask(
            data.task || task.title,
            data.subtasks || [{ text: "Complete this task" }],
            data.why || "Let's get this done.",
            data.coreWhy || "This task moves you forward.",
            data.duration || task.suggestedDuration,
            "coach",
            data.doneMeans || []
          );
        } else {
          // Fallback: create task without AI breakdown
          await addTask(
            task.title,
            [{ text: "Plan approach" }, { text: "Execute" }, { text: "Review" }],
            "Let's get this done.",
            "This task moves you forward.",
            task.suggestedDuration,
            "coach",
            []
          );
        }
      } catch (err) {
        console.error(`Failed to create task: ${task.title}`, err);
        // Continue with next task even if one fails
      }
    }

    setCreating(false);
    router.refresh();
    handleClose();
  };

  const handleClose = () => {
    setRawText("");
    setParsedTasks([]);
    setError("");
    setSource(null);
    setProgress({ current: 0, total: 0 });
    onClose();
  };

  const selectedCount = parsedTasks.filter(t => t.selected).length;

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Brain Dump</h2>
          <button onClick={handleClose} style={styles.closeBtn}>×</button>
        </div>

        {parsedTasks.length === 0 ? (
          // Input phase
          <div style={styles.content}>
            <p style={styles.hint}>
              Paste your todo list, brain dump, or notes:
            </p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="* Write blog post about frameworks&#10;* Email the contractor&#10;* Plan next week&#10;* Read for 30 minutes"
              style={styles.textarea}
              rows={8}
              autoFocus
            />
            {error && <p style={styles.error}>{error}</p>}
            <div style={styles.actions}>
              <button onClick={handleClose} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleParse}
                disabled={!rawText.trim() || parsing}
                style={styles.parseBtn}
              >
                {parsing ? "Parsing..." : "Parse Tasks"}
              </button>
            </div>
          </div>
        ) : creating ? (
          // Creating phase
          <div style={styles.content}>
            <div style={styles.progressSection}>
              <p style={styles.progressText}>
                Creating task {progress.current} of {progress.total}...
              </p>
              <div style={styles.progressBar}>
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${(progress.current / progress.total) * 100}%`,
                  }}
                />
              </div>
              <p style={styles.progressHint}>
                Generating AI breakdowns for each task
              </p>
            </div>
          </div>
        ) : (
          // Preview phase
          <div style={styles.content}>
            <div style={styles.previewHeader}>
              <span style={styles.foundText}>
                Found {parsedTasks.length} tasks
                {source === "fallback" && (
                  <span style={styles.fallbackBadge}>Basic parse</span>
                )}
              </span>
              <div style={styles.selectActions}>
                <button
                  onClick={() => handleSelectAll(true)}
                  style={styles.selectBtn}
                >
                  Select All
                </button>
                <button
                  onClick={() => handleSelectAll(false)}
                  style={styles.selectBtn}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div style={styles.taskList}>
              {parsedTasks.map((task, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.taskRow,
                    opacity: task.selected ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={task.selected}
                    onChange={() => handleToggleTask(i)}
                    style={styles.checkbox}
                  />
                  <div style={styles.taskDetails}>
                    <input
                      type="text"
                      value={task.title}
                      onChange={e => handleUpdateTitle(i, e.target.value)}
                      style={styles.titleInput}
                    />
                    <div style={styles.taskMeta}>
                      <select
                        value={task.suggestedDuration}
                        onChange={e =>
                          handleUpdateDuration(i, Number(e.target.value) as Duration)
                        }
                        style={styles.durationSelect}
                      >
                        <option value={15}>15m</option>
                        <option value={30}>30m</option>
                        <option value={45}>45m</option>
                        <option value={60}>60m</option>
                      </select>
                      {task.suggestedTags.length > 0 && (
                        <div style={styles.tags}>
                          {task.suggestedTags.map((tag, ti) => (
                            <span key={ti} style={styles.tag}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.actions}>
              <button
                onClick={() => setParsedTasks([])}
                style={styles.backBtn}
              >
                ← Back
              </button>
              <button onClick={handleClose} style={styles.cancelBtn}>
                Cancel
              </button>
              <button
                onClick={handleCreateTasks}
                disabled={selectedCount === 0}
                style={styles.createBtn}
              >
                Create {selectedCount} Task{selectedCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "1rem",
  },
  dialog: {
    background: "var(--bg-primary)",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "600px",
    maxHeight: "80vh",
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "1.5rem",
    color: "var(--fg-muted)",
    cursor: "pointer",
    padding: "0.25rem",
    lineHeight: 1,
  },
  content: {
    padding: "1.25rem",
    overflow: "auto",
    flex: 1,
  },
  hint: {
    margin: "0 0 0.75rem",
    fontSize: "0.9rem",
    color: "var(--fg-secondary)",
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    fontSize: "0.9rem",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    background: "var(--bg-secondary)",
    color: "var(--fg-primary)",
    resize: "vertical",
    fontFamily: "inherit",
  },
  error: {
    margin: "0.75rem 0 0",
    fontSize: "0.85rem",
    color: "#dc3545",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "0.5rem",
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid var(--border)",
  },
  cancelBtn: {
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  parseBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.85rem",
    background: "#FFFF00",
    border: "none",
    borderRadius: "6px",
    color: "#000",
    cursor: "pointer",
    fontWeight: 600,
  },
  backBtn: {
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
    marginRight: "auto",
  },
  createBtn: {
    padding: "0.5rem 1.25rem",
    fontSize: "0.85rem",
    background: "#28a745",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
  },
  foundText: {
    fontSize: "0.9rem",
    color: "var(--fg-secondary)",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  fallbackBadge: {
    fontSize: "0.7rem",
    padding: "0.125rem 0.5rem",
    background: "var(--bg-tertiary)",
    borderRadius: "10px",
    color: "var(--fg-muted)",
  },
  selectActions: {
    display: "flex",
    gap: "0.5rem",
  },
  selectBtn: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  taskList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    maxHeight: "300px",
    overflow: "auto",
  },
  taskRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.75rem",
    padding: "0.75rem",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
    border: "1px solid var(--border)",
  },
  checkbox: {
    marginTop: "0.25rem",
    cursor: "pointer",
  },
  taskDetails: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  titleInput: {
    width: "100%",
    padding: "0.375rem 0.5rem",
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    background: "var(--bg-primary)",
    color: "var(--fg-primary)",
  },
  taskMeta: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  durationSelect: {
    padding: "0.25rem 0.375rem",
    fontSize: "0.75rem",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    background: "var(--bg-primary)",
    color: "var(--fg-secondary)",
  },
  tags: {
    display: "flex",
    gap: "0.25rem",
    flexWrap: "wrap",
  },
  tag: {
    fontSize: "0.65rem",
    padding: "0.125rem 0.375rem",
    background: "rgba(255, 255, 0, 0.15)",
    color: "#FFFF00",
    borderRadius: "8px",
    textTransform: "uppercase",
  },
  progressSection: {
    textAlign: "center",
    padding: "2rem 1rem",
  },
  progressText: {
    margin: "0 0 1rem",
    fontSize: "1rem",
    color: "var(--fg-primary)",
  },
  progressBar: {
    height: "8px",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#28a745",
    transition: "width 0.3s ease",
  },
  progressHint: {
    margin: "1rem 0 0",
    fontSize: "0.85rem",
    color: "var(--fg-muted)",
  },
};
