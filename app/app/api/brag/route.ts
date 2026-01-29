/**
 * Brag List Generation API Route (v2 - Credibility-focused)
 *
 * Transforms completed tasks into CREDIBLE professional achievement statements.
 * Key improvements over v1:
 * - Only claims what user controlled (quality, clarity, risk reduction)
 * - Never fabricates metrics or claims external outcomes
 * - Supports seniority modes (IC, Senior, Lead)
 * - Supports wording toggles (Safe, Ambitious)
 * - Includes vocabulary validation to catch fluffy language
 *
 * @route POST /api/brag
 *
 * Request body:
 * - tasks: Array of completed task objects
 * - mode: BragSeniorityMode ("ic" | "senior" | "lead") - defaults to "ic"
 * - wording: BragWordingToggle ("safe" | "ambitious") - defaults to "safe"
 *
 * Response:
 * - entries: Array of achievement statements with confidence scores
 * - summary: Overall statistics
 * - source: "ollama" | "fallback"
 * - validationWarnings: Any banned words detected in output
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { callOllama, extractJSON } from "../../lib/ollama";
import { buildBragListPrompt, getBragListSystemPrompt, buildSingleBragPrompt, getSingleBragSystemPrompt } from "../../lib/prompts";
import { detectBannedVocabulary, calculateConfidence, inferImpactTheme, SENIORITY_CONFIG } from "../../lib/brag-vocabulary";
import type { BragSeniorityMode, BragWordingToggle, BragEntry, BragResponse, BragGeneratorInput, BragGeneratorOutput } from "../../lib/types";

const BRAG_FILE_PATH = path.join(process.cwd(), "data", "brag-list.md");
const BRAG_GENERATED_PATH = path.join(process.cwd(), "data", "brag-generated.json");

interface GeneratedBragData {
  entries: BragEntry[];
  summary: {
    totalTasks: number;
    totalTimeInvested: string;
    topCategory: string;
    overallImpact: string;
  };
  source: "ollama" | "fallback";
  generatedAt: string;
}

interface CompletedTask {
  id: string;
  text: string;
  completedAt: string;
  subtasks: Array<{ text: string }>;
  coreWhy?: string;
  outcomeConfirmations?: Record<string, boolean>;
}

interface BragRequestBody {
  tasks: CompletedTask[];
  mode?: BragSeniorityMode;
  wording?: BragWordingToggle;
}

interface ExtendedBragResponse extends BragResponse {
  validationWarnings: string[];
}

function parseTimeFromSubtask(text: string): number {
  const match = text.match(/\(~?(\d+)\s*min\)$/i);
  return match ? parseInt(match[1], 10) : 10;
}

export async function POST(request: NextRequest): Promise<NextResponse<ExtendedBragResponse | { error: string }>> {
  try {
    const body = await request.json() as BragRequestBody;
    const { tasks, mode = "ic", wording = "safe" } = body;

    if (!tasks || tasks.length === 0) {
      return NextResponse.json({
        entries: [],
        summary: {
          totalTasks: 0,
          totalTimeInvested: "0 min",
          topCategory: "None",
          overallImpact: "No completed tasks to analyze.",
        },
        source: "fallback",
        validationWarnings: [],
      });
    }

    // Prepare task data for the prompt
    const completedTasks = tasks.map(t => ({
      text: t.text,
      completedAt: t.completedAt,
      subtaskCount: t.subtasks.length,
      totalMinutes: t.subtasks.reduce((sum, st) => sum + parseTimeFromSubtask(st.text), 0),
      coreWhy: t.coreWhy || "",
      outcomeConfirmations: t.outcomeConfirmations || {},
    }));

    // Try AI generation with new credibility-focused prompts
    const prompt = buildBragListPrompt(completedTasks, mode, wording);
    const result = await callOllama(prompt, {
      system: getBragListSystemPrompt(mode, wording),
      temperature: 0.5, // Lower temperature for more consistent, conservative output
      num_predict: 2000,
    });

    if (result.ok) {
      const parsed = extractJSON(result.text) as { entries?: BragEntry[]; summary?: BragResponse["summary"] };
      if (parsed && parsed.entries && parsed.summary) {
        // Validate output for banned vocabulary
        const allText = parsed.entries.map(e => `${e.title} ${e.bullet} ${e.metrics}`).join(" ");
        const violations = detectBannedVocabulary(allText);

        // If violations found, try to regenerate once
        if (violations.length > 0) {
          console.warn("Banned vocabulary detected in brag output:", violations);
          // For now, we'll still return the result but with warnings
          // In production, you might want to retry with stricter prompt
        }

        // Add confidence scores if missing
        const entriesWithConfidence = parsed.entries.map((entry, idx) => {
          if (!entry.confidence) {
            const relatedTasks = entry.taskIds.map(id => completedTasks[id - 1]).filter(Boolean);
            const avgSteps = relatedTasks.reduce((sum, t) => sum + t.subtaskCount, 0) / relatedTasks.length;
            const hasTime = relatedTasks.some(t => t.totalMinutes > 0);
            const hasConfirmedOutcome = relatedTasks.some(t =>
              Object.values(t.outcomeConfirmations || {}).some(Boolean)
            );

            entry.confidence = hasConfirmedOutcome && avgSteps >= 3 && hasTime
              ? "high"
              : avgSteps >= 3 || hasTime
              ? "medium"
              : "low";
          }
          return entry;
        });

        const responseData = {
          entries: entriesWithConfidence,
          summary: parsed.summary,
          source: "ollama" as const,
          validationWarnings: violations,
        };

        // Save generated data to file for persistence
        await saveGeneratedBragData({
          entries: entriesWithConfidence,
          summary: parsed.summary,
          source: "ollama",
          generatedAt: new Date().toISOString(),
        });

        return NextResponse.json(responseData);
      }
    }

    // Fallback: Generate simple brag entries without AI
    const fallbackData = generateFallbackBrag(completedTasks, mode, wording);

    // Save generated data to file for persistence
    await saveGeneratedBragData({
      entries: fallbackData.entries,
      summary: fallbackData.summary,
      source: fallbackData.source,
      generatedAt: new Date().toISOString(),
    });

    return NextResponse.json(fallbackData);
  } catch (error) {
    console.error("Brag generation error:", error);
    return NextResponse.json({ error: "Failed to generate brag list" }, { status: 500 });
  }
}

/**
 * Save generated brag data to JSON file for persistence.
 */
async function saveGeneratedBragData(data: GeneratedBragData): Promise<void> {
  try {
    const dataDir = path.dirname(BRAG_GENERATED_PATH);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(BRAG_GENERATED_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save generated brag data:", error);
  }
}

/**
 * Generates a simple brag list without AI.
 * Uses credible language patterns based on seniority and wording settings.
 */
function generateFallbackBrag(
  tasks: Array<{
    text: string;
    completedAt: string;
    subtaskCount: number;
    totalMinutes: number;
    coreWhy: string;
    outcomeConfirmations?: Record<string, boolean>;
  }>,
  mode: BragSeniorityMode,
  wording: BragWordingToggle
): ExtendedBragResponse {
  const totalMinutes = tasks.reduce((sum, t) => sum + t.totalMinutes, 0);
  const totalHours = Math.round(totalMinutes / 60 * 10) / 10;

  const config = SENIORITY_CONFIG[mode];
  const verb = config.allowedVerbs[0]; // "completed" for IC, "owned" for senior, "led" for lead

  // Simple grouping by first few words
  const groups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const key = task.text.toLowerCase().split(" ").slice(0, 3).join(" ");
    const group = groups.get(key) || [];
    group.push(task);
    groups.set(key, group);
  }

  const entries: BragEntry[] = [];
  let idx = 0;
  const groupEntries = Array.from(groups.entries());

  for (let g = 0; g < groupEntries.length; g++) {
    const groupTasks = groupEntries[g][1];
    const first = groupTasks[0];
    const count = groupTasks.length;
    const totalGroupMinutes = groupTasks.reduce((sum, t) => sum + t.totalMinutes, 0);
    const totalSteps = groupTasks.reduce((sum, t) => sum + t.subtaskCount, 0);

    // Determine confidence
    const hasConfirmedOutcome = groupTasks.some(t =>
      Object.values(t.outcomeConfirmations || {}).some(Boolean)
    );
    const avgSteps = totalSteps / count;
    const confidence: "high" | "medium" | "low" =
      hasConfirmedOutcome && avgSteps >= 3 ? "high" :
      avgSteps >= 3 || totalGroupMinutes > 30 ? "medium" : "low";

    // Infer impact theme
    const theme = inferImpactTheme(
      first.coreWhy || "Delivery",
      groupTasks.flatMap(t => [t.text])
    );

    // Build credible bullet based on wording toggle
    const bulletVerb = wording === "ambitious" && mode !== "ic"
      ? config.allowedVerbs[Math.min(3, config.allowedVerbs.length - 1)]
      : verb;

    const impactPhrase = {
      clarity: "improving information accessibility",
      risk_reduction: "reducing risk of oversight",
      decision_readiness: "enabling informed decision-making",
      predictability: "improving delivery predictability",
      coordination: "maintaining team alignment",
      execution_quality: "ensuring execution quality",
      enablement: "supporting team productivity",
      standardization: "establishing consistent processes",
      transparency: "maintaining visibility for stakeholders",
      ownership: "driving work forward",
    }[theme] || "supporting team objectives";

    entries.push({
      title: count > 1
        ? `${bulletVerb.charAt(0).toUpperCase() + bulletVerb.slice(1)} ${count}x: ${first.text}`
        : `${bulletVerb.charAt(0).toUpperCase() + bulletVerb.slice(1)}: ${first.text}`,
      bullet: `${bulletVerb.charAt(0).toUpperCase() + bulletVerb.slice(1)} ${totalSteps} action items, ${impactPhrase}`,
      metrics: `~${totalGroupMinutes}min invested across ${count} task(s)`,
      category: "Delivery",
      tags: ["DELIVERY", theme.toUpperCase().replace(/_/g, " ")].filter((v, i, a) => a.indexOf(v) === i && v !== "DELIVERY").length > 0
        ? ["DELIVERY", theme.toUpperCase().replace(/_/g, " ")]
        : ["DELIVERY"],
      overallImpact: `${bulletVerb.charAt(0).toUpperCase() + bulletVerb.slice(1)} ${totalSteps} action items across ${count} task(s), ${impactPhrase}.`,
      taskIds: groupTasks.map((_, i) => idx + i + 1),
      frequency: count > 1 ? "Recurring" : "One-time",
      confidence,
    });
    idx += count;
  }

  return {
    entries,
    summary: {
      totalTasks: tasks.length,
      totalTimeInvested: totalHours >= 1 ? `~${totalHours}h` : `~${totalMinutes}min`,
      topCategory: "Delivery",
      overallImpact: `Completed ${tasks.length} task(s) with ${tasks.reduce((sum, t) => sum + t.subtaskCount, 0)} total steps, maintaining execution quality.`,
    },
    source: "fallback",
    validationWarnings: [],
  };
}

/**
 * Single task brag generation endpoint.
 * Used for real-time generation when a user completes a task.
 */
export async function PUT(request: NextRequest): Promise<NextResponse<BragGeneratorOutput | { error: string }>> {
  try {
    const input = await request.json() as BragGeneratorInput;

    // Validate required fields
    if (!input.task_title || !input.steps || input.steps.length === 0) {
      return NextResponse.json({ error: "task_title and steps are required" }, { status: 400 });
    }

    // Set defaults
    const normalizedInput: BragGeneratorInput = {
      task_title: input.task_title,
      steps: input.steps,
      time_spent_minutes: input.time_spent_minutes ?? null,
      category_tag: input.category_tag || "Delivery",
      user_role_mode: input.user_role_mode || "ic",
      wording_toggle: input.wording_toggle || "safe",
      outcome_confirmations: input.outcome_confirmations || {},
      optional_notes: input.optional_notes || "",
    };

    const prompt = buildSingleBragPrompt(normalizedInput);
    const result = await callOllama(prompt, {
      system: getSingleBragSystemPrompt(normalizedInput.user_role_mode, normalizedInput.wording_toggle),
      temperature: 0.4,
      num_predict: 800,
    });

    if (result.ok) {
      const parsed = extractJSON(result.text) as unknown as BragGeneratorOutput | null;
      if (parsed && parsed.headline && parsed.copy_text) {
        // Validate for banned vocabulary
        const allText = `${parsed.headline} ${parsed.impact_sentence} ${parsed.copy_text}`;
        const violations = detectBannedVocabulary(allText);

        if (violations.length > 0) {
          parsed.disallowed_claims = violations;
        }

        // Recalculate confidence if missing
        if (!parsed.confidence) {
          parsed.confidence = calculateConfidence(
            normalizedInput.outcome_confirmations,
            normalizedInput.steps.length,
            normalizedInput.time_spent_minutes !== null,
            normalizedInput.optional_notes.length > 0
          );
        }

        return NextResponse.json(parsed);
      }
    }

    // Fallback response
    const config = SENIORITY_CONFIG[normalizedInput.user_role_mode];
    const verb = config.allowedVerbs[0];
    const confidence = calculateConfidence(
      normalizedInput.outcome_confirmations,
      normalizedInput.steps.length,
      normalizedInput.time_spent_minutes !== null,
      normalizedInput.optional_notes.length > 0
    );

    const timePhrase = normalizedInput.time_spent_minutes
      ? `investing ~${normalizedInput.time_spent_minutes} minutes`
      : "";

    return NextResponse.json({
      headline: `${verb.charAt(0).toUpperCase() + verb.slice(1)}: ${normalizedInput.task_title}`,
      impact_sentence: `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${normalizedInput.steps.length} action items, ensuring execution quality.`,
      scope_context: "",
      evidence: normalizedInput.steps.slice(0, 3),
      confidence,
      disallowed_claims: [],
      copy_text: `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${normalizedInput.task_title}${timePhrase ? `, ${timePhrase}` : ""}. Completed ${normalizedInput.steps.length} steps, maintaining delivery standards.`,
    });
  } catch (error) {
    console.error("Single brag generation error:", error);
    return NextResponse.json({ error: "Failed to generate brag entry" }, { status: 500 });
  }
}

/**
 * Accept and save brag entries to markdown file, or update generated entries.
 * - action: "accept" (default) - Appends entry to data/brag-list.md
 * - action: "update" - Updates entry in generated brag data by index
 */
interface AcceptBragRequest {
  entry: BragEntry;
  action?: "accept" | "update";
  index?: number; // Required for update action
}

export async function PATCH(request: NextRequest): Promise<NextResponse<{ success: boolean; path?: string } | { error: string }>> {
  try {
    const { entry, action = "accept", index } = await request.json() as AcceptBragRequest;

    // Handle update action - modify entry in generated brag data
    if (action === "update") {
      if (typeof index !== "number") {
        return NextResponse.json({ error: "Index required for update action" }, { status: 400 });
      }

      try {
        const generatedContent = await fs.readFile(BRAG_GENERATED_PATH, "utf-8");
        const generated: GeneratedBragData = JSON.parse(generatedContent);

        if (index < 0 || index >= generated.entries.length) {
          return NextResponse.json({ error: "Invalid index" }, { status: 400 });
        }

        // Update the entry at the specified index
        generated.entries[index] = {
          ...generated.entries[index],
          ...entry,
        };

        await fs.writeFile(BRAG_GENERATED_PATH, JSON.stringify(generated, null, 2), "utf-8");
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: "No generated brag data found" }, { status: 404 });
      }
    }

    // Default: accept action - save to markdown file

    if (!entry || !entry.title || !entry.bullet) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
    }

    // Build markdown entry
    const date = new Date().toISOString().split("T")[0];
    const tagsLine = entry.tags && entry.tags.length > 0
      ? entry.tags.join(" | ")
      : entry.category;
    const mdLines = [
      "",
      `## ${entry.title}`,
      "",
      `**Tags:** ${tagsLine}`,
      `**Frequency:** ${entry.frequency} | **Confidence:** ${entry.confidence || "medium"}`,
      "",
      `> ${entry.bullet}`,
      "",
    ];

    // Add overall impact if present
    if (entry.overallImpact) {
      mdLines.push(`**Overall Impact:** ${entry.overallImpact}`);
      mdLines.push("");
    }

    mdLines.push(
      `*Metrics:* ${entry.metrics}`,
      "",
      `---`,
      `*Accepted on ${date}*`,
      ""
    );
    const mdEntry = mdLines.join("\n");

    // Ensure data directory exists
    const dataDir = path.dirname(BRAG_FILE_PATH);
    await fs.mkdir(dataDir, { recursive: true });

    // Read existing file or create with header
    let existingContent = "";
    try {
      existingContent = await fs.readFile(BRAG_FILE_PATH, "utf-8");
    } catch {
      // File doesn't exist, create with header
      existingContent = "# Brag List\n\nAccepted accomplishments for performance reviews.\n";
    }

    // Append new entry
    const updatedContent = existingContent + mdEntry;
    await fs.writeFile(BRAG_FILE_PATH, updatedContent, "utf-8");

    return NextResponse.json({ success: true, path: BRAG_FILE_PATH });
  } catch (error) {
    console.error("Failed to save brag entry:", error);
    return NextResponse.json({ error: "Failed to save brag entry" }, { status: 500 });
  }
}

/**
 * Get saved brag entries from markdown file and generated brag data.
 */
export async function GET(): Promise<NextResponse<{ content: string; generated?: GeneratedBragData } | { error: string }>> {
  try {
    // Read saved brags (markdown)
    let content = "";
    try {
      content = await fs.readFile(BRAG_FILE_PATH, "utf-8");
    } catch {
      // File doesn't exist yet
    }

    // Read generated brag data (JSON)
    let generated: GeneratedBragData | undefined;
    try {
      const generatedContent = await fs.readFile(BRAG_GENERATED_PATH, "utf-8");
      generated = JSON.parse(generatedContent);
    } catch {
      // File doesn't exist yet
    }

    return NextResponse.json({ content, generated });
  } catch {
    return NextResponse.json({ content: "" });
  }
}

/**
 * Delete a brag entry by index from generated data.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { index } = await request.json();

    if (typeof index !== "number") {
      return NextResponse.json({ error: "Index required" }, { status: 400 });
    }

    // Delete from generated brag data
    try {
      const generatedContent = await fs.readFile(BRAG_GENERATED_PATH, "utf-8");
      const generated: GeneratedBragData = JSON.parse(generatedContent);

      if (index < 0 || index >= generated.entries.length) {
        return NextResponse.json({ error: "Invalid index" }, { status: 400 });
      }

      // Remove the entry at the specified index
      generated.entries.splice(index, 1);

      await fs.writeFile(BRAG_GENERATED_PATH, JSON.stringify(generated, null, 2), "utf-8");
      return NextResponse.json({ success: true });
    } catch {
      return NextResponse.json({ error: "No generated brag data found" }, { status: 404 });
    }
  } catch (error) {
    console.error("Failed to delete brag entry:", error);
    return NextResponse.json({ error: "Failed to delete brag entry" }, { status: 500 });
  }
}
