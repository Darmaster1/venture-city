import { PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { pct } from "./rounding";

export type Asset = string; // VB | COMPUTE | ENERGY | LOGISTICS | MATERIALS | DATA | INFRA
export type Leg = { accountId: string; asset: Asset; amount: number };
export type PostTxInput = {
  type: string; tick: number; kind: string; enteredBy: string;
  legs: Leg[]; refType?: string; refId?: string; paperFormNo?: string;
  stepNo?: number; idempotencyKey?: string; reason?: string; desk?: string;
  signerIds?: string[]; totalVB?: number; floorCheck?: { amount: number; floor: number };
};

async function balances(client: PrismaClient | Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">, accountId: string, asset: string): Promise<number> {
  const rows = await (client as PrismaClient).journalEntry.aggregate({
    where: { accountId, asset }, _sum: { amount: true }
  });
  return rows._sum.amount ?? 0;
}

export async function balance(accountId: string, asset: Asset): Promise<number> {
  return balances(prisma, accountId, asset);
}

export async function available(accountId: string, asset: Asset): Promise<number> {
  // reserved = escrow holds not yet released; simplified: sum ESCROW_HOLD kinds held
  const bal = await balance(accountId, asset);
  const held = await prisma.journalEntry.aggregate({
    where: { accountId, asset, kind: "ESCROW_HOLD" }, _sum: { amount: true }
  });
  return bal + (held._sum.amount ?? 0); // holds are negative legs on the account
}

export async function postTransaction(input: PostTxInput, ext?: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0] extends never ? never : unknown): Promise<{ id: string }> {
  // Accept optional Prisma tx client via (client as any)
  const client: PrismaClient = (ext as PrismaClient) ?? prisma;
  // Idempotency
  if (input.idempotencyKey) {
    const existing = await client.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return { id: existing.id };
  }
  // 1. Balanced per asset
  const sums = new Map<string, number>();
  for (const l of input.legs) sums.set(l.asset, (sums.get(l.asset) ?? 0) + l.amount);
  for (const [a, s] of sums) {
    if (s !== 0) throw new Error(`Unbalanced transaction for asset ${a}: sum=${s}`);
  }
  if (input.legs.length < 2) throw new Error("Transaction needs at least 2 legs");
  // 6. Floor price
  if (input.floorCheck && input.floorCheck.amount < input.floorCheck.floor)
    throw new Error(`Floor price violated: ${input.floorCheck.amount} < ${input.floorCheck.floor}`);
  // 5. Signer authority is checked by caller via signerIds + totalVB; enforce here:
  if ((input.totalVB ?? 0) > 5000 && (!input.signerIds || input.signerIds.length < 1))
    throw new Error("Above 5000 VB needs CEO or both signatories");
  return await client.$transaction(async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.transaction.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return { id: existing.id };
    }
    // 2. Spender covers debit legs (check available using tx)
    for (const l of input.legs) {
      if (l.amount < 0) {
        const account = await tx.account.findUnique({ where: { id: l.accountId }, select: { ownerType: true } });
        if (account?.ownerType === "RESERVE") continue;
        const rows = await tx.journalEntry.aggregate({ where: { accountId: l.accountId, asset: l.asset }, _sum: { amount: true } });
        const bal = rows._sum.amount ?? 0;
        if (bal + l.amount < 0) throw new Error(`Insufficient balance: account ${l.accountId} asset ${l.asset} has ${bal}, needs ${-l.amount}`);
      }
    }
    const t = await tx.transaction.create({
      data: {
        type: input.type, status: "SETTLED", proposedTick: input.tick,
        desk: input.desk, paperFormNo: input.paperFormNo, reason: input.reason,
        idempotencyKey: input.idempotencyKey, createdBy: input.enteredBy,
        signerIds: input.signerIds ?? undefined
      }
    });
    for (const l of input.legs) {
      await tx.journalEntry.create({
        data: {
          txId: t.id, tick: input.tick, accountId: l.accountId, asset: l.asset,
          amount: l.amount, kind: input.kind, refType: input.refType, refId: input.refId,
          paperFormNo: input.paperFormNo, enteredBy: input.enteredBy, stepNo: input.stepNo
        }
      });
    }
    return { id: t.id };
  });
}

export async function reverseTransaction(txId: string, reason: string, enteredBy: string, tick = 0): Promise<{ id: string }> {
  const lines = await prisma.journalEntry.findMany({ where: { txId } });
  if (!lines.length) throw new Error("Original transaction not found");
  const legs: Leg[] = lines.map((l) => ({ accountId: l.accountId, asset: l.asset, amount: -l.amount }));
  return postTransaction({
    type: "REVERSAL", tick, kind: "REVERSAL", enteredBy, legs,
    refType: "Transaction", refId: txId, reason
  });
}

export async function escrowHold(accountId: string, asset: Asset, amount: number, reason: string): Promise<{ id: string }> {
  const escrow = `ESCROW:${accountId}`;
  let acc = await prisma.account.findFirst({ where: { ownerType: "ESCROW", ownerId: accountId, label: asset } });
  if (!acc) acc = await prisma.account.create({ data: { ownerType: "ESCROW", ownerId: accountId, label: asset, createdBy: "system" } });
  return postTransaction({ type: "ESCROW_HOLD", tick: 0, kind: "ESCROW_HOLD", enteredBy: "system", legs: [{ accountId, asset, amount: -amount }, { accountId: acc.id, asset, amount }], reason });
}

export async function escrowRelease(escrowAccountId: string, toAccountId: string, asset: Asset, amount: number, reason: string): Promise<{ id: string }> {
  return postTransaction({ type: "ESCROW_RELEASE", tick: 0, kind: "ESCROW_RELEASE", enteredBy: "system", legs: [{ accountId: escrowAccountId, asset, amount: -amount }, { accountId: toAccountId, asset, amount }], reason });
}

export { pct };
