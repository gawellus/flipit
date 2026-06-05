# External Research: Spaced Repetition Libraries for S-03

> Research date: 2026-06-04
> Source: Exa web search (npm registry, GitHub, DeepWiki)
> Purpose: Evaluate TypeScript SR libraries compatible with FlipIt stack (Astro 6 + React 19, Cloudflare Workers, Supabase PostgreSQL, Node.js 22.14)

## Compatibility requirements

- **Runtime:** Cloudflare Workers (edge — no native bindings, no WASI)
- **Language:** TypeScript, ESM
- **Node.js:** 22.14.0
- **Storage:** Supabase PostgreSQL (library must be storage-agnostic)
- **Constraint:** PRD mandates using an existing library — no custom algorithm

## FSRS vs SM-2: Algorithm comparison

FSRS (Free Spaced Repetition Scheduler) is a modern, evidence-based algorithm published at KDD 2022. SM-2 is the classic 1990 SuperMemo algorithm.

| Metric                      | FSRS v4.5                  | SM-2              |
| --------------------------- | -------------------------- | ----------------- |
| Log-loss (20M Anki reviews) | 0.36                       | 0.73              |
| RMSE                        | 0.076                      | 0.407             |
| Improvement vs SM-2         | ~81%                       | baseline          |
| Stability model             | Power-law (grade-adaptive) | Linear multiplier |
| Difficulty tracking         | Per-card, continuous       | Per-card, integer |
| Failure recovery            | Smooth decay               | Hard reset        |

FSRS is what Anki itself now uses as default. SM-2 is widely understood but significantly less accurate.

## Libraries evaluated

### FSRS-based

#### 1. `ts-fsrs` (RECOMMENDED)

- **npm:** `ts-fsrs` | **GitHub:** open-spaced-repetition/ts-fsrs
- **Weekly downloads:** 51.9K | **Stars:** 664 | **Versions:** 74
- **License:** MIT | **Dependencies:** 0
- **Node.js:** >= 20.0.0
- **Edge-runtime:** Confirmed compatible (Cloudflare Workers, Vercel Edge)
- **Module formats:** ESM, CJS, UMD
- **Current version:** 5.2.3

**API highlights:**

- `fsrs(params?)` — factory to create stateless scheduler
- `scheduler.repeat(card, now)` — preview all 4 outcomes (Again/Hard/Good/Easy)
- `scheduler.next(card, now, rating)` — apply a specific rating
- `scheduler.rollback(card, log)` — revert to previous state
- `scheduler.forget(card, now)` — reset card to New
- `scheduler.reschedule(card, reviews)` — rebuild from review history
- `scheduler.get_retrievability(card, now)` — recall probability
- `createEmptyCard()` — initialize a new card
- `afterHandler` pattern for mapping output to custom DB schema

**Key strengths:**

- Official project of the `open-spaced-repetition` org (FSRS authors)
- By far the most adopted TypeScript SR library
- Stateless scheduler — perfect for server-side Astro API routes
- Pure functions, no side effects, deterministic
- Recommends Zod for parameter validation (we already use Zod)
- Default parameters are research-backed, work without training data
- Companion optimizer `@open-spaced-repetition/binding` exists for future parameter training (Rust via NAPI, Node.js only, NOT Cloudflare Workers compatible — post-MVP concern)

**Quickstart:**

```ts
import { createEmptyCard, fsrs, Rating } from "ts-fsrs";

const scheduler = fsrs();
const card = createEmptyCard();

// Preview all four outcomes before user answers
const preview = scheduler.repeat(card, new Date());

// Apply rating after user answers
const result = scheduler.next(card, new Date(), Rating.Good);
// result.card — updated card state
// result.log  — review log entry
```

**Configuration:**

```ts
const scheduler = fsrs({
  request_retention: 0.9, // target recall rate (0.0-1.0)
  maximum_interval: 36500, // max days between reviews
  enable_fuzz: true, // randomize long intervals slightly
  enable_short_term: true, // same-day learning steps
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
});
```

#### 2. `@squeakyrobot/fsrs`

- **Weekly downloads:** 11 | **Stars:** 0 | **Versions:** 1
- **License:** MIT | **Dependencies:** 0 | **Size:** 51.8KB
- FSRS v4.5 with optional v6
- Keywords include "edge-runtime, cloudflare-workers"
- Unique feature: `autoRating(responseTime, averageTime)` for automatic grading
- Supports continuous grading (1.0-4.0) in addition to discrete (1-4)
- **Too new and unproven for production use**

#### 3. `quanta-fsrs`

- **Stars:** 0 | **Contributors:** 1
- **License:** NOASSERTION (red flag)
- FSRS v4.5/5, zero deps, edge-ready
- MINT-optimized weights (domain-specific)
- **License concern disqualifies it**

#### 4. `srs-everything`

- FSRS implementation with queue management, interleaving, postpone
- More opinionated — bundles scheduling logic with queue/session concepts
- **Too opinionated; we need just the scheduling math**

### SM-2-based

#### 5. `supermemo`

- **npm:** `supermemo` | **GitHub:** VienDinhCom/supermemo
- **Weekly downloads:** 1.8K | **Stars:** 331 | **Versions:** 24
- **License:** MIT | **Dependencies:** 0 | **Size:** 12.5KB
- Simple API: `supermemo(item, grade)` returns `{ interval, repetition, efactor }`
- Stable, mature, well-documented
- **Only worth considering if extreme simplicity outweighs algorithm quality**

#### 6. `@open-spaced-repetition/sm-2`

- **Stars:** 3 | **Versions:** 3 (latest v0.2.1)
- Explicitly unstable versioning
- **Too immature**

#### 7. `@monkey-dev-vibes/spaced-repetition`

- **Stars:** 0 | **Versions:** 1 (v0.1.0)
- ~95 lines, pure function
- Honest about FSRS being better
- **Zero adoption, single release**

## Recommendation

**Use `ts-fsrs`.** Reasons:

1. **Best algorithm:** FSRS is 81% more accurate than SM-2 on real-world data
2. **Most adopted:** 51.9K weekly downloads, 664 stars — no other TS SR library comes close
3. **Edge-compatible:** Confirmed to work on Cloudflare Workers
4. **Clean API:** Stateless scheduler with pure functions maps perfectly to Astro API routes
5. **Zero dependencies:** No supply chain risk
6. **TypeScript-native:** Full type definitions included
7. **Storage-agnostic:** Card state is a plain object — serialize to Supabase however we want
8. **Default params work:** No optimizer needed for MVP; research-backed defaults are good enough
9. **Zod-friendly:** Library docs recommend Zod for parameter validation — already in our stack
10. **Active maintenance:** 74 versions, official FSRS org project

The 4-rating scale (Again / Hard / Good / Easy) maps naturally to study session UI buttons. The `repeat()` method previews all outcomes before the user rates, enabling interval preview in the UI.

## Integration sketch (for /10x-plan)

- **DB columns:** Add SR state fields to flashcards table (stability, difficulty, due, last_review, reps, lapses, state, elapsed_days, scheduled_days)
- **Review log table:** Store each review event (card_id, rating, review_date, elapsed_days, scheduled_days, state)
- **API route:** `POST /api/study/review` — accepts card_id + rating, runs `scheduler.next()`, persists updated card + log
- **API route:** `GET /api/study/session` — queries cards where `due <= now`, ordered by due date
- **Frontend:** React study session component with card flip + 4 rating buttons
- **Scheduler instance:** Created once per request with default params via `fsrs()`
