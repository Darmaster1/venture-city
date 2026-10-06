import { prisma } from "@/src/db";
import { publicCompanyLine } from "@/src/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const companies = await prisma.company.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  const ticks = await prisma.companyTick.findMany({ where: { tick: run?.currentTick ?? 0 } });
  const rvOf = new Map(ticks.map((t) => [t.companyId, t.rv]));
  const resources = await prisma.resource.findMany();
  const [lanes, deals] = await Promise.all([
    prisma.lane.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, desk: true } }),
    prisma.dealSheet.findMany({ where: { state: { in: ["SENT_FOR_SIGNATURES", "SIGNED"] } }, orderBy: { createdAt: "desc" }, take: 12, select: { code: true, lane: true, sellerId: true, buyerId: true, state: true } })
  ]);
  const server_time = new Date().toISOString();
  return Response.json({
    server_time,
    tick: run?.currentTick ?? 0,
    clock: run?.clockState ?? "PRE",
    infoMode: run?.infoMode ?? "CLOSED",
    companies: companies.map((c) => publicCompanyLine({ id: c.id, name: c.name, lifecycle: c.lifecycle, rv: rvOf.get(c.id) ?? c.baselineRv ?? undefined })),
    bankBase: Object.fromEntries(resources.map((r) => [r.code, r.bankBasePrice])),
    lanes,
    activeDeals: deals.map((deal) => ({ code: deal.code, lane: deal.lane, parties: `${deal.sellerId} → ${deal.buyerId}`, state: deal.state }))
  });
  } catch {
    return Response.json({ error: "City feed is temporarily unavailable." }, { status: 503 });
  }
}
