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

---

## 3. Database State (Production) — VERIFIED 2026-10-06 16:50 UTC

- **Current tick**: 0 (clean T0, ready for event)
- **Clock**: PRE
- **Companies**: 10 (SWC, LED, MAN, SKF, PAI, GRG, MED, STH, VLT, TRL)
- **Participants**: Optional clean wipe via GM console checkbox (`cleanParticipants`)
- **gm-1 volunteer**: exists, password hash matches `4d4cb626a0eab88a9481cd3d`
- **Settle verified**: tick 1 completes in ~44s, ledger conserves to 0, all 10 CompanyTick rows written

---

## 4. Root Cause of Build Issue & Fix (Commit 0d487db)

- **Issue**: Adding the `onClick` event handler to the `Logout` button inside `Navbar()` in `src/components/chrome.tsx` caused Next.js server component prerendering to throw: `"Event handlers cannot be passed to Client Component props"`.
- **Fix**: Added `"use client";` directive at the top of `src/components/chrome.tsx`.
- **Verification**: Ran production Next.js build locally (`npx next build`). Build succeeded cleanly (all 39 routes generated without errors).

---

## 5. Summary of Recent Features

1. **WebGL Canvas Animations Everywhere**:
   - Integrated `CursorRingField` in `PageHero` across all desk pages, as well as `app/board/page.tsx` and `app/gm/page.tsx`.

2. **Logout Button**:
   - `/api/auth/logout` route added + Logout button in `Navbar`.

3. **Copy Link Option for GM Impersonation**:
   - Added **Copy Link** buttons for Crew and Participant checks in GM console (`app/gm/page.tsx`) to open desk sessions in Incognito tabs without logging out GM session.

---

## 6. Verification Commands

```bash
npx next build       # Production build (PASSED - 39/39 static & dynamic routes compiled)
npx tsc --noEmit     # TypeScript strict check (PASSED 0 errors)
git status           # Clean working tree, pushed commit 0d487db to origin/main
```

---

## 7. Day 2 Build State — 2026-10-06

Implemented and wired:

- Deal Sheet console at `/deal-sheet` with lane, tick window, floor-price, two-company signatory checks, send-for-signatures state, and participant signing endpoint.
- Deal Sheet records are scoped to the signed-in participant company or desk/GM account; stale sheets cannot be signed.
- Station dashboard now shows live operational lanes and company Deal Sheets.
- City Board now shows active lanes and public signed Deal Sheet activity.
- GM Console now exposes five seeded GM accounts (`gm-1` through `gm-5`), lanes, feature toggles, and a persisted ruling log.
- Observer deck now files and lists persisted observation cards through `/api/observer/observation`.
- Bank inventory now has persistent `Resource.bankStock`, live stepped pricing, stock depletion, idempotent duplicate protection, reserve-account accounting, and visible live stock.
- GM reset wipes and reseeds all Day 2 tables, including Deal Sheets, signatures, lanes, toggles, and live bank stock.
- Added City 10 event-crisis CSV (`data/event-crisis.csv`) and `npm run t0:audit` checks for T0, 10 companies, bank values, signatories, lanes, five GM accounts, O21-O28, and crisis data.

## 8. Bugs Fixed In This Pass

1. Observer `File card` button only called `preventDefault` and never saved anything. It now validates, persists an Incident, audits the action, refreshes the list, and reports errors.
2. Observer `Flagged moments` was hard-coded to `0`. It now reflects persisted observations.
3. Bank price calculation always used T1 stock, so prices never stepped down as inventory was sold. Live stock is now persisted and consumed.
4. Bank sales used newly created `INSTITUTION/BANK` accounts while the seed ledger uses `RESERVE/CITY` accounts. Sales now use the seeded reserve path, and reserve contra-balances are accepted by the ledger.
5. Bank duplicate idempotency requests could decrement inventory a second time before the ledger returned the existing transaction. Duplicate keys now return before stock reservation.
6. Bank accepted decimal, negative, and malformed unit quantities. It now requires positive whole units and validates the company and available stock.
7. Deal Sheet reads were able to expose every sheet to any authenticated participant. Participant reads are now company-scoped, and the desk page requires a desk/GM volunteer session.
8. Deal Sheets could be signed after leaving the signature state. Signing now requires `SENT_FOR_SIGNATURES`.
9. Board database failures produced an opaque HTTP 500. The feed now returns a controlled 503 payload for the existing retry UI.
10. GM freeze silently returned success when no run existed. It now reports `No active run.` and updates a specific run.
11. GM manual entries accepted negative/decimal amounts and unknown destination account IDs. They now require positive whole amounts and an existing destination.
12. GM feature-toggle updates could throw an unhandled database error for unknown keys. They now return a clear 400 response.
13. Checkbox inputs were inheriting full-width text-input dimensions, and textareas had no shared styling. Form controls now have correct sizing, focus-visible states, and textarea treatment.
14. Bank submission had no loading guard or network error state. It now prevents double-clicks and reports processing, duplicate, success, and failure states.
15. `npm run e2e` collected Vitest unit tests because Playwright had no test filter. The script now targets `tests-e2e.spec.ts` and includes a reusable `playwright.config.ts` with local `baseURL` and `webServer` settings.
16. The Bank smoke test matched a hidden navigation-menu link named `Bank`, producing a false positive. It now verifies the intended unauthenticated redirect to `/login`.
17. Bank server-render failures previously replaced the entire desk with an error page. The desk now renders a clear unavailable-state alert while preserving its layout.

## 9. Latest Verification

```bash
npx prisma validate       # PASSED
npx prisma generate       # PASSED
npx tsc --noEmit          # PASSED
npm test                  # PASSED — 3 files, 12 tests
npm run build             # PASSED — 43 routes compiled
npm run e2e               # PASSED — 2 Playwright smoke tests
npm run t0:audit          # BLOCKED — local .env Neon credentials rejected
```

The local audit could not connect to `ep-ancient-boat-b36ymcbp-pooler.c-4.ap-southeast-1.aws.neon.tech` because the configured credentials were rejected. No production database state was changed during this pass. The repository still does not contain the GM Handbook, so handbook-number reconciliation remains pending that source document and valid database credentials.
