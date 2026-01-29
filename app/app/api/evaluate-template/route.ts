/**
 * Evaluate Template Worthiness API Route
 *
 * Uses AI to determine if a completed task is worth saving as a
 * reusable template. Helps avoid cluttering the template library
 * with one-off or highly specific tasks.
 *
 * Criteria for worthiness:
 * - Task is generic enough to be reused
 * - Has clear, repeatable steps
 * - Not too specific to one situation
 *
 * @route POST /api/evaluate-template
 *
 * Request body:
 * - taskName: string - The task description
 * - subtasks: string[] - The task's steps
 *
 * Response:
 * - worthy: boolean - Whether to suggest saving as template
 * - reason: string - Explanation of the decision
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama, extractJSON } from "../../lib/ollama";
import { buildEvaluateTemplatePrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { taskName, subtasks } = await request.json();

    if (!taskName || !subtasks || subtasks.length === 0) {
      return NextResponse.json({ worthy: false, reason: "Insufficient data" });
    }

    const prompt = buildEvaluateTemplatePrompt(taskName, subtasks);
    const result = await callOllama(prompt, { temperature: 0.2, num_predict: 150 });

    if (!result.ok) {
      return NextResponse.json({ worthy: false, reason: "AI unavailable" });
    }

    const parsed = extractJSON(result.text);
    if (parsed) {
      return NextResponse.json({
        worthy: !!parsed.worthy,
        reason: (parsed.reason as string) || "",
      });
    }

    return NextResponse.json({ worthy: false, reason: "Could not evaluate" });
  } catch (error) {
    console.error("Evaluate template error:", error);
    return NextResponse.json({ worthy: false, reason: "Evaluation failed" });
  }
}
