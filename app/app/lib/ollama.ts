/**
 * Ollama Client Module
 *
 * Provides a unified interface for communicating with the Ollama local LLM.
 * All AI features in Unplaned route through this module:
 * - Task breakdown generation
 * - Step analysis and elaboration
 * - Task refinement from external suggestions
 * - Template evaluation
 *
 * @module lib/ollama
 */

// ============================================
// Configuration
// ============================================

/** Ollama server URL - can be overridden via environment variable */
export const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";

/** Model to use for generation - defaults to llama3, override with OLLAMA_MODEL env var */
export const MODEL = process.env.OLLAMA_MODEL || "llama3";

// ============================================
// JSON Parsing Utilities
// ============================================

/**
 * Attempts to parse JSON with automatic error recovery.
 *
 * LLMs often produce malformed JSON with common issues like:
 * - Trailing commas before closing braces/brackets
 * - Truncated output with missing closing braces
 * - Extra content after the JSON object
 *
 * This function attempts to fix these issues before parsing.
 *
 * @param text - Raw text that should contain JSON
 * @returns Parsed object or null if parsing fails after fixes
 *
 * @example
 * // Handles trailing commas
 * tryParseJSON('{"a": 1,}')  // Returns { a: 1 }
 *
 * // Handles truncated JSON
 * tryParseJSON('{"a": [1, 2')  // Returns { a: [1, 2] }
 */
export function tryParseJSON(text: string): unknown | null {
  // First, try direct parsing - most efficient path
  try {
    return JSON.parse(text);
  } catch {
    // Continue with fixes if direct parse fails
  }

  let fixed = text;

  // Fix 1: Remove trailing commas before closing braces/brackets
  // Matches: ,} or ,] with optional whitespace
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  // Fix 2: Complete truncated JSON by counting unmatched braces/brackets
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;

  // Add missing closing brackets first (arrays inside objects)
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += "]";
  }
  // Then add missing closing braces
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += "}";
  }

  // Fix 3: Remove any content after the last closing brace
  // LLMs sometimes add explanatory text after the JSON
  const lastBrace = fixed.lastIndexOf("}");
  if (lastBrace !== -1) {
    fixed = fixed.substring(0, lastBrace + 1);
  }

  // Attempt to parse the fixed JSON
  try {
    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

/**
 * Extracts and parses a JSON object from LLM response text.
 *
 * LLM responses often contain JSON embedded in other text like:
 * "Here's the analysis:\n{...}\nLet me know if you need more."
 *
 * This function finds the JSON object within the text and parses it.
 *
 * @param text - Full LLM response text
 * @returns Parsed JSON object or null if no valid JSON found
 *
 * @example
 * extractJSON('Result: {"valid": true}')  // Returns { valid: true }
 * extractJSON('No JSON here')             // Returns null
 */
export function extractJSON(text: string): Record<string, unknown> | null {
  // Find the first { to last } span (greedy match for nested objects)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return tryParseJSON(jsonMatch[0]) as Record<string, unknown> | null;
}

// ============================================
// Ollama API Interface
// ============================================

/**
 * Options for Ollama API calls
 */
export interface OllamaOptions {
  /**
   * Controls randomness in generation (0.0 = deterministic, 1.0 = creative)
   * Lower values (0.1-0.3) recommended for structured JSON output
   * @default 0.3
   */
  temperature?: number;

  /**
   * Maximum tokens to generate
   * - Short responses (time estimates): 10-50
   * - Medium responses (analysis): 500-1000
   * - Long responses (breakdowns): 1500-2000
   * @default 1500
   */
  num_predict?: number;

  /**
   * System prompt to set context/persona for the model
   * Used to establish the AI's role before the main prompt
   */
  system?: string;
}

/**
 * Calls the Ollama API to generate a response.
 *
 * This is the main interface for all AI operations. It handles:
 * - Request formatting and timeout (30 seconds)
 * - Error handling with helpful messages
 * - Response extraction
 *
 * @param prompt - The user prompt to send to the model
 * @param options - Generation options (temperature, max tokens, system prompt)
 * @returns Object with ok status, response text, and optional error message
 *
 * @example
 * // Basic usage
 * const result = await callOllama("Break down: Write a report");
 * if (result.ok) {
 *   const data = extractJSON(result.text);
 * }
 *
 * @example
 * // With options
 * const result = await callOllama(prompt, {
 *   system: "You are a task breakdown expert.",
 *   temperature: 0.2,
 *   num_predict: 500
 * });
 */
export async function callOllama(
  prompt: string,
  options: OllamaOptions = {}
): Promise<{ ok: boolean; text: string; error?: string }> {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false, // We want the complete response, not streaming
        // Only include system prompt if provided
        ...(options.system && { system: options.system }),
        options: {
          temperature: options.temperature ?? 0.3,
          num_predict: options.num_predict ?? 1500,
        },
      }),
      // Timeout after 30 seconds to prevent hanging requests
      signal: AbortSignal.timeout(30000),
    });

    // Handle HTTP errors
    if (!response.ok) {
      return {
        ok: false,
        text: "",
        error: `AI service error (${response.status}). Is Ollama running?`,
      };
    }

    // Extract the response text
    const data = await response.json();
    return { ok: true, text: data.response || "" };
  } catch (error) {
    // Handle network errors, timeouts, etc.
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      ok: false,
      text: "",
      error: `Request failed: ${message}. Is Ollama running at ${OLLAMA_URL}?`,
    };
  }
}
