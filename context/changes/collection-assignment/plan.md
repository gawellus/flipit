# Collection Assignment Across Flows — Implementation Plan

## Overview

Add collection assignment to the two remaining flows where flashcards are created (AI generation save, manual create) and unify all three assignment points behind a shared `CollectionPicker` component. Cards can be assigned to a collection at creation time instead of requiring a separate edit step.

## Current State Analysis

Collections infrastructure is fully built: `collections` table with RLS, `flashcards.collection_id` FK (nullable, ON DELETE SET NULL), CRUD API, types, and management UI on `/study`. Study sessions are already collection-scoped.

Collection assignment exists in **one of three** creation/edit flows:

- **FlashcardListItem** (view mode) — raw `<select>` dropdown that PATCHes `collection_id` on change. Works, but not extracted as a reusable component.
- **FlashcardReview** (AI generation) — no collection picker. Cards save with `collection_id: null`.
- **CreateFlashcardForm** (manual create) — no collection picker. Cards save with `collection_id: null`.

The POST `/api/flashcards` endpoint does not accept `collection_id` — the Zod schema (`SaveFlashcardsSchema`) and the `CreateFlashcardInput` type both lack it. The service layer (`createFlashcards`) maps inputs without `collection_id`.

### Key Discoveries:

- `SaveFlashcardsSchema` at `src/pages/api/flashcards.ts:7-27` — needs `collection_id` field
- `CreateFlashcardInput` at `src/types.ts:18-23` — needs optional `collection_id`
- `createFlashcards` at `src/lib/services/flashcards.ts:5-29` — row mapping needs `collection_id`
- `FlashcardListItem` at `src/components/flashcards/FlashcardListItem.tsx:191-202` — raw `<select>` to extract
- `FlashcardReview` at `src/components/generate/FlashcardReview.tsx:73-85` — sticky toolbar where picker goes
- `CreateFlashcardForm` at `src/components/flashcards/CreateFlashcardForm.tsx` — form needs picker before Save button
- `FlashcardsView` at `src/components/flashcards/FlashcardsView.tsx:36-49` — already fetches collections for the list items

## Desired End State

All three flashcard creation/edit flows offer a collection picker:

- **AI generation**: a single dropdown in the sticky review toolbar assigns all accepted cards to the chosen collection on save.
- **Manual create**: a dropdown in the create form assigns the new card on creation.
- **Edit/view**: the existing per-card dropdown uses the same shared component.

The POST `/api/flashcards` endpoint accepts an optional `collection_id` so cards are assigned atomically at creation time. No post-creation PATCH needed. All three pickers use the same `CollectionPicker` React component.

## What We're NOT Doing

- No inline "create new collection" option in the picker — users create collections on `/study` page first
- No "remember last-used collection" or persisted default — picker defaults to "None" every time
- No per-card collection assignment during AI generation — one picker applies to all accepted cards
- No changes to collection CRUD, study sessions, or SR scheduling
- No bulk assignment (that's S-05)

## Implementation Approach

Three phases in dependency order: (1) backend accepts `collection_id` on create, (2) extract shared `CollectionPicker` component, (3) wire the picker into all three flows. Each phase is independently testable.

## Phase 1: Backend — Accept collection_id on create

### Overview

Add optional `collection_id` to the flashcard creation path so cards can be assigned at insert time.

### Changes Required:

#### 1. Add collection_id to CreateFlashcardInput type

**File**: `src/types.ts`

**Intent**: Add optional `collection_id` field to `CreateFlashcardInput` so the service layer can accept it.

**Contract**: `collection_id?: string` added to the `CreateFlashcardInput` interface.

#### 2. Add collection_id to SaveFlashcardsSchema

**File**: `src/pages/api/flashcards.ts`

**Intent**: Allow the POST payload to include an optional `collection_id` UUID that applies to all cards in the batch.

**Contract**: Add `collection_id: z.uuid().nullable().optional()` to `SaveFlashcardsSchema`. The field is at the top level (sibling of `generation_id`), not per-card — matching the "one picker for all" decision.

#### 3. Thread collection_id through the POST handler

**File**: `src/pages/api/flashcards.ts`

**Intent**: Pass `collection_id` from the validated payload into each card object sent to `createFlashcards`.

**Contract**: The `cards` mapping (line 90-95) includes `collection_id: validation.data.collection_id ?? null`.

#### 4. Include collection_id in service insert

**File**: `src/lib/services/flashcards.ts`

**Intent**: Include `collection_id` in the Supabase insert rows so cards are assigned at creation time.

**Contract**: The row mapping in `createFlashcards` adds `collection_id: card.collection_id ?? null`.

#### 5. Update existing tests for collection_id

**File**: `src/lib/services/flashcards.test.ts`

**Intent**: The `createFlashcards` insert assertion (line 46-48) asserts the exact payload shape without `collection_id`. Adding `collection_id` to the row mapping will break it. Update to expect the new field.

**Contract**: Update the `.insert()` assertion to include `collection_id: null` in the expected row object.

**File**: `src/pages/api/flashcards.test.ts`

**Intent**: `SaveFlashcardsSchema` tests don't cover the new `collection_id` field. Add coverage for valid UUID, null, and invalid UUID.

**Contract**: Add 3 tests to the `SaveFlashcardsSchema` describe block: (1) passes with valid `collection_id` UUID, (2) passes with `collection_id: null`, (3) fails with invalid `collection_id` string.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`
- Existing tests updated and passing (`npm test`): `createFlashcards` insert assertion includes `collection_id: null`, `SaveFlashcardsSchema` tests cover valid UUID, null, and invalid `collection_id`
- POST `/api/flashcards` with `{ source: "manual", collection_id: "<uuid>", flashcards: [...] }` creates cards with the specified `collection_id`
- POST without `collection_id` still creates cards with `collection_id: null` (backward compatible)

#### Manual Verification:

- Existing flashcard creation (generate + manual) still works without passing `collection_id`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shared CollectionPicker component

### Overview

Extract the collection dropdown pattern into a reusable `CollectionPicker` component that all three flows will use.

### Changes Required:

#### 1. Create CollectionPicker component

**File**: `src/components/collections/CollectionPicker.tsx`

**Intent**: A controlled select component that renders the list of collections with a "None" option. Accepts `collections`, `value` (current collection_id or null), and `onChange` callback.

**Contract**: Props interface:

```tsx
interface CollectionPickerProps {
  collections: Collection[];
  value: string | null;
  onChange: (collectionId: string | null) => void;
}
```

Renders a styled `<select>` matching the existing dark theme pattern from `FlashcardListItem.tsx:191-202` (border-white/20, bg-white/5, text-xs, text-white). Includes a "None" option with empty string value, maps to `null` on change.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Component renders correctly (verified in Phase 3 integration)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Wire CollectionPicker into all three flows

### Overview

Add the `CollectionPicker` to the AI generation review toolbar and manual create form. Replace the raw `<select>` in `FlashcardListItem` with the shared component.

### Changes Required:

#### 1. Add picker to FlashcardReview (AI generation)

**File**: `src/components/generate/FlashcardReview.tsx`

**Intent**: Add a `CollectionPicker` to the review action bar so all accepted cards are saved to the selected collection.

**Contract**: Component fetches collections via `GET /api/collections` on mount. Holds `selectedCollectionId` state (default: `null`). Picker renders inside the `actionBar` JSX variable (between the count label `<span>` and the buttons `<div>`). The action bar is rendered twice (top and bottom of the card list) — since it's a shared JSX variable, the picker will appear in both locations automatically. `handleSave` includes `collection_id: selectedCollectionId` in the POST payload.

#### 2. Add picker to CreateFlashcardForm (manual create)

**File**: `src/components/flashcards/CreateFlashcardForm.tsx`

**Intent**: Add a `CollectionPicker` to the manual create form so the new card is assigned on creation.

**Contract**: Component receives `collections` prop from parent `FlashcardsView` (which already fetches them). Holds `collectionId` state (default: `null`). Picker renders between the Back textarea and the error/button row. `handleSave` includes `collection_id: collectionId` in the POST payload. Resets `collectionId` to `null` on save/cancel.

#### 3. Replace raw select in FlashcardListItem

**File**: `src/components/flashcards/FlashcardListItem.tsx`

**Intent**: Replace the inline `<select>` (lines 191-202) with the shared `CollectionPicker` component for consistent UX.

**Contract**: `CollectionPicker` with `value={flashcard.collection_id}`, `collections={collections}`, `onChange={handleCollectionChange}`. Remove the raw `<select>` element and its wrapper `<div>` (lines 190-203).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- AI generation flow: generate cards → select a collection in toolbar → save → verify cards appear in that collection on `/flashcards` page
- AI generation flow: generate cards → leave picker on "None" → save → verify cards have no collection
- Manual create: create a card with a collection selected → verify card appears with that collection
- Manual create: create a card with "None" → verify card has no collection
- Edit flow: change a card's collection via the picker → verify the change persists on refresh
- Edit flow: set a card's collection to "None" → verify `collection_id` is cleared

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Update `createFlashcards` insert assertion in `flashcards.test.ts` to include `collection_id: null`
- Add 3 `SaveFlashcardsSchema` tests for `collection_id`: valid UUID, null, invalid string

### Integration Tests:

- POST `/api/flashcards` with `collection_id` → cards created with that `collection_id`
- POST `/api/flashcards` without `collection_id` → cards created with `null` (backward compat)
- POST `/api/flashcards` with invalid `collection_id` → 400 validation error

### Manual Testing Steps:

1. Generate flashcards from text, pick a collection, save — verify assignment on `/flashcards`
2. Generate flashcards, leave "None", save — verify cards are unassigned
3. Manually create a card with collection selected — verify assignment
4. Change a card's collection in the list view — verify persistence
5. Clear a card's collection (set to "None") — verify cleared

## Performance Considerations

No performance concerns. The collections list is small (user-scoped), already fetched in `FlashcardsView`, and the generation flow adds one additional `GET /api/collections` call on mount.

## References

- Roadmap slice: S-04 in `context/foundation/roadmap.md:104-114`
- Existing collection picker pattern: `src/components/flashcards/FlashcardListItem.tsx:191-202`
- Collections API: `src/pages/api/collections.ts`
- Collections service: `src/lib/services/collections.ts`
- Flashcards API: `src/pages/api/flashcards.ts`
- Flashcards service: `src/lib/services/flashcards.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — Accept collection_id on create

#### Automated

- [x] 1.1 Type checking passes after adding collection_id to CreateFlashcardInput and SaveFlashcardsSchema — 978c77d
- [x] 1.2 Build succeeds with collection_id threaded through POST handler and service — 978c77d
- [x] 1.3 Existing tests updated and passing: createFlashcards insert assertion includes collection_id, SaveFlashcardsSchema tests cover collection_id — 978c77d
- [x] 1.4 POST with collection_id creates cards with the specified collection_id — 978c77d
- [x] 1.5 POST without collection_id still creates cards with collection_id null (backward compatible) — 978c77d

#### Manual

- [x] 1.6 Existing flashcard creation (generate + manual) still works without passing collection_id

### Phase 2: Shared CollectionPicker component

#### Automated

- [x] 2.1 Type checking passes after creating CollectionPicker component — 36b514b
- [x] 2.2 Build succeeds with new component — 36b514b

#### Manual

- [x] 2.3 Component renders correctly (verified in Phase 3 integration)

### Phase 3: Wire CollectionPicker into all three flows

#### Automated

- [x] 3.1 Type checking passes after wiring picker into FlashcardReview, CreateFlashcardForm, and FlashcardListItem
- [x] 3.2 Build succeeds with all three integrations

#### Manual

- [x] 3.3 AI generation: generate cards, select a collection in toolbar, save — cards appear in that collection
- [x] 3.4 AI generation: generate cards, leave picker on "None", save — cards have no collection
- [x] 3.5 Manual create: create a card with a collection selected — card appears with that collection
- [x] 3.6 Manual create: create a card with "None" — card has no collection
- [x] 3.7 Edit flow: change a card's collection via the picker — change persists on refresh
- [x] 3.8 Edit flow: set a card's collection to "None" — collection_id is cleared
