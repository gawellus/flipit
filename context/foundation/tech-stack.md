---
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
---

## Why this stack

Solo developer building a spaced-repetition flashcard web-app with auth and AI-powered card generation in 3 weeks, after-hours only. The 10x Astro Starter is the recommended default for (web-app, js) — it ships Astro 6 + React 19 for the UI, Supabase for PostgreSQL + auth + storage, and Cloudflare Pages for edge deployment. Auth is covered by Supabase out of the box, and AI flashcard generation wires through Astro API routes calling an LLM provider. All four agent-friendly gates pass: typed (TypeScript + Zod), convention-based (file-based routing + island architecture), popular in training data, and well-documented. CI runs on GitHub Actions with auto-deploy-on-merge to Cloudflare Pages.
