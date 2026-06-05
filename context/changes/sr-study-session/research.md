---
date: 2026-06-04T12:00:00+02:00
researcher: Claude Code
git_commit: 149a1f7
branch: main
repository: flipit
topic: "ts-fsrs API compatibility with FlipIt codebase for S-03 study session"
tags: [research, codebase, ts-fsrs, spaced-repetition, S-03]
status: complete
last_updated: 2026-06-04
last_updated_by: Claude Code
---

# Research: ts-fsrs API Compatibility with FlipIt Codebase

**Date**: 2026-06-04T12:00:00+02:00
**Researcher**: Claude Code
**Git Commit**: 149a1f7
**Branch**: main
**Repository**: flipit

## Research Question

Is the ts-fsrs API (documented in `research-ts-fsrs-api.md`) compatible with the existing FlipIt codebase? What integration points, conflicts, and migration requirements exist for implementing S-03 (study session with spaced repetition)?

## Summary

**ts-fsrs is fully compatible with the FlipIt codebase.** No conflicts were found across any dimension — database schema, API routes, frontend patterns, type system, or runtime. The library's stateless, pure-function design maps directly to established project conventions. Integration requires additive changes only: new DB columns + table, new API routes, new React components, and extended types. No existing code needs to be modified in breaking ways.

## Detailed Findings

### 1. Database Schema Compatibility

**Current flashcards table** (`supabase/migrations/20260602120000_create_flashcards.sql`):

- `id` (uuid PK), `user_id` (uuid FK → auth.users), `generation_id` (uuid nullable), `front` (text), `back` (text), `source` (text, 'ai'|'manual'), `created_at` (timestamptz), `updated_at` (timestamptz)
- RLS enabled with four user-scoped policies (SELECT/INSERT/UPDATE/DELETE all use `user_id = auth.uid()`)
- `updated_at` auto-trigger exists (`supabase/migrations/20260604120000_add_updated_at_trigger.sql`)

**ts-fsrs Card fields needed** (from `research-ts-fsrs-api.md`):

| Field            | Type           | Exists? | Action                      |
| ---------------- | -------------- | ------- | --------------------------- |
| `difficulty`     | float          | No      | Add column, default 0       |
| `due`            | timestamptz    | No      | Add column, default now()   |
| `elapsed_days`   | integer        | No      | Add column, default 0       |
| `lapses`         | integer        | No      | Add column, default 0       |
| `last_review`    | timestamptz    | No      | Add nullable column         |
| `learning_steps` | integer        | No      | Add column, default 0       |
| `reps`           | integer        | No      | Add column, default 0       |
| `scheduled_days` | integer        | No      | Add column, default 0       |
| `stability`      | float          | No      | Add column, default 0       |
| `state`          | smallint (0-3) | No      | Add column, default 0 (New) |

**Compatibility assessment:**

- All ts-fsrs fields can be added to the existing `flashcards` table as new columns with sensible defaults — no column name conflicts
- Existing RLS policies automatically cover new columns (they check `user_id`, not specific columns)
- The `updated_at` trigger will correctly fire when SR fields are updated
- A new `review_logs` table is needed for review history (no existing table conflicts)
- New index on `(user_id, due)` needed for the study queue query: `WHERE user_id = ? AND due <= NOW() ORDER BY due ASC`

### 2. API Route Pattern Compatibility

**Established pattern** (from `src/pages/api/flashcards.ts`, `src/pages/api/generations.ts`):

1. `export const prerender = false;`
2. Auth check via `context.locals.user` (injected by middleware)
3. JSON body parsing with try/catch
4. Zod schema validation with `.safeParse()`
5. Supabase client via `createClient(context.request.headers, context.cookies)`
6. Service layer call (functions in `src/lib/services/`)
7. Structured error responses: `{ error: string, issues?: string[] }`
8. Status codes: 200/201 success, 400 validation, 401 auth, 404 not found, 500 server

**ts-fsrs integration fits perfectly:**

- `GET /api/study/session` — fetch due cards, call `scheduler.repeat()` for interval previews
- `POST /api/study/review` — accept `{ card_id, rating }`, call `scheduler.next()`, persist result
- Both follow the exact same route structure as existing endpoints
- Zod schemas can validate Rating enum (1-4) and card_id (uuid)
- Service layer in `src/lib/services/study.ts` matches existing `src/lib/services/flashcards.ts` pattern
- `scheduler = fsrs()` is stateless — created per-request, no shared state needed

**Protected routes** (`src/middleware.ts:4`): Currently `["/dashboard", "/generate", "/flashcards"]`. A `/study` page will need to be added to `PROTECTED_ROUTES`.

### 3. Frontend Component Pattern Compatibility

**Established patterns:**

- **State machines via discriminated unions** (`src/components/generate/GenerateView.tsx:6-14`): `type State = { step: "input" } | { step: "loading" } | ...`
- **Container + presentational split**: Container components (FlashcardsView, GenerateView) manage state; child components receive props
- **API calls via fetch()** with error handling and typed responses
- **Astro pages** render React islands with `client:load`
- **shadcn/ui components** available: Button, Card, Badge, Input, Textarea, Label
- **No global state** — all local React state + useEffect for data fetching

**Study session UI maps directly:**

- `StudySessionView` as container with state machine: `{ step: "loading" } | { step: "studying"; card; flipped } | { step: "rating"; previews } | { step: "complete"; count }`
- Card flip component using existing Card UI + CSS transform
- Four rating buttons using existing Button component with interval labels
- Session progress using local state counter
- All follows the GenerateView pattern exactly

**No existing flip animation or SR components** — clean slate, no conflicts.

### 4. Type System Compatibility

**Current types** (`src/types.ts`):

- `Flashcard` interface (8 fields, all string-typed dates)
- `FlashcardProposal`, `CreateFlashcardInput`, `PaginatedResponse<T>`
- Manual types, no auto-generated Supabase types
- No naming collisions with ts-fsrs exports (Card, Rating, State, ReviewLog)

**ts-fsrs type integration:**

- Extend `Flashcard` interface with SR fields, or create `FlashcardWithSR` that extends it
- ts-fsrs `CardInput` accepts plain objects from DB — no hydration needed
- Date handling: Supabase returns ISO strings, ts-fsrs accepts `DateInput` (Date | string | number) — compatible
- Rating/State enums from ts-fsrs can be used directly in Zod schemas

### 5. Build & Runtime Compatibility

| Aspect          | FlipIt                               | ts-fsrs                      | Compatible?          |
| --------------- | ------------------------------------ | ---------------------------- | -------------------- |
| Module format   | ESM (`"type": "module"`)             | ESM + CJS + UMD              | Yes                  |
| Node.js version | 22.14.0 (.nvmrc)                     | >= 20.0.0                    | Yes                  |
| Runtime         | Cloudflare Workers + `nodejs_compat` | Confirmed edge-compatible    | Yes                  |
| TypeScript      | 5.9.3, strict mode                   | Full TS definitions included | Yes                  |
| Dependencies    | —                                    | Zero                         | No conflict possible |
| Bundler         | Vite (via Astro)                     | Pure JS, no special bundling | Yes                  |

**Cloudflare Workers detail:** `wrangler.jsonc` has `"compatibility_flags": ["nodejs_compat"]` with a recent compatibility date (2026-05-08). ts-fsrs is pure JavaScript with zero dependencies — it will bundle cleanly with Vite and execute without issues in the Workers runtime.

### 6. Lessons.md Compliance

Two existing lessons apply:

1. **"Always add updated_at trigger when creating timestamp columns"** — The review_logs table should include an `updated_at` column with trigger if reviews can be modified (unlikely for append-only logs, but worth noting).

2. **"Always set explicit fetch timeouts on external API calls"** — ts-fsrs is a local computation library with no external API calls. This lesson does not apply, but any future optimizer integration would need timeouts.

## Code References

- `supabase/migrations/20260602120000_create_flashcards.sql` — Current flashcards schema (will add SR columns)
- `supabase/migrations/20260604120000_add_updated_at_trigger.sql` — Trigger pattern to reuse for new tables
- `src/types.ts:1-10` — Flashcard interface to extend with SR fields
- `src/lib/services/flashcards.ts` — Service layer pattern for new study service
- `src/pages/api/flashcards.ts:7-47` — Zod schema pattern for review input validation
- `src/pages/api/flashcards.ts:49-107` — API route structure pattern (auth, validation, supabase, service call)
- `src/components/generate/GenerateView.tsx:6-14` — State machine pattern for study session view
- `src/components/flashcards/FlashcardsView.tsx` — Container component + fetch pattern
- `src/middleware.ts:4` — Protected routes array (add `/study`)
- `src/lib/supabase.ts` — Supabase client creation (reuse as-is)
- `src/lib/errors.ts` — NotFoundError pattern (extend for study session errors)
- `wrangler.jsonc:6` — `nodejs_compat` flag confirms Workers runtime support

## Architecture Insights

1. **Additive-only integration.** ts-fsrs requires no modifications to existing code — only new columns on the flashcards table, a new review_logs table, new API routes, and new React components. Existing CRUD and generation flows are unaffected.

2. **Schema strategy: extend flashcards table, not a separate SR table.** The ts-fsrs Card state is 1:1 with a flashcard. Adding columns directly to `flashcards` avoids JOIN overhead on the hot study-queue query and keeps the data model simple. Default values (`state = 0`, `due = now()`) make existing rows immediately "due for first review" — a sensible bootstrap.

3. **Stateless scheduler per request.** `fsrs()` creates a stateless scheduler with no shared state. This maps perfectly to Astro's per-request API route model. No singletons, no caching, no session affinity needed.

4. **`repeat()` for previews, `next()` for commits.** The two-step API (preview all outcomes → commit one rating) maps to a clean frontend UX: show interval labels on buttons before the user taps, then persist the chosen outcome. This avoids speculative writes.

5. **Type bridging is trivial.** ts-fsrs `CardInput` accepts plain objects — the Supabase row can be passed directly after selecting the right columns. Date conversion is handled automatically (`DateInput` accepts ISO strings). No hydration or adapter layer needed.

6. **RLS covers SR fields automatically.** All policies filter on `user_id = auth.uid()` at the row level, so new columns are protected without policy changes. The new `review_logs` table needs its own RLS policies following the same pattern.

## Historical Context

- `context/changes/sr-study-session/research-sr-libraries.md` — Library comparison that selected ts-fsrs as the recommended SR library (51.9K weekly downloads, zero deps, edge-compatible, FSRS algorithm 81% more accurate than SM-2)
- `context/changes/sr-study-session/research-ts-fsrs-api.md` — Detailed API reference for ts-fsrs showing Card interface, Rating/State enums, core API (repeat/next), and afterHandler pattern for DB serialization
- S-01 (ai-flashcard-generation) and S-02 (flashcard-crud) established the flashcards table schema, API route conventions, React component patterns, and service layer architecture that S-03 builds upon

## Related Research

- `context/changes/sr-study-session/research-sr-libraries.md` — SR library evaluation and selection
- `context/changes/sr-study-session/research-ts-fsrs-api.md` — ts-fsrs API reference

## Open Questions

1. **SR column placement: flashcards table vs join table?** This research recommends adding directly to flashcards (simpler, avoids JOINs). An alternative is a `flashcard_sr_state` join table if SR state should be independently resettable. Decision for `/10x-plan`.

2. **Default SR state for existing flashcards.** When the migration adds SR columns with defaults, all existing flashcards become "new" cards due immediately. Is this the desired behavior, or should existing cards be excluded from the study queue until explicitly enrolled? Decision for `/10x-plan`.

3. **Review log retention.** ts-fsrs supports `rollback(card, log)` and `reschedule(card, reviews)` which need full review history. Should review logs be retained indefinitely, or pruned after some period? Decision for `/10x-plan`.

4. **Study session page routing.** Should the study page be `/study` (all due cards) or `/study/[collection-id]` (per-collection sessions)? Current flashcards have no collection concept — all cards belong to a flat user-scoped list. Decision for `/10x-plan`.
