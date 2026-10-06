export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return Response.json({ error: "GM only." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const state = body.freeze === false ? "RUNNING" : "FINAL_FROZEN";
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (!run) return Response.json({ error: "No active run." }, { status: 400 });
  await prisma.run.update({ where: { id: run.id }, data: { clockState: state, freezeAt: state === "FINAL_FROZEN" ? new Date() : null } });
  await prisma.auditLog.create({ data: { actor: v.id, action: state, tick: 0 } });
  return Response.json({ ok: true, clockState: state });
}
