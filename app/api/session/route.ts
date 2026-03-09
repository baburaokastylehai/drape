import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getSessionById } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(config.sessionCookieName)?.value;
  const session = getSessionById(sessionId);

  return NextResponse.json({
    connected: Boolean(session?.tokens?.accessToken),
    connectedEmail: session?.connectedEmail
  });
}
