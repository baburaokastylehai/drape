import crypto from "crypto";
import { config } from "@/lib/config";
import type { MailTokenSet } from "@/lib/types";

function encodeParams(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export function createOAuthState(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildGoogleAuthUrl(state: string): string {
  const query = encodeParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

export async function exchangeCodeForTokens(code: string): Promise<MailTokenSet> {
  const body = encodeParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUri,
    grant_type: "authorization_code"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<MailTokenSet> {
  const body = encodeParams({
    refresh_token: refreshToken,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000
  };
}
