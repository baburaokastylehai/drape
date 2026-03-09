import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { exchangeCodeForTokens } from "@/lib/google-auth";
import { getConnectedEmail } from "@/lib/gmail";
import { getSessionById, saveSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (oauthError) {
      return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(oauthError)}`, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_code", request.url));
    }

    const cookieStore = cookies();
    const sessionId = cookieStore.get(config.sessionCookieName)?.value;
    const session = getSessionById(sessionId);

    if (!session || !session.oauthState || session.oauthState !== state) {
      return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
    }

    const tokens = await exchangeCodeForTokens(code);
    session.tokens = tokens;
    session.oauthState = undefined;

    try {
      session.connectedEmail = await getConnectedEmail(tokens);
    } catch {
      session.connectedEmail = undefined;
    }

    saveSession(session);

    return NextResponse.redirect(new URL("/?connected=1", request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, request.url));
  }
}
