# Drape

hassle-free digitization of your physical wardrobe.

## what it does

Drape connects to your Gmail, scans your purchase receipts, and automatically builds a digital record of everything you've bought — brands, items, spending patterns, all extracted from emails you already have.

## how it works

1. sign in with Google (Gmail read-only access)
2. Drape scans your inbox for purchase receipts from known retailers
3. a heuristic parser extracts item names, brands, and prices from the email content
4. your wardrobe builds itself — no manual entry

## what's built

- Google OAuth 2.0 authentication flow
- Gmail API integration — fetches and filters purchase emails
- heuristic receipt parser — extracts items without needing AI
- known brand and retailer database for matching
- analytics dashboard — brand mix, spending timeline, purchase history
- single-page UI built with Next.js 13 and TypeScript

## tech stack

- Next.js 13.5 (App Router)
- React 18
- TypeScript
- Google OAuth 2.0 + Gmail API
- in-memory session storage (Stage 1 — Supabase planned for Stage 2)

## current status

this is a Stage 1 prototype that validates the core ingestion and UX flow. it works locally with Google OAuth credentials configured.

## to run locally:

1. clone this repo
2. `npm install`
3. create a Google Cloud project with Gmail API enabled
4. set up OAuth 2.0 credentials (web application type)
5. copy `.env.example` to `.env` and fill in your credentials
6. `npm run dev`

note: Google OAuth requires approved test users during development. the app is not publicly deployed because Google's verification process for Gmail access requires a review. this is a portfolio project demonstrating the approach and architecture.

## what's next (Stage 2)

- persistent storage with Supabase
- server-side job queue for background email scanning
- AI-powered extraction for unstructured receipts (Claude API)
- wardrobe visualization and outfit suggestions

## built by

Atharva Shembekar
