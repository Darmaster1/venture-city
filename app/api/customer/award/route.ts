export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const { cardCode, winnerCompanyId } = b;
  if (!cardCode || !winnerCompanyId) {
    return Response.json({ error: "Card code and winner company are required." }, { status: 400 });
  }

  const card = await prisma.customerCard.findUnique({ where: { code: String(cardCode) } });
  if (!card) return Response.json({ error: "Customer card not found." }, { status: 404 });

  const updated = await prisma.customerCard.update({
    where: { code: String(cardCode) },
    data: { assignee: String(winnerCompanyId) }
  });

  return Response.json({ ok: true, card: updated });
}
