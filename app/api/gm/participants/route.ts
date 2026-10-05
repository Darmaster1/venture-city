export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession, newQrToken } from "@/src/auth";

async function gmOnly(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return null;
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return null;
  return v;
}

export async function GET(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const host = new URL(req.url).origin;
  const parts = await prisma.participant.findMany({ orderBy: { badgeNo: "asc" } });
  return Response.json({
    count: parts.length,
    participants: parts.map((p) => ({
      id: p.id, name: p.name, badgeNo: p.badgeNo, companyId: p.companyId,
      loginUrl: `${host}/login?qr=${p.qrToken}`
    }))
  });
}

// Late registration: creates participant + ACTIVE employment in one call.
export async function POST(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const companyId = String(b.companyId ?? "").trim() || null;
  const domain = String(b.domain ?? "Operations").trim();
  if (!name) return Response.json({ error: "name required." }, { status: 400 });
  if (companyId) {
    const co = await prisma.company.findUnique({ where: { id: companyId } });
    if (!co) return Response.json({ error: "Unknown company. Use SWC LED MAN SKF PAI GRG MED STH VLT TRL." }, { status: 400 });
  }
  const existing = await prisma.participant.findMany({ select: { badgeNo: true } });
  const nextBadge = existing.reduce((m, p) => Math.max(m, parseInt(p.badgeNo, 10) || 0), 99) + 1;
  const host = new URL(req.url).origin;
  const p = await prisma.participant.create({
    data: { name, badgeNo: String(nextBadge), companyId, domain, level: 0, salary: 100, qrToken: newQrToken(), capabilityTags: [], createdBy: g.id }
  });
  if (companyId) {
    await prisma.employment.create({
      data: { participantId: p.id, companyId, role: "staff", domain, level: 0, salary: 100, state: "ACTIVE", startTick: 0 }
    });
  }
  await prisma.auditLog.create({ data: { actor: g.id, action: "PARTICIPANT_CREATE", refType: "Participant", refId: p.id, tick: 0 } });
  const created = await prisma.participant.findUnique({ where: { id: p.id } });
  return Response.json({ ok: true, id: p.id, name, badgeNo: p.badgeNo, companyId, loginUrl: `${host}/login?qr=${created!.qrToken}` });
}

// Rename / reassign a participant (e.g. real names at registration).
export async function PATCH(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return Response.json({ error: "id required." }, { status: 400 });
  const p = await prisma.participant.findUnique({ where: { id: String(b.id) } });
  if (!p) return Response.json({ error: "Unknown participant." }, { status: 404 });
  const data: { name?: string; companyId?: string | null; domain?: string } = {};
  if (b.name !== undefined && String(b.name).trim()) data.name = String(b.name).trim();
  if (b.domain !== undefined) data.domain = String(b.domain);
  if (b.companyId !== undefined) {
    const nc = String(b.companyId).trim() || null;
    if (nc) {
      const co = await prisma.company.findUnique({ where: { id: nc } });
      if (!co) return Response.json({ error: "Unknown company." }, { status: 400 });
    }
    if (nc !== p.companyId) {
      await prisma.employment.updateMany({ where: { participantId: p.id, state: "ACTIVE" }, data: { state: "ENDED" } });
      if (nc) {
        await prisma.employment.create({
          data: { participantId: p.id, companyId: nc, role: "staff", domain: data.domain ?? p.domain, level: p.level ?? 0, salary: p.salary ?? 100, state: "ACTIVE", startTick: 0 }
        });
      }
      data.companyId = nc;
    }
  }
  const updated = await prisma.participant.update({ where: { id: p.id }, data });
  await prisma.auditLog.create({ data: { actor: g.id, action: "PARTICIPANT_UPDATE", refType: "Participant", refId: p.id, tick: 0 } });
  return Response.json({ ok: true, id: updated.id, name: updated.name, badgeNo: updated.badgeNo, companyId: updated.companyId });
}
