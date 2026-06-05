<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Study Session with Spaced Repetition

- **Plan**: context/changes/sr-study-session/plan.md
- **Scope**: All Phases (1-4 of 4)
- **Date**: 2026-06-05
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Non-atomic SR state update + review log insert

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/study.ts:142-189
- **Detail**: processReview performs two sequential writes — UPDATE flashcard_sr_state then INSERT review_logs. If the log insert fails, the SR state is already committed but the review log is lost. Card schedule advances without audit trail.
- **Fix A ⭐ Recommended**: Wrap both writes in a Supabase RPC (plpgsql function) for single-transaction atomicity.
  - Strength: Both succeed or neither does. Standard transactional pattern.
  - Tradeoff: Requires a new SQL migration with a plpgsql function.
  - Confidence: MED — standard pattern but adds a migration.
  - Blind spot: RPC permissions need to match existing RLS.
- **Fix B**: Catch log-insert error separately, return warning instead of throwing.
  - Strength: No migration needed. Session continues even if logging fails.
  - Tradeoff: Accepts silent data loss in review_logs. Audit trail becomes best-effort.
  - Confidence: HIGH — simple code change.
  - Blind spot: Downstream analytics on review_logs would have gaps.
- **Decision**: FIXED via Fix A — added process_review RPC migration + updated service to use supabase.rpc()

### F2 — Sequential unbounded queries in listCollections

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/collections.ts:16-67
- **Detail**: listCollections makes 3 sequential queries — list collections, count flashcards, count due cards — each fetching all matching rows to count client-side. Three round-trips, unbounded data transfer.
- **Fix**: Run the three queries in parallel with Promise.all. Eliminates sequential round-trip latency. Simple mechanical change.
- **Decision**: FIXED — wrapped three queries in Promise.all

### F3 — handleRetry lacks cancellation guard

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/study/StudySessionView.tsx:132-152
- **Detail**: The initial useEffect fetch uses a cancelled flag for cleanup. handleRetry fires a new fetch without any cancellation mechanism. CollectionsView uses a refreshKey pattern that re-triggers the effect with proper cleanup.
- **Fix**: Refactor to use refreshKey pattern matching CollectionsView.tsx:44-48. Gets cancellation for free via the existing useEffect cleanup.
- **Decision**: FIXED — refactored to refreshKey + useCallback pattern matching CollectionsView

### F4 — study/[id].astro passes unvalidated param to client

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/study/[id].astro:11
- **Detail**: Passes Astro.params.id ?? "" directly to React. No XSS risk (React escapes), but empty string fallback produces a client-side fetch to an invalid API path. API validates via Zod so it 404s gracefully, but server-side validation would be cleaner.
- **Fix**: Add UUID validation in Astro frontmatter; return 404 if invalid.
- **Decision**: FIXED — added UUID regex validation in Astro frontmatter, returns 404 if invalid

### F5 — Unbounded getDueCards query

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/study.ts:41-49
- **Detail**: getDueCards has no .limit(). However, the plan explicitly states this is acceptable: "Cards are fetched all-at-once for a collection (no pagination) — acceptable for typical collection sizes (5-50 due cards per session)." This is a conscious design decision, not an oversight.
- **Fix**: Add .limit(100) as a safety cap.
- **Decision**: SKIPPED — plan explicitly accepts unbounded fetch for MVP
