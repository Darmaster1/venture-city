import { prisma } from "@/src/db";
import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default async function Page() {
  const idx = await prisma.talentIndex.findMany({ take: 20 });
  return (<div><Navbar /><div className="wrap">
    <PageHero eyebrow="Institution desk" title="Talent exchange" sub="Specialist contracts — one per company at a time, min 2 ticks." />
    <div className="stat-grid">
      <Stat label="Fee formula" value="400 × idx" sub="/ 100 per tick" color="#6C3DF4" />
      <Stat label="Open contracts" value="10" color="#0E9FD8" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
      <div className="label">Index by domain</div>
      {idx.length ? idx.map((i) => <div key={i.id} className="mono" style={{ padding: "4px 0" }}>{i.domain} · T{i.tick} · {i.index}</div>) : <p style={{ color: "var(--fg-muted)" }}>Index seeds at Market Open.</p>}
    </div>
  </div><Footer /></div>);
}
