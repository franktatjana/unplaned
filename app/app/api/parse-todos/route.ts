/**
 * Parse Todos API Route
 *
 * Parses a raw todo list (brain dump) into structured tasks.
 * Uses AI to:
 * - Identify individual tasks from raw text
 * - Clean up titles (fix typos, make action-oriented)
 * - Suggest duration and tags for each task
 *
 * Falls back to simple line-by-line parsing if AI is unavailable.
 *
 * @route POST /api/parse-todos
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama, extractJSON } from "../../lib/ollama";
import { buildParseTodosPrompt } from "../../lib/prompts";

interface ParsedTask {
  title: string;
  suggestedDuration: 15 | 30 | 45 | 60;
  suggestedTags: string[];
  originalLine: string;
}

interface ParseResponse {
  tasks: ParsedTask[];
  source: "ollama" | "fallback";
}

/**
 * Fallback parser when AI is unavailable.
 * Splits text on newlines and bullet points.
 */
function fallbackParse(text: string): ParsedTask[] {
  return text
    .split(/[\n\r]+/)
    .map(line => line.replace(/^[\*\-\•\d+\.]\s*/, "").trim())
    .filter(line => line.length > 3)
    .map(line => ({
      title: line,
      suggestedDuration: 30 as const,
      suggestedTags: [],
      originalLine: line,
    }));
}

export async function POST(request: NextRequest): Promise<NextResponse<ParseResponse | { error: string }>> {
  try {
    const { rawText } = await request.json();

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "rawText is required" }, { status: 400 });
    }

    const trimmed = rawText.trim();
    if (trimmed.length === 0) {
      return NextResponse.json({ tasks: [], source: "fallback" });
    }

    // Try AI parsing
    const prompt = buildParseTodosPrompt(trimmed);
    const result = await callOllama(prompt, { temperature: 0.3, num_predict: 1500 });

    if (!result.ok) {
      // AI unavailable - use fallback
      return NextResponse.json({
        tasks: fallbackParse(trimmed),
        source: "fallback",
      });
    }

    // Parse AI response
    const parsed = extractJSON(result.text) as { tasks?: ParsedTask[] } | null;

    if (!parsed || !Array.isArray(parsed.tasks)) {
      // AI response malformed - use fallback
      return NextResponse.json({
        tasks: fallbackParse(trimmed),
        source: "fallback",
      });
    }

    // Validate and normalize tasks
    const validTasks: ParsedTask[] = parsed.tasks
      .filter((t): t is ParsedTask =>
        typeof t.title === "string" && t.title.length > 0
      )
      .map(t => ({
        title: t.title,
        suggestedDuration: [15, 30, 45, 60].includes(t.suggestedDuration)
          ? t.suggestedDuration
          : 30,
        suggestedTags: Array.isArray(t.suggestedTags)
          ? t.suggestedTags.filter((tag): tag is string => typeof tag === "string")
          : [],
        originalLine: typeof t.originalLine === "string" ? t.originalLine : t.title,
      }));

    return NextResponse.json({
      tasks: validTasks,
      source: "ollama",
    });
  } catch (error) {
    console.error("Parse todos error:", error);
    return NextResponse.json(
      { error: "Failed to parse todo list" },
      { status: 500 }
    );
  }
}
