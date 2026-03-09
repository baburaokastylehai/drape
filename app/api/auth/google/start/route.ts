import { NextResponse } from "next/server";
import { assertRequiredEnv, config } from "@/lib/config";
import { buildGoogleAuthUrl, createOAuthState } from "@/lib/google-auth";
import { getOrCreateSession, saveSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET() {
  try {
    assertRequiredEnv();
    const { session, isNew } = await getOrCreateSession();
    const state = createOAuthState();

    session.oauthState = state;
    saveSession(session);

    const redirectUrl = buildGoogleAuthUrl(state);
    const response = NextResponse.redirect(redirectUrl);

    if (isNew) {
      response.cookies.set(config.sessionCookieName, session.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/"
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start OAuth";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
