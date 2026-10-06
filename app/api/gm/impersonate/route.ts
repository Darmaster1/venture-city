export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession, signImpersonate } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const g = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!g || !["GM", "DEPUTY_GM"].includes(g.role)) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return Response.json({ error: "id required." }, { status: 400 });
  const v = await prisma.volunteer.findUnique({ where: { id: String(b.id) } });
  if (!v) return Response.json({ error: "Unknown volunteer." }, { status: 404 });
  const token = await signImpersonate(v.id);
  const host = new URL(req.url).origin;
  return Response.json({ ok: true, id: v.id, name: v.name, loginUrl: `${host}/login?t=${token}` });
}
