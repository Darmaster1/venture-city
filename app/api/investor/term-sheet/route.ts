export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { companyId, product, amount } = b;
  if (!companyId || !product || !amount || Number(amount) <= 0) {
    return Response.json({ error: "Invalid term sheet details." }, { status: 400 });
  }

  const sheet = await prisma.termSheet.create({
    data: {
      companyId: String(companyId),
      product: String(product),
      amount: Number(amount),
      sponsorPartner: s.vid,
      rvAtSigning: 0,
      preMoney: 100000,
      multiple: 1.0,
      pricePerShare: 1.0,
      newShares: Number(amount),
      expiresTick: 10,
      state: "PROPOSED",
      createdBy: s.vid
    }
  });

  return Response.json({ ok: true, sheet });
}
