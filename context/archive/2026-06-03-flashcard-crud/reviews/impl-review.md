<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Flashcard CRUD

- **Plan**: context/changes/flashcard-crud/plan.md
- **Scope**: All Phases (1-3 of 3)
- **Date**: 2026-06-04
- **Verdict**: NEEDS ATTENTION
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

### F1 — PostgREST filter injection via search term

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/flashcards.ts:49
- **Detail**: The `.or()` filter string interpolates the user's search term directly into PostgREST filter syntax. The code escapes SQL ILIKE wildcards (% and \_) but does NOT escape PostgREST syntax delimiters (comma `,` and period `.`). A search term containing a comma could inject additional filter conditions into the .or() clause, potentially altering query semantics.
- **Fix**: Escape commas and periods in the search pattern before interpolation into the PostgREST filter string.
  - Strength: Closes the injection vector with a 1-line change to the existing escape chain.
  - Tradeoff: Users searching for literal commas/periods won't match them — acceptable for MVP ILIKE search.
  - Confidence: HIGH — PostgREST docs confirm comma/period are syntax-significant in filter expressions.
  - Blind spot: None significant.
- **Decision**: FIXED — escaped commas and periods in the PostgREST filter search pattern

### F2 — Fragile error-message string matching for 404 status

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards.ts:201,255
- **Detail**: PATCH and DELETE handlers determine 404 vs 500 by checking `message.includes("Failed to update flashcard")`. This couples the HTTP status to the exact wording of the DAL error message. If the message changes, the API silently returns 500 instead of 404. The existing `generations.ts` endpoint avoids this by returning 500 for all catch blocks.
- **Fix**: Use a typed error class (e.g., `NotFoundError`) or check for the Supabase PGRST116 error code instead of string matching.
  - Strength: Decouples API status logic from error message wording; survives DAL refactors.
  - Tradeoff: Adds a small error class or code-checking pattern.
  - Confidence: HIGH — standard pattern for HTTP status mapping.
  - Blind spot: None significant.
- **Decision**: FIXED — added NotFoundError class, DAL checks PGRST116 code, API handlers use instanceof

### F3 — SearchInput uses internal state instead of controlled value prop

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/flashcards/SearchInput.tsx
- **Detail**: Plan specified `Props: { value: string, onChange }` (controlled). Implementation uses `{ onChange }` only with internal state, relying on React `key` remounting to reset. Functionally equivalent — the only external reset (on card creation) works via key. Drift is cosmetic; no use case requires parent-controlled search value. Adaptation was necessary to satisfy strict React 19 lint rules that prohibit setState-in-effect for prop syncing.
- **Fix**: No action needed — functionally correct adaptation.
- **Decision**: SKIPPED — functionally correct adaptation, no action needed
