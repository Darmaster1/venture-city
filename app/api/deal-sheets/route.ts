import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { randomBytes } from "crypto";

async function sessionFrom(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(/vc_session=([^;]+)/);
  return match ? verifySession(decodeURIComponent(match[1])) : null;
}

function canUseDesk(session: Awaited<ReturnType<typeof sessionFrom>>) {
  return session?.kind === "volunteer" && ["DESK", "GM", "DEPUTY_GM", "TECH_LEAD"].includes(session.role);
}

export async function GET(req: Request) {
  const session = await sessionFrom(req);
  if (!session) return Response.json({ error: "Login required." }, { status: 401 });
  const url = new URL(req.url);
  const companyId = url.searchParams.get("companyId");
  let scopedCompanyId = companyId;
  if (session.kind === "participant") {
    const participant = await prisma.participant.findUnique({ where: { id: session.pid }, select: { companyId: true } });
    if (!participant?.companyId) return Response.json({ sheets: [] });
    scopedCompanyId = participant.companyId;
  }
  const sheets = await prisma.dealSheet.findMany({
    where: scopedCompanyId ? { OR: [{ sellerId: scopedCompanyId }, { buyerId: scopedCompanyId }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100
  });
  const signatures = await prisma.dealSignature.findMany({ where: { dealSheetId: { in: sheets.map((s) => s.id) } } });
  return Response.json({ sheets: sheets.map((sheet) => ({ ...sheet, signatures: signatures.filter((signature) => signature.dealSheetId === sheet.id) })) });
}

export async function POST(req: Request) {
  const session = await sessionFrom(req);
  if (!session || session.kind !== "volunteer" || !canUseDesk(session)) return Response.json({ error: "Desk or GM login required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const sellerId = String(body.sellerId ?? "");
  const buyerId = String(body.buyerId ?? "");
  const product = String(body.product ?? "").trim();
  const units = Number(body.units);
  const pricePerUnit = Number(body.pricePerUnit);
  const floorPrice = Number(body.floorPrice);
  const startTick = Number(body.startTick ?? 1);
  const endTick = Number(body.endTick ?? startTick);
  const signerIds = Array.isArray(body.signerIds) ? body.signerIds.map(String) : [];
  if (!sellerId || !buyerId || sellerId === buyerId || !product || !Number.isInteger(units) || units <= 0 || !Number.isInteger(pricePerUnit) || !Number.isInteger(floorPrice))
    return Response.json({ error: "Seller, buyer, product, positive units, price, and floor price are required." }, { status: 400 });
  if (pricePerUnit < floorPrice) return Response.json({ error: "Price is below the declared floor price." }, { status: 400 });
  if (floorPrice < 0 || startTick < 1 || endTick < startTick || endTick > 10) return Response.json({ error: "Invalid floor price or tick window." }, { status: 400 });
  if (signerIds.length !== 2 || new Set(signerIds).size !== 2) return Response.json({ error: "Exactly two distinct signatories are required." }, { status: 400 });
  const participants = await prisma.participant.findMany({ where: { id: { in: signerIds }, isSignatory: true } });
  const byCompany = new Map(participants.map((participant) => [participant.companyId, participant]));
  if (participants.length !== 2 || !byCompany.has(sellerId) || !byCompany.has(buyerId))
    return Response.json({ error: "Each company must provide one registered signatory." }, { status: 400 });
  const seller = await prisma.company.findUnique({ where: { id: sellerId } });
  const buyer = await prisma.company.findUnique({ where: { id: buyerId } });
  if (!seller || !buyer) return Response.json({ error: "Unknown company." }, { status: 400 });
  const sheet = await prisma.dealSheet.create({
    data: {
      code: `DS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(3).toString("hex").toUpperCase()}`,
      lane: String(body.lane ?? "TRADE"), type: String(body.type ?? "SPOT"), sellerId, buyerId, product, units,
      pricePerUnit, floorPrice, startTick, endTick, settlement: String(body.settlement ?? "UPFRONT"), state: "SENT_FOR_SIGNATURES",
      note: body.note ? String(body.note) : undefined, createdBy: session.vid, sentAt: new Date()
    }
  });
  await prisma.dealSignature.createMany({ data: participants.map((participant) => ({ dealSheetId: sheet.id, signerId: participant.id, companyId: participant.companyId!, role: "SIGNATORY" })) });
  return Response.json({ ok: true, sheet }, { status: 201 });
}
