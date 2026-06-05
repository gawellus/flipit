# External Research: ts-fsrs API Reference for S-03

> Research date: 2026-06-04
> Source: Context7 MCP — `/open-spaced-repetition/ts-fsrs` (benchmark 86.2, high reputation) + `/websites/open-spaced-repetition_github_io_ts-fsrs` (official docs site)
> Purpose: Detailed API surface and persistence patterns needed to implement S-03 study session

## Card interface (persisted state per flashcard)

```typescript
interface Card {
  difficulty: number;
  due: Date;
  elapsed_days: number;
  lapses: number;
  last_review?: Date;
  learning_steps: number;
  reps: number;
  scheduled_days: number;
  stability: number;
  state: State; // New | Learning | Review | Relearning
}
```

All fields must be persisted to reconstruct scheduling state between sessions.

## Enums

### Rating (user recall grades)

```typescript
Rating.Again; // 1 — forgot
Rating.Hard; // 2 — recalled with difficulty
Rating.Good; // 3 — recalled correctly
Rating.Easy; // 4 — recalled effortlessly
```

### State (card lifecycle)

```typescript
State.New; // 0 — never reviewed
State.Learning; // 1 — initial learning steps
State.Review; // 2 — graduated to review queue
State.Relearning; // 3 — lapsed, re-learning
```

## Core API

### Initialize scheduler

```typescript
import { createEmptyCard, fsrs, Rating, State } from "ts-fsrs";

const scheduler = fsrs(); // default research-backed parameters
```

Scheduler is stateless — safe to create per-request in Astro API routes.

### Create a new card

```typescript
const card = createEmptyCard(); // due = now
const card = createEmptyCard(new Date()); // explicit date
```

Returns a `Card` object with `state: State.New` and `due` set to the provided date.

### Preview all outcomes (before user answers)

```typescript
const preview = scheduler.repeat(card, new Date());

preview[Rating.Again].card; // Card state if user rates Again
preview[Rating.Hard].card; // Card state if user rates Hard
preview[Rating.Good].card; // Card state if user rates Good
preview[Rating.Easy].card; // Card state if user rates Easy
```

Use this to show next-review intervals on the four rating buttons in the study UI.

### Apply a rating (after user answers)

```typescript
const result = scheduler.next(card, new Date(), Rating.Good);

result.card; // updated Card — persist to DB
result.log; // ReviewLog — persist for review history
```

### afterHandler for DB serialization

The `next` method accepts an optional `afterHandler` to transform output before returning — useful for converting `Date` objects to timestamps or ISO strings for Supabase:

```typescript
const saved = scheduler.next(card, new Date(), Rating.Good, ({ card, log }) => ({
  card: {
    ...card,
    due: card.due.getTime(),
    last_review: card.last_review?.getTime() ?? null,
  },
  log: {
    ...log,
    due: log.due.getTime(),
    review: log.review.getTime(),
  },
}));
```

### FSRS `next` method signature (overloads)

```typescript
next(card: Card | CardInput, now: DateInput, grade: Grade): RecordLogItem;
next<R>(card: Card | CardInput, now: DateInput, grade: Grade, afterHandler: (recordLog: RecordLogItem) => R): R;
```

`CardInput` accepts plain objects (from DB) — no need to instantiate `Card` class.

## History helpers

- **`rollback(card, log)`** — undo last review, restore previous card state
- **`forget(card, now, reset_count?)`** — reset a card to `State.New`
- **`reschedule(card, reviews, options?)`** — replay review logs to reconstruct state from persistence

## ReviewLogInput (for replaying history)

```typescript
interface ReviewLogInput {
  difficulty: number;
  due: DateInput;
  elapsed_days: number;
  last_elapsed_days: number;
  learning_steps: number;
  rating: RatingType | Rating;
  review: DateInput;
  scheduled_days: number;
  stability: number;
  state: StateType | State;
}
```

## Configuration options

```typescript
const scheduler = fsrs({
  request_retention: 0.9, // target recall rate (0.0-1.0), default 0.9
  maximum_interval: 36500, // max days between reviews
  enable_fuzz: true, // randomize long intervals slightly
  enable_short_term: true, // same-day learning steps
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});
```

Default parameters are research-backed and work without training data — suitable for MVP.

## Implementation implications for S-03

1. **DB schema:** Add columns matching `Card` interface fields to flashcards table (or a join table). Store `state` as integer (0-3), `due` as `timestamptz`.
2. **Due-card query:** `SELECT ... WHERE due <= NOW() ORDER BY due ASC` gives the study queue.
3. **Study session flow:**
   - Fetch due cards
   - For each card: call `scheduler.repeat(card, now)` to get preview intervals for all 4 buttons
   - Show card front → user flips → show back + 4 rating buttons with interval previews
   - User rates → call `scheduler.next(card, now, rating)` → persist updated card + review log
4. **Stateless scheduler:** Create `fsrs()` per API request — no shared state needed.
5. **Type safety:** `CardInput` accepts plain objects from DB rows, so no manual hydration required.
