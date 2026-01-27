import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

async function assessNeedsClarification(task: string, subtasks: string[]): Promise<{
  needsClarification: boolean;
  questions: Array<{ question: string; why: string }>;
}> {
  const subtasksList = subtasks.map((st, i) => `${i + 1}. ${st}`).join("\n");

  const assessPrompt = `You are a task coach. Assess if this task breakdown has enough context for proper analysis.

Task: "${task}"
Current steps:
${subtasksList}

CRITICAL: Ask questions ONLY if truly necessary. Most tasks are clear enough.

Ask clarifying questions ONLY when:
- The task is vague (e.g., "work on project" - WHICH project? What aspect?)
- Key details are missing that change the approach (e.g., "fix bug" - what system? what symptom?)
- Time/scope is unclear in a way that affects breakdown (e.g., "learn programming" - what language? what goal?)

DO NOT ask questions if:
- The task is reasonably clear
- Steps already provide enough context
- You're just being overly cautious

Reply with ONLY this JSON:
{
  "needsClarification": true/false,
  "questions": [
    {"question": "Specific, digging question?", "why": "Brief reason this matters"}
  ]
}

Rules:
- Maximum 3 questions, but prefer fewer if possible
- Questions must be specific and dig deep - not generic
- Each question should unlock actionable insights
- If task is clear enough, set needsClarification to false with empty questions array

JSON response:`;

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: assessPrompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 300 },
      }),
    });

    if (!response.ok) {
      return { needsClarification: false, questions: [] };
    }

    const data = await response.json();
    const text = data.response || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.needsClarification && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return {
          needsClarification: true,
          questions: parsed.questions.slice(0, 3).filter((q: { question?: string }) => q.question),
        };
      }
    }
  } catch {
    // Assessment failed, proceed without questions
  }

  return { needsClarification: false, questions: [] };
}

export async function POST(request: NextRequest) {
  try {
    const { task, subtasks, additionalContext, skipClarification } = await request.json();

    if (!task || !subtasks) {
      return NextResponse.json(
        { error: "Task and subtasks are required" },
        { status: 400 }
      );
    }

    // Phase 1: Check if we need clarifying questions (unless skipped or context already provided)
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

    // Phase 2: Full analysis (with optional additional context)
    const subtasksList = subtasks.map((st: string, i: number) => `${i + 1}. ${st}`).join("\n");
    const contextSection = additionalContext
      ? `\nADDITIONAL CONTEXT FROM USER:\n${additionalContext}\n`
      : "";

    const prompt = `You are a task breakdown expert. Analyze this task and its current steps:

Task: "${task}"
Current steps:
${subtasksList}
${contextSection}
ESTIMATE TIME for each step and analyze:
1. What's a realistic time estimate for EACH step?
2. Which steps are too complex and need breaking down (>45 minutes)?
3. Are there critical missing steps?

Reply in this exact JSON format:
{
  "stepTimeEstimates": [
    {"stepIndex": 1, "estimatedMinutes": 10},
    {"stepIndex": 2, "estimatedMinutes": 15}
  ],
  "totalEstimatedMinutes": 90,
  "complexSteps": [
    {
      "stepIndex": 4,
      "estimatedMinutes": 60,
      "taskName": "descriptive name if extracted",
      "reason": "why this is complex",
      "breakdownSteps": [
        {"text": "subtask 1", "minutes": 15},
        {"text": "subtask 2", "minutes": 20}
      ]
    }
  ],
  "missingSteps": [
    {"text": "new step to add", "afterStepIndex": 2, "minutes": 10}
  ],
  "explanation": "Brief explanation"
}

CRITICAL RULES:
1. TIME ESTIMATES ARE MANDATORY for EVERY step - estimate realistically:
   - Quick tasks (5-10 min): simple emails, quick reviews, single updates
   - Medium tasks (15-30 min): research, drafting, analysis
   - Large tasks (30-60 min): deep work, complex analysis, creation

2. Include "totalEstimatedMinutes" - sum of all step estimates

3. NO DUPLICATE STEPS - each step must be unique. Check that:
   - No step repeats another step's meaning
   - No step covers the same work as another
   - If steps are similar, they should be combined not listed separately

4. complexSteps: only if a single step takes >45 minutes
5. missingSteps: only add if truly critical and not redundant

CRITICAL for breakdownSteps (when extracting complex steps):
- These will become a NEW separate task, so they must be SELF-CONTAINED
- DO NOT repeat steps already listed in the parent task above
- Include ONLY the specific work needed for this extracted portion

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
    });

    if (!response.ok) {
      return NextResponse.json({
        newSubtasks: [],
        extractTasks: [],
        stepTimeEstimates: [],
        explanation: "Could not analyze - AI service unavailable",
        parentTask: task,
      });
    }

    const data = await response.json();
    const text = data.response || "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Process complex steps based on time threshold (45 minutes)
        const extractTasks: Array<{
          stepIndex: number;
          taskName: string;
          reason: string;
          suggestedSubtasks: string[];
          estimatedMinutes: number;
        }> = [];
        const autoAddSubtasks: Array<{ text: string; minutes: number }> = [];

        if (Array.isArray(parsed.complexSteps)) {
          for (const cs of parsed.complexSteps) {
            const totalMins = cs.estimatedMinutes ||
              (Array.isArray(cs.breakdownSteps)
                ? cs.breakdownSteps.reduce((sum: number, s: { minutes?: number }) => sum + (s.minutes || 10), 0)
                : 30);

            if (totalMins > 45) {
              // Worth extracting as separate task
              extractTasks.push({
                stepIndex: cs.stepIndex,
                taskName: cs.taskName || `Step ${cs.stepIndex} expanded`,
                reason: `${cs.reason || "Complex step"} (~${totalMins} minutes)`,
                suggestedSubtasks: Array.isArray(cs.breakdownSteps)
                  ? cs.breakdownSteps.map((s: { text: string; minutes?: number }) =>
                      `${s.text} (~${s.minutes || 10}min)`)
                  : [],
                estimatedMinutes: totalMins,
              });
            } else {
              // Add breakdown steps inline instead of extracting
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

        // Also add any missing steps
        if (Array.isArray(parsed.missingSteps)) {
          for (const ms of parsed.missingSteps) {
            if (ms.text) {
              autoAddSubtasks.push({
                text: ms.text,
                minutes: ms.minutes || 10,
              });
            }
          }
        }

        // Format auto-add subtasks with time estimates
        const newSubtasks = autoAddSubtasks.map(s => `${s.text} (~${s.minutes}min)`);

        return NextResponse.json({
          newSubtasks,
          extractTasks,
          stepTimeEstimates: parsed.stepTimeEstimates || [],
          explanation: parsed.explanation || "Analysis complete",
          parentTask: task,
        });
      } catch {
        // Parse failed
      }
    }

    return NextResponse.json({
      newSubtasks: [],
      extractTasks: [],
      stepTimeEstimates: [],
      explanation: "Current breakdown looks complete. No additional steps needed.",
      parentTask: task,
    });
  } catch (error) {
    console.error("Elaborate error:", error);
    return NextResponse.json({
      newSubtasks: [],
      extractTasks: [],
      stepTimeEstimates: [],
      explanation: "Could not analyze task",
    });
  }
}
