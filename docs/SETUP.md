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

## CI & Deploy Automation

Two GitHub Actions workflows protect the repo:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | PR + push to `main` | Lint, typecheck, unit tests, Next.js build |
| `integration.yml` | PR + push to `main` (DB path filter) | Run integration tests against Neon test branch |

### One-time setup

**1. Create a Neon `test` branch.**

In the Neon dashboard → Branches → "Create branch" from `main`, name it `test`. Copy its pooled connection string.

**2. Add GitHub repo secrets.**

GitHub → repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `DATABASE_URL_TEST` | The `test`-branch pooled connection string from Neon |

**3. Push a trivial commit and watch the Actions tab.** Verify both workflows fire as expected — CI passes, integration applies the migration and passes.

**4. Enable branch protection.**

GitHub → repo → Settings → Branches → "Add branch protection rule" for `main`:
- Require a pull request before merging (enforced for admins too).
- Require status checks to pass before merging. Select:
  - `lint`
  - `typecheck`
  - `test-unit`
  - `build`
  - `integration`
- Require branches to be up to date before merging.
- Disallow force pushes.
- Disallow branch deletion.

### Troubleshooting

- **Integration test schema drift** — Reset the `test` branch from `main` in Neon, then re-run CI.
- **Emergency hotfix bypassing protection** — As repo admin you can temporarily disable the protection rule in GitHub settings, push the fix, re-enable. Use sparingly.
- **A PR doesn't trigger integration.yml** — Check its path filter. PRs that touch only UI / content skip the integration workflow by design. Add the affected path to the filter if it's missing.

## AdSense

Typing Speed is wired to serve Google AdSense ads on dashboard, history, leaderboard, and profile pages. Until the site is approved by AdSense and the env vars below are set, `<AdSlot>` components render null and no AdSense script loads.

### Pre-application checklist

Before submitting the site to AdSense:

1. Production deployment is live on Vercel with substantial typing content.
2. `/privacy`, `/terms`, `/about` pages exist and are reachable from the footer.
3. `public/ads.txt` file exists (placeholder is fine; real value comes after approval).
4. No ads are displaying yet — this is correct behavior pre-approval.

### Application

1. Apply at <https://www.google.com/adsense/start/>.
2. Use your production domain.
3. Wait for review. Approvals typically take days to weeks.

### Post-approval rollout

In order:

1. **AdSense dashboard → Sites** — confirm site is verified.
2. **AdSense dashboard → Ads → By ad unit** — create 5 ad units matching the slot registry: `dashboard`, `history-top`, `history-bottom`, `leaderboard`, `profile`. Any ad unit type is fine (Display is the default). Copy each unit's slot ID.
3. **Update `src/components/ads/slot-ids.ts`** with the real IDs. Commit.
4. **Edit `public/ads.txt`** — uncomment the line and replace `REPLACE_WITH_YOUR_PUB_ID` with your real publisher ID (e.g. `pub-1234567890123456`). Commit.
5. **Set Vercel production env vars**:
   - `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-1234567890123456`
   - `NEXT_PUBLIC_ADSENSE_ENABLED=true`
6. **Redeploy** production.
7. **AdSense dashboard → Privacy & messaging → Configure EU messaging** — enable Funding Choices with the default template.
8. **Verify live**:
   - Open production in an incognito window. Visit `/dashboard` or `/leaderboard`. An ad should eventually load.
   - Open production from an EU VPN. Funding Choices consent banner should appear.

### Emergency kill switch

Set `NEXT_PUBLIC_ADSENSE_ENABLED=false` in Vercel and redeploy. No code change required.

### Troubleshooting

- **Ads blocked by extensions** — test with ad blockers disabled.
- **New approval delay** — fill rate is often low for the first 48-72 hours. Normal.
- **Application rejection** — common causes include thin content, missing legal pages, or policy issues. Fix and resubmit (Google allows multiple attempts).
- **`ads.txt` errors in AdSense dashboard** — verify `https://<prod-domain>/ads.txt` returns 200 with the uncommented line containing your real publisher ID.
