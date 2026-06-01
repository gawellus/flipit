# Plan: Migrate Roadmap to GitHub Issues

## Context

The project has a completed `context/foundation/roadmap.md` with 4 items (F-01, S-01, S-02, S-03) but no task tracking in GitHub. The repo (`gawellus/flipit`) has zero issues, no milestones, and only default labels. We'll create GitHub Issues via `gh` CLI so the roadmap becomes an actionable backlog.

## What we'll create

### Step 1: Custom labels (4 labels)

| Label              | Color     | Description                                     |
| ------------------ | --------- | ----------------------------------------------- |
| `foundation`       | `#1D76DB` | Horizontal enabler that unlocks vertical slices |
| `slice`            | `#0E8A16` | Vertical end-to-end user-visible feature        |
| `priority: high`   | `#B60205` | Must be done first / blocks others              |
| `priority: medium` | `#FBCA04` | Important but not blocking                      |

### Step 2: Issues (4 issues, created in dependency order)

Each issue follows this template:

```
**Roadmap ID:** {id}
**Change ID:** `{change-id}`
**Type:** {Foundation|Slice}
**PRD refs:** {refs}
**Prerequisites:** {deps or "None"}
**Unlocks:** {downstream items or "—"}

### Outcome
{outcome from roadmap}

### Acceptance Criteria
- [ ] {derived from PRD FRs}
- [ ] ...

### Risk
{risk from roadmap}

### Unknowns
{unknowns or "None"}
```

Labels assigned per issue:

| Issue title                                | Labels                         |
| ------------------------------------------ | ------------------------------ |
| F-01: Flashcard + SR data model            | `foundation`, `priority: high` |
| S-01: AI flashcard generation              | `slice`, `priority: high`      |
| S-02: Flashcard CRUD management            | `slice`, `priority: medium`    |
| S-03: Study session with spaced repetition | `slice`, `priority: high`      |

#### Acceptance criteria per issue (derived from PRD)

**F-01** (foundation — no FR, criteria from roadmap outcome + Access Control section):

- [ ] `flashcards` table exists in Supabase with columns: front, back, user_id, and SR fields (next_review_date, ease_factor, interval, repetition_count)
- [ ] RLS enabled — each user can only read/write their own cards
- [ ] Migration file follows naming convention `supabase/migrations/YYYYMMDDHHmmss_short_description.sql`

**S-01** (FR-003, FR-004):

- [ ] User can paste source text and trigger AI flashcard generation (FR-003)
- [ ] AI generates flashcards with distinct front (question) and back (answer) sides
- [ ] User can review each generated card — accept, edit, or reject individually (FR-004)
- [ ] Bulk "accept all" shortcut is available (FR-004)
- [ ] Rejected cards are discarded, not saved
- [ ] Accepted cards appear in the user's collection immediately
- [ ] Continuous visible feedback during generation operations >2s (NFR)

**S-02** (FR-005, FR-006, FR-007, FR-008):

- [ ] User can manually create a flashcard with front and back (FR-005)
- [ ] User can browse their flashcard collection with basic text search (FR-006)
- [ ] User can edit an existing flashcard (FR-007)
- [ ] User can delete a flashcard (FR-008)

**S-03** (FR-009, FR-010):

- [ ] User can start a study session that surfaces cards due for review per SR scheduling (FR-009)
- [ ] User can flip a card to reveal the answer
- [ ] User can rate their recall to feed the SR algorithm (FR-010)
- [ ] SR schedule updates after each rating
- [ ] Uses an existing SR library (PRD non-goal: no custom algorithm)

### Step 3: Cross-link dependencies

After all 4 issues are created, edit F-01's body to add issue number links for the items it unlocks (S-01, S-02, S-03 issue numbers).

## Execution

All via `gh` CLI:

1. `gh label create` × 4
2. `gh issue create` × 4 (in order: F-01, S-01, S-02, S-03)
3. `gh issue edit` on F-01 to add downstream issue links

## Verification

- `gh issue list` shows 4 open issues with correct labels
- Each issue body matches the template above
- F-01 references S-01/S-02/S-03 issue numbers
