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

## 3. Database State (Production) — VERIFIED 2026-10-06 15:47 UTC

- **Current tick**: 0 (clean T0, ready for event)
- **Clock**: PRE
- **Companies**: 10 (SWC, LED, MAN, SKF, PAI, GRG, MED, STH, VLT, TRL)
- **Participants**: Optional clean wipe via GM console checkbox (`cleanParticipants`)
- **gm-1 volunteer**: exists, password hash matches `4d4cb626a0eab88a9481cd3d`
- **Settle verified**: tick 1 completes in ~44s, ledger conserves to 0, all 10 CompanyTick rows written

---

## 4. Recent Fixes & Additions (2026-10-06)

1. **WebGL Animations on GM and Board Pages**:
   - Added `CursorRingField` background to `app/board/page.tsx` and `app/gm/page.tsx` heroes so particle animation now renders on both the Board and GM console.

2. **Global Logout Button**:
   - Added `/api/auth/logout` API route and integrated a **Logout** button in `Navbar` (`src/components/chrome.tsx`) that clears authentication cookies and redirects to `/login`.

3. **Copy Link Option for GM Impersonation**:
   - Added **Copy Link** buttons to both `CrewTable` and `ParticipantChecks` in `app/gm/page.tsx`. GMs can copy individual volunteer or participant login URLs to open them in Incognito/private windows without logging out the GM session.

4. **Paper Export Cleaning**:
   - Cleaned symbols in `app/api/paper-export/route.ts` replacing non-ASCII symbols with plain ASCII (`|`, `->`, `[ ]`).

5. **Strict GM Route Access**:
   - Updated `middleware.ts` to restrict `/gm` and `/api/gm` to `GM`, `DEPUTY_GM`, or `TECH_LEAD` roles.

---

## 5. Verification Commands

```bash
npx tsc --noEmit     # TypeScript strict check (PASSED 0 errors)
npx vitest run       # Unit test suite (PASSED 12/12)
git status           # Clean working tree, pushed commit 70e6233 to origin/main
```

---

## 6. Git State

- **Repo**: https://github.com/Darmaster1/venture-city
- **Branch**: `main` (pushed commit `70e6233`)
