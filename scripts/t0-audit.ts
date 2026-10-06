import { existsSync } from "fs";
import { join } from "path";
import { prisma } from "../src/db";
import city10 from "../data/city10-companies.json";
import opportunities from "../data/opportunity-templates.json";
import eventCards from "../data/event-cards.json";

const expectedResources = { COMPUTE: 20, ENERGY: 15, LOGISTICS: 20, MATERIALS: 15, DATA: 25, INFRA: 30 };
const failures: string[] = [];
function check(condition: boolean, message: string) { if (!condition) failures.push(message); }

async function main() {
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const resources = await prisma.resource.findMany({ orderBy: { code: "asc" } });
  const companies = await prisma.company.findMany({ where: { active: true } });
  const signatories = await prisma.participant.count({ where: { isSignatory: true } });
  const companyAccounts = await prisma.account.findMany({ where: { ownerType: "COMPANY", label: { in: Object.keys(expectedResources) } }, select: { id: true } });
  const companyResources = await prisma.journalEntry.findMany({ where: { tick: 0, asset: { in: Object.keys(expectedResources) }, accountId: { in: companyAccounts.map((account) => account.id) } }, select: { accountId: true, asset: true, amount: true } });
  const lanes = await prisma.lane.count({ where: { active: true } });
  const gmAccounts = await prisma.volunteer.count({ where: { role: "GM" } });

  check(Boolean(run && run.currentTick === 0 && run.clockState === "PRE"), "Run is not at T0 PRE.");
  check(Boolean(run && run.N === 10 && run.P === 80), "Run N/P does not equal 10/80.");
  check(Boolean(run && run.tickCount === 11), "Run does not use the authoritative 11-tick spine.");
  check(companies.length === 10, `Expected 10 active companies, found ${companies.length}.`);
  check(resources.length === 6, `Expected 6 bank resources, found ${resources.length}.`);
  for (const resource of resources) {
    check(resource.bankBasePrice === expectedResources[resource.code as keyof typeof expectedResources], `${resource.code} bank base price mismatch.`);
    check(resource.bankStockT1 === 400, `${resource.code} T1 bank stock mismatch.`);
  }
  check(signatories === 20, `Expected two T0 signatories per company, found ${signatories}.`);
  const stockByAccount = new Map<string, number>();
  for (const entry of companyResources) stockByAccount.set(`${entry.accountId}|${entry.asset}`, (stockByAccount.get(`${entry.accountId}|${entry.asset}`) ?? 0) + entry.amount);
  for (const value of stockByAccount.values()) check(value === 100, `Expected 100 opening units per company resource, found ${value}.`);
  check(lanes >= 5, `Expected at least 5 lanes, found ${lanes}.`);
  check(gmAccounts === 5, `Expected 5 GM accounts, found ${gmAccounts}.`);
  check(opportunities.filter((item) => ["O21", "O22", "O23", "O24", "O25", "O26", "O27", "O28"].includes(item.code)).length === 8, "O21-O28 opportunity set is incomplete.");
  check(eventCards.length === 46, `Expected 46 event/crisis cards, found ${eventCards.length}.`);
  check(eventCards.filter((card) => card.kind === "EVENT").length === 26, "Expected 26 market events.");
  check(eventCards.filter((card) => card.kind === "CRISIS").length === 20, "Expected 20 crises.");

  console.log(JSON.stringify({ ok: failures.length === 0, checks: { companies: companies.length, resources: resources.length, signatories, lanes, gmAccounts, opportunities: 8 }, handbook: existsSync(join(process.cwd(), "GM-HANDBOOK.md")) ? "present" : "missing", failures }, null, 2));
  await prisma.$disconnect();
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
