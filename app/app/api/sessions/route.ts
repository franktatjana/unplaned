import { NextResponse } from "next/server";
import { getSessions } from "../../lib/storage";

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
