export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { postTransaction } from "@/src/ledger";

// GM manual entry: rewards, corrections. Reason mandatory. Never edits.
export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(v.role)) return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (!b.reason || !b.toAccountId || !b.asset || !Number.isInteger(Number(b.amount)) || Number(b.amount) <= 0)
    return Response.json({ error: "reason, toAccountId, asset, amount required." }, { status: 400 });
  const destination = await prisma.account.findUnique({ where: { id: String(b.toAccountId) } });
  if (!destination) return Response.json({ error: "Unknown destination account." }, { status: 400 });
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (run?.clockState === "FINAL_FROZEN") return Response.json({ error: "City is frozen." }, { status: 409 });
  const from = await prisma.account.findFirst({ where: { ownerType: "RESERVE", ownerId: "CITY", label: b.asset } })
    ?? await prisma.account.create({ data: { ownerType: "RESERVE", ownerId: "CITY", label: b.asset, createdBy: v.id } });
  try {
    const t = await postTransaction({
      type: "CORRECTION", tick: run?.currentTick ?? 0, kind: String(b.kind ?? "CORRECTION"),
      enteredBy: v.id, legs: [{ accountId: from.id, asset: b.asset, amount: -Number(b.amount) }, { accountId: String(b.toAccountId), asset: b.asset, amount: Number(b.amount) }],
      reason: String(b.reason), idempotencyKey: b.idempotencyKey ? String(b.idempotencyKey) : undefined
    });
    await prisma.auditLog.create({ data: { actor: v.id, action: "GM_ENTRY", refType: "Transaction", refId: t.id, tick: run?.currentTick ?? 0 } });
    return Response.json({ ok: true, tx: t.id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
