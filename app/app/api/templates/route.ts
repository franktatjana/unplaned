/**
 * Templates List API Route
 *
 * Returns all saved task templates. Templates allow users to save
 * common task patterns for quick reuse (e.g., "Weekly standup prep").
 *
 * @route GET /api/templates
 *
 * Response: Template[]
 * - id: string - Template ID
 * - name: string - Template name
 * - subtasks: string[] - Template step texts
 * - tags: string[]
 * - duration: number - Default duration
 * - usageCount: number - Times template was used
 */

import { NextResponse } from "next/server";
import { getTemplates } from "../../lib/storage";

export async function GET() {
  try {
    const templates = await getTemplates();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Templates error:", error);
    return NextResponse.json([]);
  }
}
