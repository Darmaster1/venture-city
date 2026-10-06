export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { postTransaction } from "@/src/ledger";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s) return Response.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { type, code, companyId, amount } = b;
  if (!type || !code || !companyId) {
    return Response.json({ error: "Type, code, and company ID required." }, { status: 400 });
  }

  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const tick = run?.currentTick ?? 0;

  if (type === "LICENCE") {
    const lic = await prisma.licence.findUnique({ where: { code: String(code) } });
    if (!lic) return Response.json({ error: "Licence not found." }, { status: 404 });
    const fee = lic.fee;

    const companyAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" } }, create: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" }, update: {} });
    const reserveAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" } }, create: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" }, update: {} });

    const tx = await postTransaction({
      type: "LICENCE_FEE",
      tick,
      kind: "LICENCE_FEE",
      enteredBy: s.kind === "volunteer" ? s.vid : s.pid,
      idempotencyKey: `licence-${code}-${companyId}-${tick}-${Date.now()}`,
      legs: [
        { accountId: companyAcct.id, asset: "VB", amount: -fee },
        { accountId: reserveAcct.id, asset: "VB", amount: fee }
      ]
    });
    await prisma.licenceHolding.create({
      data: { licenceId: lic.id, companyId: String(companyId) }
    });
    return Response.json({ ok: true, txId: tx.id });
  }

  if (type === "GRANT") {
    const grant = await prisma.grant.findUnique({ where: { code: String(code) } });
    if (!grant) return Response.json({ error: "Grant not found." }, { status: 404 });
    const grantAmount = amount ? Number(amount) : grant.maxAmt;

    const companyAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" } }, create: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" }, update: {} });
    const reserveAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" } }, create: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" }, update: {} });

    const tx = await postTransaction({
      type: "GRANT_DISBURSEMENT",
      tick,
      kind: "GRANT_PAY",
      enteredBy: s.kind === "volunteer" ? s.vid : s.pid,
      idempotencyKey: `grant-${code}-${companyId}-${tick}-${Date.now()}`,
      legs: [
        { accountId: reserveAcct.id, asset: "VB", amount: -grantAmount },
        { accountId: companyAcct.id, asset: "VB", amount: grantAmount }
      ]
    });
    return Response.json({ ok: true, txId: tx.id });
  }

  return Response.json({ error: "Unsupported application type." }, { status: 400 });
}
