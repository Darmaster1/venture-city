import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { postTransaction } from "@/src/ledger";

async function participantFrom(req: Request) {
  const match = (req.headers.get("cookie") ?? "").match(/vc_session=([^;]+)/);
  if (!match) return null;
  const session = await verifySession(decodeURIComponent(match[1]));
  if (!session || session.kind !== "participant") return null;
  return prisma.participant.findUnique({ where: { id: session.pid } });
}

export async function POST(req: Request, context: { params: { id: string } }) {
  const participant = await participantFrom(req);
  if (!participant) return Response.json({ error: "Participant login required." }, { status: 401 });
  if (!participant.companyId) return Response.json({ error: "Join a company before claiming a mission." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "claim");
  const mission = await prisma.missionInstance.findUnique({ where: { id: context.params.id } });
  if (!mission) return Response.json({ error: "Mission not found." }, { status: 404 });

  if (action === "claim") {
    if (mission.state !== "OPEN" || mission.holderId) return Response.json({ error: "Mission is no longer available." }, { status: 409 });
    const updated = await prisma.missionInstance.updateMany({
      where: { id: mission.id, state: "OPEN", holderId: null },
      data: { holderId: participant.id, companyId: participant.companyId, state: "CLAIMED" }
    });
    if (updated.count !== 1) return Response.json({ error: "Mission was claimed by another participant." }, { status: 409 });
    return Response.json({ ok: true, state: "CLAIMED" });
  }

  if (action !== "complete" || mission.holderId !== participant.id || !["OPEN", "CLAIMED"].includes(mission.state))
    return Response.json({ error: "You cannot complete this mission." }, { status: 403 });
  const card = await prisma.missionCard.findUnique({ where: { code: mission.missionId } });
  if (!card) return Response.json({ error: "Mission card not found." }, { status: 404 });
  const wallet = await prisma.account.upsert({
    where: { ownerType_ownerId_label: { ownerType: "PARTICIPANT", ownerId: participant.id, label: "VB" } },
    create: { ownerType: "PARTICIPANT", ownerId: participant.id, label: "VB", createdBy: participant.id },
    update: {}
  });
  const reserve = await prisma.account.upsert({
    where: { ownerType_ownerId_label: { ownerType: "RESERVE", ownerId: "MISSION_REWARDS", label: "VB" } },
    create: { ownerType: "RESERVE", ownerId: "MISSION_REWARDS", label: "VB", createdBy: "system" },
    update: {}
  });
  await postTransaction({
    type: "MISSION_REWARD", tick: (await prisma.run.findFirst({ orderBy: { date: "desc" }, select: { currentTick: true } }))?.currentTick ?? 0,
    kind: "MISSION_REWARD", enteredBy: participant.id, refType: "MissionInstance", refId: mission.id,
    idempotencyKey: `mission-reward-${mission.id}`, legs: [{ accountId: reserve.id, asset: "VB", amount: -card.reward }, { accountId: wallet.id, asset: "VB", amount: card.reward }]
  });
  const result = await prisma.missionInstance.updateMany({
    where: { id: mission.id, holderId: participant.id, state: { in: ["OPEN", "CLAIMED"] } },
    data: { state: "COMPLETED" }
  });
  if (result.count !== 1) return Response.json({ error: "Mission is already completed." }, { status: 409 });
  return Response.json({ ok: true, state: "COMPLETED", reward: card.reward });
}