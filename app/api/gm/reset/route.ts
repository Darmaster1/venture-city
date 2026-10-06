export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession, hashSecret } from "@/src/auth";
import { randomBytes } from "crypto";
import { seed } from "@/src/seed";

// Full game tables wiped on reset. Volunteers are NEVER deleted here
// (gm-1 must survive with its password); other volunteers get fresh secrets.
const WIPED = [
  "journalEntry", "transaction", "contractLine", "contract", "loan",
  "reliabilityEvent", "shareHolding", "termSheet", "productionOrder", "companyTick",
  "employment", "participant", "companyTier", "requiredSeat", "productCard", "notableAsset",
  "company", "account", "customerCard", "customerCardInstance", "supplierLine",
  "bankProduct", "investorProduct", "licence", "grant", "tender", "regInstrument",
  "mediaProduct", "mediaOutlet", "licenceHolding", "missionCard", "missionInstance",
  "opportunityCard", "opportunityInstance", "eventCrisisCard", "deckEntry", "signal",
  "crisisHit", "auctionLot", "bid", "infoCard", "infoHolding", "infoTrade",
  "infoVerification", "broker", "whisperLog", "objectiveTemplate", "objectiveAssignment",
  "founderEntry", "ruling", "incident", "auditLog", "snapshot", "decisionCard",
  "talentIndex", "param", "slot", "sectorTag", "tick", "run", "resource", "settlementLock"
];

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const g = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!g || g.role !== "GM") return Response.json({ error: "GM only." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== "RESET") return Response.json({ error: 'Type RESET to confirm. This wipes all game data.' }, { status: 400 });

  for (const t of WIPED) {
    try {
      await (prisma as unknown as Record<string, { deleteMany: () => Promise<unknown> }>)[t].deleteMany();
    } catch (e) {
      return Response.json({ error: `Reset failed at ${t}: ${(e as Error).message}` }, { status: 500 });
    }
  }
  await seed();

  // Fresh secrets for every volunteer except gm-1 (returned once).
  const crew = await prisma.volunteer.findMany({ orderBy: { name: "asc" } });
  const out: Array<{ id: string; name: string; role: string; deskOrCompany: string | null; secret: string | null }> = [];
  for (const v of crew) {
    if (v.id === "gm-1") {
      out.push({ id: v.id, name: v.name, role: v.role, deskOrCompany: v.deskOrCompany, secret: null });
      continue;
    }
    const secret = randomBytes(9).toString("hex");
    await prisma.volunteer.update({ where: { id: v.id }, data: { loginSecretHash: hashSecret(secret) } });
    out.push({ id: v.id, name: v.name, role: v.role, deskOrCompany: v.deskOrCompany, secret });
  }
  await prisma.auditLog.create({ data: { actor: g.id, action: "RESET", tick: 0 } });
  return Response.json({ ok: true, tick: 0, crew: out, note: "gm-1 password unchanged. All other volunteer secrets above are new — copy them now." });
}
