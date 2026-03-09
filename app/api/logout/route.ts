import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { clearSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(config.sessionCookieName)?.value;
  clearSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(config.sessionCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
