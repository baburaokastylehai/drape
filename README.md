# Drape Stage 1 Prototype

Digital wardrobe app that solves cold start by scanning Gmail purchase receipts and extracting wardrobe items.

## What this build includes

- Google OAuth 2.0 (`gmail.readonly`) connect flow
- Gmail purchase-history scan (`category:purchases` + retailer filtering)
- Receipt parsing and item extraction (heuristic parser)
- Deduplication across repeated order/shipping messages
- Review-first UI to confirm items user still owns
- Editorial dashboard with:
  - wardrobe count
  - brand mix
  - size mix
  - spend timeline
  - returns/in-transit signal

## Stack

- Next.js 15 (App Router)
- React 19 + TypeScript
- In-memory session and scan data (Stage 1 intentionally no DB)

## Setup

1. Create Google OAuth credentials (Web application) in Google Cloud Console.
2. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/google/callback`
3. Copy `.env.example` to `.env` and fill values.
4. Install deps and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `ANTHROPIC_API_KEY` (optional, reserved for future extraction upgrade)

## Notes

- Current extraction is deterministic/heuristic so the full pipeline is usable immediately.
- Stage 1 goal is validating ingestion + UX flow. Stage 2 should move extraction to server queues and add persistent storage (Supabase/Postgres).
- Session and scan state reset on server restart.
