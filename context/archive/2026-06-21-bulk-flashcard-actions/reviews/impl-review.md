<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Bulk Flashcard Actions

- **Plan**: context/changes/bulk-flashcard-actions/plan.md
- **Scope**: All phases (1-3)
- **Date**: 2026-06-23
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Findings

### F1 — moveCollectionId not reset after bulk move

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/flashcards/BulkActionBar.tsx:27
- **Detail**: moveCollectionId state is initialized to null but never reset after onMove completes. After a bulk move, the picker still shows the previously selected collection. If the user selects new cards and clicks "Move" again without changing the picker, they silently move to the same collection — possibly unintended.
- **Fix**: Reset moveCollectionId to null inside the onClick handler after calling onMove: `onClick={() => { onMove(moveCollectionId); setMoveCollectionId(null); }}`
- **Decision**: FIXED

### F2 — Ambiguous bulk/single schema dispatch

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards.ts:200,274
- **Detail**: DELETE and PATCH handlers try bulk schema first, then fall back to single. A request with both { id, ids } fields matches the bulk schema (Zod doesn't reject extra keys by default), silently ignoring the id field. In practice this is unlikely — the only callers are our own frontend — but it's a latent ambiguity.
- **Fix**: Add `.strict()` to BulkDeleteSchema and BulkUpdateCollectionSchema so payloads with an extra id field fail validation and correctly fall through to the single-item path.
- **Decision**: FIXED

### F3 — Dialog text cosmetic drift from plan

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/flashcards/BulkActionBar.tsx:54-55
- **Detail**: Plan specifies "Delete N flashcards? This cannot be undone." as a single message. Implementation splits into a title ("Delete N flashcard(s)?") and description ("This action cannot be undone.") and adds singular/plural logic. Intent is fully preserved — this is better UX than the plan specified.
- **Fix**: No action needed. The implementation improves on the plan.
- **Decision**: SKIPPED
