import { NextRequest, NextResponse } from "next/server";
import { Duration } from "../../lib/types";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, duration } = await request.json();

    if (!task || !subtasks || !Array.isArray(subtasks)) {
      return NextResponse.json({ error: "Task and subtasks required" }, { status: 400 });
    }

    const subtasksList = subtasks.map((st: string, i: number) => `${i + 1}. ${st}`).join("\n");

    const prompt = `Analyze this task breakdown:

Task: "${task}"
Steps:
${subtasksList}
Estimated time: ${duration} minutes

Check for:
1. Overlapping or duplicate steps
2. Steps that are too vague
3. Missing critical steps
4. Wrong order
5. Time estimate accuracy

Reply with ONLY a JSON object:
{
  "isValid": true/false,
  "issues": ["list of problems found"],
  "suggestedSubtasks": ["improved step 1", "improved step 2", ...],
  "suggestedDuration": 15/30/45/60,
  "summary": "one sentence summary"
}

If the breakdown is good, set isValid to true and keep suggestedSubtasks same as input.
JSON response:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500,
        },
      }),
    });

    if (!response.ok) {
      // Fallback to rule-based validation
      return NextResponse.json(ruleBasedValidation(task, subtasks, duration));
    }

    const data = await response.json();
    const text = data.response || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json({
          isValid: Boolean(parsed.isValid),
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          suggestedSubtasks: Array.isArray(parsed.suggestedSubtasks) ? parsed.suggestedSubtasks : subtasks,
          suggestedDuration: [15, 30, 45, 60].includes(parsed.suggestedDuration) ? parsed.suggestedDuration : duration,
          summary: parsed.summary || "Validation complete",
          source: "ollama",
        });
      } catch {
        // Parse failed
      }
    }

    return NextResponse.json(ruleBasedValidation(task, subtasks, duration));
  } catch (error) {
    console.error("Validate error:", error);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}

function ruleBasedValidation(task: string, subtasks: string[], duration: Duration) {
  const issues: string[] = [];

  // Check for too few steps
  if (subtasks.length < 2) {
    issues.push("Too few steps - consider breaking down further");
  }

  // Check for vague steps
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

  // Check for duplicates
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
