export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { settleTick } from "@/src/settlement";

async function who(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  if (!m) return null;
  const s = await verifySession(decodeURIComponent(m[1]));
  if (!s || s.kind !== "volunteer") return null;
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  return v;
}

export async function POST(req: Request) {
  const v = await who(req);
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return Response.json({ error: "GM only." }, { status: 403 });
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (!run) return Response.json({ error: "No run." }, { status: 400 });
  if (run.clockState === "FINAL_FROZEN")
    return Response.json({ error: "City is frozen." }, { status: 409 });
  // FROZEN_FOR_SETTLEMENT means a previous attempt died mid-way: fall
  // through and resume it. Per-op idempotency keys make resume safe, and
  // the lock table still refuses a genuinely concurrent second settle.
  const next = run.currentTick + 1;
  if (next > 10) return Response.json({ error: "Event complete." }, { status: 400 });
  try {
    const { log, ms } = await settleTick(next, v.id);
    return Response.json({ ok: true, tick: next, ms, log, server_time: new Date().toISOString() });
  } catch (e: unknown) {
    const st = (e as { status?: number }).status ?? 500;
    return Response.json({ error: (e as Error).message }, { status: st });
  }
}
