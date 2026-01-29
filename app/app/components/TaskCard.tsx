"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Task, Session } from "../lib/types";
import {
  editSubtask,
  addSubtaskToTask,
  removeSubtaskFromTask,
  editTask,
  addTask,
  reorderSubtasks,
  addNoteToTask,
  saveAsTemplate,
} from "../lib/actions";
import s from "./TaskCard.module.css";

interface Props {
  task: Task;
  activeSession?: Session;
  onStart?: () => void;
  onResume?: () => void;
  onDelete: () => void;
  isDone?: boolean;
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

// Review panel types for Analysis feature
// Shows proposed changes with toggleable acceptance

interface StepProposal {
  stepIndex: number;
  originalText: string;
  proposedMinutes?: number;
  proposedCta?: string;
  proposedDeliverable?: string;
  proposedSoWhat?: string;
  /** Pragmatic action advice explaining the change (e.g., "Use this time to prioritize topics.") */
  guidance?: string;
  accepted: boolean;
}

interface NewStepProposal {
  text: string;
  /** Pragmatic action advice for new step (e.g., "Confirm focus before sending.") */
  guidance?: string;
  accepted: boolean;
}

interface DoneMeansProposal {
  text: string;
  accepted: boolean;
}

interface ElaborateReview {
  stepProposals: StepProposal[];
  newStepProposals: NewStepProposal[];
  doneMeansProposals: DoneMeansProposal[];
  extractTasks: Array<{
    stepIndex: number;
    taskName: string;
    reason: string;
    suggestedSubtasks: string[];
    estimatedMinutes?: number;
  }>;
  explanation: string;
}

interface RefineReview {
  originalSubtasks: Array<{ id: string; text: string }>;
  proposedSubtasks: Array<{ text: string; cta?: string; deliverable?: string; soWhat?: string; guidance?: string; accepted: boolean }>;
  proposedDuration?: number;
  reasoning: string;
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

function formatCompletedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BragCallout({ task }: { task: Task }) {
  const [valueStatement, setValueStatement] = useState<string | null>(task.acceptedValueStatement || null);
  const [overallImpact, setOverallImpact] = useState<string | null>(task.acceptedOverallImpact || null);
  const [loading, setLoading] = useState(!task.acceptedValueStatement); // Skip loading if already stored
  const [accepted, setAccepted] = useState(!!task.acceptedValueStatement);
  const [accepting, setAccepting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const completedDate = task.completedAt ? formatCompletedDate(task.completedAt) : "Recently";

  // Fetch AI-generated value statement on mount - only if not already stored
  useEffect(() => {
    if (task.acceptedValueStatement) {
      // Already have stored statement, no need to fetch
      setValueStatement(task.acceptedValueStatement);
      setOverallImpact(task.acceptedOverallImpact || null);
      setLoading(false);
      setAccepted(true);
      return;
    }
    const fetchValueStatement = async () => {
      try {
        const res = await fetch("/api/value-statement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task: task.text }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.statement) {
            setValueStatement(data.statement);
          }
          if (data.overallImpact) {
            setOverallImpact(data.overallImpact);
          }
        }
      } catch {
        // Silently fail, will show fallback
      } finally {
        setLoading(false);
      }
    };
    fetchValueStatement();
  }, [task.text, task.acceptedValueStatement, task.acceptedOverallImpact]);

  // Use AI statement or fallback
  const summaryText = valueStatement || `Delivered on ${task.text.toLowerCase()}, contributing to team execution quality.`;

  const handleAccept = async () => {
    if (accepted || accepting || !summaryText) return;
    setAccepting(true);
    try {
      // Save to task for future retrieval (avoids AI regeneration)
      await editTask(task.id, {
        acceptedValueStatement: summaryText,
        acceptedOverallImpact: overallImpact || undefined,
      });

      // Also save to brag list markdown file
      const res = await fetch("/api/brag", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: {
            title: task.text,
            bullet: summaryText,
            metrics: `Completed ${completedDate}`,
            category: "Execution",
            frequency: "one-time",
            confidence: "high",
            overallImpact: overallImpact || undefined,
          },
        }),
      });
      if (res.ok) {
        setAccepted(true);
      }
    } catch {
      // Silently fail
    } finally {
      setAccepting(false);
    }
  };

  const handleRegenerate = async () => {
    if (regenerating) return;
    setRegenerating(true);
    setLoading(true);
    setAccepted(false);

    try {
      // Clear stored values from task
      await editTask(task.id, {
        acceptedValueStatement: undefined,
        acceptedOverallImpact: undefined,
      });

      // Fetch new value statement
      const res = await fetch("/api/value-statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.text }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.statement) {
          setValueStatement(data.statement);
        }
        if (data.overallImpact) {
          setOverallImpact(data.overallImpact);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
      setLoading(false);
    }
  };

  return (
    <div className={s.bragCallout}>
      {loading ? (
        <p className={s.bragLoadingText}>Generating value statement...</p>
      ) : (
        <>
          <p className={s.bragSummaryText}>{summaryText}</p>
          {overallImpact && (
            <p className={s.bragImpactText}><strong>Impact:</strong> {overallImpact}</p>
          )}
        </>
      )}
      <div className={s.bragFooter}>
        <span className={s.bragDateText}>{completedDate}</span>
        <div className={s.bragActions}>
          {accepted ? (
            <>
              <span className={s.bragAcceptedBtn}>✓ Saved</span>
              <button
                onClick={handleRegenerate}
                className={s.bragRegenerateBtn}
                disabled={regenerating}
                title="Generate a new value statement"
              >
                {regenerating ? "..." : "Regenerate"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAccept}
                className={s.bragAcceptBtn}
                disabled={loading || accepting}
              >
                {accepting ? "..." : "Accept"}
              </button>
              <button
                onClick={handleRegenerate}
                className={s.bragRegenerateBtn}
                disabled={loading || regenerating}
                title="Try a different phrasing"
              >
                {regenerating ? "..." : "Regenerate"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Did you know hints - loaded from external JSON for easy updates
import hintsData from "../../data/hints.json";
const HINTS = hintsData.hints;

function DidYouKnowHint({ taskId }: { taskId: string }) {
  // Pick a consistent hint based on task ID
  const hintIndex = taskId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % HINTS.length;
  const hint = HINTS[hintIndex];

  return (
    <p className={s.hint}>
      <span className={s.hintLabel}>Tip:</span> {hint.text}
    </p>
  );
}

export default function TaskCard({ task, activeSession, onStart, onResume, onDelete, isDone }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [editingTaskName, setEditingTaskName] = useState(false);
  const [taskNameText, setTaskNameText] = useState(task.text);
  const [editingWhy, setEditingWhy] = useState(false);
  const [whyText, setWhyText] = useState(task.coreWhy);
  const [editingSubtask, setEditingSubtask] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [newSubtask, setNewSubtask] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [elaborating, setElaborating] = useState(false);
  const [showSecondOpinion, setShowSecondOpinion] = useState(false);
  const [anonymizedPrompt, setAnonymizedPrompt] = useState("");
  const [anonymizing, setAnonymizing] = useState(false);
  const [pastedResponse, setPastedResponse] = useState("");
  const [elaborateReview, setElaborateReview] = useState<ElaborateReview | null>(null);
  const [clarificationQuestions, setClarificationQuestions] = useState<Array<{
    question: string;
    why: string;
    answer: string;
  }>>([]);
  const [showClarification, setShowClarification] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineReview, setRefineReview] = useState<RefineReview | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSuggestion, setTemplateSuggestion] = useState<{ worthy: boolean; reason: string } | null>(null);

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

  const handleElaborate = async (additionalContext?: string, skipClarification?: boolean) => {
    if (elaborating) return;
    setElaborating(true);
    setElaborateReview(null);
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

        // Build review instead of auto-applying
        const stepAnalysis = result.stepAnalysis || result.stepTimeEstimates || [];
        const doneMeans = Array.isArray(result.doneMeans) ? result.doneMeans : [];

        // Build step proposals from analysis
        const stepProposals: StepProposal[] = stepAnalysis
          .filter((a: { stepIndex: number }) => a.stepIndex >= 1 && a.stepIndex <= task.subtasks.length)
          .map((a: { stepIndex: number; estimatedMinutes?: number; cta?: string; deliverable?: string; soWhat?: string; guidance?: string }) => ({
            stepIndex: a.stepIndex,
            originalText: task.subtasks[a.stepIndex - 1].text,
            proposedMinutes: a.estimatedMinutes,
            proposedCta: a.cta,
            proposedDeliverable: a.deliverable,
            proposedSoWhat: a.soWhat,
            guidance: a.guidance,
            accepted: true,
          }));

        // Build new step proposals (deduplicated)
        const existingTexts = new Set(
          task.subtasks.map((st) =>
            st.text.replace(/\s*\(~?\d+\s*min\)$/i, "").toLowerCase().trim()
          )
        );
        const newStepProposals: NewStepProposal[] = (result.newSubtasks || [])
          .filter((item: string | { text: string; guidance?: string }) => {
            const text = typeof item === "string" ? item : item.text;
            const cleanText = text.replace(/\s*\(~?\d+\s*min\)$/i, "").toLowerCase().trim();
            return !existingTexts.has(cleanText);
          })
          .map((item: string | { text: string; guidance?: string }) => ({
            text: typeof item === "string" ? item : item.text,
            guidance: typeof item === "string" ? undefined : item.guidance,
            accepted: true,
          }));

        // Build doneMeans proposals
        const existingDoneMeans = new Set((task.doneMeans || []).map((d: string) => d.toLowerCase()));
        const doneMeansProposals: DoneMeansProposal[] = doneMeans
          .filter((text: string) => !existingDoneMeans.has(text.toLowerCase()))
          .map((text: string) => ({ text, accepted: true }));

        setElaborateReview({
          stepProposals,
          newStepProposals,
          doneMeansProposals,
          extractTasks: result.extractTasks || [],
          explanation: result.explanation || "",
        });

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

  // Elaborate review handlers
  const toggleStepProposal = (i: number) => {
    setElaborateReview((prev) => {
      if (!prev) return prev;
      const updated = [...prev.stepProposals];
      updated[i] = { ...updated[i], accepted: !updated[i].accepted };
      return { ...prev, stepProposals: updated };
    });
  };

  const toggleNewStepProposal = (i: number) => {
    setElaborateReview((prev) => {
      if (!prev) return prev;
      const updated = [...prev.newStepProposals];
      updated[i] = { ...updated[i], accepted: !updated[i].accepted };
      return { ...prev, newStepProposals: updated };
    });
  };

  const toggleDoneMeansProposal = (i: number) => {
    setElaborateReview((prev) => {
      if (!prev) return prev;
      const updated = [...prev.doneMeansProposals];
      updated[i] = { ...updated[i], accepted: !updated[i].accepted };
      return { ...prev, doneMeansProposals: updated };
    });
  };

  const handleApplyElaborateReview = async () => {
    if (!elaborateReview) return;

    // Apply accepted step proposals
    let updatedSubtasks = [...task.subtasks];
    const acceptedSteps: string[] = [];

    elaborateReview.stepProposals.forEach((p) => {
      if (p.accepted) {
        const idx = p.stepIndex - 1;
        if (idx >= 0 && idx < updatedSubtasks.length) {
          const st = updatedSubtasks[idx];
          const cleanText = st.text.replace(/\s*\(~?\d+\s*min\)$/i, "").trim();
          updatedSubtasks[idx] = {
            ...st,
            text: p.proposedMinutes ? `${cleanText} (~${p.proposedMinutes}min)` : st.text,
            ...(p.proposedCta && { cta: p.proposedCta }),
            ...(p.proposedDeliverable && { deliverable: p.proposedDeliverable }),
            ...(p.proposedSoWhat && { soWhat: p.proposedSoWhat }),
            ...(p.guidance && { guidance: p.guidance }),
          };
          acceptedSteps.push(`Step ${p.stepIndex}: updated`);
        }
      }
    });

    // Add accepted new steps (with guidance for Focus mode)
    const addedSteps: string[] = [];
    elaborateReview.newStepProposals.forEach((p, i) => {
      if (p.accepted) {
        updatedSubtasks.push({
          id: `st-${Date.now()}-${i}`,
          text: p.text,
          completed: false,
          ...(p.guidance && { guidance: p.guidance }),
        });
        addedSteps.push(p.text.replace(/\s*\(~?\d+\s*min\)$/i, "").trim());
      }
    });

    // Build doneMeans
    const acceptedDoneMeans: string[] = [];
    elaborateReview.doneMeansProposals.forEach((p) => {
      if (p.accepted) acceptedDoneMeans.push(p.text);
    });
    const finalDoneMeans = [...(task.doneMeans || []), ...acceptedDoneMeans];

    // Apply changes
    const hasChanges = acceptedSteps.length > 0 || addedSteps.length > 0 || acceptedDoneMeans.length > 0;
    if (hasChanges) {
      await editTask(task.id, {
        subtasks: updatedSubtasks,
        ...(acceptedDoneMeans.length > 0 && { doneMeans: finalDoneMeans }),
      });
    }

    // Build audit note - only track actual changes
    const parts: string[] = [];
    if (elaborateReview.explanation) parts.push(`*${elaborateReview.explanation}*`);
    if (acceptedSteps.length > 0) parts.push(`**Accepted changes:** ${acceptedSteps.join(", ")}`);
    if (addedSteps.length > 0) parts.push(`**Added steps:** ${addedSteps.join("; ")}`);
    if (acceptedDoneMeans.length > 0) parts.push(`**Done means:** ${acceptedDoneMeans.join("; ")}`);

    await addNoteToTask(
      task.id,
      `**AI Analysis - Review Decision:**\n\n${parts.join("\n")}`,
      "ai-analysis"
    );

    setElaborateReview(null);
    router.refresh();

    // Evaluate if task is now template-worthy
    if (hasChanges) {
      setTimeout(() => evaluateForTemplate(), 500);
    }
  };

  const handleRejectAllElaborate = async () => {
    await addNoteToTask(
      task.id,
      `**AI Analysis - Dismissed:**\n\n*${elaborateReview?.explanation || "No explanation"}*\n\nAll proposed changes were dismissed by user.`,
      "ai-analysis"
    );
    setElaborateReview(null);
    router.refresh();
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

      setElaborateReview(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to extract task:", error);
    }
  };

  const handleSecondOpinion = async (service: "perplexity" | "chatgpt" | "youcom" | "deepseek") => {
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
      } else if (service === "youcom") {
        window.open(`https://you.com/search?q=${encodeURIComponent(prompt)}&tbm=youchat`, "_blank");
      } else if (service === "deepseek") {
        // DeepSeek doesn't support URL pre-fill - user pastes from panel
        window.open("https://chat.deepseek.com/", "_blank");
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
    setRefineReview(null);

    try {
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
          // API returns objects {text, cta?, deliverable?, soWhat?, guidance?}
          const proposedSteps = result.subtasks.map((s: string | { text: string; cta?: string; deliverable?: string; soWhat?: string; guidance?: string }) => {
            if (typeof s === "string") {
              return { text: s, accepted: true };
            }
            return {
              text: s.text,
              ...(s.cta && { cta: s.cta }),
              ...(s.deliverable && { deliverable: s.deliverable }),
              ...(s.soWhat && { soWhat: s.soWhat }),
              ...(s.guidance && { guidance: s.guidance }),
              accepted: true,
            };
          });
          setRefineReview({
            originalSubtasks: task.subtasks.map((st) => ({ id: st.id, text: st.text })),
            proposedSubtasks: proposedSteps,
            proposedDuration: result.duration,
            reasoning: result.reasoning || "",
          });
          setShowSecondOpinion(false);
          setPastedResponse("");
          setAnonymizedPrompt("");
        }
      }
    } catch (error) {
      console.error("Failed to refine suggestions:", error);
    } finally {
      setRefining(false);
    }
  };

  // Refine review handlers
  const toggleRefineProposal = (i: number) => {
    setRefineReview((prev) => {
      if (!prev) return prev;
      const updated = [...prev.proposedSubtasks];
      updated[i] = { ...updated[i], accepted: !updated[i].accepted };
      return { ...prev, proposedSubtasks: updated };
    });
  };

  const handleApplyRefineReview = async () => {
    if (!refineReview) return;

    const accepted = refineReview.proposedSubtasks.filter((p) => p.accepted);
    const rejected = refineReview.proposedSubtasks.filter((p) => !p.accepted);

    if (accepted.length > 0) {
      const newSubtasks = accepted.map((p, i) => ({
        id: `st-${Date.now()}-${i}`,
        text: p.text,
        completed: false,
        ...(p.cta && { cta: p.cta }),
        ...(p.deliverable && { deliverable: p.deliverable }),
        ...(p.soWhat && { soWhat: p.soWhat }),
        ...(p.guidance && { guidance: p.guidance }),
      }));

      await editTask(task.id, {
        subtasks: newSubtasks,
        ...(refineReview.proposedDuration && { duration: refineReview.proposedDuration as 15 | 30 | 45 | 60 }),
      });
    }

    // Build audit note with before/after
    const originalList = refineReview.originalSubtasks.map((s) => s.text).join("; ");
    const acceptedList = accepted.map((s) => s.text).join("; ");
    const rejectedList = rejected.length > 0 ? rejected.map((s) => s.text).join("; ") : "None";

    const parts = [
      refineReview.reasoning ? `*${refineReview.reasoning}*` : "",
      `**Original steps (${refineReview.originalSubtasks.length}):** ${originalList}`,
      `**Accepted (${accepted.length}):** ${acceptedList}`,
      rejected.length > 0 ? `**Rejected (${rejected.length}):** ${rejectedList}` : "",
    ].filter(Boolean);

    await addNoteToTask(
      task.id,
      `**AI Refinement - Review Decision:**\n\n${parts.join("\n")}`,
      "ai-refine"
    );

    setRefineReview(null);
    router.refresh();
  };

  const handleRejectAllRefine = async () => {
    await addNoteToTask(
      task.id,
      `**AI Refinement - Dismissed:**\n\n*${refineReview?.reasoning || "No reasoning"}*\n\nAll proposed changes were dismissed. Original steps kept.`,
      "ai-refine"
    );
    setRefineReview(null);
    router.refresh();
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

  const handleSaveWhy = async () => {
    if (!whyText.trim() || whyText.trim() === task.coreWhy) {
      setEditingWhy(false);
      setWhyText(task.coreWhy);
      return;
    }
    await editTask(task.id, { coreWhy: whyText.trim() });
    setEditingWhy(false);
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

  const handleSaveAsTemplate = async () => {
    if (savingTemplate) return;
    setSavingTemplate(true);
    try {
      await saveAsTemplate(task.id);
      setTemplateSuggestion(null); // Clear suggestion after saving
    } catch (error) {
      console.error("Failed to save template:", error);
    } finally {
      setSavingTemplate(false);
    }
  };

  const evaluateForTemplate = async () => {
    try {
      const response = await fetch("/api/evaluate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: task.text,
          subtasks: task.subtasks.map(st => st.text),
        }),
      });
      if (response.ok) {
        const result = await response.json();
        if (result.worthy) {
          setTemplateSuggestion({ worthy: true, reason: result.reason || "" });
        }
      }
    } catch {
      // Silently fail
    }
  };

  const handleUndone = async () => {
    await editTask(task.id, { completedAt: undefined });
    router.refresh();
  };

  // Evaluate for template when done task is expanded
  const [templateEvaluated, setTemplateEvaluated] = useState(false);
  if (isDone && expanded && !templateEvaluated && !templateSuggestion) {
    setTemplateEvaluated(true);
    evaluateForTemplate();
  }

  return (
    <div className={`${s.card} ${isInProgress ? s.cardInProgress : ""} ${isDone ? s.cardDone : ""}`}>
      {/* Compact header - always visible */}
      <div className={s.header}>
        {!isDone && (
          <button
            onClick={isInProgress && onResume ? onResume : onStart}
            className={`${s.playBtn} ${isInProgress ? s.playBtnResume : ""}`}
            title={isInProgress ? "Resume session" : "Start focus session"}
          >
            {isInProgress ? "▶" : "▶"}
          </button>
        )}
        {isDone && (
          <span className={s.doneCheck}>✓</span>
        )}
        <div className={s.titleArea}>
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
              className={s.taskNameInput}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={`${s.title} ${isDone ? s.titleDone : ""}`}
              onClick={() => setExpanded(!expanded)}
              onDoubleClick={isDone ? undefined : (e) => { e.stopPropagation(); setEditingTaskName(true); setTaskNameText(task.text); }}
              title={isDone ? "Completed task" : "Click to expand, double-click to edit"}
            >
              {task.text}
            </span>
          )}
          <div className={s.metaRow} onClick={() => setExpanded(!expanded)}>
            <span className={s.meta}>
              {estimatedDisplay} est · {totalCount} steps
            </span>
            {isInProgress && (
              <>
                <span className={s.inProgressBadge}>In Progress</span>
                <span className={s.timeWorked}>{timeWorkedDisplay} worked</span>
              </>
            )}
          </div>
        </div>
        <span className={s.chevron} onClick={() => setExpanded(!expanded)}>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      {/* Expanded content - hidden by default */}
      {expanded && (
        <div className={s.expandedContent}>
          {/* Brag callout for done tasks */}
          {isDone && (
            <BragCallout task={task} />
          )}

          {/* Why section - on top (not editable when done) */}
          {!isDone && (
            <div className={s.whySection}>
              {editingWhy ? (
                <div className={s.whyEditRow}>
                  <strong className={s.whyLabel}>Why:</strong>
                  <input
                    type="text"
                    value={whyText}
                    onChange={(e) => setWhyText(e.target.value)}
                    onBlur={handleSaveWhy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveWhy();
                      if (e.key === "Escape") {
                        setEditingWhy(false);
                        setWhyText(task.coreWhy);
                      }
                    }}
                    className={s.whyInput}
                    autoFocus
                  />
                </div>
              ) : (
                <p
                  className={s.why}
                  onDoubleClick={() => { setEditingWhy(true); setWhyText(task.coreWhy); }}
                  title="Double-click to edit"
                >
                  <strong>Why:</strong> {task.coreWhy}
                </p>
              )}
            </div>
          )}

          {/* Subtasks - read-only when done */}
          <div className={s.subtasks}>
            {isDone ? (
              // Read-only completed subtasks
              task.subtasks.map((st) => (
                <div key={st.id} className={s.doneSubtaskRow}>
                  <span className={s.doneCheckMark}>✓</span>
                  <span className={s.doneSubtaskText}>
                    {st.text.replace(/\s*\(~?(\d+)\s*min\)$/i, "")}
                  </span>
                </div>
              ))
            ) : (
              // Editable subtasks
              <>
                {task.subtasks.map((st, i) => (
                  <div
                    key={st.id}
                    className={`${s.subtaskRow} ${draggedIndex === i ? s.subtaskDragging : ""} ${dragOverIndex === i ? s.subtaskDragOver : ""}`}
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
                          className={s.editInput}
                          autoFocus
                        />
                        <button onClick={() => handleEditSubtask(st.id)} className={s.saveBtn}>✓</button>
                        <button onClick={() => setEditingSubtask(null)} className={s.cancelEditBtn}>×</button>
                      </>
                    ) : (
                      <>
                        <span className={s.dragHandle} title="Drag to reorder">⋮⋮</span>
                        <span
                          className={s.subtaskText}
                          onDoubleClick={() => { setEditingSubtask(st.id); setEditText(st.text); }}
                          title="Double-click to edit"
                        >
                          {st.text.replace(/\s*\(~?(\d+)\s*min\)$/i, "")}
                        </span>
                        {(() => {
                          const timeMatch = st.text.match(/\(~?(\d+)\s*min\)$/i);
                          return timeMatch ? (
                            <span className={s.subtaskTime}>{timeMatch[1]}m</span>
                          ) : null;
                        })()}
                        <button onClick={() => handleRemoveSubtask(st.id)} className={s.removeBtn}>×</button>
                      </>
                    )}
                  </div>
                ))}

                <div className={s.addRow}>
                  <input
                    type="text"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubtask()}
                    placeholder="Add step..."
                    className={s.addInput}
                  />
                  {newSubtask.trim() && (
                    <button onClick={handleAddSubtask} className={s.addBtn}>+</button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Clarification questions */}
          {showClarification && clarificationQuestions.length > 0 && (
            <div className={s.clarificationPanel}>
              <div className={s.clarificationHeader}>
                <span className={s.clarificationIcon}>💬</span>
                <span className={s.clarificationTitle}>Quick questions to improve analysis</span>
              </div>
              <div className={s.questionsList}>
                {clarificationQuestions.map((q, i) => (
                  <div key={i} className={s.questionItem}>
                    <label className={s.questionLabel}>{q.question}</label>
                    <p className={s.questionWhy}>{q.why}</p>
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
                      className={s.questionInput}
                    />
                  </div>
                ))}
              </div>
              <div className={s.clarificationActions}>
                <button onClick={handleSkipClarification} className={s.skipBtn}>
                  Skip & analyze anyway
                </button>
                <button
                  onClick={handleSubmitClarification}
                  disabled={!clarificationQuestions.some((q) => q.answer.trim())}
                  className={`${s.submitClarificationBtn} ${!clarificationQuestions.some((q) => q.answer.trim()) ? s.btnDisabled : ""}`}
                >
                  {elaborating ? "Analyzing..." : "Continue"}
                </button>
              </div>
            </div>
          )}

          {/* Elaborate review panel - Original vs Proposed like 2nd Opinion */}
          {elaborateReview && (
            <div className={s.reviewPanel}>
              <div className={s.reviewHeader}>
                <span className={s.reviewTitle}>Analysis</span>
                <button onClick={handleRejectAllElaborate} className={s.reviewDismissBtn}>×</button>
              </div>

              {/* Consolidated summary hint with guidance */}
              {(() => {
                const guidanceItems: string[] = [];

                // Collect time changes with guidance
                elaborateReview.stepProposals.forEach((p) => {
                  if (p.proposedMinutes) {
                    const origMatch = task.subtasks[p.stepIndex - 1]?.text.match(/\(~?(\d+)\s*min\)$/i);
                    const origMin = origMatch ? parseInt(origMatch[1], 10) : 0;
                    const delta = p.proposedMinutes - origMin;
                    if (delta !== 0) {
                      const sign = delta > 0 ? "+" : "";
                      const timeChange = `(${sign}${delta}min)`;
                      if (p.guidance) {
                        guidanceItems.push(`${timeChange} ${p.guidance}`);
                      }
                    }
                  }
                });

                // Collect new steps with guidance
                elaborateReview.newStepProposals.forEach((p) => {
                  const stepName = p.text.replace(/\s*\(~?\d+\s*min\)$/i, "").trim();
                  const timeMatch = p.text.match(/\(~?(\d+)\s*min\)$/i);
                  const timeStr = timeMatch ? ` (~${timeMatch[1]}min)` : "";
                  if (p.guidance) {
                    guidanceItems.push(`+ ${stepName}${timeStr}. ${p.guidance}`);
                  } else {
                    guidanceItems.push(`+ ${stepName}${timeStr}`);
                  }
                });

                if (guidanceItems.length === 0) return null;

                return (
                  <div className={s.guidanceSummary}>
                    {guidanceItems.map((item, i) => (
                      <p key={i} className={s.guidanceSummaryItem}>{item}</p>
                    ))}
                  </div>
                );
              })()}

              {/* Show message if no proposals */}
              {elaborateReview.stepProposals.length === 0 &&
                elaborateReview.newStepProposals.length === 0 &&
                elaborateReview.doneMeansProposals.length === 0 &&
                elaborateReview.extractTasks.length === 0 && (
                <p className={s.noChangesMsg}>No changes suggested. Try again or check if Ollama is running.</p>
              )}

              {/* Original vs Proposed comparison */}
              {(elaborateReview.stepProposals.length > 0 ||
                elaborateReview.newStepProposals.length > 0) && (
              <div className={s.diffContainer}>
                <div className={s.diffColumn}>
                  <h4 className={s.diffTitle}>Original ({task.subtasks.length})</h4>
                  {task.subtasks.map((st, i) => (
                    <div key={st.id} className={s.diffItemOriginal}>
                      <span className={s.diffIndex}>{i + 1}.</span>
                      <span>{st.text.replace(/\s*\(~?\d+\s*min\)$/i, "")}</span>
                    </div>
                  ))}
                </div>
                <div className={s.diffColumn}>
                  <h4 className={s.diffTitle}>Proposed ({task.subtasks.length + elaborateReview.newStepProposals.filter(p => p.accepted).length} steps)</h4>
                  {/* Existing steps with enhancements */}
                  {task.subtasks.map((st, i) => {
                    const proposal = elaborateReview.stepProposals.find(p => p.stepIndex === i + 1);
                    const hasChanges = proposal && proposal.proposedMinutes;
                    return (
                      <div
                        key={st.id}
                        className={`${s.diffItemProposed} ${proposal && !proposal.accepted ? s.changeRejected : ""}`}
                        style={!hasChanges ? { cursor: "default", opacity: 0.6 } : undefined}
                        onClick={() => {
                          if (hasChanges) {
                            const idx = elaborateReview.stepProposals.findIndex(p => p.stepIndex === i + 1);
                            if (idx >= 0) toggleStepProposal(idx);
                          }
                        }}
                      >
                        <div className={s.diffItemProposedRow}>
                          {hasChanges && <span className={s.changeCheck}>{proposal?.accepted ? "☑" : "☐"}</span>}
                          <span>
                            {st.text.replace(/\s*\(~?\d+\s*min\)$/i, "")}
                            {(() => {
                              if (!proposal?.proposedMinutes) return null;
                              const origMatch = st.text.match(/\(~?(\d+)\s*min\)$/i);
                              const origMin = origMatch ? parseInt(origMatch[1], 10) : 0;
                              const delta = proposal.proposedMinutes - origMin;
                              if (delta === 0) return null;
                              const sign = delta > 0 ? "+" : "";
                              const color = delta > 0 ? "#dc2626" : "#16a34a";
                              return <span style={{ color, fontWeight: 500 }}> ({sign}{delta}min)</span>;
                            })()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {/* New steps */}
                  {elaborateReview.newStepProposals.map((p, i) => (
                    <div
                      key={`new-${i}`}
                      className={`${s.diffItemProposed} ${s.diffItemNew} ${p.accepted ? "" : s.changeRejected}`}
                      onClick={() => toggleNewStepProposal(i)}
                    >
                      <div className={s.diffItemProposedRow}>
                        <span className={s.changeCheck}>{p.accepted ? "☑" : "☐"}</span>
                        <span className={s.newStepLabel}>+ {p.text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Done means section */}
              {elaborateReview.doneMeansProposals.length > 0 && (
                <div className={s.doneMeansSection}>
                  <h4 className={s.doneMeansTitle}>Done means:</h4>
                  {elaborateReview.doneMeansProposals.map((p, i) => (
                    <div
                      key={`done-${i}`}
                      className={`${s.doneMeansItem} ${p.accepted ? "" : s.changeRejected}`}
                      onClick={() => toggleDoneMeansProposal(i)}
                    >
                      <span className={s.changeCheck}>{p.accepted ? "☑" : "☐"}</span>
                      <span>{p.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Extract tasks as separate section if present */}
              {elaborateReview.extractTasks.length > 0 && (
                <div className={s.extractRow}>
                  {elaborateReview.extractTasks.map((et, i) => (
                    <button
                      key={i}
                      onClick={() => handleExtractTask(et)}
                      className={s.extractBtn}
                      title={et.reason}
                    >
                      ↗ Extract &quot;{et.taskName}&quot;
                    </button>
                  ))}
                </div>
              )}

              {/* Review actions */}
              {(elaborateReview.stepProposals.length > 0 ||
                elaborateReview.newStepProposals.length > 0 ||
                elaborateReview.doneMeansProposals.length > 0) && (
              <div className={s.reviewActions}>
                <button
                  onClick={handleApplyElaborateReview}
                  className={s.reviewApplyBtn}
                  disabled={
                    !elaborateReview.stepProposals.some((p) => p.accepted) &&
                    !elaborateReview.newStepProposals.some((p) => p.accepted) &&
                    !elaborateReview.doneMeansProposals.some((p) => p.accepted)
                  }
                >
                  Apply ({[
                    ...elaborateReview.stepProposals.filter(p => p.accepted),
                    ...elaborateReview.newStepProposals.filter(p => p.accepted),
                    ...elaborateReview.doneMeansProposals.filter(p => p.accepted),
                  ].length}/{[
                    ...elaborateReview.stepProposals,
                    ...elaborateReview.newStepProposals,
                    ...elaborateReview.doneMeansProposals,
                  ].length})
                </button>
              </div>
              )}
            </div>
          )}

          {/* Reasoning - simple collapsible */}
          {notesCount > 0 && (
            <div className={s.notesSection}>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className={s.notesToggle}
              >
                <span className={s.notesLabel}>Notes ({notesCount})</span>
                <span className={s.notesChevron}>{showNotes ? "⌃" : "⌄"}</span>
              </button>
              {showNotes && (
                <div className={s.notesList}>
                  {task.notes.map((note) => {
                    const isExpanded = expandedNoteId === note.id;
                    const lines = note.content.split("\n").filter((l: string) => l.trim());
                    const preview = lines[0]?.replace(/^\*\*.*?\*\*\s*[-–]?\s*/, "").replace(/\*\*/g, "").trim() || "Note";

                    return (
                      <div key={note.id} className={s.noteItem}>
                        <button
                          onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                          className={s.noteHeader}
                        >
                          <span className={s.notePreview}>{preview}</span>
                          <span className={s.noteDate}>{new Date(note.timestamp).toLocaleDateString()}</span>
                          <span className={s.noteChevron}>{isExpanded ? "⌃" : "⌄"}</span>
                        </button>
                        {isExpanded && (
                          <div className={s.noteContent}>{note.content}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Template suggestion - shows when AI thinks it's worth templating (active tasks only) */}
          {templateSuggestion && !isDone && (
            <div className={s.templateSuggestion}>
              <p className={s.templateSuggestionText}>
                This looks template-worthy! {templateSuggestion.reason}
              </p>
              <div className={s.templateSuggestionActions}>
                <button
                  onClick={handleSaveAsTemplate}
                  disabled={savingTemplate}
                  className={s.templateSaveBtn}
                >
                  {savingTemplate ? "Saving..." : "Save as Template"}
                </button>
                <button
                  onClick={() => setTemplateSuggestion(null)}
                  className={s.templateDismissBtn}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Actions - different for done vs active tasks */}
          <div className={s.actions}>
            {isDone ? (
              <>
                {/* Done task actions */}
                <button onClick={handleUndone} className={s.undoneBtn}>
                  Undo Complete
                </button>
                {templateSuggestion && (
                  <button
                    onClick={handleSaveAsTemplate}
                    disabled={savingTemplate}
                    className={s.templateSaveBtn}
                  >
                    {savingTemplate ? "Saving..." : "Save as Template"}
                  </button>
                )}
              </>
            ) : (
              <>
                {/* Active task actions */}
                <button onClick={() => handleElaborate()} disabled={elaborating} className={s.actionBtn}>
                  {elaborating ? "..." : "Analyze"}
                </button>
                <div className={s.secondOpinionGroup}>
                  <span className={s.secondOpinionLabel}>2nd opinion:</span>
                  <button
                    onClick={() => handleSecondOpinion("chatgpt")}
                    disabled={anonymizing}
                    className={s.externalBtn}
                    title="Get second opinion from ChatGPT (anonymized)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#10A37F">
                      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSecondOpinion("youcom")}
                    disabled={anonymizing}
                    className={s.externalBtn}
                    title="Get second opinion from You.com (anonymized)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#5436DA">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSecondOpinion("perplexity")}
                    disabled={anonymizing}
                    className={s.externalBtn}
                    title="Get second opinion from Perplexity (anonymized)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#20808D">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v5.7c0 4.47-3.07 8.67-7 9.77-3.93-1.1-7-5.3-7-9.77V6.3l7-3.12zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleSecondOpinion("deepseek")}
                    disabled={anonymizing}
                    className={s.externalBtn}
                    title="Get second opinion from DeepSeek (anonymized)"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#4D6BFE">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-13v6l5.25 3.15.75-1.23-4.5-2.67V7H10z"/>
                    </svg>
                  </button>
                </div>
              </>
            )}
            {!showDelete ? (
              <button onClick={() => setShowDelete(true)} className={s.deleteBtn}>Delete</button>
            ) : (
              <div className={s.confirmDelete}>
                <span>Delete?</span>
                <button onClick={onDelete} className={s.confirmYes}>Yes</button>
                <button onClick={() => setShowDelete(false)} className={s.confirmNo}>No</button>
              </div>
            )}
          </div>

          {/* Did you know hints - only for active tasks */}
          {!isDone && (
            <DidYouKnowHint taskId={task.id} />
          )}

          {/* Second Opinion Panel */}
          {showSecondOpinion && (
            <div className={s.secondOpinionPanel}>
              <div className={s.panelHeader}>
                <span className={s.panelTitle}>Second Opinion</span>
                <button onClick={() => { setShowSecondOpinion(false); setPastedResponse(""); }} className={s.panelClose}>×</button>
              </div>
              <p className={s.privacyNote}>Names and entities have been anonymized before sending</p>
              <details className={s.promptDetails}>
                <summary className={s.promptSummary}>View sent prompt</summary>
                <pre className={s.promptText}>{anonymizedPrompt}</pre>
              </details>
              <textarea
                value={pastedResponse}
                onChange={(e) => setPastedResponse(e.target.value)}
                placeholder="Paste the AI response here..."
                className={s.pasteTextarea}
                rows={4}
              />
              <div className={s.panelActions}>
                <button
                  onClick={handleParsePastedResponse}
                  disabled={!pastedResponse.trim() || refining}
                  className={`${s.applyBtn} ${!pastedResponse.trim() || refining ? s.btnDisabled : ""}`}
                >
                  {refining ? "Analyzing..." : "Review Suggestions"}
                </button>
              </div>
            </div>
          )}

          {/* Refine review panel */}
          {refineReview && (
            <div className={s.reviewPanel}>
              <div className={s.reviewHeader}>
                <span className={s.reviewTitle}>2nd Opinion</span>
                <button onClick={handleRejectAllRefine} className={s.reviewDismissBtn}>×</button>
              </div>

              {refineReview.reasoning && (
                <p className={s.reviewExplanation}>{refineReview.reasoning}</p>
              )}

              {/* Before/after comparison */}
              <div className={s.diffContainer}>
                <div className={s.diffColumn}>
                  <h4 className={s.diffTitle}>Original ({refineReview.originalSubtasks.length})</h4>
                  {refineReview.originalSubtasks.map((st, i) => (
                    <div key={i} className={s.diffItemOriginal}>
                      <span className={s.diffIndex}>{i + 1}.</span>
                      <span>{String(st.text || "").replace(/\s*\(~?\d+\s*min\)$/i, "")}</span>
                    </div>
                  ))}
                </div>
                <div className={s.diffColumn}>
                  <h4 className={s.diffTitle}>Proposed ({refineReview.proposedSubtasks.length} steps)</h4>
                  {refineReview.proposedSubtasks.map((p, i) => (
                    <div
                      key={i}
                      className={`${s.diffItemProposed} ${p.accepted ? "" : s.changeRejected}`}
                      onClick={() => toggleRefineProposal(i)}
                    >
                      <div className={s.diffItemProposedRow}>
                        <span className={s.changeCheck}>{p.accepted ? "☑" : "☐"}</span>
                        <span>{String(p.text || "").replace(/\s*\(~?\d+\s*min\)$/i, "")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {refineReview.proposedDuration && refineReview.proposedDuration !== task.duration && (
                <p className={s.durationChange}>
                  Duration: {task.duration}min → {refineReview.proposedDuration}min
                </p>
              )}

              {/* Review actions */}
              <div className={s.reviewActions}>
                <button
                  onClick={handleApplyRefineReview}
                  className={s.reviewApplyBtn}
                  disabled={!refineReview.proposedSubtasks.some((p) => p.accepted)}
                >
                  Apply ({refineReview.proposedSubtasks.filter((p) => p.accepted).length}/{refineReview.proposedSubtasks.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
