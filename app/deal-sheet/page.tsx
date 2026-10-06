import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DealSheetClient from "./DealSheetClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function DealSheetPage() {
  const token = cookies().get("vc_session")?.value;
  const session = token ? await verifySession(token) : null;
  if (!session || session.kind !== "volunteer") redirect("/login");
  const volunteer = await prisma.volunteer.findUnique({ where: { id: session.vid }, select: { role: true } });
  if (!volunteer || !["DESK", "GM", "DEPUTY_GM", "TECH_LEAD"].includes(volunteer.role)) redirect("/login");
  const [companies, signatories, sheets] = await Promise.all([
    prisma.company.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true } }),
    prisma.participant.findMany({ where: { isSignatory: true }, orderBy: { companyId: "asc" }, select: { id: true, name: true, companyId: true } }),
    prisma.dealSheet.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  ]);
  const signatures = await prisma.dealSignature.findMany({ where: { dealSheetId: { in: sheets.map((sheet) => sheet.id) } } });
  return <DealSheetClient companies={companies} signatories={signatories} sheets={sheets.map((sheet) => ({ ...sheet, signatures: signatures.filter((signature) => signature.dealSheetId === sheet.id) }))} />;
}
