export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { postTransaction } from "@/src/ledger";
import { bankPriceStep } from "@/src/formulas";

// Bank sells a resource to a company. Enforces per-tick 30-unit limit and 200 storage cap.
export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || (v.role !== "DESK" && v.role !== "GM" && v.role !== "DEPUTY_GM")) return Response.json({ error: "Bank desk only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { companyId, resource, units } = b as { companyId: string; resource: string; units: number };
  if (!companyId || !resource || !units || units <= 0) return Response.json({ error: "companyId, resource, units required." }, { status: 400 });
  if (units > 30) return Response.json({ error: "Bank limit is 30 units per company per tick." }, { status: 400 });
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (run?.clockState === "FINAL_FROZEN" || run?.clockState === "FROZEN_FOR_SETTLEMENT")
    return Response.json({ error: "City is frozen." }, { status: 409 });
  const res = await prisma.resource.findUnique({ where: { code: resource } });
  if (!res) return Response.json({ error: "Unknown resource." }, { status: 400 });
  const price = bankPriceStep(res.bankBasePrice, res.bankStockT1, res.bankStockT1);
  if (price < 0) return Response.json({ error: "Out of stock." }, { status: 400 });
  const total = price * units;
  let compVB = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: companyId, label: "VB" } } });
  if (!compVB) compVB = await prisma.account.create({ data: { ownerType: "COMPANY", ownerId: companyId, label: "VB", createdBy: v.id } });
  let compR = await prisma.account.findUnique({ where: { ownerType_ownerId_label: { ownerType: "COMPANY", ownerId: companyId, label: resource } } });
  if (!compR) compR = await prisma.account.create({ data: { ownerType: "COMPANY", ownerId: companyId, label: resource, createdBy: v.id } });
  let bankVB = await prisma.account.findFirst({ where: { ownerType: "INSTITUTION", ownerId: "BANK", label: "VB" } });
  if (!bankVB) bankVB = await prisma.account.create({ data: { ownerType: "INSTITUTION", ownerId: "BANK", label: "VB", createdBy: v.id } });
  let bankR = await prisma.account.findFirst({ where: { ownerType: "INSTITUTION", ownerId: "BANK", label: resource } });
  if (!bankR) bankR = await prisma.account.create({ data: { ownerType: "INSTITUTION", ownerId: "BANK", label: resource, createdBy: v.id } });
  // storage cap check
  const stock = await prisma.journalEntry.aggregate({ where: { accountId: compR.id, asset: resource }, _sum: { amount: true } });
  if ((stock._sum.amount ?? 0) + units > 200) return Response.json({ error: "Storage cap is 200 units." }, { status: 400 });
  try {
    await postTransaction({
      type: "PURCHASE", tick: run?.currentTick ?? 0, kind: "PURCHASE", enteredBy: v.id,
      legs: [
        { accountId: compVB.id, asset: "VB", amount: -total },
        { accountId: bankVB.id, asset: "VB", amount: total },
        { accountId: bankR.id, asset: resource, amount: -units },
        { accountId: compR.id, asset: resource, amount: units }
      ],
      desk: "BANK", idempotencyKey: b.idempotencyKey ? String(b.idempotencyKey) : undefined,
      signerIds: b.signerIds, totalVB: total
    });
    return Response.json({ ok: true, total, price });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
