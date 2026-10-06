# Venture City — Agent Handoff Document

> **Purpose**: Complete project state for seamless handoff to another agent. Read this before doing anything.

---

## 1. What This Is

Venture City is a live one-day multiplayer startup-economy simulation web app. 60–100 participants across 10 companies trade resources, sign contracts, raise capital, and survive 10 market ticks over ~9 hours. The platform is the sole source of truth for all money, resources, contracts, and scoring.

**Stack**: Next.js 14 App Router · TypeScript strict · Prisma + Neon Postgres · jose JWT · Tailwind · Vercel (bom1/Mumbai) · Vercel Blob · Vitest · Playwright

**Live URL**: https://venture-city.vercel.app

---

## 2. Critical Credentials & Secrets

| Secret | Value | Where |
|---|---|---|
| GM login ID | `gm-1` | Volunteer table |
| GM password | `4d4cb626a0eab88a9481cd3d` | Hashed in DB |
| GM_BOOTSTRAP_SECRET (Vercel env) | `d77113ed26eb0c57765be2d877b2cf8c` | Vercel dashboard |
| SESSION_SECRET (Vercel env) | `5c9312fb98720fd165dc2a4c8fc61d08e4f03c52baf6caeba98e5367d2c5ad18` | Vercel dashboard |
| Prod Neon pooled URL | `postgresql://neondb_owner:npg_MxzQRaldF4o8@ep-cool-mode-b3u5yxfg-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15` | Vercel env |
| Prod Neon direct URL | `postgresql://neondb_owner:npg_MxzQRaldF4o8@ep-cool-mode-b3u5yxfg.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=15` | Vercel env |
| Dev Neon URL (BROKEN — auth rejected) | `ep-ancient-boat-b36ymcbp` | .env.local |

**All secrets are also in `.env.local` (gitignored) and `.env` (gitignored, for Prisma CLI).**

---

## 3. Database State (Production)

- **Current tick**: 1 (test settle was run; needs reset to T0 before event)
- **Clock**: RUNNING
- **Companies**: 10 (SWC, LED, MAN, SKF, PAI, GRG, MED, STH, VLT, TRL)
- **Participants**: 80 (8 per company, badges 100–179)
- **Employment rows**: 80 (all ACTIVE)
- **gm-1 volunteer**: exists, password hash matches `4d4cb626a0eab88a9481cd3d`
- **No other volunteers exist** — crew must be created via GM console

---

## 4. Architecture Overview

### Core Modules (`src/`)

| File | Purpose |
|---|---|
| `db.ts` | Prisma singleton with global cache |
| `auth.ts` | JWT sign/verify (jose), hashSecret, newQrToken, signImpersonate/verifyImpersonate, csrfToken |
| `ledger.ts` | postTransaction (idempotent, balanced, validated), balance, available, reverseTransaction, escrowHold/Release |
| `settlement.ts` | 12-step settle engine — bulk-mode, ~60 queries/tick, idempotent per-op, resume-safe |
| `formulas.ts` | NAV, RV, WC, price_per_share, newShares, founderE, multiple, bankPriceStep, creditGrade, runway |
| `rounding.ts` | roundHalfAway, pct |
| `policy.ts` | sanitize (strips hidden fields), canReadCompany, assertNoLeak, HIDDEN_TOKENS |
| `seed.ts` | Full seed: 10 companies, 80 participants + employment, anchors, catalogues, gm-1 |

### API Routes (`app/api/`)

| Route | Method | Purpose |
|---|---|---|
| `auth` | POST | Login (QR/volunteer/impersonate), rate-limited |
| `board` | GET | Public board feed (tick, clock, companies, bank prices) |
| `health` | GET | Health check |
| `paper-export` | GET | Printable Deputy GM runbook (GM only) |
| `gm/settle` | POST | Run settlement for next tick (GM/Deputy) |
| `gm/freeze` | POST | Freeze/resume city (GM/Deputy) |
| `gm/entry` | POST | Manual journal entry (GM/Deputy/TechLead) |
| `gm/backup` | POST | Export journal as NDJSON to Blob (GM/Deputy) |
| `gm/badges` | GET | Printable QR badge sheet (GM/Deputy) |
| `gm/volunteers` | GET/POST | List/create volunteers |
| `gm/volunteers/reset-secret` | POST | Rotate a volunteer's secret |
| `gm/participants` | GET/POST | List/create participants |
| `gm/participants` | PATCH | Rename/reassign participant |
| `gm/impersonate` | POST | Generate one-time login link for a volunteer |
| `gm/reset` | POST | Wipe all game data + reseed (type RESET to confirm) |
| `bank/sell` | POST | Bank sells resource to company |

### Pages (`app/`)

| Page | Purpose |
|---|---|
| `/` | Landing hero with CursorRingField WebGL background |
| `/board` | Public city board (dark, polls 30s) |
| `/login` | QR/volunteer sign-in, auto-redirect on `?qr=` or `?t=` |
| `/portal` | Participant wallet, objective, missions |
| `/station` | Company dashboard (cash, resources, people, contracts) |
| `/bank` | Bank desk (prices + sell form) |
| `/investor` | Investor desk (fund, term sheets) |
| `/customer` | Customer desk (open cards) |
| `/supplier` | Supplier market |
| `/logistics` | Logistics desk |
| `/government` | Government desk (licences, grants, tenders) |
| `/media` | Media desk |
| `/talent` | Talent exchange |
| `/gm` | GM console (settle, freeze, entry, crew, reset, test tools) |
| `/observer` | Observer deck |

### Shared Components (`src/components/`)

| File | Purpose |
|---|---|
| `chrome.tsx` | Navbar, BrandBar, Stat, Footer, CoDot, HeroOrbs, PageHero, HamsterLoader |
| `cursor-ring-field.tsx` | WebGL particle field with cursor-following ring |

---

## 5. Settlement Engine Details

The settle runs in **bulk mode** (not a single transaction) to avoid serverless timeouts:

1. Acquires DB lock via `SettlementLock` table (5-min stale clause)
2. Loads all data in parallel (companies, employment, tiers, seats, loans, contracts, lines, participants)
3. Pre-creates all needed accounts via `createMany` + `skipDuplicates`
4. Loads all balances via single `GROUP BY` query
5. Each step builds `Op[]` arrays, validates in memory, posts via `bulkPost` (createMany for transactions + journal entries in chunks of 500)
6. Step markers in `Tick.notes` JSON enable resume after crash
7. Snapshots saved pre/post (inline JSON or Blob if >1MB)
8. Releases lock in `finally` block

**Idempotency**: Every op has key `settle-t{step}-{entity}-{id}`. On re-invoke, existing keys are skipped.

**Timing**: ~12 seconds for 10 companies on production.

---

## 6. Auth Flow

- **Participant**: QR token → JWT (12h) in HttpOnly cookie → `/portal`
- **Volunteer**: ID + secret → JWT (12h) in HttpOnly cookie → role-based redirect
- **Impersonate**: GM generates signed 5-min token → `/login?t={token}` → auto-login as that volunteer
- **Rate limiting**: 5 logins/min per IP (Postgres-backed via AuditLog)
- **CSRF**: Double-submit cookie (vc_csrf) — issued but not yet enforced on POST routes

---

## 7. UI Design System

- **Fonts**: Sora (display), Inter (body), JetBrains Mono (numbers) — all via @fontsource (local, no CDN)
- **Theme**: Light background (#F3F4F8), dark gradient heroes (navy→iris→mint), white cards with color-topped stats
- **Animations**: rise-in on cards, drifting hero orbs, pulsing live dot, marquee ticker, hamster loader, CursorRingField WebGL
- **Mobile**: Desks dropdown becomes full-width sheet, tables scroll horizontally, tighter padding
- **Reduced motion**: All animations disabled via `prefers-reduced-motion`

---

## 8. Known Issues & TODOs

| Issue | Status | Notes |
|---|---|---|
| Dev DB credentials rejected by Neon | OPEN | Prod unaffected; dev DB needs new credentials or new Neon project |
| `refType`/`refId` on Transaction | FIXED | Were being passed to createMany; removed (they're JournalEntry fields) |
| Only 4 companies on board | INVESTIGATING | Likely incomplete seed after reset; needs reseed |
| CSRF not enforced on POST routes | OPEN | Cookie issued but middleware doesn't check it |
| `postTransaction` has unused `ext` param | LOW | Optional Prisma tx client param is typed but not used |
| `available()` escrow logic simplified | LOW | Sums ESCROW_HOLD kinds; leading auction bids should route through escrowHold() |
| Production settle 504 at 60s | FIXED | Bulk rewrite reduced to ~12s; needs re-verification after latest push |
| `gm-1` password in git history | MITIGATED | Rotated; old password dead; scripts scrubbed |

---

## 9. Files Changed (Chronological)

### Initial Build
- `package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.ts`, `vercel.json`, `postcss.config.js`
- `prisma/schema.prisma` — full model set
- `src/ledger.ts`, `src/settlement.ts`, `src/formulas.ts`, `src/rounding.ts`, `src/policy.ts`, `src/auth.ts`, `src/db.ts`, `src/seed.ts`
- `data/*.json` — 11 seed data files
- All pages and API routes
- `SETUP.md`, `README.md`, `DECISIONS.md`

### UI Overhaul (Vibrant → Modern)
- Complete `globals.css` rewrite (theme, fonts, animations, components)
- `src/components/chrome.tsx` — shared chrome (Navbar, Stat, PageHero, HamsterLoader, etc.)
- `src/components/cursor-ring-field.tsx` — WebGL particle field
- All pages updated with HeroOrbs, PageHero, HamsterLoader
- `app/loading.tsx`, `app/error.tsx`, `app/not-found.tsx`

### Bug Fixes & Hardening
- `src/settlement.ts` — bulk-mode rewrite, race-safe account creation, resume after crash
- `app/api/gm/settle/route.ts` — resume on FROZEN_FOR_SETTLEMENT (not just FINAL_FROZEN)
- `app/api/paper-export/route.ts` — single-query balances, no interactive tx, error text
- `app/api/gm/reset/route.ts` — full data reset preserving gm-1
- `app/api/gm/volunteers/route.ts` — CRUD for volunteers
- `app/api/gm/volunteers/reset-secret/route.ts` — secret rotation
- `app/api/gm/participants/route.ts` — CRUD + PATCH for participants
- `app/api/gm/impersonate/route.ts` — one-time login links
- `app/api/auth/route.ts` — impersonate token support
- `app/login/page.tsx` — auto sign-in on `?qr=` or `?t=`
- `app/gm/page.tsx` — CrewTable, ParticipantChecks, ResetPanel
- `app/api/gm/badges/route.ts` — printable QR badges with cut guides
- `scripts/` — prodaudit, papertest, settle-debug, verify-settle, prodrepair, routeaudit, backfill-employment, rotate-gm, dbcheck

### Security
- Scrubbed all secrets from committed scripts (now use env vars)
- Rotated GM password (old: `8f7426b65673c92b1701cc7e77ba1de6`, new: `4d4cb626a0eab88a9481cd3d`)
- New bootstrap secret: `d77113ed26eb0c57765be2d877b2cf8c`

---

## 10. Event Day Workflow

### Pre-Event
1. Vercel env: set `GM_BOOTSTRAP_SECRET`, redeploy
2. Log in as GM (`gm-1` / `4d4cb626a0eab88a9481cd3d`)
3. Reset to clean T0 (GM console → type RESET)
4. Create crew volunteers (Crew card)
5. Test runs: Check desk buttons, register fake participant, run settles
6. Final reset
7. Print badges from `/api/gm/badges`
8. Print paper snapshot from `/api/paper-export?tick=0`

### Per Tick
1. Teams trade → GM presses Settle tick → Deputy prints paper snapshot → repeat
2. If settle errors: wait, press again (resumes, never double-posts)
3. If "in flight" 6+ min: clear lock via SQL, press again

### Internet Drops
- Deputy uses last printed snapshot
- Record trades on paper slips
- Run tick by hand from printed balances
- After restore: GM replays each slip via GM entry with form number as reason

### Close-Out
1. Freeze city (write routes refuse)
2. Investor Day: fund allocation by multiple
3. Publish board: frontier, Best Venture, Founder Ledger
4. Export final paper snapshot + backup

---

## 11. Key Constraints (from original spec)

- Journal is the only record; balances derived, never stored as mutable columns
- Append-only; mistakes corrected by reversal transactions
- Server is authoritative; no client trusted with money/time/identity
- Visibility enforced at server, per object, per request
- Idempotent writes via unique idempotency keys
- Integer VB only; no floats in DB
- Server-clocked; client cannot advance tick
- Paper fallback at every tick boundary
- Serverless-safe: no local FS, no in-memory state, DB lock table (not advisory locks)
- Settlement target: under 45s for 10 companies (currently ~12s)

---

## 12. Vercel Configuration

- Region: bom1 (Mumbai)
- `app/api/gm/settle/route.ts`: maxDuration 60s, memory 1024MB
- `app/api/paper-export/route.ts`: maxDuration 30s, memory 512MB
- Cron: `/api/health` at 0 3 * * *
- Framework: Next.js 14 App Router
- Runtime: nodejs for all DB-touching routes

---

## 13. Local Development

```bash
npm install
# .env.local must have POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, SESSION_SECRET, GM_BOOTSTRAP_SECRET
npx prisma migrate deploy
npm run db:seed
npm run dev
```

**Note**: Dev Neon credentials are currently rejected. Prod works fine. To fix dev, create a new Neon project and update `.env.local`.

---

## 14. Test Commands

```bash
npx tsc --noEmit          # Type check
npx vitest run            # Unit tests (12 tests, all passing)
node scripts/prodaudit.cjs  # Production audit (set GM_SECRET env)
node scripts/settle-debug.cjs  # Test settle (set GM_SECRET env)
node scripts/verify-settle.cjs  # Verify ledger conservation
node scripts/papertest.cjs  # Test paper export
node scripts/routeaudit.cjs  # Test all routes with auth
```

---

## 15. Git

- Repo: https://github.com/Darmaster1/venture-city
- Main branch, all work committed
- `.env` and `.env.local` are gitignored
- Secrets have been scrubbed from committed scripts
