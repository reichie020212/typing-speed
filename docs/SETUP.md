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
