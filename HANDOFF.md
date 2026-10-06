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
18. `db:seed` exited immediately when any companies existed, so deploying Day 2 to an existing database never created lanes, signatories, or the extra GM accounts. Existing databases now receive a non-destructive Day 2 backfill while preserving current game state.

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

---

## 10. Authoritative Spec Review — 2026-10-06

The parsed source documents are now available and are authoritative for future implementation work: Technology Platform Specification v2, Dynamic Events & Crisis System, Investor Day Playbook / Final Scoring / Post-Event Reports, Company Passport Packs and Role Cards, Core Game Systems, Event Operations Manual, GM Handbook, Human Internet and Information Economy, Institution Operating Content, Personal Objective System, Starting Companies Master Catalogue, Starting World Master Design, and Participant Handbook.

Locked City 10 run parameters:

- 11-tick spine; Market Open 10:35; lunch pause 12:35–13:05; final freeze after Tick 10 and final build at Tick 11; Investor Day 16:25 in two rooms.
- Six resources start at 100 units per company. Bank T1 stock is `40 × N = 400` per resource and restock is `10 × N = 100` per tick.
- Starting cash is `headcount × 2,450 + 10,000 + strategic adjustment`.
- Each company elects two authorised signatories. T0 cap table is 800 Founding Holder shares plus 200 option-pool shares.
- Tier consumption is Low/Medium/High/Very High = `4/7/10/14`; thresholds are 30 warning, 15 delivery surcharge, and 0 delivery stop.
- Bank base prices are Compute 20, Energy 15, Logistics 20, Materials 15, Data 25, Infrastructure 30 VB.
- The platform is the sole source of truth; paper is only a fallback route.

Current implementation gaps against the authoritative documents:

1. Seeded company stock is still 60 units instead of the required 100.
2. Existing-company backfill marks one signatory per company; the spec requires two elected signatories.
3. Company cash is loaded from static City 10 JSON values instead of recalculated from registration headcount.
4. The original event/crisis CSV was only a small E01–E08 placeholder; the implementation now has the structured 26-event/20-crisis catalogue, with richer card metadata and deck selection. Full desk-specific parameter mutations and every response route remain an expansion beyond the generic firing engine.
5. O21–O28 currently contain only minimal title/value/method data; the spec requires signal, detail, discovery paths, claim method, trade-off, cap, window, decay, institutions, visibility and register state.
6. Deal Sheets currently cover only a partial company trade flow; the spec requires all parties, consideration, timing, duration, conditions, penalties, evidence, negotiator credit, signatures, lifecycle and atomic settlement paths.
7. Institution catalogues and desk actions are incomplete compared with the required Bank, Investor, Customer, Supplier, Logistics, Government, Media and Talent operating content.
8. Tier B and C systems are not implemented: full missions, opportunities, personal objectives, auctions, information cards, crisis exposure, Founder Ledger, Investor Day snapshots/scoring, City Net, People Directory, messaging, M&A and new-venture flows.
9. Visibility classes from the source documents are only partially enforced; hidden objectives, levers, vulnerabilities, truth status and observer separation require a dedicated policy audit.

The current production/Neon backfill audit proves the Day 2 seed additions are present, but it does not prove full source-spec compliance. Future changes should be tracked against this gap list rather than treating the existing `ok` result as a complete handbook audit.

## 11. Event Workflow Implementation — 2026-10-06

Implemented in the repository:

- Added migration `20261006190000_event_workflow` for event phases, signal timing, response windows, targeting metadata, deck firing timestamps, signal indexes, and crisis-hit state.
- Added `src/events.ts`: one-tick-ahead signal release, idempotent card firing, deck entries, crisis-hit records, and audit records.
- Added `/api/gm/clock` for Market Open, lunch pause/resume, pause/resume, and final freeze. Final freeze requires the configured 11-tick spine and creates a final snapshot.
- Settlement now runs event firing before financial settlement and records the event step for resume safety.
- Added GM clock controls and event/deck/crisis registers through the GM control API.
- Added public fired events to the City Board and participant-scoped signals/crisis status to the portal.
- Fresh and safe seed paths now use formula-based opening cash, 100 opening units per resource, two signatories per company, enabled event deck, signal ticks, and claimable mission instances.
- Settlement rejects attempts outside the RUNNING or resume states; legacy freeze now pauses unless explicitly marked final.

Remaining source-content work: opportunity cards and desk-specific event mutations still need the full content-level expansion from the source documents. The structured E/C catalogue is now in `data/event-cards.json`; the legacy CSV remains only for compatibility. Apply the new migrations with `npx prisma migrate deploy` before running the safe seed/backfill; do not use `FORCE_SEED=1` on an active run.

The authoritative event index has now been transcribed as 26 events and 20 crises. The default deck is armed in seed state, while the remaining library cards use `LIBRARY` state for GM selection. The run length is configurable and defaults to 11 ticks, with Tick 10 as the final crisis slot and Tick 11 as final build/freeze preparation.

New migrations after the Day 2 desk migration:

- `20261006190000_event_workflow`
- `20261006193000_run_tick_count`
- `20261006200000_opportunity_register`
