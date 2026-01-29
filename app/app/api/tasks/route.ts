/**
 * Tasks List API Route
 *
 * Returns all tasks. Tasks are the primary data entity in Unplaned,
 * containing the task description, subtasks, duration, and metadata.
 *
 * @route GET /api/tasks
 *
 * Response: Task[]
 * - id: string - Task ID
 * - title: string - Task description
 * - subtasks: Subtask[] - Breakdown steps
 * - duration: 15 | 30 | 45 | 60 - Estimated minutes
 * - priority: "low" | "medium" | "high"
 * - tags: string[]
 * - status: "backlog" | "in_progress" | "done"
 */

import { NextResponse } from "next/server";
import { getTasks } from "../../lib/storage";

// Disable Next.js caching - always fetch fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tasks = await getTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Tasks GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
