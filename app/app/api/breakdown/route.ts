/**
 * Task Breakdown API Route
 *
 * The primary task creation endpoint. Takes a task description and
 * uses AI to generate actionable subtasks with time estimates.
 *
 * Flow:
 * 1. Polish the task text (fix grammar/spelling)
 * 2. Generate subtasks using configured personality
 * 3. Return structured breakdown with motivation
 *
 * May return "needs_clarification" status if the task is too vague
 * for meaningful breakdown.
 *
 * @route POST /api/breakdown
 *
 * Request body:
 * - task: string - The task description
 * - personality: string - AI personality (stoic, coach, drill, friend)
 *
 * Response (success):
 * - status: "success"
 * - task: string - Polished task text
 * - subtasks: Array<{text, cta?, deliverable?}> - Generated steps
 * - doneMeans: string[] - Completion criteria
 * - duration: 15 | 30 | 45 | 60 - Estimated minutes
 * - coreWhy: string - Deeper motivation
 * - why: string - Immediate motivation
 *
 * Response (clarification needed):
 * - status: "needs_clarification"
 * - clarificationQuestion: string - Question to ask user
 * - task: string - The polished task
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama, extractJSON } from "../../lib/ollama";
import { getBreakdownPrompt, getBreakdownSystemPrompt, getPolishPrompt } from "../../lib/prompts";

/**
 * Cleans up task text before breakdown.
 * Minimal changes to preserve user intent.
 */
async function polishText(text: string): Promise<string> {
  const result = await callOllama(getPolishPrompt(text), {
    temperature: 0.1,
    num_predict: 100,
  });

  if (!result.ok) return text;

  let polished = result.text.trim();
  polished = polished.replace(/^["']|["']$/g, "").trim();

  // Sanity check
  if (!polished || polished.length > text.length * 2) return text;
  return polished;
}

export async function POST(request: NextRequest) {
  try {
    const { task, personality = "coach" } = await request.json();

    if (!task || typeof task !== "string") {
      return NextResponse.json({ error: "Task is required" }, { status: 400 });
    }

    // Polish the task text first
    const polishedTask = await polishText(task);

    const result = await callOllama(getBreakdownPrompt(polishedTask, personality), {
      system: getBreakdownSystemPrompt(),
      temperature: 0.3,
      num_predict: 500,
    });

    if (!result.ok) {
      console.error("Ollama error:", result.error);
      return NextResponse.json(
        { error: "AI service unavailable", details: result.error },
        { status: 503 }
      );
    }

    if (!result.text) {
      console.error("Ollama returned empty response");
    }

    const parsed = extractJSON(result.text);
    if (parsed) {
      // Handle needs_clarification status
      if (parsed.status === "needs_clarification" && parsed.clarificationQuestion) {
        return NextResponse.json({
          status: "needs_clarification",
          clarificationQuestion: parsed.clarificationQuestion,
          task: polishedTask,
        });
      }

      // Handle subtasks - can be objects or strings
      let subtasks: Array<{ text: string; cta?: string; deliverable?: string }> = [];

      if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
        subtasks = (parsed.subtasks as unknown[]).slice(0, 7).map((s: unknown) => {
          if (typeof s === "string" && s.trim()) {
            return { text: s.trim() };
          }
          if (typeof s === "object" && s !== null && "text" in s) {
            const obj = s as { text: string; cta?: string; deliverable?: string };
            return {
              text: obj.text,
              ...(obj.cta && { cta: obj.cta }),
              ...(obj.deliverable && { deliverable: obj.deliverable }),
            };
          }
          return null;
        }).filter(Boolean) as Array<{ text: string; cta?: string; deliverable?: string }>;
      }

      if (subtasks.length > 0) {
        return NextResponse.json({
          status: "success",
          task: polishedTask,
          subtasks,
          doneMeans: Array.isArray(parsed.doneMeans)
            ? (parsed.doneMeans as unknown[]).filter((d: unknown) => typeof d === "string")
            : [],
          duration: [15, 30, 45, 60].includes(parsed.duration as number) ? parsed.duration : 15,
          coreWhy: (parsed.coreWhy as string) || "This task moves you forward.",
          why: (parsed.why as string) || "Let's get this done.",
        });
      }
    }

    // Fallback: extract numbered steps
    const steps = result.text.match(/\d+\.\s*([^\n]+)/g);
    if (steps && steps.length >= 2) {
      return NextResponse.json({
        status: "success",
        task: polishedTask,
        subtasks: steps.slice(0, 7).map((s: string) => ({ text: s.replace(/^\d+\.\s*/, "").trim() })),
        doneMeans: [],
        duration: 15,
        coreWhy: "This task needs to be done.",
        why: "One step at a time.",
      });
    }

    return NextResponse.json({
      status: "success",
      task: polishedTask,
      subtasks: [
        { text: "Plan the approach", cta: "Open notes", deliverable: "Clear plan" },
        { text: "Do the main work", cta: "Start first action", deliverable: "Core task complete" },
        { text: "Review and finish", cta: "Check your work", deliverable: "Task done" },
      ],
      doneMeans: [],
      duration: 15,
      coreWhy: "This task needs your attention.",
      why: "Start small, finish strong.",
    });
  } catch (error) {
    console.error("Breakdown error:", error);
    return NextResponse.json(
      { error: "Failed to break down task" },
      { status: 500 }
    );
  }
}
