const requiredEnv = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] as const;

export function assertRequiredEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

export const config = {
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  sessionCookieName: "drape_session"
};
