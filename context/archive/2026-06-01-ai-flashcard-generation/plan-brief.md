# AI Flashcard Generation — Plan Brief

> Full plan: `context/changes/ai-flashcard-generation/plan.md`

## What & Why

Build the AI flashcard generation flow (S-01) — the core value proposition of FlipIt. A logged-in user pastes study text, triggers LLM-powered generation via OpenRouter, reviews/edits/accepts/rejects each proposed card with a bulk "accept all" shortcut, and saves accepted cards to their Supabase collection. Every other roadmap slice (CRUD, study sessions) depends on flashcards existing, so this must land first.

## Starting Point

Auth is working (email/password, cookie sessions, middleware route protection). The Astro 6 + React 19 + Tailwind 4 + shadcn/ui stack is scaffolded. No database schema exists yet (empty `supabase/migrations/`), no LLM libraries are installed, and only the `button` component from shadcn/ui is available. The dashboard page is a placeholder.

## Desired End State

A logged-in user navigates to `/generate`, pastes up to 10,000 characters of study material, clicks Generate, sees a loading spinner while OpenRouter works, then reviews a scrollable list of proposed flashcards. Each card has accept/edit/reject actions; a bulk "accept all" shortcut is available. Saving inserts accepted cards into Supabase with per-user RLS isolation. The topbar shows a "Generate" link for authenticated users.

## Key Decisions Made

| Decision               | Choice                                    | Why (1 sentence)                                                                    |
| ---------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| LLM provider           | OpenRouter                                | Single API with model flexibility; swap models without code changes.                |
| Data model             | Flat table with nullable `generation_id`  | Simple schema — groups AI-generated cards by batch without a separate table.        |
| Generation feedback UX | Loading spinner with progress text        | Simplest implementation; meets NFR "visible feedback" without streaming complexity. |
| Input text limit       | ~10,000 characters                        | Covers a typical article; keeps LLM cost and latency reasonable.                    |
| Review UI pattern      | Scrollable card list with inline actions  | User sees all cards at once; matches common import-preview UX.                      |
| Error handling         | Clear error message + retry button        | Simple and actionable; no auto-retry or diagnostic details for MVP.                 |
| Card count control     | System decides (no user input)            | Zero-friction; LLM judges concept density better than the user.                     |
| Testing approach       | Mock LLM at API boundary + manual testing | Fast deterministic tests; manual covers prompt quality and real API integration.    |

## Scope

**In scope:**

- Supabase `flashcards` table with RLS (first migration in project)
- OpenRouter integration service with generation prompt
- `POST /api/generations` endpoint (Zod-validated, auth-gated)
- `POST /api/flashcards` endpoint for saving accepted cards
- `/generate` page (Astro + React island)
- Review interface: accept, edit, reject per card + bulk "accept all"
- Topbar navigation update + route protection

**Out of scope:**

- Streaming/SSE generation feedback
- Manual card creation (S-02)
- Collection browsing/search (S-02)
- Study sessions / spaced repetition (S-03)
- File upload (PRD non-goal)
- Dashboard redesign beyond minimal link addition

## Architecture / Approach

Three-layer vertical slice: Supabase schema → API endpoints → UI page. The generation page is a single Astro page hosting a React island (`GenerateView`) that manages a state machine: input → loading → review → saving → saved. The React island calls two API endpoints: `/api/generations` (LLM call) and `/api/flashcards` (batch save). Both endpoints use the Supabase client from middleware context with RLS enforcing per-user isolation. OpenRouter is called via native `fetch` (Cloudflare Workers compatible).

## Phases at a Glance

| Phase                                  | What it delivers                                                   | Key risk                                                     |
| -------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1. Database Schema & Data Access Layer | `flashcards` table with RLS, TypeScript types, data access service | First migration — must verify RLS policies work correctly    |
| 2. AI Generation Backend               | OpenRouter service, generation prompt, validated API endpoint      | LLM response parsing — model may return malformed JSON       |
| 3. Generation Page & Review Interface  | Full user-facing flow: paste → generate → review → save            | UI complexity — 5 React components with shared state machine |

**Prerequisites:** Supabase instance running (local or cloud), OpenRouter API key
**Estimated effort:** ~3 sessions across 3 phases

## Open Risks & Assumptions

- OpenRouter API availability and rate limits are assumed sufficient for MVP usage patterns
- LLM prompt quality for flashcard generation is unvalidated — may need iteration during Phase 2
- 128MB Cloudflare Worker memory ceiling assumed sufficient for generation requests (should be, but untested with large inputs)

## Success Criteria (Summary)

- User can paste text, generate flashcards, review/edit/accept/reject, and save to their collection in one unbroken flow
- RLS ensures users only see their own flashcards
- Generation fails gracefully with clear error messaging and retry option
