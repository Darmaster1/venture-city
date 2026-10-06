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
  const { productCode, companyId } = b;
  if (!productCode || !companyId) {
    return Response.json({ error: "Product code and company ID required." }, { status: 400 });
  }

  const prod = await prisma.mediaProduct.findUnique({ where: { code: String(productCode) } });
  if (!prod) return Response.json({ error: "Media product not found." }, { status: 404 });

  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const tick = run?.currentTick ?? 0;

  if (prod.price > 0) {
    const companyAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" } }, create: { ownerType: "COMPANY", ownerId: String(companyId), label: "VB" }, update: {} });
    const reserveAcct = await prisma.account.upsert({ where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" } }, create: { ownerType: "RESERVE", ownerId: "CITY", label: "VB" }, update: {} });

    const tx = await postTransaction({
      type: "MEDIA_PURCHASE",
      tick,
      kind: "MEDIA_FEE",
      enteredBy: s.kind === "volunteer" ? s.vid : s.pid,
      idempotencyKey: `media-${productCode}-${companyId}-${tick}-${Date.now()}`,
      legs: [
        { accountId: companyAcct.id, asset: "VB", amount: -prod.price },
        { accountId: reserveAcct.id, asset: "VB", amount: prod.price }
      ]
    });
    return Response.json({ ok: true, txId: tx.id });
  }

  return Response.json({ ok: true, note: "Free media placement registered." });
}
