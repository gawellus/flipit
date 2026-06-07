<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: AI Flashcard Generation

- **Plan**: context/changes/ai-flashcard-generation/plan.md
- **Scope**: Phases 1-3 of 3 (full plan)
- **Date**: 2026-06-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | FAIL    |

## Findings

### F1 — Missing upper-bound validation on save endpoint

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/flashcards.ts:6-16
- **Detail**: The SaveFlashcardsSchema Zod schema has `.min(1)` on the flashcards array and front/back strings, but no `.max()` constraints on any of them. A client could POST thousands of flashcards with arbitrarily long text, causing an oversized DB insert and potential resource exhaustion on the Cloudflare Worker (128MB ceiling).
- **Fix**: Add `.max(50)` on the array and `.max(2000)` on front/back strings (or whatever limits match the product intent).
  - Strength: Closes the unbounded-input class at the validation boundary. Matches the pattern in generations.ts which already caps source_text at 10,000 chars.
  - Tradeoff: Requires choosing a limit — 50 cards and 2000 chars are reasonable for AI-generated content but may need revisiting for S-02 manual creation.
  - Confidence: HIGH — standard input validation practice.
  - Blind spot: None significant.
- **Decision**: FIXED

### F2 — Internal error details leaked to client

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/generations.ts:51-53
- **Detail**: The catch block forwards `err.message` to the client. Error messages from the OpenRouter service include upstream details like "OpenRouter API error (429): {full response body}" and "OPENROUTER_API_KEY is not configured", revealing the provider name, status codes, and configuration state.
- **Fix**: Return a generic "Flashcard generation failed. Please try again." message to the client. The detailed error is already useful for server-side debugging via Worker logs.
  - Strength: Stops leaking infrastructure details. One-line change.
  - Tradeoff: Harder for end-users to self-diagnose failures, but they shouldn't need to — the UI already shows a retry button.
  - Confidence: HIGH — standard practice.
  - Blind spot: None significant.
- **Decision**: FIXED

### F3 — Lint fails: unnecessary type assertion

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/services/openrouter.ts:32
- **Detail**: `npm run lint` fails with `@typescript-eslint/no-unnecessary-type-assertion` on `(OPENROUTER_MODEL as string | undefined)`. The env field is declared `optional: true`, so its inferred type already includes `undefined` — the cast is redundant. This means the "Lint passes" automated check (2.2, 3.2) currently fails.
- **Fix**: Remove the `as string | undefined` cast so the line reads `OPENROUTER_MODEL ?? DEFAULT_MODEL`.
- **Decision**: FIXED

### F4 — No updated_at trigger

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260602120000_create_flashcards.sql:9
- **Detail**: The `updated_at` column has a default of `now()` but no trigger to auto-update it on row modification. S-01 has no update operations so this has zero runtime impact today, but S-02 (flashcard-crud) will add update endpoints, at which point `updated_at` will silently stay at creation time.
- **Fix**: Defer to S-02 — add a BEFORE UPDATE trigger in that migration. No action needed now.
- **Decision**: ACCEPTED-AS-RULE: Always add updated_at trigger when creating timestamp columns

### F5 — No fetch timeout on OpenRouter call

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/services/openrouter.ts:25
- **Detail**: The `fetch()` call to OpenRouter has no `AbortSignal.timeout()`. If the upstream hangs, the Worker waits until the platform's own timeout kills it (30s free tier, up to 5min paid). Cloudflare's timeout acts as a backstop, so this is a soft concern — but an explicit timeout would give a better error message.
- **Fix**: Add `signal: AbortSignal.timeout(30_000)` to the fetch options if you want explicit control.
- **Decision**: ACCEPTED-AS-RULE: Always set explicit fetch timeouts on external API calls
