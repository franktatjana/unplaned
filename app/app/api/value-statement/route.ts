/**
 * Value Statement API Route
 *
 * Generates executive-ready impact statements from completed tasks.
 * Uses corporate language focused on organizational outcomes like
 * alignment, clarity, predictability, and risk reduction.
 *
 * @route POST /api/value-statement
 *
 * Request body:
 * - task: string - The completed task text
 *
 * Response:
 * - statement: string - The generated value statement
 * - source: "ollama" | "fallback" - Which generator was used
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama } from "../../lib/ollama";
import { buildValueStatementPrompt, getValueStatementSystemPrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { task } = await request.json();

    if (!task || typeof task !== "string") {
      return NextResponse.json({ statement: "", source: "fallback" });
    }

    const result = await callOllama(buildValueStatementPrompt(task), {
      system: getValueStatementSystemPrompt(),
      temperature: 0.3,
      num_predict: 150,
    });

    if (!result.ok) {
      // Fallback: return a generic statement
      const fallbackImpact = generateFallbackImpact(task);
      return NextResponse.json({
        statement: `Delivered on ${task.toLowerCase()}, contributing to team execution quality.`,
        overallImpact: fallbackImpact,
        source: "fallback",
      });
    }

    let statement = result.text.trim();

    // Clean up the response - remove "Value statement:" prefix if present
    statement = statement.replace(/^value statement:\s*/i, "").trim();
    // Remove surrounding quotes if present
    statement = statement.replace(/^["']|["']$/g, "").trim();
    // Ensure it ends with a period
    if (statement && !statement.endsWith(".")) {
      statement += ".";
    }

    // If empty or too long, use fallback
    if (!statement || statement.length > 300) {
      const fallbackImpact = generateFallbackImpact(task);
      return NextResponse.json({
        statement: `Delivered on ${task.toLowerCase()}, contributing to team execution quality.`,
        overallImpact: fallbackImpact,
        source: "fallback",
      });
    }

    // Generate overall impact from the statement
    const overallImpact = generateOverallImpact(statement, task);

    return NextResponse.json({
      statement,
      overallImpact,
      source: "ollama",
    });
  } catch (error) {
    console.error("Value statement error:", error);
    return NextResponse.json({
      statement: "",
      overallImpact: "",
      source: "fallback",
    });
  }
}

/**
 * Generate overall impact from statement - extracts the key business value
 */
function generateOverallImpact(statement: string, task: string): string {
  const lowerStatement = statement.toLowerCase();
  const lowerTask = task.toLowerCase();

  // Map to business value themes
  if (lowerTask.includes("email") || lowerTask.includes("inbox") || lowerTask.includes("message")) {
    return "Recovered focus time by clearing decision backlog and eliminating notification debt.";
  }
  if (lowerStatement.includes("alignment") || lowerTask.includes("meeting") || lowerTask.includes("sync")) {
    return "Accelerated team decision-making by front-loading blockers and priorities.";
  }
  if (lowerStatement.includes("clarity") || lowerTask.includes("document") || lowerTask.includes("write")) {
    return "Freed stakeholder capacity by enabling self-serve access to critical information.";
  }
  if (lowerStatement.includes("risk") || lowerTask.includes("review") || lowerTask.includes("check")) {
    return "De-risked delivery by catching issues before they reached production.";
  }
  if (lowerStatement.includes("predictability") || lowerTask.includes("plan") || lowerTask.includes("prepare")) {
    return "Protected execution velocity by removing uncertainty from upcoming work.";
  }
  if (lowerStatement.includes("delivery") || lowerTask.includes("ship") || lowerTask.includes("deploy")) {
    return "Maintained release momentum, keeping downstream teams unblocked.";
  }
  if (lowerStatement.includes("communication") || lowerTask.includes("update") || lowerTask.includes("report")) {
    return "Preserved stakeholder trust through proactive visibility into progress.";
  }
  if (lowerTask.includes("fix") || lowerTask.includes("bug") || lowerTask.includes("resolve")) {
    return "Restored system reliability, eliminating friction for affected users.";
  }
  if (lowerTask.includes("test") || lowerTask.includes("qa")) {
    return "Protected release quality by validating behavior before deployment.";
  }
  if (lowerTask.includes("clean") || lowerTask.includes("organiz") || lowerTask.includes("sort")) {
    return "Reduced retrieval friction, enabling faster handoffs and fewer interruptions.";
  }

  // Generic fallback with business value framing
  return "Freed capacity for strategic work by eliminating operational friction.";
}

/**
 * Generate fallback impact when AI is not available
 */
function generateFallbackImpact(task: string): string {
  const lowerTask = task.toLowerCase();

  if (lowerTask.includes("email") || lowerTask.includes("inbox") || lowerTask.includes("message")) {
    return "Recovered focus time by clearing decision backlog and eliminating notification debt.";
  }
  if (lowerTask.includes("meeting") || lowerTask.includes("sync") || lowerTask.includes("standup")) {
    return "Accelerated team decision-making by front-loading blockers and priorities.";
  }
  if (lowerTask.includes("document") || lowerTask.includes("write") || lowerTask.includes("draft")) {
    return "Freed stakeholder capacity by enabling self-serve access to critical information.";
  }
  if (lowerTask.includes("review") || lowerTask.includes("check") || lowerTask.includes("audit")) {
    return "De-risked delivery by catching issues before they reached production.";
  }
  if (lowerTask.includes("plan") || lowerTask.includes("prepare") || lowerTask.includes("schedule")) {
    return "Protected execution velocity by removing uncertainty from upcoming work.";
  }
  if (lowerTask.includes("ship") || lowerTask.includes("deploy") || lowerTask.includes("release")) {
    return "Maintained release momentum, keeping downstream teams unblocked.";
  }
  if (lowerTask.includes("update") || lowerTask.includes("report")) {
    return "Preserved stakeholder trust through proactive visibility into progress.";
  }
  if (lowerTask.includes("fix") || lowerTask.includes("bug") || lowerTask.includes("resolve")) {
    return "Restored system reliability, eliminating friction for affected users.";
  }
  if (lowerTask.includes("test") || lowerTask.includes("qa")) {
    return "Protected release quality by validating behavior before deployment.";
  }
  if (lowerTask.includes("clean") || lowerTask.includes("organiz") || lowerTask.includes("sort") || lowerTask.includes("file")) {
    return "Reduced retrieval friction, enabling faster handoffs and fewer interruptions.";
  }

  return "Freed capacity for strategic work by eliminating operational friction.";
}
