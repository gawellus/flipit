<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Collection Assignment Across Flows

- **Plan**: context/changes/collection-assignment/plan.md
- **Mode**: Deep
- **Date**: 2026-06-20
- **Verdict**: REVISE
- **Findings**: 1 critical, 3 warnings, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 7/7 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Existing tests will break; plan omits test updates

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Backend changes + Testing Strategy
- **Detail**: The test at `flashcards.test.ts:46-48` asserts the exact insert payload: `{ user_id, front, back, source, generation_id }`. Adding `collection_id` to the row mapping in `createFlashcards` will fail this assertion. Additionally, the 11 `SaveFlashcardsSchema` tests (`flashcards.test.ts:11-106`) don't cover `collection_id` acceptance — a new optional UUID field needs at least passing, null, and invalid-UUID cases. The plan's Testing Strategy says "No new unit tests required" — this is incorrect.
- **Fix**: Add test updates to Phase 1. (1) Update the `createFlashcards` insert assertion to include `collection_id: null`. (2) Add 2–3 `SaveFlashcardsSchema` tests: valid UUID, null, and invalid UUID for `collection_id`.
- **Decision**: FIXED — Added test update steps (Phase 1 change 5), updated Testing Strategy, added Progress item 1.3

### F2 — CollectionPicker placed in shadcn/ui primitives directory

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — CollectionPicker file path
- **Detail**: Plan places `CollectionPicker` at `src/components/ui/CollectionPicker.tsx`. The `ui/` directory contains only shadcn/ui primitives (badge, button, card, input, label, textarea, dropdown-menu). Per CLAUDE.md: "shadcn/ui: components in src/components/ui/". CollectionPicker imports the `Collection` type — it's domain-specific, not a generic primitive. `src/components/collections/` already exists with `CollectionsView.tsx`.
- **Fix**: Move to `src/components/collections/CollectionPicker.tsx`.
- **Decision**: FIXED — Updated all path references in plan to `src/components/collections/CollectionPicker.tsx`

### F3 — Phase 3 references non-existent Badge in FlashcardListItem

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 3 — Change 3 (Replace raw select in FlashcardListItem)
- **Detail**: Phase 3 change 3 says: "Remove the raw `<select>` element and the redundant `currentCollection` Badge that follows it." After the S-06 redesign (archived 2026-06-15), there is NO Badge component or `currentCollection` variable anywhere in `FlashcardListItem.tsx`. Lines 203-207 (where the plan expects a Badge) are closing `</div>` tags and the start of the edit/delete button column. The raw `<select>` at lines 191-202 still exists and is the correct replacement target. Additionally, the plan calls the FlashcardReview action bar a "sticky toolbar" — it has no `sticky` or `fixed` CSS class and is rendered twice (top at line 102, bottom at line 138). The placement instruction is still correct, but the implementer should know the picker will appear in both locations.
- **Fix**: Update Phase 3 change 3 contract to: "Replace the raw `<select>` element (lines 191-202) with `CollectionPicker`. Remove only the `<select>` and its wrapper `<div>` — no Badge exists." Also clarify in Phase 3 change 1 that the action bar is rendered at both top and bottom of the card list.
- **Decision**: FIXED — Removed Badge reference from Phase 3 change 3, updated FlashcardReview toolbar description to note dual action bar

### F4 — Progress↔Phase item count mismatches

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Progress section (all phases)
- **Detail**: Phase 1: 4 Automated SC bullets → only 2 Automated Progress items (1.1, 1.2). The two API-level verification bullets are merged into Manual item 1.3 with different wording. Phase 2: has Manual Verification SC ("Component renders correctly") but no Manual subsection in Progress. Phase 3: 6 Manual SC bullets → 4 Manual Progress items (3.3–3.6). Two "None" verification bullets and their positive counterparts are consolidated without 1:1 mapping. `/10x-implement` parses Progress as the canonical checklist — mismatches cause skipped verification steps.
- **Fix**: Align Progress items 1:1 with Success Criteria bullets across all three phases. Add missing items and renumber.
- **Decision**: FIXED — Aligned all Progress items 1:1 with SC bullets: Phase 1 now 1.1–1.6, Phase 2 added 2.3 Manual, Phase 3 expanded to 3.3–3.8
