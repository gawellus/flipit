---
project: FlipIt
researched_at: 2026-05-24
recommended_platform: Cloudflare Workers
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 6 + React 19
  runtime: Cloudflare Workers (workerd)
---

## Recommendation

**Deploy on Cloudflare Workers.**

The project is already scaffolded for Cloudflare Workers — `@astrojs/cloudflare` adapter, `wrangler.jsonc`, `astro:env/server` secrets, and `nodejs_compat` flag are all in place. Zero migration work is needed. Cloudflare scored 10/10 on the five agent-friendly criteria (CLI-first, managed/serverless, agent-readable docs, stable deploy API, MCP integration) and is the platform the developer is already familiar with. At 10k–100k monthly requests, the Workers Standard plan costs $5/month — the Free tier's 10ms CPU cap is too tight for SSR, but Standard's 30s CPU limit handles it comfortably. External services (Supabase for database/auth, OpenRouter for AI) connect via standard HTTPS — no platform-specific integration required.

## Platform Comparison

| Platform               | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total     |
| ---------------------- | --------- | ------------------ | ------------------- | ----------------- | --------------- | --------- |
| **Cloudflare Workers** | Pass      | Pass               | Pass                | Pass              | Pass            | **10/10** |
| **Vercel**             | Pass      | Pass               | Pass                | Pass              | Pass            | **10/10** |
| **Netlify**            | Partial   | Pass               | Pass                | Partial           | Pass            | **8/10**  |
| **Railway**            | Partial   | Partial            | Pass                | Partial           | Pass            | **7/10**  |
| **Fly.io**             | Partial   | Partial            | Pass                | Partial           | Partial         | **6/10**  |
| **Render**             | Partial   | Partial            | Pass                | Partial           | Partial         | **6/10**  |

**Scoring notes:**

- **CLI-first**: Cloudflare (`wrangler deploy/rollback/tail`) and Vercel (`vercel deploy/rollback/logs/bisect`) cover the full operational loop from CLI. Netlify, Railway, Fly.io, and Render all lack a single CLI rollback command — rollback requires dashboard, REST API, or GraphQL mutation.
- **Managed/Serverless**: Cloudflare (V8 isolates), Vercel (serverless functions), and Netlify (serverless functions) are fully managed. Railway, Fly.io, and Render run persistent containers with more operational surface.
- **Agent-readable docs**: All six platforms publish `llms.txt` or markdown docs on GitHub — a universal pass.
- **Stable deploy API**: Cloudflare and Vercel have deterministic, one-command deploy + rollback. Others require multi-step rollback workflows.
- **MCP/Integration**: Cloudflare has a GA docs MCP server. Vercel has GA MCP at `mcp.vercel.com`. Netlify and Railway have GA MCP servers. Fly.io's MCP is experimental. Render's MCP cannot trigger deploys.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Zero migration cost — the project scaffold (`@astrojs/cloudflare`, `wrangler.jsonc`, `astro:env/server`, `nodejs_compat`) is already wired for Workers. Perfect 10/10 criteria score. Developer familiarity with the platform. Free tier covers up to 3M requests/month (100k requests/day), though SSR workloads need the $5/month Standard plan for adequate CPU time. Co-located services (KV, R2, D1, Queues, Hyperdrive) are available as zero-network-hop bindings if needed later — none required for MVP with external Supabase.

#### 2. Vercel

Equally strong tooling: comprehensive CLI with `vercel rollback`, `vercel bisect` (unique regression-finder), and GA MCP server. Agent-readable docs with `.md` URL suffix on every page. The gap: requires swapping to `@astrojs/vercel/serverless` adapter and removing all Cloudflare-specific code. Hobby plan is free but limited to 12 functions per deployment (each Astro SSR route = one function — a hard blocker for apps with many pages) and prohibits commercial use. Pro plan costs $20/month per seat. Fluid Compute (GA) enables connection pooling, useful for Supabase.

#### 3. Netlify

Solid serverless platform with GA MCP server (`@netlify/mcp`), `llms.txt`, and Netlify Database (managed Postgres). Credit-based pricing: 300 free credits/month covers ~150k requests at low bandwidth. The gaps: no CLI rollback command (REST API only), requires `@astrojs/netlify` adapter swap, and the free plan hard-pauses all projects when credits run out — no graceful degradation. No WebSocket support (irrelevant here since Supabase handles realtime).

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **10ms CPU cap on Free plan kills SSR in production.** Astro 6 SSR with Supabase auth checks and React 19 hydration prep regularly exceeds 10ms CPU. The Free plan works for staging only — production requires the $5/month Standard plan (30s CPU limit).
2. **workerd is not Node.js.** `nodejs_compat` polyfills many Node APIs, but `fs`, `child_process`, `net.createServer`, and some crypto internals are absent. A future dependency update that introduces a transitive `node:net` or `node:fs` import will fail at runtime with no build-time warning.
3. **No persistent state between requests.** Connection pooling and in-memory caching patterns from Node.js servers don't apply. Supabase auth via cookies handles sessions, but DB connection pooling requires Hyperdrive (additional configuration).
4. **128 MB memory limit per invocation.** Adequate for typical SSR, but processing very large AI-generated flashcard sets (200+ cards from a long document) could approach the ceiling. The limit is non-configurable on any plan.
5. **Vendor lock-in deepens with each Cloudflare-specific integration.** `@astrojs/cloudflare`, `wrangler.jsonc`, KV/R2/D1 bindings — every addition raises exit cost. If the adapter falls behind Astro releases or Cloudflare changes pricing, migration is a multi-day effort.

### Pre-Mortem — How This Could Fail

The team deployed their Astro 6 flashcard app on Cloudflare Workers for $5/month. It worked beautifully for two months. Then three things compounded. First, the AI generation endpoint — calling OpenRouter and streaming 20+ flashcards — started hitting the 30-second CPU limit on complex inputs. JSON parsing, Zod validation, and Supabase batch inserts all count as CPU time, not wall-clock time. Refactoring to a queue-based architecture with Cloudflare Queues cost two weeks of after-hours work. Second, a Supabase JS update introduced a transitive dependency on `node:net` for connection pooling. It passed `npm run build` but threw at runtime on workerd. The team spent three days on opaque "Module not found" errors before pinning the old version, unable to take security patches. Third, when they wanted PDF-based flashcard generation — a natural feature request — they discovered PDF parsing libraries require `fs` and native bindings that fundamentally cannot run on workerd. They faced a choice: abandon the feature, or migrate to Node.js on Fly.io — losing the Cloudflare-specific scaffold they'd invested in. The $5/month platform that "just worked" became a constraint on product evolution.

### Unknown Unknowns

- **Wrangler version churn.** Wrangler's major-version cadence is fast, and breaking changes between versions can silently alter build output paths, config keys, or deployment behavior. A simultaneous adapter + wrangler update can produce hard-to-diagnose build failures.
- **`compatibility_date` is a hidden API surface.** Cloudflare uses this date to gate runtime behavior changes. There's no tooling that warns "updating this date will change behavior X" — you discover it in production.
- **Supabase Edge Functions compete with Workers.** If you later need server-side logic closer to your database (complex RLS bypass, DB triggers with business logic), you'll be split between two edge runtimes with different debugging tools and deployment flows.
- **Preview deploys require extra setup.** Unlike Vercel/Netlify where PR preview URLs are automatic, Cloudflare Workers preview deployments require configuring Workers Versions or using the older Pages model. Branch-based previews are not automatic with the Workers deploy path.
- **Observability is minimal out of the box.** `wrangler tail` gives real-time logs with no persistence. No built-in error aggregation or APM. For a solo developer debugging at 11 PM, you're tailing live with no history unless you've configured Logpush to R2 or a third-party service.

## Operational Story

- **Preview deploys**: Workers Versions allow deploying a new version alongside the current one. Branch-based preview URLs are not automatic — configure a GitHub Actions workflow to deploy to a preview route, or use `wrangler versions upload` + `wrangler versions deploy --percentage 0` to stage without serving traffic. Protect preview URLs with Cloudflare Access if they contain user data.
- **Secrets**: Environment variables and secrets are set via `wrangler secret put <NAME>` (interactive prompt, value not logged). For CI, use GitHub Actions secrets piped to `wrangler secret:bulk`. Secrets are encrypted at rest, scoped per Worker, and readable only by the Worker runtime — not via API or dashboard after set. Rotation: `wrangler secret put <NAME>` again overwrites the old value.
- **Rollback**: `npx wrangler rollback` reverts to the previous deployment instantly. For targeted rollback: `wrangler versions deploy --version-id <id> --percentage 100`. Typical time-to-revert is under 30 seconds globally. Caveat: rollback does not revert Supabase database migrations — those require separate handling.
- **Approval**: Human-only actions: rotating Supabase service-role key, deleting the Worker, changing the Cloudflare billing plan, modifying DNS records. Agent-safe actions: `wrangler deploy`, `wrangler rollback`, `wrangler tail`, `wrangler secret put` (for non-primary secrets).
- **Logs**: `npx wrangler tail` streams live logs (stdout, console.log, exceptions) in real time. Filter with `--format json` for structured output. No built-in log retention — for persistent logs, configure Logpush (Workers Trace Events → R2 bucket or external sink). The Cloudflare docs MCP server at `https://docs.mcp.cloudflare.com/mcp` provides structured doc queries.

## Risk Register

| Risk                                                              | Source                       | Likelihood   | Impact                   | Mitigation                                                                                                                                                     |
| ----------------------------------------------------------------- | ---------------------------- | ------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free plan 10ms CPU cap causes SSR request failures                | Devil's advocate             | High         | High                     | Use Workers Standard ($5/month) from day one. Free plan for staging only.                                                                                      |
| Supabase JS update introduces incompatible Node API dependency    | Devil's advocate, Pre-mortem | Medium       | High                     | Pin `@supabase/supabase-js` version. Test `npm run build && wrangler dev` after every dependency update before deploying.                                      |
| 128 MB memory limit hit on large AI generation responses          | Devil's advocate             | Low          | Medium                   | Limit input text size (e.g., 10k characters). Stream flashcard processing rather than buffering entire response in memory.                                     |
| `compatibility_date` update silently changes runtime behavior     | Unknown unknowns             | Medium       | Medium                   | Pin `compatibility_date` in `wrangler.jsonc` and only advance it deliberately, with a staging test pass.                                                       |
| Wrangler major-version update breaks adapter build                | Unknown unknowns             | Medium       | Medium                   | Pin wrangler version in `package.json`. Update adapter and wrangler together, never independently.                                                             |
| No built-in log persistence — debugging production issues is hard | Unknown unknowns             | Medium       | Low                      | Accept for MVP. Configure Logpush to R2 when traffic justifies it.                                                                                             |
| Preview deploys not automatic — PRs don't get preview URLs        | Unknown unknowns             | Low          | Low                      | Add a GitHub Actions step: `wrangler versions upload` on PR open. Acceptable manual step for a solo developer.                                                 |
| Vendor lock-in makes future platform migration expensive          | Devil's advocate             | Low (at MVP) | High (long-term)         | Keep Cloudflare-specific bindings (KV, R2, D1) out of MVP unless needed. Supabase and OpenRouter are already external — the adapter is the main lock-in point. |
| PDF/file-processing features impossible on workerd                | Pre-mortem                   | Low (at MVP) | High (if feature needed) | Accept for MVP (PRD explicitly excludes file import). Revisit platform if file processing enters scope.                                                        |

## Getting Started

1. **Install wrangler** (if not already global): `npm install -g wrangler` — the project already has it as a dev dependency, so `npx wrangler` also works.
2. **Authenticate**: `wrangler login` — opens a browser OAuth flow to link your Cloudflare account.
3. **Set secrets**: `wrangler secret put SUPABASE_URL` and `wrangler secret put SUPABASE_KEY` — enter values at the interactive prompt. These map to the `astro:env/server` declarations in the project.
4. **Deploy**: `npm run build && npx wrangler deploy` — builds the Astro SSR bundle and deploys to Cloudflare Workers. The `wrangler.jsonc` already points `main` to the correct `@astrojs/cloudflare` entrypoint.
5. **Verify**: visit the URL printed by `wrangler deploy`. Check the sign-in page loads, Supabase auth works (cookie is set), and the dashboard renders server-side.

## Out of Scope

The following were not evaluated in this research:

- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
