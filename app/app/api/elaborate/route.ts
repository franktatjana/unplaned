/**
 * Elaborate/Analyze API Route
 *
 * Analyzes an existing task breakdown and suggests improvements:
 * - Time estimates for each step
 * - CTA (Call to Action), Deliverable, and SoWhat for each step
 * - Identifies complex steps (>45 min) that should become separate tasks
 * - Suggests missing critical steps
 * - Defines "done means" - ripple effects beyond core task
 *
 * Two-phase operation:
 * 1. Clarification phase - Asks questions if task is vague
 * 2. Analysis phase - Full step-by-step analysis
 *
 * @route POST /api/elaborate
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama, extractJSON, tryParseJSON } from "../../lib/ollama";
import { buildElaboratePrompt, buildClarificationPrompt } from "../../lib/prompts";

// ============================================
// Phase 1: Clarification Assessment
// ============================================

/**
 * Determines if the task needs clarifying questions before analysis.
 *
 * Only asks questions when truly necessary:
 * - Task is vague ("work on project" - which project?)
 * - Key details missing that change the approach
 * - Time/scope unclear
 *
 * @param task - The task description
 * @param subtasks - Array of subtask texts
 * @returns Object indicating if clarification needed and questions to ask
 */
async function assessNeedsClarification(task: string, subtasks: string[]): Promise<{
  needsClarification: boolean;
  questions: Array<{ question: string; why: string }>;
}> {
  // Format subtasks as numbered list for the prompt
  const subtasksList = subtasks.map((st, i) => `${i + 1}. ${st}`).join("\n");
  const prompt = buildClarificationPrompt(task, subtasksList);

  // Use low temperature for consistent yes/no decisions
  const result = await callOllama(prompt, { temperature: 0.2, num_predict: 300 });
  if (!result.ok) {
    // If AI unavailable, skip clarification and proceed to analysis
    return { needsClarification: false, questions: [] };
  }

  const parsed = extractJSON(result.text);
  if (parsed?.needsClarification && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
    return {
      needsClarification: true,
      // Limit to 3 questions max, filter out empty questions
      questions: (parsed.questions as Array<{ question?: string; why?: string }>)
        .slice(0, 3)
        .filter((q) => q.question) as Array<{ question: string; why: string }>,
    };
  }

  return { needsClarification: false, questions: [] };
}

// ============================================
// Main Route Handler
// ============================================

/**
 * POST /api/elaborate
 *
 * Request body:
 * - task: string - The task description
 * - subtasks: string[] - Array of subtask texts
 * - additionalContext?: string - User-provided context (from clarification)
 * - skipClarification?: boolean - Skip phase 1 and go straight to analysis
 *
 * Response (clarification phase):
 * - phase: "clarification"
 * - questions: Array<{question, why}>
 * - parentTask: string
 *
 * Response (analysis phase):
 * - newSubtasks: Array<{text, guidance?}> - Additional steps with pragmatic guidance
 * - extractTasks: Array - Complex steps to extract as separate tasks
 * - stepAnalysis: Array - Time/CTA/Deliverable/SoWhat/guidance per step
 *   - guidance: string - Action-oriented advice (e.g., "Use this time to prioritize topics.")
 * - doneMeans: string[] - Task completion criteria
 * - explanation: string - Summary of key changes
 * - parentTask: string
 */
export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, additionalContext, skipClarification } = await request.json();

    // Validate required fields
    if (!task || !subtasks) {
      return NextResponse.json(
        { error: "Task and subtasks are required" },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // Phase 1: Clarification (optional)
    // ----------------------------------------
    // Skip if: explicit skip flag, or user already provided context
    if (!skipClarification && !additionalContext) {
      const assessment = await assessNeedsClarification(task, subtasks);
      if (assessment.needsClarification && assessment.questions.length > 0) {
        return NextResponse.json({
          phase: "clarification",
          questions: assessment.questions,
          parentTask: task,
        });
      }
    }

    // ----------------------------------------
    // Phase 2: Full Analysis
    // ----------------------------------------
    const subtasksList = subtasks.map((st: string, i: number) => `${i + 1}. ${st}`).join("\n");

    // Include user's additional context if provided (from clarification answers)
    const contextSection = additionalContext
      ? `\nADDITIONAL CONTEXT FROM USER:\n${additionalContext}\n`
      : "";

    const prompt = buildElaboratePrompt(task, subtasksList, contextSection);

    // Use moderate temperature and high token limit for detailed analysis
    // Needs 3000+ tokens to handle tasks with many steps + CTA/deliverable/soWhat/guidance per step
    const result = await callOllama(prompt, { temperature: 0.3, num_predict: 3500 });

    if (!result.ok) {
      console.error("Ollama request failed:", result.error);
      return NextResponse.json({
        newSubtasks: [],
        extractTasks: [],
        stepAnalysis: [],
        doneMeans: [],
        explanation: result.error || "AI service error. Is Ollama running?",
        parentTask: task,
      });
    }

    // ----------------------------------------
    // Parse AI Response
    // ----------------------------------------
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response. Raw text:", result.text.substring(0, 200));
      return NextResponse.json({
        newSubtasks: [],
        extractTasks: [],
        stepAnalysis: [],
        doneMeans: [],
        explanation: "AI response was not in expected format. Try again.",
        parentTask: task,
      });
    }

    const parsed = tryParseJSON(jsonMatch[0]) as Record<string, unknown> | null;
    if (!parsed) {
      console.error("JSON parse failed. Raw match:", jsonMatch[0].substring(0, 300));
      return NextResponse.json({
        newSubtasks: [],
        extractTasks: [],
        stepAnalysis: [],
        doneMeans: [],
        explanation: "AI returned malformed data. Try again.",
        parentTask: task,
      });
    }

    // ----------------------------------------
    // Process Complex Steps
    // ----------------------------------------
    // Steps over 45 minutes should be extracted as separate tasks
    // Steps under 45 minutes get their breakdown added inline

    const extractTasks: Array<{
      stepIndex: number;
      taskName: string;
      reason: string;
      suggestedSubtasks: string[];
      estimatedMinutes: number;
    }> = [];
    const autoAddSubtasks: Array<{ text: string; minutes: number; guidance?: string }> = [];

    if (Array.isArray(parsed.complexSteps)) {
      for (const cs of parsed.complexSteps as Array<{
        stepIndex?: number;
        estimatedMinutes?: number;
        taskName?: string;
        reason?: string;
        breakdownSteps?: Array<{ text?: string; minutes?: number }>;
      }>) {
        // Calculate total time from breakdown steps if not provided
        const totalMins = cs.estimatedMinutes ||
          (Array.isArray(cs.breakdownSteps)
            ? cs.breakdownSteps.reduce((sum: number, s) => sum + (s.minutes || 10), 0)
            : 30);

        if (totalMins > 45) {
          // Complex step - suggest extracting as separate task
          extractTasks.push({
            stepIndex: cs.stepIndex || 0,
            taskName: cs.taskName || `Step ${cs.stepIndex} expanded`,
            reason: `${cs.reason || "Complex step"} (~${totalMins} minutes)`,
            suggestedSubtasks: Array.isArray(cs.breakdownSteps)
              ? cs.breakdownSteps.map((s) => `${s.text || ""} (~${s.minutes || 10}min)`)
              : [],
            estimatedMinutes: totalMins,
          });
        } else {
          // Simpler step - add breakdown steps inline
          if (Array.isArray(cs.breakdownSteps)) {
            for (const bs of cs.breakdownSteps) {
              autoAddSubtasks.push({
                text: bs.text || "",
                minutes: bs.minutes || 10,
              });
            }
          }
        }
      }
    }

    // ----------------------------------------
    // Process Missing Steps
    // ----------------------------------------
    // Add any critical steps the AI identified as missing
    if (Array.isArray(parsed.missingSteps)) {
      for (const ms of parsed.missingSteps as Array<{ text?: string; minutes?: number; guidance?: string }>) {
        if (ms.text) {
          autoAddSubtasks.push({
            text: ms.text,
            minutes: ms.minutes || 10,
            guidance: ms.guidance,
          });
        }
      }
    }

    // Format new subtasks with time estimates and guidance
    const newSubtasks = autoAddSubtasks.map(s => ({
      text: `${s.text} (~${s.minutes}min)`,
      guidance: s.guidance,
    }));

    // ----------------------------------------
    // Return Analysis Results
    // ----------------------------------------
    return NextResponse.json({
      newSubtasks,           // Steps to add to the task
      extractTasks,          // Complex steps to extract as separate tasks
      stepAnalysis: parsed.stepAnalysis || parsed.stepTimeEstimates || [],  // Per-step analysis
      doneMeans: Array.isArray(parsed.doneMeans)
        ? (parsed.doneMeans as unknown[]).filter((d: unknown) => typeof d === "string")
        : [],
      explanation: (parsed.explanation as string) || "Analysis complete",
      parentTask: task,
    });
  } catch (error) {
    console.error("Elaborate error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      newSubtasks: [],
      extractTasks: [],
      stepAnalysis: [],
      doneMeans: [],
      explanation: `Analysis failed: ${message}. Is Ollama running?`,
    });
  }
}
