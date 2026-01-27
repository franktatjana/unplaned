import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

async function polishText(text: string): Promise<string> {
  try {
    const prompt = `Fix any spelling and grammar errors in this task description. Keep it natural and concise. Only return the corrected text, nothing else.

Original: "${text}"

Corrected:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.1, num_predict: 100 },
      }),
    });

    if (!response.ok) return text;

    const data = await response.json();
    let polished = (data.response || text).trim();
    polished = polished.replace(/^["']|["']$/g, "").trim();

    // Sanity check
    if (!polished || polished.length > text.length * 2) return text;
    return polished;
  } catch {
    return text;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { task, personality = "coach" } = await request.json();

    if (!task || typeof task !== "string") {
      return NextResponse.json({ error: "Task is required" }, { status: 400 });
    }

    // Polish the task text first
    const polishedTask = await polishText(task);

    const prompt = `Break down this task into 3-7 clear, actionable steps (use as many as needed).
Task: "${polishedTask}"

Rules:
- Each step should be specific and completable in one sitting
- Start each step with an action verb
- Keep steps concise (under 10 words each)
- Order steps logically
- Include all necessary steps, don't artificially limit

Reply with ONLY a JSON object in this exact format:
{
  "subtasks": ["step 1", "step 2", "step 3", ...],
  "duration": 15,
  "coreWhy": "one sentence explaining why this matters",
  "why": "one short motivational sentence"
}

Duration should be 15, 30, 45, or 60 minutes total.
JSON response:`;

    console.log("Calling Ollama with model:", MODEL);

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 300,
        },
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Ollama error response:", response.status, errorText);
      return NextResponse.json(
        { error: "AI service unavailable", details: errorText },
        { status: 503 }
      );
    }

    const data = await response.json();
    const text = data.response || "";

    if (!text) {
      console.error("Ollama returned empty response");
    }

    console.log("Ollama raw response:", text);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log("Parsed JSON:", parsed);

        // Make sure we have valid subtasks (allow up to 7)
        const subtasks = Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0
          ? parsed.subtasks.slice(0, 7).filter((s: unknown) => typeof s === "string" && s.trim())
          : null;

        if (subtasks && subtasks.length > 0) {
          return NextResponse.json({
            task: polishedTask,
            subtasks,
            duration: [15, 30, 45, 60].includes(parsed.duration) ? parsed.duration : 15,
            coreWhy: parsed.coreWhy || "This task moves you forward.",
            why: parsed.why || "Let's get this done.",
          });
        }
        // If subtasks empty/invalid, fall through to other methods
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        // Parse failed, try to extract steps manually
      }
    }

    // Fallback: extract numbered steps
    const steps = text.match(/\d+\.\s*([^\n]+)/g);
    if (steps && steps.length >= 2) {
      return NextResponse.json({
        task: polishedTask,
        subtasks: steps.slice(0, 7).map((s: string) => s.replace(/^\d+\.\s*/, "").trim()),
        duration: 15,
        coreWhy: "This task needs to be done.",
        why: "One step at a time.",
      });
    }

    return NextResponse.json({
      task: polishedTask,
      subtasks: ["Plan the approach", "Do the main work", "Review and finish"],
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
