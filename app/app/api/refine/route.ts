import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(request: NextRequest) {
  try {
    const { originalTask, originalSubtasks, externalResponse, currentDuration } = await request.json();

    if (!originalTask || !externalResponse) {
      return NextResponse.json(
        { error: "Original task and external response required" },
        { status: 400 }
      );
    }

    const prompt = `You are a task breakdown expert. Your job is to INCORPORATE valuable suggestions from an external AI into the current task breakdown.

ORIGINAL TASK: "${originalTask}"

CURRENT STEPS:
${(originalSubtasks || []).map((st: string, i: number) => `${i + 1}. ${st}`).join("\n") || "(none)"}

CURRENT TIME ESTIMATE: ${currentDuration || 15} minutes

EXTERNAL AI SUGGESTIONS:
${externalResponse}

YOUR JOB:
1. PRIORITIZE adding new valuable steps from the external AI that are missing
2. Keep good steps from the original breakdown
3. Merge similar steps if they overlap
4. Remove only truly redundant steps
5. Output ALL necessary steps (3-7 steps typical, but use as many as needed)
6. Start each step with an action verb
7. Adjust time estimate based on total work

IMPORTANT: Don't over-simplify. If the external AI identified important additional steps, INCLUDE them.

Reply with ONLY a JSON object:
{
  "subtasks": ["step 1", "step 2", ...],
  "duration": 15,
  "reasoning": "brief explanation: what was added/changed"
}

Duration must be 15, 30, 45, or 60 minutes.
JSON response:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 500,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      // Fall back to simple extraction
      return NextResponse.json(simpleExtract(externalResponse, currentDuration));
    }

    const data = await response.json();
    const text = data.response || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        const subtasks = Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0
          ? parsed.subtasks.filter((s: unknown) => typeof s === "string" && s.trim()).slice(0, 10)
          : null;

        if (subtasks && subtasks.length > 0) {
          return NextResponse.json({
            subtasks,
            duration: [15, 30, 45, 60].includes(parsed.duration) ? parsed.duration : currentDuration || 15,
            reasoning: parsed.reasoning || "Applied and refined suggestions",
            source: "ai",
          });
        }
      } catch {
        // Parse failed, fall back
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
    const stepMatch = line.match(/^\d+[\.\)]\s*(.+)/);
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
