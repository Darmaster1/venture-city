import { prisma } from "./db";
import { newQrToken, hashSecret } from "./auth";
import city10 from "../data/city10-companies.json";
import customers from "../data/customer-cards.json";
import suppliers from "../data/suppliers.json";
import licences from "../data/licences.json";
import grants from "../data/grants.json";
import tenders from "../data/tenders.json";
import media from "../data/media-products.json";
import missions from "../data/missions.json";
import opps from "../data/opportunity-templates.json";
import objectives from "../data/objective-templates.json";
import infocards from "../data/info-cards.json";
import bankprods from "../data/bank-products.json";

const RESOURCES = [
  { code: "COMPUTE", bankBasePrice: 20, bankStockT1: 400, restockPerTick: 100 },
  { code: "ENERGY", bankBasePrice: 15, bankStockT1: 400, restockPerTick: 100 },
  { code: "LOGISTICS", bankBasePrice: 20, bankStockT1: 400, restockPerTick: 100 },
  { code: "MATERIALS", bankBasePrice: 15, bankStockT1: 400, restockPerTick: 100 },
  { code: "DATA", bankBasePrice: 25, bankStockT1: 400, restockPerTick: 100 },
  { code: "INFRA", bankBasePrice: 30, bankStockT1: 400, restockPerTick: 100 }
];

async function acct(ownerType: string, ownerId: string, label: string) {
  return prisma.account.upsert({
    where: { ownerType_ownerId_label: { ownerType, ownerId, label } },
    create: { ownerType, ownerId, label, createdBy: "seed" },
    update: {}
  });
}

export async function seed() {
  const existing = await prisma.company.count();
  if (existing > 0 && !process.env.FORCE_SEED) { console.log("Seed skipped: companies exist. Set FORCE_SEED=1 to reseed."); return; }
  if (process.env.FORCE_SEED) {
    const tables = ["journalEntry","transaction","contractLine","contract","loan","employment","participant","companyTick","companyTier","requiredSeat","productCard","notableAsset","account","customerCard","supplierLine","licence","grant","tender","mediaProduct","missionCard","opportunityCard","objectiveTemplate","infoCard","bankProduct","investorProduct","run","tick","settlementLock","resource"];
    for (const t of tables) { try { await (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[t]?.deleteMany(); } catch {} }
  }
  await prisma.settlementLock.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  for (const r of RESOURCES) await prisma.resource.upsert({ where: { code: r.code }, create: r, update: { bankBasePrice: r.bankBasePrice } });
  await prisma.run.create({ data: { date: new Date(), rulesVersion: "1.0.0", contentVersion: "1.0.0", appVersion: "1.0.0", activeSet: "CITY10", N: 10, P: 80, infoMode: "CLOSED", currentTick: 0, clockState: "PRE", createdBy: "seed" } });
  for (let k = 0; k <= 10; k++) await prisma.tick.upsert({ where: { tickNo: k }, create: { tickNo: k }, update: {} });

  const companies = city10 as Array<{
    id: string; name: string; cluster: string[]; adjust: number; cash: number; asset: string; assetBook: number;
    critical: string; deficit: string; ceo: string; tiers: Record<string, string>; anchor: { units: number; rate: number; label: string };
  }>;
  for (const c of companies) {
    await prisma.company.upsert({
      where: { id: c.id },
      create: { id: c.id, name: c.name, cluster: c.cluster, strategicAdjustment: c.adjust, ceoPersona: c.ceo, deficitDomain: c.deficit, criticalSlot: c.critical, createdBy: "seed" },
      update: { name: c.name }
    });
    for (const [res, tier] of Object.entries(c.tiers))
      await prisma.companyTier.upsert({ where: { companyId_resource_effectiveFromTick: { companyId: c.id, resource: res, effectiveFromTick: 0 } }, create: { companyId: c.id, resource: res, tier, effectiveFromTick: 0 }, update: { tier } });
    await prisma.requiredSeat.upsert({ where: { companyId_domain: { companyId: c.id, domain: c.deficit } }, create: { companyId: c.id, domain: c.deficit, required: 1, fixedAtTick: 0 }, update: {} });
    await prisma.notableAsset.create({ data: { companyId: c.id, type: c.asset, bookValue: c.assetBook } });
    // Opening cash: RESERVE -> COMPANY VB
    const reserve = await acct("RESERVE", "CITY", "VB");
    const comp = await acct("COMPANY", c.id, "VB");
    const tx = await prisma.transaction.create({ data: { type: "OPENING", status: "SETTLED", proposedTick: 0, createdBy: "seed", idempotencyKey: `opening-${c.id}` } });
    await prisma.journalEntry.createMany({ data: [
      { txId: tx.id, tick: 0, accountId: reserve.id, asset: "VB", amount: -c.cash, kind: "OPENING", enteredBy: "seed" },
      { txId: tx.id, tick: 0, accountId: comp.id, asset: "VB", amount: c.cash, kind: "OPENING", enteredBy: "seed" }
    ] });
    // Starting resource stock 60 each
    for (const r of RESOURCES) {
      const bank = await acct("RESERVE", "CITY", r.code);
      const ca = await acct("COMPANY", c.id, r.code);
      const t2 = await prisma.transaction.create({ data: { type: "OPENING", status: "SETTLED", proposedTick: 0, createdBy: "seed", idempotencyKey: `opening-${c.id}-${r.code}` } });
      await prisma.journalEntry.createMany({ data: [
        { txId: t2.id, tick: 0, accountId: bank.id, asset: r.code, amount: -60, kind: "OPENING", enteredBy: "seed" },
        { txId: t2.id, tick: 0, accountId: ca.id, asset: r.code, amount: 60, kind: "OPENING", enteredBy: "seed" }
      ]});
    }
    // Anchor contract + lines T1-6
    const cc = await prisma.contract.create({ data: { type: "ANCHOR", sellerId: c.id, buyerId: "CUSTOMER", unitsPerTick: c.anchor.units, pricePerUnit: c.anchor.rate, startTick: 1, endTick: 6, settlement: "PER_TICK", state: "ACTIVE", createdBy: "seed" } });
    for (let k = 1; k <= 6; k++)
      await prisma.contractLine.create({ data: { contractId: cc.id, tick: k, unitsDue: c.anchor.units, paymentDue: c.anchor.units * c.anchor.rate } });
  }
  // Participants: 8 per company
  let badge = 100;
  for (const c of companies) {
    for (let i = 0; i < 8; i++) {
      const id = `${c.id}-P${i + 1}`;
      try {
        await prisma.participant.create({ data: { id, name: `${c.name} Staff ${i + 1}`, badgeNo: String(badge++), companyId: c.id, domain: i === 0 ? c.deficit : "Operations", level: 0, salary: 100, qrToken: newQrToken(), capabilityTags: [], createdBy: "seed" } });
      } catch {}
    }
  }
  for (const cu of customers as Array<Record<string, unknown>>)
    await prisma.customerCard.upsert({ where: { code: String(cu.code) }, create: { code: String(cu.code), title: String(cu.title), segment: String(cu.segment ?? "Enterprise"), sector: String(cu.sector ?? "Tech and Data"), ratePerTick: Number(cu.rate ?? 1000), ticks: Number(cu.ticks ?? 4), decideBy: cu.decideBy as number | undefined, assignee: cu.assignee as string | undefined, mustLicence: cu.licence as string | undefined, heldBack: Boolean(cu.heldBack), payload: cu as object }, update: {} });
  for (const s of suppliers as Array<Record<string, unknown>>)
    await prisma.supplierLine.upsert({ where: { code: String(s.code) }, create: { code: String(s.code), name: String(s.name), resource: String(s.resource), price: Number(s.price), minOrder: Number(s.min ?? 20), terms: String(s.terms ?? "upfront"), kind: String(s.kind ?? "STANDARD"), payload: s as object }, update: {} });
  for (const l of licences as Array<Record<string, unknown>>)
    await prisma.licence.upsert({ where: { code: String(l.code) }, create: { code: String(l.code), name: String(l.name), fee: Number(l.fee), ticks: Number(l.ticks ?? 1), requires: (l.requires ?? {}) as object }, update: {} });
  for (const g of grants as Array<Record<string, unknown>>)
    await prisma.grant.upsert({ where: { code: String(g.code) }, create: { code: String(g.code), name: String(g.name), maxAmt: Number(g.max), terms: g as object }, update: {} });
  for (const t of tenders as Array<Record<string, unknown>>)
    await prisma.tender.upsert({ where: { code: String(t.code) }, create: { code: String(t.code), name: String(t.name), value: Number(t.value), requires: t.requires as string | undefined, sector: String(t.sector ?? "Tech and Data"), releaseTick: Number(t.release ?? 3) }, update: {} });
  for (const m of media as Array<Record<string, unknown>>)
    await prisma.mediaProduct.upsert({ where: { code: String(m.code) }, create: { code: String(m.code), name: String(m.name), price: Number(m.price), terms: m as object }, update: {} });
  for (const m of missions as Array<Record<string, unknown>>)
    await prisma.missionCard.upsert({ where: { code: String(m.code) }, create: { code: String(m.code), title: String(m.title), tier: Number(m.tier ?? 1), reward: Number(m.reward ?? 500), flags: m as object }, update: {} });
  for (const o of opps as Array<Record<string, unknown>>)
    await prisma.opportunityCard.upsert({ where: { code: String(o.code) }, create: { code: String(o.code), title: String(o.title), value: Number(o.value ?? 1000), method: String(o.method ?? "FIRST_COMMIT"), payload: o as object }, update: {} });
  for (const o of objectives as Array<Record<string, unknown>>)
    await prisma.objectiveTemplate.upsert({ where: { code: String(o.code) }, create: { code: String(o.code), title: String(o.title), text: String(o.text ?? "") }, update: {} });
  for (const ic of infocards as Array<Record<string, unknown>>)
    await prisma.infoCard.upsert({ where: { code: String(ic.code) }, create: { code: String(ic.code), title: String(ic.title), grade: String(ic.grade ?? "C"), copy: String(ic.copy ?? ""), provenance: String(ic.prov ?? "") }, update: {} });
  for (const b of bankprods as Array<Record<string, unknown>>)
    await prisma.bankProduct.upsert({ where: { code: String(b.code) }, create: { code: String(b.code), name: String(b.name), terms: b as object }, update: {} });
  // Seed GM volunteer (secret: gm-admin-001, hashed)
  await prisma.volunteer.upsert({ where: { id: "gm-1" }, create: { id: "gm-1", name: "Game Master", role: "GM", loginSecretHash: hashSecret(process.env.GM_BOOTSTRAP_SECRET ?? "gm-admin-001"), createdBy: "seed" }, update: {} });
  console.log("Seed complete.");
}

if (require.main === module) seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
