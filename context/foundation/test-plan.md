# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-06

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression.
2. **User concerns are first-class evidence.** Risks anchored in "the
   team is worried about X, and the failure would surface somewhere in
   area Y" carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents _what
   could fail_ and _why we believe it's likely_ — drawn from documents,
   interview, and codebase _signal_ (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `src/`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the _evidence that surfaced
this risk_ — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| #   | Risk (failure scenario)                                                                                                                          | Impact | Likelihood | Source (evidence — not anchor)                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | LLM returns invalid/unparseable response; user sees error or blank cards instead of a graceful retry path                                        | High   | High       | Interview Q1 ("invalid/corrupted LLM responses breaking main flow"), hot-spot dir `src/lib/services/` (11 commits/30d), PRD FR-003/FR-004                         |
| 2   | User can access another user's flashcards, collections, or SR state (IDOR/RLS bypass)                                                            | High   | Medium     | PRD §Access Control ("each user sees only their own data"), tech-stack.md (has_auth: true), 4 tables with independent RLS policies                                |
| 3   | SR scheduling state corrupted or lost after rating — cards become due again or never resurface                                                   | High   | Medium     | PRD §Guardrails ("study progress is never lost"), roadmap S-03 risk note ("SR library integration complexity"), hot-spot dir `src/lib/services/` (11 commits/30d) |
| 4   | Flashcard CRUD operations fail silently or return stale data (edit doesn't persist, delete leaves ghost, search misses cards)                    | Medium | High       | Interview Q3 ("generation and deck management flow" confidence gap), hot-spot dir `src/pages/api/` (8 commits/30d), PRD FR-005–FR-008                             |
| 5   | Server accepts invalid input (empty text, oversized text, malformed UUIDs, out-of-range ratings) producing 500s instead of structured 400 errors | Medium | Medium     | PRD NFR (continuous visible feedback), all 3 change plans note Zod validation, abuse lens: untrusted input                                                        |
| 6   | Collection due counts are wrong — study landing page shows incorrect number of cards due, misleading user about what to study                    | Medium | Medium     | Roadmap S-03 plan Phase 2 (collections with due_count subqueries), interview Q3 ("deck management flow"), FK ON DELETE SET NULL interaction                       |
| 7   | Protected route accessible without login — unauthenticated user reaches flashcard data or study session                                          | High   | Low        | PRD §Access Control, hot-spot dir `src/middleware.ts` (4 commits/30d), all 3 change plans update PROTECTED_ROUTES                                                 |

### Risk Response Guidance

| Risk | What would prove protection                                                                                                                                   | Must challenge                                                                                                                              | Context `/10x-research` must ground                                                                                                                          | Likely cheapest layer                                                                      | Anti-pattern to avoid                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| #1   | Generation endpoint returns structured error with retry affordance when LLM returns malformed/empty/truncated JSON — never blank cards or unhandled crash     | "If Zod validates the request, the response is safe" — Zod guards input, not the LLM output parsing path; the LLM can return anything       | How OpenRouter service parses LLM responses; error paths between raw response and FlashcardProposal[]; whether partial/malformed JSON is caught and surfaced | Unit test (mock fetch, test parsing paths)                                                 | Happy-path-only: testing valid JSON array while ignoring malformed, empty, or truncated LLM output                                       |
| #2   | API request for another user's resource returns 404/empty, never the other user's data — across all four tables                                               | "RLS is enabled, so data is isolated" — policies must be correct per table AND app code must pass auth.uid(), not an attacker-controlled ID | Which tables have RLS, whether all service functions filter by user_id, whether any endpoint passes attacker-controlled user_id instead of auth.uid()        | Integration test (two users, cross-access attempt)                                         | Testing only that authenticated requests succeed without verifying cross-user isolation                                                  |
| #3   | After rating, SR state row reflects FSRS output (correct due date, updated reps/difficulty); subsequent study query returns only actually-due cards           | "Trigger auto-creates SR state, so every card has one" — trigger could fail silently; review API could partially update state               | processReview transaction boundary, auto-create trigger behavior, ts-fsrs input/output mapping, partial-update failure modes                                 | Integration test (create card → verify SR state → rate → verify update → verify due query) | Implementation mirror: copying ts-fsrs calculation into test assertion — assert behavioral contract (Again → due soon, Easy → due later) |
| #4   | Update returns modified card with new updated_at; delete succeeds then get returns 404; search returns only matching cards; pagination metadata is consistent | "CRUD is standard Supabase queries" — edge cases: empty search, ILIKE wildcard injection, not-found, already-deleted                        | Zod schemas per endpoint, NotFoundError handling, updated_at trigger, ILIKE escaping implementation                                                          | Integration test (API round-trips with edge cases)                                         | Testing only happy-path CRUD without empty-input, not-found, already-deleted edge cases                                                  |
| #5   | Server rejects missing/invalid fields, oversized text, malformed UUIDs, out-of-range ratings with structured 400 errors, not 500s                             | "Zod validates on server, so input is safe" — does every endpoint use Zod? Are path params validated? Is the rating constrained to 1–4?     | Every API endpoint's Zod schema coverage, whether path params (e.g., collection ID) are validated, rating value constraints                                  | Unit test (Zod schema boundary tests)                                                      | Testing only that valid input succeeds — must test invalid boundaries                                                                    |
| #6   | Assigning card updates count; deleting collection sets cards unassigned without losing them; due counts reflect only actually-due cards, not all cards        | "ON DELETE SET NULL handles cleanup" — but does due_count correctly filter by `due <= now()`?                                               | listCollections query structure, card_count/due_count joins/subqueries, FK ON DELETE SET NULL behavior                                                       | Integration test (collection lifecycle with count assertions)                              | Testing collection CRUD in isolation without verifying computed counts reflect real card state                                           |
| #7   | Unauthenticated request to any protected page/endpoint redirects to sign-in or returns 401                                                                    | "Middleware checks PROTECTED_ROUTES" — but API routes have their own auth guards separate from middleware; are all routes actually covered? | PROTECTED_ROUTES list vs. actual pages, API route-level auth guards, whether any route should be protected but isn't                                         | Integration test (unauthenticated requests to all endpoints)                               | Testing only middleware without checking API route-level auth guards                                                                     |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| #   | Phase name                       | Goal (one line)                                                                                                             | Risks covered  | Test types  | Status        | Change folder                       |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------- | ------------- | ----------------------------------- |
| 1   | Critical-path unit coverage      | Bootstrap Vitest and defend top risks at cheapest layer: LLM parsing failures, CRUD edge cases, input validation boundaries | #1, #4, #5     | unit        | done          | testing-critical-path-unit-coverage |
| 2   | Data integrity integration tests | Prove IDOR protection, SR state lifecycle, collection count accuracy, and auth guards at integration level                  | #2, #3, #6, #7 | integration | change opened | testing-data-integrity-integration  |
| 3   | Quality gates                    | Lock the floor: add test commands to existing CI so regressions cannot merge                                                | cross-cutting  | CI gates    | not started   | —                                   |

## 4. Stack

| Layer              | Tool                                    | Version                | Notes                                                                                                       |
| ------------------ | --------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Unit + integration | Vitest                                  | none yet — see Phase 1 | Standard for Vite-based projects (Astro uses Vite); fast, ESM-native, TypeScript out of the box             |
| API mocking        | Vitest built-in `vi.fn()` / `vi.mock()` | —                      | Mock fetch for LLM tests; mock Supabase client for service tests                                            |
| e2e                | none planned                            | —                      | User excludes UI testing (interview Q5); critical-path coverage at unit+integration level per cost × signal |
| Accessibility      | none planned                            | —                      | Out of scope per cost × signal and user preference                                                          |

**Stack grounding tools (current session):**

- Docs: Context7 MCP — available; can verify Vitest/Astro/Supabase APIs during rollout phases; checked: 2026-06-06
- Search: Exa.ai MCP — available; can verify tool currency and discover best practices; checked: 2026-06-06
- Runtime/browser: none — no Playwright MCP or browser tool in current session; checked: 2026-06-06
- Provider/platform: Supabase MCP — available; can inspect schema/RLS/tables for quality-gate verification; checked: 2026-06-06

## 5. Quality Gates

| Gate              | Where      | Required?                 | Catches                                                     |
| ----------------- | ---------- | ------------------------- | ----------------------------------------------------------- |
| Lint + typecheck  | local + CI | required (already wired)  | Syntactic / type drift                                      |
| Unit tests        | local + CI | required after §3 Phase 1 | Logic regressions in LLM parsing, validation, CRUD services |
| Integration tests | local + CI | required after §3 Phase 2 | Data integrity regressions, auth bypass, cross-user access  |
| Build             | local + CI | required (already wired)  | SSR build failures, import resolution                       |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section reads
"TBD — see §3 Phase N."

### 6.1 Adding a unit test for a service function

1. Create `<module>.test.ts` next to the source file (co-located).
2. Env mocking is automatic — `vitest.config.ts` aliases `astro:env/server` to `src/test/mocks/astro-env-server.ts`. No per-test `vi.mock` needed unless you need to vary env values (use `vi.hoisted` + top-level `vi.mock` in that case).
3. For Supabase service functions, create a chainable mock: an object where every method (`from`, `select`, `eq`, `order`, `range`, `or`, `insert`, `update`, `delete`, `single`) returns `this`, with a `then` property that resolves to `{ data, error, count }`. Pass it as the `SupabaseClient` parameter.
4. Structure: one `describe` per function, one `it` per scenario. Cover: happy path, error propagation, edge cases (empty input, not-found, escaping).
5. For `NotFoundError` assertions, use `toBeInstanceOf(NotFoundError)` — not just message matching.

### 6.2 Adding a unit test for Zod validation

1. Create `<endpoint>.test.ts` next to the endpoint file (co-located).
2. Import the exported schema directly: `import { MySchema } from "@/pages/api/myendpoint"`.
3. Use `.safeParse(input)` and assert on `.success` (boolean). For error details, check `.error.issues`.
4. Cover per schema: one valid input, one at-boundary input (min/max), one above-boundary, one wrong-type, one missing-field. For cross-field refinements, test both valid and invalid combinations.
5. Use a shared `VALID_UUID` constant for UUID fields to keep tests readable.

### 6.3 Adding an integration test for an API endpoint

TBD — see §3 Phase 2 for IDOR / auth guard / data-lifecycle pattern.

### 6.4 Adding a test for a new API endpoint

TBD — see §3 Phase 2 for auth + contract validation pattern.

### 6.5 Per-rollout-phase notes

(After each phase lands, the final sub-phase appends a 2–3 line note here
capturing anything surprising the rollout phase taught.)

**Phase 1 (Critical-path unit coverage):** The `astro:env/server` virtual module requires a global resolve alias in `vitest.config.ts` — per-test `vi.mock` is fragile due to hoisting. For tests needing per-test env value control (e.g. missing API key), use `vi.hoisted()` to create a mutable mock object at the top level. The `parseFlashcards` function had no min/max length enforcement on front/back strings — a validation gap between generation and save time, fixed as part of this phase.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **UI component rendering** — no React component render tests or snapshot tests. shadcn/ui components are tested upstream by Radix; Astro pages are thin shells. Re-evaluate if custom complex interactive components are added. (Source: interview Q5.)
- **Configuration files** — no tests for astro.config, eslint.config, wrangler.jsonc, etc. These are validated by lint + build gates. Re-evaluate if config-driven business logic is introduced. (Source: interview Q5.)
- **Infrastructure** — no tests for Cloudflare Workers runtime, Supabase connection, deployment pipeline. These are covered by the existing CI build gate and manual smoke testing. Re-evaluate if multi-environment deployments are added. (Source: interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-06
- Stack versions last verified: 2026-06-06
- AI-native tool references last verified: n/a (no AI-native tools in stack)

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
