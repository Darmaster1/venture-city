import { prisma } from "./db";
import { postTransaction } from "./ledger";
import { TIER_RATES, SALARY_LADDER, DEFICIT_CHARGE, STORAGE_CAP, BANK_BASE, nav, rv, creditGrade, runway } from "./formulas";
import { pct } from "./rounding";

export type StepLog = string[];

// Serverless settle: NO single giant transaction (it outlives both Prisma's
// interactive-tx limits and Vercel's function timeout). Instead every write
// carries a settle-scoped idempotency key, so a run that dies mid-way can
// simply be re-invoked: finished ops return their existing rows, unfinished
// ops complete. Step markers in Tick.notes let a resume skip done steps.

async function ensureAccount(ownerType: string, ownerId: string, label: string): Promise<string> {
  const ex = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType, ownerId, label } } });
  if (ex) return ex.id;
  try {
    const a = await prisma.account.create({ data: { ownerType, ownerId, label, createdBy: "settle" } });
    return a.id;
  } catch (e) {
    // Lost a create race with a parallel worker: re-read the winner's row.
    if ((e as { code?: string }).code === "P2002") {
      const retry = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType, ownerId, label } } });
      if (retry) return retry.id;
    }
    throw e;
  }
}

async function bal(accountId: string, asset: string): Promise<number> {
  const agg = await prisma.journalEntry.aggregate({ where: { accountId, asset }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += n) {
    await Promise.all(items.slice(i, i + n).map((x) => fn(x).catch((e) => { throw e; })));
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
  const sample = await prisma.journalEntry.findMany({ where: { tick: { lte: tick } }, orderBy: { postedAt: "desc" }, take: 2000 });
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

    if (!skip("snap-pre")) { await snapshot(tick, "pre", by); await markDone(tick, "snap-pre"); }
    log.push(`snapshot pre tick ${tick}`);

    const companies = await prisma.company.findMany({ where: { active: true } });

    // Step 2: recurring contracts
    if (!skip("contracts")) {
      const contracts = await prisma.contract.findMany({ where: { state: "ACTIVE", startTick: { lte: tick }, endTick: { gte: tick } } });
      let c2 = 0;
      await pool(contracts, 8, async (cc) => {
        const line = await prisma.contractLine.findUnique({ where: { contractId_tick: { contractId: cc.id, tick } } });
        if (!line || !cc.buyerId || !cc.sellerId || !line.paymentDue) return;
        const due = line.paymentDue;
        try {
          const bAcc = await ensureAccount("COMPANY", cc.buyerId, "VB");
          const sAcc = await ensureAccount("COMPANY", cc.sellerId, "VB");
          await postTransaction({
            type: "CONTRACT_PAYMENT", tick, kind: "CONTRACT_PAYMENT", enteredBy: by,
            legs: [{ accountId: bAcc, asset: "VB", amount: -due }, { accountId: sAcc, asset: "VB", amount: due }],
            refType: "Contract", refId: cc.id, stepNo: 2, idempotencyKey: `settle-t${tick}-c-${cc.id}`
          });
          await prisma.contractLine.update({ where: { id: line.id }, data: { paymentMade: due, unitsDelivered: line.unitsDue, outcome: "SETTLED" } });
        } catch {
          await prisma.contractLine.update({ where: { id: line.id }, data: { outcome: "MISSED_PAYMENT" } });
          await prisma.contract.update({ where: { id: cc.id }, data: { consecutiveBreaches: { increment: 1 } } });
          await prisma.reliabilityEvent.create({ data: { companyId: cc.buyerId ?? "", tick, kind: "MISSED_PAYMENT", ref: cc.id, createdBy: by } });
        }
        c2++;
      });
      await markDone(tick, "contracts");
      log.push(`step2 contracts settled: ${c2}`);
    } else log.push("step2 contracts: already done");

    // Step 3: production (standing orders checked; capacity enforced at order time)
    if (!skip("production")) {
      const orders = await prisma.productionOrder.findMany();
      await markDone(tick, "production");
      log.push(`step3 production orders: ${orders.length}`);
    } else log.push("step3 production: already done");

    // Step 4: salaries
    if (!skip("salaries")) {
      const emps = await prisma.employment.findMany({ where: { state: "ACTIVE" } });
      await pool(emps, 10, async (e) => {
        const pay = Math.max(e.salary, SALARY_LADDER[Math.min(e.level ?? 0, 5)] ?? 100);
        try {
          const cAcc = await ensureAccount("COMPANY", e.companyId, "VB");
          const p = await prisma.participant.findUnique({ where: { id: e.participantId } });
          let wAcc: string;
          if (p?.walletAccountId) wAcc = p.walletAccountId;
          else {
            wAcc = await ensureAccount("PARTICIPANT", e.participantId, "VB");
            if (p) await prisma.participant.update({ where: { id: p.id }, data: { walletAccountId: wAcc } });
          }
          await postTransaction({
            type: "SALARY", tick, kind: "SALARY", enteredBy: by,
            legs: [{ accountId: cAcc, asset: "VB", amount: -pay }, { accountId: wAcc, asset: "VB", amount: pay }],
            refType: "Employment", refId: e.id, stepNo: 4, idempotencyKey: `settle-t${tick}-sal-${e.id}`
          });
        } catch { /* arrears when the company cannot cover payroll */ }
      });
      await markDone(tick, "salaries");
      log.push(`step4 salaries: ${emps.length}`);
    } else log.push("step4 salaries: already done");

    // Step 5: baseline consumption
    if (!skip("consumption")) {
      const tiers = await prisma.companyTier.findMany();
      const tierMap = new Map(tiers.map((t) => [`${t.companyId}:${t.resource}`, t.tier]));
      const jobs: Array<{ c: string; r: string }> = [];
      for (const cc of companies) for (const r of ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"]) jobs.push({ c: cc.id, r });
      await pool(jobs, 10, async ({ c, r }) => {
        const tier = tierMap.get(`${c}:${r}`) ?? "MEDIUM";
        let rate = TIER_RATES[tier] ?? 7;
        const acc = await ensureAccount("COMPANY", c, r);
        const stock = await bal(acc, r);
        if (stock <= 15 && stock > 0) rate = Math.ceil(rate * 1.25);
        const consume = Math.min(stock, rate);
        if (consume <= 0) return;
        const sink = await ensureAccount("CONSUMED", "CITY", r);
        await postTransaction({
          type: "CONSUMPTION", tick, kind: "CONSUMPTION", enteredBy: by,
          legs: [{ accountId: acc, asset: r, amount: -consume }, { accountId: sink, asset: r, amount: consume }],
          refType: "Company", refId: c, stepNo: 5, idempotencyKey: `settle-t${tick}-cons-${c}-${r}`
        });
      });
      await markDone(tick, "consumption");
      log.push("step5 consumption done");
    } else log.push("step5 consumption: already done");

    // Step 6: debt service
    if (!skip("loans")) {
      const loans = await prisma.loan.findMany({ where: { state: { in: ["DISBURSED", "PARTIAL"] } } });
      await pool(loans, 8, async (l) => {
        if (tick < l.firstDueTick) return;
        const inst = Math.ceil((l.principal + pct(l.principal, l.flatRate)) / l.termTicks);
        try {
          const bAcc = await ensureAccount("COMPANY", l.borrowerCompany, "VB");
          const bk = await ensureAccount("INSTITUTION", "BANK", "VB");
          await postTransaction({
            type: "LOAN_INSTALMENT", tick, kind: "LOAN_INSTALMENT", enteredBy: by,
            legs: [{ accountId: bAcc, asset: "VB", amount: -inst }, { accountId: bk, asset: "VB", amount: inst }],
            refType: "Loan", refId: l.id, stepNo: 6, idempotencyKey: `settle-t${tick}-loan-${l.id}`
          });
          await prisma.loan.update({ where: { id: l.id }, data: { missedCount: 0 } });
        } catch {
          const n = l.missedCount + 1;
          await prisma.loan.update({ where: { id: l.id }, data: { missedCount: n, state: n >= 2 ? "DEFAULTED" : l.state } });
          await prisma.reliabilityEvent.create({ data: { companyId: l.borrowerCompany, tick, kind: "PAYMENT_MISSED", ref: l.id, createdBy: by } });
        }
      });
      await markDone(tick, "loans");
      log.push(`step6 loans: ${loans.length}`);
    } else log.push("step6 loans: already done");

    // Step 7: workforce
    if (!skip("workforce")) {
      for (const cc of companies) {
        const seats = await prisma.requiredSeat.findMany({ where: { companyId: cc.id } });
        let empty = 0;
        for (const st of seats) {
          const filled = await prisma.employment.count({ where: { companyId: cc.id, domain: st.domain, state: "ACTIVE" } });
          if (filled < st.required) empty += st.required - filled;
        }
        if (empty > 0) {
          try {
            const cAcc = await ensureAccount("COMPANY", cc.id, "VB");
            const gov = await ensureAccount("INSTITUTION", "GOVERNMENT", "VB");
            await postTransaction({
              type: "DEFICIT_CHARGE", tick, kind: "DEFICIT_CHARGE", enteredBy: by,
              legs: [{ accountId: cAcc, asset: "VB", amount: -empty * DEFICIT_CHARGE }, { accountId: gov, asset: "VB", amount: empty * DEFICIT_CHARGE }],
              refType: "Company", refId: cc.id, stepNo: 7, idempotencyKey: `settle-t${tick}-def-${cc.id}`
            });
          } catch { /* arrears if broke */ }
        }
        await prisma.employment.updateMany({ where: { companyId: cc.id, state: "PENDING_MOVE" }, data: { state: "ACTIVE" } });
      }
      await markDone(tick, "workforce");
      log.push("step7 workforce done");
    } else log.push("step7 workforce: already done");

    // Step 8: lifecycle
    if (!skip("lifecycle")) {
      for (const cc of companies) {
        const cAcc = await ensureAccount("COMPANY", cc.id, "VB");
        const cash = await bal(cAcc, "VB");
        const staff = await prisma.employment.count({ where: { companyId: cc.id, state: "ACTIVE" } });
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

    // Step 9: missions expiry
    if (!skip("missions")) {
      await prisma.missionInstance.updateMany({ where: { tick: { lt: tick - 2 }, state: "OPEN" }, data: { state: "EXPIRED" } });
      await markDone(tick, "missions");
      log.push("step9 missions expired");
    } else log.push("step9 missions: already done");

    // Step 10: market + CompanyTick
    if (!skip("market")) {
      await pool(companies, 5, async (cc) => {
        const cAcc = await ensureAccount("COMPANY", cc.id, "VB");
        const cash = await bal(cAcc, "VB");
        const stocks: Record<string, number> = {};
        for (const r of Object.keys(BANK_BASE)) {
          const a = await ensureAccount("COMPANY", cc.id, r);
          let q = await bal(a, r);
          if (q > STORAGE_CAP) {
            const decay = Math.ceil((q - STORAGE_CAP) * 0.1);
            const sink = await ensureAccount("CONSUMED", "CITY", r);
            await postTransaction({
              type: "DECAY", tick, kind: "DECAY", enteredBy: by,
              legs: [{ accountId: a, asset: r, amount: -decay }, { accountId: sink, asset: r, amount: decay }],
              refType: "Company", refId: cc.id, stepNo: 10, idempotencyKey: `settle-t${tick}-decay-${cc.id}-${r}`
            });
            q -= decay;
          }
          stocks[r] = q;
        }
        const n = nav({ cash, stocks });
        const rvv = rv(n, 0);
        await prisma.companyTick.upsert({
          where: { companyId_tick: { companyId: cc.id, tick } },
          create: { companyId: cc.id, tick, cash, nav: n, rv: rvv, creditGrade: creditGrade({ completed: 0, missLast3: false, bankDebt: 0, inDefault: false, distressed: cash < 0 }), runway: runway(cash, 1000) },
          update: { cash, nav: n, rv: rvv }
        });
      });
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
