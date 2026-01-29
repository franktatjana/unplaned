/**
 * Polish Text API Route
 *
 * Cleans up task text by fixing grammar, spelling, and formatting
 * while preserving the original meaning. Uses AI with very low
 * temperature for consistent, minimal changes.
 *
 * @route POST /api/polish
 *
 * Request body:
 * - text: string - The text to polish
 *
 * Response:
 * - polished: string - Cleaned up text
 * - changed: boolean - Whether any changes were made
 * - original: string - The original text (for comparison)
 *
 * Safety: Returns original text if AI makes drastic changes
 * (>2x length increase or >50% length decrease)
 */

import { NextRequest, NextResponse } from "next/server";
import { callOllama } from "../../lib/ollama";
import { getPolishPrompt, getPolishSystemPrompt } from "../../lib/prompts";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ polished: text });
    }

    // Skip if text is very short
    if (text.length < 5) {
      return NextResponse.json({ polished: text, changed: false });
    }

    const result = await callOllama(getPolishPrompt(text), {
      system: getPolishSystemPrompt(),
      temperature: 0.1,
      num_predict: 100,
    });

    if (!result.ok) {
      return NextResponse.json({ polished: text, changed: false });
    }

    let polished = result.text.trim();
    // Remove surrounding quotes if present
    polished = polished.replace(/^["']|["']$/g, "").trim();

    // If the AI returned something drastically different or empty, use original
    if (!polished || polished.length > text.length * 2 || polished.length < text.length / 2) {
      return NextResponse.json({ polished: text, changed: false });
    }

    return NextResponse.json({
      polished,
      changed: polished.toLowerCase() !== text.toLowerCase(),
      original: text,
    });
  } catch (error) {
    console.error("Polish error:", error);
    return NextResponse.json({ polished: "", changed: false });
  }
}
