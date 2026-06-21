# Bulk Flashcard Actions Implementation Plan

## Overview

Add multi-select capability to the flashcards list view with two bulk actions: delete multiple flashcards and change collection for multiple flashcards. Single-card actions (edit, delete, collection change) remain available when no cards are selected.

## Current State Analysis

The flashcards list (`FlashcardsView.tsx`) renders a paginated list (10 per page) of `FlashcardListItem` components. Each card exposes individual edit, delete, and collection-change actions. Delete uses a 3-second inline confirmation with undo countdown. There is no multi-select, no checkboxes, and no bulk operations anywhere in the flashcard list.

The API layer (`src/pages/api/flashcards.ts`) supports single-item DELETE (`{ id }`) and single-item PATCH (`{ id, ...updates }`). No bulk endpoints exist. The service layer mirrors this — one card at a time.

A bulk action pattern exists in `FlashcardReview.tsx` (the AI generation review flow) — it renders an action bar with count display, select-all/deselect-all toggle, collection picker, and save button. This pattern will inform the bulk toolbar design but operates on in-memory proposals, not persisted paginated data.

### Key Discoveries:

- `CollectionPicker` component (`src/components/collections/CollectionPicker.tsx`) is already shared across three views — reusable as-is in the bulk toolbar
- No `Checkbox` shadcn component installed — needs `npx shadcn@latest add checkbox`
- RLS policies scope all operations to `auth.uid()` — bulk operations are safe without extra auth logic
- CASCADE FKs on `flashcard_sr_state` and `review_logs` mean bulk delete automatically cleans up SR state and review history
- The existing `FlashcardReview.tsx:100-121` action bar is the visual template for the bulk toolbar

## Desired End State

The user sees a checkbox on each flashcard card in the list view. Clicking any checkbox reveals a sticky toolbar above the list showing "N selected", a "Select all" / "Deselect all" toggle, a collection picker for bulk move, and a "Delete (N)" button. Bulk delete shows a confirmation dialog. After a bulk action completes, selection clears and the list refreshes. Per-card edit/delete icons are hidden while any cards are selected to avoid conflicting interactions. Selection clears on page navigation or search change.

To verify: open the flashcards page with 5+ cards, select 2-3 via checkboxes, see the toolbar appear, use "Move" to change their collection, then select different cards and delete them with the confirmation dialog.

## What We're NOT Doing

- Cross-page selection (selection is page-scoped, clears on navigation)
- Bulk edit of front/back content (only collection change and delete)
- Drag-and-drop reordering
- Keyboard shortcuts for selection (Shift+click range select, Ctrl+A)
- Undo for bulk delete (using confirmation dialog instead)

## Implementation Approach

Three phases in strict dependency order: (1) service + API layer for bulk operations, (2) UI selection state and toolbar, (3) confirmation dialog and API integration. The API extends existing endpoints via Zod discriminated union (single `{ id }` vs. bulk `{ ids: [] }`) rather than creating new routes.

---

## Phase 1: Service + API Layer

### Overview

Add bulk delete and bulk collection-update service functions, then extend the existing DELETE and PATCH API handlers to accept arrays of IDs alongside the current single-ID schemas.

### Changes Required:

#### 1. Bulk service functions

**File**: `src/lib/services/flashcards.ts`

**Intent**: Add `deleteFlashcards` that deletes multiple flashcards by ID array, and `updateFlashcardsCollection` that updates `collection_id` for multiple flashcards. Both must scope to `user_id` for security (matching existing single-card patterns).

**Contract**:

- `deleteFlashcards(supabase, userId, ids: string[]): Promise<number>` — returns count of deleted rows. Uses `.in("id", ids).eq("user_id", userId)`. No `NotFoundError` for bulk — silently skips IDs that don't exist or don't belong to the user.
- `updateFlashcardsCollection(supabase, userId, ids: string[], collectionId: string | null): Promise<number>` — returns count of updated rows. Uses `.in("id", ids).eq("user_id", userId)`.

#### 2. Bulk Zod schemas

**File**: `src/pages/api/flashcards.ts`

**Intent**: Add `BulkDeleteSchema` and `BulkUpdateCollectionSchema` to validate bulk requests. Update the DELETE and PATCH handlers to try bulk schema first, then fall back to the existing single-item schema.

**Contract**:

- `BulkDeleteSchema`: `{ ids: z.array(z.uuid()).min(1).max(50) }`
- `BulkUpdateCollectionSchema`: `{ ids: z.array(z.uuid()).min(1).max(50), collection_id: z.uuid().nullable() }`
- DELETE handler: try `BulkDeleteSchema.safeParse(body)` — if valid, call `deleteFlashcards`. Otherwise try `DeleteFlashcardSchema.safeParse(body)` — if valid, call existing `deleteFlashcard`. If neither parses, return 400.
- PATCH handler: try `BulkUpdateCollectionSchema.safeParse(body)` — if valid, call `updateFlashcardsCollection`. Otherwise try `UpdateFlashcardSchema.safeParse(body)` — if valid, call existing `updateFlashcard`. If neither parses, return 400.
- Bulk DELETE returns `{ deleted_count: number }`. Bulk PATCH returns `{ updated_count: number }`.

#### 3. Export new service functions

**File**: `src/pages/api/flashcards.ts` (import line)

**Intent**: Add imports for the two new service functions.

**Contract**: Import `deleteFlashcards` and `updateFlashcardsCollection` from `@/lib/services/flashcards`.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Send bulk DELETE request via curl/REST client with `{ ids: ["<uuid1>", "<uuid2>"] }` — returns `{ deleted_count: 2 }`
- Send single DELETE request `{ id: "<uuid>" }` — still works as before (backwards compatible)
- Send bulk PATCH request `{ ids: ["<uuid1>", "<uuid2>"], collection_id: "<collection-uuid>" }` — returns `{ updated_count: 2 }`
- Send single PATCH request `{ id: "<uuid>", front: "new text" }` — still works as before
- Send bulk DELETE with non-existent IDs — returns `{ deleted_count: 0 }`, no error
- Auth guard: send requests without auth cookie — returns 401

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: UI — Selection State + Bulk Toolbar

### Overview

Add always-visible checkboxes to each flashcard card, a select-all checkbox header, selection state management in `FlashcardsView`, and a sticky bulk action toolbar that appears when any cards are selected. Per-card edit/delete icons are hidden while selection is active.

### Changes Required:

#### 1. Install shadcn Checkbox

**Intent**: Add the Checkbox primitive from shadcn/ui for use in the flashcard list.

**Contract**: Run `npx shadcn@latest add checkbox`. This creates `src/components/ui/checkbox.tsx`.

#### 2. Add selection state and handlers to FlashcardsView

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Track which flashcard IDs are selected on the current page. Provide toggle, select-all, and clear-all handlers. Clear selection whenever `page`, `search`, or `refreshKey` changes. Pass `isSelected` and `onToggleSelect` to each `FlashcardListItem`. Render a `BulkActionBar` when `selectedIds.size > 0`.

**Contract**:

- New state: `selectedIds: Set<string>` (via `useState<Set<string>>(new Set())`).
- `toggleSelect(id: string)` — add or remove from set.
- `selectAll()` — add all current-page flashcard IDs.
- `deselectAll()` — clear the set.
- Clear `selectedIds` in the same `useEffect` that fetches cards (when `page`, `search`, or `refreshKey` change).
- Pass `isSelected={selectedIds.has(card.id)}`, `onToggleSelect={() => toggleSelect(card.id)}`, and `hasSelection={selectedIds.size > 0}` to each `FlashcardListItem`.
- Render select-all checkbox row above the flashcard list (below search, above cards). Show a master checkbox and "N selected" / "Select all (M)" text.
- Render `<BulkActionBar>` (new component) between the select-all row and the card list when `selectedIds.size > 0`.

#### 3. Add checkbox and selection props to FlashcardListItem

**File**: `src/components/flashcards/FlashcardListItem.tsx`

**Intent**: Show a checkbox on the left of each card. When `hasSelection` is true, hide the per-card edit/delete icons (the bulk toolbar is the action surface). The checkbox is always visible regardless of selection state.

**Contract**:

- New props: `isSelected: boolean`, `onToggleSelect: () => void`, `hasSelection: boolean`.
- Render a `<Checkbox>` in the left column of the card, before the content area.
- When `hasSelection` is true, hide the edit (Pencil) and delete (Trash2) icon buttons and the `CollectionPicker`. Also prevent entering `"editing"` or `"confirming-delete"` modes.
- Clicking the checkbox calls `onToggleSelect`. Clicking the card body does NOT toggle selection (checkbox only).

#### 4. Create BulkActionBar component

**File**: `src/components/flashcards/BulkActionBar.tsx` (new file)

**Intent**: A sticky toolbar that shows the selection count, a collection picker for bulk move, and a delete button. Visually matches the `FlashcardReview.tsx` action bar pattern.

**Contract**:

- Props: `selectedCount: number`, `collections: Collection[]`, `onMove: (collectionId: string | null) => void`, `onDelete: () => void`, `isLoading: boolean`.
- Layout: horizontal bar with border and shadow (matching `FlashcardReview` style). Left: "N selected" text. Center: `CollectionPicker` + "Move" button. Right: destructive "Delete (N)" button.
- `sticky top-0 z-10` positioning so it stays visible while scrolling.
- "Move" and "Delete" buttons are disabled when `isLoading` is true.

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Each flashcard card shows a checkbox on the left
- Clicking a checkbox selects/deselects the card (visual highlight)
- Selecting any card reveals the bulk action toolbar above the list
- The toolbar shows the correct selected count
- "Select all" checkbox selects all cards on the current page
- Deselecting all cards hides the toolbar
- Navigating to another page clears the selection
- Typing in search clears the selection
- Per-card edit/delete icons are hidden when any card is selected
- Per-card edit/delete icons reappear when selection is cleared

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Confirmation Dialog + API Integration

### Overview

Wire up the bulk toolbar actions to the API. Add a confirmation dialog for bulk delete. Handle loading and error states. Refresh the list and clear selection after successful mutations.

### Changes Required:

#### 1. Install shadcn AlertDialog

**Intent**: Add the AlertDialog primitive from shadcn/ui for the bulk delete confirmation.

**Contract**: Run `npx shadcn@latest add alert-dialog`. This creates `src/components/ui/alert-dialog.tsx`.

#### 2. Add bulk API call handlers to FlashcardsView

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Add `handleBulkDelete` and `handleBulkMove` async functions that call the bulk API endpoints, clear selection, and refresh the list on success. Show errors inline.

**Contract**:

- `handleBulkDelete()`: sends `DELETE /api/flashcards` with `{ ids: Array.from(selectedIds) }`. On success, clear `selectedIds`, reset `page` to 1, and call `refresh()`. On error, set an error message.
- `handleBulkMove(collectionId: string | null)`: sends `PATCH /api/flashcards` with `{ ids: Array.from(selectedIds), collection_id: collectionId }`. On success, clear `selectedIds` and call `refresh()`. On error, set an error message.
- Track `isBulkLoading: boolean` state to disable buttons during API calls.

#### 3. Add confirmation dialog for bulk delete

**File**: `src/components/flashcards/BulkActionBar.tsx`

**Intent**: When the user clicks "Delete (N)", show an AlertDialog asking "Delete N flashcards? This cannot be undone." with Cancel and Delete buttons. Only call `onDelete` when the user confirms.

**Contract**:

- The BulkActionBar manages the AlertDialog open/close state internally.
- "Delete (N)" button opens the dialog instead of calling `onDelete` directly.
- Dialog confirm button calls `onDelete` and closes the dialog.
- Dialog uses destructive styling for the confirm button.

#### 4. Wire BulkActionBar to handlers

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Pass the bulk handlers and loading state to `BulkActionBar`.

**Contract**: `<BulkActionBar selectedCount={selectedIds.size} collections={collections} onMove={handleBulkMove} onDelete={handleBulkDelete} isLoading={isBulkLoading} />`

### Success Criteria:

#### Automated Verification:

- TypeScript compiles: `npx tsc --noEmit`
- Linting passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Select 2+ cards, click "Delete (N)" → confirmation dialog appears
- Cancel the dialog → nothing happens, selection preserved
- Confirm the dialog → cards are deleted, list refreshes, selection clears
- Select 2+ cards, pick a collection from the picker, click "Move" → cards move to the new collection, list refreshes, selection clears
- Bulk move to "No collection" → cards are unassigned from their collection
- During a bulk operation, toolbar buttons are disabled (loading state)
- If a bulk operation fails (e.g., network error), an error message appears and selection is preserved
- Single-card delete (via individual card's trash icon) still works when no cards are selected
- Single-card collection change (via individual card's picker) still works when no cards are selected

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Zod schema validation for `BulkDeleteSchema` (valid array, empty array rejected, >50 items rejected, non-UUID rejected)
- Zod schema validation for `BulkUpdateCollectionSchema` (valid array + collection_id, null collection_id accepted)
- Backwards compatibility: existing `DeleteFlashcardSchema` and `UpdateFlashcardSchema` still parse correctly
- Bulk service functions: extend the mock helper in `flashcards.test.ts` to include `"in"` in its chainable methods list before writing `deleteFlashcards` and `updateFlashcardsCollection` tests

### Manual Testing Steps:

1. Open flashcards page with 10+ cards across 2+ pages
2. Select 3 cards on page 1, verify toolbar shows "3 selected"
3. Click "Select all" — all 10 cards on page 1 are selected
4. Navigate to page 2 — selection clears, toolbar disappears
5. Select 2 cards, bulk delete with confirmation — cards removed, count updates
6. Select 3 cards, bulk move to a different collection — cards show new collection
7. Select cards, type in search — selection clears
8. Deselect all cards — per-card edit/delete icons reappear
9. Edit a single card (no selection active) — editing still works normally
10. Delete a single card (no selection active) — 3-second confirm still works normally

## Performance Considerations

- Bulk operations use `.in("id", ids)` which generates a single SQL query — no N+1 issue
- Max 50 IDs per bulk request (Zod-enforced) prevents oversized queries
- Selection state is a `Set<string>` scoped to the current page (max 10 items) — negligible memory

## References

- Roadmap entry: `context/foundation/roadmap.md` lines 118-128 (S-05)
- FlashcardReview toolbar pattern: `src/components/generate/FlashcardReview.tsx:100-121`
- Existing single-delete flow: `src/components/flashcards/FlashcardListItem.tsx:71-104`
- API schemas: `src/pages/api/flashcards.ts:7-49`
- Service layer: `src/lib/services/flashcards.ts:95-110`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Service + API Layer

#### Automated

- [x] 1.1 TypeScript compiles: `npx tsc --noEmit`
- [x] 1.2 Linting passes: `npm run lint`
- [x] 1.3 Build succeeds: `npm run build`

#### Manual

- [ ] 1.4 Bulk DELETE returns `{ deleted_count }` for valid IDs
- [ ] 1.5 Single DELETE still works (backwards compatible)
- [ ] 1.6 Bulk PATCH returns `{ updated_count }` for collection change
- [ ] 1.7 Single PATCH still works (backwards compatible)
- [ ] 1.8 Auth guard returns 401 without cookie

### Phase 2: UI — Selection State + Bulk Toolbar

#### Automated

- [ ] 2.1 TypeScript compiles: `npx tsc --noEmit`
- [ ] 2.2 Linting passes: `npm run lint`
- [ ] 2.3 Build succeeds: `npm run build`

#### Manual

- [ ] 2.4 Checkboxes visible on each flashcard card
- [ ] 2.5 Clicking a checkbox selects/deselects the card
- [ ] 2.6 Selecting any card reveals the bulk action toolbar
- [ ] 2.7 Toolbar shows the correct selected count
- [ ] 2.8 Select-all checkbox selects all cards on current page
- [ ] 2.9 Deselecting all cards hides the toolbar
- [ ] 2.10 Page navigation clears selection
- [ ] 2.11 Search clears selection
- [ ] 2.12 Per-card edit/delete hidden when any card is selected
- [ ] 2.13 Per-card edit/delete reappear when selection is cleared

### Phase 3: Confirmation Dialog + API Integration

#### Automated

- [ ] 3.1 TypeScript compiles: `npx tsc --noEmit`
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Build succeeds: `npm run build`

#### Manual

- [ ] 3.4 Bulk delete shows confirmation dialog and deletes on confirm
- [ ] 3.5 Cancel delete dialog preserves selection
- [ ] 3.6 Bulk move changes collection for selected cards
- [ ] 3.7 Bulk move to "No collection" unassigns cards
- [ ] 3.8 Loading state disables toolbar buttons during API call
- [ ] 3.9 Error state shown on API failure, selection preserved
- [ ] 3.10 Single-card delete works when no selection active
- [ ] 3.11 Single-card collection change works when no selection active
