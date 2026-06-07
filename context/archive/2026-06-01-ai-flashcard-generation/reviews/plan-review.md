<!-- PLAN-REVIEW-REPORT -->

# Plan Review: AI Flashcard Generation

- **Plan**: context/changes/ai-flashcard-generation/plan.md
- **Mode**: Deep
- **Date**: 2026-06-01
- **Verdict**: SOUND (after triage)
- **Findings**: 1 critical, 4 warnings, 2 observations

## Verdicts

| Dimension             | Verdict |
| --------------------- | ------- |
| End-State Alignment   | WARNING |
| Lean Execution        | PASS    |
| Architectural Fitness | PASS    |
| Blind Spots           | WARNING |
| Plan Completeness     | WARNING |

## Grounding

5/8 paths verified (3 new: supabase/migrations/, src/types.ts, src/lib/services/ need creation), 3/3 symbols verified, brief-plan consistent.

## Findings

### F1 — Progress section missing Phase 3 manual verification item

- **Severity**: ❌ CRITICAL
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: ## Progress → Phase 3 Manual
- **Detail**: Phase 3 Manual Verification lists 8 items but Progress only has 7 (3.4–3.10). Missing: "Rejecting all cards and clicking save shows appropriate feedback (no cards to save)."
- **Fix**: Added `- [ ] 3.6 Rejecting all cards shows appropriate save feedback` to Progress Phase 3 Manual, renumbered 3.5–3.11.
- **Decision**: FIXED

### F2 — No LLM model specified for OpenRouter API call

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, Change 3 (OpenRouter service)
- **Detail**: The OpenRouter API requires a `model` parameter in every request. The plan's contract says "uses native fetch against OpenRouter API" but never specifies which model. The implementer would have to choose — and model choice directly affects quality, cost, and latency.
- **Fix A ⭐ Recommended**: Specify a default model in the plan contract.
- **Fix B**: Make model configurable via OPENROUTER_MODEL env var.
- **Decision**: ACCEPTED — implementer will pick the model during Phase 2.

### F3 — Zod not in project dependencies

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 2 and Phase 3 (Zod validation schemas)
- **Detail**: Plan references Zod for input validation in both API endpoints, and CLAUDE.md mandates "Validate input with Zod." But `zod` is not in package.json.
- **Fix**: Add `npm install zod` as the first step of Phase 2.
- **Decision**: ACCEPTED — implementer will install Zod.

### F4 — supabase/migrations/ directory doesn't exist

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Current State Analysis + Phase 1, Change 1
- **Detail**: Plan says "supabase/migrations/ is empty" but the directory doesn't exist. Only supabase/config.toml is present.
- **Fix**: Correct Current State Analysis and note `npx supabase migration new create_flashcards` in Phase 1.
- **Decision**: ACCEPTED — implementer will create directory via supabase CLI.

### F5 — "Saved" confirmation UI unspecified

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Phase 3, Change 4 (GenerateView)
- **Detail**: Desired End State says "user sees a confirmation with a count of saved cards." GenerateView's state machine includes "saved" but no contract describes what this state renders.
- **Fix**: Add to GenerateView contract: "In saved state, renders success message with saved count and a 'Generate more' button (resets to input state)."
- **Decision**: ACCEPTED — implementer will design the saved state UI.

### F6 — src/types.ts needs creation, not modification

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Plan Completeness
- **Location**: Phase 1, Change 2
- **Detail**: Plan says "File: src/types.ts" implying it exists. It doesn't — CLAUDE.md lists it as a convention but it hasn't been created.
- **Decision**: ACCEPTED

### F7 — No updated_at auto-update trigger

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW
- **Dimension**: Blind Spots
- **Location**: Phase 1, Change 1 (migration)
- **Detail**: Schema has `updated_at` with default `now()` but no trigger to auto-update on row changes. S-01 only inserts so this is harmless, but S-02 (edit) will need it.
- **Decision**: ACCEPTED
