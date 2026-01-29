/**
 * API route for managing saved brags (markdown file)
 */

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const BRAG_FILE_PATH = path.join(process.cwd(), "data", "brag-list.md");

/**
 * Delete a saved brag entry by index from the markdown file.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<{ success: boolean } | { error: string }>> {
  try {
    const { index } = await request.json();

    if (typeof index !== "number") {
      return NextResponse.json({ error: "Index required" }, { status: 400 });
    }

    let content = "";
    try {
      content = await fs.readFile(BRAG_FILE_PATH, "utf-8");
    } catch {
      return NextResponse.json({ error: "No brags file found" }, { status: 404 });
    }

    // Split by "## " to get entries, keeping the header
    const parts = content.split(/^## /m);
    const header = parts[0]; // "# Brag List\n\n..."
    const entries = parts.slice(1);

    if (index < 0 || index >= entries.length) {
      return NextResponse.json({ error: "Invalid index" }, { status: 400 });
    }

    // Remove the entry at the specified index
    entries.splice(index, 1);

    // Rebuild content
    const newContent = entries.length > 0
      ? header + entries.map(e => "## " + e).join("")
      : header;

    await fs.writeFile(BRAG_FILE_PATH, newContent, "utf-8");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete saved brag entry:", error);
    return NextResponse.json({ error: "Failed to delete saved brag entry" }, { status: 500 });
  }
}
