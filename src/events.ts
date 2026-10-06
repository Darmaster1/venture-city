import { prisma } from "./db";

type EventPayload = { channel?: string; targetCompanyId?: string; amount?: number };

function payloadOf(value: unknown): EventPayload {
  return value && typeof value === "object" ? value as EventPayload : {};
}

export async function fireTickEvents(tick: number, by: string): Promise<string[]> {
  const log: string[] = [];
  const [cards, participants, companies, tiers] = await Promise.all([
    prisma.eventCrisisCard.findMany({ where: { state: "QUEUED", OR: [{ tick }, { signalTick: tick }] }, orderBy: { code: "asc" } }),
    prisma.participant.findMany({ select: { id: true } }),
    prisma.company.findMany({ where: { active: true }, select: { id: true }, orderBy: { id: "asc" } }),
    prisma.companyTier.findMany({ select: { companyId: true, tier: true } })
  ]);
  for (const card of cards.filter((item) => (item.signalTick ?? Math.max(item.tick - 1, 0)) === tick)) {
    const payload = payloadOf(card.payload);
    const existing = await prisma.signal.findMany({ where: { tick, cardCode: card.code }, select: { holderId: true } });
    const holders = new Set(existing.map((signal) => signal.holderId));
    const missing = participants.filter((participant) => !holders.has(participant.id));
    if (missing.length) await prisma.signal.createMany({ data: missing.map((participant) => ({ tick, cardCode: card.code, holderId: participant.id, channel: payload.channel ?? "whisper" })) });
    log.push(`signal ${card.code} released to ${participants.length} participants`);
  }
  for (const card of cards.filter((item) => item.tick === tick)) {
    const payload = payloadOf(card.payload);
    const targetRule = card.targetRule ?? "";
    const allCompanies = targetRule === "ALL_COMPANIES" || card.visibility === "PUBLIC";
    const tierScore = new Map<string, number>();
    for (const tier of tiers) tierScore.set(tier.companyId, (tierScore.get(tier.companyId) ?? 0) + (["HIGH", "VERY_HIGH"].includes(tier.tier) ? 2 : 1));
    const ranked = [...companies].sort((left, right) => (tierScore.get(right.id) ?? 0) - (tierScore.get(left.id) ?? 0) || left.id.localeCompare(right.id));
    const targetIds = card.kind === "CRISIS" ? (payload.targetCompanyId ? [payload.targetCompanyId] : (allCompanies ? companies.map((company) => company.id) : ranked.slice(0, 1).map((company) => company.id))) : [];
    const targetId = targetIds.length ? targetIds.join(",") : undefined;
    await prisma.deckEntry.create({ data: { tick, cardId: card.id, state: "FIRED", targetId, firedAt: new Date(), createdBy: by } });
    if (card.kind === "CRISIS" && targetIds.length) {
      await prisma.crisisHit.createMany({ data: targetIds.map((companyId) => ({ tick, cardCode: card.code, companyId, amount: Number(payload.amount ?? 0) })), skipDuplicates: true });
    }
    await prisma.eventCrisisCard.update({ where: { id: card.id }, data: { state: "FIRED" } });
    await prisma.auditLog.create({ data: { tick, actor: by, action: card.kind === "CRISIS" ? "CRISIS_FIRED" : "EVENT_FIRED", refType: "EventCrisisCard", refId: card.id } });
    log.push(`${card.kind.toLowerCase()} ${card.code} fired${targetId ? ` at ${targetId}` : ""}`);
  }
  return log;
}
