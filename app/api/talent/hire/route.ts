export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s) return Response.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { participantId, toCompanyId, domain, salary } = b;
  if (!participantId || !toCompanyId) {
    return Response.json({ error: "Participant ID and target company required." }, { status: 400 });
  }

  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const tick = run?.currentTick ?? 0;

  // End existing active employment
  await prisma.employment.updateMany({
    where: { participantId: String(participantId), state: "ACTIVE" },
    data: { state: "ENDED", endTick: tick }
  });

  // Create new employment contract
  const emp = await prisma.employment.create({
    data: {
      participantId: String(participantId),
      companyId: String(toCompanyId),
      role: "staff",
      domain: domain ? String(domain) : "Operations",
      level: 0,
      salary: salary ? Number(salary) : 100,
      state: "ACTIVE",
      startTick: tick
    }
  });

  // Re-assign participant's company
  await prisma.participant.update({
    where: { id: String(participantId) },
    data: { companyId: String(toCompanyId) }
  });

  return Response.json({ ok: true, employment: emp });
}
