/**
 * Sessions List API Route
 *
 * Returns all focus sessions. Sessions track when a user is actively
 * working on a task, including timing data and subtask completion.
 *
 * @route GET /api/sessions
 *
 * Response: Session[]
 * - id: string - Session ID
 * - taskId: string - The task being worked on
 * - startTime: string - ISO timestamp when session started
 * - completedSubtasks: string[] - IDs of completed subtasks
 * - status: "active" | "paused" | "completed"
 */

import { NextResponse } from "next/server";
import { getSessions } from "../../lib/storage";

// Disable Next.js caching - always fetch fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await getSessions();
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Sessions GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
