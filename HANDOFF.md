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

**All secrets are also in `.env.local` (gitignored) and `.env` (gitignored, for Prisma CLI). Host target is exclusively Vercel + Neon.**

---

## 3. Database State (Production) — VERIFIED 2026-10-06 15:25 UTC

- **Current tick**: 0 (clean T0, ready for event)
- **Clock**: PRE
- **Companies**: 10 (SWC, LED, MAN, SKF, PAI, GRG, MED, STH, VLT, TRL)
- **Participants**: Optional clean wipe via GM console checkbox (`cleanParticipants`)
- **gm-1 volunteer**: exists, password hash matches `4d4cb626a0eab88a9481cd3d`
- **Settle verified**: tick 1 completes in ~44s, ledger conserves to 0, all 10 CompanyTick rows written

---

## 4. Recent Fixes & Additions (2026-10-06)

1. **Global WebGL Particle Animations**:
   - Added `CursorRingField` inside `PageHero` (`src/components/chrome.tsx`) so that the interactive canvas particle background now renders across **all pages and desk heroes**, not just the landing page.

2. **Clean Reset Option**:
   - Updated `app/api/gm/reset/route.ts` and `app/gm/page.tsx` with a checkbox option: *"Clear participants and keep only default companies (Clean seed)"*.

3. **Complete Desk API Transaction Wiring**:
   - **Investor Desk**: Created `/api/investor/term-sheet` POST route to issue term sheets.
   - **Customer Desk**: Created `/api/customer/award` POST route to award customer cards.
   - **Supplier Market**: Created `/api/supplier/order` POST route with ledger integration for ordering resources.
   - **Government Desk**: Created `/api/government/apply` POST route handling licence fees and grant disbursements.
   - **Media Desk**: Created `/api/media/purchase` POST route for media product purchases.
   - **Talent Exchange**: Created `/api/talent/hire` POST route for specialist hiring/transferring.

4. **CSRF Middleware Security**:
   - Enforced double-submit cookie verification (`vc_csrf` vs `x-csrf-token` header) in `middleware.ts` for all POST requests.

---

## 5. Verification Commands

```bash
npx tsc --noEmit     # TypeScript strict check (PASSED 0 errors)
npx vitest run       # Unit test suite
```

---

## 6. Git State

- **Repo**: https://github.com/Darmaster1/venture-city
- **Branch**: `main`
