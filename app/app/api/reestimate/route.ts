import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, currentDuration } = await request.json();

    if (!task || !subtasks) {
      return NextResponse.json({ error: "Task and subtasks required" }, { status: 400 });
    }

    const subtasksList = subtasks.map((st: string, i: number) => `${i + 1}. ${st}`).join("\n");

    const prompt = `Estimate total time for this task:

Task: "${task}"
Steps:
${subtasksList}

Consider realistic time for each step. Reply with ONLY a number: 15, 30, 45, or 60 (minutes).
Just the number, nothing else.`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 10,
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ duration: currentDuration });
    }

    const data = await response.json();
    const text = (data.response || "").trim();
    const match = text.match(/\b(15|30|45|60)\b/);

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
