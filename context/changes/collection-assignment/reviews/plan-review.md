<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Collection Assignment Across Flows

- **Plan**: context/changes/collection-assignment/plan.md
- **Mode**: Deep
- **Date**: 2026-06-07
- **Verdict**: REVISE
- **Findings**: 1 critical, 1 warning, 1 observation

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | FAIL    |
| Plan Completeness     | WARNING |

## Grounding

Grounding: 9/9 paths ✓, 3/3 symbols ✓, brief↔plan ✓

## Findings

### F1 — Existing tests will break; plan omits test updates

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 1 — Backend changes + Testing Strategy
- **Detail**: Two test files directly exercise the code the plan modifies: (1) `src/lib/services/flashcards.test.ts:46-48` asserts the exact argument to `.insert()` — `{ user_id, front, back, source, generation_id }`. Adding `collection_id` to the row mapping in `createFlashcards` will fail this assertion. (2) `src/pages/api/flashcards.test.ts:11-106` has 11 tests for `SaveFlashcardsSchema`. Adding `collection_id` to the schema needs at least a passing test (valid UUID, null, invalid UUID). The plan's Testing Strategy says "No new unit tests required" — this is incorrect. Existing tests WILL fail.
- **Fix**: Add test updates to Phase 1. Update the `createFlashcards` insert assertion to include `collection_id: null`. Add 2-3 `SaveFlashcardsSchema` tests covering valid UUID, null, and invalid UUID for `collection_id`.
- **Decision**: PENDING

### F2 — CollectionPicker placed in shadcn/ui primitives directory

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2 — CollectionPicker file path
- **Detail**: Plan places `CollectionPicker` at `src/components/ui/CollectionPicker.tsx`. The `ui/` directory contains only shadcn/ui primitives (badge, button, card, input, label, textarea) — per CLAUDE.md: "shadcn/ui: components in src/components/ui/". CollectionPicker imports the `Collection` type and is a domain-specific component, not a generic primitive. `src/components/collections/` already exists with `CollectionsView.tsx`.
- **Fix**: Move to `src/components/collections/CollectionPicker.tsx`.
- **Decision**: PENDING

### F3 — Progress↔Phase item count mismatch in Phase 1

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 Success Criteria vs. Progress section
- **Detail**: Phase 1 lists 4 Automated Verification bullets but the Progress section has only 2 automated entries (1.1, 1.2). The two API-level verification items ("POST with collection_id creates assigned cards", "POST without collection_id creates unassigned cards") are merged into Manual item 1.3 with different wording than the original automated bullets. `/10x-implement` parses Progress as the canonical checklist.
- **Fix**: Add items 1.3 and 1.4 under Automated in Progress matching the two API-level verification bullets, and renumber the current 1.3 manual item to 1.5.
- **Decision**: PENDING
