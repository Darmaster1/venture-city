import { prisma } from "@/src/db";
import BankClient from "./BankClient";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function BankPage() {
  try {
    const [resources, products] = await Promise.all([prisma.resource.findMany(), prisma.bankProduct.findMany()]);
    return <BankClient resources={resources} products={products} />;
  } catch {
    return <BankClient resources={[]} products={[]} error="Bank data is temporarily unavailable. Check the database connection and retry." />;
  }
}
