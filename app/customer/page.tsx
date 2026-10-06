import { prisma } from "@/src/db";
import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const cards = await prisma.customerCard.findMany({ take: 40 });
  const open = cards.filter((c) => !c.heldBack);
  return (<div><Navbar /><div className="wrap">
    <PageHero eyebrow="Institution desk" title="Customer desk" sub="Award cards, accept pilots and deliveries, renew anchors at Tick 6." />
    <div className="stat-grid">
      <Stat label="Open cards" value={String(open.length)} color="#0E9FD8" />
      <Stat label="Pipeline value" value={`${open.reduce((s, c) => s + c.ratePerTick * c.ticks, 0).toLocaleString("en-IN")} VB`} color="#2F855A" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #0E9FD8" }}>
      <table className="vc"><thead><tr><th>Code</th><th>Title</th><th>Buyer</th><th className="num">Rate</th><th className="num">Ticks</th><th className="num">Decide</th></tr></thead>
        <tbody>{open.map((c) => <tr key={c.id}><td className="mono">{c.code}</td><td>{c.title}</td><td>{c.assignee ?? "open"}</td><td className="num">{c.ratePerTick.toLocaleString("en-IN")}</td><td className="num">{c.ticks}</td><td className="num">{c.decideBy ?? "–"}</td></tr>)}</tbody>
      </table>
    </div>
  </div><Footer /></div>);
}
