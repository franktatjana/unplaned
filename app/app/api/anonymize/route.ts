import { NextRequest, NextResponse } from "next/server";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "llama3";

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    const prompt = `You are a privacy assistant. Replace all named entities (people names, company names, brands, locations, phone numbers, emails, addresses) with generic placeholders.

Rules:
- Person names → [PERSON]
- Company/brand names → [COMPANY]
- Locations/addresses → [LOCATION]
- Phone numbers → [PHONE]
- Email addresses → [EMAIL]
- Dates with specific years → keep the format but use [DATE]
- Keep generic words like "dentist", "doctor", "mom", "friend" as-is
- Keep action verbs and task structure intact

Examples:
- "Call Dr. Smith at EON" → "Call [PERSON] at [COMPANY]"
- "Email john@acme.com about the Berlin trip" → "Email [EMAIL] about the [LOCATION] trip"
- "Book appointment with dentist" → "Book appointment with dentist" (no change, generic)
- "Call mom" → "Call mom" (no change, generic)

Text to anonymize:
"${text}"

Return ONLY the anonymized text, nothing else.`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 300,
        },
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ anonymized: text, wasAnonymized: false });
    }

    const data = await response.json();
    const anonymized = (data.response || text).trim();

    return NextResponse.json({
      anonymized,
      wasAnonymized: anonymized !== text,
      original: text
    });
  } catch (error) {
    console.error("Anonymize error:", error);
    return NextResponse.json({ anonymized: "", wasAnonymized: false });
  }
}
