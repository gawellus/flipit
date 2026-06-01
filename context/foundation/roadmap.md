---
project: FlipIt
version: 1
status: draft
created: 2026-05-28
updated: 2026-05-28
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

| ID   | Change ID               | Outcome (user can ...)                                                                      | Prerequisites | PRD refs                              | Status   |
| ---- | ----------------------- | ------------------------------------------------------------------------------------------- | ------------- | ------------------------------------- | -------- |
| S-01 | ai-flashcard-generation | paste text, generate AI flashcards, review/edit/accept/reject, and save to collection       | —             | US-01, FR-001, FR-002, FR-003, FR-004 | ready    |
| S-03 | sr-study-session        | study saved flashcards with spaced repetition scheduling and rate recall                    | S-01          | FR-009, FR-010                        | proposed |
| S-02 | flashcard-crud          | manually create a flashcard, browse collection with text search, edit and delete flashcards | S-01          | FR-005, FR-006, FR-007, FR-008        | proposed |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme           | Chain           | Note                                                                      |
| ------ | --------------- | --------------- | ------------------------------------------------------------------------- |
| A      | Core loop       | `S-01` → `S-03` | North-star path — fastest route to proving the full generate-study cycle. |
| B      | Collection mgmt | `S-02`          | Parallel with Stream A after `S-01` lands. Standard CRUD, lowest risk.    |

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
- **Status:** ready

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
- **Status:** proposed

### S-02: Flashcard CRUD

- **Outcome:** user can manually create a flashcard (front/back), browse their collection with basic text search, edit an existing flashcard, and delete a flashcard
- **Change ID:** flashcard-crud
- **PRD refs:** FR-005, FR-006, FR-007, FR-008
- **Prerequisites:** S-01
- **Parallel with:** S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Standard CRUD with low technical risk; sequenced after S-01 and listed after S-03 because it is not on the north-star path — if time runs out, generation + study still deliver the core product value without manual CRUD.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID               | Suggested issue title                                  | Ready for `/10x-plan` | Notes                                   |
| ---------- | ----------------------- | ------------------------------------------------------ | --------------------- | --------------------------------------- |
| S-01       | ai-flashcard-generation | AI flashcard generation: paste, generate, review, save | yes                   | Run `/10x-plan ai-flashcard-generation` |
| S-03       | sr-study-session        | Study session with spaced repetition scheduling        | no                    | Depends on S-01                         |
| S-02       | flashcard-crud          | Flashcard CRUD: create, browse, search, edit, delete   | no                    | Depends on S-01                         |

## Open Roadmap Questions

No blocking roadmap-level questions. PRD `## Open Questions` reports zero unresolved items. Per-slice unknowns (LLM provider, SR library) are non-blocking implementation decisions that resolve during `/10x-plan`.

## Parked

- **Custom SR algorithm** — Why parked: PRD §Non-Goals. Use an existing library; no novel scheduling research.
- **File import (PDF, DOCX)** — Why parked: PRD §Non-Goals. MVP is paste-text-only.
- **Sharing / collaboration** — Why parked: PRD §Non-Goals. Single-user collections only.
- **Mobile app / offline-first** — Why parked: PRD §Non-Goals. Web-only, online-only for MVP.
- **Observability** — Why parked: absent in baseline, not required by any NFR for MVP validation. Revisit post-MVP if retention signal (secondary Success Criterion) warrants monitoring.
- **Infrastructure-as-code** — Why parked: deploy works via Cloudflare adapter + GitHub Actions CI. No IaC needed until scaling or multi-environment concerns arise.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)
