# Study Session with Spaced Repetition — Plan Brief

> Full plan: `context/changes/sr-study-session/plan.md`
> Research: `context/changes/sr-study-session/research.md`
> Library comparison: `context/changes/sr-study-session/research-sr-libraries.md`
> ts-fsrs API reference: `context/changes/sr-study-session/research-ts-fsrs-api.md`

## What & Why

Implement per-collection study sessions with spaced repetition scheduling using ts-fsrs — the S-03 north-star milestone that closes FlipIt's full product loop (paste text → generate cards → organize into collections → study with SR → rate recall). This fulfills PRD requirements FR-009 and FR-010.

## Starting Point

Flashcards table exists with full CRUD (S-02). No collections, no SR state, no review logging. The codebase has strong, consistent patterns (Zod-validated API routes, service layer, discriminated-union React state machines, shadcn/ui) that the new feature follows directly. ts-fsrs is confirmed compatible across all dimensions — DB, API, runtime, types, build.

## Desired End State

Users organize flashcards into named collections and study due cards in a session: see front → flip to reveal back → rate recall (Again/Hard/Good/Easy) → FSRS schedules next review. A study landing page shows collections with due-card counts. When all caught up, users see when the next review is scheduled.

## Key Decisions Made

| Decision                | Choice                                 | Why (1 sentence)                                                                        | Source   |
| ----------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- | -------- |
| SR library              | ts-fsrs                                | 81% more accurate than SM-2, 51.9K weekly downloads, zero deps, edge-compatible         | Research |
| SR state storage        | Separate flashcard_sr_state join table | Clean separation; SR state independently resettable without touching flashcard rows     | Plan     |
| Study scoping           | Per-collection via /study/[id]         | Users can focus on specific material; supports future deck organization                 | Plan     |
| Collection model        | New collections table + minimal UI     | Enables per-collection study; generation_id proxy was too limiting                      | Plan     |
| Existing card bootstrap | All become "new" (due immediately)     | Simplest migration; no enrollment friction; session batching handles the initial flood  | Plan     |
| Session size            | All due cards in scope                 | No hidden due cards; natural SR distribution prevents overwhelming sessions after first | Plan     |
| Empty state             | Congratulations + next due date        | Informative and encouraging; tells user when to return; one MIN(due) query              | Plan     |
| Interval previews       | Client-side via ts-fsrs repeat()       | No extra API call; pure computation (~μs); server is authoritative for actual state     | Plan     |

## Scope

**In scope:** Collections CRUD, SR state tracking (join table), review logging, study session API, study session UI (card flip + 4-point rating), empty/complete states, navigation integration

**Out of scope:** Custom SR algorithm, optimizer/parameter training, collection sharing, study statistics dashboard, undo/rollback rating, auto-collection from generation flow, review log pruning

## Architecture / Approach

Additive-only integration across 4 layers: Supabase schema (collections + SR state + review logs) → collections backend + minimal UI → study backend with ts-fsrs → study session React UI. ts-fsrs runs client-side for interval previews and server-side for authoritative state updates. The scheduler is stateless (created per-request), matching Astro's per-request API model. A database trigger auto-creates SR state rows on flashcard insert, guaranteeing every card is schedulable.

## Phases at a Glance

| Phase                       | What it delivers                                                | Key risk                                                                     |
| --------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Database Schema          | collections, flashcard_sr_state, review_logs tables + bootstrap | Trigger on flashcard INSERT must work across all creation paths              |
| 2. Collections Backend + UI | CRUD API + minimal React UI for organizing cards                | Scope creep beyond minimal — keep to list/create/delete/assign only          |
| 3. Study Session Backend    | ts-fsrs integration, due-cards query, review processing API     | JOIN query performance on flashcard_sr_state for large card sets             |
| 4. Study Session UI         | Card flip, rating buttons with previews, session flow           | Client-side ts-fsrs preview/server-side commit timestamp mismatch (harmless) |

**Prerequisites:** S-01 (AI flashcard generation) complete; S-02 (flashcard CRUD) complete; local Supabase running
**Estimated effort:** ~4 sessions across 4 phases

## Open Risks & Assumptions

- Collections are a scope expansion beyond FR-009/FR-010 — kept minimal but adds implementation surface
- Users with many existing cards (200+) will see all of them due in their first session — FSRS naturally distributes them after initial ratings
- Review logs are retained indefinitely (no pruning policy) — acceptable for MVP data volumes
- Default FSRS parameters are used without per-user optimization — research-backed defaults work well without training data

## Success Criteria (Summary)

- User can create a collection, assign flashcards, and complete a study session with card flip + recall rating
- SR algorithm schedules reviews at increasing intervals based on recall quality (Again = minutes, Easy = days)
- Returning to study shows only actually-due cards, with next-review date when all caught up
