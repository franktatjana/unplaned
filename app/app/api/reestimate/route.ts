/**
 * Re-estimate Duration API Route
 *
 * Recalculates the task duration estimate based on the current
 * subtasks. Called after subtasks are modified to keep the
 * time estimate accurate.
 *
 * @route POST /api/reestimate
 *
 * Request body:
 * - task: string - The task description
 * - subtasks: string[] - Current subtask texts
 * - currentDuration: Duration - Current estimate (fallback)
 *
 * Response:
 * - duration: 15 | 30 | 45 | 60 - New time estimate in minutes
 */

import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";
import { callOllama } from "../../lib/ollama";
import { getReestimatePrompt, getReestimateSystemPrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, currentDuration } = await request.json();

    if (!task || !subtasks) {
      return NextResponse.json({ error: "Task and subtasks required" }, { status: 400 });
    }

    const prompt = getReestimatePrompt(task, subtasks);
    const result = await callOllama(prompt, {
      system: getReestimateSystemPrompt(),
      temperature: 0.1,
      num_predict: 10,
    });

    if (!result.ok) {
      return NextResponse.json({ duration: currentDuration });
    }

    const match = result.text.trim().match(/\b(15|30|45|60)\b/);
    if (match) {
      const duration = parseInt(match[1]) as Duration;
      return NextResponse.json({ duration });
    }

    return NextResponse.json({ duration: currentDuration });
  } catch (error) {
    console.error("Reestimate error:", error);
    return NextResponse.json({ duration: 15 });
  }
}
