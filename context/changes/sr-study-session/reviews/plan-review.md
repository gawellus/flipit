<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Study Session with Spaced Repetition

- **Plan**: context/changes/sr-study-session/plan.md
- **Mode**: Deep
- **Date**: 2026-06-05
- **Verdict**: SOUND
- **Findings**: 0 critical, 1 warning, 0 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | PASS    |
| Lean Execution        | PASS    |
| Architectural Fitness | WARNING |
| Blind Spots           | PASS    |
| Plan Completeness     | PASS    |

## Grounding

8/8 paths ✓, 3/3 symbols ✓, brief↔plan ✓, Progress↔Phase consistency ✓

## Deep Verification

All 5 riskiest claims confirmed against ts-fsrs API research doc and codebase:

- `CardInput` accepts plain objects from DB rows
- `createEmptyCard()` defaults match DB column defaults exactly
- `learning_steps` field name matches ts-fsrs Card type
- `scheduler.next(card, now, rating)` signature correct
- Adding `collection_id` to flashcards backward-compatible with all existing callers (with F1 caveat)

## Findings

### F1 — PATCH Zod refine rejects collection_id-only updates

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architectural Fitness
- **Location**: Phase 2, item 3 — Update Flashcards API
- **Detail**: The existing `UpdateFlashcardSchema` at `src/pages/api/flashcards.ts:41` has a `.refine()` requiring at least `front` or `back` to be present: `data.front != null || data.back != null`. Phase 2 adds collection assignment via PATCH with only `collection_id` (no front/back change). This refine will reject the request with a 400 validation error. The plan says "Extend existing PATCH Zod schema to accept optional collection_id" but doesn't mention updating the refine constraint to also accept collection_id-only updates.
- **Fix**: Update Phase 2 item 3 contract to specify that the PATCH refine is updated to: `data.front != null || data.back != null || data.collection_id !== undefined`
- **Decision**: FIXED — refine constraint update added to Phase 2 item 3 contract
