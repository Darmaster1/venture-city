import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

async function observerFrom(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(/vc_session=([^;]+)/);
  const session = match ? await verifySession(decodeURIComponent(match[1])) : null;
  if (!session || session.kind !== "volunteer") return null;
  const volunteer = await prisma.volunteer.findUnique({ where: { id: session.vid } });
  return volunteer?.role === "OBSERVER" || ["GM", "DEPUTY_GM", "TECH_LEAD"].includes(volunteer?.role ?? "") ? volunteer : null;
}

export async function GET(req: Request) {
  const observer = await observerFrom(req);
  if (!observer) return Response.json({ error: "Observer login required." }, { status: 403 });
  const incidents = await prisma.incident.findMany({ orderBy: { id: "desc" }, take: 100 });
  return Response.json({ observations: incidents.map((incident) => ({ id: incident.id, tick: incident.tick, text: incident.text, severity: incident.severity })) });
}

export async function POST(req: Request) {
  const observer = await observerFrom(req);
  if (!observer) return Response.json({ error: "Observer login required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const zone = String(body.zone ?? "").trim();
  const participant = String(body.participant ?? "").trim();
  const flags = String(body.flags ?? "").trim();
  if (!zone || !participant || !flags) return Response.json({ error: "Zone, participant, and observation flags are required." }, { status: 400 });
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const incident = await prisma.incident.create({ data: { tick: run?.currentTick ?? 0, severity: "LOW", text: `Zone: ${zone} · Participant: ${participant} · ${flags}` } });
  await prisma.auditLog.create({ data: { actor: observer.id, action: "OBSERVATION_FILED", refType: "Incident", refId: incident.id, tick: run?.currentTick ?? 0 } });
  return Response.json({ ok: true, observation: incident }, { status: 201 });
}
