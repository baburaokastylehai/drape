import crypto from "crypto";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import type { SessionData } from "@/lib/types";

type SessionMap = Map<string, SessionData>;

declare global {
  // eslint-disable-next-line no-var
  var __drapeSessionStore: SessionMap | undefined;
}

function getStore(): SessionMap {
  if (!global.__drapeSessionStore) {
    global.__drapeSessionStore = new Map<string, SessionData>();
  }
  return global.__drapeSessionStore;
}

export function createSession(): SessionData {
  const id = crypto.randomUUID();
  const now = Date.now();
  const session: SessionData = { id, createdAt: now, updatedAt: now };
  getStore().set(id, session);
  return session;
}

export function getSessionById(id: string | undefined): SessionData | undefined {
  if (!id) return undefined;
  return getStore().get(id);
}

export function saveSession(session: SessionData): void {
  session.updatedAt = Date.now();
  getStore().set(session.id, session);
}

export async function getOrCreateSession(): Promise<{ session: SessionData; isNew: boolean }> {
  const cookieStore = cookies();
  const sessionId = cookieStore.get(config.sessionCookieName)?.value;
  const existing = getSessionById(sessionId);
  if (existing) return { session: existing, isNew: false };
  return { session: createSession(), isNew: true };
}

export function clearSession(sessionId: string | undefined): void {
  if (!sessionId) return;
  getStore().delete(sessionId);
}
