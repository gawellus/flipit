# Bulk Flashcard Actions — Plan Brief

> Full plan: `context/changes/bulk-flashcard-actions/plan.md`

## What & Why

Add multi-select with bulk delete and bulk collection-change to the flashcards list view. Currently each flashcard can only be deleted or moved one at a time — users with large collections need a faster way to manage multiple cards. This is the last remaining slice (S-05) on the roadmap.

## Starting Point

The flashcards list (`FlashcardsView.tsx`) renders a paginated list (10/page) of `FlashcardListItem` components with per-card edit, delete (3-second inline confirm), and collection picker. The API supports single-item DELETE and PATCH only. A bulk action toolbar pattern exists in `FlashcardReview.tsx` (the AI generation review flow) but operates on in-memory proposals, not persisted data. No Checkbox component is installed.

## Desired End State

Each flashcard card shows a checkbox. Selecting any card reveals a sticky toolbar with "N selected", a collection picker + Move button, and a Delete button. Bulk delete shows a confirmation dialog. Selection is page-scoped (clears on navigation/search). Per-card edit/delete icons hide during active selection to prevent conflicting interactions.

## Key Decisions Made

| Decision           | Choice                                 | Why (1 sentence)                                                                         |
| ------------------ | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Selection scope    | Page-scoped, clear on navigate/search  | Simple mental model — user acts on what they see; avoids complex cross-page state sync.  |
| Mode entry         | Always-visible checkboxes              | Zero-friction discovery — users see the affordance immediately (Gmail/Notion pattern).   |
| Select-all         | Master checkbox in header row          | Standard pattern users expect; fast for "act on everything on this page".                |
| Bulk delete UX     | Confirmation dialog with count         | Higher stakes than single-card delete warrants an explicit confirm step.                 |
| API shape          | Extend existing DELETE/PATCH endpoints | Keeps API surface small — Zod discriminated union distinguishes single vs bulk by shape. |
| Action coexistence | Hide per-card actions during selection | Avoids conflicting interactions (e.g., editing a card selected for deletion).            |
| Toolbar position   | Sticky bar above the list              | Prominent, accessible, matches FlashcardReview action bar pattern.                       |

## Scope

**In scope:**

- Checkboxes on each flashcard card + select-all header
- Sticky bulk action toolbar (count, move, delete)
- Bulk delete with confirmation dialog
- Bulk collection change via collection picker
- Bulk service functions + extended API endpoints (max 50 IDs)

**Out of scope:**

- Cross-page selection
- Bulk edit of front/back content
- Keyboard shortcuts (Shift+click, Ctrl+A)
- Drag-and-drop reordering
- Undo for bulk delete

## Architecture / Approach

Extend existing endpoints via Zod schema discrimination (`{ id }` for single, `{ ids: [] }` for bulk). Service layer uses Supabase `.in("id", ids)` for single-query bulk operations. UI adds `selectedIds: Set<string>` state to `FlashcardsView`, passes selection props to `FlashcardListItem`, and renders a new `BulkActionBar` component modeled after `FlashcardReview`'s action bar. `AlertDialog` (shadcn) handles delete confirmation.

## Phases at a Glance

| Phase                         | What it delivers                                        | Key risk                                                                  |
| ----------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1. Service + API Layer        | Bulk delete/move service functions + extended endpoints | Backwards compatibility — existing single-item calls must still work      |
| 2. UI: Selection + Toolbar    | Checkboxes, selection state, select-all, bulk toolbar   | Interaction between selection mode and existing per-card actions          |
| 3. Confirmation + Integration | Delete dialog, API wiring, loading/error states         | Edge cases: network errors mid-bulk, empty selection after partial delete |

**Prerequisites:** S-02 (flashcard CRUD) — done. S-04 (collection assignment) — done. shadcn Checkbox and AlertDialog components need installing.
**Estimated effort:** ~1-2 sessions across 3 phases.

## Open Risks & Assumptions

- Max 50 IDs per bulk request is assumed sufficient (current page size is 10, so practical max is 10 per action)
- Bulk delete silently skips non-existent IDs rather than returning 404 — acceptable for this use case

## Success Criteria (Summary)

- User can select multiple flashcards via checkboxes and bulk-delete them with a confirmation dialog
- User can select multiple flashcards and bulk-change their collection via a picker in the toolbar
- Single-card operations (edit, delete, collection change) continue working when no selection is active
