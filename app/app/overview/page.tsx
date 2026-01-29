"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Task, Session, Template } from "../lib/types";
import { createTaskFromTemplate, removeTemplate } from "../lib/actions";

interface OverviewData {
  tasks: Task[];
  sessions: Session[];
  templates: Template[];
}

function parseTimeFromSubtask(text: string): number {
  const match = text.match(/\(~?(\d+)\s*min\)$/i);
  return match ? parseInt(match[1], 10) : 10;
}

function getTotalTime(task: Task): number {
  return task.subtasks.reduce((sum, st) => sum + parseTimeFromSubtask(st.text), 0);
}

function getCompletedCount(task: Task): number {
  return task.subtasks.filter(st => st.completed).length;
}

export default function OverviewPage() {
  const router = useRouter();
  const [data, setData] = useState<OverviewData>({ tasks: [], sessions: [], templates: [] });
  const [loading, setLoading] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasksRes, sessionsRes, templatesRes] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/sessions", { cache: "no-store" }),
          fetch("/api/templates", { cache: "no-store" }),
        ]);

        const tasks = await tasksRes.json();
        const sessions = await sessionsRes.json();
        const templates = await templatesRes.json();

        setData({
          tasks: Array.isArray(tasks) ? tasks : [],
          sessions: Array.isArray(sessions) ? sessions : [],
          templates: Array.isArray(templates) ? templates : [],
        });
      } catch (err) {
        console.error("Failed to load overview:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();

    // Auto-refresh every 5 seconds to pick up status changes
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Categorize tasks
  const activeSessions = data.sessions.filter(s => !s.completedAt);
  const activeTaskIds = new Set(activeSessions.map(s => s.taskId));

  const done = data.tasks.filter(t => t.completedAt);
  const inProgress = data.tasks.filter(t => !t.completedAt && activeTaskIds.has(t.id));
  const backlog = data.tasks.filter(t => !t.completedAt && !activeTaskIds.has(t.id));

  const handleTaskClick = (taskId: string) => {
    const session = activeSessions.find(s => s.taskId === taskId);
    if (session) {
      router.push(`/focus/${session.id}`);
    } else {
      router.push("/");
    }
  };

  const handleUseTemplate = async (templateId: string) => {
    try {
      await createTaskFromTemplate(templateId);
      router.push("/");
      router.refresh();
    } catch (err) {
      console.error("Failed to create from template:", err);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await removeTemplate(templateId);
      setData(prev => ({
        ...prev,
        templates: prev.templates.filter(t => t.id !== templateId),
      }));
    } catch (err) {
      console.error("Failed to delete template:", err);
    }
  };

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.loading}>Loading...</div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <button onClick={() => router.push("/")} style={styles.backBtn}>
          ← Back
        </button>
        <h1 style={styles.title}>Task Kanban</h1>
        <div style={styles.stats}>
          {backlog.length + inProgress.length + done.length} tasks
        </div>
      </header>

      <div style={styles.columns}>
        {/* Backlog */}
        <div style={styles.column}>
          <div style={{ ...styles.columnHeader, ...styles.columnHeaderBacklog }}>
            <span style={styles.columnTitle}>Backlog</span>
            <span style={styles.columnCount}>{backlog.length}</span>
          </div>
          <div style={styles.columnContent}>
            {backlog.length === 0 ? (
              <p style={styles.emptyText}>No tasks waiting</p>
            ) : (
              backlog.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task.id)}
                  variant="backlog"
                />
              ))
            )}
          </div>
        </div>

        {/* In Progress */}
        <div style={styles.column}>
          <div style={{ ...styles.columnHeader, ...styles.columnHeaderActive }}>
            <span style={styles.columnTitle}>In Progress</span>
            <span style={styles.columnCount}>{inProgress.length}</span>
          </div>
          <div style={styles.columnContent}>
            {inProgress.length === 0 ? (
              <p style={styles.emptyText}>Nothing active</p>
            ) : (
              inProgress.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => handleTaskClick(task.id)}
                  variant="active"
                />
              ))
            )}
          </div>
        </div>

        {/* Done */}
        <div style={styles.column}>
          <div style={{ ...styles.columnHeader, ...styles.columnHeaderDone }}>
            <span style={styles.columnTitle}>Done</span>
            <span style={styles.columnCount}>{done.length}</span>
          </div>
          <div style={styles.columnContent}>
            {done.length === 0 ? (
              <p style={styles.emptyText}>Nothing completed yet</p>
            ) : (
              done.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => {}}
                  variant="done"
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Template Library */}
      <div style={styles.templateSection}>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          style={styles.templateToggle}
        >
          <span>Templates ({data.templates.length})</span>
          <span>{showTemplates ? "▾" : "▸"}</span>
        </button>

        {showTemplates && (
          <div style={styles.templateList}>
            {data.templates.length === 0 ? (
              <p style={styles.emptyText}>
                No templates yet. Save a task as template from the task card.
              </p>
            ) : (
              data.templates.map(template => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={() => handleUseTemplate(template.id)}
                  onDelete={() => handleDeleteTemplate(template.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function TaskCard({
  task,
  onClick,
  variant
}: {
  task: Task;
  onClick: () => void;
  variant: "backlog" | "active" | "done";
}) {
  const totalTime = getTotalTime(task);
  const completedCount = getCompletedCount(task);
  const totalCount = task.subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.taskCard,
        ...(variant === "active" ? styles.taskCardActive : {}),
        ...(variant === "done" ? styles.taskCardDone : {}),
      }}
    >
      {variant === "active" && (
        <span style={styles.inProgressTag}>▶ In Progress</span>
      )}
      <p style={{
        ...styles.taskText,
        ...(variant === "done" ? styles.taskTextDone : {}),
      }}>
        {task.text}
      </p>
      <div style={styles.taskMeta}>
        <span style={styles.taskTime}>{totalTime}m</span>
        <span style={styles.taskProgress}>
          {completedCount}/{totalCount}
        </span>
      </div>
      {variant !== "done" && totalCount > 0 && (
        <div style={styles.miniProgress}>
          <div style={{
            ...styles.miniProgressFill,
            ...(variant === "active" ? styles.miniProgressFillActive : {}),
            width: `${progress}%`
          }} />
        </div>
      )}
    </button>
  );
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: Template;
  onUse: () => void;
  onDelete: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const totalTime = template.subtasks.reduce((sum, st) => {
    const match = st.text.match(/\(~?(\d+)\s*min\)$/i);
    return sum + (match ? parseInt(match[1], 10) : 10);
  }, 0);

  return (
    <div style={styles.templateCard}>
      <div style={styles.templateInfo}>
        <p style={styles.templateName}>{template.name}</p>
        <div style={styles.templateMeta}>
          <span>{totalTime}m</span>
          <span>{template.subtasks.length} steps</span>
          {template.usedCount > 0 && (
            <span>used {template.usedCount}x</span>
          )}
        </div>
      </div>
      <div style={styles.templateActions}>
        <button onClick={onUse} style={styles.useBtn}>
          Use
        </button>
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} style={styles.deleteTemplateBtn}>
            ×
          </button>
        ) : (
          <button onClick={onDelete} style={styles.confirmDeleteBtn}>
            Delete?
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: "1.5rem",
    background: "var(--bg-primary)",
  },
  loading: {
    textAlign: "center",
    padding: "3rem",
    color: "var(--fg-muted)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1.5rem",
    paddingBottom: "1rem",
    borderBottom: "1px solid var(--border)",
  },
  backBtn: {
    padding: "0.5rem 0.75rem",
    fontSize: "0.85rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
    flex: 1,
  },
  stats: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
  },
  columns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1rem",
    minHeight: "calc(100vh - 120px)",
  },
  column: {
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
    overflow: "hidden",
  },
  columnHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    borderBottom: "1px solid var(--border)",
  },
  columnHeaderActive: {
    borderBottom: "2px solid #FFFF00",
  },
  columnHeaderBacklog: {
    borderBottom: "2px solid #FFFFFF",
  },
  columnHeaderDone: {
    borderBottom: "2px solid #28a745",
  },
  columnTitle: {
    fontSize: "0.85rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
  },
  columnCount: {
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
    background: "var(--bg-tertiary)",
    padding: "0.125rem 0.5rem",
    borderRadius: "10px",
  },
  columnContent: {
    flex: 1,
    padding: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    overflowY: "auto",
  },
  emptyText: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    textAlign: "center",
    padding: "1rem",
    fontStyle: "italic",
  },
  taskCard: {
    padding: "0.75rem",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 0.15s",
    display: "flex",
    flexDirection: "column",
    gap: "0.375rem",
  },
  taskCardActive: {
    borderColor: "#FFFF00",
    borderWidth: "2px",
    background: "rgba(255, 255, 0, 0.08)",
  },
  inProgressTag: {
    display: "inline-block",
    fontSize: "0.65rem",
    fontWeight: 600,
    color: "#000",
    background: "#FFFF00",
    padding: "0.125rem 0.5rem",
    borderRadius: "4px",
    marginBottom: "0.25rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  taskCardDone: {
    opacity: 0.6,
    cursor: "default",
  },
  taskText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "var(--fg-primary)",
    lineHeight: 1.3,
  },
  taskTextDone: {
    textDecoration: "line-through",
  },
  taskMeta: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  taskTime: {
    color: "var(--fg-muted)",
  },
  taskProgress: {
    color: "var(--fg-muted)",
  },
  miniProgress: {
    height: "2px",
    background: "var(--border)",
    borderRadius: "1px",
    overflow: "hidden",
    marginTop: "0.25rem",
  },
  miniProgressFill: {
    height: "100%",
    background: "var(--fg-primary)",
    borderRadius: "1px",
    transition: "width 0.3s",
  },
  miniProgressFillActive: {
    background: "#FFFF00",
  },
  templateSection: {
    marginTop: "1.5rem",
    paddingTop: "1rem",
    borderTop: "1px solid var(--border)",
  },
  templateToggle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    padding: "0.75rem 1rem",
    fontSize: "0.9rem",
    fontWeight: 500,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--fg-primary)",
    cursor: "pointer",
  },
  templateList: {
    marginTop: "0.75rem",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "0.5rem",
  },
  templateCard: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.75rem 1rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    margin: 0,
    fontSize: "0.85rem",
    color: "var(--fg-primary)",
  },
  templateMeta: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.25rem",
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  templateActions: {
    display: "flex",
    gap: "0.375rem",
  },
  useBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    background: "var(--fg-primary)",
    border: "none",
    borderRadius: "4px",
    color: "var(--bg-primary)",
    cursor: "pointer",
    fontWeight: 500,
  },
  deleteTemplateBtn: {
    padding: "0.375rem 0.5rem",
    fontSize: "0.9rem",
    background: "none",
    border: "none",
    color: "var(--fg-muted)",
    cursor: "pointer",
    opacity: 0.5,
  },
  confirmDeleteBtn: {
    padding: "0.375rem 0.5rem",
    fontSize: "0.75rem",
    background: "#dc3545",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
  },
};
