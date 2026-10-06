import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

async function sessionFrom(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(/vc_session=([^;]+)/);
  return match ? verifySession(decodeURIComponent(match[1])) : null;
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const session = await sessionFrom(req);
  if (!session) return Response.json({ error: "Login required." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const sheet = await prisma.dealSheet.findUnique({ where: { id: context.params.id } });
  if (!sheet) return Response.json({ error: "Deal Sheet not found." }, { status: 404 });
  if (action === "sign") {
    if (sheet.state !== "SENT_FOR_SIGNATURES") return Response.json({ error: "This Deal Sheet is not awaiting signatures." }, { status: 409 });
    if (session.kind !== "participant" || session.pid !== String(body.signerId)) return Response.json({ error: "The signed-in participant must sign personally." }, { status: 403 });
    const signature = await prisma.dealSignature.findUnique({ where: { dealSheetId_signerId: { dealSheetId: sheet.id, signerId: session.pid } } });
    if (!signature) return Response.json({ error: "You are not an assigned signatory for this sheet." }, { status: 403 });
    await prisma.dealSignature.update({ where: { id: signature.id }, data: { state: "SIGNED", signedAt: new Date() } });
    const pending = await prisma.dealSignature.count({ where: { dealSheetId: sheet.id, state: "PENDING" } });
    const updated = await prisma.dealSheet.update({ where: { id: sheet.id }, data: pending === 0 ? { state: "SIGNED", signedAt: new Date() } : {} });
    return Response.json({ ok: true, state: updated.state });
  }
  if (action === "void") {
    if (session.kind !== "volunteer" || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(session.role)) return Response.json({ error: "GM approval required." }, { status: 403 });
    const updated = await prisma.dealSheet.update({ where: { id: sheet.id }, data: { state: "VOID" } });
    return Response.json({ ok: true, state: updated.state });
  }
  return Response.json({ error: "Action must be sign or void." }, { status: 400 });
}
