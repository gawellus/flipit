# Critical-Path Unit Coverage — Plan Brief

> Full plan: `context/changes/testing-critical-path-unit-coverage/plan.md`
> Research: `context/changes/testing-critical-path-unit-coverage/research.md`

## What & Why

Bootstrap Vitest from zero and write unit tests for the three highest-priority risks in the test plan: LLM response parsing failures (Risk #1), CRUD service edge cases (Risk #4), and Zod input validation boundaries (Risk #5). This is Phase 1 of the phased test rollout defined in `context/foundation/test-plan.md` — the cheapest test layer that gives real signal for these risks.

## Starting Point

No test infrastructure exists — no Vitest, no config, no test files, no scripts. `parseFlashcards` is a private function with no length validation. Nine Zod schemas are defined inline in endpoint files but not exported. CRUD service functions already accept `SupabaseClient` as a parameter (dependency injection), making them mock-friendly.

## Desired End State

`npm test` runs a full unit test suite (~85 scenarios) in under 5 seconds with zero external dependencies. Every error path in LLM parsing is covered, CRUD edge cases (NotFoundError, ILIKE escaping, empty input) are locked, and all 9 Zod schemas have boundary tests. The test-plan cookbook (§6.1, §6.2) documents the patterns for future contributors.

## Key Decisions Made

| Decision                      | Choice                                    | Why (1 sentence)                                                                                | Source   |
| ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| `parseFlashcards` testability | Export the function                       | Enables pure-function tests with zero mocking — highest signal per cost                         | Plan     |
| Schema access strategy        | Export in-place + vi.mock                 | Minimal code changes; tests verify actual production schemas                                    | Plan     |
| Test file location            | Co-located (`*.test.ts` next to source)   | Common Vitest convention; keeps related code together                                           | Plan     |
| `parseFlashcards` length gap  | Fix before testing (add min 1 / max 2000) | Aligns generation-time validation with SaveFlashcardsSchema so users never see unsaveable cards | Plan     |
| Auth endpoint validation gap  | Defer, note in "Not Doing"                | Keeps Phase 1 focused; adding schemas to auth is a production change outside scope              | Research |
| `astro:env/server` mocking    | Resolve alias in vitest.config.ts         | One-time global setup; no per-test `vi.mock()` needed                                           | Research |

## Scope

**In scope:**

- Vitest installation, config, npm scripts
- Export `parseFlashcards` + all 9 Zod schemas
- Add length validation to `parseFlashcards` (min 1, max 2000)
- Unit tests for `parseFlashcards` and `generateFlashcards` (Risk #1)
- Unit tests for 4 CRUD service functions with mock Supabase client (Risk #4)
- Boundary tests for 9 Zod schemas (Risk #5)
- Cookbook update (test-plan §6.1, §6.2, §6.5)

**Out of scope:**

- Auth endpoint Zod validation (signin.ts, signup.ts have no server-side Zod)
- Integration tests (Phase 2)
- CI gate wiring (Phase 3)
- UI/component tests (test-plan §7)
- Schema extraction to shared module
- Mutation testing (Stryker)

## Architecture / Approach

All tests are pure unit tests — mocked dependencies, no I/O. `astro:env/server` (Astro virtual module) is resolved via a single alias in `vitest.config.ts` pointing to a mock file. CRUD tests use a chainable mock `SupabaseClient`. Zod tests call `.safeParse()` directly on exported schemas. Test files live next to their source files.

## Phases at a Glance

| Phase                                      | What it delivers                                       | Key risk                                                                         |
| ------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1. Bootstrap test infrastructure           | Vitest installed, configured, smoke test green         | `astro:env/server` alias misconfigured → all subsequent phases blocked           |
| 2. Testability & parseFlashcards hardening | Exported functions/schemas, length validation fix      | Length validation change could alter existing behavior for edge-case LLM outputs |
| 3. Risk #1 — LLM parsing tests             | ~22 scenarios for parseFlashcards + generateFlashcards | Mocking fetch for generateFlashcards adds some coupling                          |
| 4. Risk #4 — CRUD edge-case tests          | ~15 scenarios for 4 service functions                  | Chainable Supabase mock complexity                                               |
| 5. Risk #5 — Zod boundary tests            | ~50 boundary scenarios for 9 schemas                   | Transitive imports from endpoint files need working alias                        |
| 6. Cookbook & plan sync                    | test-plan §6 updated, change closed                    | None                                                                             |

**Prerequisites:** None — this is the first test infrastructure in the project.
**Estimated effort:** ~2-3 implementation sessions across 6 phases.

## Open Risks & Assumptions

- `astro:env/server` alias approach assumes Vitest's `resolve.alias` intercepts the import before any Astro build-time resolution — verified by smoke test in Phase 1
- The `parseFlashcards` length fix (Phase 2) changes production behavior — if LLM generates valid content that happens to be >2000 chars, it will be silently filtered instead of shown to the user. This matches the save-time constraint, so it's the correct behavior.
- Zod schema tests import from endpoint files, which transitively import service modules. The alias resolves `astro:env/server` globally, but if endpoint files gain new virtual-module imports in the future, tests may need additional mocks.

## Success Criteria (Summary)

- `npm test` exits 0 with all ~85 scenarios passing across 7 test files
- `npm run lint` and `npm run build` still pass (no regressions)
- test-plan §6 cookbook patterns are clear enough for a new contributor to add tests without reading this plan
