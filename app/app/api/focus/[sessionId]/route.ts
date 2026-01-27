import { NextRequest, NextResponse } from "next/server";
import { getSession, getTask } from "../../../lib/storage";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await getSession(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const task = await getTask(session.taskId);

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ session, task });
  } catch (error) {
    console.error("Focus GET error:", error);
    return NextResponse.json({ error: "Failed to load focus data" }, { status: 500 });
  }
}
