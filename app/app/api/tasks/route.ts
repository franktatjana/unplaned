import { NextResponse } from "next/server";
import { getTasks } from "../../lib/storage";

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
