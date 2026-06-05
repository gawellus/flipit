# Study Session with Spaced Repetition — Implementation Plan

## Overview

Implement per-collection study sessions with spaced repetition using ts-fsrs. Users create collections to organize flashcards, then study due cards in a session that presents cards one-by-one with flip-to-reveal and 4-point rating (Again/Hard/Good/Easy). Ratings feed the FSRS algorithm to schedule optimal review intervals. This is the S-03 north-star milestone that closes FlipIt's full product loop: paste text → generate cards → organize into collections → study with SR scheduling → rate recall.

## Current State Analysis

- **Flashcards table** exists with full CRUD (S-02): id, user_id, generation_id, front, back, source, created_at, updated_at
- **No collections, no SR state, no review logging** — all additive work
- **Established patterns**: Zod-validated API routes (`src/pages/api/flashcards.ts`), service layer (`src/lib/services/flashcards.ts`), discriminated-union state machines (`src/components/generate/GenerateView.tsx`), shadcn/ui components
- **ts-fsrs** selected and confirmed compatible across all dimensions (research docs)

### Key Discoveries:

- API routes follow: `prerender = false` → auth check via `context.locals.user` → Zod `.safeParse()` → `createClient()` → service call → structured error response (`src/pages/api/flashcards.ts:49-107`)
- Service functions take `(supabase: SupabaseClient, userId: string, ...)` and throw `NotFoundError` for 404s (`src/lib/services/flashcards.ts:70-92`)
- React containers use discriminated unions: `type State = { step: "input" } | { step: "loading" } | ...` with explicit handler functions per transition (`src/components/generate/GenerateView.tsx:6-14`)
- RLS policies filter on `user_id = auth.uid()` at row level — new tables need their own policies following this pattern (`supabase/migrations/20260602120000_create_flashcards.sql:15-31`)
- `set_updated_at()` trigger function already exists and can be reused for new tables (`supabase/migrations/20260604120000_add_updated_at_trigger.sql`)
- shadcn/ui available: Button (6 variants), Card (with sub-components), Badge, Input, Textarea, Label
- `PROTECTED_ROUTES` array in `src/middleware.ts:4` needs `/study` added
- ts-fsrs `CardInput` accepts plain objects from DB rows — no hydration needed; `DateInput` accepts ISO strings — compatible with Supabase

## Desired End State

Users can organize flashcards into named collections and study them using spaced repetition. The study session presents due cards one at a time: the user sees the front (question), flips to reveal the back (answer), then rates their recall with four buttons showing preview intervals. The FSRS algorithm schedules optimal review timing per card. A study landing page shows all collections with due-card counts. When no cards are due, the user sees when the next review is scheduled.

To verify:

1. Create a collection, assign cards, start study → cards appear in due order
2. Rate cards → due dates update according to FSRS algorithm (Again = minutes, Easy = days)
3. Return later → only actually-due cards appear
4. All caught up → shows next due date with encouragement

## What We're NOT Doing

- Custom SR algorithm — using ts-fsrs library with default research-backed parameters
- Optimizer/parameter training — default FSRS params are sufficient for MVP
- Collection sharing or collaboration
- Card reordering within sessions (due-date order)
- Study statistics/analytics dashboard
- Rollback/undo rating (ts-fsrs supports it, but out of MVP scope)
- Modifying the existing generate flow to auto-create collections
- Review log retention policy or pruning

## Implementation Approach

Additive-only across 4 phases: schema → collections backend+UI → study backend → study UI. Each phase is independently testable and builds on the previous. ts-fsrs runs client-side for interval previews (pure computation, ~microseconds) and server-side for authoritative state updates. The scheduler is stateless — created per-request with `fsrs()`, matching Astro's per-request API model.

## Critical Implementation Details

### Auto-creation of SR state rows

Every flashcard must have a corresponding `flashcard_sr_state` row for the study queue to work. Rather than relying on application code across multiple creation paths (AI generation, manual create, future import), a database trigger on flashcards INSERT automatically creates the SR state row. This is the only reliable way to guarantee the invariant, and it's non-obvious because the existing codebase has no AFTER INSERT triggers — only the BEFORE UPDATE trigger for `updated_at`.

### Client-side previews, server-side commits

ts-fsrs `repeat()` previews all 4 rating outcomes — this runs client-side to show interval labels on buttons without an extra API call. The actual `next()` call that updates card state runs server-side in the review API route, ensuring the DB is the single source of truth. The client preview and server commit may produce slightly different timestamps (seconds apart), which is harmless — the server result is authoritative.

---

## Phase 1: Database Schema & Migrations

### Overview

Create the collections table, flashcard_sr_state join table, review_logs table, add collection_id to flashcards, set up indexes/RLS/triggers, and bootstrap SR state for all existing flashcards.

### Changes Required:

#### 1. Collections & SR Schema Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_create_collections_and_sr_tables.sql`

**Intent**: Create all new tables and columns needed for collections and spaced repetition. Follows existing migration patterns (RLS enabled, user-scoped policies, indexes, triggers).

**Contract**:

Tables and columns:

- `collections` table: `id` (uuid PK default gen_random_uuid()), `user_id` (uuid NOT NULL FK → auth.users ON DELETE CASCADE), `name` (text NOT NULL), `created_at` (timestamptz NOT NULL default now()), `updated_at` (timestamptz NOT NULL default now())
- `flashcards.collection_id`: new nullable uuid column FK → collections(id) ON DELETE SET NULL
- `flashcard_sr_state` table: `flashcard_id` (uuid PK FK → flashcards ON DELETE CASCADE), `user_id` (uuid NOT NULL FK → auth.users ON DELETE CASCADE), plus all ts-fsrs Card fields with defaults matching `createEmptyCard()`:
  - `difficulty` (float NOT NULL default 0), `due` (timestamptz NOT NULL default now()), `elapsed_days` (integer NOT NULL default 0), `lapses` (integer NOT NULL default 0), `last_review` (timestamptz — nullable), `learning_steps` (integer NOT NULL default 0), `reps` (integer NOT NULL default 0), `scheduled_days` (integer NOT NULL default 0), `stability` (float NOT NULL default 0), `state` (smallint NOT NULL default 0)
  - `created_at` (timestamptz NOT NULL default now()), `updated_at` (timestamptz NOT NULL default now())
- `review_logs` table: `id` (uuid PK default gen_random_uuid()), `flashcard_id` (uuid NOT NULL FK → flashcards ON DELETE CASCADE), `user_id` (uuid NOT NULL FK → auth.users ON DELETE CASCADE), plus ts-fsrs ReviewLog fields:
  - `rating` (smallint NOT NULL), `state` (smallint NOT NULL), `difficulty` (float NOT NULL), `stability` (float NOT NULL), `due` (timestamptz NOT NULL), `elapsed_days` (integer NOT NULL), `last_elapsed_days` (integer NOT NULL), `scheduled_days` (integer NOT NULL), `learning_steps` (integer NOT NULL), `review` (timestamptz NOT NULL)
  - `created_at` (timestamptz NOT NULL default now())

RLS policies (all use `user_id = auth.uid()`):

- `collections`: SELECT, INSERT, UPDATE, DELETE
- `flashcard_sr_state`: SELECT, INSERT, UPDATE, DELETE
- `review_logs`: SELECT, INSERT only (append-only — no UPDATE or DELETE)

Indexes:

- `idx_collections_user_id` on collections(user_id)
- `idx_flashcards_collection_id` on flashcards(collection_id)
- `idx_flashcard_sr_state_user_due` on flashcard_sr_state(user_id, due) — the hot study-queue index
- `idx_review_logs_user_flashcard` on review_logs(user_id, flashcard_id)

Triggers:

- Reuse existing `set_updated_at()` function for collections and flashcard_sr_state updated_at triggers
- No updated_at on review_logs (append-only)

Auto-create SR state on flashcard insert (non-obvious — see Critical Implementation Details):

```sql
CREATE OR REPLACE FUNCTION create_sr_state_on_flashcard_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO flashcard_sr_state (flashcard_id, user_id)
  VALUES (NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER flashcards_create_sr_state
  AFTER INSERT ON flashcards
  FOR EACH ROW
  EXECUTE FUNCTION create_sr_state_on_flashcard_insert();
```

#### 2. Bootstrap SR State Migration

**File**: `supabase/migrations/YYYYMMDDHHMMSS_bootstrap_sr_state.sql`

**Intent**: Populate SR state for all existing flashcards so they appear as "new" cards (state=0, due=now()) in the study queue immediately. Separate migration for clarity and safe re-runnability.

**Contract**: `INSERT INTO flashcard_sr_state (flashcard_id, user_id) SELECT id, user_id FROM flashcards WHERE id NOT IN (SELECT flashcard_id FROM flashcard_sr_state)` — idempotent, safe to re-run. All defaults from the table definition apply (state=0/New, due=now()).

#### 3. Extended Types

**File**: `src/types.ts`

**Intent**: Add TypeScript interfaces for the new database entities: collections, SR state, review logs, and study-session DTOs.

**Contract**: New interfaces:

- `Collection` — id, user_id, name, created_at, updated_at
- `CollectionWithCounts` — extends Collection with card_count (number) and due_count (number)
- `FlashcardSRState` — flashcard_id, user_id, plus all ts-fsrs Card fields (typed as number/string matching DB columns)
- `ReviewLog` — id, flashcard_id, user_id, plus all ts-fsrs ReviewLog fields, created_at
- `StudyCard` — id, front, back, plus SR state fields (flattened from join query)
- `IntervalPreview` — rating (number), label (string, e.g., "10m", "1d", "3d")

Leave existing `Flashcard` interface unchanged — SR state is a separate entity in the join table.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly against local Supabase: `npx supabase db reset`
- TypeScript types compile: `npm run lint`
- Existing flashcard CRUD still works (no regressions from new column/trigger)

#### Manual Verification:

- Verify all four tables exist in Supabase Studio with correct columns, types, and constraints
- Verify RLS policies work: query as user A cannot see user B's data across all new tables
- Verify flashcard_sr_state rows exist for all pre-existing flashcards after bootstrap migration
- Verify creating a new flashcard auto-creates its SR state row (via AFTER INSERT trigger)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Collections Backend & Minimal UI

### Overview

Service layer, API routes, and minimal React UI for managing collections — create, list, delete, and assign flashcards to collections. Just enough to support per-collection study in Phase 4.

### Changes Required:

#### 1. Collections Service

**File**: `src/lib/services/collections.ts`

**Intent**: Data access functions for collections, following the same pattern as `src/lib/services/flashcards.ts` (SupabaseClient as first param, throw on errors, return typed data).

**Contract**:

- `createCollection(supabase, userId, name: string)` → `Collection` — insert + select, throw on error
- `listCollections(supabase, userId)` → `CollectionWithCounts[]` — select collections with card_count and due_count computed via subqueries or joins against flashcards and flashcard_sr_state
- `deleteCollection(supabase, userId, collectionId: string)` → `void` — delete with `PGRST116` check → throw NotFoundError (same pattern as `flashcards.ts:94-109`)

#### 2. Collections API Route

**File**: `src/pages/api/collections.ts`

**Intent**: CRUD API for collections following the established route pattern (`prerender = false`, auth check via `context.locals.user`, Zod validation, service call, structured error response).

**Contract**:

- `POST`: body `{ name: string }` (Zod: name is non-empty string, trimmed), returns 201 + Collection
- `GET`: no params, returns 200 + `CollectionWithCounts[]`
- `DELETE`: query param `id` (uuid), returns 200 on success. Cards get `collection_id = NULL` via ON DELETE SET NULL — no application-level cleanup needed

#### 3. Update Flashcards API for Collection Assignment

**File**: `src/pages/api/flashcards.ts`

**Intent**: Allow setting `collection_id` when creating or updating a flashcard.

**Contract**: Extend existing PATCH Zod schema to accept optional `collection_id` (uuid string | null). Update the existing `.refine()` constraint to also accept collection_id-only updates (`data.front != null || data.back != null || data.collection_id !== undefined`). Extend POST schema similarly. Pass through to flashcards service — no special validation needed beyond uuid format (FK constraint handles existence check).

#### 4. Update Flashcards Service

**File**: `src/lib/services/flashcards.ts`

**Intent**: Support `collection_id` in create and update operations.

**Contract**: Add `collection_id` to the insert/update data mapping in `createFlashcards` and `updateFlashcard`. Accept as optional parameter. No changes to list or delete functions.

#### 5. Collections UI Component

**File**: `src/components/collections/CollectionsView.tsx`

**Intent**: Container component showing the user's collections with card counts and due counts. Follows `FlashcardsView` pattern (fetch on mount, loading/error/empty states, useCallback for refresh).

**Contract**:

- Fetches `GET /api/collections` on mount
- Displays each collection as a shadcn Card with: name, card count badge, due count badge, "Study" link → `/study/[id]`
- "Create Collection" button opens a simple inline form or dialog (name input + submit)
- Delete button per collection with confirmation
- Empty state: "No collections yet — create one to start organizing your flashcards"

#### 6. Collection Assignment in FlashcardsView

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Allow users to assign existing flashcards to collections from the flashcards list.

**Contract**: Add a collection selector (dropdown or button menu) per flashcard that calls `PATCH /api/flashcards` with `collection_id`. Collections list fetched once on mount and shared across all card components. Selected collection shown as a badge on the card.

#### 7. Study Landing Page

**File**: `src/pages/study.astro`

**Intent**: Astro page that renders the CollectionsView as a React island for the study entry point.

**Contract**: Follows `src/pages/generate.astro` pattern — Layout + Topbar + `<CollectionsView client:load />`. Route: `/study`.

#### 8. Protected Route Registration

**File**: `src/middleware.ts`

**Intent**: Add `/study` to the `PROTECTED_ROUTES` array so unauthenticated users are redirected to sign-in.

**Contract**: Add `"/study"` string to the `PROTECTED_ROUTES` array at `src/middleware.ts:4`.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- Collections CRUD works via API calls against dev server

#### Manual Verification:

- Create a collection via UI, see it listed with 0 cards / 0 due
- Assign flashcards to a collection from the flashcards page, see card count update on /study
- Delete a collection, verify cards still exist in flashcards list (now unassigned)
- /study page shows collections with correct due counts
- Unauthenticated access to /study redirects to sign-in

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Study Session Backend

### Overview

Install ts-fsrs, create the study service layer with due-card queries and review processing, and add API routes for session fetch and review submission.

### Changes Required:

#### 1. Install ts-fsrs

**Command**: `npm install ts-fsrs`

**Intent**: Add the spaced repetition scheduling library as a production dependency.

**Contract**: ts-fsrs has zero dependencies. Verify it resolves in both server (Astro API routes) and client (React components) contexts after install.

#### 2. Study Service

**File**: `src/lib/services/study.ts`

**Intent**: Core study logic — fetching due cards for a collection and processing reviews using ts-fsrs. Follows the service pattern from `src/lib/services/flashcards.ts`.

**Contract**:

- `getDueCards(supabase, userId, collectionId: string)` → `StudyCard[]` — query joins flashcards + flashcard_sr_state WHERE `flashcards.collection_id = collectionId` AND `flashcard_sr_state.due <= now()` ORDER BY `due ASC`. Returns card content + SR state fields needed by ts-fsrs `CardInput`.
- `getNextDueDate(supabase, userId, collectionId: string)` → `string | null` — `MIN(flashcard_sr_state.due)` WHERE `flashcards.collection_id = collectionId` AND `flashcard_sr_state.due > now()`. Returns ISO timestamp or null if no future reviews scheduled.
- `processReview(supabase, userId, flashcardId: string, rating: number)` → `{ card: FlashcardSRState; log: ReviewLog }` — loads current SR state from flashcard_sr_state, creates `fsrs()` scheduler, calls `scheduler.next(cardState, new Date(), rating)`, persists updated card state (UPDATE flashcard_sr_state) and review log (INSERT review_logs). Verifies flashcard belongs to user before processing.

The scheduler is created per-call with `fsrs()` (stateless, default params). `CardInput` from ts-fsrs accepts plain objects, so the DB row fields map directly — no hydration layer needed.

#### 3. Study Session API Route

**File**: `src/pages/api/study/[id].ts`

**Intent**: GET endpoint returning due cards for a collection, following established route patterns.

**Contract**:

- `GET /api/study/[collection_id]`: `prerender = false`, auth check, validate `id` param as uuid via Zod, call `getDueCards` + `getNextDueDate`, return `{ cards: StudyCard[], nextDue: string | null }`
- Verify the collection belongs to the current user (query includes user_id filter — returns empty if wrong user, not an error)

#### 4. Review API Route

**File**: `src/pages/api/study/review.ts`

**Intent**: POST endpoint that processes a card rating and persists the SR state update + review log.

**Contract**:

- `POST /api/study/review`: `prerender = false`, auth check, Zod validation `{ flashcard_id: string (uuid), rating: number (1|2|3|4) }`, call `processReview`, return 200 + `{ card: FlashcardSRState }`
- Rating values map to ts-fsrs: 1=Again, 2=Hard, 3=Good, 4=Easy
- Returns 404 if flashcard not found or doesn't belong to user

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`
- ts-fsrs imports resolve correctly in the study service

#### Manual Verification:

- `GET /api/study/[collection_id]` returns due cards with SR state for a collection with assigned cards
- `POST /api/study/review` with rating=3 (Good) returns updated SR state with future due date
- Subsequent GET shows the reviewed card no longer in the due list (its due date is in the future)
- review_logs table has a new row with correct rating, state, and timestamps
- flashcard_sr_state row has updated difficulty, stability, due, reps, state fields
- Rating 1 (Again) produces a short interval (minutes); Rating 4 (Easy) produces a long interval (days)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Study Session UI

### Overview

React study session component with a discriminated-union state machine managing the full study flow: loading → studying (flip + rate) → complete. Includes card flip animation, rating buttons with interval previews computed client-side via ts-fsrs `repeat()`, and empty/complete state screens.

### Changes Required:

#### 1. Study Session View

**File**: `src/components/study/StudySessionView.tsx`

**Intent**: Main container component managing the full study session flow. Follows the `GenerateView` state machine pattern — discriminated union state, explicit handler functions, conditional rendering per step.

**Contract**: State machine type:

- `{ step: "loading" }` — fetching due cards from API
- `{ step: "empty"; nextDue: string | null }` — no cards due, show when to return
- `{ step: "studying"; cards: StudyCard[]; currentIndex: number; flipped: boolean }` — active study
- `{ step: "complete"; reviewedCount: number; nextDue: string | null }` — session finished
- `{ step: "error"; message: string }` — fetch or review failed

Props: `collectionId: string`

Flow:

- On mount: fetch `GET /api/study/[collectionId]`, transition to `studying` (if cards) or `empty` (if none)
- `handleFlip()`: toggle `flipped` to true, compute interval previews via `scheduler.repeat(currentCard, new Date())` client-side
- `handleRate(rating)`: `POST /api/study/review`, advance `currentIndex`, reset `flipped`. On last card: fetch next due date, transition to `complete`
- `handleRetry()`: transition back to `loading`, re-fetch

#### 2. Flashcard Display Component

**File**: `src/components/study/FlashcardDisplay.tsx`

**Intent**: Presentational component showing a flashcard with flip interaction. Uses shadcn Card as the visual container.

**Contract**:

- Props: `front: string`, `back: string`, `flipped: boolean`, `onFlip: () => void`
- Front side: card question text + "Show Answer" button
- Back side: card answer text (visible after flip)
- CSS transition on flip using `transform: rotateY(180deg)` with `perspective` and `backface-visibility: hidden` for 3D effect

#### 3. Rating Buttons Component

**File**: `src/components/study/RatingButtons.tsx`

**Intent**: Four rating buttons (Again/Hard/Good/Easy) with next-review interval labels computed from ts-fsrs previews.

**Contract**:

- Props: `previews: IntervalPreview[]`, `onRate: (rating: number) => void`, `disabled: boolean`
- Four buttons, one per rating, each showing label + interval (e.g., "Good · 10m")
- Button variants: destructive for Again, outline for Hard, default for Good, secondary for Easy
- Disabled while review API call is in flight

#### 4. Session Empty & Complete Screens

**Files**: `src/components/study/SessionEmpty.tsx`, `src/components/study/SessionComplete.tsx`

**Intent**: Empty state ("All caught up!") and completion state ("Session complete!") as simple presentational components.

**Contract**:

- `SessionEmpty`: props `nextDue: string | null`. Shows encouraging message + relative time until next review (e.g., "Next review in 3 hours"). Link to `/flashcards` to add more cards. If `nextDue` is null, prompt to assign cards to this collection.
- `SessionComplete`: props `reviewedCount: number`, `nextDue: string | null`. Shows count of cards reviewed + next due time. Links back to `/study` (collection list).

#### 5. Study Session Page

**File**: `src/pages/study/[id].astro`

**Intent**: Astro page that extracts the collection ID from the URL and renders StudySessionView as a React island.

**Contract**: Follows `src/pages/generate.astro` pattern — Layout + Topbar + `<StudySessionView client:load collectionId={Astro.params.id} />`. Dynamic route: `/study/[id]`.

#### 6. Navigation Update

**File**: `src/components/Topbar.astro`

**Intent**: Add "Study" link to the top navigation bar so users can access study sessions from any page.

**Contract**: Add a nav link to `/study` alongside existing Dashboard/Generate/Flashcards links.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Navigate to `/study`, see collections with due counts
- Click a collection with due cards → study session starts, first card front visible
- Click "Show Answer" → card flips with animation to show back side
- See 4 rating buttons with interval preview labels (different intervals per rating)
- Rate a card → next card appears (front side), previous card gone
- After rating last card → session complete screen with reviewed count and next due time
- Start a session for a collection with no due cards → empty state with next due date
- Rate a card as Again → short interval shown; rate as Easy → long interval shown
- Topbar shows "Study" link, navigates to `/study`
- No regressions in existing flashcard CRUD, generation, or auth flows
- Layout is usable on desktop viewport (not mobile-optimized, but not broken)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No existing test infrastructure — not required for MVP
- ts-fsrs scheduler logic in study service is a strong candidate for future unit tests (deterministic pure functions)

### Integration Tests:

- API endpoint testing via curl or HTTP client during each phase
- Full flow: create collection → assign cards → start session → rate all cards → verify updated schedule

### Manual Testing Steps:

1. Create a new flashcard → verify `flashcard_sr_state` row auto-created (via Supabase Studio)
2. Create a collection, assign 3-5 cards to it
3. Start study session → verify all assigned due cards appear in order
4. Rate first card as Again → verify it appears due again soon (1-10 minutes per FSRS)
5. Rate second card as Easy → verify long interval (multiple days)
6. Complete session → verify summary shows correct count
7. Revisit `/study` → verify due counts updated for the collection
8. Wait for a short-interval card to become due → verify it appears in next session
9. Delete a collection → verify cards survive in flashcards list (unassigned), SR state preserved

## Performance Considerations

- Study queue query uses composite index `(user_id, due)` on flashcard_sr_state — efficient for the `WHERE user_id = ? AND due <= now() ORDER BY due ASC` pattern
- ts-fsrs `repeat()` is a pure computation (~microseconds per call) — safe to run client-side per card without performance concern
- Cards are fetched all-at-once for a collection (no pagination) — acceptable for typical collection sizes (5-50 due cards per session)
- If collections grow very large (500+ due cards), consider server-side batching in a future iteration

## Migration Notes

- Bootstrap migration inserts one `flashcard_sr_state` row per existing flashcard — one-time data migration, idempotent
- AFTER INSERT trigger on flashcards handles all future card creations automatically
- Existing flashcards API is extended (not replaced) with optional `collection_id` — backward-compatible
- `collection_id` on flashcards is nullable — existing cards start unassigned, no data backfill needed for collections
- Deleting a collection sets `collection_id = NULL` on its cards (ON DELETE SET NULL) — no orphaned data

## References

- Compatibility research: `context/changes/sr-study-session/research.md`
- Library comparison: `context/changes/sr-study-session/research-sr-libraries.md`
- ts-fsrs API reference: `context/changes/sr-study-session/research-ts-fsrs-api.md`
- API route pattern: `src/pages/api/flashcards.ts:49-107`
- State machine pattern: `src/components/generate/GenerateView.tsx:6-14`
- Service layer pattern: `src/lib/services/flashcards.ts`
- Trigger pattern: `supabase/migrations/20260604120000_add_updated_at_trigger.sql`
- PRD requirements: `context/foundation/prd.md` — FR-009, FR-010

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Database Schema & Migrations

#### Automated

- [x] 1.1 Migration applies cleanly: `npx supabase db reset` — dd6b83b
- [x] 1.2 TypeScript types compile: `npm run lint` — dd6b83b
- [x] 1.3 Existing flashcard CRUD still works — dd6b83b

#### Manual

- [x] 1.4 Tables exist in Supabase Studio with correct columns/types — dd6b83b
- [x] 1.5 RLS policies enforce user isolation across all new tables — dd6b83b
- [x] 1.6 flashcard_sr_state rows exist for pre-existing flashcards after bootstrap — dd6b83b
- [x] 1.7 New flashcard auto-creates SR state row via trigger — dd6b83b

### Phase 2: Collections Backend & Minimal UI

#### Automated

- [x] 2.1 Linting passes: `npm run lint`
- [x] 2.2 Build succeeds: `npm run build`
- [x] 2.3 Collections CRUD works via API

#### Manual

- [x] 2.4 Create, list, delete collections in UI
- [x] 2.5 Assign flashcards to collections from flashcards page
- [ ] 2.6 /study page shows collections with correct due counts
- [x] 2.7 Delete collection preserves cards (unassigned)
- [x] 2.8 Unauthenticated /study redirects to sign-in

### Phase 3: Study Session Backend

#### Automated

- [ ] 3.1 Linting passes: `npm run lint`
- [ ] 3.2 Build succeeds: `npm run build`
- [ ] 3.3 ts-fsrs imports resolve

#### Manual

- [ ] 3.4 GET /api/study/[id] returns due cards with SR state
- [ ] 3.5 POST /api/study/review processes rating and returns updated state
- [ ] 3.6 SR state and review log persisted correctly after rating
- [ ] 3.7 Different ratings produce different scheduling intervals

### Phase 4: Study Session UI

#### Automated

- [ ] 4.1 Linting passes: `npm run lint`
- [ ] 4.2 Build succeeds: `npm run build`

#### Manual

- [ ] 4.3 Study session flow works end-to-end (flip → rate → next card)
- [ ] 4.4 Rating buttons show correct interval previews
- [ ] 4.5 Empty state shows next due date
- [ ] 4.6 Session complete shows reviewed count and next due date
- [ ] 4.7 No regressions in existing features (CRUD, generation, auth)
