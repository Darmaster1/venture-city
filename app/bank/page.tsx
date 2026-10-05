import { prisma } from "@/src/db";
import BankClient from "./BankClient";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function BankPage() {
  const resources = await prisma.resource.findMany();
  const products = await prisma.bankProduct.findMany();
  return <BankClient resources={resources} products={products} />;
}
