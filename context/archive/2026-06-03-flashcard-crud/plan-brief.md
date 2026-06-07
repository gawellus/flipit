# Flashcard CRUD — Plan Brief

> Full plan: `context/changes/flashcard-crud/plan.md`

## What & Why

Build flashcard management (S-02, PRD FR-005–FR-008): manual card creation, collection browsing with text search, inline editing, and deletion. This is the second vertical slice — with S-01 (AI generation) done, users can create cards via AI but have no way to manage their collection, create cards manually, or fix mistakes. This slice closes that gap.

## Starting Point

S-01 is complete. The `flashcards` table exists with RLS, types are defined (`Flashcard`, `CreateFlashcardInput`), and a `createFlashcards()` DAL function handles batch inserts. The API has a POST endpoint for saving AI-generated cards. The `FlashcardItem` React component has an inline edit mode. No collection page or browsing UI exists — the dashboard is a stub.

## Desired End State

A logged-in user navigates to `/flashcards` from the Topbar, sees their paginated flashcard collection (newest first, 20 per page), searches by text across front/back content, creates manual cards via an inline form, edits any card inline, and deletes cards with an inline confirmation step. Each card shows a source badge (AI/Manual).

## Key Decisions Made

| Decision       | Choice                                 | Why (1 sentence)                                                                                |
| -------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Collection URL | Dedicated `/flashcards` page           | Clean separation from dashboard; easy to link from nav and post-generation flow.                |
| Create UX      | Inline collapsible form at top of list | No navigation away from list, fast for adding multiple cards, reuses existing textarea styling. |
| Edit UX        | Inline editing in the list             | Zero navigation, familiar pattern from S-01's FlashcardItem component.                          |
| Search         | Server-side ILIKE with debounce        | Scales beyond client-side filtering; works with pagination.                                     |
| Delete UX      | Inline confirm button (3s timeout)     | Fast, no modal overhead, no extra shadcn components needed.                                     |
| Pagination     | Offset-based (page/pageSize)           | Bounded transfer size; works naturally with server-side search.                                 |
| Sort order     | Newest first (created_at DESC)         | Users see latest additions first — natural for a growing collection.                            |
| Source filter  | No filter for now                      | Simpler UI; not in PRD requirements; easy to add later.                                         |

## Scope

**In scope:**

- Manual flashcard creation (front/back, source: "manual")
- Paginated collection browsing (20/page, offset-based)
- Server-side text search (ILIKE on front + back, debounced 300ms)
- Inline editing of front/back text
- Inline delete with confirmation
- Source badge display (AI/Manual)
- Empty states (no cards, no search results)
- Topbar navigation link
- `updated_at` auto-update trigger (addresses known lesson)

**Out of scope:**

- Source filter dropdown
- Bulk operations (multi-select delete/edit)
- Card detail page
- Drag-and-drop reordering
- Full-text search (tsvector/GIN)
- Import/export
- Dashboard redesign

## Architecture / Approach

Three-layer stack following S-01 patterns: DAL functions in `src/lib/services/flashcards.ts` → API route handlers (GET/POST/PATCH/DELETE) in `src/pages/api/flashcards.ts` → Astro page at `/flashcards` mounting a `FlashcardsView` React island with `client:load`. Search and pagination are server-side (query params → Supabase ILIKE + range). Create/edit/delete trigger API calls from React components and refresh the list.

## Phases at a Glance

| Phase                   | What it delivers                                                                       | Key risk                                |
| ----------------------- | -------------------------------------------------------------------------------------- | --------------------------------------- |
| 1. Data Access Layer    | List (paginated+search), update, delete DAL functions + `updated_at` trigger migration | Low — standard Supabase queries         |
| 2. API Endpoints        | GET/PATCH/DELETE handlers + POST update for manual create                              | Low — follows established route pattern |
| 3. Collection Page & UI | `/flashcards` page with search, create form, list, edit, delete, pagination            | Medium — most code, UX integration      |

**Prerequisites:** S-01 complete (flashcards table, types, base DAL, existing POST endpoint)
**Estimated effort:** ~2-3 sessions across 3 phases

## Open Risks & Assumptions

- ILIKE search does a sequential scan within the user's card subset — acceptable at MVP scale but may need a trigram index if collections grow large
- Inline confirm delete has no undo — acceptable tradeoff for simplicity; user sees the confirm step before deletion
- `updated_at` trigger is the first use of a Postgres trigger function in this project — low risk but verify it fires correctly

## Success Criteria (Summary)

- User can create, browse, search, edit, and delete flashcards from the `/flashcards` page
- AI-generated and manually created cards coexist in the same collection with correct source badges
- Pagination and search work together (search resets to page 1, pagination within search results)
