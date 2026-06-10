# Collection Assignment Across Flows — Plan Brief

> Full plan: `context/changes/collection-assignment/plan.md`

## What & Why

Add collection assignment to the two remaining flashcard creation flows (AI generation and manual create) so users can organize cards into collections at creation time instead of editing them individually afterward. The collections infrastructure is fully built — this change closes the UX gap by wiring a shared picker into all three touchpoints.

## Starting Point

Collections exist with full DB support (`collections` table, `flashcards.collection_id` FK, RLS, API, types, management UI). Collection assignment works in one of three flows: the `FlashcardListItem` view mode has a raw `<select>` dropdown. The AI generation save and manual create form both create cards with `collection_id: null` — no picker, no assignment option.

## Desired End State

All three flows where flashcards are created or edited offer a consistent collection picker. AI generation assigns all accepted cards to one collection at save time. Manual create assigns the card on creation. The existing edit-mode picker uses the same shared component. Cards can still be left unassigned ("None").

## Key Decisions Made

| Decision                   | Choice                          | Why (1 sentence)                                                                     |
| -------------------------- | ------------------------------- | ------------------------------------------------------------------------------------ |
| AI generation picker scope | One picker for all cards        | Users generate cards from one topic — batch assignment matches the mental model.     |
| Default selection          | "None" (no collection)          | Consistent with current behavior; avoids accidental assignments.                     |
| Inline collection creation | No — pick from existing only    | Keeps the picker component simple; users create collections on /study.               |
| Existing picker refactor   | Extract shared CollectionPicker | One component across all three flows for consistent UX and single maintenance point. |
| Save mechanism             | Accept collection_id in POST    | Atomic assignment at creation; no N+1 PATCH calls after save.                        |

## Scope

**In scope:**

- Shared `CollectionPicker` component
- Collection picker in AI generation review toolbar
- Collection picker in manual create form
- Refactor `FlashcardListItem` to use shared picker
- Backend: `collection_id` in POST `/api/flashcards`

**Out of scope:**

- Inline "create new collection" in picker
- Remember last-used collection
- Per-card collection assignment during generation
- Bulk assignment (S-05)
- Changes to collection CRUD, study sessions, or SR scheduling

## Architecture / Approach

Thin vertical slice: add `collection_id` to the create API path (type → schema → handler → service), extract a shared `CollectionPicker` from the existing pattern, then wire it into all three flows. No new tables, no new API routes, no new pages.

## Phases at a Glance

| Phase               | What it delivers                                                  | Key risk                                             |
| ------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| 1. Backend          | POST `/api/flashcards` accepts optional `collection_id`           | Minimal — adding one optional field to existing path |
| 2. CollectionPicker | Shared reusable component extracted from existing pattern         | Minimal — styling match with existing dark theme     |
| 3. Wire into flows  | Picker in generate toolbar, create form, and refactored edit view | Minor regression risk in FlashcardListItem refactor  |

**Prerequisites:** Collections table and API already exist (S-03 delivered these)
**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- Assumes users will have created collections before generating/creating cards (no inline create option)
- FlashcardListItem refactor touches a working component — minor regression risk mitigated by manual testing

## Success Criteria (Summary)

- User can assign AI-generated cards to a collection during the save step
- User can assign a manually created card to a collection during creation
- All three picker locations use the same shared component with consistent styling
