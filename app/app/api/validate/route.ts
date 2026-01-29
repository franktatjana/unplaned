/**
 * Validate Task Breakdown API Route
 *
 * Checks the quality of a task breakdown and suggests improvements.
 * Uses AI when available, falls back to rule-based validation.
 *
 * Validation checks:
 * - Sufficient number of steps (2+)
 * - Steps are specific (not vague like "do stuff")
 * - No duplicate steps
 * - Steps are appropriately sized
 *
 * @route POST /api/validate
 *
 * Request body:
 * - task: string - The task description
 * - subtasks: string[] - Current subtask texts
 * - duration: Duration - Current time estimate
 *
 * Response:
 * - isValid: boolean - Whether breakdown passes validation
 * - issues: string[] - List of problems found
 * - suggestedSubtasks: string[] - Improved subtask list
 * - suggestedDuration: Duration - Adjusted time estimate
 * - summary: string - Brief validation result
 * - source: "ollama" | "rules" - Which validator was used
 */

import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";
import { callOllama, extractJSON } from "../../lib/ollama";
import { getValidatePrompt, getValidateSystemPrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, duration } = await request.json();

    if (!task || !subtasks || !Array.isArray(subtasks)) {
      return NextResponse.json({ error: "Task and subtasks required" }, { status: 400 });
    }

    const result = await callOllama(getValidatePrompt(task, subtasks, duration), {
      system: getValidateSystemPrompt(),
      temperature: 0.2,
      num_predict: 500,
    });

    if (!result.ok) {
      return NextResponse.json(ruleBasedValidation(task, subtasks, duration));
    }

    const parsed = extractJSON(result.text);
    if (parsed) {
      return NextResponse.json({
        isValid: Boolean(parsed.isValid),
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        suggestedSubtasks: Array.isArray(parsed.suggestedSubtasks) ? parsed.suggestedSubtasks : subtasks,
        suggestedDuration: [15, 30, 45, 60].includes(parsed.suggestedDuration as number)
          ? parsed.suggestedDuration
          : duration,
        summary: (parsed.summary as string) || "Validation complete",
        source: "ollama",
      });
    }

    return NextResponse.json(ruleBasedValidation(task, subtasks, duration));
  } catch (error) {
    console.error("Validate error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}

/**
 * Fallback validation using simple rules when AI is unavailable.
 * Checks for common issues like vague language and duplicates.
 */
function ruleBasedValidation(task: string, subtasks: string[], duration: Duration) {
  const issues: string[] = [];

  if (subtasks.length < 2) {
    issues.push("Too few steps - consider breaking down further");
  }

  const vagueWords = ["do", "handle", "work on", "deal with", "stuff"];
  subtasks.forEach((st, i) => {
    const lower = st.toLowerCase();
    if (vagueWords.some((w) => lower.includes(w))) {
      issues.push(`Step ${i + 1} is vague - be more specific`);
    }
    if (st.length < 5) {
      issues.push(`Step ${i + 1} is too short`);
    }
  });

  const normalized = subtasks.map((s) => s.toLowerCase().trim());
  const uniqueCount = new Set(normalized).size;
  if (uniqueCount < subtasks.length) {
    issues.push("Some steps appear to be duplicates");
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestedSubtasks: subtasks,
    suggestedDuration: duration,
    summary: issues.length === 0 ? "Breakdown looks good" : `Found ${issues.length} issue(s)`,
    source: "rules" as const,
  };
}
