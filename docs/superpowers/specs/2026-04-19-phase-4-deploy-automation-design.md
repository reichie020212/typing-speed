# Phase 4 (Deploy Automation) Design

**Status:** Approved 2026-04-19
**Branch:** `phase-4/deploy-automation`
**Depends on:** Phase 3 complete (shipped on `main`)
**Deliverables:** Three GitHub Actions workflows, shared composite setup action, PR template, SETUP.md updates, documented branch-protection rollout.

---

## 1. Scope and Non-Goals

### In scope

- `.github/workflows/ci.yml` — PR gate running lint, typecheck, unit tests, Next.js build, server build. Parallel jobs.
- `.github/workflows/integration.yml` — DB-backed integration tests against a dedicated Neon `test` branch. Triggered by path filter on DB/server/test changes plus every push to `main`.
- `.github/workflows/smoke.yml` — post-deploy health-check of Railway on push to `main`.
- `.github/actions/setup/action.yml` — composite action for shared pnpm + Node setup.
- `.github/PULL_REQUEST_TEMPLATE.md` — minimal PR checklist.
- `docs/SETUP.md` — "CI & deploy" section documenting the required GitHub secrets, Neon test branch creation, branch-protection rules.
- One-time manual rollout steps (secrets, Neon branch, branch protection) — documented, not automated.

### Out of scope (deferred to other Phase 4 sub-areas or later)

- Playwright e2e in CI (belongs to the e2e sub-phase; the `e2e/` scaffold already exists but tests are not written yet).
- Automated rollback on deploy failure.
- Vercel smoke test (Vercel's auto-deploy is reliable; PR preview URLs already validate builds).
- Per-PR isolated Neon branches (v1 uses a single persistent test branch, serialized via workflow concurrency).
- Dependency update automation (Renovate / Dependabot) — worth adding later but not needed for deploy-automation goals.
- Cron-triggered workflows (nightly full-suite runs, etc.).

### What stays unchanged

- Vercel auto-deploys `main` to production and creates preview URLs for PR branches (via their GitHub App).
- Railway auto-deploys `main` to production (via their GitHub integration).
- We do **not** trigger deploys from GitHub Actions — git push is the deploy signal.

## 2. Architecture

### Three workflow files, one responsibility each

| Workflow | Triggers | Purpose | Required check? |
|---|---|---|---|
| `ci.yml` | PR + push to main | Fast feedback on code quality | ✅ required |
| `integration.yml` | PR + push to main (path-filtered) | DB-layer regression catching | ✅ required |
| `smoke.yml` | Push to main only | Post-deploy health signal | ❌ observed, not required |

### Shared composite action

`.github/actions/setup/action.yml` — checkout → pnpm install → Node 20 → `pnpm install --frozen-lockfile`. DRY; every job invokes it as a single step before running its specific command.

### Concurrency strategy

- `ci.yml`: `concurrency: ci-${{ github.ref }}` with `cancel-in-progress: true`. New pushes to a PR cancel older runs; doesn't waste compute.
- `integration.yml`: `concurrency: integration-shared` with `cancel-in-progress: false`. The Neon `test` branch is mutated by the suite, so runs serialize to avoid mid-test truncation. New runs queue; worst case ~2-3 min wait per queued run.
- `smoke.yml`: no concurrency group — one run per push to main.

### Why GitHub Actions

The repo is on GitHub. GitHub Actions provides native PR status checks that integrate with branch protection, free tier is generous for a small project, and we already have `gh` CLI access for ad-hoc debugging. No reason to bring in CircleCI or similar.

## 3. Workflows

### 3.1 `.github/workflows/ci.yml`

**Triggers:** `pull_request` (any branch), `push` to `main`.

**Five parallel jobs** on `ubuntu-latest`, Node 20, all using the composite setup action:

1. **`lint`** — `pnpm lint`. Biome check. ~30s.
2. **`typecheck`** — `pnpm db:generate && pnpm typecheck`. Prisma client required before TSC. ~45s.
3. **`test-unit`** — `pnpm db:generate && pnpm test tests/unit`. Unit tests only (tests/integration excluded by path). ~40s.
4. **`build`** — `pnpm db:generate && pnpm build`. Next.js production build. All env vars in `src/env.ts` are `.optional()`, so the build runs with no secrets set — the app renders "not configured" paths where needed but the build itself succeeds. ~60s.
5. **`build-server`** — `pnpm db:generate && pnpm build:server`. Compiles Socket.io server with `tsc -p server/tsconfig.json`. ~20s.

**Fail-fast:** default at job level. One failing job does not cancel peers — all five statuses show up at once.

**Caching:** pnpm store cache via `actions/setup-node@v4` with `cache: 'pnpm'`. Key derived from `pnpm-lock.yaml`. Prisma generated client is part of `node_modules` and is regenerated fresh each run (fast, safe, avoids stale client across schema changes).

**pnpm pinning:** add `"packageManager": "pnpm@<current-version>"` to `package.json` using the exact version reported by `pnpm --version` on the dev machine (e.g. `pnpm@10.18.0`). `pnpm/action-setup` reads this field; pinning avoids drift between local and CI pnpm versions.

### 3.2 `.github/workflows/integration.yml`

**Triggers:** `pull_request` + `push` to `main`, path-filtered:

```yaml
paths:
  - 'prisma/**'
  - 'src/lib/db/**'
  - 'src/lib/race/**'
  - 'server/**'
  - 'tests/integration/**'
  - '.github/workflows/integration.yml'
```

PRs touching only UI or content skip this workflow.

**Single job, serial execution:**

1. Composite setup action.
2. `pnpm db:generate`.
3. `pnpm db:migrate:deploy` — applies any new migrations to the test branch. Idempotent; no-ops when schema is up to date.
4. `pnpm test tests/integration` — runs all DB-gated tests (13+ currently: races, happy-path, late-join, disconnect-dnf, host-reassign, two-tab-dedupe, plus Phase 2 db tests).
5. Env: `DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}`, `NODE_ENV: test`.

**Runtime:** ~2 min end-to-end (migration typically <5s, tests ~90s, setup ~30s).

**Why not per-PR Neon branches?** Creating a branch per PR requires a Neon API call + cleanup on PR close. A persistent `test` branch with `beforeEach` truncation via the existing `withDatabase()` fixture is simpler and sufficient at this scale. Worth revisiting if queue wait times become painful.

### 3.3 `.github/workflows/smoke.yml`

**Trigger:** `push` to `main` only.

**Single job:**

1. Sleep 30s (allows Railway's auto-deploy to kick off).
2. Poll `${{ secrets.RAILWAY_HEALTH_URL }}` every 15s, up to 5 minutes total. Success = HTTP 200 AND JSON body contains `"ok":true`. Otherwise: fail the job with a clear error annotation.
3. On failure, the commit on main gets a red check. No auto-rollback.

**No Vercel smoke step.** Vercel's own deploy status is observable in their dashboard, preview URLs have already validated the build on the PR, and hitting a cold-start `/` from GitHub Actions would produce flaky noise. Adds no signal we don't already have.

### 3.4 Composite action `.github/actions/setup/action.yml`

```yaml
name: 'setup'
description: 'Checkout, pnpm, Node 20, install deps'
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'
    - name: install
      shell: bash
      run: pnpm install --frozen-lockfile
```

Every job in `ci.yml` and `integration.yml` invokes this as its first step.

## 4. Secrets and Neon Test Branch

### GitHub repository secrets

| Secret | Used by | Value | Scope |
|---|---|---|---|
| `DATABASE_URL_TEST` | `integration.yml` | Pooled connection string to Neon `test` branch | Job-level in integration.yml only |
| `RAILWAY_HEALTH_URL` | `smoke.yml` | Full URL of Railway's `/healthz` endpoint | Job-level in smoke.yml only |

No other secrets are needed. The `RACE_SERVER_SECRET` used inside `tests/integration/race/test-server.ts` is a hardcoded test-only value in the test file — it is not a production secret, is publicly visible in the repo, and poses no risk because the test server is only spun up in CI on an ephemeral port.

### Neon test branch — one-time setup

1. In Neon dashboard → Branches → "Create branch" from `main`, name it `test`.
2. Copy the pooled connection string from the test branch.
3. In GitHub → Settings → Secrets and variables → Actions → New repository secret: `DATABASE_URL_TEST`, paste value.
4. On first CI run of integration tests, `prisma migrate deploy` applies the Phase 3 schema to the branch automatically.

### Cleanup and rotation

- No periodic cleanup needed. `withDatabase()` truncates all tables in `beforeEach`.
- Schema drift: if a bad migration lands on the test branch, use Neon's "reset branch" feature to reset it from main, then re-run CI.
- Rotating `DATABASE_URL_TEST`: generate a new password in Neon, paste the new string into the GitHub secret. No code changes.

### Principle of least privilege

Secrets are declared at the job level inside the workflow that needs them, not at the workflow or repo level. `ci.yml` has no access to `DATABASE_URL_TEST`; `smoke.yml` has no access to it either.

## 5. Branch Protection on `main`

**Rules applied via GitHub repo Settings → Branches → Branch protection rule (not code — documented here for the rollout step):**

- **Require a pull request before merging** (including for admins). No more direct pushes to main.
- **Require status checks to pass before merging** — the following checks must be green:
  - `lint`
  - `typecheck`
  - `test-unit`
  - `build`
  - `build-server`
  - `integration` (from integration.yml; when path filter skips it, GitHub treats "skipped" as non-blocking — intentional)
- **Require branches to be up to date** before merging — forces rebase if main moved.
- **Disallow force pushes** to main.
- **Disallow branch deletion** for main.

**`smoke.yml` is deliberately NOT a required check.** It runs *after* merge, on the resulting main commit. Making it a merge gate is circular. Its red/green status is visible on the main-branch commit; notifications fire via GitHub's default commit-status notifications.

**"Enforced for admins"** means even you won't be able to push directly to main going forward. The Phase 3 commits already on main pre-date this rule and are grandfathered in.

**Acknowledged trade-off:** Emergency hotfixes have to be rushed through the PR flow. For a hobby project this is acceptable; if the project grows to have oncall-style urgency, revisit with a "break-glass" admin override.

## 6. Documentation and PR Template

### `docs/SETUP.md` addition

Appended as a new `## CI & Deploy Automation` section containing:
- Overview of the three workflows and their triggers.
- One-time setup checklist: create Neon test branch, add GitHub secrets, enable branch protection.
- Required GitHub secrets table (mirrors Section 4 above).
- Troubleshooting notes: schema drift recovery, how to bypass branch protection in emergencies (admin override), how to re-run a flaky smoke test.

### `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Summary
<!-- 1-2 sentences describing what this PR does and why -->

## Changes
<!-- Bulleted list of notable changes -->

## Verification
- [ ] Lint, typecheck, unit tests pass locally
- [ ] Manual smoke test of the affected feature
- [ ] Docs updated if behavior changed
```

No emoji. No yak-shaving. Just enough to remind contributors to describe the change and verify it.

## 7. Rollout

These are **manual steps you perform after the plan lands**, not part of the implementation plan. Documented here so they're not lost.

1. Merge `phase-4/deploy-automation` → `main` (the last direct push permitted on main — enabled because branch protection is enabled *after* these workflows exist).
2. GitHub → Settings → Secrets and variables → Actions:
   - Add `DATABASE_URL_TEST` (value from Neon).
   - Add `RAILWAY_HEALTH_URL` (your Railway service's `/healthz` URL).
3. Neon dashboard → create branch `test` off `main` (if not already).
4. Push a trivial commit to main (docs tweak, etc.) and observe:
   - `ci.yml` runs and passes.
   - `integration.yml` runs, applies the migration, passes.
   - `smoke.yml` runs, waits for Railway, passes.
5. GitHub → Settings → Branches → "Add branch protection rule" for `main`. Configure per Section 5.
6. From this point on, all development flows through PRs on phase-specific branches.

## 8. Success Criteria

- A PR with a failing test cannot be merged to `main`.
- A PR with a type error cannot be merged.
- A PR with a broken Prisma migration cannot be merged (integration workflow catches it).
- A successful merge to `main` produces a green Railway smoke check within 5-6 minutes.
- CI round-trip for a lint-clean + type-clean PR is ≤3 minutes.
- Developer experience: the PR template and branch protection feel like gentle rails, not red tape.

## 9. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Neon test branch accumulates schema drift | `withDatabase()` truncates; schema rebuild via Neon "reset branch" is one-click. |
| Integration tests serialize → merge queue stalls | Acceptable at hobby scale; revisit with per-PR Neon branches if wait > 5 min. |
| GitHub Actions free tier exhausted | Free tier gives 2000 minutes/month for private repos. A PR costs ~3 min × 5 workflows = 15 min. 100+ PRs/month fits. Unlikely to hit limit. |
| Railway auto-deploy takes > 5 min on rare occasions | Smoke workflow's poll timeout is generous; bump to 10 min if it flakes. |
| Admin lockout from branch protection | User (Red) is the repo admin; can toggle protection in GitHub settings anytime. No external lockout surface. |
| Tests false-green because `test-integration` silently skipped due to path filter | Path filter includes the workflow file itself — any change to workflow forces a run. Plus `push to main` trigger runs it unconditionally. |

---

**End of spec.**
