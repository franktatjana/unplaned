import { NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      const models = data.models?.map((m: { name: string }) => m.name) || [];

      // Check if the required model is available
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
