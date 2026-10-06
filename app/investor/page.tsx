import { prisma } from "@/src/db";
import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  const sheets = await prisma.termSheet.findMany({ take: 50 });
  const fund = 140000, used = sheets.reduce((s, t) => s + t.amount, 0);
  const open = (run?.currentTick ?? 0) >= 8;
  return (<div><Navbar /><div className="wrap">
    <PageHero eyebrow="Institution desk" title="Investor desk" sub="Seed to growth tickets, thesis-fit ceilings, co-investment. Window opens Tick 8." />
    <div className="stat-grid">
      <Stat label="Fund left" value={`${(fund - used).toLocaleString("en-IN")} VB`} sub={`of ${fund.toLocaleString("en-IN")}`} color="#6C3DF4" />
      <Stat label="Deals" value={`${sheets.length} / 7`} color="#E84FB8" />
      <Stat label="Window" value={open ? "OPEN" : "Tick 8"} color="#2F855A" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #E84FB8" }}>
      <div className="label">Term sheets</div>
      <table className="vc"><thead><tr><th>Company</th><th>Product</th><th className="num">Amount</th><th>State</th></tr></thead>
        <tbody>{sheets.length ? sheets.map((t) => <tr key={t.id}><td>{t.companyId}</td><td>{t.product}</td><td className="num">{t.amount.toLocaleString("en-IN")} VB</td><td><span className="badge info">{t.state}</span></td></tr>) : <tr><td colSpan={4}>No term sheets yet — the window opens at Tick 8.</td></tr>}</tbody>
      </table>
    </div>
  </div><Footer /></div>);
}
