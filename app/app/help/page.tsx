"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { checkIsSampleData, clearSampleData, generateSampleData } from "../lib/actions";

export default function HelpPage() {
  const [isSample, setIsSample] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkIsSampleData().then(setIsSample);
  }, []);

  const handleClearData = async () => {
    if (confirm("Remove all tasks and start fresh? This cannot be undone.")) {
      setLoading(true);
      await clearSampleData();
      setIsSample(false);
      setLoading(false);
      window.location.href = "/";
    }
  };

  const handleLoadSample = async () => {
    if (confirm("Load sample tasks? This will replace your current tasks.")) {
      setLoading(true);
      await generateSampleData();
      setIsSample(true);
      setLoading(false);
      window.location.href = "/";
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link href="/" style={styles.backBtn}>
          &larr; Home
        </Link>
        <h1 style={styles.title}>How to Use Unplaned</h1>
        <p style={styles.subtitle}>Focus on one task at a time. Finish what you start.</p>
      </header>

      {/* Sample Data Management */}
      <section style={styles.sampleSection}>
        <div style={styles.sampleContent}>
          <div style={styles.sampleText}>
            <strong style={styles.sampleTitle}>
              {isSample ? "Sample data loaded" : "Try with sample tasks"}
            </strong>
            <span style={styles.sampleHint}>
              {isSample
                ? "These are example tasks to help you explore. Clear them when ready."
                : "Load example tasks to see how Unplaned works."}
            </span>
          </div>
          <div style={styles.sampleButtons}>
            {isSample ? (
              <button
                onClick={handleClearData}
                disabled={loading}
                style={styles.clearBtn}
              >
                {loading ? "Clearing..." : "Start fresh"}
              </button>
            ) : (
              <>
                <button
                  onClick={handleLoadSample}
                  disabled={loading}
                  style={styles.loadBtn}
                >
                  {loading ? "Loading..." : "Load samples"}
                </button>
                <button
                  onClick={handleClearData}
                  disabled={loading}
                  style={styles.clearBtnSecondary}
                >
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Workflow overview */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>The Workflow</h2>
        <div style={styles.workflow}>
          <div style={styles.step}>
            <span style={styles.stepNumber}>1</span>
            <span style={styles.stepLabel}>Add Task</span>
            <p style={styles.stepDesc}>What do you want to do?</p>
          </div>
          <span style={styles.arrow}>&rarr;</span>
          <div style={styles.step}>
            <span style={styles.stepNumber}>2</span>
            <span style={styles.stepLabel}>Focus</span>
            <p style={styles.stepDesc}>Work through steps</p>
          </div>
          <span style={styles.arrow}>&rarr;</span>
          <div style={styles.step}>
            <span style={styles.stepNumber}>3</span>
            <span style={styles.stepLabel}>Done</span>
            <p style={styles.stepDesc}>Complete & reflect</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Features</h2>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Add a Task</h3>
          <p style={styles.featureDesc}>
            Type what you want to accomplish. AI will break it into manageable steps with time estimates.
            You can adjust, reorder, or add steps manually.
          </p>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Brain Dump</h3>
          <p style={styles.featureDesc}>
            Quickly add multiple tasks from a brain dump, todo list, or notes:
          </p>
          <ul style={styles.list}>
            <li><strong>Click &quot;Brain Dump&quot;</strong> on the home page</li>
            <li><strong>Paste your todos</strong> - bullets, numbered lists, or plain text</li>
            <li><strong>Click &quot;Parse Tasks&quot;</strong> - AI identifies tasks, fixes typos, suggests durations</li>
            <li><strong>Review &amp; edit</strong> - adjust titles, durations, uncheck tasks to skip</li>
            <li><strong>Click &quot;Create N Tasks&quot;</strong> - each task gets full AI breakdown</li>
          </ul>
          <p style={{...styles.featureDesc, marginTop: "0.75rem"}}>
            Works offline too - if AI is unavailable, tasks are parsed line by line with default settings.
          </p>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Focus Sessions</h3>
          <p style={styles.featureDesc}>
            Press the play button to start a focus session. You&apos;ll see:
          </p>
          <ul style={styles.list}>
            <li><strong>Your &quot;Why&quot;</strong> - A motivational reminder at the top</li>
            <li><strong>Timer</strong> - Countdown based on estimated time</li>
            <li><strong>Steps</strong> - Click to start working, click again to complete</li>
            <li><strong>Progress tracking</strong> - See how long each step takes</li>
          </ul>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>AI Assistance</h3>
          <p style={styles.featureDesc}>
            Local AI (Ollama) helps with:
          </p>
          <ul style={styles.list}>
            <li><strong>Task breakdown</strong> - Automatically splits your task into steps</li>
            <li><strong>Time estimates</strong> - Realistic estimates for each step</li>
            <li><strong>Analysis</strong> - Click &quot;Analyze&quot; to enrich steps with CTA, deliverable, and soWhat</li>
            <li><strong>Second opinion</strong> - Get external AI feedback (anonymized)</li>
          </ul>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Step Details</h3>
          <p style={styles.featureDesc}>
            Each step can have rich context to help you execute:
          </p>
          <ul style={styles.list}>
            <li><strong>▸ CTA</strong> - The immediate action to START (e.g., &quot;Open Gmail&quot;, &quot;Call client&quot;)</li>
            <li><strong>✔ Deliverable</strong> - Tangible proof you&apos;re done (e.g., &quot;Email in outbox&quot;, &quot;3 bullet points&quot;)</li>
            <li><strong>★ SoWhat</strong> - Pain avoided by completing (e.g., &quot;No last-minute scramble&quot;)</li>
          </ul>
          <p style={{...styles.featureDesc, marginTop: "0.75rem"}}>
            Use &quot;Analyze&quot; on any task to auto-generate these for each step.
          </p>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Definition of Done</h3>
          <p style={styles.featureDesc}>
            Tasks can have &quot;doneMeans&quot; - the ripple effects beyond the core work:
          </p>
          <ul style={styles.list}>
            <li>Notify someone (e.g., &quot;Manager notified&quot;)</li>
            <li>Update a system (e.g., &quot;Logged in Salesforce&quot;)</li>
            <li>Send follow-up (e.g., &quot;Confirmation email sent&quot;)</li>
          </ul>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Task Kanban</h3>
          <p style={styles.featureDesc}>
            See all your tasks organized in three columns: Backlog, In Progress, and Done.
            Great for getting a bird&apos;s eye view without losing focus.
          </p>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Template Library</h3>
          <p style={styles.featureDesc}>
            Save any task as a reusable template:
          </p>
          <ul style={styles.list}>
            <li>Click the menu on any task card and select &quot;Save as Template&quot;</li>
            <li>Templates preserve steps, time estimates, CTAs, and deliverables</li>
            <li>Access templates from the &quot;Template Library&quot; button on the home page</li>
            <li>Click &quot;Use Template&quot; to create a new task from any template</li>
          </ul>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Brag List (Performance Reviews)</h3>
          <p style={styles.featureDesc}>
            Turn completed tasks into professional achievement statements for performance reviews:
          </p>
          <ul style={styles.list}>
            <li><strong>Value statements</strong> - Each completed task shows an AI-generated impact statement</li>
            <li><strong>Accept &amp; Save</strong> - Click &quot;Accept&quot; to save a statement, &quot;Regenerate&quot; for different phrasing</li>
            <li><strong>Brag List page</strong> - Generate a full achievement summary from all completed tasks</li>
            <li><strong>Category tags</strong> - Entries are tagged (DELIVERY, PLANNING, COMMUNICATION, etc.)</li>
            <li><strong>Overall impact</strong> - Each entry includes a summary of cumulative value</li>
            <li><strong>Credibility focus</strong> - No fluff, only verifiable claims about what you controlled</li>
          </ul>
          <p style={{...styles.featureDesc, marginTop: "0.75rem"}}>
            Access the Brag List from the navigation on the home page. Saved brags are stored in <code style={{background: "var(--bg-tertiary)", padding: "0.125rem 0.375rem", borderRadius: "4px", fontSize: "0.8rem"}}>data/brag-list.md</code> and can be deleted anytime.
          </p>
        </div>

        <div style={styles.feature}>
          <h3 style={styles.featureTitle}>Motivation Personalities</h3>
          <p style={styles.featureDesc}>
            Each task has a motivational &quot;why&quot; statement. Choose your style:
          </p>
          <div style={styles.personalities}>
            <div style={styles.personalityItem}>
              <span style={styles.personalityBadge}>🏛</span>
              <div>
                <strong>Stoic</strong>
                <span style={styles.personalityDesc}>Calm, philosophical wisdom</span>
              </div>
            </div>
            <div style={styles.personalityItem}>
              <span style={styles.personalityBadge}>💪</span>
              <div>
                <strong>Coach</strong>
                <span style={styles.personalityDesc}>Encouraging and supportive</span>
              </div>
            </div>
            <div style={styles.personalityItem}>
              <span style={styles.personalityBadge}>🎖</span>
              <div>
                <strong>Drill</strong>
                <span style={styles.personalityDesc}>Direct, no-nonsense push</span>
              </div>
            </div>
            <div style={styles.personalityItem}>
              <span style={styles.personalityBadge}>☕</span>
              <div>
                <strong>Friend</strong>
                <span style={styles.personalityDesc}>Casual, relatable motivation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tips */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Tips for Focus</h2>
        <ul style={styles.tipsList}>
          <li>Start with just one task - resist adding more until it&apos;s done</li>
          <li>Click a step to mark &quot;working on it&quot; before starting</li>
          <li>Don&apos;t worry if you go over time - the tracker helps you learn</li>
          <li>Use the &quot;Why&quot; statement when motivation dips</li>
          <li>The Overview is for planning, Focus mode is for doing</li>
        </ul>
      </section>

      {/* Quick actions */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Quick Actions</h2>
        <div style={styles.shortcuts}>
          <div style={styles.shortcut}>
            <span style={styles.action}>Click step</span>
            <span>Start working on it</span>
          </div>
          <div style={styles.shortcut}>
            <span style={styles.action}>Click again</span>
            <span>Mark as complete</span>
          </div>
          <div style={styles.shortcut}>
            <span style={styles.action}>Double-click task name</span>
            <span>Edit task title</span>
          </div>
          <div style={styles.shortcut}>
            <span style={styles.action}>Drag steps</span>
            <span>Reorder subtasks</span>
          </div>
        </div>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "48rem",
    margin: "0 auto",
    padding: "2rem 1.5rem",
  },
  header: {
    marginBottom: "2rem",
  },
  backBtn: {
    display: "inline-block",
    marginBottom: "1rem",
    fontSize: "0.875rem",
    color: "var(--fg-secondary)",
    textDecoration: "none",
  },
  title: {
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "var(--fg-primary)",
    marginBottom: "0.25rem",
  },
  subtitle: {
    color: "var(--fg-secondary)",
    fontSize: "0.9rem",
  },
  sampleSection: {
    marginBottom: "2rem",
    padding: "1rem 1.25rem",
    background: "rgba(255, 255, 0, 0.08)",
    border: "1px solid rgba(255, 255, 0, 0.3)",
    borderRadius: "10px",
  },
  sampleContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    flexWrap: "wrap",
  },
  sampleText: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  sampleTitle: {
    fontSize: "0.9rem",
    color: "var(--fg-primary)",
  },
  sampleHint: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
  },
  sampleButtons: {
    display: "flex",
    gap: "0.5rem",
  },
  loadBtn: {
    padding: "0.5rem 1rem",
    background: "#FFFF00",
    color: "#000",
    border: "none",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  clearBtn: {
    padding: "0.5rem 1rem",
    background: "var(--bg-primary)",
    color: "var(--fg-primary)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "0.8rem",
    fontWeight: 500,
    cursor: "pointer",
  },
  clearBtnSecondary: {
    padding: "0.5rem 1rem",
    background: "transparent",
    color: "var(--fg-muted)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  section: {
    marginBottom: "2.5rem",
  },
  sectionTitle: {
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
    marginBottom: "1rem",
    paddingBottom: "0.5rem",
    borderBottom: "1px solid var(--border)",
  },
  workflow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    padding: "1.5rem",
    background: "var(--bg-secondary)",
    borderRadius: "12px",
    flexWrap: "wrap",
  },
  step: {
    textAlign: "center" as const,
    padding: "1rem",
  },
  stepNumber: {
    display: "block",
    width: "2rem",
    height: "2rem",
    lineHeight: "2rem",
    margin: "0 auto 0.5rem",
    background: "#FFFF00",
    color: "#000",
    borderRadius: "50%",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  stepLabel: {
    display: "block",
    fontWeight: 600,
    color: "var(--fg-primary)",
    marginBottom: "0.25rem",
  },
  stepDesc: {
    fontSize: "0.8rem",
    color: "var(--fg-muted)",
    margin: 0,
  },
  arrow: {
    fontSize: "1.5rem",
    color: "var(--fg-muted)",
  },
  feature: {
    marginBottom: "1.5rem",
    padding: "1rem",
    background: "var(--bg-secondary)",
    borderRadius: "8px",
  },
  featureTitle: {
    fontSize: "1rem",
    fontWeight: 600,
    color: "var(--fg-primary)",
    marginBottom: "0.5rem",
  },
  featureDesc: {
    fontSize: "0.875rem",
    color: "var(--fg-secondary)",
    margin: 0,
    lineHeight: 1.6,
  },
  list: {
    marginTop: "0.75rem",
    marginBottom: 0,
    paddingLeft: "1.25rem",
    fontSize: "0.875rem",
    color: "var(--fg-secondary)",
    lineHeight: 1.8,
  },
  personalities: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "0.75rem",
    marginTop: "0.75rem",
  },
  personalityItem: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.5rem 0.75rem",
    background: "var(--bg-tertiary)",
    borderRadius: "6px",
  },
  personalityBadge: {
    fontSize: "1.25rem",
    width: "2rem",
    height: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--bg-secondary)",
    borderRadius: "6px",
    border: "1px solid var(--border)",
  },
  personalityDesc: {
    display: "block",
    fontSize: "0.75rem",
    color: "var(--fg-muted)",
  },
  tipsList: {
    margin: 0,
    paddingLeft: "1.25rem",
    fontSize: "0.9rem",
    color: "var(--fg-secondary)",
    lineHeight: 2,
  },
  shortcuts: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  shortcut: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    fontSize: "0.875rem",
    color: "var(--fg-secondary)",
  },
  action: {
    padding: "0.25rem 0.5rem",
    background: "var(--bg-tertiary)",
    borderRadius: "4px",
    fontSize: "0.8rem",
    color: "var(--fg-primary)",
    fontWeight: 500,
    minWidth: "140px",
  },
};
