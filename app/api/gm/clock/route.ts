import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { snapshot } from "@/src/settlement";

async function gm(req: Request) {
  const match = (req.headers.get("cookie") ?? "").match(/vc_session=([^;]+)/);
  const session = match ? await verifySession(decodeURIComponent(match[1])) : null;
  if (!session || session.kind !== "volunteer" || !["GM", "DEPUTY_GM"].includes(session.role)) return null;
  return session;
}

export async function POST(req: Request) {
  const session = await gm(req);
  if (!session) return Response.json({ error: "GM login required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (!run) return Response.json({ error: "No active run." }, { status: 400 });
  const transitions: Record<string, { state: string; infoMode?: string }> = {
    market_open: { state: "RUNNING", infoMode: "CLOSED" },
    lunch_start: { state: "PAUSED" },
    lunch_end: { state: "RUNNING", infoMode: "CLOSED" },
    pause: { state: "PAUSED" },
    resume: { state: "RUNNING" },
    final_freeze: { state: "FINAL_FROZEN", infoMode: "OPEN" }
  };
  const transition = transitions[action];
  if (!transition) return Response.json({ error: "Unknown clock action." }, { status: 400 });
  if (action === "market_open" && run.clockState !== "PRE") return Response.json({ error: "Market can only open from PRE." }, { status: 409 });
  if (action === "final_freeze" && run.currentTick < run.tickCount - 1) return Response.json({ error: `Final freeze requires ticks 1-${run.tickCount - 1} to be settled.` }, { status: 409 });
  const now = new Date();
  const data = {
    clockState: transition.state,
    ...(transition.infoMode ? { infoMode: transition.infoMode } : {}),
    ...(action === "market_open" ? { marketOpenAt: now } : {}),
    ...(action === "lunch_start" ? { lunchStartedAt: now } : {}),
    ...(action === "lunch_end" ? { lunchEndsAt: now } : {}),
    ...(action === "final_freeze" ? { freezeAt: now, capTableLocked: true } : {})
  };
  const updated = await prisma.run.update({ where: { id: run.id }, data });
  if (action === "final_freeze") await snapshot(run.currentTick, "final", session.vid);
  await prisma.auditLog.create({ data: { tick: run.currentTick, actor: session.vid, action: `CLOCK_${action.toUpperCase()}` } });
  return Response.json({ ok: true, clockState: updated.clockState, infoMode: updated.infoMode, tick: updated.currentTick });
}
