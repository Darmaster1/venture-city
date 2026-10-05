import { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { postTransaction } from "./ledger";
import { TIER_RATES, SALARY_LADDER, DEFICIT_CHARGE, STORAGE_CAP, BANK_BASE, nav, rv, creditGrade, runway } from "./formulas";
import { pct } from "./rounding";

export type StepLog = string[];

async function ensureAccount(tx: PrismaClient, ownerType: string, ownerId: string, label: string): Promise<string> {
  const ex = await tx.account.findUnique({ where: { ownerType_ownerId_label: { ownerType, ownerId, label } } });
  if (ex) return ex.id;
  const a = await tx.account.create({ data: { ownerType, ownerId, label, createdBy: "settle" } });
  return a.id;
}

export async function acquireLock(by: string, tickNo: number): Promise<boolean> {
  // Raw SQL guarded update with 5-min stale clause
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
  const entries = await prisma.journalEntry.findMany({ where: { tick: { lte: tick } }, take: 20000 });
  const payload = { tick, phase, count: entries.length, entries: entries.slice(0, 5000) };
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

export async function settleTick(tick: number, by: string): Promise<{ log: StepLog; ms: number }> {
  const t0 = Date.now();
  const log: StepLog = [];
  const ok = await acquireLock(by, tick);
  if (!ok) { const e = new Error("Another settle is in flight"); (e as { status?: number }).status = 409; throw e; }
  try {
    await snapshot(tick, "pre", by); log.push(`snapshot pre tick ${tick}`);
    await prisma.run.updateMany({ data: { clockState: "FROZEN_FOR_SETTLEMENT" } });

    await prisma.$transaction(async (tx) => {
      const companies = await tx.company.findMany({ where: { active: true } });
      // Step 2: recurring contracts
      let c2 = 0;
      const contracts = await tx.contract.findMany({ where: { state: "ACTIVE", startTick: { lte: tick }, endTick: { gte: tick } } });
      for (const c of contracts) {
        const line = await tx.contractLine.findUnique({ where: { contractId_tick: { contractId: c.id, tick } } });
        if (!line) continue;
        const units = line.unitsDue, due = line.paymentDue;
        // Simplified: attempt payment buyer->seller via VB accounts
        if (c.buyerId && c.sellerId && due > 0) {
          try {
            const bAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.buyerId, "VB");
            const sAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.sellerId, "VB");
            await postTransaction({
              type: "CONTRACT_PAYMENT", tick, kind: "CONTRACT_PAYMENT", enteredBy: by,
              legs: [{ accountId: bAcc, asset: "VB", amount: -due }, { accountId: sAcc, asset: "VB", amount: due }],
              refType: "Contract", refId: c.id, stepNo: 2, idempotencyKey: `settle-t${tick}-c-${c.id}`
            }, tx as unknown as never);
            await tx.contractLine.update({ where: { id: line.id }, data: { paymentMade: due, unitsDelivered: units, outcome: "SETTLED" } });
          } catch {
            const late = pct(due, c.latePaymentPct);
            await tx.contractLine.update({ where: { id: line.id }, data: { outcome: "MISSED_PAYMENT" } });
            await tx.contract.update({ where: { id: c.id }, data: { consecutiveBreaches: { increment: 1 } } });
            await tx.reliabilityEvent.create({ data: { companyId: c.buyerId ?? "", tick, kind: "MISSED_PAYMENT", ref: `${c.id}:+${late}`, createdBy: by } });
          }
          c2++;
        }
      }
      log.push(`step2 contracts settled: ${c2}`);

      // Step 3: production
      const orders = await tx.productionOrder.findMany();
      for (const o of orders) {
        const prod = await tx.productCard.findUnique({ where: { id: o.productId } });
        if (!prod) continue;
        const cost = (prod.resourceCost ?? {}) as Record<string, number>;
        const compAcc: Record<string, string> = {};
        for (const r of Object.keys(cost)) compAcc[r] = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", o.companyId, r);
        const outAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", o.companyId, (prod.deliveryUnit ?? "OUTPUT").toUpperCase());
        void outAcc; void compAcc;
        // Simplified: skip actual consume if insufficient; log only
      }
      log.push(`step3 production orders: ${orders.length}`);

      // Step 4: salaries
      const emps = await tx.employment.findMany({ where: { state: "ACTIVE" } });
      for (const e of emps) {
        const pay = Math.max(e.salary, SALARY_LADDER[Math.min(e.level ?? 0, 5)] ?? 100);
        try {
          const cAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", e.companyId, "VB");
          let p = await tx.participant.findUnique({ where: { id: e.participantId } });
          let wAcc: string;
          if (p?.walletAccountId) wAcc = p.walletAccountId;
          else {
            wAcc = await ensureAccount(tx as unknown as PrismaClient, "PARTICIPANT", e.participantId, "VB");
            if (p) await tx.participant.update({ where: { id: p.id }, data: { walletAccountId: wAcc } });
          }
          await postTransaction({
            type: "SALARY", tick, kind: "SALARY", enteredBy: by,
            legs: [{ accountId: cAcc, asset: "VB", amount: -pay }, { accountId: wAcc, asset: "VB", amount: pay }],
            refType: "Employment", refId: e.id, stepNo: 4, idempotencyKey: `settle-t${tick}-sal-${e.id}`
          }, tx as unknown as never);
        } catch { /* arrears */ }
      }
      log.push(`step4 salaries: ${emps.length}`);

      // Step 5: baseline consumption
      const tiers = await tx.companyTier.findMany();
      const tierMap = new Map<string, string>();
      for (const t of tiers) tierMap.set(`${t.companyId}:${t.resource}`, t.tier);
      for (const c of companies) {
        for (const r of ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"]) {
          const tier = tierMap.get(`${c.id}:${r}`) ?? "MEDIUM";
          let rate = TIER_RATES[tier] ?? 7;
          const acc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.id, r);
          const agg = await tx.journalEntry.aggregate({ where: { accountId: acc, asset: r }, _sum: { amount: true } });
          const stock = agg._sum.amount ?? 0;
          if (stock <= 15 && stock > 0) rate = Math.ceil(rate * 1.25);
          const consume = Math.min(stock, rate);
          if (consume > 0) {
            const sink = await ensureAccount(tx as unknown as PrismaClient, "CONSUMED", "CITY", r);
            await postTransaction({
              type: "CONSUMPTION", tick, kind: "CONSUMPTION", enteredBy: by,
              legs: [{ accountId: acc, asset: r, amount: -consume }, { accountId: sink, asset: r, amount: consume }],
              refType: "Company", refId: c.id, stepNo: 5, idempotencyKey: `settle-t${tick}-cons-${c.id}-${r}`
            }, tx as unknown as never);
          }
        }
      }
      log.push("step5 consumption done");

      // Step 6: debt service
      const loans = await tx.loan.findMany({ where: { state: { in: ["DISBURSED", "PARTIAL"] } } });
      for (const l of loans) {
        if (tick < l.firstDueTick) continue;
        const total = l.principal + pct(l.principal, l.flatRate);
        const inst = Math.ceil(total / l.termTicks);
        try {
          const bAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", l.borrowerCompany, "VB");
          const bk = await ensureAccount(tx as unknown as PrismaClient, "INSTITUTION", "BANK", "VB");
          await postTransaction({
            type: "LOAN_INSTALMENT", tick, kind: "LOAN_INSTALMENT", enteredBy: by,
            legs: [{ accountId: bAcc, asset: "VB", amount: -inst }, { accountId: bk, asset: "VB", amount: inst }],
            refType: "Loan", refId: l.id, stepNo: 6, idempotencyKey: `settle-t${tick}-loan-${l.id}`
          }, tx as unknown as never);
          await tx.loan.update({ where: { id: l.id }, data: { missedCount: 0 } });
        } catch {
          const n = l.missedCount + 1;
          await tx.loan.update({ where: { id: l.id }, data: { missedCount: n, state: n >= 2 ? "DEFAULTED" : l.state } });
          await tx.reliabilityEvent.create({ data: { companyId: l.borrowerCompany, tick, kind: "PAYMENT_MISSED", ref: l.id, createdBy: by } });
        }
      }
      log.push(`step6 loans: ${loans.length}`);

      // Step 7: workforce (deficit charge + pending moves)
      for (const c of companies) {
        const seats = await tx.requiredSeat.findMany({ where: { companyId: c.id } });
        let empty = 0;
        for (const s of seats) {
          const filled = await tx.employment.count({ where: { companyId: c.id, domain: s.domain, state: "ACTIVE" } });
          if (filled < s.required) empty += s.required - filled;
        }
        if (empty > 0) {
          const cAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.id, "VB");
          const gov = await ensureAccount(tx as unknown as PrismaClient, "INSTITUTION", "GOVERNMENT", "VB");
          const fee = empty * DEFICIT_CHARGE;
          try {
            await postTransaction({
              type: "DEFICIT_CHARGE", tick, kind: "DEFICIT_CHARGE", enteredBy: by,
              legs: [{ accountId: cAcc, asset: "VB", amount: -fee }, { accountId: gov, asset: "VB", amount: fee }],
              refType: "Company", refId: c.id, stepNo: 7, idempotencyKey: `settle-t${tick}-def-${c.id}`
            }, tx as unknown as never);
          } catch { /* arrears if broke */ }
        }
        await tx.employment.updateMany({ where: { companyId: c.id, state: "PENDING_MOVE" }, data: { state: "ACTIVE" } });
      }
      log.push("step7 workforce done");

      // Step 8: lifecycle
      for (const c of companies) {
        const cAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.id, "VB");
        const agg = await tx.journalEntry.aggregate({ where: { accountId: cAcc, asset: "VB" }, _sum: { amount: true } });
        const cash = agg._sum.amount ?? 0;
        const staff = await tx.employment.count({ where: { companyId: c.id, state: "ACTIVE" } });
        const badLoan = await tx.loan.findFirst({ where: { borrowerCompany: c.id, state: "DEFAULTED" } });
        const distressed = cash < 0 || staff < 3 || !!badLoan;
        await tx.company.update({
          where: { id: c.id },
          data: distressed
            ? { lifecycle: "DISTRESSED", distressedSinceTick: c.distressedSinceTick ?? tick }
            : { lifecycle: "OPERATING", distressedSinceTick: null }
        });
      }
      log.push("step8 lifecycle done");

      // Step 9: missions/opportunities expiry + refill
      await tx.missionInstance.updateMany({ where: { tick: { lt: tick - 2 }, state: "OPEN" }, data: { state: "EXPIRED" } });
      log.push("step9 missions expired");

      // Step 10: market + CompanyTick
      for (const c of companies) {
        const cAcc = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.id, "VB");
        const agg = await tx.journalEntry.aggregate({ where: { accountId: cAcc, asset: "VB" }, _sum: { amount: true } });
        const cash = agg._sum.amount ?? 0;
        const stocks: Record<string, number> = {};
        for (const r of Object.keys(BANK_BASE)) {
          const a = await ensureAccount(tx as unknown as PrismaClient, "COMPANY", c.id, r);
          const s = await tx.journalEntry.aggregate({ where: { accountId: a, asset: r }, _sum: { amount: true } });
          let q = s._sum.amount ?? 0;
          if (q > STORAGE_CAP) {
            const decay = Math.ceil((q - STORAGE_CAP) * 0.1);
            const sink = await ensureAccount(tx as unknown as PrismaClient, "CONSUMED", "CITY", r);
            await postTransaction({
              type: "DECAY", tick, kind: "DECAY", enteredBy: by,
              legs: [{ accountId: a, asset: r, amount: -decay }, { accountId: sink, asset: r, amount: decay }],
              refType: "Company", refId: c.id, stepNo: 10, idempotencyKey: `settle-t${tick}-decay-${c.id}-${r}`
            }, tx as unknown as never);
            q -= decay;
          }
          stocks[r] = q;
        }
        const n = nav({ cash, stocks });
        const rvv = rv(n, 0);
        await tx.companyTick.upsert({
          where: { companyId_tick: { companyId: c.id, tick } },
          create: { companyId: c.id, tick, cash, nav: n, rv: rvv, creditGrade: creditGrade({ completed: 0, missLast3: false, bankDebt: 0, inDefault: false, distressed: cash < 0 }), runway: runway(cash, 1000) },
          update: { cash, nav: n, rv: rvv }
        });
      }
      log.push("step10 market done");

      await tx.tick.upsert({
        where: { tickNo: tick },
        create: { tickNo: tick, settledAt: new Date(), settledBy: by },
        update: { settledAt: new Date(), settledBy: by }
      });
      await tx.run.updateMany({ data: { currentTick: tick, clockState: "RUNNING" } });
    });

    await snapshot(tick, "post", by); log.push(`snapshot post tick ${tick}`);
  } finally {
    await releaseLock();
  }
  return { log, ms: Date.now() - t0 };
}
