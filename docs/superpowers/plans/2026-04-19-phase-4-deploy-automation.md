# Deploy Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three GitHub Actions workflows (CI gates, DB integration, post-deploy smoke), a composite setup action, a PR template, and SETUP.md documentation so every merge to `main` is protected by CI and every deploy is smoke-tested.

**Architecture:** Three focused workflow files in `.github/workflows/`, each with a single responsibility. A composite action under `.github/actions/setup/` handles shared checkout+pnpm+Node setup to stay DRY. Vercel and Railway keep their existing git-auto-deploy integrations; we don't replace them. Branch protection (Section 5 of spec) is enabled manually after this plan lands — not part of the code.

**Tech Stack:** GitHub Actions (`ubuntu-latest`), Node 20, pnpm 10.12.4, Biome, Vitest, Next.js 16, Prisma, Neon Postgres.

**Source spec:** `docs/superpowers/specs/2026-04-19-phase-4-deploy-automation-design.md`

---

## File Structure (reference)

### New files

```
.github/
├── actions/
│   └── setup/
│       └── action.yml              # Composite: checkout + pnpm + Node + install
├── workflows/
│   ├── ci.yml                       # PR gates (lint/typecheck/test-unit/build/build-server)
│   ├── integration.yml              # DB-gated integration tests
│   └── smoke.yml                    # Post-deploy Railway /healthz poll
└── PULL_REQUEST_TEMPLATE.md         # Simple PR checklist
```

### Modified files

```
package.json                         # Add packageManager: pnpm@10.12.4
docs/SETUP.md                        # Append "CI & Deploy Automation" section
```

---

## Task 1: Pin pnpm version via `packageManager` field

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify current pnpm version**

```bash
pnpm --version
```

Expected: `10.12.4` (the version captured during planning). If your local pnpm differs, use *your* version in Step 2 instead — the point is lock-in, not the specific version.

- [ ] **Step 2: Add `packageManager` field to `package.json`**

Open `/Users/red/typing-speed/package.json`. Add the field just above `"scripts"`:

```json
{
  "name": "typing-speed",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@10.12.4",
  "scripts": {
    ...
  }
}
```

- [ ] **Step 3: Verify install still works**

```bash
pnpm install --frozen-lockfile
```

Expected: "Already up to date" or a clean resolution. No errors.

- [ ] **Step 4: Verify lint/typecheck/tests still clean**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -s -S -m "chore(build): pin pnpm version via packageManager field"
```

---

## Task 2: Composite setup action

**Files:**
- Create: `.github/actions/setup/action.yml`

- [ ] **Step 1: Create the file**

```bash
mkdir -p .github/actions/setup
```

Write `.github/actions/setup/action.yml`:

```yaml
name: 'setup'
description: 'Checkout, pnpm, Node 20, install deps'
runs:
  using: 'composite'
  steps:
    - uses: actions/checkout@v4

    - name: install pnpm
      uses: pnpm/action-setup@v4

    - name: install node
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: 'pnpm'

    - name: install dependencies
      shell: bash
      run: pnpm install --frozen-lockfile
```

- [ ] **Step 2: Validate YAML syntax**

```bash
node -e "const y=require('yaml');y.parse(require('fs').readFileSync('.github/actions/setup/action.yml','utf8'));console.log('OK')" 2>&1 || echo "Note: 'yaml' may not be installed; alternatively: cat the file to eyeball"
```

If `yaml` isn't available locally, just verify manually: open the file and check no tabs, consistent 2-space indentation, no obvious syntax issues.

- [ ] **Step 3: Commit**

```bash
git add .github/actions/setup/action.yml
git commit -s -S -m "ci: add composite setup action"
```

---

## Task 3: CI workflow (`ci.yml`)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p .github/workflows
```

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm lint

  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm db:generate
      - run: pnpm typecheck

  test-unit:
    name: test-unit
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm db:generate
      - run: pnpm test tests/unit

  build:
    name: build
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm db:generate
      - run: pnpm build

  build-server:
    name: build-server
    runs-on: ubuntu-latest
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm db:generate
      - run: pnpm build:server
```

Key details:
- Composite action path is `./.github/actions/setup` — relative to repo root, valid because the composite was created in Task 2.
- Every job calls `pnpm db:generate` except `lint` (Biome doesn't need Prisma types).
- No env vars set — `src/env.ts` has every field optional, so the build runs without secrets.

- [ ] **Step 2: Validate YAML structure**

```bash
node -e "const y=require('yaml');const d=y.parse(require('fs').readFileSync('.github/workflows/ci.yml','utf8'));console.log(Object.keys(d.jobs))" 2>&1
```

Expected output (or similar): `[ 'lint', 'typecheck', 'test-unit', 'build', 'build-server' ]`. If `yaml` package isn't installed, eyeball the file for correctness.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -s -S -m "ci: add PR gate workflow (lint, typecheck, test-unit, build, build-server)"
```

---

## Task 4: Integration workflow (`integration.yml`)

**Files:**
- Create: `.github/workflows/integration.yml`

- [ ] **Step 1: Create the file**

Write `.github/workflows/integration.yml`:

```yaml
name: Integration

on:
  pull_request:
    paths:
      - 'prisma/**'
      - 'src/lib/db/**'
      - 'src/lib/race/**'
      - 'server/**'
      - 'tests/integration/**'
      - '.github/workflows/integration.yml'
  push:
    branches: [main]
    paths:
      - 'prisma/**'
      - 'src/lib/db/**'
      - 'src/lib/race/**'
      - 'server/**'
      - 'tests/integration/**'
      - '.github/workflows/integration.yml'

concurrency:
  group: integration-shared
  cancel-in-progress: false

jobs:
  integration:
    name: integration
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL_TEST }}
      NODE_ENV: test
    steps:
      - uses: ./.github/actions/setup
      - run: pnpm db:generate
      - name: apply migrations to test branch
        run: pnpm db:migrate:deploy
      - name: run integration tests
        run: pnpm test tests/integration
```

Key details:
- `concurrency.cancel-in-progress: false` — runs queue instead of canceling, so the shared Neon `test` branch isn't mid-truncated by a concurrent run.
- Path filter repeats in both `pull_request` and `push` blocks (GitHub Actions requires this).
- `DATABASE_URL` is set at the job level, scoped to this workflow only.
- `NODE_ENV: test` affects how Next.js config / Prisma logs render, harmless if unused.

- [ ] **Step 2: Validate YAML**

```bash
node -e "const y=require('yaml');const d=y.parse(require('fs').readFileSync('.github/workflows/integration.yml','utf8'));console.log(d.on.pull_request.paths.length, 'paths filter present')"
```

Expected: `6 paths filter present` (or similar). If `yaml` isn't installed, eyeball.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/integration.yml
git commit -s -S -m "ci: add DB-gated integration workflow against Neon test branch"
```

---

## Task 5: Smoke workflow (`smoke.yml`)

**Files:**
- Create: `.github/workflows/smoke.yml`

- [ ] **Step 1: Create the file**

Write `.github/workflows/smoke.yml`:

```yaml
name: Smoke

on:
  push:
    branches: [main]

jobs:
  railway-healthz:
    name: railway-healthz
    runs-on: ubuntu-latest
    steps:
      - name: wait for Railway deploy to start
        run: sleep 30

      - name: poll Railway /healthz
        env:
          HEALTH_URL: ${{ secrets.RAILWAY_HEALTH_URL }}
        run: |
          if [ -z "$HEALTH_URL" ]; then
            echo "::warning::RAILWAY_HEALTH_URL secret not configured — skipping smoke test"
            exit 0
          fi
          deadline=$(( $(date +%s) + 300 ))
          while [ "$(date +%s)" -lt "$deadline" ]; do
            body=$(curl --fail --silent --max-time 10 "$HEALTH_URL" || true)
            if echo "$body" | grep -q '"ok":true'; then
              echo "✅ Railway health check passed: $body"
              exit 0
            fi
            echo "…not ready yet; body='$body'; retrying in 15s"
            sleep 15
          done
          echo "::error::Railway health check did not succeed within 5 minutes"
          exit 1
```

Key details:
- Graceful-no-op path: if `RAILWAY_HEALTH_URL` secret is missing (e.g. before Railway is set up), emit a warning and exit 0. Lets the workflow be merged before the secret exists.
- 5-minute poll budget with 15s interval = 20 attempts max.
- Match criterion: response body contains `"ok":true`. Matches the JSON shape already emitted by `server/index.ts`'s `/healthz` handler (`{"ok":true,"rooms":N}`).

- [ ] **Step 2: Validate YAML**

```bash
node -e "const y=require('yaml');const d=y.parse(require('fs').readFileSync('.github/workflows/smoke.yml','utf8'));console.log(Object.keys(d.jobs))"
```

Expected: `[ 'railway-healthz' ]`. If `yaml` isn't installed, eyeball.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/smoke.yml
git commit -s -S -m "ci: add post-deploy smoke workflow polling Railway /healthz"
```

---

## Task 6: PR template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create the file**

Write `.github/PULL_REQUEST_TEMPLATE.md`:

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

- [ ] **Step 2: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -s -S -m "ci: add PR template with summary + verification checklist"
```

---

## Task 7: `docs/SETUP.md` — add "CI & Deploy Automation" section

**Files:**
- Modify: `docs/SETUP.md` (append new section)

- [ ] **Step 1: Read the current SETUP.md to find the append point**

```bash
tail -20 docs/SETUP.md
```

Identify the last heading and verify you're appending cleanly (no missing newline, etc.).

- [ ] **Step 2: Append the new section**

Append the following to the bottom of `docs/SETUP.md`:

````markdown
## CI & Deploy Automation

Three GitHub Actions workflows protect the repo:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR + push to `main` | Lint, typecheck, unit tests, Next.js build, server build |
| `integration.yml` | PR + push to `main` (DB/server path filter) | Run integration tests against Neon test branch |
| `smoke.yml` | Push to `main` | Poll Railway's `/healthz` after auto-deploy |

### One-time setup

**1. Create a Neon `test` branch.**

In the Neon dashboard → Branches → "Create branch" from `main`, name it `test`. Copy its pooled connection string.

**2. Add GitHub repo secrets.**

GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DATABASE_URL_TEST` | The `test`-branch pooled connection string from Neon |
| `RAILWAY_HEALTH_URL` | Full URL of Railway's public `/healthz`, e.g. `https://typing-race-production.up.railway.app/healthz` |

**3. Push a trivial commit and watch the Actions tab.** Verify all three workflows fire as expected — CI passes, integration applies the migration and passes, smoke waits for Railway and passes.

**4. Enable branch protection.**

GitHub → repo → Settings → Branches → "Add branch protection rule" for `main`:
- Require a pull request before merging (enforced for admins too).
- Require status checks to pass before merging. Select:
  - `lint`
  - `typecheck`
  - `test-unit`
  - `build`
  - `build-server`
  - `integration`
- Require branches to be up to date before merging.
- Disallow force pushes.
- Disallow branch deletion.

The `smoke` workflow is deliberately **not** a required check — it runs after merge, not before.

### Troubleshooting

- **Integration test schema drift** — Reset the `test` branch from `main` in Neon, then re-run CI.
- **Smoke test flakes on cold deploys** — Bump the poll timeout in `.github/workflows/smoke.yml` from 5 min to 10 min.
- **Emergency hotfix bypassing protection** — As repo admin you can temporarily disable the protection rule in GitHub settings, push the fix, re-enable. Use sparingly.
- **A PR doesn't trigger integration.yml** — Check its path filter. PRs that touch only UI / content skip the integration workflow by design. Add the affected path to the filter if it's missing.
````

- [ ] **Step 3: Verify markdown renders cleanly**

```bash
head -80 docs/SETUP.md && echo '---' && tail -80 docs/SETUP.md
```

Eyeball: consistent heading levels, no stray backticks.

- [ ] **Step 4: Commit**

```bash
git add docs/SETUP.md
git commit -s -S -m "docs: add CI & deploy automation section to SETUP.md"
```

---

## Task 8: Final verification

**Files:** None (verification only).

- [ ] **Step 1: Confirm new file structure**

```bash
find .github -type f | sort
```

Expected output:
```
.github/PULL_REQUEST_TEMPLATE.md
.github/actions/setup/action.yml
.github/workflows/ci.yml
.github/workflows/integration.yml
.github/workflows/smoke.yml
```

- [ ] **Step 2: Verify every workflow references the right secret names**

```bash
grep -rn 'secrets\.' .github/workflows/
```

Expected:
- `integration.yml` references `secrets.DATABASE_URL_TEST`.
- `smoke.yml` references `secrets.RAILWAY_HEALTH_URL`.
- No other `secrets.` references.

If you see typos (`DATABASE_URL_TESTS`, etc.), fix them.

- [ ] **Step 3: All gates still pass locally**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build && pnpm build:server
```

Expected: all pass.

- [ ] **Step 4: Verify `packageManager` field is still set**

```bash
grep packageManager package.json
```

Expected: `"packageManager": "pnpm@10.12.4",`

- [ ] **Step 5: No commit needed if no changes were made. Final state review:**

```bash
git status
```

Expected: clean working tree.

```bash
git log --oneline phase-4/deploy-automation ^main | head
```

Expected: 8 commits on the branch (Tasks 1-7 each produce one commit, plus the spec commit already landed).

---

## Post-implementation rollout (user action, NOT part of this plan)

These steps are documented here for completeness but are **NOT** executed as part of the implementation. The user performs them after the plan lands:

1. Open a PR from `phase-4/deploy-automation` → `main` (`gh pr create ...`) — this PR itself will trigger the new CI workflows and act as the first real test.
2. Merge the PR to `main`.
3. In GitHub repo settings, add the two secrets (`DATABASE_URL_TEST`, `RAILWAY_HEALTH_URL`).
4. In Neon dashboard, create the `test` branch.
5. Push a trivial commit to main — watch the three workflows fire.
6. Enable branch protection per `docs/SETUP.md` → "CI & Deploy Automation".
7. From this point on, all development flows through PRs on phase-specific branches.

---

## Self-review notes

**Spec coverage vs plan:**

- Spec §1 (scope): all deliverables covered (Tasks 2-7 = ci.yml, integration.yml, smoke.yml, composite action, PR template, SETUP.md).
- Spec §2 (architecture): workflow separation and composite action — Tasks 2-5.
- Spec §3 (workflows): each subsection has a matching task (Task 3 / 4 / 5), plus Task 2 for the composite.
- Spec §4 (secrets): documented in SETUP.md (Task 7) — no code to write for secrets themselves (they're a GitHub settings action, covered in rollout).
- Spec §5 (branch protection): documented in SETUP.md (Task 7) — also a GitHub settings action, covered in rollout.
- Spec §6 (docs + PR template): Tasks 6 + 7.
- Spec §7 (rollout): documented in the plan's post-implementation section.

**Placeholder scan:** no `TBD` / `TODO` / `implement later` strings. Every step either shows code verbatim or gives a shell command with an expected outcome.

**Type / name consistency:**
- Composite action path `./.github/actions/setup` is consistent across Tasks 3, 4, 5.
- Secret names `DATABASE_URL_TEST` and `RAILWAY_HEALTH_URL` are consistent between workflows (Task 4, 5) and SETUP.md (Task 7).
- `packageManager` field value `pnpm@10.12.4` is consistent between Tasks 1 and 8.
- Required check names in SETUP.md (Task 7) match job `name:` fields in `ci.yml` (Task 3): `lint`, `typecheck`, `test-unit`, `build`, `build-server`. The integration job is named `integration` (Task 4), which matches.
