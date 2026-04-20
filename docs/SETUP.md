# Setup — Neon Postgres + Google OAuth

Phase 2a requires two external services: a Postgres database and a Google OAuth client. This document walks through setting up both.

## 1. Neon Postgres

1. Sign up at https://neon.tech (free tier).
2. Create a new project; accept defaults.
3. In the dashboard, open **Connection Details**. Copy the "Pooled connection" string (starts with `postgres://`).
4. Add it to `.env.local` (create the file if it doesn't exist):
   ```
   DATABASE_URL=postgres://user:pass@host/db
   ```
5. Run the initial migration:
   ```bash
   pnpm db:migrate:dev --name init
   ```
   This creates all NextAuth + domain tables in Neon and generates `prisma/migrations/<timestamp>_init/`. Commit the generated migration folder.

## 2. Google OAuth client

1. Open https://console.cloud.google.com/apis/credentials.
2. If you don't have a project, create one named "Typing Speed".
3. **OAuth consent screen** → choose "External", fill in app name + support email, skip scopes, add your email as a test user (so only you can sign in while in "Testing" mode).
4. **Credentials** → "Create Credentials" → "OAuth client ID" → Application type: "Web application".
5. **Authorized redirect URIs** — add both:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google` (add later when deploying)
6. Copy the **Client ID** and **Client secret**; add to `.env.local`:
   ```
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

## 3. Auth secret

Generate a random secret:
```bash
openssl rand -hex 32
```
Add to `.env.local`:
```
AUTH_SECRET=<the output>
AUTH_URL=http://localhost:3000
```

## 4. Sanity check

Start the dev server:
```bash
pnpm dev
```

- Navigate to `/auth/signin` — you should see the "Continue with Google" button.
- Click it — Google's consent screen opens; approve.
- You land on `/dashboard` with three "—" stats (no tests yet).
- Take a test at `/single-player`. After finishing, watch for a brief "saved ✓" below the results.
- Reload `/dashboard`. The stats should update.

## 5. Deploy to Vercel (optional in Phase 2a)

1. Connect the repo to a new Vercel project.
2. In the Vercel project settings, add all five env vars from `.env.local` (with `AUTH_URL` pointing to the Vercel domain).
3. Add a `vercel-build` script to `package.json` so deploys auto-migrate:
   ```json
   "vercel-build": "prisma migrate deploy && next build"
   ```
4. Update the Google OAuth redirect URI list to include the Vercel domain.
5. Deploy.

## Troubleshooting

- **"Sign in is not configured yet"** — one of the four env vars is missing or blank. Check with `cat .env.local`.
- **`P1001: Can't reach database server`** — `DATABASE_URL` is wrong, or Neon is paused. Click "Resume" in the Neon dashboard.
- **OAuth error page after Google redirect** — usually a redirect URI mismatch. Double-check the URI list in Google Cloud Console (exact string match required).
- **"403: access_denied" from Google** — your consent screen is in Testing mode and your email isn't in the test-user list. Add it.
- **Integration tests fail locally** — they require `DATABASE_URL`. Skip with `DATABASE_URL= pnpm test` or fix the connection string.

## Phase 3: multiplayer (optional)

Phase 3 adds realtime multiplayer races via a standalone Socket.io server deployed alongside the Next.js app. Without these env vars, `/race` renders "Multiplayer not configured yet" and the rest of the app works unchanged.

### Required env vars

Set in **both** Vercel and Railway (or your chosen platform):

- `RACE_SERVER_SECRET` — a 32+ char random string. Generate with:

  ```bash
  openssl rand -base64 48
  ```

  This value must match **exactly** on both platforms.

Set in **Vercel only**:

- `NEXT_PUBLIC_RACE_SERVER_URL` — the public URL of the Socket.io server (e.g. `https://typing-race.up.railway.app`).

Set in **Railway only**:

- `DATABASE_URL` — the same Neon connection string used by Vercel (prod branch).
- `CORS_ORIGIN` — the Vercel production URL (e.g. `https://typing-speed.vercel.app`).

### Railway setup (Socket.io server)

1. Create a new Railway project from this repo.
2. Set the **Build Command** to `pnpm install && pnpm build:server`.
3. Set the **Start Command** to `node server/dist/server/index.js`.
4. Add the env vars above.
5. Deploy. Railway assigns a `*.up.railway.app` hostname — paste it into `NEXT_PUBLIC_RACE_SERVER_URL` in Vercel.

### Local development

Two terminals:

```bash
# Terminal 1 — Next.js
pnpm dev

# Terminal 2 — race server
pnpm dev:server
```

Or in a single terminal with `concurrently`:

```bash
pnpm dev:all
```

`.env.local` needs:

```
RACE_SERVER_SECRET=<32+ char string>
NEXT_PUBLIC_RACE_SERVER_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```

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
