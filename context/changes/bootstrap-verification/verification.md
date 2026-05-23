---
bootstrapped_at: 2026-05-23T15:17:00Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: flip-it
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: flip-it
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

### Why this stack

Solo developer building a spaced-repetition flashcard web-app with auth and AI-powered card generation in 3 weeks, after-hours only. The 10x Astro Starter is the recommended default for (web-app, js) — it ships Astro 6 + React 19 for the UI, Supabase for PostgreSQL + auth + storage, and Cloudflare Pages for edge deployment. Auth is covered by Supabase out of the box, and AI flashcard generation wires through Astro API routes calling an LLM provider. All four agent-friendly gates pass: typed (TypeScript + Zod), convention-based (file-based routing + island architecture), popular in training data, and well-documented. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.

## Pre-scaffold verification

| Signal             | Value                                              | Severity | Notes                                      |
| ------------------ | -------------------------------------------------- | -------- | ------------------------------------------ |
| npm package        | not run                                            | —        | cmd_template uses git clone, not npm create |
| GitHub repo        | przeprogramowani/10x-astro-starter last pushed 2026-05-17 | fresh    | from card.docs_url                         |

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 17 top-level items (6 directories: .github, .husky, .vscode, public, src, supabase; 11 files: .env.example, .nvmrc, .prettierrc.json, astro.config.mjs, components.json, eslint.config.js, package-lock.json, package.json, README.md, tsconfig.json, wrangler.jsonc) plus node_modules
**Conflicts (.scaffold siblings)**: CLAUDE.md (sidelined as CLAUDE.md.scaffold)
**.gitignore handling**: append-merged — cwd lines preserved, scaffold lines de-duped and appended with `# from 10x-astro-starter` separator
**.bootstrap-scaffold cleanup**: directory emptied; removal blocked by Windows process handle (harmless — directory is empty)

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0

#### CRITICAL findings

None.

#### HIGH findings

- **devalue** v5.6.3–5.8.0 — DoS via sparse array deserialization (GHSA-77vg-94rm-hx3p, CVSS 7.5). Transitive dependency. Fix available via `npm audit fix`.

#### MODERATE findings

- **@astrojs/check** >=0.9.3 — via @astrojs/language-server. Direct dependency. Fix: downgrade to 0.9.2 (semver-major).
- **@astrojs/language-server** >=2.14.0 — via volar-service-yaml. Transitive.
- **@cloudflare/vite-plugin** 0.0.7–1.37.2 — via miniflare, wrangler, ws. Transitive. Fix available.
- **miniflare** 3.20250204.0–4.20260518.0 — via ws. Transitive. Fix available.
- **volar-service-yaml** <=0.0.70 — via yaml-language-server. Transitive.
- **wrangler** 3.108.0–4.93.0 — via miniflare. Direct dependency. Fix available.
- **ws** 8.0.0–8.20.0 — uninitialized memory disclosure (GHSA-58qx-3vcg-4xpx, CVSS 4.4). Transitive. Fix available.
- **yaml** 2.0.0–2.8.2 — stack overflow via deeply nested YAML collections (GHSA-48c2-rrv3-qjmp, CVSS 4.3). Transitive.
- **yaml-language-server** — via yaml. Transitive.

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                       | Value                              |
| -------------------------- | ---------------------------------- |
| bootstrapper_confidence    | first-class                        |
| quality_override           | false                              |
| path_taken                 | standard                           |
| self_check_answers         | null                               |
| team_size                  | solo                               |
| deployment_target          | cloudflare-pages                   |
| ci_provider                | github-actions                     |
| ci_default_flow            | auto-deploy-on-merge               |
| has_auth                   | true                               |
| has_payments               | false                              |
| has_realtime               | false                              |
| has_ai                     | true                               |
| has_background_jobs        | false                              |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
