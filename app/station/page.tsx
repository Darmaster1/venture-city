import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { canReadCompany } from "@/src/policy";
import { Navbar, Footer, Stat, CoDot, HeroOrbs } from "@/src/components/chrome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RES_COLORS: Record<string, string> = { COMPUTE: "#6C3DF4", ENERGY: "#FFB020", LOGISTICS: "#0E9FD8", MATERIALS: "#C25E2B", DATA: "#E84FB8", INFRA: "#2F855A" };

export default async function StationPage() {
  const tok = cookies().get("vc_session")?.value;
  const s = tok ? await verifySession(tok) : null;
  if (!s || s.kind !== "participant") redirect("/login");
  const p = await prisma.participant.findUnique({ where: { id: s.pid } });
  if (!p?.companyId) return <div><Navbar /><div className="wrap">No company assigned.</div><Footer /></div>;
  const viewer = { role: "COMPANY_STAFF" as const, participantId: p.id, companyId: p.companyId };
  if (!canReadCompany(viewer, p.companyId)) return <div><Navbar /><div className="wrap">Not allowed.</div><Footer /></div>;
  const co = await prisma.company.findUnique({ where: { id: p.companyId } });
  const accs = await prisma.account.findMany({ where: { ownerType: "COMPANY", ownerId: p.companyId } });
  const bals: Record<string, number> = {};
  for (const a of accs) {
    const agg = await prisma.journalEntry.aggregate({ where: { accountId: a.id, asset: a.label }, _sum: { amount: true } });
    bals[a.label] = agg._sum.amount ?? 0;
  }
  const staff = await prisma.employment.findMany({ where: { companyId: p.companyId, state: "ACTIVE" } });
  const contracts = await prisma.contract.findMany({ where: { OR: [{ sellerId: p.companyId }, { buyerId: p.companyId }], state: "ACTIVE" } });
  const tick = await prisma.companyTick.findFirst({ where: { companyId: p.companyId }, orderBy: { tick: "desc" } });
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <div className="hero" style={{ padding: "36px 32px" }}>
          <HeroOrbs />
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>Company station · <span className="badge vip">{co?.lifecycle}</span></div>
          <h1 style={{ fontSize: 42 }}><CoDot id={co?.id ?? ""} />{co?.name}</h1>
          <p>Reportable value {tick?.rv ?? "–"} VB · everything below is live from the journal.</p>
        </div>
        <div className="stat-grid">
          <Stat label="Cash" value={`${(bals.VB ?? 0).toLocaleString("en-IN")} VB`} color="#2F855A" />
          <Stat label="Runway" value={String(tick?.runway ?? "–")} sub="ticks" color="#0E9FD8" />
          <Stat label="Workforce capital" value={String(tick?.wc ?? "–")} color="#6C3DF4" />
          <Stat label="Credit grade" value={tick?.creditGrade ?? "B"} color="#E84FB8" />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="label">Resources · stock / 200</div>
            <table className="vc"><thead><tr><th>Resource</th><th className="num">Stock</th></tr></thead>
              <tbody>{["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"].map((r) => (
                <tr key={r}><td><span className="co-dot" style={{ background: RES_COLORS[r] }} />{r}</td><td className="num">{bals[r] ?? 0} / 200</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="card">
            <div className="label">People ({staff.length})</div>
            <table className="vc"><thead><tr><th>Role</th><th>Domain</th><th className="num">Salary</th></tr></thead>
              <tbody>{staff.map((e) => <tr key={e.id}><td>{e.role}</td><td>{e.domain}</td><td className="num">{e.salary} VB</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="label">Active contracts ({contracts.length})</div>
          <table className="vc"><thead><tr><th>ID</th><th>Type</th><th>Window</th><th>State</th></tr></thead>
            <tbody>{contracts.length ? contracts.map((c) => <tr key={c.id}><td className="mono">{c.id.slice(0, 8)}</td><td>{c.type}</td><td className="num">T{c.startTick}–T{c.endTick}</td><td><span className="badge op">{c.state}</span></td></tr>) : <tr><td colSpan={4}>No contracts yet.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
}
