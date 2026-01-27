"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Task, Personality, Session } from "../lib/types";
import {
  editSubtask,
  addSubtaskToTask,
  removeSubtaskFromTask,
  regenerateTaskWhy,
  editTask,
  addTask,
  reorderSubtasks,
  addNoteToTask,
} from "../lib/actions";

const PERSONALITIES: { id: Personality; icon: string }[] = [
  { id: "stoic", icon: "🏛" },
  { id: "coach", icon: "💪" },
  { id: "drill", icon: "🎖" },
  { id: "friend", icon: "☕" },
];

interface Props {
  task: Task;
  activeSession?: Session;
  onStart: () => void;
  onResume?: () => void;
  onDelete: () => void;
}

function parseTimeFromSubtask(text: string): number {
  const match = text.match(/\(~?(\d+)\s*min\)$/i);
  return match ? parseInt(match[1], 10) : 10;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getTimeWorked(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just started";
  if (diffMins < 60) return `${diffMins}m`;
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export default function TaskCard({ task, activeSession, onStart, onResume, onDelete }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editingTaskName, setEditingTaskName] = useState(false);
  const [taskNameText, setTaskNameText] = useState(task.text);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [newSubtask, setNewSubtask] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [elaborating, setElaborating] = useState(false);
  const [showSecondOpinion, setShowSecondOpinion] = useState(false);
  const [anonymizedPrompt, setAnonymizedPrompt] = useState("");
  const [anonymizing, setAnonymizing] = useState(false);
  const [pastedResponse, setPastedResponse] = useState("");
  const [elaborateResult, setElaborateResult] = useState<{
    explanation: string;
    extractTasks: Array<{
      stepIndex: number;
      taskName: string;
      reason: string;
      suggestedSubtasks: string[];
      estimatedMinutes?: number;
    }>;
  } | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{
    question: string;
    why: string;
    answer: string;
  }>>([]);
  const [showClarification, setShowClarification] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineReasoning, setRefineReasoning] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const totalCount = task.subtasks.length;
  const notesCount = task.notes?.length || 0;
  const isInProgress = !!activeSession;

  // Calculate total estimated time from subtasks
  const estimatedMinutes = task.subtasks.reduce(
    (sum, st) => sum + parseTimeFromSubtask(st.text), 0
  );
  const estimatedDisplay = formatDuration(estimatedMinutes);

  // Calculate time worked if in progress
  const timeWorkedDisplay = activeSession ? getTimeWorked(activeSession.startedAt) : null;

  const handleRegenerateWhy = async (newPersonality: Personality) => {
    if (newPersonality === task.personality || regenerating) return;
    setRegenerating(true);
    try {
      await regenerateTaskWhy(task.id, newPersonality);
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  };

  const handleElaborate = async (additionalContext?: string, skipClarification?: boolean) => {
    if (elaborating) return;
    setElaborating(true);
    setElaborateResult(null);
    try {
      const response = await fetch("/api/elaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: task.text,
          subtasks: task.subtasks.map((st) => st.text),
          additionalContext,
          skipClarification,
        }),
      });
      if (response.ok) {
        const result = await response.json();

        // Check if we got clarification questions
        if (result.phase === "clarification" && result.questions?.length > 0) {
          setClarificationQuestions(
            result.questions.map((q: { question: string; why: string }) => ({
              ...q,
              answer: "",
            }))
          );
          setShowClarification(true);
          setElaborating(false);
          return;
        }

        // Normal analysis result
        // First, apply time estimates to existing subtasks
        let updatedSubtasks = [...task.subtasks];

        if (result.stepTimeEstimates?.length > 0) {
          updatedSubtasks = task.subtasks.map((st, index) => {
            const estimate = result.stepTimeEstimates.find(
              (e: { stepIndex: number; estimatedMinutes: number }) => e.stepIndex === index + 1
            );
            if (estimate) {
              // Strip any existing time estimate from the text
              const cleanText = st.text.replace(/\s*\(~?\d+\s*min\)$/i, "").trim();
              return {
                ...st,
                text: `${cleanText} (~${estimate.estimatedMinutes}min)`,
              };
            }
            return st;
          });
        }

        // Then add any new subtasks (avoiding duplicates)
        if (result.newSubtasks?.length > 0) {
          const existingTexts = new Set(
            updatedSubtasks.map((st) =>
              st.text.replace(/\s*\(~?\d+\s*min\)$/i, "").toLowerCase().trim()
            )
          );

          const newUniqueSubtasks = result.newSubtasks
            .filter((text: string) => {
              const cleanText = text.replace(/\s*\(~?\d+\s*min\)$/i, "").toLowerCase().trim();
              return !existingTexts.has(cleanText);
            })
            .map((text: string, i: number) => ({
              id: `st-${Date.now()}-${i}`,
              text,
              completed: false,
            }));

          updatedSubtasks = [...updatedSubtasks, ...newUniqueSubtasks];
        }

        // Update if anything changed
        if (JSON.stringify(updatedSubtasks) !== JSON.stringify(task.subtasks)) {
          await editTask(task.id, { subtasks: updatedSubtasks });
          router.refresh();
        }
        // Store full result including extractTasks
        setElaborateResult({
          explanation: result.explanation || "",
          extractTasks: result.extractTasks || [],
        });

        // Save analysis as a note if there's meaningful content
        if (result.explanation && (result.newSubtasks?.length > 0 || result.extractTasks?.length > 0)) {
          const extractInfo = result.extractTasks?.length > 0
            ? `\n\n**Suggested extractions:** ${result.extractTasks.map((et: { taskName: string }) => et.taskName).join(", ")}`
            : "";
          await addNoteToTask(
            task.id,
            `**AI Analysis:**\n\n${result.explanation}${extractInfo}`,
            "ai-analysis"
          );
        }

        setShowClarification(false);
        setClarificationQuestions([]);
      }
    } finally {
      setElaborating(false);
    }
  };

  const handleSubmitClarification = () => {
    const context = clarificationQuestions
      .filter((q) => q.answer.trim())
      .map((q) => `Q: ${q.question}\nA: ${q.answer}`)
      .join("\n\n");
    if (context) {
      handleElaborate(context);
    }
  };

  const handleSkipClarification = () => {
    setShowClarification(false);
    setClarificationQuestions([]);
    handleElaborate(undefined, true);
  };

  const updateClarificationAnswer = (index: number, answer: string) => {
    setClarificationQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, answer } : q))
    );
  };

  const handleExtractTask = async (extraction: {
    stepIndex: number;
    taskName: string;
    suggestedSubtasks: string[];
    estimatedMinutes?: number;
    reason?: string;
  }) => {
    try {
      // Calculate duration based on estimated minutes
      let duration: 15 | 30 | 45 | 60 = 15;
      if (extraction.estimatedMinutes) {
        if (extraction.estimatedMinutes <= 15) duration = 15;
        else if (extraction.estimatedMinutes <= 30) duration = 30;
        else if (extraction.estimatedMinutes <= 45) duration = 45;
        else duration = 60;
      }

      // Build context about what the parent task already covers
      const parentSteps = task.subtasks
        .filter((_, i) => i !== extraction.stepIndex - 1) // Exclude the step being extracted
        .map((st) => st.text);

      // Create descriptive coreWhy that references parent context
      const stepBeingExtracted = task.subtasks[extraction.stepIndex - 1]?.text || "";
      const coreWhy = `This is step ${extraction.stepIndex} from "${task.text}" - extracted because it needs dedicated focus. Parent task already covers: ${parentSteps.slice(0, 3).join(", ")}${parentSteps.length > 3 ? "..." : ""}.`;

      await addTask(
        extraction.taskName,
        extraction.suggestedSubtasks.length > 0
          ? extraction.suggestedSubtasks
          : [`Complete: ${stepBeingExtracted}`, "Review and verify results"],
        "Focus on this specific piece.",
        coreWhy,
        duration,
        task.personality
      );

      // Save note about the extraction
      await addNoteToTask(
        task.id,
        `**Task Extracted:**\n\nStep ${extraction.stepIndex} ("${stepBeingExtracted}") was extracted as a separate task: "${extraction.taskName}".\n\n${extraction.reason ? `**Reason:** ${extraction.reason}` : ""}`,
        "ai-extract"
      );

      // Optionally remove the step from current task
      const stepToRemove = task.subtasks[extraction.stepIndex - 1];
      if (stepToRemove) {
        await removeSubtaskFromTask(task.id, stepToRemove.id);
      }

      setElaborateResult(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to extract task:", error);
    }
  };

  const handleSecondOpinion = async (service: "perplexity" | "chatgpt") => {
    setAnonymizing(true);
    try {
      // Anonymize the task and subtasks before sending to external services
      const textToAnonymize = `Task: ${task.text}\nSteps:\n${task.subtasks.map((st, i) => `${i + 1}. ${st.text}`).join("\n")}`;

      const anonResponse = await fetch("/api/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToAnonymize }),
      });

      let anonymizedText = textToAnonymize;
      if (anonResponse.ok) {
        const anonData = await anonResponse.json();
        if (anonData.anonymized && anonData.wasAnonymized) {
          anonymizedText = anonData.anonymized;
        }
      }

      const prompt = `${anonymizedText}

Time estimate: ${task.duration} minutes

Please review this task breakdown and suggest:
1. Any missing steps
2. Steps that could be combined or removed
3. Better time estimate if needed

Reply with your improved version in this format:
STEPS:
1. [step]
2. [step]
...
TIME: X minutes
NOTES: [brief explanation]`;

      setAnonymizedPrompt(prompt);
      setShowSecondOpinion(true);

      if (service === "perplexity") {
        window.open(`https://www.perplexity.ai/search?q=${encodeURIComponent(prompt)}`, "_blank");
      } else {
        // ChatGPT supports pre-filling via URL parameter
        window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, "_blank");
      }
    } catch (error) {
      console.error("Failed to prepare second opinion:", error);
    } finally {
      setAnonymizing(false);
    }
  };

  const handleParsePastedResponse = async () => {
    if (!pastedResponse.trim()) return;
    setRefining(true);
    setRefineReasoning(null);

    try {
      // Call the smart refine API to analyze and combine suggestions
      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalTask: task.text,
          originalSubtasks: task.subtasks.map((st) => st.text),
          externalResponse: pastedResponse,
          currentDuration: task.duration,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.subtasks && result.subtasks.length > 0) {
          const newSubtasks = result.subtasks.map((text: string, i: number) => ({
            id: `st-${Date.now()}-${i}`,
            text,
            completed: false,
          }));

          await editTask(task.id, {
            subtasks: newSubtasks,
            ...(result.duration && { duration: result.duration }),
          });

          // Save reasoning as a note if available
          if (result.reasoning) {
            await addNoteToTask(
              task.id,
              `**AI Refinement (${result.source || "external"}):**\n\n${result.reasoning}`,
              "ai-refine"
            );
            setRefineReasoning(result.reasoning);
          }

          setShowSecondOpinion(false);
          setPastedResponse("");
          setAnonymizedPrompt("");
          router.refresh();
        }
      }
    } catch (error) {
      console.error("Failed to refine suggestions:", error);
    } finally {
      setRefining(false);
    }
  };

  const polishText = async (text: string): Promise<string> => {
    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.polished || text;
      }
    } catch {}
    return text;
  };

  const handleEditSubtask = async (subtaskId: string) => {
    if (!editText.trim()) return;
    const polished = await polishText(editText.trim());
    await editSubtask(task.id, subtaskId, { text: polished });
    setEditingSubtask(null);
    setEditText("");
    router.refresh();
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    const polished = await polishText(newSubtask.trim());
    await addSubtaskToTask(task.id, polished);
    setNewSubtask("");
    router.refresh();
  };

  const handleRemoveSubtask = async (subtaskId: string) => {
    await removeSubtaskFromTask(task.id, subtaskId);
    router.refresh();
  };

  const handleSaveTaskName = async () => {
    if (!taskNameText.trim() || taskNameText.trim() === task.text) {
      setEditingTaskName(false);
      setTaskNameText(task.text);
      return;
    }
    await editTask(task.id, { text: taskNameText.trim() });
    setEditingTaskName(false);
    router.refresh();
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = async (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...task.subtasks.map(st => st.id)];
    const [movedId] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, movedId);

    setDraggedIndex(null);
    setDragOverIndex(null);

    await reorderSubtasks(task.id, newOrder);
    router.refresh();
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{
      ...styles.card,
      ...(isInProgress ? styles.cardInProgress : {}),
    }}>
      {/* Compact header - always visible */}
      <div style={styles.header}>
        <button
          onClick={isInProgress && onResume ? onResume : onStart}
          style={{
            ...styles.playBtn,
            ...(isInProgress ? styles.playBtnResume : {}),
          }}
          title={isInProgress ? "Resume session" : "Start focus session"}
        >
          {isInProgress ? "▶" : "▶"}
        </button>
        <div style={styles.titleArea}>
          {editingTaskName ? (
            <input
              type="text"
              value={taskNameText}
              onChange={(e) => setTaskNameText(e.target.value)}
              onBlur={handleSaveTaskName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTaskName();
                if (e.key === "Escape") {
                  setEditingTaskName(false);
                  setTaskNameText(task.text);
                }
              }}
              style={styles.taskNameInput}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              style={styles.title}
              onClick={() => setExpanded(!expanded)}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingTaskName(true); setTaskNameText(task.text); }}
              title="Click to expand, double-click to edit"
            >
              {task.text}
            </span>
          )}
          <div style={styles.metaRow} onClick={() => setExpanded(!expanded)}>
            <span style={styles.meta}>
              {estimatedDisplay} est · {totalCount} steps
            </span>
            {isInProgress && (
              <>
                <span style={styles.inProgressBadge}>In Progress</span>
                <span style={styles.timeWorked}>{timeWorkedDisplay} worked</span>
              </>
            )}
          </div>
        </div>
        <span style={styles.chevron} onClick={() => setExpanded(!expanded)}>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      {/* Expanded content - hidden by default */}
      {expanded && (
        <div style={styles.expandedContent}>
          {/* Why section - on top */}
          <div style={styles.whySection}>
            <div style={styles.whyRow}>
              <div style={styles.whyContent}>
                <p style={styles.why}><strong>Why:</strong> {task.coreWhy}</p>
                <p style={styles.motivation}>{regenerating ? "..." : task.why}</p>
              </div>
              <div style={styles.personalityRow}>
                {PERSONALITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleRegenerateWhy(p.id)}
                    disabled={regenerating}
                    style={{
                      ...styles.personalityBtn,
                      ...(p.id === task.personality ? styles.personalityActive : {}),
                    }}
                    title={p.id}
                  >
                    {p.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtasks */}
          <div style={styles.subtasks}>
            {task.subtasks.map((st, i) => (
              <div
                key={st.id}
                style={{
                  ...styles.subtaskRow,
                  ...(draggedIndex === i ? styles.subtaskDragging : {}),
                  ...(dragOverIndex === i ? styles.subtaskDragOver : {}),
                }}
                draggable={editingSubtask !== st.id}
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={handleDragEnd}
              >
                {editingSubtask === st.id ? (
                  <>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubtask(st.id);
                        if (e.key === "Escape") setEditingSubtask(null);
                      }}
                      style={styles.editInput}
                      autoFocus
                    />
                    <button onClick={() => handleEditSubtask(st.id)} style={styles.saveBtn}>✓</button>
                    <button onClick={() => setEditingSubtask(null)} style={styles.cancelEditBtn}>×</button>
                  </>
                ) : (
                  <>
                    <span style={styles.dragHandle} title="Drag to reorder">⋮⋮</span>
                    <span
                      style={styles.subtaskText}
                      onDoubleClick={() => { setEditingSubtask(st.id); setEditText(st.text); }}
                      title="Double-click to edit"
                    >
                      {st.text.replace(/\s*\(~?(\d+)\s*min\)$/i, "")}
                    </span>
                    {(() => {
                      const timeMatch = st.text.match(/\(~?(\d+)\s*min\)$/i);
                      return timeMatch ? (
                        <span style={styles.subtaskTime}>{timeMatch[1]}m</span>
                      ) : null;
                    })()}
                    <button onClick={() => handleRemoveSubtask(st.id)} style={styles.removeBtn}>×</button>
                  </>
                )}
              </div>
            ))}

            <div style={styles.addRow}>
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                placeholder="Add step..."
                style={styles.addInput}
              />
              {newSubtask.trim() && (
                <button onClick={handleAddSubtask} style={styles.addBtn}>+</button>
              )}
            </div>
          </div>

          {/* Clarification questions */}
          {showClarification && clarificationQuestions.length > 0 && (
            <div style={styles.clarificationPanel}>
              <div style={styles.clarificationHeader}>
                <span style={styles.clarificationIcon}>💬</span>
                <span style={styles.clarificationTitle}>Quick questions to improve analysis</span>
              </div>
              <div style={styles.questionsList}>
                {clarificationQuestions.map((q, i) => (
                  <div key={i} style={styles.questionItem}>
                    <label style={styles.questionLabel}>{q.question}</label>
                    <p style={styles.questionWhy}>{q.why}</p>
                    <input
                      type="text"
                      value={q.answer}
                      onChange={(e) => updateClarificationAnswer(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && clarificationQuestions.every((cq) => cq.answer.trim())) {
                          handleSubmitClarification();
                        }
                      }}
                      placeholder="Your answer..."
                      style={styles.questionInput}
                    />
                  </div>
                ))}
              </div>
              <div style={styles.clarificationActions}>
                <button onClick={handleSkipClarification} style={styles.skipBtn}>
                  Skip & analyze anyway
                </button>
                <button
                  onClick={handleSubmitClarification}
                  disabled={!clarificationQuestions.some((q) => q.answer.trim())}
                  style={{
                    ...styles.submitClarificationBtn,
                    ...(!clarificationQuestions.some((q) => q.answer.trim()) ? styles.btnDisabled : {}),
                  }}
                >
                  {elaborating ? "Analyzing..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Elaborate result */}
          {elaborateResult && (
            <div style={styles.elaborateResult}>
              <p style={styles.elaborateText}>{elaborateResult.explanation}</p>
              {elaborateResult.extractTasks.length > 0 && (
                <div style={styles.extractActions}>
                  {elaborateResult.extractTasks.map((et, i) => (
                    <button
                      key={i}
                      onClick={() => handleExtractTask(et)}
                      style={styles.extractBtn}
                      title={et.reason}
                    >
                      Extract "{et.taskName}" {et.estimatedMinutes ? `(~${et.estimatedMinutes}min)` : ""}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setElaborateResult(null)} style={styles.dismissBtn}>Dismiss</button>
            </div>
          )}

          {/* Notes section */}
          {notesCount > 0 && (
            <div style={styles.notesSection}>
              <button
                onClick={() => setShowNotes(!showNotes)}
                style={styles.notesToggle}
              >
                <span>📝 AI Notes ({notesCount})</span>
                <span>{showNotes ? "▾" : "▸"}</span>
              </button>
              {showNotes && (
                <div style={styles.notesList}>
                  {task.notes.map((note) => (
                    <div key={note.id} style={styles.noteItem}>
                      <div style={styles.noteHeader}>
                        <span style={styles.noteSource}>
                          {note.source === "ai-analysis" && "🔍 Analysis"}
                          {note.source === "ai-refine" && "🔄 Refinement"}
                          {note.source === "ai-extract" && "📤 Extraction"}
                          {note.source === "manual" && "✏️ Manual"}
                        </span>
                        <span style={styles.noteTime}>
                          {new Date(note.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={styles.noteContent}>{note.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={styles.actions}>
            <button onClick={() => handleElaborate()} disabled={elaborating} style={styles.actionBtn}>
              {elaborating ? "..." : "Analyze"}
            </button>
            <div style={styles.secondOpinionGroup}>
              <span style={styles.secondOpinionLabel}>2nd opinion:</span>
              <button
                onClick={() => handleSecondOpinion("perplexity")}
                disabled={anonymizing}
                style={styles.externalBtn}
                title="Get second opinion from Perplexity (anonymized)"
              >
                🔮
              </button>
              <button
                onClick={() => handleSecondOpinion("chatgpt")}
                disabled={anonymizing}
                style={styles.externalBtn}
                title="Get second opinion from ChatGPT (anonymized, copies to clipboard)"
              >
                💬
              </button>
            </div>
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)} style={styles.deleteBtn}>Delete</button>
            ) : (
              <div style={styles.confirmDelete}>
                <span>Delete?</span>
                <button onClick={onDelete} style={styles.confirmYes}>Yes</button>
                <button onClick={() => setShowDelete(false)} style={styles.confirmNo}>No</button>
              </div>
            )}
          </div>

          {/* Second Opinion Panel */}
          {showSecondOpinion && (
            <div style={styles.secondOpinionPanel}>
              <div style={styles.panelHeader}>
                <span style={styles.panelTitle}>Second Opinion</span>
                <button onClick={() => { setShowSecondOpinion(false); setPastedResponse(""); }} style={styles.panelClose}>×</button>
              </div>
              <p style={styles.privacyNote}>Names and entities have been anonymized before sending</p>
              <details style={styles.promptDetails}>
                <summary style={styles.promptSummary}>View sent prompt</summary>
                <pre style={styles.promptText}>{anonymizedPrompt}</pre>
              </details>
              <textarea
                value={pastedResponse}
                onChange={(e) => setPastedResponse(e.target.value)}
                placeholder="Paste the AI response here..."
                style={styles.pasteTextarea}
                rows={4}
              />
              <div style={styles.panelActions}>
                <button
                  onClick={handleParsePastedResponse}
                  disabled={!pastedResponse.trim() || refining}
                  style={{
                    ...styles.applyBtn,
                    ...(!pastedResponse.trim() || refining ? styles.btnDisabled : {}),
                  }}
                >
                  {refining ? "Analyzing..." : "Apply Suggestions"}
                </button>
              </div>
            </div>
          )}

          {/* Refine reasoning display */}
          {refineReasoning && (
            <div style={styles.refineResult}>
              <p style={styles.refineText}>{refineReasoning}</p>
              <button onClick={() => setRefineReasoning(null)} style={styles.dismissBtn}>Dismiss</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { background: "var(--bg-secondary)", borderRadius: "10px", marginBottom: "0.5rem" },
  cardInProgress: { borderLeft: "3px solid #FFFF00" },
  header: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", cursor: "pointer" },
  playBtn: { width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", background: "var(--fg-primary)", border: "none", borderRadius: "50%", color: "var(--bg-primary)", cursor: "pointer", flexShrink: 0 },
  playBtnResume: { background: "#FFFF00", color: "#000" },
  titleArea: { flex: 1, minWidth: 0 },
  title: { display: "block", fontWeight: 500, color: "var(--fg-primary)", marginBottom: "0.125rem", cursor: "pointer" },
  taskNameInput: { width: "100%", padding: "0.25rem 0.5rem", fontSize: "1rem", fontWeight: 500, background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-primary)", outline: "none", marginBottom: "0.125rem" },
  metaRow: { display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" },
  meta: { fontSize: "0.75rem", color: "var(--fg-muted)", cursor: "pointer" },
  inProgressBadge: { fontSize: "0.65rem", padding: "0.125rem 0.5rem", background: "rgba(255, 255, 0, 0.15)", color: "#FFFF00", borderRadius: "10px", fontWeight: 500 },
  timeWorked: { fontSize: "0.7rem", color: "#FFFF00" },
  chevron: { fontSize: "0.75rem", color: "var(--fg-muted)", padding: "0.25rem" },
  expandedContent: { padding: "0 1rem 1rem", borderTop: "1px solid var(--border)" },
  subtasks: { padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: "0.375rem" },
  subtaskRow: { display: "flex", alignItems: "center", gap: "0.5rem", minHeight: "28px", padding: "0.25rem 0.5rem", borderRadius: "4px", cursor: "grab", transition: "background 0.15s, opacity 0.15s" },
  subtaskDragging: { opacity: 0.5, background: "var(--bg-tertiary)" },
  subtaskDragOver: { background: "rgba(255, 255, 0, 0.1)", borderTop: "2px solid var(--fg-primary)" },
  dragHandle: { color: "var(--fg-muted)", fontSize: "0.75rem", cursor: "grab", userSelect: "none", letterSpacing: "-2px" },
  subtaskText: { flex: 1, fontSize: "0.85rem", color: "var(--fg-primary)", cursor: "text" },
  subtaskTime: { fontSize: "0.75rem", color: "var(--fg-muted)", marginRight: "0.25rem", flexShrink: 0 },
  editInput: { flex: 1, padding: "0.25rem 0.5rem", fontSize: "0.85rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-primary)", outline: "none" },
  saveBtn: { padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "var(--fg-primary)", border: "none", borderRadius: "4px", color: "var(--bg-primary)", cursor: "pointer" },
  cancelEditBtn: { padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer" },
  removeBtn: { padding: "0.125rem 0.375rem", fontSize: "0.8rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer", opacity: 0.5 },
  addRow: { display: "flex", gap: "0.5rem", marginTop: "0.5rem" },
  addInput: { flex: 1, padding: "0.375rem 0.5rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-primary)", outline: "none" },
  addBtn: { padding: "0.375rem 0.625rem", fontSize: "0.9rem", background: "var(--fg-primary)", border: "none", borderRadius: "4px", color: "var(--bg-primary)", cursor: "pointer" },
  elaborateResult: { padding: "0.75rem", marginBottom: "0.75rem", background: "rgba(40, 167, 69, 0.1)", border: "1px solid rgba(40, 167, 69, 0.3)", borderRadius: "6px" },
  elaborateText: { margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--fg-primary)", fontStyle: "italic" },
  extractActions: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.5rem" },
  extractBtn: { padding: "0.375rem 0.75rem", fontSize: "0.8rem", background: "rgba(40, 167, 69, 0.2)", border: "1px solid rgba(40, 167, 69, 0.5)", borderRadius: "4px", color: "var(--fg-primary)", cursor: "pointer", fontWeight: 500 },
  whySection: { padding: "0.75rem 0", borderBottom: "1px solid var(--border)" },
  whyRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" },
  whyContent: { flex: 1 },
  why: { margin: "0 0 0.25rem 0", fontSize: "0.85rem", color: "var(--fg-primary)" },
  motivation: { margin: 0, fontSize: "0.8rem", color: "var(--fg-muted)", fontStyle: "italic" },
  personalityRow: { display: "flex", gap: "0.25rem", flexShrink: 0 },
  personalityBtn: { padding: "0.25rem 0.375rem", fontSize: "0.7rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer", opacity: 0.5 },
  personalityActive: { opacity: 1, borderColor: "var(--fg-secondary)" },
  actions: { display: "flex", gap: "0.5rem", alignItems: "center", paddingTop: "0.75rem", borderTop: "1px solid var(--border)", flexWrap: "wrap" },
  actionBtn: { padding: "0.5rem 0.875rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg-secondary)", cursor: "pointer" },
  secondOpinionGroup: { display: "flex", alignItems: "center", gap: "0.375rem" },
  secondOpinionLabel: { fontSize: "0.75rem", color: "var(--fg-muted)" },
  externalBtn: { padding: "0.375rem 0.5rem", fontSize: "0.85rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "4px", cursor: "pointer" },
  deleteBtn: { marginLeft: "auto", padding: "0.5rem 0.75rem", fontSize: "0.8rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer" },
  confirmDelete: { marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem" },
  confirmYes: { padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "#dc3545", border: "none", borderRadius: "4px", color: "#fff", cursor: "pointer" },
  confirmNo: { padding: "0.25rem 0.5rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "none", borderRadius: "4px", color: "var(--fg-secondary)", cursor: "pointer" },
  secondOpinionPanel: { marginTop: "0.75rem", padding: "1rem", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border)" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" },
  panelTitle: { fontSize: "0.9rem", fontWeight: 500, color: "var(--fg-primary)" },
  panelClose: { padding: "0.25rem 0.5rem", fontSize: "1rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer" },
  privacyNote: { margin: "0 0 0.75rem 0", padding: "0.5rem 0.75rem", fontSize: "0.75rem", color: "rgba(40, 167, 69, 0.9)", background: "rgba(40, 167, 69, 0.1)", borderRadius: "4px", border: "1px solid rgba(40, 167, 69, 0.3)" },
  promptDetails: { marginBottom: "0.75rem" },
  promptSummary: { fontSize: "0.75rem", color: "var(--fg-muted)", cursor: "pointer" },
  promptText: { margin: "0.5rem 0 0 0", padding: "0.75rem", fontSize: "0.7rem", fontFamily: "monospace", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-muted)", whiteSpace: "pre-wrap", maxHeight: "100px", overflow: "auto" },
  pasteTextarea: { width: "100%", padding: "0.75rem", fontSize: "0.85rem", fontFamily: "inherit", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg-primary)", resize: "vertical", outline: "none" },
  panelActions: { marginTop: "0.75rem", display: "flex", justifyContent: "flex-end" },
  applyBtn: { padding: "0.5rem 1rem", fontSize: "0.85rem", background: "var(--fg-primary)", border: "none", borderRadius: "6px", color: "var(--bg-primary)", cursor: "pointer" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  dismissBtn: { padding: "0.25rem 0.5rem", fontSize: "0.75rem", background: "none", border: "none", color: "var(--fg-muted)", cursor: "pointer" },
  refineResult: { marginTop: "0.75rem", padding: "0.75rem", background: "rgba(100, 149, 237, 0.1)", border: "1px solid rgba(100, 149, 237, 0.3)", borderRadius: "6px" },
  refineText: { margin: "0 0 0.5rem 0", fontSize: "0.85rem", color: "var(--fg-primary)", fontStyle: "italic" },
  clarificationPanel: { marginBottom: "0.75rem", padding: "1rem", background: "rgba(255, 193, 7, 0.08)", border: "1px solid rgba(255, 193, 7, 0.3)", borderRadius: "8px" },
  clarificationHeader: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" },
  clarificationIcon: { fontSize: "1.1rem" },
  clarificationTitle: { fontSize: "0.9rem", fontWeight: 500, color: "var(--fg-primary)" },
  questionsList: { display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" },
  questionItem: { padding: "0.75rem", background: "var(--bg-tertiary)", borderRadius: "6px" },
  questionLabel: { display: "block", fontSize: "0.9rem", fontWeight: 500, color: "var(--fg-primary)", marginBottom: "0.25rem" },
  questionWhy: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", color: "var(--fg-muted)", fontStyle: "italic" },
  questionInput: { width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.85rem", background: "var(--bg-primary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--fg-primary)", outline: "none" },
  clarificationActions: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  skipBtn: { padding: "0.5rem 0.75rem", fontSize: "0.8rem", background: "none", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg-muted)", cursor: "pointer" },
  submitClarificationBtn: { padding: "0.5rem 1rem", fontSize: "0.85rem", fontWeight: 500, background: "rgba(255, 193, 7, 0.9)", border: "none", borderRadius: "6px", color: "#000", cursor: "pointer" },
  notesSection: { marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.75rem" },
  notesToggle: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "0.5rem 0.75rem", fontSize: "0.8rem", background: "var(--bg-tertiary)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--fg-muted)", cursor: "pointer" },
  notesList: { marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" },
  noteItem: { padding: "0.75rem", background: "var(--bg-tertiary)", borderRadius: "6px", border: "1px solid var(--border)" },
  noteHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" },
  noteSource: { fontSize: "0.75rem", fontWeight: 500, color: "var(--fg-secondary)" },
  noteTime: { fontSize: "0.7rem", color: "var(--fg-muted)" },
  noteContent: { fontSize: "0.8rem", color: "var(--fg-primary)", whiteSpace: "pre-wrap", lineHeight: 1.5 },
};
