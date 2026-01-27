import { NextRequest, NextResponse } from "next/server";
import { getSession, getTask, updateTask, updateSession } from "../../../../lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const { subtaskId, completed } = await request.json();

    if (!subtaskId || typeof completed !== "boolean") {
      return NextResponse.json(
        { error: "subtaskId and completed are required" },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const task = await getTask(session.taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Update subtask completion status
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed } : st
    );

    await updateTask(session.taskId, { subtasks: updatedSubtasks });

    // Update session's completedSubtasks list
    const completedSubtasks = completed
      ? [...new Set([...session.completedSubtasks, subtaskId])]
      : session.completedSubtasks.filter((id) => id !== subtaskId);

    await updateSession(sessionId, { completedSubtasks });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subtask update error:", error);
    return NextResponse.json({ error: "Failed to update subtask" }, { status: 500 });
  }
}
