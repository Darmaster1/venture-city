import { randomUUID } from "crypto";
import { prisma } from "./db";
import { TIER_RATES, SALARY_LADDER, DEFICIT_CHARGE, STORAGE_CAP, BANK_BASE, nav, rv, creditGrade, runway } from "./formulas";
import { pct } from "./rounding";

export type StepLog = string[];

// Serverless settle: a handful of bulk queries instead of hundreds of
// roundtrips. Balances are loaded once (GROUP BY) and validated in memory;
// journal rows go in via createMany. Every op keeps its settle-scoped
// idempotency key, so a run that dies mid-way resumes safely on re-invoke.
// Desk/GM writes still go through ledger.postTransaction; this bulk path is
// settlement-internal only.

type Leg = { acc: string; asset: string; amt: number };
type Op = {
  kind: string; type: string; enteredBy: string; legs: Leg[];
  refType?: string; refId?: string; stepNo?: number; key?: string;
  failed?: boolean;
};

let bals = new Map<string, number>();
const bkey = (acc: string, asset: string) => `${acc}|${asset}`;

async function ensureAccount(ownerType: string, ownerId: string, label: string): Promise<string> {
  const ex = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType, ownerId, label } } });
  if (ex) return ex.id;
  try {
    const a = await prisma.account.create({ data: { ownerType, ownerId, label, createdBy: "settle" } });
    return a.id;
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      const retry = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType, ownerId, label } } });
      if (retry) return retry.id;
    }
    throw e;
  }
}

// Pre-create every account this tick can touch, in two bulk roundtrips.
async function warmAccounts(companyIds: string[], participantIds: string[]): Promise<Map<string, string>> {
  const want: Array<{ ownerType: string; ownerId: string; label: string }> = [];
  for (const c of companyIds) {
    want.push({ ownerType: "COMPANY", ownerId: c, label: "VB" });
    for (const r of ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"])
      want.push({ ownerType: "COMPANY", ownerId: c, label: r });
  }
  for (const p of participantIds) want.push({ ownerType: "PARTICIPANT", ownerId: p, label: "VB" });
  want.push({ ownerType: "INSTITUTION", ownerId: "BANK", label: "VB" });
  want.push({ ownerType: "INSTITUTION", ownerId: "GOVERNMENT", label: "VB" });
  for (const r of ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"])
    want.push({ ownerType: "CONSUMED", ownerId: "CITY", label: r });
  await prisma.account.createMany({ data: want.map((w) => ({ ...w, createdBy: "settle" })), skipDuplicates: true });
  const all = await prisma.account.findMany();
  const map = new Map<string, string>();
  for (const a of all) map.set(`${a.ownerType}|${a.ownerId}|${a.label}`, a.id);
  return map;
}

async function loadBalances(tick: number): Promise<void> {
  bals = new Map();
  const rows = await prisma.$queryRaw<Array<{ accountId: string; asset: string; bal: bigint }>>`
    SELECT "accountId", asset, SUM(amount)::bigint AS bal FROM "JournalEntry" WHERE tick <= ${tick} GROUP BY "accountId", asset`;
  for (const r of rows) bals.set(bkey(r.accountId, r.asset), Number(r.bal));
}

// Validate + post a batch. Insufficient-funds ops are marked failed for the
// caller (arrears/miss paths); unbalanced ops throw (internal bug).
async function bulkPost(tick: number, ops: Op[]): Promise<void> {
  const keys = ops.map((o) => o.key).filter((k): k is string => !!k);
  const have = new Set<string>();
  if (keys.length) {
    const ex = await prisma.transaction.findMany({ where: { idempotencyKey: { in: keys } }, select: { idempotencyKey: true } });
    for (const e of ex) if (e.idempotencyKey) have.add(e.idempotencyKey);
  }
  const fresh = ops.filter((o) => !o.key || !have.has(o.key));
  const valid: Array<Op & { txId: string }> = [];
  for (const o of fresh) {
    const sums = new Map<string, number>();
    for (const l of o.legs) sums.set(l.asset, (sums.get(l.asset) ?? 0) + l.amt);
    for (const [a, ssum] of sums) {
      if (ssum !== 0) throw new Error(`Unbalanced ${o.type} op for ${a}: ${ssum}`);
    }
    let ok = true;
    for (const l of o.legs) {
      if (l.amt < 0 && (bals.get(bkey(l.acc, l.asset)) ?? 0) + l.amt < 0) { ok = false; break; }
    }
    if (!ok) { o.failed = true; continue; }
    for (const l of o.legs) bals.set(bkey(l.acc, l.asset), (bals.get(bkey(l.acc, l.asset)) ?? 0) + l.amt);
    valid.push({ ...o, txId: randomUUID() });
  }
  if (!valid.length) return;
  await prisma.transaction.createMany({
    data: valid.map((o) => ({ id: o.txId, type: o.type, status: "SETTLED", proposedTick: tick, refType: o.refType, refId: o.refId, idempotencyKey: o.key, createdBy: o.enteredBy }))
  });
  const entries = valid.flatMap((o) =>
    o.legs.map((l) => ({ txId: o.txId, tick, accountId: l.acc, asset: l.asset, amount: l.amt, kind: o.kind, refType: o.refType, refId: o.refId, enteredBy: o.enteredBy, stepNo: o.stepNo }))
  );
  for (let i = 0; i < entries.length; i += 500) {
    await prisma.journalEntry.createMany({ data: entries.slice(i, i + 500) });
  }
}

async function getDone(tick: number): Promise<string[]> {
  await prisma.tick.upsert({ where: { tickNo: tick }, create: { tickNo: tick, notes: "[]" }, update: {} });
  const t = await prisma.tick.findUnique({ where: { tickNo: tick } });
  try {
    const v = JSON.parse(t?.notes ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}

async function markDone(tick: number, step: string): Promise<void> {
  const d = await getDone(tick);
  if (!d.includes(step)) {
    d.push(step);
    await prisma.tick.update({ where: { tickNo: tick }, data: { notes: JSON.stringify(d) } });
  }
}

export async function acquireLock(by: string, tickNo: number): Promise<boolean> {
  const r = await prisma.$executeRawUnsafe(
    `UPDATE "SettlementLock" SET "lockedAt" = now(), "lockedBy" = $1, "tickNo" = $2 WHERE id = 1 AND ("lockedAt" IS NULL OR "lockedAt" < now() - INTERVAL '5 minutes')`,
    by, tickNo
  );
  return Number(r) === 1;
}

export async function releaseLock(): Promise<void> {
  await prisma.$executeRawUnsafe(`UPDATE "SettlementLock" SET "lockedAt" = NULL, "lockedBy" = NULL WHERE id = 1`);
}

export async function snapshot(tick: number, phase: string, by = "system"): Promise<void> {
  const count = await prisma.journalEntry.count({ where: { tick: { lte: tick } } });
  const sample = await prisma.journalEntry.findMany({ where: { tick: { lte: tick } }, orderBy: { postedAt: "desc" }, take: 500 });
  const payload = { tick, phase, count, sample };
  const json = JSON.stringify(payload);
  if (json.length > 1_000_000) {
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(`snapshot-t${tick}-${phase}.json`, json, { access: "public" });
      await prisma.snapshot.create({ data: { tick, phase, fileRef: blob.url, createdBy: by } });
      return;
    } catch { /* fall through to inline */ }
  }
  await prisma.snapshot.create({ data: { tick, phase, data: payload as object, createdBy: by } });
}

export async function settleTick(tick: number, by: string): Promise<{ log: StepLog; ms: number; complete: boolean }> {
  const t0 = Date.now();
  const log: StepLog = [];
  const ok = await acquireLock(by, tick);
  if (!ok) { const e = new Error("Another settle is in flight"); (e as { status?: number }).status = 409; throw e; }
  try {
    const done = await getDone(tick);
    const skip = (s: string) => done.includes(s);
    await prisma.run.updateMany({ data: { clockState: "FROZEN_FOR_SETTLEMENT" } });

    const companies = await prisma.company.findMany({ where: { active: true } });
    const cids = companies.map((c) => c.id);
    const [emps, tiers, seats, loans, contracts, lines, participants] = await Promise.all([
      prisma.employment.findMany({ where: { state: "ACTIVE" } }),
      prisma.companyTier.findMany(),
      prisma.requiredSeat.findMany(),
      prisma.loan.findMany({ where: { state: { in: ["DISBURSED", "PARTIAL"] } } }),
      prisma.contract.findMany({ where: { state: "ACTIVE", startTick: { lte: tick }, endTick: { gte: tick } } }),
      prisma.contractLine.findMany({ where: { tick } }),
      prisma.participant.findMany({ select: { id: true, walletAccountId: true } })
    ]);
    const accMap = await warmAccounts(cids, emps.map((e) => e.participantId));
    const acc = (t: string, o: string, l: string) => accMap.get(`${t}|${o}|${l}`) as string;
    await loadBalances(tick);
    const wmap = new Map(participants.map((p) => [p.id, p.walletAccountId]));
    for (const p of participants) {
      if (!p.walletAccountId) {
        const id = acc("PARTICIPANT", p.id, "VB");
        wmap.set(p.id, id);
      }
    }
    const missing = participants.filter((p) => !p.walletAccountId);
    if (missing.length) {
      await Promise.all(missing.map((p) =>
        prisma.participant.update({ where: { id: p.id }, data: { walletAccountId: wmap.get(p.id) } }).catch(() => null)
      ));
    }

    if (!skip("snap-pre")) { await snapshot(tick, "pre", by); await markDone(tick, "snap-pre"); }
    log.push(`snapshot pre tick ${tick}`);

    // Step 2: contracts
    if (!skip("contracts")) {
      const lineByC = new Map(lines.map((l) => [l.contractId, l]));
      const ops: Op[] = [];
      const meta: Array<{ lineId: string; contractId: string; buyer: string; units: number; due: number }> = [];
      for (const cc of contracts) {
        const line = lineByC.get(cc.id);
        if (!line || !cc.buyerId || !cc.sellerId || !line.paymentDue) continue;
        meta.push({ lineId: line.id, contractId: cc.id, buyer: cc.buyerId, units: line.unitsDue, due: line.paymentDue });
        ops.push({
          type: "CONTRACT_PAYMENT", kind: "CONTRACT_PAYMENT", enteredBy: by,
          legs: [
            { acc: acc("COMPANY", cc.buyerId, "VB"), asset: "VB", amt: -line.paymentDue },
            { acc: acc("COMPANY", cc.sellerId, "VB"), asset: "VB", amt: line.paymentDue }
          ],
          refType: "Contract", refId: cc.id, stepNo: 2, key: `settle-t${tick}-c-${cc.id}`
        });
      }
      await bulkPost(tick, ops);
      const paidIds = ops.filter((o) => !o.failed).map((o) => o.refId as string);
      const missIds = ops.filter((o) => o.failed).map((o) => o.refId as string);
      const paidLines = meta.filter((x) => paidIds.includes(x.contractId));
      if (paidLines.length) {
        await prisma.contractLine.updateMany({ where: { id: { in: paidLines.map((x) => x.lineId) } }, data: { outcome: "SETTLED" } });
        for (const x of paidLines) {
          await prisma.contractLine.update({ where: { id: x.lineId }, data: { paymentMade: x.due, unitsDelivered: x.units } });
        }
      }
      if (missIds.length) {
        await prisma.contractLine.updateMany({ where: { contractId: { in: missIds }, tick }, data: { outcome: "MISSED_PAYMENT" } });
        for (const cid of missIds) {
          await prisma.contract.update({ where: { id: cid }, data: { consecutiveBreaches: { increment: 1 } } });
        }
        const buyers = meta.filter((x) => missIds.includes(x.contractId));
        if (buyers.length) {
          await prisma.reliabilityEvent.createMany({
            data: buyers.map((x) => ({ companyId: x.buyer, tick, kind: "MISSED_PAYMENT", ref: x.contractId, createdBy: by }))
          });
        }
      }
      await markDone(tick, "contracts");
      log.push(`step2 contracts settled: ${paidIds.length}, missed: ${missIds.length}`);
    } else log.push("step2 contracts: already done");

    // Step 3: production note
    if (!skip("production")) {
      const n = await prisma.productionOrder.count();
      await markDone(tick, "production");
      log.push(`step3 production orders: ${n}`);
    } else log.push("step3 production: already done");

    // Step 4: salaries
    if (!skip("salaries")) {
      const ops: Op[] = emps.map((e) => {
        const pay = Math.max(e.salary, SALARY_LADDER[Math.min(e.level ?? 0, 5)] ?? 100);
        return {
          type: "SALARY", kind: "SALARY", enteredBy: by,
          legs: [
            { acc: acc("COMPANY", e.companyId, "VB"), asset: "VB", amt: -pay },
            { acc: wmap.get(e.participantId) as string, asset: "VB", amt: pay }
          ],
          refType: "Employment", refId: e.id, stepNo: 4, key: `settle-t${tick}-sal-${e.id}`
        };
      });
      await bulkPost(tick, ops);
      await markDone(tick, "salaries");
      log.push(`step4 salaries: ${ops.filter((o) => !o.failed).length}/${ops.length} paid`);
    } else log.push("step4 salaries: already done");

    // Step 5: consumption
    if (!skip("consumption")) {
      const tierMap = new Map(tiers.map((t) => [`${t.companyId}:${t.resource}`, t.tier]));
      const ops: Op[] = [];
      for (const cc of cids) {
        for (const r of ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"]) {
          const tier = tierMap.get(`${cc}:${r}`) ?? "MEDIUM";
          let rate = TIER_RATES[tier] ?? 7;
          const a = acc("COMPANY", cc, r);
          const stock = bals.get(bkey(a, r)) ?? 0;
          if (stock <= 15 && stock > 0) rate = Math.ceil(rate * 1.25);
          const consume = Math.min(stock, rate);
          if (consume <= 0) continue;
          ops.push({
            type: "CONSUMPTION", kind: "CONSUMPTION", enteredBy: by,
            legs: [{ acc: a, asset: r, amt: -consume }, { acc: acc("CONSUMED", "CITY", r), asset: r, amt: consume }],
            refType: "Company", refId: cc, stepNo: 5, key: `settle-t${tick}-cons-${cc}-${r}`
          });
        }
      }
      await bulkPost(tick, ops);
      await markDone(tick, "consumption");
      log.push(`step5 consumption: ${ops.filter((o) => !o.failed).length} deductions`);
    } else log.push("step5 consumption: already done");

    // Step 6: loans
    if (!skip("loans")) {
      const ops: Op[] = [];
      const due = loans.filter((l) => tick >= l.firstDueTick);
      for (const l of due) {
        const inst = Math.ceil((l.principal + pct(l.principal, l.flatRate)) / l.termTicks);
        ops.push({
          type: "LOAN_INSTALMENT", kind: "LOAN_INSTALMENT", enteredBy: by,
          legs: [
            { acc: acc("COMPANY", l.borrowerCompany, "VB"), asset: "VB", amt: -inst },
            { acc: acc("INSTITUTION", "BANK", "VB"), asset: "VB", amt: inst }
          ],
          refType: "Loan", refId: l.id, stepNo: 6, key: `settle-t${tick}-loan-${l.id}`
        });
      }
      await bulkPost(tick, ops);
      const paid = new Set(ops.filter((o) => !o.failed).map((o) => o.refId as string));
      if (paid.size) await prisma.loan.updateMany({ where: { id: { in: [...paid] } }, data: { missedCount: 0 } });
      for (const l of due.filter((x) => !paid.has(x.id))) {
        const n = l.missedCount + 1;
        await prisma.loan.update({ where: { id: l.id }, data: { missedCount: n, state: n >= 2 ? "DEFAULTED" : l.state } });
        await prisma.reliabilityEvent.create({ data: { companyId: l.borrowerCompany, tick, kind: "PAYMENT_MISSED", ref: l.id, createdBy: by } });
      }
      await markDone(tick, "loans");
      log.push(`step6 loans: ${paid.size}/${due.length} instalments`);
    } else log.push("step6 loans: already done");

    // Step 7: workforce
    if (!skip("workforce")) {
      const byCompany = new Map<string, typeof emps>();
      for (const e of emps) {
        const arr = byCompany.get(e.companyId) ?? [];
        arr.push(e);
        byCompany.set(e.companyId, arr);
      }
      const ops: Op[] = [];
      for (const cc of companies) {
        const staff = byCompany.get(cc.id) ?? [];
        let empty = 0;
        for (const st of seats.filter((x) => x.companyId === cc.id)) {
          const filled = staff.filter((e) => e.domain === st.domain).length;
          if (filled < st.required) empty += st.required - filled;
        }
        if (empty > 0) {
          ops.push({
            type: "DEFICIT_CHARGE", kind: "DEFICIT_CHARGE", enteredBy: by,
            legs: [
              { acc: acc("COMPANY", cc.id, "VB"), asset: "VB", amt: -empty * DEFICIT_CHARGE },
              { acc: acc("INSTITUTION", "GOVERNMENT", "VB"), asset: "VB", amt: empty * DEFICIT_CHARGE }
            ],
            refType: "Company", refId: cc.id, stepNo: 7, key: `settle-t${tick}-def-${cc.id}`
          });
        }
      }
      await bulkPost(tick, ops);
      await prisma.employment.updateMany({ where: { state: "PENDING_MOVE" }, data: { state: "ACTIVE" } });
      await markDone(tick, "workforce");
      log.push("step7 workforce done");
    } else log.push("step7 workforce: already done");

    // Step 8: lifecycle
    if (!skip("lifecycle")) {
      for (const cc of companies) {
        const cash = bals.get(bkey(acc("COMPANY", cc.id, "VB"), "VB")) ?? 0;
        const staff = emps.filter((e) => e.companyId === cc.id).length;
        const badLoan = await prisma.loan.findFirst({ where: { borrowerCompany: cc.id, state: "DEFAULTED" } });
        const distressed = cash < 0 || staff < 3 || !!badLoan;
        await prisma.company.update({
          where: { id: cc.id },
          data: distressed
            ? { lifecycle: "DISTRESSED", distressedSinceTick: cc.distressedSinceTick ?? tick }
            : { lifecycle: "OPERATING", distressedSinceTick: null }
        });
      }
      await markDone(tick, "lifecycle");
      log.push("step8 lifecycle done");
    } else log.push("step8 lifecycle: already done");

    // Step 9: missions
    if (!skip("missions")) {
      await prisma.missionInstance.updateMany({ where: { tick: { lt: tick - 2 }, state: "OPEN" }, data: { state: "EXPIRED" } });
      await markDone(tick, "missions");
      log.push("step9 missions expired");
    } else log.push("step9 missions: already done");

    // Step 10: market
    if (!skip("market")) {
      const decayOps: Op[] = [];
      const rows: Array<{ id: string; cash: number; n: number; rvv: number }> = [];
      for (const cc of companies) {
        const cash = bals.get(bkey(acc("COMPANY", cc.id, "VB"), "VB")) ?? 0;
        const stocks: Record<string, number> = {};
        for (const r of Object.keys(BANK_BASE)) {
          const a = acc("COMPANY", cc.id, r);
          let q = bals.get(bkey(a, r)) ?? 0;
          if (q > STORAGE_CAP) {
            const decay = Math.ceil((q - STORAGE_CAP) * 0.1);
            decayOps.push({
              type: "DECAY", kind: "DECAY", enteredBy: by,
              legs: [{ acc: a, asset: r, amt: -decay }, { acc: acc("CONSUMED", "CITY", r), asset: r, amt: decay }],
              refType: "Company", refId: cc.id, stepNo: 10, key: `settle-t${tick}-decay-${cc.id}-${r}`
            });
            q -= decay;
          }
          stocks[r] = q;
        }
        const n = nav({ cash, stocks });
        rows.push({ id: cc.id, cash, n, rvv: rv(n, 0) });
      }
      await bulkPost(tick, decayOps);
      for (const r of rows) {
        await prisma.companyTick.upsert({
          where: { companyId_tick: { companyId: r.id, tick } },
          create: { companyId: r.id, tick, cash: r.cash, nav: r.n, rv: r.rvv, creditGrade: creditGrade({ completed: 0, missLast3: false, bankDebt: 0, inDefault: false, distressed: r.cash < 0 }), runway: runway(r.cash, 1000) },
          update: { cash: r.cash, nav: r.n, rv: r.rvv }
        });
      }
      await markDone(tick, "market");
      log.push("step10 market done");
    } else log.push("step10 market: already done");

    await prisma.tick.update({ where: { tickNo: tick }, data: { settledAt: new Date(), settledBy: by } });
    await prisma.run.updateMany({ data: { currentTick: tick, clockState: "RUNNING" } });
    if (!skip("snap-post")) { await snapshot(tick, "post", by); await markDone(tick, "snap-post"); }
    log.push(`snapshot post tick ${tick}`);
  } finally {
    await releaseLock();
  }
  return { log, ms: Date.now() - t0, complete: true };
}
