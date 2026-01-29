"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Task } from "../lib/types";

interface BragEntry {
  title: string;
  bullet: string;
  metrics: string;
  category: string;
  tags?: string[];
  overallImpact?: string;
  taskIds: number[];
  frequency: string;
  confidence?: "high" | "medium" | "low";
}

interface BragData {
  entries: BragEntry[];
  summary: {
    totalTasks: number;
    totalTimeInvested: string;
    topCategory: string;
    overallImpact: string;
  };
  source: "ollama" | "fallback";
  generatedAt?: string;
}

export default function BragPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bragData, setBragData] = useState<BragData | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedIndices, setAcceptedIndices] = useState<Set<number>>(new Set());
  const [accepting, setAccepting] = useState<number | null>(null);
  const [savedBrags, setSavedBrags] = useState<string>("");
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [deletingSavedTitle, setDeletingSavedTitle] = useState<string | null>(null);
  const [confirmDeleteSaved, setConfirmDeleteSaved] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; bullet: string; metrics: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Load completed tasks, saved brags, and generated brag data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [tasksRes, bragsRes] = await Promise.all([
          fetch("/api/tasks", { cache: "no-store" }),
          fetch("/api/brag", { cache: "no-store" }),
        ]);

        const tasks: Task[] = await tasksRes.json();
        const done = tasks.filter(t => t.completedAt);
        setCompletedTasks(done);

        const bragsData = await bragsRes.json();
        if (bragsData.content) {
          setSavedBrags(bragsData.content);
        }

        // Load previously generated brag data if available
        if (bragsData.generated) {
          setBragData({
            entries: bragsData.generated.entries,
            summary: bragsData.generated.summary,
            source: bragsData.generated.source,
            generatedAt: bragsData.generated.generatedAt,
          });
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const generateBragList = useCallback(async () => {
    if (completedTasks.length === 0) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/brag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: completedTasks }),
      });

      if (!res.ok) throw new Error("Failed to generate brag list");

      const data = await res.json();
      setBragData(data);
    } catch (err) {
      console.error("Brag generation failed:", err);
      setError("Failed to generate brag list. Try again.");
    } finally {
      setGenerating(false);
    }
  }, [completedTasks]);

  const copyAllToClipboard = async () => {
    if (!bragData) return;

    const text = formatBragListForCopy(bragData);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyEntryToClipboard = async (entry: BragEntry) => {
    const text = `${entry.bullet}\n   Metrics: ${entry.metrics}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const acceptEntry = async (entry: BragEntry, index: number) => {
    if (acceptedIndices.has(index)) return;

    setAccepting(index);
    try {
      const res = await fetch("/api/brag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setAcceptedIndices(prev => new Set(Array.from(prev).concat(index)));
      // Refresh saved brags
      const bragsRes = await fetch("/api/brag", { cache: "no-store" });
      const bragsData = await bragsRes.json();
      if (bragsData.content) {
        setSavedBrags(bragsData.content);
      }
    } catch (err) {
      console.error("Failed to accept entry:", err);
      setError("Failed to save entry to brag list");
    } finally {
      setAccepting(null);
    }
  };

  const deleteBragEntry = async (index: number) => {
    setDeletingIndex(index);
    try {
      const res = await fetch("/api/brag", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Update local state - remove the entry
      if (bragData) {
        const updatedEntries = bragData.entries.filter((_, i) => i !== index);
        setBragData({ ...bragData, entries: updatedEntries });
      }
      setConfirmDeleteIndex(null);
    } catch (err) {
      console.error("Failed to delete brag:", err);
      setError("Failed to delete brag entry");
    } finally {
      setDeletingIndex(null);
    }
  };

  const deleteSavedBrag = async (title: string, savedIndex: number) => {
    setDeletingSavedTitle(title);
    try {
      const res = await fetch("/api/brag/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: savedIndex }),
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Refresh saved brags
      const bragsRes = await fetch("/api/brag", { cache: "no-store" });
      const bragsData = await bragsRes.json();
      setSavedBrags(bragsData.content || "");
      setConfirmDeleteSaved(null);
    } catch (err) {
      console.error("Failed to delete saved brag:", err);
      setError("Failed to delete saved brag entry");
    } finally {
      setDeletingSavedTitle(null);
    }
  };

  const startEditing = (index: number) => {
    if (!bragData) return;
    const entry = bragData.entries[index];
    setEditingIndex(index);
    setEditForm({
      title: entry.title,
      bullet: entry.bullet,
      metrics: entry.metrics,
    });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (editingIndex === null || !editForm || !bragData) return;

    setSaving(true);
    try {
      const updatedEntry = {
        ...bragData.entries[editingIndex],
        title: editForm.title,
        bullet: editForm.bullet,
        metrics: editForm.metrics,
      };

      const res = await fetch("/api/brag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: updatedEntry,
          action: "update",
          index: editingIndex,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Update local state
      const updatedEntries = [...bragData.entries];
      updatedEntries[editingIndex] = updatedEntry;
      setBragData({ ...bragData, entries: updatedEntries });

      setEditingIndex(null);
      setEditForm(null);
    } catch (err) {
      console.error("Failed to save edit:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={styles.main}>
        <div style={styles.loading}>Loading completed tasks...</div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <button onClick={() => router.push("/")} style={styles.backBtn}>
          ← Back
        </button>
        <h1 style={styles.title}>Brag List</h1>
        <div style={styles.headerActions}>
          {bragData && (
            <button onClick={copyAllToClipboard} style={styles.copyAllBtn}>
              {copied ? "Copied!" : "Copy All"}
            </button>
          )}
        </div>
      </header>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        <span style={styles.stat}>
          <strong>{completedTasks.length}</strong> completed tasks
        </span>
        {bragData && bragData.entries.length > 0 && (
          <>
            <span style={styles.statDivider}>|</span>
            <span style={styles.stat}>
              <strong>{bragData.summary.totalTimeInvested}</strong> invested
            </span>
            <span style={styles.statDivider}>|</span>
            <span style={styles.stat}>
              Top: <strong>{bragData.summary.topCategory}</strong>
            </span>
          </>
        )}
      </div>

      {/* Generate button */}
      {completedTasks.length > 0 && !bragData && (
        <div style={styles.generateSection}>
          <p style={styles.generateHint}>
            Transform your completed tasks into professional achievement statements.
          </p>
          <button
            onClick={generateBragList}
            disabled={generating}
            style={styles.generateBtn}
          >
            {generating ? "Generating..." : "Generate Brag List"}
          </button>
        </div>
      )}

      {/* Regenerate button */}
      {bragData && (
        <div style={styles.regenerateRow}>
          <button
            onClick={generateBragList}
            disabled={generating}
            style={styles.regenerateBtn}
          >
            {generating ? "Regenerating..." : "Update List"}
          </button>
          <span style={styles.sourceTag}>
            {bragData.source === "ollama" ? "AI Generated" : "Basic Format"}
          </span>
          {bragData.generatedAt && (
            <span style={styles.generatedAt}>
              Generated {new Date(bragData.generatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div style={styles.error}>{error}</div>
      )}

      {/* Empty state */}
      {completedTasks.length === 0 && (
        <div style={styles.empty}>
          <p style={styles.emptyText}>No completed tasks yet.</p>
          <p style={styles.emptyHint}>
            Complete some tasks in focus mode to build your brag list.
          </p>
        </div>
      )}

      {/* Brag entries */}
      {bragData && bragData.entries.length > 0 && (
        <div style={styles.entriesList}>
          {bragData.entries.map((entry, i) => {
            // Get tags - use entry.tags if available, otherwise split category
            const displayTags = entry.tags && entry.tags.length > 0
              ? entry.tags
              : entry.category.split(/[,|]/).map(t => t.trim()).filter(Boolean);
            const isEditing = editingIndex === i;

            return (
              <div key={i} style={{
                ...styles.entryCard,
                ...(acceptedIndices.has(i) ? styles.entryCardAccepted : {}),
                ...(isEditing ? styles.entryCardEditing : {}),
              }}>
                <div style={styles.entryHeader}>
                  <div style={styles.tagsRow}>
                    {displayTags.map((tag, ti) => (
                      <span key={ti} style={styles.categoryBadge}>{tag.toUpperCase()}</span>
                    ))}
                  </div>
                  <span style={styles.frequencyBadge}>{entry.frequency}</span>
                  {acceptedIndices.has(i) && (
                    <span style={styles.acceptedBadge}>✓ Saved</span>
                  )}
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => startEditing(i)}
                        style={styles.editBtn}
                        title="Edit this entry"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => acceptEntry(entry, i)}
                        disabled={acceptedIndices.has(i) || accepting === i}
                        style={acceptedIndices.has(i) ? styles.acceptBtnDisabled : styles.acceptBtn}
                        title="Save to brag-list.md"
                      >
                        {accepting === i ? "Saving..." : acceptedIndices.has(i) ? "Saved" : "Accept"}
                      </button>
                      {confirmDeleteIndex === i ? (
                        <div style={styles.deleteConfirm}>
                          <span style={styles.deleteConfirmText}>Delete?</span>
                          <button
                            onClick={() => deleteBragEntry(i)}
                            disabled={deletingIndex === i}
                            style={styles.deleteConfirmYes}
                          >
                            {deletingIndex === i ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteIndex(null)}
                            style={styles.deleteConfirmNo}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteIndex(i)}
                          style={styles.deleteBtn}
                          title="Delete this entry"
                        >
                          ×
                        </button>
                      )}
                    </>
                  )}
                </div>

                {isEditing && editForm ? (
                  <div style={styles.editForm}>
                    <label style={styles.editLabel}>
                      Title
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        style={styles.editInput}
                      />
                    </label>
                    <label style={styles.editLabel}>
                      Bullet
                      <textarea
                        value={editForm.bullet}
                        onChange={(e) => setEditForm({ ...editForm, bullet: e.target.value })}
                        style={styles.editTextarea}
                        rows={3}
                      />
                    </label>
                    <label style={styles.editLabel}>
                      Metrics
                      <input
                        type="text"
                        value={editForm.metrics}
                        onChange={(e) => setEditForm({ ...editForm, metrics: e.target.value })}
                        style={styles.editInput}
                      />
                    </label>
                    <div style={styles.editActions}>
                      <button
                        onClick={saveEdit}
                        disabled={saving}
                        style={styles.saveEditBtn}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        onClick={cancelEditing}
                        style={styles.cancelEditBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3 style={styles.entryTitle}>{entry.title}</h3>
                    <p style={styles.entryBullet}>{entry.bullet}</p>
                    {entry.overallImpact && (
                      <p style={styles.entryImpact}><strong>Impact:</strong> {entry.overallImpact}</p>
                    )}
                    <p style={styles.entryMetrics}>{entry.metrics}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary - only show when there are entries */}
      {bragData && bragData.entries.length > 0 && (
        <div style={styles.summaryCard}>
          <h3 style={styles.summaryTitle}>Overall Impact</h3>
          <p style={styles.summaryText}>{bragData.summary.overallImpact}</p>
        </div>
      )}

      {/* Saved Brags */}
      {savedBrags && (
        <div style={styles.savedSection}>
          <h2 style={styles.savedTitle}>Saved Brags</h2>
          <div style={styles.savedContent}>
            {savedBrags.split(/^## /m).filter(Boolean).slice(1).map((entry, i) => {
              const lines = entry.trim().split("\n");
              const title = lines[0] || "";
              const bullet = lines.find(l => l.startsWith("> "))?.slice(2) || "";
              const metrics = lines.find(l => l.startsWith("*Metrics:*"))?.slice(10) || "";

              // Parse tags from **Tags:** line
              const tagsLine = lines.find(l => l.startsWith("**Tags:**"));
              const tags = tagsLine
                ? tagsLine.replace("**Tags:**", "").trim().split(/\s*\|\s*/).filter(Boolean)
                : [];

              // Parse overall impact
              const impactLine = lines.find(l => l.startsWith("**Overall Impact:**"));
              const overallImpact = impactLine
                ? impactLine.replace("**Overall Impact:**", "").trim()
                : "";

              // Parse frequency/confidence
              const freqLine = lines.find(l => l.startsWith("**Frequency:**"));
              const frequency = freqLine
                ? freqLine.match(/\*\*Frequency:\*\*\s*([^|]+)/)?.[1]?.trim() || ""
                : "";
              const confidence = freqLine
                ? freqLine.match(/\*\*Confidence:\*\*\s*(\w+)/)?.[1] || ""
                : "";

              // Legacy format: **Category:** line
              const legacyMeta = lines.find(l => l.startsWith("**Category:**"));
              const legacyCategory = legacyMeta
                ? legacyMeta.match(/\*\*Category:\*\*\s*([^|]+)/)?.[1]?.trim() || ""
                : "";

              // Use tags if present, otherwise fall back to legacy category
              const displayTags = tags.length > 0 ? tags : legacyCategory ? [legacyCategory] : [];

              const dateMatch = entry.match(/\*Accepted on (\d{4}-\d{2}-\d{2})\*/);
              const date = dateMatch ? dateMatch[1] : "";
              const isConfirming = confirmDeleteSaved === `${title}-${i}`;
              const isDeleting = deletingSavedTitle === title;

              return (
                <div key={i} style={styles.savedEntry}>
                  <div style={styles.savedEntryHeader}>
                    <span style={styles.savedEntryTitle}>{title}</span>
                    <div style={styles.savedEntryActions}>
                      {date && <span style={styles.savedDate}>{date}</span>}
                      {isConfirming ? (
                        <div style={styles.deleteConfirm}>
                          <span style={styles.deleteConfirmText}>Delete?</span>
                          <button
                            onClick={() => deleteSavedBrag(title, i)}
                            disabled={isDeleting}
                            style={styles.deleteConfirmYes}
                          >
                            {isDeleting ? "..." : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteSaved(null)}
                            style={styles.deleteConfirmNo}
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteSaved(`${title}-${i}`)}
                          style={styles.deleteBtn}
                          title="Delete this brag"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                  {displayTags.length > 0 && (
                    <div style={styles.savedTagsRow}>
                      {displayTags.map((tag, ti) => (
                        <span key={ti} style={styles.savedTag}>{tag.toUpperCase()}</span>
                      ))}
                      {frequency && <span style={styles.savedFrequency}>{frequency}</span>}
                      {confidence && <span style={styles.savedConfidence}>{confidence}</span>}
                    </div>
                  )}
                  {bullet && <p style={styles.savedBullet}>{bullet}</p>}
                  {overallImpact && (
                    <p style={styles.savedImpact}><strong>Overall Impact:</strong> {overallImpact}</p>
                  )}
                  {metrics && <p style={styles.savedMetrics}>{metrics}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}

function formatBragListForCopy(data: BragData): string {
  const lines = [
    "ACCOMPLISHMENTS",
    "===============",
    "",
  ];

  for (const entry of data.entries) {
    lines.push(`[${entry.category}] ${entry.title}`);
    lines.push(`  ${entry.bullet}`);
    lines.push(`  Metrics: ${entry.metrics}`);
    lines.push("");
  }

  lines.push("---");
  lines.push(`Summary: ${data.summary.overallImpact}`);
  lines.push(`Total time invested: ${data.summary.totalTimeInvested}`);

  return lines.join("\n");
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "1.5rem",
    minHeight: "100vh",
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
    marginBottom: "1rem",
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
    fontSize: "1.5rem",
    fontWeight: 700,
    color: "var(--fg-primary)",
    flex: 1,
  },
  headerActions: {
    display: "flex",
    gap: "0.5rem",
  },
  copyAllBtn: {
    padding: "0.5rem 1rem",
    fontSize: "0.85rem",
    background: "#28a745",
    border: "none",
    borderRadius: "6px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  statsBar: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 1rem",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },
  stat: {
    fontSize: "0.85rem",
    color: "var(--fg-secondary)",
  },
  statDivider: {
    color: "var(--border)",
  },
  generateSection: {
    textAlign: "center",
    padding: "2rem",
    background: "var(--bg-secondary)",
    borderRadius: "10px",
    marginBottom: "1rem",
  },
  generateHint: {
    fontSize: "0.9rem",
    color: "var(--fg-muted)",
    marginBottom: "1rem",
  },
  generateBtn: {
    padding: "0.75rem 2rem",
    fontSize: "1rem",
    background: "#28a745",
    border: "none",
    borderRadius: "8px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  regenerateRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  regenerateBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  sourceTag: {
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
    padding: "0.25rem 0.5rem",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
  },
  generatedAt: {
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  error: {
    padding: "0.75rem 1rem",
    background: "rgba(220, 53, 69, 0.1)",
    border: "1px solid rgba(220, 53, 69, 0.3)",
    borderRadius: "6px",
    color: "#dc3545",
    fontSize: "0.85rem",
    marginBottom: "1rem",
  },
  empty: {
    padding: "3rem 1.5rem",
    textAlign: "center",
    background: "var(--bg-secondary)",
    borderRadius: "10px",
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
  entriesList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginBottom: "1rem",
  },
  entryCard: {
    padding: "1rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
    flexWrap: "wrap",
  },
  tagsRow: {
    display: "flex",
    gap: "0.25rem",
    flexWrap: "wrap",
  },
  categoryBadge: {
    fontSize: "0.65rem",
    padding: "0.125rem 0.5rem",
    background: "rgba(40, 167, 69, 0.15)",
    color: "#28a745",
    borderRadius: "10px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  frequencyBadge: {
    fontSize: "0.65rem",
    padding: "0.125rem 0.5rem",
    background: "var(--bg-tertiary)",
    color: "var(--fg-muted)",
    borderRadius: "10px",
  },
  copyEntryBtn: {
    marginLeft: "auto",
    padding: "0.25rem 0.5rem",
    fontSize: "0.7rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  acceptBtn: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.7rem",
    background: "#28a745",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  acceptBtnDisabled: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.7rem",
    background: "var(--bg-tertiary)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "default",
  },
  acceptedBadge: {
    fontSize: "0.65rem",
    padding: "0.125rem 0.5rem",
    background: "rgba(40, 167, 69, 0.15)",
    color: "#28a745",
    borderRadius: "10px",
    fontWeight: 500,
  },
  entryCardAccepted: {
    borderColor: "rgba(40, 167, 69, 0.4)",
    background: "rgba(40, 167, 69, 0.05)",
  },
  entryCardEditing: {
    borderColor: "#007bff",
    background: "rgba(0, 123, 255, 0.05)",
  },
  editBtn: {
    marginLeft: "auto",
    padding: "0.25rem 0.5rem",
    fontSize: "0.7rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
  editLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--fg-secondary)",
  },
  editInput: {
    padding: "0.5rem",
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    background: "var(--bg-primary)",
    color: "var(--fg-primary)",
  },
  editTextarea: {
    padding: "0.5rem",
    fontSize: "0.85rem",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    background: "var(--bg-primary)",
    color: "var(--fg-primary)",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  editActions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "0.25rem",
  },
  saveEditBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    background: "#28a745",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 500,
  },
  cancelEditBtn: {
    padding: "0.375rem 0.75rem",
    fontSize: "0.8rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-secondary)",
    cursor: "pointer",
  },
  entryTitle: {
    margin: "0 0 0.375rem 0",
    fontSize: "0.95rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
  },
  entryBullet: {
    margin: "0 0 0.375rem 0",
    fontSize: "0.85rem",
    color: "var(--fg-secondary)",
    lineHeight: 1.4,
  },
  entryImpact: {
    margin: "0.5rem 0",
    fontSize: "0.8rem",
    color: "var(--fg-secondary)",
    lineHeight: 1.4,
    padding: "0.5rem",
    background: "rgba(40, 167, 69, 0.08)",
    borderRadius: "4px",
    borderLeft: "3px solid #28a745",
  },
  entryMetrics: {
    margin: 0,
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
    fontStyle: "italic",
  },
  summaryCard: {
    padding: "1rem",
    background: "rgba(40, 167, 69, 0.1)",
    border: "1px solid rgba(40, 167, 69, 0.3)",
    borderRadius: "8px",
  },
  summaryTitle: {
    margin: "0 0 0.5rem 0",
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "#28a745",
  },
  summaryText: {
    margin: 0,
    fontSize: "0.85rem",
    color: "var(--fg-primary)",
    lineHeight: 1.4,
  },
  savedSection: {
    marginTop: "2rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid var(--border)",
  },
  savedTitle: {
    margin: "0 0 1rem 0",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
  },
  savedContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  savedEntry: {
    padding: "0.875rem 1rem",
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
  },
  savedEntryHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "0.5rem",
    gap: "0.5rem",
  },
  savedEntryTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
    flex: 1,
  },
  savedEntryActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  savedDate: {
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  deleteBtn: {
    padding: "0.125rem 0.375rem",
    fontSize: "0.85rem",
    background: "none",
    border: "1px solid transparent",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
    opacity: 0.6,
    transition: "opacity 0.15s, color 0.15s",
  },
  deleteConfirm: {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
  },
  deleteConfirmText: {
    fontSize: "0.7rem",
    color: "var(--fg-muted)",
  },
  deleteConfirmYes: {
    padding: "0.125rem 0.375rem",
    fontSize: "0.7rem",
    background: "#dc3545",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
  },
  deleteConfirmNo: {
    padding: "0.125rem 0.375rem",
    fontSize: "0.7rem",
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--fg-muted)",
    cursor: "pointer",
  },
  savedTagsRow: {
    display: "flex",
    gap: "0.25rem",
    flexWrap: "wrap",
    marginBottom: "0.5rem",
  },
  savedTag: {
    fontSize: "0.6rem",
    padding: "0.125rem 0.375rem",
    background: "rgba(40, 167, 69, 0.15)",
    color: "#28a745",
    borderRadius: "8px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  savedFrequency: {
    fontSize: "0.6rem",
    padding: "0.125rem 0.375rem",
    background: "var(--bg-tertiary)",
    color: "var(--fg-muted)",
    borderRadius: "8px",
  },
  savedConfidence: {
    fontSize: "0.6rem",
    padding: "0.125rem 0.375rem",
    background: "var(--bg-tertiary)",
    color: "var(--fg-muted)",
    borderRadius: "8px",
    textTransform: "capitalize",
  },
  savedBullet: {
    margin: "0 0 0.375rem 0",
    fontSize: "0.85rem",
    color: "var(--fg-secondary)",
    lineHeight: 1.4,
  },
  savedImpact: {
    margin: "0.375rem 0",
    fontSize: "0.8rem",
    color: "var(--fg-secondary)",
    lineHeight: 1.4,
    padding: "0.375rem 0.5rem",
    background: "rgba(40, 167, 69, 0.08)",
    borderRadius: "4px",
    borderLeft: "3px solid #28a745",
  },
  savedMetrics: {
    margin: "0 0 0.25rem 0",
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
    fontStyle: "italic",
  },
};
