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
  const { supplierCode, companyId, quantity } = b;
  if (!supplierCode || !companyId || !quantity || Number(quantity) <= 0) {
    return Response.json({ error: "Supplier code, company, and valid quantity required." }, { status: 400 });
  }

  const supplier = await prisma.supplierLine.findUnique({ where: { code: String(supplierCode) } });
  if (!supplier) return Response.json({ error: "Supplier line not found." }, { status: 404 });
  if (Number(quantity) < supplier.minOrder) {
    return Response.json({ error: `Minimum order quantity is ${supplier.minOrder}.` }, { status: 400 });
  }

  const totalCost = supplier.price * Number(quantity);
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const tick = run?.currentTick ?? 0;

  const companyVb = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" } }, create: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" }, update: {} });
  const reserveVb = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" } }, create: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" }, update: {} });
  const companyRes = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: String(companyId), label: supplier.resource } }, create: { ownerType: "COMPANY", ownerId: String(companyId), label: supplier.resource }, update: {} });
  const reserveRes = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "CITY", label: supplier.resource } }, create: { ownerType: "RESERVE", ownerId: "CITY", label: supplier.resource }, update: {} });

  const tx = await postTransaction({
    type: "SUPPLIER_PURCHASE",
    tick,
    kind: "SUPPLIER_BUY",
    enteredBy: s.kind === "volunteer" ? s.vid : s.pid,
    idempotencyKey: `supplier-${supplierCode}-${companyId}-${tick}-${Date.now()}`,
    legs: [
      { accountId: companyVb.id, asset: "VB", amount: -totalCost },
      { accountId: reserveVb.id, asset: "VB", amount: totalCost },
      { accountId: reserveRes.id, asset: supplier.resource, amount: -Number(quantity) },
      { accountId: companyRes.id, asset: supplier.resource, amount: Number(quantity) }
    ]
  });

  return Response.json({ ok: true, txId: tx.id });
}
