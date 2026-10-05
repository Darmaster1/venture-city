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

// List crew (never exposes secret hashes).
export async function GET(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const vols = await prisma.volunteer.findMany({ orderBy: { name: "asc" } });
  return Response.json({
    volunteers: vols.map((v) => ({ id: v.id, name: v.name, role: v.role, deskOrCompany: v.deskOrCompany }))
  });
}

// Create a volunteer. Generates a one-time secret — shown once, store hashed.
export async function POST(req: Request) {
  const g = await gmOnly(req);
  if (!g) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const role = String(b.role ?? "DESK").trim().toUpperCase();
  const deskOrCompany = b.deskOrCompany ? String(b.deskOrCompany) : null;
  if (!name) return Response.json({ error: "name required." }, { status: 400 });
  if (role === "DESK" && !deskOrCompany) return Response.json({ error: "DESK needs a desk (BANK, INVESTOR, ...). " }, { status: 400 });
  const secret = randomBytes(9).toString("hex");
  const v = await prisma.volunteer.create({
    data: { name, role, deskOrCompany, loginSecretHash: hashSecret(secret), createdBy: g.id }
  });
  await prisma.auditLog.create({ data: { actor: g.id, action: "VOLUNTEER_CREATE", refType: "Volunteer", refId: v.id, tick: 0 } });
  return Response.json({ ok: true, id: v.id, name, role, deskOrCompany, secret });
}
