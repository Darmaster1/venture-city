import { prisma } from "@/src/db";
import { Navbar, Footer, Stat } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const lines = await prisma.supplierLine.findMany();
  const std = lines.filter((l) => l.kind === "STANDARD");
  return (<div><Navbar /><div className="wrap">
    <h1 className="page-title">Supplier market</h1>
    <p className="page-sub">Standard lines and spot alternatives. T0 agreements lapse at Tick 4 unless renewed.</p>
    <div className="stat-grid">
      <Stat label="Standard lines" value={String(std.length)} color="#C25E2B" />
      <Stat label="Alternatives" value={String(lines.length - std.length)} color="#6C3DF4" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #C25E2B" }}>
      <table className="vc"><thead><tr><th>Code</th><th>Name</th><th>Resource</th><th className="num">Price</th><th className="num">Min</th><th>Terms</th></tr></thead>
        <tbody>{lines.map((l) => <tr key={l.id}><td className="mono">{l.code}</td><td>{l.name}</td><td><span className="badge info">{l.resource}</span></td><td className="num">{l.price}</td><td className="num">{l.minOrder}</td><td>{l.terms}</td></tr>)}</tbody>
      </table>
    </div>
  </div><Footer /></div>);
}
