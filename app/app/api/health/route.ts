/**
 * Health Check API Route
 *
 * Verifies that Ollama (local LLM service) is running and the required
 * model is available. Used by the UI to show connection status.
 *
 * @route GET /api/health
 *
 * Response:
 * - ollama: boolean - Whether Ollama is reachable and model available
 * - model: string - The configured model name (when healthy)
 * - models: string[] - List of available models
 * - error: string - Error message (when unhealthy)
 * - url: string - The Ollama URL being used
 */

import { NextResponse } from "next/server";

// Configuration from environment or defaults
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function GET() {
  try {
    // Query Ollama's /api/tags endpoint to list available models
    // Short timeout (3s) to fail fast if Ollama isn't running
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];

      // Verify the configured model is actually available
      const modelAvailable = models.some((m: string) =>
        m.startsWith(MODEL) || m === MODEL
      );

      if (!modelAvailable) {
        return NextResponse.json({
          ollama: false,
          error: `Model "${MODEL}" not found. Available: ${models.join(", ") || "none"}`,
          models,
          url: OLLAMA_URL,
        });
      }

      return NextResponse.json({
        ollama: true,
        model: MODEL,
        models,
        url: OLLAMA_URL,
      });
    }

    return NextResponse.json({ ollama: false, error: "Ollama not responding" });
  } catch (error) {
    return NextResponse.json({
      ollama: false,
      error: "Ollama not running",
    });
  }
}
