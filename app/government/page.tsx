import { prisma } from "@/src/db";
import { Navbar, Footer, Stat } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const lic = await prisma.licence.findMany(); const grants = await prisma.grant.findMany(); const tenders = await prisma.tender.findMany();
  return (<div><Navbar /><div className="wrap">
    <h1 className="page-title">Government desk</h1>
    <p className="page-sub">Licences in arrival order — 3 decisions per tick. Grants pool 30,000 VB.</p>
    <div className="stat-grid">
      <Stat label="Licences" value={String(lic.length)} color="#2F855A" />
      <Stat label="Grant pool" value="30,000 VB" sub="window T5–6" color="#E8930C" />
      <Stat label="Tenders" value={String(tenders.length)} color="#6C3DF4" />
    </div>
    <div className="grid-2">
      <div className="card" style={{ borderTop: "5px solid #2F855A" }}>
        <div className="label">Licences</div>
        <table className="vc"><thead><tr><th>Code</th><th>Name</th><th className="num">Fee</th></tr></thead>
          <tbody>{lic.map((l) => <tr key={l.id}><td className="mono">{l.code}</td><td>{l.name}</td><td className="num">{l.fee.toLocaleString("en-IN")}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="card" style={{ borderTop: "5px solid #E8930C" }}>
        <div className="label">Grants</div>
        <table className="vc"><tbody>{grants.map((g) => <tr key={g.id}><td className="mono">{g.code}</td><td>{g.name}</td><td className="num">{g.maxAmt.toLocaleString("en-IN")}</td></tr>)}</tbody></table>
        <div className="label" style={{ marginTop: 14 }}>Tenders</div>
        <table className="vc"><tbody>{tenders.map((t) => <tr key={t.id}><td className="mono">{t.code}</td><td>{t.name}</td><td className="num">{t.value.toLocaleString("en-IN")}</td></tr>)}</tbody></table>
      </div>
    </div>
  </div><Footer /></div>);
}
