# Venture City — Setup

What you need before you start
- Node.js 20 or newer installed (check with `node --version`)
- A GitHub account
- A Vercel account (free tier is enough)
- This repository cloned to your machine (`git clone <url>`, then `cd venture-city`)

Step 1 — Install dependencies
```
npm install
```

Step 2 — Create the database
Option A (recommended): Vercel Postgres.
1. Open vercel.com, go to Storage, Create Database, choose Postgres.
2. Open the `.env.local` tab, copy `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`.
3. On your machine create a file called `.env.local` in the repo root and paste:
```
POSTGRES_PRISMA_URL="paste-pooled-url-here"
POSTGRES_URL_NON_POOLING="paste-direct-url-here"
SESSION_SECRET="run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" and paste the output"
GM_BOOTSTRAP_SECRET="pick-a-one-time-secret-like-apple-mango-42"
NEXT_PUBLIC_VENUE_NAME="RR Campus, BE Block"
NEXT_PUBLIC_APP_VERSION="1.0.0"
```
Option B: Neon (neon.tech). Create a project, copy the pooled and direct connection strings into the same two variables.

Step 3 — Run the database migrations
```
npx prisma migrate deploy
```
Verify: you see `All migrations have been successfully applied.` If it says `P1001 can't reach database`, check the two URLs and your internet.

Step 4 — Seed the event data
```
npm run db:seed
```
This creates the run, 10 companies with opening cash and 60 resource units each, anchor contracts, 80 participants, customer/supplier/licence/grant/tender/media/mission/opportunity/objective/info rows, and a GM volunteer. Check: `npm run dev`, open http://localhost:3000/board, confirm the ten companies appear.

Step 5 — Create the first GM account
The seed already created volunteer `gm-1` using your `GM_BOOTSTRAP_SECRET` as its secret. Log in at http://localhost:3000/login under Volunteers with id `gm-1` and that secret. To create another GM later, POST to `/api/auth` with `{"createGM":true,"bootstrapSecret":"<GM_BOOTSTRAP_SECRET>","name":"Deputy","secret":"<new-secret>"}`.

Step 6 — Test locally
```
npm run dev
```
Open http://localhost:3000/board (public board, no login). Open http://localhost:3000/login, paste one participant qrToken from the database (or use `/api/gm/badges` after GM login), confirm wallet and company show at `/portal`. Open `/station`, `/bank`, `/gm`.

Step 7 — Push to GitHub
```
git init
git add -A
git commit -m "Venture City initial build (PART 1-12)"
git branch -M main
git remote add origin <your-github-url>
git push -u origin main
```

Step 8 — Deploy to Vercel
1. vercel.com, Add New, Project, Import the GitHub repo.
2. Framework preset: Next.js. Region: bom1 is pinned in vercel.json (Mumbai; change if venue differs).
3. Environment Variables: add every variable from `.env.local` into Production (and Preview). `BLOB_READ_WRITE_TOKEN` is auto-added when you create a Blob store under Storage.
4. Click Deploy. Verify: open `https://<your-app>.vercel.app/board`, the ten companies appear.

Step 9 — Run migrations and seed against production
```
$env:POSTGRES_PRISMA_URL="<production pooled url>"
$env:POSTGRES_URL_NON_POOLING="<production direct url>"
npx prisma migrate deploy
npm run db:seed
npm run t0:audit
```
(On Mac/Linux use `export` instead of `$env:`.) Do this BEFORE printing badges, because seed generates the qrTokens.

The Day 2 migration creates Deal Sheets, signatures, lanes, feature toggles, and live bank inventory. Vercel's build step only runs `prisma generate` and `next build`, so `npx prisma migrate deploy` must be run explicitly against Production after pushing this release and before `npm run db:seed`. Do not use `FORCE_SEED=1` after event activity begins.

Step 10 — Print the QR badges
1. Log in as GM on the production URL, then open `https://<your-app>.vercel.app/api/gm/badges`.
2. Print the page (one card per participant with badge number and login link). Cut into badges.
3. After last-minute registrations: add the participant in `/gm` (or rerun seed only if event has not started), reopen `/api/gm/badges` and print the new cards.

Step 11 — Event day checklist
- [ ] Sign in as GM at /gm
- [ ] Confirm the clock state is PRE
- [ ] Confirm the ten companies appear on /board
- [ ] Confirm the Bank desk can sell a resource against a test company
- [ ] Press "Settle tick" once as a test; verify it completes in under 60s
- [ ] Reset to tick 0 using the reset route (see below) before doors open
- [ ] Draw the lead thesis at 08:30 with the Deputy GM as witness
- [ ] Start Human Internet I at 09:50 (announce, switch info_mode to DARK)
- [ ] Start Market Open at 10:35 (announce, switch info_mode to CLOSED, set current_tick to 1)

For browser smoke tests locally:
```bash
npm run e2e
```
This starts/reuses the local dev server and runs `tests-e2e.spec.ts` only.

If the internet drops
1. Announce paper mode. The Deputy GM opens the last printed paper snapshot (from `/api/paper-export?tick=<last-settled>`; print one at every tick boundary).
2. Record every trade on paper Trade Slips: tick, buyer, seller, units, price, two signatures, form number.
3. Run the tick manually from the printed balances (salaries, consumption, contract lines per the printed sheet).
4. After restore: a GM replays each paper slip via GM entry (`/gm`, reason mandatory with form number). The journal stays append-only; nothing is edited.

If the database is slow or errors
1. Check Vercel dashboard, Functions, Logs for the failing route.
2. If settle hung: in the database run `UPDATE "SettlementLock" SET "lockedAt"=NULL,"lockedBy"=NULL WHERE id=1;` then re-press Settle. The 5-minute stale clause also auto-releases.
3. Trigger `/api/gm/backup` immediately as a safety net (stores NDJSON in Vercel Blob).

Resetting for a second run
```
$env:FORCE_SEED="1"
npm run db:seed
```
This wipes game tables and reseeds a clean T0. Only use before doors open.

Where the game rules live
All game rules are in the build prompt (PART 9) and the seed files under `data/`. Nothing the operator clicks on the day changes the rules; the UI only records what happened.

Troubleshooting
1. Prisma P1001 (can't reach DB): wrong URL or no internet. Copy fresh URLs from Vercel/Neon.
2. Prisma P2002 (unique violation): idempotency key or badge duplicated. Reuse returns the existing row; for badges use a new badge number.
3. Migration drift (`migrate deploy` complains): run `npx prisma migrate resolve --applied "<name>"` only if you know the migration already ran, else `npx prisma db push` on a dev DB.
4. Neon cold start (first query slow): retry once; keep polling at 15-30s so the pool stays warm.
5. JWT secret mismatch (logged out everywhere): `SESSION_SECRET` differs between environments. Set the same value in all Vercel env scopes.
6. Missing env var (prisma/jose crash): compare Vercel Project Settings, Environment Variables with `.env.example`.
7. Port conflict locally (`3000 in use`): `npm run dev -- -p 3001`.
8. Function timeout on settle: keep to 10 companies; check logs; split steps 5-10 into a second invocation if consistently over 50s.
9. Blob token missing: create a Blob store in Vercel Storage; redeploy so `BLOB_READ_WRITE_TOKEN` injects.
10. Cookie not set (login loops): must be HTTPS in production for `Secure` cookies; test on the `https://*.vercel.app` URL, not `http://`.
