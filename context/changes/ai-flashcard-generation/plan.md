# AI Flashcard Generation Implementation Plan

## Overview

Build the complete AI flashcard generation flow for S-01: a logged-in user can paste study text, trigger LLM-powered generation via OpenRouter, review/edit/accept/reject each proposed card (with a bulk "accept all" shortcut), and save accepted cards to their Supabase collection. This is the first vertical slice and the core value proposition — every other slice depends on flashcards existing.

## Current State Analysis

The codebase is a scaffolded Astro 6 SSR app with React 19 islands deployed to Cloudflare Workers. Auth is working (email/password via Supabase), middleware protects routes, and the UI has a cosmic dark theme with shadcn/ui (only `button.tsx` installed so far).

### Key Discoveries:

- No database schema exists — `supabase/migrations/` is empty. This plan creates the first table (`src/lib/supabase.ts:1-24` handles the client; schema is the gap).
- No LLM libraries installed — `package.json` has no AI SDKs. We'll use OpenRouter via native `fetch` (Cloudflare Workers compatible, no heavy SDK needed).
- API route pattern established in `src/pages/api/auth/signin.ts:1-20` — uses `APIRoute` type, form data parsing, redirects. Our generation endpoint will follow the same pattern but return JSON instead of redirecting.
- React islands pattern established in `src/components/auth/SignInForm.tsx` — client-side state + validation + form submission. Our review interface will follow the same pattern with `client:load`.
- Middleware at `src/middleware.ts:4` has `PROTECTED_ROUTES = ["/dashboard"]` — we'll add `/generate` here.
- Env vars declared in `astro.config.mjs:18-21` via `astro:env/server` — we'll add `OPENROUTER_API_KEY` following this pattern.
- Only `button.tsx` from shadcn/ui is installed — we need `card`, `textarea`, `input`, `badge`, and `label` components.

## Desired End State

A logged-in user navigates to `/generate`, pastes study text (up to 10,000 characters), clicks "Generate", sees a loading indicator while the LLM works, then reviews a scrollable list of proposed flashcards. Each card shows front/back with accept, edit, and reject buttons. A "Save accepted" button at the top batch-inserts all accepted cards into the user's Supabase collection. After saving, the user sees a confirmation with a count of saved cards. The flashcards table exists with RLS enforcing per-user data isolation.

### How to verify:

1. Sign in, navigate to `/generate`
2. Paste 1-2 paragraphs of study text, click Generate
3. See loading spinner, then a list of 3-10 proposed flashcards
4. Edit one card's front text, reject another, accept the rest
5. Click "Save accepted" — cards appear in Supabase `flashcards` table with correct `user_id` and `generation_id`
6. Unauthenticated access to `/generate` redirects to sign-in

## What We're NOT Doing

- **No streaming/SSE** — loading spinner with progress text, not card-by-card streaming
- **No generation metadata table** — flat `flashcards` table with nullable `generation_id`, no separate `generations` table storing source text
- **No user control of card count** — LLM decides based on text density
- **No manual card creation** — that's S-02 (flashcard-crud)
- **No study sessions or SR scheduling** — that's S-03 (sr-study-session)
- **No file upload** — PRD non-goal; paste-text-only
- **No collection browsing/search** — that's S-02
- **No dashboard redesign** — minimal link addition only

## Implementation Approach

Three phases in dependency order: (1) database schema and data access so flashcards can be stored, (2) LLM integration and API endpoint so flashcards can be generated, (3) UI page and React components so users can interact with the flow. Each phase is independently testable before proceeding.

## Critical Implementation Details

### Cloudflare Workers runtime

The OpenRouter integration must use native `fetch` — no Node.js-only HTTP libraries. The `nodejs_compat` flag provides polyfills but not full Node.js. Keep the LLM response parsing synchronous and lightweight (128MB memory ceiling per invocation).

---

## Phase 1: Database Schema & Data Access Layer

### Overview

Create the `flashcards` table in Supabase with Row Level Security, define TypeScript types, and build a thin data access service. This phase establishes the storage foundation that Phase 2 and 3 depend on.

### Changes Required:

#### 1. Flashcards table migration

**File**: `supabase/migrations/<timestamp>_create_flashcards.sql`

**Intent**: Create the flashcards table with RLS policies so each user can only access their own cards. This is the first migration in the project.

**Contract**: Table `flashcards` with columns: `id` (uuid PK), `user_id` (uuid FK to `auth.users`, not null, cascade delete), `generation_id` (uuid, nullable — links cards from the same AI generation, null for manual cards), `front` (text, not null), `back` (text, not null), `source` (text, not null, default `'ai'`, check constraint: `'ai'` or `'manual'`), `created_at` (timestamptz, default `now()`), `updated_at` (timestamptz, default `now()`). RLS enabled with four policies: select/insert/update/delete where `user_id = auth.uid()`. Index on `user_id` for collection queries. Index on `generation_id` for grouping queries.

#### 2. TypeScript types

**File**: `src/types.ts`

**Intent**: Define shared types for flashcards and generation proposals used across API endpoints and React components.

**Contract**: Export `Flashcard` interface matching the DB schema columns. Export `FlashcardProposal` interface with `front: string` and `back: string` (the shape returned by the LLM before cards are saved). Export `CreateFlashcardInput` with `front`, `back`, `source`, and optional `generation_id`.

#### 3. Data access service

**File**: `src/lib/services/flashcards.ts`

**Intent**: Encapsulate Supabase queries for flashcard CRUD so API endpoints don't embed raw query logic.

**Contract**: Export `createFlashcards(supabase, userId, cards: CreateFlashcardInput[]): Promise<Flashcard[]>` for batch insert. Takes the Supabase client instance (from `createClient` in `src/lib/supabase.ts`) and returns inserted rows. This is the only data access function needed for S-01; S-02 will add read/update/delete.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db reset` completes without errors
- TypeScript compiles: `npx astro check` passes with no type errors in new files
- Lint passes: `npm run lint`

#### Manual Verification:

- Insert a row into `flashcards` via Supabase Studio and verify RLS blocks access from a different user
- Verify `user_id` FK constraint rejects invalid UUIDs

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: AI Generation Backend

### Overview

Integrate OpenRouter as the LLM provider, build a generation service with prompt engineering for structured flashcard output, and expose a `POST /api/generations` endpoint with Zod input validation. This phase makes flashcard generation possible server-side.

### Changes Required:

#### 1. OpenRouter API key environment variable

**File**: `astro.config.mjs`

**Intent**: Register `OPENROUTER_API_KEY` as a server secret so it's available at runtime via `astro:env/server`, following the same pattern as `SUPABASE_URL` and `SUPABASE_KEY`.

**Contract**: Add `OPENROUTER_API_KEY: envField.string({ context: "server", access: "secret", optional: true })` to the `env.schema` object.

#### 2. Environment example file

**File**: `.env.example`

**Intent**: Document the new environment variable so developers know to set it.

**Contract**: Append `OPENROUTER_API_KEY=###` line.

#### 3. OpenRouter generation service

**File**: `src/lib/services/openrouter.ts`

**Intent**: Encapsulate the OpenRouter API call and prompt logic. Takes raw study text, sends it to the LLM with a system prompt that instructs structured JSON output, parses the response into `FlashcardProposal[]`.

**Contract**: Export `generateFlashcards(sourceText: string): Promise<FlashcardProposal[]>`. Uses native `fetch` against `https://openrouter.ai/api/v1/chat/completions`. Imports `OPENROUTER_API_KEY` from `astro:env/server`. Throws a descriptive error if the API key is missing, the API call fails, or the response can't be parsed into valid flashcard proposals. The system prompt should instruct the model to return a JSON array of `{ "front": "...", "back": "..." }` objects, one concept per card.

#### 4. Generation API endpoint

**File**: `src/pages/api/generations.ts`

**Intent**: HTTP endpoint that authenticated users call to generate flashcards from pasted text. Validates input, calls the OpenRouter service, returns proposals as JSON.

**Contract**: Export `POST: APIRoute`. Request body is JSON with `{ source_text: string }`. Zod schema validates `source_text` is a non-empty string, max 10,000 characters. Returns 401 if `context.locals.user` is null. Returns 400 with validation errors on invalid input. Returns 500 with user-friendly message on LLM failure. On success, returns `200` with JSON body `{ generation_id: string, flashcards: FlashcardProposal[] }` — `generation_id` is a UUID generated server-side so the client can attach it when saving.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Call `POST /api/generations` with valid text via curl/Postman — returns JSON array of flashcard proposals
- Call without auth — returns 401
- Call with empty text — returns 400 with validation error
- Call with text exceeding 10,000 chars — returns 400

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Generation Page & Review Interface

### Overview

Build the user-facing generation page with a text input form and a React-powered review interface. The review shows proposed cards in a scrollable list with per-card accept/edit/reject actions and a bulk "accept all" shortcut. Accepted cards are saved to Supabase via a new endpoint.

### Changes Required:

#### 1. Install shadcn/ui components

**Intent**: Add the UI primitives needed for the generation and review interface.

**Contract**: Run `npx shadcn@latest add card textarea input badge label` to install components into `src/components/ui/`. These follow the existing pattern of `button.tsx`.

#### 2. Save flashcards API endpoint

**File**: `src/pages/api/flashcards.ts`

**Intent**: Endpoint to batch-save accepted flashcards to the user's collection.

**Contract**: Export `POST: APIRoute`. Request body is JSON with `{ generation_id: string, flashcards: Array<{ front: string, back: string }> }`. Zod validates: `generation_id` is a UUID string, `flashcards` is a non-empty array where each item has non-empty `front` and `back` strings. Returns 401 if not authenticated. Calls `createFlashcards` service from Phase 1 with `source: 'ai'` and the provided `generation_id`. Returns `201` with `{ saved_count: number }`.

#### 3. Generation page

**File**: `src/pages/generate.astro`

**Intent**: Server-rendered page that hosts the generation form and review interface as React islands. Protected by auth.

**Contract**: Imports `Layout` from `@/layouts/Layout.astro`. Checks `Astro.locals.user` (middleware handles redirect, but page uses it for display). Renders the `GenerateView` React component with `client:load`.

#### 4. Generation view component

**File**: `src/components/generate/GenerateView.tsx`

**Intent**: Top-level React component that manages the generation flow state machine: input → loading → review → saving → saved.

**Contract**: Renders `GenerateForm` in the input state. On form submit, calls `POST /api/generations` with the source text via `fetch`, transitions to loading state (spinner + "Generating flashcards..." text). On success, transitions to review state rendering `FlashcardReview` with the proposals. Handles error state with retry button per the decided error UX.

#### 5. Generation form component

**File**: `src/components/generate/GenerateForm.tsx`

**Intent**: Textarea for pasting study text with character counter and generate button.

**Contract**: Props: `onSubmit: (sourceText: string) => void`, `isLoading: boolean`. Renders a `textarea` (shadcn) with placeholder text, live character count showing `X / 10,000`, and a submit button (disabled when empty, over limit, or loading). Client-side validation: non-empty, ≤ 10,000 characters.

#### 6. Flashcard review component

**File**: `src/components/generate/FlashcardReview.tsx`

**Intent**: Scrollable list of proposed flashcards with per-card actions and bulk operations.

**Contract**: Props: `proposals: FlashcardProposal[]`, `generationId: string`, `onSaveComplete: (savedCount: number) => void`. Manages per-card state: `pending` | `accepted` | `rejected` | `editing`. Renders a sticky top bar with: count summary ("X of Y accepted"), "Accept all" button, "Save accepted" button (disabled when 0 accepted). Below the bar, renders a `FlashcardItem` for each proposal. "Save accepted" calls `POST /api/flashcards` with accepted cards and the `generationId`, then calls `onSaveComplete`.

#### 7. Flashcard item component

**File**: `src/components/generate/FlashcardItem.tsx`

**Intent**: Single flashcard showing front/back text with action buttons.

**Contract**: Props: `proposal: FlashcardProposal`, `status: 'pending' | 'accepted' | 'rejected' | 'editing'`, `onAccept`, `onReject`, `onEdit`, `onSaveEdit: (front: string, back: string) => void`, `onCancelEdit`. Renders a card (shadcn) with front and back text. In `pending` state: shows accept, edit, reject buttons. In `accepted` state: visual indicator (green border/badge), shows undo button. In `rejected` state: dimmed/strikethrough, shows undo button. In `editing` state: front and back become editable inputs with save/cancel buttons.

#### 8. Update middleware protected routes

**File**: `src/middleware.ts`

**Intent**: Protect the `/generate` page so only authenticated users can access it.

**Contract**: Add `"/generate"` to the `PROTECTED_ROUTES` array at line 4.

#### 9. Update navigation

**File**: `src/components/Topbar.astro`

**Intent**: Add a "Generate" link to the navigation bar so authenticated users can find the feature.

**Contract**: Add a link to `/generate` in the authenticated-user section of the topbar, next to the existing "Dashboard" link.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx astro check`
- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Full happy path: paste text → generate → review cards → accept some, reject one, edit one → save → verify cards in Supabase
- Bulk "accept all" works and enables the save button
- Rejecting all cards and clicking save shows appropriate feedback (no cards to save)
- Editing a card's front and back text saves correctly
- Unauthenticated access to `/generate` redirects to `/auth/signin`
- Character counter updates live and prevents submission over 10,000 chars
- Error state: disconnect network, click generate, see error message with retry button
- Navigation: "Generate" link appears in topbar for logged-in users, not for guests

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Zod validation schemas for `/api/generations` and `/api/flashcards` — test valid input, empty input, oversized input, malformed JSON
- OpenRouter service with mocked `fetch` — test successful parse, API error, malformed LLM response, missing API key
- `createFlashcards` service with mocked Supabase client — test batch insert, empty array handling

### Integration Tests:

- Generation endpoint: mock OpenRouter, verify authenticated call returns proposals, unauthenticated returns 401
- Save endpoint: mock Supabase, verify batch insert is called with correct user_id and generation_id

### Manual Testing Steps:

1. Sign in, navigate to `/generate` via topbar link
2. Paste a short paragraph (~200 words), click Generate, verify 3-8 cards appear
3. Paste a long text (~2000 words), verify more cards and reasonable wait time (<15s)
4. Accept all cards, save, check Supabase Studio for correct data
5. Generate again, reject all, verify save button is disabled or shows "no cards to save"
6. Generate again, edit one card's front and back, accept it, save, verify edits persisted
7. Test with empty textarea — button should be disabled
8. Test with 10,001+ characters — button should be disabled, counter shows red
9. Open `/generate` in incognito — should redirect to sign-in

## Performance Considerations

- OpenRouter API call latency: expect 3-15 seconds depending on text length and model load. The loading spinner with progress text keeps the user informed.
- Batch insert via Supabase: single `insert()` call with array, not individual inserts per card. Handles up to ~25 cards per generation efficiently.
- No client-side caching of proposals — if the user navigates away mid-review, proposals are lost. This is acceptable for MVP; regeneration is cheap.
- 128MB Cloudflare Worker memory: a single generation request with 10K chars input and ~25 card output is well within limits.

## Migration Notes

This is the first database migration in the project. After creating the migration file:

- Local development: `npx supabase db reset` applies all migrations from scratch
- Production Supabase: migrations are applied via `npx supabase db push` or the Supabase Dashboard migration runner
- The migration is additive (new table only) — no existing data to migrate

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-01)
- PRD requirements: `context/foundation/prd.md` (FR-003, FR-004, US-01)
- Change identity: `context/changes/ai-flashcard-generation/change.md`
- Existing API pattern: `src/pages/api/auth/signin.ts`
- Existing React island pattern: `src/components/auth/SignInForm.tsx`
- Supabase client: `src/lib/supabase.ts`
- Middleware: `src/middleware.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Schema & Data Access Layer

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — 51b3114
- [x] 1.2 TypeScript compiles: `npx astro check` — 51b3114
- [x] 1.3 Lint passes: `npm run lint` — 51b3114

#### Manual

- [x] 1.4 RLS blocks cross-user access in Supabase Studio — 51b3114
- [x] 1.5 FK constraint rejects invalid user_id UUIDs — 51b3114

### Phase 2: AI Generation Backend

#### Automated

- [x] 2.1 TypeScript compiles: `npx astro check` — b80f627
- [x] 2.2 Lint passes: `npm run lint` — b80f627
- [x] 2.3 Build succeeds: `npm run build` — b80f627

#### Manual

- [x] 2.4 POST /api/generations returns flashcard proposals with valid text — b80f627
- [x] 2.5 POST /api/generations returns 401 without auth — b80f627
- [x] 2.6 POST /api/generations returns 400 for empty or oversized text — b80f627

### Phase 3: Generation Page & Review Interface

#### Automated

- [x] 3.1 TypeScript compiles: `npx astro check`
- [x] 3.2 Lint passes: `npm run lint`
- [x] 3.3 Build succeeds: `npm run build`

#### Manual

- [x] 3.4 Full happy path: paste → generate → review → accept/edit/reject → save → verify in DB
- [x] 3.5 Bulk "accept all" works and enables save button
- [x] 3.6 Rejecting all cards shows appropriate save feedback
- [x] 3.7 Editing card front/back persists correctly after save
- [x] 3.8 Unauthenticated access to /generate redirects to sign-in
- [x] 3.9 Character counter enforces 10,000 char limit
- [x] 3.10 Error state shows message with retry button on LLM failure
- [x] 3.11 "Generate" link appears in topbar for authenticated users only
