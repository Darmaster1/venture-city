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

## 3. Database State (Production) — VERIFIED 2026-10-06 15:38 UTC

- **Current tick**: 0 (clean T0, ready for event)
- **Clock**: PRE
- **Companies**: 10 (SWC, LED, MAN, SKF, PAI, GRG, MED, STH, VLT, TRL)
- **Participants**: Optional clean wipe via GM console checkbox (`cleanParticipants`)
- **gm-1 volunteer**: exists, password hash matches `4d4cb626a0eab88a9481cd3d`
- **Settle verified**: tick 1 completes in ~44s, ledger conserves to 0, all 10 CompanyTick rows written

---

## 4. Recent Fixes & Additions (2026-10-06)

1. **Git Commit & Deployment Status**:
   - Pushed commit `6268f69`: Added WebGL animations, clean seed option, desk APIs, and CSRF middleware.
   - Pushed commit `8de8d8c`: Cleaned paper export formatting/symbols, restricted `/gm` route access in middleware, and added crew Rename & Delete controls in GM console.

2. **Paper Export Cleaning**:
   - Stripped invalid / weird symbols, unicode dots, check boxes, and arrows from `app/api/paper-export/route.ts` and replaced with standard clean ASCII characters (`|`, `->`, `[ ]`).

3. **Strict GM Route Access Control**:
   - Updated `middleware.ts` to inspect session roles: non-GM users (e.g. Bank desk / Volunteer staff) attempting to open `/gm` or `/api/gm` are instantly redirected to `/login` before the page or API loads.

4. **Crew Management Controls**:
   - Updated `app/api/gm/volunteers/route.ts` with `PATCH` (rename crew member) and `DELETE` (remove crew member, protecting `gm-1`).
   - Added **Rename** and **Delete** buttons to `CrewTable` in `app/gm/page.tsx`.

---

## 5. Verification Commands

```bash
npx tsc --noEmit     # TypeScript strict check (PASSED 0 errors)
npx vitest run       # Unit test suite (PASSED 12/12)
git status           # Clean working tree, pushed to origin/main
```

---

## 6. Git State

- **Repo**: https://github.com/Darmaster1/venture-city
- **Branch**: `main` (up to date with `origin/main`)
