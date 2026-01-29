"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Template } from "../lib/types";
import { createTaskFromTemplate, removeTemplate } from "../lib/actions";

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await fetch("/api/templates", { cache: "no-store" });
        const data = await res.json();
        setTemplates(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load templates:", err);
      } finally {
        setLoading(false);
      }
    };
    loadTemplates();
  }, []);

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
      setTemplates(prev => prev.filter(t => t.id !== templateId));
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
        <h1 style={styles.title}>Template Library</h1>
        <div style={styles.stats}>
          {templates.length} template{templates.length !== 1 ? "s" : ""}
        </div>
      </header>

      <p style={styles.description}>
        Reusable task breakdowns. Save any task as a template from its card menu.
      </p>

      {templates.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyTitle}>No templates yet</p>
          <p style={styles.emptyText}>
            Save a task as a template from the task card menu to build your library.
          </p>
        </div>
      ) : (
        <div style={styles.tileGrid}>
          {templates.map(template => (
            <TemplateTile
              key={template.id}
              template={template}
              onUse={() => handleUseTemplate(template.id)}
              onDelete={() => handleDeleteTemplate(template.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function TemplateTile({
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

  // Show first 3 steps as preview
  const previewSteps = template.subtasks.slice(0, 3);
  const moreCount = template.subtasks.length - 3;

  return (
    <div style={styles.tile}>
      <div style={styles.tileHeader}>
        <p style={styles.tileName}>{template.name}</p>
        <div style={styles.tileMeta}>
          <span style={styles.metaItem}>{totalTime}m</span>
          <span style={styles.metaItem}>{template.subtasks.length} steps</span>
          {template.usedCount > 0 && (
            <span style={styles.metaItem}>used {template.usedCount}×</span>
          )}
        </div>
        {template.tags && template.tags.length > 0 && (
          <div style={styles.tags}>
            {template.tags.map(tag => (
              <span key={tag} style={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>

      {template.coreWhy && (
        <p style={styles.coreWhy}>{template.coreWhy}</p>
      )}

      <div style={styles.preview}>
        {previewSteps.map((st, idx) => (
          <div key={idx} style={styles.previewStep}>
            <span style={styles.stepNum}>{idx + 1}.</span>
            <div style={styles.stepContent}>
              <span style={styles.stepText}>{st.text.replace(/\s*\(~?\d+\s*min\)$/i, "")}</span>
              {(st.cta || st.deliverable) && (
                <div style={styles.stepHints}>
                  {st.cta && <span style={styles.ctaHint}>▸ {st.cta}</span>}
                  {st.deliverable && <span style={styles.deliverableHint}>✔ {st.deliverable}</span>}
                </div>
              )}
            </div>
          </div>
        ))}
        {moreCount > 0 && (
          <p style={styles.moreSteps}>+{moreCount} more step{moreCount > 1 ? "s" : ""}</p>
        )}
      </div>

      {template.doneMeans && template.doneMeans.length > 0 && (
        <div style={styles.doneMeans}>
          <span style={styles.doneMeansLabel}>Done:</span>
          {template.doneMeans.slice(0, 2).map((dm, idx) => (
            <span key={idx} style={styles.doneMeansItem}>{dm}</span>
          ))}
        </div>
      )}

      <div style={styles.tileActions}>
        <button onClick={onUse} style={styles.useBtn}>
          Use Template
        </button>
        {!showConfirm ? (
          <button onClick={() => setShowConfirm(true)} style={styles.deleteBtn}>
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
    maxWidth: "1200px",
    margin: "0 auto",
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
    marginBottom: "0.75rem",
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
  description: {
    fontSize: "0.85rem",
    color: "var(--fg-muted)",
    marginBottom: "1.5rem",
  },
  emptyState: {
    textAlign: "center",
    padding: "3rem 1rem",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
    border: "1px dashed var(--border)",
  },
  emptyTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "1rem",
    color: "var(--fg-primary)",
  },
  emptyText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "var(--fg-muted)",
  },
  tileGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
    gap: "1rem",
  },
  tile: {
    display: "flex",
    flexDirection: "column",
    padding: "1rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    transition: "border-color 0.15s",
  },
  tileHeader: {
    marginBottom: "0.5rem",
  },
  tileName: {
    margin: 0,
    fontSize: "1rem",
    fontWeight: 500,
    color: "var(--fg-primary)",
    lineHeight: 1.3,
  },
  tileMeta: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.375rem",
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
  },
  metaItem: {},
  tags: {
    display: "flex",
    gap: "0.375rem",
    marginTop: "0.5rem",
    flexWrap: "wrap",
  },
  tag: {
    fontSize: "0.65rem",
    padding: "0.125rem 0.375rem",
    background: "rgba(255, 255, 0, 0.1)",
    border: "1px solid rgba(255, 255, 0, 0.3)",
    borderRadius: "3px",
    color: "#FFFF00",
  },
  coreWhy: {
    margin: "0 0 0.75rem 0",
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    fontStyle: "italic",
    lineHeight: 1.4,
  },
  preview: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    paddingTop: "0.5rem",
    borderTop: "1px solid var(--border)",
  },
  previewStep: {
    display: "flex",
    gap: "0.5rem",
  },
  stepNum: {
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
    width: "1rem",
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: "0.8rem",
    color: "var(--fg-primary)",
    lineHeight: 1.3,
  },
  stepHints: {
    display: "flex",
    gap: "0.75rem",
    marginTop: "0.125rem",
    opacity: 0.7,
  },
  ctaHint: {
    fontSize: "0.7rem",
    color: "#FFFF00",
  },
  deliverableHint: {
    fontSize: "0.7rem",
    color: "#888",
  },
  moreSteps: {
    margin: "0.25rem 0 0 0",
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
    fontStyle: "italic",
  },
  doneMeans: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginTop: "0.75rem",
    paddingTop: "0.5rem",
    borderTop: "1px dashed var(--border)",
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  doneMeansLabel: {
    fontWeight: 500,
  },
  doneMeansItem: {
    color: "var(--fg-secondary)",
  },
  tileActions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "1rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid var(--border)",
  },
  useBtn: {
    flex: 1,
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    background: "#FFFF00",
    border: "none",
    borderRadius: "4px",
    color: "#000",
    cursor: "pointer",
    fontWeight: 500,
  },
  deleteBtn: {
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  confirmDeleteBtn: {
    padding: "0.5rem 0.75rem",
    fontSize: "0.75rem",
    background: "#dc3545",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
  },
};
