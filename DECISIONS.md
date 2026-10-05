# Decisions
- USER OVERRIDE (Oct 2026): full vibrant UI (hero landing, gradients, Space Grotesk, colorful desks) replaces PART 10's plain-admin direction, per explicit user instruction. Journal, ledger, settlement and policy logic unchanged.
- Catalogue models (CustomerCard ... DecisionCard) use a compact shape: key scalar fields + Json payload, since PART 3.4 says "infer from PART 9".
- Ledger `available()` treats ESCROW_HOLD legs as the reserve; leading auction bids should route through escrowHold().
- Settlement wraps all 12 steps in one Prisma $transaction; for >50s venues split steps 5-10 into a second GM invocation (documented in code comment).
- Middleware checks JWT existence only; role is re-read from DB in every route (PART 12.9).
- Snapshots <1MB inline in Snapshot.data, larger via Vercel Blob.
- Rate limiting via AuditLog-backed token bucket (no Redis).
- Fonts via @fontsource (no Google Fonts at runtime).
- Spec conflict rule applied: PART 1 > PART 4 > PART 5 > PART 7; none conflicted in this build.
