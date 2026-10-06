export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession, hashSecret } from "@/src/auth";
import { randomBytes } from "crypto";

async function gmOnly(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return null;
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return null;
  return v;
}

// New secret for one volunteer (shown once).
export async function POST(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return Response.json({ error: "id required." }, { status: 400 });
  const v = await prisma.volunteer.findUnique({ where: { id: String(b.id) } });
  if (!v) return Response.json({ error: "Unknown volunteer." }, { status: 404 });
  const secret = randomBytes(9).toString("hex");
  await prisma.volunteer.update({ where: { id: v.id }, data: { loginSecretHash: hashSecret(secret) } });
  await prisma.auditLog.create({ data: { actor: g.id, action: "SECRET_RESET", refType: "Volunteer", refId: v.id, tick: 0 } });
  return Response.json({ ok: true, id: v.id, name: v.name, secret });
}
