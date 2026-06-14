# FlipIt UI Redesign Implementation Plan

## Overview

Complete visual redesign of FlipIt from a dark cosmic/glassmorphic theme to a clean, light, professional SaaS look based on the Claude Design handoff bundle. The redesign covers all 9 screens (~25 states) and introduces the FlipIt design system tokens (indigo primary, deep navy ink, Inter font, pill buttons, gradient-mesh backgrounds). No data model or API changes — purely presentational, with one exception: the dashboard now surfaces existing data (card counts, due counts) in a new layout.

## Current State Analysis

The app currently uses a dark cosmic theme: `bg-cosmic` gradient backgrounds (`#0a0e1a` → `#0f1529`), white-on-dark glassmorphic cards (`bg-white/5 border-white/10 backdrop-blur-xl`), purple/blue gradient text, and bold font weights. The shadcn/ui CSS variables in `src/styles/global.css` use achromatic oklch values — all grays, no brand color in `--primary`.

### Key Discoveries:

- `src/styles/global.css:6-111` — all design tokens live here; the `@theme inline` block maps CSS vars to Tailwind's color system. This is the single file to update for token replacement.
- Tailwind v4 uses `@tailwindcss/vite` plugin — no separate `tailwind.config.ts`. Theme extension goes into `global.css`.
- shadcn/ui components (`src/components/ui/`) use semantic Tailwind classes (`bg-primary`, `text-muted-foreground`) that resolve through CSS vars — updating the vars updates all components at once.
- Hardcoded color classes (e.g., `text-purple-300`, `bg-white/5`, `border-white/10`) are scattered across ~15 component files and Astro pages. These must be found and replaced individually.
- The Topbar (`src/components/Topbar.astro`) is an Astro component — it must be converted to React for the mobile sheet's interactive state management (open/close, click-outside).
- The current dashboard (`src/pages/dashboard.astro`) is a minimal greeting card; the design requires a full data-driven dashboard with stats, quick actions, and due-for-review sidebar — this needs a new React component.

## Desired End State

After all 6 phases, every screen matches the Claude Design prototype's visual language:

- Light canvas background (`#f6f9fc`), white cards with subtle blue-tinted shadows
- Indigo (`#533afd`) primary accent, deep navy (`#0d253d`) text
- Inter font at weight 300 for display/headings, 400 for body/buttons
- Pill-shaped buttons and badges (`border-radius: 9999px`)
- Responsive topbar with mobile hamburger → slide-in sheet
- Gradient-mesh hero on landing and auth pages
- Outline-style 3D flip card in study sessions
- Color-coded rating buttons (ruby/lemon/indigo/green hover states)
- Full dashboard with stat cards, quick actions, due-for-review sidebar

Verification: run `npm run dev`, navigate each screen, and visually compare against prototype screenshots in `context/design/*.png`.

## What We're NOT Doing

- No dark mode — the design is light-only; remove the `.dark` CSS block and `bg-cosmic` utility
- No data model or migration changes
- No new API endpoints (dashboard uses existing collection/flashcard stats; "studied today" is stubbed)
- No Söhne font licensing — Inter is the canonical substitute per the design spec
- No automated visual regression testing — manual comparison against prototype screenshots
- No design system component library (no Storybook) — components stay inline in the app

## Implementation Approach

Inside-out: foundation tokens first, then the shell (topbar/layout/footer), then individual screens. This ensures every screen benefits from token changes immediately, and each phase produces a testable, consistent state.

## Critical Implementation Details

- **Font loading**: Inter must be loaded via `<link>` in `Layout.astro`'s `<head>`, not `@import` in CSS — `@import` blocks rendering. Load weights 300, 400, 500.
- **Token naming**: The design system defines `--color-primary: #533afd` which conflicts with shadcn/ui's `--primary` (mapped to Tailwind's `bg-primary`). Resolution: update `:root` so `--primary` contains the indigo value in oklch. Add new FlipIt-specific vars (`--fi-ink`, `--fi-ink-mute`, `--fi-canvas-soft`, etc.) for tokens that have no shadcn/ui equivalent.
- **Topbar conversion**: The current `Topbar.astro` must become a React component (`Topbar.tsx`) to handle the mobile sheet's open/close state, click-outside-to-close, and keyboard escape. The Astro pages that include `<Topbar />` must switch to `<Topbar client:load />`.

---

## Phase 1: Design Tokens & Global Foundation

### Overview

Replace all CSS custom properties with FlipIt design system values, load Inter font, update shadcn/ui component primitives to match the new visual language, and remove dark-mode artifacts.

### Changes Required:

#### 1. Global CSS tokens

**File**: `src/styles/global.css`

**Intent**: Replace the achromatic oklch tokens with FlipIt design system colors (indigo primary, navy ink, cool off-white surfaces). Remove dark mode block and `bg-cosmic` utility. Add new FlipIt-specific tokens for values that don't map to shadcn/ui semantics. Update `@theme inline` to include new Tailwind extensions.

**Contract**: The `:root` block must map:

- `--primary` → `#533afd` (indigo) in oklch
- `--primary-foreground` → `#ffffff`
- `--background` → `#f6f9fc` (canvas-soft — the app's default bg)
- `--foreground` → `#0d253d` (ink — deep navy)
- `--card` → `#ffffff`
- `--card-foreground` → `#0d253d`
- `--muted-foreground` → `#64748d` (ink-mute)
- `--secondary` → `#f6f9fc` (canvas-soft)
- `--secondary-foreground` → `#273951` (ink-secondary)
- `--destructive` → `#ea2261` (ruby)
- `--border` → `#e3e8ee` (hairline)
- `--input` → `#a8c3de` (hairline-input)
- `--ring` → `#533afd` (primary — focus ring should match brand)
- `--radius` → `0.5rem` (8px default; buttons override to pill)

New FlipIt tokens to add:

```css
--fi-primary-deep: #4434d4;
--fi-primary-press: #2e2b8c;
--fi-primary-soft: #665efd;
--fi-primary-subdued: #b9b9f9;
--fi-ink: #0d253d;
--fi-ink-secondary: #273951;
--fi-ink-mute: #64748d;
--fi-ink-mute-2: #61718a;
--fi-canvas: #ffffff;
--fi-canvas-soft: #f6f9fc;
--fi-canvas-cream: #f5e9d4;
--fi-hairline: #e3e8ee;
--fi-hairline-input: #a8c3de;
--fi-brand-dark: #1c1e54;
--fi-ruby: #ea2261;
--fi-magenta: #f96bee;
--fi-lemon: #9b6829;
--fi-shadow-blue: #003770;
--fi-violet-soft: #ede9ff;
--fi-violet-ink: #5b46c9;
```

Add to `@theme inline`:

```css
--color-fi-primary-deep: var(--fi-primary-deep);
/* ... etc for each --fi-* token that components need via Tailwind */
--radius-pill: 9999px;
```

Remove: `.dark` block (lines 41-73), `@utility bg-cosmic` (lines 113-115).

Add elevation tokens:

```css
--shadow-card: 0 1px 3px rgba(0, 55, 112, 0.08);
--shadow-float: 0 8px 24px rgba(0, 55, 112, 0.08), 0 2px 6px rgba(0, 55, 112, 0.04);
```

#### 2. Font loading

**File**: `src/layouts/Layout.astro`

**Intent**: Load Inter from Google Fonts in the `<head>` for fast rendering. Set font-family and base typography.

**Contract**: Add `<link>` tags for Inter weights 300, 400, 500 with `display=swap`. Set `font-family: "Inter", system-ui, sans-serif` on `body` via a base style or the existing `@layer base` block. Enable `font-feature-settings: "ss01" 1` globally.

#### 3. Button component

**File**: `src/components/ui/button.tsx`

**Intent**: Update button variants to match the design: pill radius for all sizes, indigo primary fill, updated destructive/outline/ghost styles.

**Contract**: Change border-radius from `rounded-md`/`rounded-lg` to `rounded-full` (pill). The `default` variant should use `bg-primary text-primary-foreground` (which now resolves to indigo). Add a `block` variant class for full-width buttons (`w-full`). Update sizes to match design tokens (md: h-10 px-5, sm: h-8 px-4).

#### 4. Card component

**File**: `src/components/ui/card.tsx`

**Intent**: Update card styling to match the design: white background, subtle shadow, 12px radius.

**Contract**: Base card class: `rounded-xl border border-[var(--fi-hairline)] bg-card shadow-[var(--shadow-card)]`. Remove the current `shadow-sm` and add the design's blue-tinted shadow.

#### 5. Badge component

**File**: `src/components/ui/badge.tsx`

**Intent**: Ensure badges use pill radius and add status-specific variants for the design's acceptance states.

**Contract**: Add `rounded-full` (already present). Add `success` variant: green background/text. Add `neutral` variant: gray. Keep existing `destructive`.

#### 6. Input and Textarea

**Files**: `src/components/ui/input.tsx`, `src/components/ui/textarea.tsx`

**Intent**: Update border color to use `--fi-hairline-input`, update focus ring to indigo, update radius to `rounded-md` (6px per design).

**Contract**: Border: `border-[var(--fi-hairline-input)]`. Focus: `focus-visible:border-primary focus-visible:ring-primary/50`. Remove `dark:` prefixed classes.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- No TypeScript errors

#### Manual Verification:

- Dev server shows light background (`#f6f9fc`), indigo buttons, navy text across all existing pages
- Inter font loads and renders at weight 300 for headings
- All hardcoded dark-theme colors (white/5, white/10, purple-_, blue-_) are visually broken — this is expected; they get fixed in subsequent phases
- shadcn/ui primitives (button, card, input) render correctly with new tokens

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Shell — Topbar, Layout, Footer, Shared Atoms

### Overview

Build the app shell: convert the Topbar to React with responsive mobile nav sheet, create Footer and shared atom components (Logo, Tag, SourceBadge, Spinner, EmptyState, GradientMesh).

### Changes Required:

#### 1. Topbar component (React conversion)

**File**: `src/components/Topbar.tsx` (new — replaces `src/components/Topbar.astro`)

**Intent**: Create a React topbar matching the design: sticky, frosted-glass background, FlipIt logo left, horizontal nav links (Dashboard, Generate, Flashcards, Study) with pill active state, email + avatar right. Mobile: hamburger button that opens a slide-in sheet panel with full nav links.

**Contract**: Props: `user: { email: string } | null`. Uses `pathname` to determine active link. Nav links map to `/dashboard`, `/generate`, `/flashcards`, `/study`. Authenticated state shows nav + email + avatar + sign-out. Unauthenticated shows "Sign in" link + "Get started" button. Mobile sheet: fixed overlay with slide-in panel, closes on backdrop click or Escape key. Breakpoint: hide desktop nav at `max-width: 860px`, show hamburger.

CSS: sticky, `backdrop-filter: saturate(1.4) blur(12px)`, semi-transparent white background, 1px bottom border. Nav links: pill radius, muted text color, active = indigo text + indigo/10% background.

#### 2. Logo component

**File**: `src/components/Logo.tsx` (new)

**Intent**: FlipIt brand logo — indigo arrow-in-circle icon + "FlipIt" text (with "It" in a different weight or style as shown in the prototype).

**Contract**: Props: `size?: number`, `showWordmark?: boolean`. Returns an inline SVG icon matching the prototype's chevron-right-in-rounded-square motif, plus the "FlipIt" text span.

#### 3. Tag component

**File**: `src/components/Tag.tsx` (new)

**Intent**: Small uppercase eyebrow tag used for section labels ("DASHBOARD", "AI GENERATION", "COLLECTIONS", etc.).

**Contract**: Renders a `<span>` with design's Tag styling: pill radius, indigo/12% background, indigo-deep text, uppercase, micro-cap typography (10px, weight 400, 0.1px letter-spacing).

#### 4. GradientMesh component

**File**: `src/components/GradientMesh.tsx` (new)

**Intent**: Decorative gradient mesh background used on the landing hero and behind auth forms.

**Contract**: Renders an absolutely-positioned `<div>` with layered CSS radial-gradients approximating the prototype's pink/orange/purple mesh. Props: `style?: CSSProperties` for opacity/height overrides. Uses `pointer-events-none` and `position: absolute; inset: 0`.

#### 5. SourceBadge component update

**File**: `src/components/flashcards/FlashcardListItem.tsx` (or extract to shared)

**Intent**: Update source badge styling from dark-theme to design's light-theme look: AI = indigo/12% bg + indigo-deep text + sparkle icon; Manual = violet-soft bg + violet-ink text + edit icon.

**Contract**: `.src-ai`: `background: color-mix(in srgb, #533afd 12%, white); color: #4434d4`. `.src-manual`: `background: #ede9ff; color: #5b46c9`. Both: pill radius, uppercase, 11px font.

#### 6. Spinner and EmptyState components

**Files**: Create `src/components/Spinner.tsx`, `src/components/EmptyState.tsx`

**Intent**: Shared loading spinner and empty-state pattern matching the design's styling (indigo spinner border, centered layout with big icon + title + body + optional action).

**Contract**: Spinner: indigo primary color border with lighter ring (`color-mix(in srgb, #533afd 18%, white)`). EmptyState: centered column with 76px icon circle, display-md title, body-lg muted text, optional action button/slot.

#### 7. Footer component

**File**: `src/components/Footer.astro` (new)

**Intent**: Simple footer with logo, copyright text, and sign-in/sign-up links. Only shown on landing page.

**Contract**: Top border (`--fi-hairline`), flex layout, logo left, copyright center, links right.

#### 8. Update Astro pages to use new Topbar

**Files**: `src/pages/flashcards.astro`, `src/pages/generate.astro`, `src/pages/study.astro`, `src/pages/study/[id].astro`, `src/pages/dashboard.astro`

**Intent**: Replace `<Topbar />` (Astro) with `<Topbar client:load user={...} />` (React). Pass the user object from `Astro.locals.user`.

**Contract**: Import from `@/components/Topbar` instead of `@/components/Topbar.astro`. Add `client:load` directive.

#### 9. Remove old Topbar

**File**: `src/components/Topbar.astro`

**Intent**: Delete after all pages reference the new React Topbar.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`
- No TypeScript errors

#### Manual Verification:

- Topbar renders with FlipIt logo, horizontal nav links, email + avatar on desktop
- Active nav link shows indigo pill highlight
- Mobile (≤860px): hamburger visible, clicking opens slide-in sheet with nav links, clicking backdrop or Escape closes it
- Logo, Tag, GradientMesh, Spinner, EmptyState render correctly in isolation

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Landing Page & Auth Screens

### Overview

Rebuild the landing page to match the design (gradient-mesh hero, floating demo cards, features grid, how-it-works steps, CTA band, footer) and restyle all auth screens (signin, signup, confirm-email).

### Changes Required:

#### 1. Landing page

**File**: `src/components/Welcome.astro` (rewrite)

**Intent**: Replace the cosmic-themed hero with the design's landing page: gradient-mesh hero with floating demo flashcards, feature cards grid (AI generation, smart SR, organized collections), how-it-works 3-step section, CTA band with dark navy background, footer.

**Contract**: Structure matches the design's `landing.jsx`: hero section with GradientMesh, left column (Tag, h1 `t-display-xxl`, lede, CTA buttons, note), right column (floating demo cards with absolute positioning). Features section: 3-column grid with icon squares. Steps: 3-column grid with numbered circles. CTA band: dark navy background, gradient mesh at 50% opacity, white text, CTA button. All sections use `container` class (max-width 1120px, auto margins, 24px padding).

Remove: cosmic orbs, star field background, all purple/blue gradient text, all `bg-white/5` glassmorphic cards.

#### 2. Landing page index

**File**: `src/pages/index.astro`

**Intent**: Update to use the marketing topbar variant (transparent background, no bottom border) and include Footer.

**Contract**: Pass a `variant="marketing"` or similar prop to Topbar. Include `<Footer />` after Welcome content.

#### 3. Sign-in page

**Files**: `src/pages/auth/signin.astro`, `src/components/auth/SignInForm.tsx`

**Intent**: Restyle to match design: gradient-mesh background, centered white card with Logo, "Welcome back" heading, form fields with new styling, indigo submit button.

**Contract**: Page: `auth-wrap` class (centered flex, min-height, GradientMesh behind). Card: white background, 36px padding, 440px max-width. Form fields: new `field` class with label styling (`field__label`: 13px, ink-secondary). Input: uses updated shadcn/ui Input with new tokens. Password eye toggle: updated color scheme. Error alert: ruby-tinted background + border. Submit button: full-width, indigo, pill. Footer link: "Don't have an account? Sign up".

Remove: all `bg-white/10`, `border-white/20`, `text-blue-100/*`, `text-purple-*`, `bg-cosmic`, gradient text classes.

#### 4. Sign-up page

**Files**: `src/pages/auth/signup.astro`, `src/components/auth/SignUpForm.tsx`

**Intent**: Same restyling as sign-in, plus live validation indicators (password length, password match) matching the design's dot-checkmark pattern.

**Contract**: Validation rows: flex with colored dot indicator (green when valid, muted when not). Character counter on password field. Same card/background treatment as sign-in.

#### 5. Confirm email page

**File**: `src/pages/auth/confirm-email.astro`

**Intent**: Restyle to design: gradient-mesh background, centered card with mail icon in 76px circle, "Check your inbox" heading, info alert, resend + sign-in buttons.

**Contract**: Replace emoji with Lucide `Mail` icon in a big-ico circle (indigo 12% background). Info alert: indigo-tinted background + border. Two buttons: secondary "Resend email", primary "Back to sign in".

#### 6. Shared auth components

**Files**: `src/components/auth/FormField.tsx`, `src/components/auth/PasswordToggle.tsx`, `src/components/auth/ServerError.tsx`, `src/components/auth/SubmitButton.tsx`

**Intent**: Update all hardcoded color classes to use new design tokens.

**Contract**: FormField: labels use `text-[var(--fi-ink-secondary)]`, inputs use updated shadcn/ui styling, error text uses ruby color. PasswordToggle: muted icon color. ServerError: ruby-tinted alert box. SubmitButton: full-width, uses shadcn/ui Button (which is now indigo/pill).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Landing page: gradient mesh hero visible, floating demo cards positioned correctly, feature grid renders 3 columns on desktop / 1 on mobile, CTA band has dark navy background
- Sign-in: centered card on gradient-mesh background, indigo submit button, error state shows ruby alert
- Sign-up: live password validation with dot indicators, character counter
- Confirm email: mail icon in circle, info alert, two buttons
- All pages render correctly at mobile widths (≤860px)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Dashboard

### Overview

Replace the minimal dashboard with the full design: greeting header with Tag, stat cards grid, "Jump back in" quick actions, and "Due for review" collection sidebar.

### Changes Required:

#### 1. Dashboard view component

**File**: `src/components/dashboard/DashboardView.tsx` (new)

**Intent**: Create the full dashboard layout matching the design: page header with Tag + greeting + subtitle + "Generate cards" CTA, 3-column stat grid (studied today, cards due, total cards), 2-column layout with quick-action cards (left) and due-for-review collection list (right).

**Contract**: Fetches dashboard data on mount from existing APIs: `GET /api/flashcards` (total count), `GET /api/collections` (collection list with due counts). "Studied today" is stubbed to 0 initially. StatCard: Card with icon in tinted square, large number (display font, 38px, weight 300, tnum), label below. QuickAction: Card with icon + title + description + chevron, hover effect (translateY -2px, elevated shadow). Due-for-review: list rows with collection icon, name, card count, due pill, study button linking to `/study/{id}`.

#### 2. Dashboard page

**File**: `src/pages/dashboard.astro`

**Intent**: Replace inline content with DashboardView React component. Add Topbar.

**Contract**: Render `<DashboardView client:load user={user} />` with the authenticated user object. Include Topbar with user prop. Remove old greeting card and sign-out button.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Dashboard shows greeting with user's email, 3 stat cards, quick-action section, due-for-review sidebar
- Stat numbers render with tabular numerals (tnum)
- Quick-action cards have hover lift effect
- Due-for-review rows show collection name, card count, due badge, and study button
- Study buttons link to correct `/study/{collectionId}` URLs
- Responsive: stat grid and dashboard grid collapse to single column on mobile

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Generate & Flashcards Screens

### Overview

Restyle the AI generation flow (5 states) and the flashcards management view (search, CRUD, pagination, empty states).

### Changes Required:

#### 1. Generate view

**File**: `src/components/generate/GenerateView.tsx`

**Intent**: Restyle all 5 states to match design: page header with Tag + title + subtitle, form state with Card wrapper and character counter, loading state with indigo Spinner, review state with proposal cards and sticky bottom bar, success state with green check circle, error state with ruby alert circle.

**Contract**: Page header: Tag "AI generation", display-lg title, page-sub subtitle. Form: Card with textarea, positioned char counter (bottom-right, inside textarea wrapper). Proposals: bordered cards with status-dependent styling (pending = default border, accepted = green border + green 4% bg, rejected = 50% opacity). Sticky bottom bar: white bg, hairline border, shadow, "X of Y accepted" text, discard + save buttons. Remove all `bg-white/5`, `border-white/10`, gradient text, purple-\* classes.

#### 2. Generate sub-components

**Files**: `src/components/generate/GenerateForm.tsx`, `src/components/generate/FlashcardReview.tsx`, `src/components/generate/FlashcardItem.tsx`

**Intent**: Update all hardcoded dark-theme colors to design tokens.

**Contract**: GenerateForm: textarea uses updated Input/Textarea styling, char counter uses `--fi-ink-mute` color, over-limit uses ruby. FlashcardReview: sticky header uses white bg + backdrop-blur + hairline border. FlashcardItem: proposal card styling, badge variants (success/danger/neutral). All edit textareas use updated styling.

#### 3. Flashcards view

**File**: `src/components/flashcards/FlashcardsView.tsx`

**Intent**: Restyle to design: page header with Tag + title + card count subtitle + "Add flashcard" button, search toolbar, flashcard list.

**Contract**: Page header matches design pattern (Tag, display-lg title, page-sub, CTA button right). Search: input with search icon positioned left (`padding-left: 42px`). Remove gradient text, dark-theme spinner colors.

#### 4. Flashcard list item

**File**: `src/components/flashcards/FlashcardListItem.tsx`

**Intent**: Restyle card layout to match design: Card with source badge, front text (display font, 17px), back text (14.5px, ink-secondary), collection mini-select dropdown, edit/delete icon buttons on the right column.

**Contract**: Use Card component. fc-card layout: flex with main area (badge, front, back, collection select) and action column (edit + delete icon buttons). Edit mode: Card with indigo border highlight, counter textareas. Delete confirm: ruby-tinted background strip with undo timer bar (CSS animation `undo-shrink` from 100% to 0% width over 3s). Source badges use new SourceBadge component. Collection select: pill-shaped mini-select.

#### 5. Pagination

**File**: `src/components/flashcards/PaginationControls.tsx`

**Intent**: Restyle pagination to match design: icon buttons (prev/next) with page info text between.

**Contract**: Centered flex layout with gap-16. Prev/next as icon buttons (bordered squares with chevron icons). Page info: "Page X of Y · Z cards" in muted caption text with tabular numerals.

#### 6. Search input

**File**: `src/components/flashcards/SearchInput.tsx`

**Intent**: Update to match design's search pattern with icon inside input.

**Contract**: Wrapper div with relative positioning. Search icon absolutely positioned left. Input with left padding to clear the icon. Uses updated Input component styling.

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Generate form: Card with character counter, "Use sample text" link
- Generate loading: indigo spinner centered
- Generate review: proposal cards with accept/reject/edit, sticky bottom bar, collection select dropdown
- Generate success: green check icon circle
- Generate error: ruby alert icon circle
- Flashcards: search with icon, flashcard cards with source badge + front/back + collection dropdown + edit/delete buttons
- Edit mode: indigo-bordered Card with counter textareas
- Delete: ruby undo bar animates over 3 seconds
- Pagination: centered prev/next buttons with page info
- Empty states: big icon circle, centered text, action buttons

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 6: Collections & Study Session

### Overview

Restyle the collections grid and the study session (all 4 states: loading, studying with flip card, complete, empty/all-caught-up).

### Changes Required:

#### 1. Collections view

**File**: `src/components/collections/CollectionsView.tsx`

**Intent**: Restyle to design: page header with Tag + "Study decks" title + subtitle + "Create collection" button, 2-column card grid with collection cards showing icon, name, count pills (total + due), study button, delete button.

**Contract**: Page header: Tag "Collections", display-lg title. Grid: `grid-template-columns: repeat(2, 1fr)` on desktop, 1fr on mobile (≤760px). Collection card: Card with icon square (indigo-tinted), name (heading-lg), footer row with count pills + study button. Count pills: `count-pill` class (pill shape, small text, tnum). Due pill: indigo tint when > 0, muted when 0. Create form: inline Card with indigo border highlight. Delete confirm: two buttons (cancel + red delete).

#### 2. Study session view

**File**: `src/components/study/StudySessionView.tsx`

**Intent**: Restyle all 4 states plus add "Back to collections" link at top and progress bar.

**Contract**: Back link: muted nav-link style with chevron-left icon. Progress bar: flex row with "Card X of Y" label, progress bar (8px height, pill radius, indigo gradient fill), source badge. States use Card wrapper + EmptyState/Spinner patterns.

#### 3. Flashcard display (flip card)

**File**: `src/components/study/FlashcardDisplay.tsx`

**Intent**: Update flip card styling from dark glassmorphic to outline style: white background, indigo border (front), navy border (back), centered content, flip hint text.

**Contract**: Scene: `perspective: 1600px`. Card: `min-height: 340px`, 0.6s `cubic-bezier(.4,.05,.2,1)` transition. Front face: white bg, 1.5px indigo border, xl radius, shadow-float. Label: "QUESTION" uppercase, 11px, muted. Content: display font, 27px, centered. Hint: "Tap the card or press Space to reveal" with flip icon. Back face: white bg, 1.5px navy border. Label: "ANSWER" uppercase, indigo color. Content: 20px, ink-secondary. Hint: "How well did you know it?". Keep existing `backface-visibility`, `transform-style`, `rotateY(180deg)` mechanics.

#### 4. Rating buttons

**File**: `src/components/study/RatingButtons.tsx`

**Intent**: Restyle to design's 4-column grid with color-coded hover states. Keep existing interval previews (user decision to preserve functionality).

**Contract**: Grid: `grid-template-columns: repeat(4, 1fr)` on desktop, `repeat(2, 1fr)` on mobile (≤560px). Each button: Card-like styling (white bg, hairline border, lg radius), flex column (label + interval). Hover states: Again = ruby border/bg/text, Hard = lemon border/bg/text, Good = indigo border/bg/text, Easy = green border/bg/text. Hover: `translateY(-2px)`. Disabled: 40% opacity.

#### 5. Session complete

**File**: `src/components/study/SessionComplete.tsx`

**Intent**: Restyle to design: Card with centered content, trophy icon in indigo circle, "Session complete!" heading, card count, next review time, "Back to collections" button.

**Contract**: Card wrapper. Big icon: trophy in 76px circle (indigo 12% bg). Title: display-md. Body: muted. Next review info: clock icon + text. Button: primary.

#### 6. Session empty

**File**: `src/components/study/SessionEmpty.tsx`

**Intent**: Restyle to design: Card with centered content, check icon in green circle, "All caught up!" heading, next review info, buttons (back to collections + add cards if empty collection).

**Contract**: Big icon: check in green circle. Title: display-md. Buttons: secondary "Back to collections" + primary "Add cards" (if no cards in collection).

### Success Criteria:

#### Automated Verification:

- Lint passes: `npm run lint`
- Build succeeds: `npm run build`

#### Manual Verification:

- Collections: 2-column grid with collection cards, count pills, study buttons, responsive collapse
- Create collection: inline form with indigo border
- Delete: confirmation buttons appear
- Study loading: indigo spinner in Card
- Study: progress bar fills with indigo gradient, flip card has white bg + indigo border, 3D flip animation works, question/answer text centered, flip hint visible
- Rating: 4-column grid, each button shows color on hover (Again=red, Hard=amber, Good=indigo, Easy=green), interval previews visible below labels
- Study complete: trophy icon, card count, next review, back button
- All caught up: green check, back + add cards buttons
- Mobile: rating grid collapses to 2x2, flip card padding reduces

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- No new unit tests — this is a presentational change. Existing tests should continue to pass.

### Integration Tests:

- Run existing E2E tests (if any) to verify no functional regressions.

### Manual Testing Steps:

1. Landing page: visually compare against `context/design/landing.png`
2. Sign in: test login flow, error state, compare against `context/design/signin.png`
3. Sign up: test validation, password match indicator
4. Dashboard: verify stat numbers, quick actions navigate correctly, compare against `context/design/dashboard.png`
5. Generate: test full flow (form → loading → review → save), compare against `context/design/generate-review.png`
6. Flashcards: search, create, edit, delete with undo, pagination, compare against `context/design/fc.png`
7. Collections: create, delete, study button, compare against `context/design/collections.png`
8. Study: flip card animation, rating buttons, session complete, compare against `context/design/study-front.png` and `context/design/study-back.png`
9. Mobile: test all screens at ≤860px, verify hamburger menu works

## Performance Considerations

- Inter font loading adds ~50KB; use `display=swap` to prevent FOIT
- Gradient mesh uses CSS gradients only — no image assets
- Remove unused cosmic background styles to reduce CSS bundle size
- Card shadows use `rgba()` — no blur-heavy effects that impact paint performance

## References

- Design handoff bundle: extracted to `/tmp/flipit-design/flipit/`
- Design prototype screenshots: `context/design/*.png`
- Design spec (Polish): `context/design/new-ui.md`
- Design system tokens: `/tmp/flipit-design/flipit/project/_ds/flipit-design-system-*/tokens/`
- Prototype source: `/tmp/flipit-design/flipit/project/src/*.jsx` and `src/app.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Design Tokens & Global Foundation

#### Automated

- [x] 1.1 Lint passes after token replacement — 9fcf1df
- [x] 1.2 Build succeeds after token replacement — 9fcf1df
- [x] 1.3 No TypeScript errors — 9fcf1df

#### Manual

- [x] 1.4 Light background, indigo buttons, navy text visible across pages — 9fcf1df
- [x] 1.5 Inter font loads and renders at weight 300 — 9fcf1df

### Phase 2: Shell — Topbar, Layout, Footer, Shared Atoms

#### Automated

- [x] 2.1 Lint passes
- [x] 2.2 Build succeeds

#### Manual

- [x] 2.3 Desktop topbar renders with logo, nav links, email, avatar
- [x] 2.4 Active nav link shows indigo pill
- [x] 2.5 Mobile hamburger opens sheet, backdrop/Escape closes it
- [x] 2.6 Logo, Tag, GradientMesh, Spinner, EmptyState render correctly

### Phase 3: Landing Page & Auth Screens

#### Automated

- [ ] 3.1 Lint passes
- [ ] 3.2 Build succeeds

#### Manual

- [ ] 3.3 Landing matches design: gradient mesh, demo cards, features, steps, CTA band
- [ ] 3.4 Sign-in matches design: centered card, indigo button, error state
- [ ] 3.5 Sign-up: live validation, dot indicators, character counter
- [ ] 3.6 Confirm email: icon circle, info alert
- [ ] 3.7 All auth pages render correctly on mobile

### Phase 4: Dashboard

#### Automated

- [ ] 4.1 Lint passes
- [ ] 4.2 Build succeeds

#### Manual

- [ ] 4.3 Dashboard shows greeting, stat cards, quick actions, due-for-review
- [ ] 4.4 Quick actions navigate to correct pages
- [ ] 4.5 Study buttons link to correct study session URLs
- [ ] 4.6 Responsive collapse on mobile

### Phase 5: Generate & Flashcards Screens

#### Automated

- [ ] 5.1 Lint passes
- [ ] 5.2 Build succeeds

#### Manual

- [ ] 5.3 Generate: all 5 states render with new styling
- [ ] 5.4 Flashcards: search, CRUD, pagination, empty states
- [ ] 5.5 Delete undo timer bar animates
- [ ] 5.6 Collection dropdown renders correctly

### Phase 6: Collections & Study Session

#### Automated

- [ ] 6.1 Lint passes
- [ ] 6.2 Build succeeds

#### Manual

- [ ] 6.3 Collections: 2-column grid, count pills, study buttons
- [ ] 6.4 Study: flip card with outline style, 3D animation works
- [ ] 6.5 Rating buttons: color-coded hovers, interval previews
- [ ] 6.6 Session complete and empty states render correctly
- [ ] 6.7 Mobile: rating grid collapses to 2x2
