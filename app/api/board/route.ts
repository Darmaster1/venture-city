import { prisma } from "@/src/db";
import { publicCompanyLine } from "@/src/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  const ticks = await prisma.companyTick.findMany({ where: { tick: run?.currentTick ?? 0 } });
  const rvOf = new Map(ticks.map((t) => [t.companyId, t.rv]));
  const resources = await prisma.resource.findMany();
  const server_time = new Date().toISOString();
  return Response.json({
    server_time,
    tick: run?.currentTick ?? 0,
    clock: run?.clockState ?? "PRE",
    infoMode: run?.infoMode ?? "CLOSED",
    companies: companies.map((c) => publicCompanyLine({ id: c.id, name: c.name, lifecycle: c.lifecycle, rv: rvOf.get(c.id) ?? c.baselineRv ?? undefined })),
    bankBase: Object.fromEntries(resources.map((r) => [r.code, r.bankBasePrice]))
  });
}
