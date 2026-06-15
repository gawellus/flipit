<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: FlipIt UI Redesign

- **Plan**: context/changes/new-ui/plan.md
- **Scope**: All 6 phases
- **Date**: 2026-06-15
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | PASS    |

## Findings

### F1 — Missing error check on fetch after study session completes

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/study/StudySessionView.tsx:129
- **Detail**: After completing all cards, the code fetches next due date but never checks `dueRes.ok` before parsing JSON. Every other fetch in this file guards with `res.ok`. A 4xx/5xx response would cause an unhandled JSON parse error.
- **Fix**: Add `if (!dueRes.ok) throw new Error("Failed to fetch next due date");` before `.json()`, matching the guard pattern at line 69-71 of the same file.
- **Decision**: FIXED

### F2 — FormField input missing aria-invalid and aria-describedby

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/auth/FormField.tsx:42-58
- **Detail**: When a validation error exists, the error `<p>` is rendered below the input but the `<input>` has no `aria-invalid="true"` or `aria-describedby` linking to the error. The shadcn/ui Input already supports `aria-invalid` styling. Screen readers won't announce the error on focus.
- **Fix**: Add `aria-invalid={!!error}` to the input and give the error `<p>` an id (e.g., `${id}-error`) linked via `aria-describedby`.
- **Decision**: SKIPPED

### F3 — Multiple form elements missing accessible labels

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/flashcards/CreateFlashcardForm.tsx:61,75; src/components/generate/FlashcardItem.tsx:57,67; src/components/flashcards/FlashcardListItem.tsx:133,146,191
- **Detail**: `<label>` elements in CreateFlashcardForm, FlashcardItem, and FlashcardListItem lack `htmlFor` attributes. The `<select>` for collection assignment in FlashcardListItem has no `aria-label`. Clicking labels doesn't focus inputs; screen readers can't associate them.
- **Fix**: Add `htmlFor`/`id` pairs to label/textarea combos. Add `aria-label="Assign to collection"` on the `<select>`.
- **Decision**: SKIPPED

### F4 — Topbar mobile overlay lacks keyboard focus trap

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality (Accessibility)
- **Location**: src/components/Topbar.tsx:110-154
- **Detail**: Mobile menu handles Escape and backdrop click, but keyboard Tab can escape the panel and reach elements behind the overlay. A proper modal pattern traps focus within.
- **Fix A ⭐ Recommended**: Add a lightweight focus-trap hook. Follows WAI-ARIA dialog pattern; ~30 lines of new code. Tradeoff: manual edge-case testing. Confidence: HIGH.
- **Fix B**: Replace with Radix Dialog/Sheet. Production-tested a11y out of the box. Tradeoff: new dependency, restructuring. Confidence: MEDIUM.
- **Decision**: FIXED via Fix A

### F5 — Duplicated formatRelativeTime utility

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/study/SessionComplete.tsx:10-22; src/components/study/SessionEmpty.tsx:9-21
- **Detail**: Identical `formatRelativeTime` function in both files. `StudySessionView` also has a similar `formatInterval`. Project convention places shared helpers in `src/lib/`.
- **Fix**: Extract to `src/lib/format.ts` and import in all three files.
- **Decision**: FIXED

### F6 — DashboardView uses template literal for className

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/dashboard/DashboardView.tsx:38,64
- **Detail**: Uses `${iconBg}` string interpolation instead of `cn()`. CLAUDE.md says "always use cn()". No functional issue since the values are static.
- **Fix**: Wrap with `cn("flex size-10 ...", iconBg)`.
- **Decision**: FIXED

### F7 — FlashcardReview uses array index as React key

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/generate/FlashcardReview.tsx:109
- **Detail**: Array index as key for FlashcardItem. Items are never reordered so no functional issue, but could cause stale state if reorder is added later.
- **Fix**: Generate stable IDs when initializing proposals state.
- **Decision**: FIXED
