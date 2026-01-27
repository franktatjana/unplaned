import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ polished: text });
    }

    // Skip if text is very short or already looks clean
    if (text.length < 5) {
      return NextResponse.json({ polished: text, changed: false });
    }

    const prompt = `Fix any spelling and grammar errors in this task description. Keep it natural and concise. Only return the corrected text, nothing else. Do not add quotes or explanations.

Original: "${text}"

Corrected:`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 100,
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ polished: text, changed: false });
    }

    const data = await response.json();
    let polished = (data.response || text).trim();

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
