# Flashcard CRUD Implementation Plan

## Overview

Build flashcard management (S-02): a logged-in user can manually create flashcards, browse their collection with server-side text search and offset-based pagination, edit cards inline, and delete cards with inline confirmation. All on a new `/flashcards` page with a Topbar navigation link. Maps to PRD FR-005, FR-006, FR-007, FR-008.

## Current State Analysis

S-01 (AI flashcard generation) is complete. The `flashcards` table exists with RLS, types are defined, and a `createFlashcards()` DAL function handles batch inserts. The existing API routes follow a consistent pattern: Zod validation, auth guard via `context.locals.user`, Supabase client per-request, and JSON error responses.

### Key Discoveries:

- Schema already supports manual cards — `source` column has check constraint for `'ai'` or `'manual'`, and `generation_id` is nullable (`src/types.ts:1-10`, `supabase/migrations/20260602120000_create_flashcards.sql`)
- DAL only has `createFlashcards()` — no read/update/delete functions (`src/lib/services/flashcards.ts:4-28`)
- `FlashcardItem.tsx` has a working inline edit mode with front/back textareas, save/cancel buttons — directly reusable for the edit flow (`src/components/generate/FlashcardItem.tsx:54-83`)
- Existing POST `/api/flashcards` hardcodes `source: "ai"` — manual create needs either a new endpoint or an update to this one (`src/pages/api/flashcards.ts:59`)
- No Dialog/AlertDialog shadcn components installed — but inline confirm pattern avoids needing them
- Topbar links are hardcoded in `src/components/Topbar.astro:12-23` — easy to add a `/flashcards` link
- `updated_at` column has no auto-update trigger (known lesson from `context/foundation/lessons.md`) — update operations must set it explicitly in the DAL or via a migration adding the trigger

## Desired End State

A logged-in user navigates to `/flashcards` from the Topbar, sees their flashcard collection in a paginated list (newest first, 20 per page), can search by typing in a search input (debounced ILIKE query against front and back text), create a new card via an inline form at the top, edit any card inline, and delete a card with an inline confirmation step. Each card shows front/back text and a source badge (AI/Manual). After the generate flow, the user can navigate to `/flashcards` to manage their collection.

### How to verify:

1. Sign in, see "Flashcards" link in Topbar, navigate to `/flashcards`
2. See empty state if no cards, or paginated list if cards exist
3. Create a manual card via the inline form — it appears at the top of the list with source "manual"
4. Edit a card inline — front/back update persists after page refresh
5. Delete a card — inline confirm, card disappears, count updates
6. Search — typing filters cards by front/back content with server-side query
7. Pagination — next/prev buttons work, page state reflected in URL or component state
8. Unauthenticated access to `/flashcards` redirects to sign-in

## What We're NOT Doing

- **No source filter** — all cards shown together; source badge is informational only
- **No bulk operations** — no multi-select delete or bulk edit
- **No card detail page** — all interaction is inline in the list
- **No drag-and-drop reordering** — sort is fixed (newest first)
- **No import/export** — PRD non-goal
- **No full-text search (tsvector)** — simple ILIKE is sufficient for MVP
- **No Dashboard redesign** — dashboard stays as-is; collection lives at `/flashcards`

## Implementation Approach

Three phases in dependency order: (1) extend the DAL with list/update/delete functions, (2) build GET/PATCH/DELETE API endpoints plus update the existing POST for manual create, (3) build the `/flashcards` page with React components for the collection UI. Each phase is independently testable.

## Critical Implementation Details

### `updated_at` trigger

Per `context/foundation/lessons.md`, the `updated_at` column lacks a `BEFORE UPDATE` trigger. Phase 1 adds a migration for this trigger so that update operations automatically refresh the timestamp. Without this, `updated_at` would silently retain the creation timestamp after edits.

---

## Phase 1: Data Access Layer

### Overview

Extend `src/lib/services/flashcards.ts` with list (paginated + search), update, and delete functions. Add a migration for the `updated_at` auto-update trigger. Add any new types needed for pagination.

### Changes Required:

#### 1. Migration: `updated_at` auto-update trigger

**File**: `supabase/migrations/<timestamp>_add_updated_at_trigger.sql`

**Intent**: Add a `BEFORE UPDATE` trigger on the `flashcards` table that sets `updated_at = now()` on every row update. Addresses the lesson from `context/foundation/lessons.md`.

**Contract**: Create a reusable function `set_updated_at()` that sets `NEW.updated_at = now()` and returns `NEW`. Create trigger `flashcards_set_updated_at` on `flashcards` table, `BEFORE UPDATE`, `FOR EACH ROW`.

#### 2. Pagination types

**File**: `src/types.ts`

**Intent**: Define shared types for paginated list responses used by the flashcards API and UI components.

**Contract**: Export `PaginatedResponse<T>` with fields: `data: T[]`, `page: number`, `pageSize: number`, `totalCount: number`, `totalPages: number`.

#### 3. List flashcards function

**File**: `src/lib/services/flashcards.ts`

**Intent**: Fetch a paginated, optionally searched list of a user's flashcards, sorted newest first.

**Contract**: `listFlashcards(supabase, userId, options: { page: number; pageSize: number; search?: string }) → Promise<PaginatedResponse<Flashcard>>`. When `search` is provided, escape ILIKE wildcards (`%` → `\%`, `_` → `\_`) in the search term before wrapping in `%...%`, then filter where `front ILIKE %search%` OR `back ILIKE %search%`. Use Supabase's `.range()` for offset pagination and a count query for total. Order by `created_at` DESC.

#### 4. Update flashcard function

**File**: `src/lib/services/flashcards.ts`

**Intent**: Update the front and/or back text of a single flashcard owned by the user.

**Contract**: `updateFlashcard(supabase, userId, flashcardId: string, updates: { front?: string; back?: string }) → Promise<Flashcard>`. Uses `.update().eq('id', flashcardId).eq('user_id', userId).select().single()`. Throws if no row matched (card not found or not owned by user).

#### 5. Delete flashcard function

**File**: `src/lib/services/flashcards.ts`

**Intent**: Hard-delete a single flashcard owned by the user.

**Contract**: `deleteFlashcard(supabase, userId, flashcardId: string) → Promise<void>`. Uses `.delete().eq('id', flashcardId).eq('user_id', userId).select().single()`. The `.select().single()` chain ensures PostgREST throws a PGRST116 error when 0 rows match (card not found or not owned by user), matching the `updateFlashcard` pattern.

### Success Criteria:

#### Automated Verification:

- Migration applies cleanly: `npx supabase db push` or local `npx supabase db reset`
- TypeScript compiles: `npm run lint` passes with no type errors on new functions
- DAL functions have correct signatures and handle error cases

#### Manual Verification:

- Verify `updated_at` trigger fires by updating a row in Supabase dashboard and checking the timestamp changes
- Verify list function returns correct pagination metadata with sample data

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: API Endpoints

### Overview

Build GET, PATCH, and DELETE endpoints for flashcards. Update the existing POST endpoint to support manual card creation (not just AI-generated saves).

### Changes Required:

#### 1. GET endpoint — list flashcards

**File**: `src/pages/api/flashcards.ts`

**Intent**: Add a GET handler that returns the authenticated user's flashcards with pagination and optional search. Follows the existing POST pattern for auth and error handling.

**Contract**: Export `GET: APIRoute`. Query params: `page` (default 1), `pageSize` (default 20, max 100), `search` (optional string, max 200 chars). Validate with Zod via `z.object()` on parsed query params. Returns `PaginatedResponse<Flashcard>` as JSON with status 200. Auth guard returns 401. Validation failure returns 400.

#### 2. PATCH endpoint — update flashcard

**File**: `src/pages/api/flashcards.ts`

**Intent**: Add a PATCH handler that updates a single flashcard's front/back text.

**Contract**: Export `PATCH: APIRoute`. Request body: `{ id: string (uuid), front?: string, back?: string }` — at least one of front/back required. Zod schema validates UUID format and string lengths (1-2000 chars). Calls `updateFlashcard()` DAL function. Returns updated `Flashcard` as JSON with status 200. Returns 404 if card not found or not owned by user.

#### 3. DELETE endpoint — delete flashcard

**File**: `src/pages/api/flashcards.ts`

**Intent**: Add a DELETE handler that removes a single flashcard.

**Contract**: Export `DELETE: APIRoute`. Request body: `{ id: string (uuid) }`. Zod validates UUID. Calls `deleteFlashcard()` DAL function. Returns `{ success: true }` with status 200. Returns 404 if card not found or not owned by user.

#### 4. Update POST endpoint for manual create

**File**: `src/pages/api/flashcards.ts`

**Intent**: Extend the existing POST handler to support manual card creation alongside AI-generated saves. Currently hardcodes `source: "ai"` and requires `generation_id`.

**Contract**: Update `SaveFlashcardsSchema` to make `generation_id` optional. Add an optional `source` field (`"ai" | "manual"`, default `"ai"`). When `source` is `"manual"`, `generation_id` should be absent/null. When `source` is `"ai"`, `generation_id` is required. Use Zod `.refine()` or `.superRefine()` for this conditional validation.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes with no type errors
- All endpoints return correct status codes for valid and invalid requests
- Auth guard returns 401 for unauthenticated requests on all endpoints

#### Manual Verification:

- GET `/api/flashcards` returns paginated list with correct metadata
- GET `/api/flashcards?search=term` filters cards correctly
- GET `/api/flashcards?page=2&pageSize=5` returns correct page
- PATCH updates card and `updated_at` timestamp changes
- DELETE removes card, second DELETE returns 404
- POST with `source: "manual"` creates card without `generation_id`
- POST with `source: "ai"` still works as before (backwards compatible)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Collection Page & UI Components

### Overview

Build the `/flashcards` page as an Astro page with a React island for the interactive collection view. Includes search input, inline create form, paginated flashcard list with inline edit and delete, and pagination controls. Add navigation link in Topbar.

### Changes Required:

#### 1. Topbar navigation link

**File**: `src/components/Topbar.astro`

**Intent**: Add a "Flashcards" link to the authenticated navigation, between "Generate" and "Dashboard".

**Contract**: Add `<a href="/flashcards">` in the authenticated nav section, same styling as existing links (`text-purple-300 transition-colors hover:text-purple-100 hover:underline`).

#### 2. Protected route registration

**File**: `src/middleware.ts`

**Intent**: Add `/flashcards` to the protected routes array so unauthenticated users are redirected to sign-in.

**Contract**: Add `"/flashcards"` to the `PROTECTED_ROUTES` array at line 4.

#### 3. Flashcards Astro page

**File**: `src/pages/flashcards.astro`

**Intent**: Server-rendered page shell that mounts the React collection island. Follows the same pattern as `generate.astro`.

**Contract**: Import Layout + Topbar. Render `<FlashcardsView client:load />` inside a max-width container. Page requires authentication (handled by middleware).

#### 4. FlashcardsView — main collection React component

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Top-level React component managing collection state: fetching cards, search, pagination, create, edit, delete. Acts as the state orchestrator (similar to `GenerateView`).

**Contract**: Manages state for `flashcards: Flashcard[]`, `page`, `totalPages`, `totalCount`, `search`, `isLoading`, `error`. On mount and on search/page change, calls GET `/api/flashcards` with query params. Renders: `SearchInput` → `CreateFlashcardForm` → `FlashcardList` → `PaginationControls`. Passes callbacks for edit/delete that call PATCH/DELETE endpoints and refresh the list.

#### 5. SearchInput component

**File**: `src/components/flashcards/SearchInput.tsx`

**Intent**: Debounced text input for search. Resets page to 1 on search change.

**Contract**: Props: `value: string`, `onChange: (value: string) => void`. Uses shadcn `Input` component. Debounces onChange by 300ms using a `useEffect` + `setTimeout` pattern. Placeholder: "Search flashcards...".

#### 6. CreateFlashcardForm component

**File**: `src/components/flashcards/CreateFlashcardForm.tsx`

**Intent**: Collapsible inline form for manually creating a new flashcard. Appears at the top of the collection.

**Contract**: Props: `onCreated: () => void` (callback to refresh list after successful create). Toggle button "Add flashcard" shows/hides the form. Form has front/back Textareas (same styling as FlashcardItem edit mode), character count (max 2000), and Save/Cancel buttons. On save, POST to `/api/flashcards` with `source: "manual"`, single-item flashcards array, no `generation_id`. On success, clear form, collapse, call `onCreated`. On error, show inline error message.

#### 7. FlashcardListItem component

**File**: `src/components/flashcards/FlashcardListItem.tsx`

**Intent**: Display a single flashcard in the collection with view/edit/delete modes. Inspired by `FlashcardItem.tsx` from S-01 but adapted for CRUD (no accept/reject, adds delete).

**Contract**: Props: `flashcard: Flashcard`, `onUpdated: () => void`, `onDeleted: () => void`. Three modes: `view` (default), `editing`, `confirming-delete`. View mode shows front/back text, source badge (AI/Manual), Edit and Delete buttons. Edit mode: inline front/back textareas with Save/Cancel (calls PATCH endpoint). Delete mode: Delete button changes to red "Confirm delete?" for 3 seconds, auto-reverts to normal Delete on timeout. On confirm, calls DELETE endpoint. Uses Card, CardContent, Button, Badge, Textarea from shadcn.

#### 8. PaginationControls component

**File**: `src/components/flashcards/PaginationControls.tsx`

**Intent**: Simple prev/next pagination with page indicator.

**Contract**: Props: `page: number`, `totalPages: number`, `onPageChange: (page: number) => void`. Shows "Page X of Y" with Previous/Next buttons. Previous disabled on page 1, Next disabled on last page. Uses Button component with variant="outline".

#### 9. Empty state

**File**: Within `FlashcardsView.tsx`

**Intent**: Show a friendly message when the collection is empty (no cards at all, or no search results).

**Contract**: When `totalCount === 0` and no search active: "No flashcards yet. Create one manually or generate from text." with links to the create form toggle and `/generate`. When search active and no results: "No flashcards match your search."

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes
- `npm run build` succeeds (SSR build, Cloudflare adapter)
- No TypeScript errors in new components

#### Manual Verification:

- Navigate to `/flashcards` from Topbar — page loads, shows cards or empty state
- Create a manual flashcard — form validates, card appears in list with "Manual" badge
- Edit a card — inline edit mode, save persists, cancel reverts
- Delete a card — inline confirm, card removed from list
- Search — typing filters results after debounce, clearing search shows all cards
- Pagination — navigate between pages, page indicator updates
- Empty states — correct messages for no cards vs. no search results
- Generate flow → Flashcards — after generating and saving cards, they appear in the collection
- Unauthenticated user redirected to sign-in
- Responsive layout — page is usable on desktop widths (no mobile-first requirement per PRD)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- DAL functions: list with pagination, list with search, update, delete, error cases (not found, empty updates)
- Zod schemas: valid/invalid inputs for each endpoint

### Integration Tests:

- Full API round-trip: create → list → search → update → delete
- Pagination: correct page boundaries, total count accuracy
- Auth: all endpoints reject unauthenticated requests

### Manual Testing Steps:

1. Sign in, navigate to `/flashcards` — see empty state
2. Create 2-3 manual cards — verify they appear newest-first
3. Go to `/generate`, create AI cards — verify they show in `/flashcards` with "AI" badge
4. Search for a specific word — verify only matching cards appear
5. Edit a card's front text — refresh page, verify change persists
6. Delete a card — verify it's gone after refresh
7. Create 25+ cards, verify pagination shows 2+ pages and navigation works
8. Open a private/incognito window, try `/flashcards` — verify redirect to sign-in

## Performance Considerations

- Server-side ILIKE search with debounce (300ms) prevents excessive API calls
- Pagination limits transfer to 20 cards per request
- Index on `user_id` (existing) handles the WHERE clause; ILIKE on `front`/`back` does a sequential scan within the user's cards — acceptable for small-to-medium collections
- If collections grow large, adding a GIN trigram index (`pg_trgm`) on front/back would optimize ILIKE — deferred to post-MVP

## Migration Notes

- New migration adds `updated_at` trigger — non-destructive, applies to existing table
- POST `/api/flashcards` schema change is backwards-compatible: `generation_id` becomes optional, `source` defaults to `"ai"`
- No data migration needed — existing AI-generated cards already have correct `source` and `generation_id` values

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD requirements: FR-005, FR-006, FR-007, FR-008
- S-01 plan: `context/changes/ai-flashcard-generation/plan.md`
- Existing DAL: `src/lib/services/flashcards.ts`
- Existing API: `src/pages/api/flashcards.ts`
- UI pattern reference: `src/components/generate/FlashcardItem.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Access Layer

#### Automated

- [x] 1.1 Migration applies cleanly — 844864b
- [x] 1.2 TypeScript compiles with no type errors on new functions — 844864b
- [x] 1.3 DAL functions have correct signatures and handle error cases — 844864b

#### Manual

- [x] 1.4 Verify updated_at trigger fires on row update — 844864b
- [x] 1.5 Verify list function returns correct pagination metadata — 844864b

### Phase 2: API Endpoints

#### Automated

- [x] 2.1 npm run lint passes with no type errors — db8e7c7
- [x] 2.2 All endpoints return correct status codes — db8e7c7
- [x] 2.3 Auth guard returns 401 for unauthenticated requests — db8e7c7

#### Manual

- [x] 2.4 GET /api/flashcards returns paginated list — 7f2d0da
- [x] 2.5 GET /api/flashcards?page=2&pageSize=5 returns correct page — 7f2d0da
- [x] 2.6 GET /api/flashcards?search=term filters correctly — 7f2d0da
- [x] 2.7 PATCH updates card and updated_at changes — 7f2d0da
- [x] 2.8 DELETE removes card, second DELETE returns 404 — 7f2d0da
- [x] 2.9 POST with source manual creates card without generation_id — 7f2d0da
- [x] 2.10 POST with source ai still works (backwards compatible) — 7f2d0da

### Phase 3: Collection Page & UI Components

#### Automated

- [x] 3.1 npm run lint passes — 7f2d0da
- [x] 3.2 npm run build succeeds — 7f2d0da
- [x] 3.3 No TypeScript errors in new components — 7f2d0da

#### Manual

- [x] 3.4 Navigate to /flashcards from Topbar — 7f2d0da
- [x] 3.5 Create manual flashcard via inline form — 7f2d0da
- [x] 3.6 Edit card inline — save persists, cancel reverts — 7f2d0da
- [x] 3.7 Delete card with inline confirmation — 7f2d0da
- [x] 3.8 Search filters results after debounce — 7f2d0da
- [x] 3.9 Pagination navigation works correctly — 7f2d0da
- [x] 3.10 Empty states display correctly — 7f2d0da
- [x] 3.11 AI-generated cards appear in collection after generate flow — 7f2d0da
- [x] 3.12 Unauthenticated user redirected to sign-in — 7f2d0da
