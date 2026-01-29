/**
 * Refine/2nd Opinion API Route
 *
 * Merges external AI suggestions (from ChatGPT, Claude, etc.) with
 * the existing task breakdown. The local LLM intelligently combines
 * the original steps with the external suggestions.
 *
 * Use case: User copies task to external AI, gets suggestions, pastes
 * them back. This route processes and normalizes those suggestions.
 *
 * @route POST /api/refine
 *
 * Request body:
 * - originalTask: string - The task description
 * - originalSubtasks: string[] - Current subtask texts
 * - externalResponse: string - Raw text from external AI
 * - currentDuration: Duration - Current time estimate
 *
 * Response:
 * - subtasks: Array<{text, cta?, deliverable?, soWhat?}> - Refined steps
 * - doneMeans: string[] - Completion criteria
 * - duration: Duration - Updated time estimate
 * - reasoning: string - Explanation of changes made
 * - source: "ai" | "simple" - Whether AI or fallback was used
 */

import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";
import { callOllama, tryParseJSON } from "../../lib/ollama";
import { buildRefinePrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { originalTask, originalSubtasks, externalResponse, currentDuration } = await request.json();

    if (!originalTask || !externalResponse) {
      return NextResponse.json(
        { error: "Original task and external response required" },
        { status: 400 }
      );
    }

    const prompt = buildRefinePrompt(originalTask, originalSubtasks || [], externalResponse, currentDuration || 15);
    const result = await callOllama(prompt, { temperature: 0.3, num_predict: 1500 });

    if (!result.ok) {
      // Fall back to simple extraction
      return NextResponse.json(simpleExtract(externalResponse, currentDuration));
    }

    // Extract JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = tryParseJSON(jsonMatch[0]) as Record<string, unknown> | null;

      if (parsed) {
        // Handle subtasks - can be objects or strings
        let subtasks: Array<{ text: string; cta?: string; deliverable?: string; soWhat?: string }> = [];

        if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
          subtasks = (parsed.subtasks as unknown[]).slice(0, 10).map((s: unknown) => {
            if (typeof s === "string" && s.trim()) {
              return { text: s.trim() };
            }
            if (typeof s === "object" && s !== null && "text" in s) {
              const obj = s as { text: string; cta?: string; deliverable?: string; soWhat?: string };
              return {
                text: obj.text,
                ...(obj.cta && { cta: obj.cta }),
                ...(obj.deliverable && { deliverable: obj.deliverable }),
                ...(obj.soWhat && { soWhat: obj.soWhat }),
              };
            }
            return null;
          }).filter(Boolean) as Array<{ text: string; cta?: string; deliverable?: string; soWhat?: string }>;
        }

        if (subtasks.length > 0) {
          return NextResponse.json({
            subtasks,
            doneMeans: Array.isArray(parsed.doneMeans)
              ? (parsed.doneMeans as unknown[]).filter((d: unknown) => typeof d === "string")
              : [],
            duration: [15, 30, 45, 60].includes(parsed.duration as number)
              ? parsed.duration
              : currentDuration || 15,
            reasoning: (parsed.reasoning as string) || "Applied and refined suggestions",
            source: "ai",
          });
        }
      }
    }

    // Fall back to simple extraction
    return NextResponse.json(simpleExtract(externalResponse, currentDuration));
  } catch (error) {
    console.error("Refine error:", error);
    return NextResponse.json(
      { error: "Failed to refine suggestions" },
      { status: 500 }
    );
  }
}

/**
 * Fallback extraction when AI is unavailable.
 * Uses regex to find numbered steps and time estimates.
 */
function simpleExtract(text: string, currentDuration: Duration): {
  subtasks: string[];
  duration: Duration;
  reasoning: string;
  source: string;
} {
  const lines = text.split("\n");
  const extractedSteps: string[] = [];
  let extractedDuration: Duration = currentDuration || 15;

  for (const line of lines) {
    const stepMatch = line.match(/^\d+[\.)\]]\s*(.+)/);
    if (stepMatch && stepMatch[1].trim()) {
      const stepText = stepMatch[1].trim();
      // Skip header lines
      if (!/^(step|issue|problem|time|notes|steps|suggested)/i.test(stepText)) {
        extractedSteps.push(stepText);
      }
    }
    const timeMatch = line.match(/TIME:\s*(\d+)/i) || line.match(/(\d+)\s*min/i);
    if (timeMatch) {
      const mins = parseInt(timeMatch[1]);
      if (mins <= 15) extractedDuration = 15;
      else if (mins <= 30) extractedDuration = 30;
      else if (mins <= 45) extractedDuration = 45;
      else extractedDuration = 60;
    }
  }

  return {
    subtasks: extractedSteps.slice(0, 10),
    duration: extractedDuration,
    reasoning: "Extracted steps from response (AI refinement unavailable)",
    source: "simple",
  };
}
