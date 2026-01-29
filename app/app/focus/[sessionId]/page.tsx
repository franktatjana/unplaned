"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Task, Subtask, Personality } from "../../lib/types";
import { regenerateTaskWhy, saveAsTemplate, editTask } from "../../lib/actions";
import s from "./FocusPage.module.css";

const PERSONALITIES: { id: Personality; icon: string; label: string }[] = [
  { id: "stoic", icon: "🏛", label: "Stoic" },
  { id: "coach", icon: "💪", label: "Coach" },
  { id: "drill", icon: "🎖", label: "Drill" },
  { id: "friend", icon: "☕", label: "Friend" },
];

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
  const [data, setData] = useState<FocusData>({ task: null, error: null });
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [currentWhy, setCurrentWhy] = useState<string | null>(null);
  const [currentPersonality, setCurrentPersonality] = useState<Personality | null>(null);
  const [showTemplatePrompt, setShowTemplatePrompt] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateReason, setTemplateReason] = useState<string | null>(null);
  const [evaluatingTemplate, setEvaluatingTemplate] = useState(false);
  const [showBragPrompt, setShowBragPrompt] = useState(false);
  const [generatingBrag, setGeneratingBrag] = useState(false);
  const [generatedBrag, setGeneratedBrag] = useState<{ bullet: string; metrics: string; overallImpact?: string } | null>(null);
  const [bragSaved, setBragSaved] = useState(false);

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
        setCurrentWhy(result.task.why);
        setCurrentPersonality(result.task.personality);

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

  const handleEndSession = useCallback(async () => {
    // Mark task as completed if all subtasks are done
    if (data.task && subtasks.every(st => st.completed)) {
      await editTask(data.task.id, { completedAt: new Date().toISOString() });
    }
    // Force hard navigation to refresh data on home page
    window.location.href = "/";
  }, [data.task, subtasks]);

  const handleRegenerateWhy = useCallback(async (newPersonality: Personality) => {
    if (!data.task || newPersonality === currentPersonality || regenerating) return;
    setRegenerating(true);
    try {
      await regenerateTaskWhy(data.task.id, newPersonality);
      // Refetch to get updated why
      const response = await fetch(`/api/focus/${sessionId}`);
      if (response.ok) {
        const result = await response.json();
        setCurrentWhy(result.task.why);
        setCurrentPersonality(result.task.personality);
      }
    } finally {
      setRegenerating(false);
    }
  }, [data.task, currentPersonality, regenerating, sessionId]);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!data.task || savingTemplate) return;
    setSavingTemplate(true);
    try {
      await saveAsTemplate(data.task.id);
      setTemplateSaved(true);
      setShowTemplatePrompt(false);
    } finally {
      setSavingTemplate(false);
    }
  }, [data.task, savingTemplate]);

  const handleGenerateBrag = useCallback(async () => {
    if (!data.task || generatingBrag) return;
    setGeneratingBrag(true);
    try {
      const totalSeconds = Object.values(subtaskTimes).reduce((sum, t) => sum + t.elapsedSeconds, 0);
      const res = await fetch("/api/brag", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_title: data.task.text,
          steps: subtasks.map(st => st.text),
          time_spent: Math.round(totalSeconds / 60),
          core_why: data.task.coreWhy,
        }),
      });
      if (res.ok) {
        const result = await res.json();
        setGeneratedBrag({
          bullet: result.copy_text,
          metrics: `Confidence: ${result.confidence}`,
          overallImpact: result.impact_sentence,
        });
      }
    } finally {
      setGeneratingBrag(false);
    }
  }, [data.task, generatingBrag, subtasks, subtaskTimes]);

  const handleSaveBrag = useCallback(async () => {
    if (!data.task || !generatedBrag) return;
    try {
      // Save to task so it won't regenerate in Done section
      await editTask(data.task.id, {
        acceptedValueStatement: generatedBrag.bullet,
        acceptedOverallImpact: generatedBrag.overallImpact,
      });

      // Also save to brag-list.md
      await fetch("/api/brag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: {
            title: data.task.text,
            bullet: generatedBrag.bullet,
            metrics: generatedBrag.metrics,
            category: "Execution",
            frequency: "one-time",
            overallImpact: generatedBrag.overallImpact,
          },
        }),
      });
      setBragSaved(true);
      setShowBragPrompt(false);
    } catch (err) {
      console.error("Failed to save brag:", err);
    }
  }, [data.task, generatedBrag]);

  const completedCount = subtasks.filter((st) => st.completed).length;
  const totalCount = subtasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allComplete = completedCount === totalCount && totalCount > 0;

  // Evaluate if task is template-worthy when all tasks complete
  useEffect(() => {
    if (allComplete && !templateSaved && !showTemplatePrompt && !evaluatingTemplate && data.task) {
      setEvaluatingTemplate(true);
      const evaluateTemplate = async () => {
        try {
          const response = await fetch("/api/evaluate-template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              taskName: data.task!.text,
              subtasks: subtasks.map(st => st.text),
            }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result.worthy) {
              setTemplateReason(result.reason || null);
              setShowTemplatePrompt(true);
            }
          }
        } catch {
          // Silently fail - don't show prompt if evaluation fails
        } finally {
          setEvaluatingTemplate(false);
        }
      };
      const timer = setTimeout(evaluateTemplate, 500);
      return () => clearTimeout(timer);
    }
  }, [allComplete, templateSaved, showTemplatePrompt, evaluatingTemplate, data.task, subtasks]);
  const timeUp = timeRemaining === 0;
  const isUrgent = timeRemaining > 0 && timeRemaining <= 300; // Under 5 minutes
  const isCritical = timeRemaining > 0 && timeRemaining <= 60; // Under 1 minute

  if (loading) {
    return (
      <main className={s.main}>
        <div className={s.loading}>Loading...</div>
      </main>
    );
  }

  if (data.error || !data.task) {
    return (
      <main className={s.main}>
        <div className={s.errorContainer}>
          <p className={s.errorText}>{data.error || "Task not found"}</p>
          <button onClick={() => { window.location.href = "/"; }} className={s.backBtn}>
            Back to Tasks
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={s.main}>
      <div className={s.container}>
        {/* Task title - at top, prominent */}
        <h1 className={s.taskTitle}>{data.task.text}</h1>

        {/* Why statement with personality selector */}
        <div className={s.whyBanner}>
          <p className={s.whyText}>{regenerating ? "..." : (currentWhy || data.task.why)}</p>
          <div className={s.personalityRow}>
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => handleRegenerateWhy(p.id)}
                disabled={regenerating}
                className={`${s.personalityBtn} ${p.id === currentPersonality ? s.personalityActive : ""}`}
                title={`${p.label} voice`}
              >
                {p.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className={s.timerSection}>
          <div className={`${s.timer} ${timeUp ? s.timerDone : ""} ${isPaused ? s.timerPaused : ""} ${isCritical ? s.timerCritical : isUrgent ? s.timerUrgent : ""}`}>
            {formatTime(timeRemaining)}
          </div>
          {timeUp && (
            <p className={s.timeUpMessage}>Time&apos;s up!</p>
          )}
          {isUrgent && !timeUp && (
            <p className={s.urgentMessage}>
              {isCritical ? "Final minute!" : "Less than 5 minutes left"}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className={s.progressContainer}>
          <div className={s.progressBar}>
            <div className={s.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={s.progressText}>{completedCount}/{totalCount} steps</span>
        </div>

        {/* Hint - above subtask list */}
        {!activeSubtaskId && subtasks.some(st => !st.completed) && (
          <p className={s.hint}>Click a step to start working on it, click again to mark done</p>
        )}

        {/* Subtask list */}
        <div className={s.subtaskList}>
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
              <div key={st.id} className={s.subtaskWrapper}>
                <button
                  onClick={() => handleSubtaskClick(st.id)}
                  className={`${s.subtaskItem} ${st.completed ? s.subtaskCompleted : ""} ${isActive && !st.completed ? s.subtaskActive : ""} ${isOvertime && isActive ? s.subtaskOvertime : ""}`}
                >
                  <span className={`${s.checkbox} ${isActive && !st.completed ? s.checkboxActive : ""}`}>
                    {st.completed ? "✓" : isActive ? "▶" : "○"}
                  </span>
                  <span className={`${s.subtaskText} ${st.completed ? s.subtaskTextCompleted : ""} ${isActive && !st.completed ? s.subtaskTextActive : ""}`}>
                    {cleanText}
                  </span>
                  <div className={s.timeInfo}>
                    {(isActive || elapsedSeconds > 0) && (
                      <span className={`${s.elapsedTime} ${isOvertime ? s.elapsedTimeOvertime : ""}`}>
                        {formatCompactTime(elapsedSeconds)}
                        {isOvertime && ` +${formatCompactTime(overtimeSeconds)}`}
                      </span>
                    )}
                    <span className={`${s.subtaskTime} ${isActive && !st.completed ? s.subtaskTimeActive : ""}`}>{timeEstimate}m</span>
                  </div>
                </button>
                {/* CTA, deliverable, soWhat, guidance hints for active subtask */}
                {isActive && !st.completed && (st.cta || st.deliverable || st.soWhat || st.guidance) && (
                  <div className={s.activeHints}>
                    {st.cta && <span className={s.ctaHint}>▸ {st.cta}</span>}
                    {st.deliverable && (
                      <span className={s.deliverableHint}>✔ {st.deliverable}</span>
                    )}
                    {st.soWhat && <span className={s.soWhatHint}>★ {st.soWhat}</span>}
                    {st.guidance && <span className={s.guidanceHint}>💡 {st.guidance}</span>}
                  </div>
                )}
                {/* Progress gauge for active subtask */}
                {isActive && !st.completed && (
                  <div className={s.gaugeContainer}>
                    <div
                      className={`${s.gaugeFill} ${isOvertime ? s.gaugeFillOvertime : progressPercent > 80 ? s.gaugeFillWarning : ""}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
                {/* Show elapsed time for completed subtasks */}
                {st.completed && elapsedSeconds > 0 && (
                  <div className={s.completedTimeRow}>
                    <span className={s.completedTimeLabel}>
                      Took {formatCompactTime(elapsedSeconds)} of {timeEstimate}m estimate
                      {isOvertime && <span className={s.overtimeLabel}> (+{formatCompactTime(overtimeSeconds)})</span>}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Template prompt - shows when AI recommends */}
        {showTemplatePrompt && !templateSaved && (
          <div className={s.templatePrompt}>
            <p className={s.templateQuestion}>This looks like a solid workflow!</p>
            {templateReason && <p className={s.templateReason}>{templateReason}</p>}
            <p className={s.templateAsk}>Want to save it as a template?</p>
            <div className={s.templateActions}>
              <button
                onClick={handleSaveAsTemplate}
                disabled={savingTemplate}
                className={s.templateSaveBtn}
              >
                {savingTemplate ? "Saving..." : "Save as Template"}
              </button>
              <button
                onClick={() => setShowTemplatePrompt(false)}
                className={s.templateDismissBtn}
              >
                No thanks
              </button>
            </div>
          </div>
        )}

        {/* Template saved confirmation */}
        {templateSaved && (
          <div className={s.templateSaved}>
            Template saved! Find it in Template Library.
          </div>
        )}

        {/* Brag prompt - shows when all complete and no brag generated yet */}
        {allComplete && !showBragPrompt && !generatedBrag && (
          <div className={s.templatePrompt}>
            <p className={s.templateQuestion}>Nice work!</p>
            <p className={s.templateAsk}>Generate a brag entry for your performance review?</p>
            <div className={s.templateActions}>
              <button
                onClick={() => { setShowBragPrompt(true); handleGenerateBrag(); }}
                className={s.templateSaveBtn}
              >
                Generate Brag
              </button>
              <button
                onClick={() => setShowBragPrompt(true)}
                className={s.templateDismissBtn}
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {/* Loading state while generating */}
        {showBragPrompt && generatingBrag && !generatedBrag && (
          <div className={s.templatePrompt}>
            <p className={s.templateQuestion}>Generating your brag...</p>
            <p className={s.templateAsk}>Analyzing your work for impact statement</p>
          </div>
        )}

        {/* Generated brag - stays visible after generation */}
        {generatedBrag && (
          <div className={s.templatePrompt}>
            <p className={s.templateQuestion}>
              {bragSaved ? "Brag saved!" : "Your brag entry:"}
            </p>
            <p className={s.whyText}>{generatedBrag.bullet}</p>
            {generatedBrag.overallImpact && (
              <p className={s.bragImpact}><strong>Impact:</strong> {generatedBrag.overallImpact}</p>
            )}
            <div className={s.templateActions}>
              {!bragSaved ? (
                <>
                  <button onClick={handleSaveBrag} className={s.templateSaveBtn}>
                    Save to Brag List
                  </button>
                  <button onClick={handleGenerateBrag} disabled={generatingBrag} className={s.templateDismissBtn}>
                    {generatingBrag ? "..." : "Regenerate"}
                  </button>
                  <button onClick={() => { setGeneratedBrag(null); setShowBragPrompt(true); }} className={s.templateDismissBtn}>
                    Skip
                  </button>
                </>
              ) : (
                <Link href="/brag" className={s.bragSavedNote}>View in Brag List →</Link>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className={s.controls}>
          {!showEndConfirm ? (
            <>
              <button
                onClick={() => { window.location.href = "/"; }}
                className={s.homeBtn}
                title="Back to tasks"
              >
                ←
              </button>
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={s.pauseBtn}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              {(allComplete || timeUp) ? (
                <button onClick={handleEndSession} className={s.doneBtn}>
                  Done
                </button>
              ) : (
                <button
                  onClick={() => setShowEndConfirm(true)}
                  className={s.endBtn}
                >
                  End Early
                </button>
              )}
            </>
          ) : (
            <div className={s.confirmRow}>
              <span className={s.confirmText}>End session?</span>
              <button onClick={handleEndSession} className={s.confirmYes}>
                Yes, end
              </button>
              <button onClick={() => setShowEndConfirm(false)} className={s.confirmNo}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
