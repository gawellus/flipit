---
project: FlipIt
version: 1
status: draft
created: 2026-05-20
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Spaced repetition is one of the most effective learning methods, but creating high-quality flashcards is a time-consuming bottleneck that discourages adoption. Professionals upskilling in new domains — learning a programming language, preparing for a certification, absorbing domain knowledge — either spend disproportionate time manually writing cards in tools like Anki, or abandon spaced repetition entirely.

Existing flashcard tools are powerful but complex, with steep learning curves and no AI-assisted generation. The insight: LLM-powered flashcard generation can remove the prep bottleneck, making spaced repetition accessible to people who know the method works but can't justify the setup cost. FlipIt combines AI generation with a simple interface — the tool gets out of the way so the learner can focus on learning.

## User & Persona

### Primary persona

A professional learning new skills — someone upskilling in a new programming language, preparing for a certification, or absorbing domain knowledge for a career shift. They have study material (articles, documentation, notes) and know spaced repetition works, but the manual flashcard creation process is too slow and too tedious to sustain alongside a full-time job. They want to paste their material and get usable flashcards immediately.

## Success Criteria

### Primary
- End-to-end flow works: a user can paste text, get AI-generated flashcards, review/edit them, save to collection, and study with spaced repetition scheduling.
- 75% of AI-generated flashcards are accepted by the user (quality bar for AI generation).
- 75% of flashcards are created using AI rather than manually (proves AI removes the bottleneck).

### Secondary
- Users return for a second study session (retention signal — the tool earned a habit).

### Guardrails
- Study progress is never lost — SR scheduling state and card edits persist reliably across sessions.

## User Stories

### US-01: Professional generates flashcards from study material

- **Given** a logged-in user on the home/dashboard view
- **When** they paste study text into the generation form and trigger AI generation
- **Then** they see a list of proposed flashcards they can accept, edit, or reject

#### Acceptance Criteria
- AI generates flashcards with distinct front (question/prompt) and back (answer) sides
- User can edit any card's front or back before accepting
- Rejected cards are discarded, not saved
- Accepted cards appear in the user's collection immediately

## Functional Requirements

### Authentication
- FR-001: User can create an account using email + password or OAuth. Priority: must-have
  > Socrates: No counter-argument; auth is necessary for per-user flashcard storage.
- FR-002: User can log in and log out. Priority: must-have
  > Socrates: No counter-argument; login/logout is basic auth hygiene for multi-user web apps.

### AI Generation
- FR-003: User can paste source text and trigger AI flashcard generation. Priority: must-have
  > Socrates: No counter-argument; paste-and-generate is the core value proposition.
- FR-004: User can review AI-generated flashcards — accept, edit, or reject each one, with a bulk "accept all" shortcut. Priority: must-have
  > Socrates: Counter-argument considered: "per-card review is slow for 20+ cards — batch accept might better match the 'fast' value prop." Resolution: kept per-card review for quality control, but added a bulk "accept all" shortcut for users who trust the AI output.

### Flashcard Management
- FR-005: User can manually create a flashcard (front/back). Priority: must-have
  > Socrates: No counter-argument; manual creation is a simple, low-cost safety net.
- FR-006: User can browse their flashcard collection with basic text search. Priority: must-have
  > Socrates: Counter-argument considered: "flat browsing without search fails at 200+ cards." Resolution: added basic search over card fronts/backs — low effort, big usability gain.
- FR-007: User can edit an existing flashcard. Priority: must-have
  > Socrates: No counter-argument; edit is basic CRUD essential for user-owned collections.
- FR-008: User can delete a flashcard. Priority: must-have
  > Socrates: No counter-argument; delete is basic CRUD essential for user-owned collections.

### Study Session
- FR-009: User can start a study session using spaced repetition scheduling. Priority: must-have
  > Socrates: No counter-argument; SR is core to the product identity.
- FR-010: User can rate their recall during study to feed the SR algorithm. Priority: must-have
  > Socrates: No counter-argument; self-rating is the standard SR input method.

## Non-Functional Requirements

- Continuous visible feedback during any AI generation operation that takes longer than two seconds. The user should never face an unresponsive screen during generation.
- Non-AI interactions (browsing cards, flipping during study, navigation) have a user-perceived response time under one second.
- The product remains usable on the latest two major versions of Chrome, Firefox, Safari, and Edge. No mobile-first requirement for MVP.
- Source text submitted for flashcard generation is used only for that generation request and is not retained in operator-accessible storage beyond what is needed to produce the cards.

## Business Logic

Given raw study text, the system identifies key concepts and generates question-answer flashcard pairs structured for effective spaced repetition — clear question, concise answer, one concept per card.

The rule consumes a single input: raw text pasted by the user (articles, documentation, lecture notes, or any prose). The output is a set of flashcard proposals, each with a front (question or prompt) and a back (answer). Each card isolates one concept — no multi-part questions, no compound answers. The user encounters this rule immediately after pasting text and triggering generation: they see the proposed cards in a review interface where they can accept, edit, or reject each one before it enters their collection.

## Access Control

Login via email + password or OAuth. Flat user model — all users have the same capabilities: create, generate, edit, and delete their own flashcards. No admin role in MVP. Each user sees only their own data.

## Non-Goals

- No custom SR algorithm — use an existing spaced repetition library. No custom scheduling research or novel algorithm development.
- No file import (PDF, DOCX, etc.) — MVP is paste-text-only. No file upload, no format parsing.
- No sharing or collaboration — no shared decks, no team workspaces, no social features. Single-user collections only.
- No mobile app or offline-first — web-only, online-only for MVP. No native mobile app, no offline sync or service workers.

## Open Questions

No blocking questions were identified during shaping. All sections were fully populated from input. The quality cross-check passed as "accepted" with no gaps.
