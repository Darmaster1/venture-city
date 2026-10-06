import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default function Page() {
  return (<div><Navbar /><div className="wrap">
    <PageHero eyebrow="Institution desk" title="Logistics desk" sub="Standard and priority freight across the city." />
    <div className="stat-grid">
      <Stat label="Standard" value="150" sub="base price · next tick" color="#0E9FD8" />
      <Stat label="Priority" value="70" sub="1.5x · immediate" color="#E84FB8" />
      <Stat label="Surge" value="+25%" sub="past 80% booked" color="#E8930C" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #0E9FD8" }}>
      <p>Standard deliveries settle in next tick's step 2. Priority moves now. When 80% of standard capacity is booked, the surge price kicks in automatically.</p>
    </div>
  </div><Footer /></div>);
}
