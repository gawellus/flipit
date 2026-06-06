---
date: 2026-06-06T12:00:00+02:00
researcher: Claude
git_commit: 3ae2e757617eb4e85a37688a8f455bf9f34d9600
branch: main
repository: flipit
topic: "Phase 1 critical-path unit coverage — LLM parsing, CRUD edge cases, Zod validation"
tags: [research, testing, unit-tests, vitest, risk-1, risk-4, risk-5]
status: complete
last_updated: 2026-06-06
last_updated_by: Claude
---

# Research: Phase 1 — Critical-Path Unit Coverage

**Date**: 2026-06-06T12:00:00+02:00
**Researcher**: Claude
**Git Commit**: 3ae2e757617eb4e85a37688a8f455bf9f34d9600
**Branch**: main
**Repository**: flipit

## Research Question

What code must Phase 1 unit tests cover, and what are the oracle sources (what should the code do) for each risk? Phase 1 covers risks #1, #4, #5 from test-plan.md at the unit test layer.

## Summary

Phase 1 has three testing targets, all viable as pure unit tests with mocked dependencies:

1. **Risk #1 — LLM parsing** (`openrouter.ts`): The `parseFlashcards` function is a pure function that converts raw LLM text into `FlashcardProposal[]`. It handles two input shapes and silently filters invalid items. `generateFlashcards` wraps fetch + parsing. Both are testable by mocking `fetch`. The key vulnerability is that **no Zod schema validates LLM output** — only manual type checks exist.

2. **Risk #4 — CRUD edge cases**: The four service functions in `flashcards.ts` are thin Supabase wrappers. Unit tests mock the Supabase client to verify: error propagation (NotFoundError on PGRST116), ILIKE escaping in search, empty-input guards, and correct query construction. The `parseFlashcards` silent-filtering behavior (items with wrong keys are dropped without error) is also a Risk #4 concern.

3. **Risk #5 — Zod validation**: Nine Zod schemas defined inline across five endpoint files. All use identical error response format (`{ error, issues }`). Schemas are pure — testable without any server or DB. Auth endpoints (`signin.ts`, `signup.ts`) have **no server-side Zod validation** (out of scope for Phase 1 per test-plan risk boundaries, but noted).

**Test infrastructure**: Zero test files, no Vitest dependency, no config. Phase 1 must bootstrap Vitest before writing any tests.

## Detailed Findings

### Risk #1 — LLM Response Parsing Paths

#### Oracle sources

- PRD FR-003/FR-004: generation must produce structured flashcard proposals
- `SYSTEM_PROMPT` (openrouter.ts:7-18): instructs LLM to return `{"flashcards":[{"front":"...","back":"..."}]}`
- `FlashcardProposal` type (types.ts:13-16): `{ front: string, back: string }`

#### Code under test

**`parseFlashcards(raw: string): FlashcardProposal[]`** — openrouter.ts:58-103

This is a pure function (no side effects, no I/O). It:

1. Calls `JSON.parse(raw)` — throws `"Failed to parse LLM response as JSON"` on invalid JSON (line 63)
2. Accepts two shapes: direct array `[{...}]` or wrapper `{ flashcards: [{...}] }` (lines 67-74)
3. Throws `"LLM response is not a flashcard array"` if neither shape matches (line 77)
4. Iterates items, **silently skips** any item that lacks `front`/`back` strings (lines 82-96)
5. Throws `"LLM response contained no valid flashcard proposals"` if zero items survive (line 99)

**Key behaviors to test:**

| Input                                                   | Expected outcome                      | Oracle                                        |
| ------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| Valid `{"flashcards":[{"front":"Q","back":"A"}]}`       | Returns `[{front:"Q",back:"A"}]`      | SYSTEM_PROMPT contract                        |
| Valid direct array `[{"front":"Q","back":"A"}]`         | Returns same                          | Code handles both shapes (line 67)            |
| Invalid JSON string                                     | Throws "Failed to parse"              | JSON.parse contract                           |
| Truncated JSON `{"flashcards":[{"front":"Q"`            | Throws "Failed to parse"              | JSON.parse contract                           |
| Wrong wrapper key `{"cards":[...]}`                     | Throws "not a flashcard array"        | Only `flashcards` key accepted                |
| Empty array `{"flashcards":[]}`                         | Throws "no valid flashcard proposals" | Empty array has 0 valid items                 |
| Items with wrong keys `[{"question":"Q","answer":"A"}]` | Throws "no valid proposals"           | front/back required                           |
| Mix of valid and invalid items                          | Returns only valid ones               | Silent filtering (lines 82-96)                |
| Items with `front: 123` (non-string)                    | Filtered out silently                 | typeof check (line 88-89)                     |
| Items with extra fields `{front,back,hint}`             | Returns `{front,back}` only           | Only front/back extracted (91-93)             |
| `null`                                                  | Throws "not a flashcard array"        | null is not array, not object with flashcards |
| `"just a string"`                                       | Throws "not a flashcard array"        | string is not array                           |
| `42`                                                    | Throws "not a flashcard array"        | number is not array                           |

**`generateFlashcards(sourceText: string): Promise<FlashcardProposal[]>`** — openrouter.ts:20-56

Wraps fetch + parsing. Testable by mocking global `fetch`.

| Scenario                                            | Expected outcome                      | Oracle                                |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------- |
| API key missing (`OPENROUTER_API_KEY` falsy)        | Throws "not configured"               | Explicit guard (line 21-23)           |
| Fetch returns non-200 status                        | Throws "API error ({status}): {body}" | Guard (lines 41-44)                   |
| Response has empty `choices` array                  | Throws "empty response"               | `choices?.[0]` is undefined (line 50) |
| Response has `choices[0].message` = null            | Throws "empty response"               | `.message?.content` is undefined      |
| Response has valid content                          | Delegates to `parseFlashcards`        | Line 55                               |
| Response is not valid JSON (response.json() throws) | Unhandled — propagates                | No try/catch on response.json()       |

**Critical testability note**: `generateFlashcards` reads `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from `astro:env/server` (line 1). Tests must either mock the `astro:env/server` module or use vi.mock to provide these values.

#### Vulnerability: No Zod on LLM output

The `parseFlashcards` function uses manual `typeof` checks instead of Zod. This means:

- No max-length enforcement on front/back (SaveFlashcardsSchema enforces max 2000 on save, but not at generation time — user could see a card in review that will fail to save)
- No min-length enforcement (empty string `""` passes typeof check)
- No structured error messages (just generic throws)

This is a **finding**, not a test gap — the plan should decide whether to test current behavior as-is or recommend a code change first.

### Risk #4 — CRUD Service Edge Cases

#### Oracle sources

- PRD FR-005–FR-008: flashcard create, list, update, delete must work correctly
- Supabase PostgREST error codes: `PGRST116` = "no rows returned by a subquery" → maps to not-found
- `NotFoundError` class (errors.ts:1-6): custom error used to produce 404 responses

#### Code under test

**`flashcards.ts`** — four exported functions, all taking a `SupabaseClient` as first parameter.

**`createFlashcards(supabase, userId, cards)`** — lines 5-29

- Empty array guard: returns `[]` immediately (line 10-12)
- Maps `CreateFlashcardInput[]` to DB rows with `user_id` (lines 14-19)
- Calls `supabase.from("flashcards").insert(rows).select()` (line 22)
- Throws on Supabase error (lines 24-26)

| Test case             | Expected                                    | Oracle                    |
| --------------------- | ------------------------------------------- | ------------------------- |
| Empty cards array     | Returns `[]`, no DB call                    | Guard at line 10          |
| Supabase insert error | Throws "Failed to insert flashcards: {msg}" | Error handling line 24-26 |
| Successful insert     | Returns data from Supabase                  | Happy path                |

**`listFlashcards(supabase, userId, options)`** — lines 31-68

- Computes pagination range: `from = (page-1)*pageSize`, `to = from + pageSize - 1` (lines 37-38)
- Queries with `user_id` filter, `created_at desc` order (lines 40-45)
- Search: escapes `%`, `_`, `,`, `.` then builds ILIKE pattern (lines 47-51)
- Returns `PaginatedResponse<Flashcard>` with computed `totalPages` (lines 61-67)

| Test case              | Expected                                    | Oracle                       |
| ---------------------- | ------------------------------------------- | ---------------------------- |
| No search term         | No `.or()` call on query                    | `if (search)` guard, line 47 |
| Search with `%`        | Escaped to `\%` in pattern                  | ILIKE wildcard escaping      |
| Search with `_`        | Escaped to `\_`                             | ILIKE single-char wildcard   |
| Search term applied    | `.or(front.ilike.%term%,back.ilike.%term%)` | Line 50                      |
| Page 1, pageSize 10    | Range 0-9                                   | Pagination formula           |
| Page 2, pageSize 10    | Range 10-19                                 | Pagination formula           |
| Supabase error         | Throws "Failed to list flashcards: {msg}"   | Line 55-57                   |
| Count is null          | totalCount defaults to 0                    | Line 59: `count ?? 0`        |
| totalPages computation | `ceil(totalCount / pageSize)`               | Line 66                      |

**`updateFlashcard(supabase, userId, flashcardId, updates)`** — lines 70-92

- Calls `.update(updates).eq("id").eq("user_id").select().single()` (lines 76-82)
- PGRST116 error → `NotFoundError` (lines 85-87)
- Other errors → generic Error (line 88)

| Test case                 | Expected                                      | Oracle     |
| ------------------------- | --------------------------------------------- | ---------- |
| Successful update         | Returns updated Flashcard                     | Happy path |
| Card not found (PGRST116) | Throws `NotFoundError("Flashcard not found")` | Line 85-87 |
| Other Supabase error      | Throws "Failed to update flashcard: {msg}"    | Line 88    |

**`deleteFlashcard(supabase, userId, flashcardId)`** — lines 94-109

- Calls `.delete().eq("id").eq("user_id").select().single()` (lines 95-101)
- Same PGRST116 → NotFoundError pattern (lines 103-106)

| Test case                 | Expected                                      | Oracle       |
| ------------------------- | --------------------------------------------- | ------------ |
| Successful delete         | Returns void                                  | Happy path   |
| Card not found (PGRST116) | Throws `NotFoundError("Flashcard not found")` | Line 104-106 |
| Other Supabase error      | Throws "Failed to delete flashcard: {msg}"    | Line 107     |

**Mocking strategy**: All four functions accept `SupabaseClient` as a parameter — create a mock with chainable `.from().insert().select()` etc. No module-level mocking needed (unlike `openrouter.ts`).

### Risk #5 — Zod Schema Validation Boundaries

#### Oracle sources

- PRD NFR: "continuous visible feedback" — errors must be structured 400s, not 500s
- FSRS standard: rating is 1-4 (Again=1, Hard=2, Good=3, Easy=4)
- Flashcard content limits: front/back max 2000 chars (SaveFlashcardsSchema)
- Source text limit: max 10,000 chars (GenerateRequestSchema)

#### Schemas inventory

All schemas are defined inline in endpoint files. They are pure Zod objects — testable by importing and calling `.safeParse()` directly.

| Schema                   | File:Line            | Fields & Constraints                                                                                                                                                               |
| ------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GenerateRequestSchema`  | generations.ts:5-10  | `source_text`: string, min 1, max 10000                                                                                                                                            |
| `SaveFlashcardsSchema`   | flashcards.ts:7-27   | `generation_id`: uuid (optional), `source`: enum("ai","manual"), `flashcards`: array 1-50 of `{front: 1-2000, back: 1-2000}`, refine: ai→requires generation_id, manual→forbids it |
| `ListQuerySchema`        | flashcards.ts:29-33  | `page`: int ≥1 (default 1), `pageSize`: int 1-100 (default 20), `search`: string max 200 (optional)                                                                                |
| `UpdateFlashcardSchema`  | flashcards.ts:35-44  | `id`: uuid, `front`: 1-2000 (optional), `back`: 1-2000 (optional), `collection_id`: uuid\|null (optional), refine: at least one field                                              |
| `DeleteFlashcardSchema`  | flashcards.ts:46-48  | `id`: uuid                                                                                                                                                                         |
| `CreateCollectionSchema` | collections.ts:7-9   | `name`: string, trim, min 1, max 200                                                                                                                                               |
| `DeleteCollectionSchema` | collections.ts:11-13 | `id`: uuid                                                                                                                                                                         |
| `ParamsSchema`           | study/[id].ts:6-8    | `id`: uuid                                                                                                                                                                         |
| `ReviewSchema`           | study/review.ts:7-10 | `flashcard_id`: uuid, `rating`: int min 1 max 4                                                                                                                                    |

#### Validation error format (consistent across all endpoints)

```json
{
  "error": "Validation failed",
  "issues": ["issue 1 message", "issue 2 message"]
}
```

HTTP status: 400. This pattern is repeated identically in all endpoint files.

#### Test cases per schema (boundary testing)

**GenerateRequestSchema**:
| Input | Expected | Boundary |
|-------|----------|----------|
| `{ source_text: "" }` | Fail: min 1 | Lower bound |
| `{ source_text: "a" }` | Pass | At min |
| `{ source_text: "a".repeat(10000) }` | Pass | At max |
| `{ source_text: "a".repeat(10001) }` | Fail: max 10000 | Above max |
| `{}` | Fail: required | Missing field |
| `{ source_text: 123 }` | Fail: not string | Wrong type |

**SaveFlashcardsSchema**:
| Input | Expected | Boundary |
|-------|----------|----------|
| AI source without generation_id | Fail: refine | Cross-field |
| Manual source with generation_id | Fail: refine | Cross-field |
| Empty flashcards array | Fail: min 1 | Lower bound |
| 51 flashcards | Fail: max 50 | Above max |
| front = "" | Fail: min 1 | Empty content |
| front = "a".repeat(2001) | Fail: max 2000 | Above max |
| Invalid UUID for generation_id | Fail: uuid | Format |

**ReviewSchema**:
| Input | Expected | Boundary |
|-------|----------|----------|
| rating = 0 | Fail: min 1 | Below range |
| rating = 1 | Pass | Lower bound (Again) |
| rating = 4 | Pass | Upper bound (Easy) |
| rating = 5 | Fail: max 4 | Above range |
| rating = 2.5 | Fail: int | Non-integer |
| rating = "3" | Fail: number | Wrong type |

**ListQuerySchema**:
| Input | Expected | Boundary |
|-------|----------|----------|
| `{}` | Pass (defaults: page=1, pageSize=20) | Defaults |
| `{ page: 0 }` | Fail: min 1 | Below min |
| `{ pageSize: 101 }` | Fail: max 100 | Above max |
| `{ pageSize: "abc" }` | Fail: coerce | Non-numeric |
| `{ search: "a".repeat(201) }` | Fail: max 200 | Above max |

#### Gap: auth endpoints

`signin.ts` and `signup.ts` extract email/password from `formData` without Zod validation. This is a valid Risk #5 concern but **out of scope for Phase 1** — the test plan scopes Phase 1 to risks #1, #4, #5 as defined, and auth validation gaps are not listed as a top concern. The plan may choose to include or defer this.

#### Testability note: schema extraction

Schemas are `const` at module top level. They can be imported directly if the test file mocks `astro:env/server` (needed for openrouter.ts imports in the same test suite). Alternative: extract schemas to a separate file (e.g., `src/lib/schemas/`) to avoid import side effects. This is a **plan decision**, not a research finding.

### Test Infrastructure Status

**Current state**: Zero test infrastructure exists.

| Item                         | Status         |
| ---------------------------- | -------------- |
| Vitest in package.json       | Not installed  |
| vitest.config.ts             | Does not exist |
| Test scripts in package.json | None           |
| Existing test files          | None           |
| Test utility files           | None           |
| **tests** directories        | None           |

**Bootstrap requirements**:

- Install `vitest` as devDependency
- Create `vitest.config.ts` — must handle `@/*` path alias (tsconfig.json line 10) and `astro:env/server` module mock
- Add `"test"` script to package.json
- Decide test file location convention: co-located (`*.test.ts` next to source) vs. top-level `tests/` directory

**Astro + Vitest compatibility**: Astro uses Vite internally. Vitest shares Vite's config format. The `@/*` path alias from tsconfig.json must be replicated in vitest.config.ts via `resolve.alias` since Vitest does not read tsconfig paths by default (or use `vite-tsconfig-paths` plugin).

**`astro:env/server` mocking**: `openrouter.ts` line 1 imports from `astro:env/server` — a virtual module that only exists at Astro build time. Tests must mock this module via `vi.mock("astro:env/server", ...)` to provide `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` values.

## Code References

- `src/lib/services/openrouter.ts:58-103` — `parseFlashcards`: pure function, primary Risk #1 target
- `src/lib/services/openrouter.ts:20-56` — `generateFlashcards`: fetch wrapper, secondary Risk #1 target
- `src/lib/services/openrouter.ts:7-18` — `SYSTEM_PROMPT`: oracle for expected LLM output shape
- `src/lib/services/flashcards.ts:5-109` — all four CRUD functions, Risk #4 targets
- `src/lib/services/flashcards.ts:47-51` — ILIKE search with wildcard escaping
- `src/lib/errors.ts:1-6` — `NotFoundError` class
- `src/types.ts:13-16` — `FlashcardProposal` interface
- `src/types.ts:25-31` — `PaginatedResponse` interface
- `src/pages/api/generations.ts:5-10` — `GenerateRequestSchema`
- `src/pages/api/flashcards.ts:7-48` — four Zod schemas (Save, List, Update, Delete)
- `src/pages/api/collections.ts:7-13` — two Zod schemas (Create, Delete)
- `src/pages/api/study/[id].ts:6-8` — `ParamsSchema`
- `src/pages/api/study/review.ts:7-10` — `ReviewSchema` (rating 1-4)

## Architecture Insights

1. **Dependency injection pattern**: CRUD service functions accept `SupabaseClient` as a parameter, making them easy to test with a mock client. `generateFlashcards` does NOT follow this pattern — it uses module-level imports for env vars and global `fetch`.

2. **Error hierarchy is flat**: Only `NotFoundError` exists. All other failures are generic `Error`. This is adequate for Phase 1 unit tests but limits error categorization at the API layer (everything non-NotFoundError becomes 500).

3. **Schema location**: All Zod schemas are inline in endpoint files, not in a shared schemas directory. This means importing a schema for testing also imports endpoint dependencies. For Phase 1, this can be handled by mocking, but a plan might choose to extract schemas first.

4. **`parseFlashcards` is private**: It's not exported — only `generateFlashcards` is. To unit-test parsing in isolation, either: (a) export `parseFlashcards`, (b) test through `generateFlashcards` with mocked fetch returning specific content strings, or (c) extract to a separate module. This is a **plan decision**.

5. **ILIKE escaping**: The search function escapes `%`, `_`, `,`, `.` (flashcards.ts:48). The `,` and `.` escaping is for Supabase PostgREST filter syntax (`.or()` uses commas and dots as delimiters), not SQL ILIKE. This is correct behavior but non-obvious — tests should verify it.

## Historical Context

- `context/changes/ai-flashcard-generation/plan.md` — Original plan for the generation feature; established the OpenRouter + parseFlashcards architecture
- `context/changes/flashcard-crud/plan.md` — Original plan for CRUD operations; established the service layer pattern with Supabase client injection
- `context/changes/sr-study-session/plan.md` — Added study/review endpoint with FSRS rating (1-4)
- `context/foundation/lessons.md` — Two lessons relevant to this research:
  - "Always add updated_at trigger" — the trigger exists, but unit tests cannot verify DB triggers (integration test concern, Phase 2)
  - "Always set explicit fetch timeouts" — `generateFlashcards` has no timeout on fetch; noted but not a unit test concern

## Related Research

No prior research artifacts exist for this change. This is the first research document.

## Open Questions

1. **Should `parseFlashcards` be exported for direct unit testing?** Currently private (not exported). Testing through `generateFlashcards` requires mocking fetch, which adds coupling. Exporting it enables pure-function tests. Plan should decide.

2. **Should schemas be extracted to a shared module?** Currently inline in endpoint files. Extracting them would make import-free testing easier and enable schema reuse. But the test-plan says "don't refactor beyond what the task requires." Plan should decide whether extraction is necessary or whether `vi.mock` suffices.

3. **Should `parseFlashcards` enforce max-length on front/back?** Currently no length check. SaveFlashcardsSchema enforces max 2000 at save time, but generation can produce longer strings that the user sees in review before save fails. Is this a Phase 1 concern or a product decision?

4. **Auth endpoint validation gap**: `signin.ts` and `signup.ts` have no Zod validation. This is a real Risk #5 instance but falls outside the three risks scoped to Phase 1. Should the plan note it as deferred?

5. **What is the test file convention?** Co-located (`src/lib/services/openrouter.test.ts`) or separate directory (`tests/unit/openrouter.test.ts`)? No existing convention to follow.
