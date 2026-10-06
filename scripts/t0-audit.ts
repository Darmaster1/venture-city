import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/db";
import city10 from "../data/city10-companies.json";
import opportunities from "../data/opportunity-templates.json";

const expectedResources = { COMPUTE: 20, ENERGY: 15, LOGISTICS: 20, MATERIALS: 15, DATA: 25, INFRA: 30 };
const failures: string[] = [];
function check(condition: boolean, message: string) { if (!condition) failures.push(message); }

async function main() {
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const resources = await prisma.resource.findMany({ orderBy: { code: "asc" } });
  const companies = await prisma.company.findMany({ where: { active: true } });
  const signatories = await prisma.participant.count({ where: { isSignatory: true } });
  const lanes = await prisma.lane.count({ where: { active: true } });
  const gmAccounts = await prisma.volunteer.count({ where: { role: "GM" } });
  const crisisCsv = join(process.cwd(), "data", "event-crisis.csv");

  check(Boolean(run && run.currentTick === 0 && run.clockState === "PRE"), "Run is not at T0 PRE.");
  check(Boolean(run && run.N === 10 && run.P === 80), "Run N/P does not equal 10/80.");
  check(companies.length === 10, `Expected 10 active companies, found ${companies.length}.`);
  check(resources.length === 6, `Expected 6 bank resources, found ${resources.length}.`);
  for (const resource of resources) {
    check(resource.bankBasePrice === expectedResources[resource.code as keyof typeof expectedResources], `${resource.code} bank base price mismatch.`);
    check(resource.bankStockT1 === 400, `${resource.code} T1 bank stock mismatch.`);
  }
  check(signatories === 10, `Expected one T0 signatory per company, found ${signatories}.`);
  check(lanes >= 5, `Expected at least 5 lanes, found ${lanes}.`);
  check(gmAccounts === 5, `Expected 5 GM accounts, found ${gmAccounts}.`);
  check(opportunities.filter((item) => ["O21", "O22", "O23", "O24", "O25", "O26", "O27", "O28"].includes(item.code)).length === 8, "O21-O28 opportunity set is incomplete.");
  check(existsSync(crisisCsv) && readFileSync(crisisCsv, "utf8").trim().split(/\r?\n/).length >= 9, "Event-crisis CSV is missing or incomplete.");

  console.log(JSON.stringify({ ok: failures.length === 0, checks: { companies: companies.length, resources: resources.length, signatories, lanes, gmAccounts, opportunities: 8 }, handbook: existsSync(join(process.cwd(), "GM-HANDBOOK.md")) ? "present" : "missing", failures }, null, 2));
  await prisma.$disconnect();
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exitCode = 1; });
