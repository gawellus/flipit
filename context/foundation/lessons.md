# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Always add updated_at trigger when creating timestamp columns

- **Context**: supabase/migrations/20260602120000_create_flashcards.sql — `updated_at` column added without auto-update trigger
- **Problem**: The `updated_at` column has a default of `now()` but no `BEFORE UPDATE` trigger to auto-update it on row modification. When future changes add update operations, the column will silently retain the creation timestamp, making it misleading for debugging and display.
- **Rule**:
- **Applies to**:

## Always set explicit fetch timeouts on external API calls

- **Context**: src/lib/services/openrouter.ts — `fetch()` call to OpenRouter API has no `AbortSignal.timeout()`
- **Problem**: Without an explicit timeout, the Worker relies on the platform's own timeout (30s free / 5min paid) as the only backstop. This makes the error message generic (platform kill vs. descriptive timeout) and makes timeout behavior platform-dependent rather than application-controlled.
- **Rule**:
- **Applies to**:
