---
project: FlipIt
version: 1
status: draft
created: 2026-05-28
updated: 2026-06-07
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: FlipIt

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Spaced repetition works, but creating high-quality flashcards is a time-consuming bottleneck that discourages adoption. Professionals upskilling in new domains abandon SR tools because the manual card-creation process is too slow. FlipIt uses LLM-powered generation to remove that bottleneck — paste study material, get usable flashcards immediately, and study with spaced repetition scheduling.

## North star

**S-03: User can study flashcards with spaced repetition scheduling and rate recall** — completing this slice closes the full product loop (paste text → generate flashcards → review/accept → save → study with SR), proving the end-to-end value proposition works. With `speed` as the sequencing goal, reaching this milestone as fast as possible validates whether FlipIt earns a second study session.

> The north star is the smallest end-to-end flow whose successful delivery proves the core product hypothesis — the idea that removing the flashcard-creation bottleneck via AI makes spaced repetition accessible to time-constrained professionals. It is placed as early as prerequisites allow because everything else only matters if this works.

## At a glance

| ID   | Change ID               | Outcome (user can ...)                                                                      | Prerequisites    | PRD refs                              | Status   |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------- | -------- |
| S-01 | ai-flashcard-generation | paste text, generate AI flashcards, review/edit/accept/reject, and save to collection       | —                | US-01, FR-001, FR-002, FR-003, FR-004 | done     |
| S-03 | sr-study-session        | study saved flashcards with spaced repetition scheduling and rate recall                    | S-01             | FR-009, FR-010                        | done     |
| S-02 | flashcard-crud          | manually create a flashcard, browse collection with text search, edit and delete flashcards | S-01             | FR-005, FR-006, FR-007, FR-008        | done     |
| S-04 | collection-assignment   | choose a target collection when generating AI flashcards, creating manually, or editing     | S-01, S-02       | —                                     | proposed |
| S-05 | bulk-flashcard-actions  | select multiple flashcards and bulk-delete or bulk-change collection                        | S-02             | —                                     | proposed |
| S-06 | new-ui                  | see the final visual design across all screens (responsive, animated, polished)             | S-01, S-02, S-03 | —                                     | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme               | Chain                             | Note                                                                      |
| ------ | ------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| A      | Core loop           | `S-01` → `S-03`                   | North-star path — fastest route to proving the full generate-study cycle. |
| B      | Collection mgmt     | `S-02` → `S-05`                   | CRUD then bulk actions. Parallel with Stream A after `S-01` lands.        |
| C      | Collection workflow | `S-01` + `S-02` → `S-04`          | Deck assignment across generation, manual creation, and edit flows.       |
| D      | Visual polish       | `S-01` + `S-02` + `S-03` → `S-06` | Full UI redesign per `context/design/new-ui.md`. Parallel with S-04/S-05. |

## Baseline

What's already in place in the codebase as of 2026-05-28 (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 + React 19, shadcn/ui (Radix + Lucide), Tailwind CSS 4, file-based routing (`src/pages/`)
- **Backend / API:** partial — Astro server mode with Cloudflare adapter; only auth API endpoints exist (`src/pages/api/auth/`)
- **Data:** partial — Supabase client configured (`src/lib/supabase.ts`); no schema, no migrations, no seed data
- **Auth:** present — Supabase auth with cookie-based sessions (`@supabase/ssr`), middleware route protection (`src/middleware.ts`), signin/signup/signout endpoints
- **Deploy / infra:** partial — Cloudflare adapter in `astro.config.mjs`, GitHub Actions CI (`.github/workflows/ci.yml`: lint + build), no IaC/Dockerfile
- **Observability:** absent — no logging library, no error tracking, no metrics

## Foundations

No foundations required. Auth and frontend are present in the baseline. The flashcard database schema and SR scheduling state are introduced inside the vertical slices that first need them (progressive disclosure), avoiding horizontal pre-build of layers that would only be exercised later.

## Slices

### S-01: AI flashcard generation

- **Outcome:** user can paste study text, trigger AI flashcard generation, review/edit/accept/reject each proposed card (with a bulk "accept all" shortcut), and save accepted cards to their collection
- **Change ID:** ai-flashcard-generation
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Which LLM provider to use for generation (e.g., OpenRouter, OpenAI, Anthropic)? — Owner: user. Block: no.
- **Risk:** LLM integration quality and streaming UX are the main unknowns; sequenced first because every other slice depends on flashcards existing and this is the core value proposition — if generation quality is poor, the product hypothesis fails early rather than late.
- **Status:** done

### S-03: Study session with spaced repetition

- **Outcome:** user can start a study session that presents flashcards using spaced repetition scheduling and rate their recall to feed the SR algorithm
- **Change ID:** sr-study-session
- **PRD refs:** FR-009, FR-010
- **Prerequisites:** S-01
- **Parallel with:** S-02
- **Blockers:** —
- **Unknowns:**
  - Which existing SR library to use (PRD mandates no custom algorithm)? — Owner: user. Block: no.
- **Risk:** SR library integration complexity; sequenced right after S-01 because it completes the north star — if SR proves harder than expected, it delays the validation milestone that proves the full product loop.
- **Status:** done

### S-02: Flashcard CRUD

- **Outcome:** user can manually create a flashcard (front/back), browse their collection with basic text search, edit an existing flashcard, and delete a flashcard
- **Change ID:** flashcard-crud
- **PRD refs:** FR-005, FR-006, FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Standard CRUD with low technical risk; sequenced after S-01 and listed after S-03 because it is not on the north-star path — if time runs out, generation + study still deliver the core product value without manual CRUD.
- **Status:** done

### S-04: Collection assignment across flows

- **Outcome:** user can select a target collection when saving AI-generated flashcards (picker in the review toolbar), when creating a flashcard manually (dropdown in the create form), and when editing a single flashcard (dropdown in edit mode)
- **Change ID:** collection-assignment
- **PRD refs:** —
- **Prerequisites:** S-01, S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Collections table and `collection_id` FK already exist. Main work is UI: a shared collection picker component reused in three places.
- **Status:** proposed

### S-05: Bulk flashcard actions

- **Outcome:** user can multi-select flashcards in the collection view and apply bulk delete or bulk change-collection; single-card delete remains available outside bulk mode
- **Change ID:** bulk-flashcard-actions
- **PRD refs:** —
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Low. Standard multi-select + batch API pattern. Needs a new bulk endpoint or batched calls; RLS already scopes to the current user.
- **Status:** proposed

### S-06: Implement the final design

- **Outcome:** user sees the final visual design across all 9 screens — responsive layouts, 3D card-flip animation, source badges (AI/manual), delete-with-undo timers, mobile-friendly topbar, character counters, and a cohesive design system — as specified in `context/design/new-ui.md`
- **Change ID:** new-ui
- **PRD refs:** —
- **Prerequisites:** S-01, S-02, S-03
- **Parallel with:** S-04, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Medium. Scope is broad (9 screens, ~25 states) but purely presentational — no new data models or API changes. Main risk is underestimating the effort for the 3D flip animation and responsive breakpoints across all variants.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                       | Ready for `/10x-plan` | Notes                                   |
| ---------- | ----------------------- | ----------------------------------------------------------- | --------------------- | --------------------------------------- |
| S-01       | ai-flashcard-generation | AI flashcard generation: paste, generate, review, save      | yes                   | Run `/10x-plan ai-flashcard-generation` |
| S-03       | sr-study-session        | Study session with spaced repetition scheduling             | no                    | Depends on S-01                         |
| S-02       | flashcard-crud          | Flashcard CRUD: create, browse, search, edit, delete        | no                    | Depends on S-01                         |
| S-04       | collection-assignment   | Collection assignment: generation, creation, and edit flows | no                    | Depends on S-01 + S-02                  |
| S-05       | bulk-flashcard-actions  | Bulk flashcard actions: multi-select, delete, move          | no                    | Depends on S-02                         |
| S-06       | new-ui                  | Implement the final design across all screens               | yes                   | Run `/10x-plan new-ui`                  |

## Open Roadmap Questions

No blocking roadmap-level questions. PRD `## Open Questions` reports zero unresolved items. Per-slice unknowns (LLM provider, SR library) are non-blocking implementation decisions that resolve during `/10x-plan`.

## Parked

- **Custom SR algorithm** — Why parked: PRD §Non-Goals. Use an existing library; no novel scheduling research.
- **File import (PDF, DOCX)** — Why parked: PRD §Non-Goals. MVP is paste-text-only.
- **Sharing / collaboration** — Why parked: PRD §Non-Goals. Single-user collections only.
- **Mobile app / offline-first** — Why parked: PRD §Non-Goals. Web-only, online-only for MVP.
- **Observability** — Why parked: absent in baseline, not required by any NFR for MVP validation. LLM generation errors are logged to console as a stopgap. Revisit full observability post-MVP if retention signal (secondary Success Criterion) warrants monitoring.
- **Infrastructure-as-code** — Why parked: deploy works via Cloudflare adapter + GitHub Actions CI. No IaC needed until scaling or multi-environment concerns arise.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)

- **S-01: user can paste study text, trigger AI flashcard generation, review/edit/accept/reject each proposed card (with a bulk "accept all" shortcut), and save accepted cards to their collection** — Archived 2026-06-07 → `context/archive/2026-06-01-ai-flashcard-generation/`. Lesson: —.
- **S-02: user can manually create a flashcard (front/back), browse their collection with basic text search, edit an existing flashcard, and delete a flashcard** — Archived 2026-06-07 → `context/archive/2026-06-03-flashcard-crud/`. Lesson: —.
- **S-03: user can start a study session that presents flashcards using spaced repetition scheduling and rate their recall to feed the SR algorithm** — Archived 2026-06-07 → `context/archive/2026-06-04-sr-study-session/`. Lesson: —.
