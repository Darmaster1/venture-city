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
import eventCards from "../data/event-cards.json";

const RESOURCES = [
  { code: "COMPUTE", bankBasePrice: 20, bankStockT1: 400, restockPerTick: 100 },
  { code: "ENERGY", bankBasePrice: 15, bankStockT1: 400, restockPerTick: 100 },
  { code: "LOGISTICS", bankBasePrice: 20, bankStockT1: 400, restockPerTick: 100 },
  { code: "MATERIALS", bankBasePrice: 15, bankStockT1: 400, restockPerTick: 100 },
  { code: "DATA", bankBasePrice: 25, bankStockT1: 400, restockPerTick: 100 },
  { code: "INFRA", bankBasePrice: 30, bankStockT1: 400, restockPerTick: 100 }
];

const LANES = [
  { code: "TRADE", name: "Trade lane", desk: "BANK", description: "Resources, spot trades, and settlement-ready Deal Sheets.", sortOrder: 1 },
  { code: "SUPPLY", name: "Supply lane", desk: "SUPPLIER", description: "Recurring supply lines and capacity checks.", sortOrder: 2 },
  { code: "CAPITAL", name: "Capital lane", desk: "INVESTOR", description: "Term sheets, loans, and signed capital decisions.", sortOrder: 3 },
  { code: "PEOPLE", name: "People lane", desk: "TALENT", description: "Hiring, retention, and specialist seats.", sortOrder: 4 },
  { code: "PUBLIC", name: "Public lane", desk: "GOVERNMENT", description: "Licences, grants, tenders, and rulings.", sortOrder: 5 }
];

const FEATURE_TOGGLES = [
  { key: "deal_sheets", enabled: true, description: "Enable floor-checked Deal Sheets and signature workflow." },
  { key: "station_dashboard", enabled: true, description: "Show lane and Deal Sheet status on company stations." },
  { key: "city_board_live", enabled: true, description: "Show the live public City Board feed." },
  { key: "event_crisis_deck", enabled: true, description: "Release event-crisis cards into the live deck." }
];

const DEFAULT_EVENT_CODES = new Set(["E22", "E01", "E04", "E13", "E20", "E08", "E03", "E32", "C01", "C06", "C07", "C12", "C17", "C20"]);

async function seedEventCards() {
  for (const card of eventCards as Array<Record<string, unknown>>) {
    const code = String(card.code);
    const data = { kind: String(card.kind), title: String(card.title), tick: Number(card.tick), signalTick: card.signalTick == null ? undefined : Number(card.signalTick), phase: String(card.stage ?? "MARKET"), targetRule: String(card.targetRule ?? ""), visibility: String(card.visibility ?? "PUBLIC"), payload: card as object };
    await prisma.eventCrisisCard.upsert({ where: { code }, create: { code, ...data, state: DEFAULT_EVENT_CODES.has(code) ? "QUEUED" : "LIBRARY" }, update: data });
  }
}

async function seedDayTwo() {
  for (const lane of LANES) await prisma.lane.upsert({ where: { code: lane.code }, create: lane, update: lane });
  for (const toggle of FEATURE_TOGGLES) await prisma.featureToggle.upsert({ where: { key: toggle.key }, create: toggle, update: { description: toggle.description } });
  await seedEventCards();
  for (const mission of missions as Array<Record<string, unknown>>) {
    const code = String(mission.code);
    await prisma.missionCard.upsert({ where: { code }, create: { code, title: String(mission.title), tier: Number(mission.tier ?? 1), reward: Number(mission.reward ?? 500), flags: mission as object }, update: {} });
    const exists = await prisma.missionInstance.findFirst({ where: { missionId: code, tick: 1 } });
    if (!exists) await prisma.missionInstance.create({ data: { missionId: code, tick: 1, state: "OPEN" } });
  }
  for (const opportunity of opps as Array<Record<string, unknown>>) {
    const code = String(opportunity.code);
    await prisma.opportunityCard.upsert({ where: { code }, create: { code, title: String(opportunity.title), value: Number(opportunity.value ?? 1000), method: String(opportunity.method ?? "FIRST_COMMIT"), payload: opportunity as object }, update: { title: String(opportunity.title), value: Number(opportunity.value ?? 1000), payload: opportunity as object } });
    const exists = await prisma.opportunityInstance.findFirst({ where: { oppId: code, tick: 1 } });
    if (!exists) await prisma.opportunityInstance.create({ data: { oppId: code, tick: 1, state: "LIVE" } });
  }
  const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true } });
  for (const company of companies) {
    const signatories = await prisma.participant.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "asc" }, take: 2, select: { id: true } });
    await prisma.participant.updateMany({ where: { companyId: company.id }, data: { isSignatory: false } });
    if (signatories.length) await prisma.participant.updateMany({ where: { id: { in: signatories.map((participant) => participant.id) } }, data: { isSignatory: true } });
  }
  await prisma.volunteer.upsert({ where: { id: "gm-1" }, create: { id: "gm-1", name: "Game Master", role: "GM", loginSecretHash: hashSecret(process.env.GM_BOOTSTRAP_SECRET ?? "gm-admin-001"), createdBy: "seed" }, update: {} });
  for (let i = 2; i <= 5; i++) {
    const id = `gm-${i}`;
    await prisma.volunteer.upsert({ where: { id }, create: { id, name: `GM Console ${i}`, role: "GM", loginSecretHash: hashSecret(process.env[`GM_ACCOUNT_${i}_SECRET`] ?? `gm-admin-00${i}`), createdBy: "seed" }, update: {} });
  }
}

async function acct(ownerType: string, ownerId: string, label: string) {
  return prisma.account.upsert({
    where: { ownerType_ownerId_label: { ownerType, ownerId, label } },
    create: { ownerType, ownerId, label, createdBy: "seed" },
    update: {}
  });
}

export async function seed() {
  const existing = await prisma.company.count();
  if (existing > 0 && !process.env.FORCE_SEED) { await seedDayTwo(); console.log("Day 2 seed complete: existing game data preserved."); return; }
  if (process.env.FORCE_SEED) {
    const tables = ["dealSignature","dealSheet","featureToggle","lane","journalEntry","transaction","contractLine","contract","loan","employment","participant","companyTick","companyTier","requiredSeat","productCard","notableAsset","account","customerCard","supplierLine","licence","grant","tender","mediaProduct","missionCard","opportunityCard","objectiveTemplate","infoCard","eventCrisisCard","bankProduct","investorProduct","run","tick","settlementLock","resource"];
    for (const t of tables) { try { await (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[t]?.deleteMany(); } catch {} }
  }
  await prisma.settlementLock.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  for (const r of RESOURCES) await prisma.resource.upsert({ where: { code: r.code }, create: { ...r, bankStock: r.bankStockT1 }, update: { bankBasePrice: r.bankBasePrice, bankStock: r.bankStockT1 } });
  await prisma.run.create({ data: { date: new Date(), rulesVersion: "1.0.0", contentVersion: "1.0.0", appVersion: "1.0.0", activeSet: "CITY10", N: 10, P: 80, tickCount: 11, infoMode: "CLOSED", currentTick: 0, clockState: "PRE", createdBy: "seed" } });
  for (let k = 0; k <= 11; k++) await prisma.tick.upsert({ where: { tickNo: k }, create: { tickNo: k }, update: {} });
  for (const lane of LANES) await prisma.lane.upsert({ where: { code: lane.code }, create: lane, update: lane });
  for (const toggle of FEATURE_TOGGLES) await prisma.featureToggle.upsert({ where: { key: toggle.key }, create: toggle, update: toggle });

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
    // Opening cash: headcount x 2,450 + 10,000 + strategic adjustment.
    const openingCash = 8 * 2450 + 10000 + c.adjust;
    const reserve = await acct("RESERVE", "CITY", "VB");
    const comp = await acct("COMPANY", c.id, "VB");
    const tx = await prisma.transaction.create({ data: { type: "OPENING", status: "SETTLED", proposedTick: 0, createdBy: "seed", idempotencyKey: `opening-${c.id}` } });
    await prisma.journalEntry.createMany({ data: [
      { txId: tx.id, tick: 0, accountId: reserve.id, asset: "VB", amount: -openingCash, kind: "OPENING", enteredBy: "seed" },
      { txId: tx.id, tick: 0, accountId: comp.id, asset: "VB", amount: openingCash, kind: "OPENING", enteredBy: "seed" }
    ] });
    // Starting resource stock 100 each.
    for (const r of RESOURCES) {
      const bank = await acct("RESERVE", "CITY", r.code);
      const ca = await acct("COMPANY", c.id, r.code);
      const t2 = await prisma.transaction.create({ data: { type: "OPENING", status: "SETTLED", proposedTick: 0, createdBy: "seed", idempotencyKey: `opening-${c.id}-${r.code}` } });
      await prisma.journalEntry.createMany({ data: [
        { txId: t2.id, tick: 0, accountId: bank.id, asset: r.code, amount: -100, kind: "OPENING", enteredBy: "seed" },
        { txId: t2.id, tick: 0, accountId: ca.id, asset: r.code, amount: 100, kind: "OPENING", enteredBy: "seed" }
      ]});
    }
    // Anchor contract + lines T1-6
    const cc = await prisma.contract.create({ data: { type: "ANCHOR", sellerId: c.id, buyerId: "CUSTOMER", unitsPerTick: c.anchor.units, pricePerUnit: c.anchor.rate, startTick: 1, endTick: 6, settlement: "PER_TICK", state: "ACTIVE", createdBy: "seed" } });
    for (let k = 1; k <= 6; k++)
      await prisma.contractLine.create({ data: { contractId: cc.id, tick: k, unitsDue: c.anchor.units, paymentDue: c.anchor.units * c.anchor.rate } });
  }
  // Participants: 8 per company (+ employment so salaries + seats work)
  let badge = 100;
  for (const c of companies) {
    for (let i = 0; i < 8; i++) {
      const id = `${c.id}-P${i + 1}`;
      try {
        const domain = i === 0 ? c.deficit : "Operations";
        const pt = await prisma.participant.create({ data: { id, name: `${c.name} Staff ${i + 1}`, badgeNo: String(badge++), companyId: c.id, domain, level: 0, salary: 100, isSignatory: i < 2, qrToken: newQrToken(), capabilityTags: [], createdBy: "seed" } });
        await prisma.employment.create({ data: { participantId: pt.id, companyId: c.id, role: "staff", domain, level: 0, salary: 100, state: "ACTIVE", startTick: 0 } });
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
  for (const m of missions as Array<Record<string, unknown>>) {
    const code = String(m.code);
    await prisma.missionCard.upsert({ where: { code }, create: { code, title: String(m.title), tier: Number(m.tier ?? 1), reward: Number(m.reward ?? 500), flags: m as object }, update: {} });
    await prisma.missionInstance.create({ data: { missionId: code, tick: 1, state: "OPEN" } });
  }
  for (const o of opps as Array<Record<string, unknown>>) {
    const code = String(o.code);
    await prisma.opportunityCard.upsert({ where: { code }, create: { code, title: String(o.title), type: String(o.type ?? "AFTERMATH"), signal: o.signal as string | undefined, detail: o.detail as string | undefined, discoveryPaths: (o.discoveryPaths ?? []) as object, claimMethod: String(o.claimMethod ?? o.method ?? "FIRST_COMMIT"), tradeOff: o.tradeOff as string | undefined, value: Number(o.value ?? 1000), valueCap: o.valueCap == null ? undefined : Number(o.valueCap), window: o.window == null ? undefined : Number(o.window), decayRule: o.decayRule as string | undefined, institutions: (o.institutions ?? []) as object, visibility: String(o.visibility ?? "PUBLIC"), method: String(o.method ?? "FIRST_COMMIT"), payload: o as object }, update: { title: String(o.title), type: String(o.type ?? "AFTERMATH"), claimMethod: String(o.claimMethod ?? o.method ?? "FIRST_COMMIT"), value: Number(o.value ?? 1000), payload: o as object } });
    await prisma.opportunityInstance.create({ data: { oppId: code, tick: 1, state: "LIVE" } });
  }
  for (const o of objectives as Array<Record<string, unknown>>)
    await prisma.objectiveTemplate.upsert({ where: { code: String(o.code) }, create: { code: String(o.code), title: String(o.title), text: String(o.text ?? "") }, update: {} });
  for (const ic of infocards as Array<Record<string, unknown>>)
    await prisma.infoCard.upsert({ where: { code: String(ic.code) }, create: { code: String(ic.code), title: String(ic.title), grade: String(ic.grade ?? "C"), copy: String(ic.copy ?? ""), provenance: String(ic.prov ?? "") }, update: {} });
  for (const b of bankprods as Array<Record<string, unknown>>)
    await prisma.bankProduct.upsert({ where: { code: String(b.code) }, create: { code: String(b.code), name: String(b.name), terms: b as object }, update: {} });
  await seedEventCards();
  // Seed GM volunteer (secret: gm-admin-001, hashed)
  await prisma.volunteer.upsert({ where: { id: "gm-1" }, create: { id: "gm-1", name: "Game Master", role: "GM", loginSecretHash: hashSecret(process.env.GM_BOOTSTRAP_SECRET ?? "gm-admin-001"), createdBy: "seed" }, update: {} });
  for (let i = 2; i <= 5; i++) {
    const id = `gm-${i}`;
    await prisma.volunteer.upsert({ where: { id }, create: { id, name: `GM Console ${i}`, role: "GM", loginSecretHash: hashSecret(process.env[`GM_ACCOUNT_${i}_SECRET`] ?? `gm-admin-00${i}`), createdBy: "seed" }, update: {} });
  }
  console.log("Seed complete.");
}

if (require.main === module) seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
