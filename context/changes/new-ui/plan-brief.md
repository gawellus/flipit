# FlipIt UI Redesign — Plan Brief

> Full plan: `context/changes/new-ui/plan.md`

## What & Why

Complete visual redesign of FlipIt from a dark cosmic/glassmorphic theme to a clean, light, professional SaaS look based on a Claude Design handoff bundle. The app is functionally complete (AI generation, flashcard CRUD, spaced-repetition study sessions all work) but the current UI was built for speed, not polish. This redesign implements the FlipIt design system — indigo primary, deep navy ink, Inter font at weight 300, pill buttons, gradient-mesh backgrounds — across all 9 screens (~25 states).

## Starting Point

The app uses a dark cosmic theme: gradient backgrounds (`#0a0e1a`), glassmorphic cards (`bg-white/5 border-white/10 backdrop-blur-xl`), bold purple/blue gradient text, and achromatic shadcn/ui tokens. The Topbar is desktop-only with no mobile handling. The dashboard is a minimal greeting card. All styling flows through CSS custom properties in `src/styles/global.css` → Tailwind's `@theme inline` block → component classes.

## Desired End State

Every screen renders with a light canvas background (`#f6f9fc`), white cards with blue-tinted shadows, indigo (`#533afd`) accents, and deep navy text. The landing page has a gradient-mesh hero with floating demo flashcards. A responsive topbar with mobile hamburger sheet works on all viewports. The dashboard shows stat cards, quick actions, and due-for-review collections. Study sessions use an outline-style 3D flip card with color-coded rating buttons. Inter font renders at weight 300 for display text with negative letter-spacing.

## Key Decisions Made

| Decision            | Choice                                           | Why (1 sentence)                                                                                  |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Component framework | Restyle shadcn/ui + add new components           | Preserves Radix accessibility and existing component APIs; avoids rewriting working logic.        |
| Dashboard scope     | Full design dashboard                            | Dashboard is the home screen — showing due cards at a glance drives engagement.                   |
| Landing scope       | Full landing as designed                         | First impression for new users; gradient mesh hero + features + CTA band.                         |
| Font                | Inter via Google Fonts (300/400/500)             | Free, matches the design prototype exactly; canonical open-source Söhne substitute.               |
| Token integration   | Map design tokens to Tailwind theme + CSS vars   | Single source of truth; Tailwind classes stay semantic and resolve through CSS custom properties. |
| Gradient mesh       | CSS gradients + blend modes                      | Resolution-independent, no extra assets, small footprint.                                         |
| Phasing             | Foundation → Shell → Screens (inside-out)        | Each phase is independently testable; shell-first improves every screen immediately.              |
| Mobile nav          | Full responsive nav with sheet                   | The design was specified as responsive web app; nav is the #1 mobile UX requirement.              |
| SR intervals        | Keep existing interval previews                  | Interval previews are genuinely useful for SR; prototype omission was a simplification.           |
| Flip card           | Match design styling, keep existing 3D mechanics | Visual match without rewriting working CSS transforms.                                            |
| Dashboard data      | Use available APIs, stub "studied today"         | Gets dashboard working without new endpoints; stat can be refined later.                          |
| Verification        | Visual comparison against prototype screenshots  | Practical and fast; prototype screenshots already in `context/design/`.                           |

## Scope

**In scope:**

- All 9 screens (landing, signin, signup, confirm-email, dashboard, generate, flashcards, collections, study session)
- Design token system replacement (colors, typography, spacing, shadows, radii)
- Inter font loading
- Responsive topbar with mobile hamburger sheet
- New shared components (Logo, Tag, GradientMesh, Spinner, EmptyState, Footer)
- Full dashboard with stat cards, quick actions, due-for-review sidebar
- Outline-style flip card with color-coded rating buttons

**Out of scope:**

- Dark mode
- New API endpoints
- Database changes
- Automated visual regression testing
- Storybook / component library documentation

## Architecture / Approach

The redesign is purely presentational — the data layer, API routes, and business logic are untouched. All styling changes flow through three layers: (1) CSS custom properties in `global.css` define design tokens, (2) Tailwind's `@theme inline` block maps them to utility classes, (3) component files use semantic Tailwind classes that resolve to the tokens. The Topbar is converted from Astro to React to support the mobile sheet's interactive state. New components (Logo, Tag, GradientMesh, etc.) are added alongside existing shadcn/ui primitives.

## Phases at a Glance

| Phase                             | What it delivers                                                        | Key risk                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Design Tokens & Foundation     | New color system, Inter font, restyled shadcn/ui primitives             | Existing hardcoded colors will look broken until subsequent phases fix them |
| 2. Shell (Topbar, Layout, Footer) | Responsive nav with mobile sheet, Logo, Tag, GradientMesh, shared atoms | Topbar Astro→React conversion could break page rendering                    |
| 3. Landing & Auth                 | Full landing page, restyled signin/signup/confirm-email                 | Gradient mesh CSS approximation may not match prototype exactly             |
| 4. Dashboard                      | Stat cards, quick actions, due-for-review sidebar                       | "Studied today" stat is stubbed (no tracking endpoint)                      |
| 5. Generate & Flashcards          | AI generation flow (5 states), flashcard CRUD, pagination               | Many components to restyle; largest phase by file count                     |
| 6. Collections & Study            | Collection grid, flip card, rating buttons, complete/empty states       | Flip card animation timing needs manual tuning                              |

**Prerequisites:** All functional features (S-01, S-02, S-03) are done. Design prototype screenshots in `context/design/`.
**Estimated effort:** ~6 implementation sessions across 6 phases.

## Open Risks & Assumptions

- Gradient mesh via CSS gradients won't be pixel-identical to the prototype's SVG-based mesh — a close approximation is acceptable
- "Studied today" dashboard stat will show 0 until a tracking mechanism is added (not in scope)
- The design prototype was built for a self-contained demo; some visual details may need adaptation for real dynamic data (long collection names, many flashcards, etc.)

## Success Criteria (Summary)

- Every screen visually matches the prototype screenshots in `context/design/*.png` (manual comparison)
- `npm run lint` and `npm run build` pass after every phase
- Topbar works responsively: desktop nav + mobile hamburger sheet
- 3D flip card animation is smooth and functional
