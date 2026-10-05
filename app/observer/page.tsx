"use client";
import { Navbar, Footer, Stat } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default function Page() {
  return (<div><Navbar /><div className="wrap">
    <h1 className="page-title">Observer deck</h1>
    <p className="page-sub">Watch zones, file observation cards, flag moments. Observer eyes only.</p>
    <div className="stat-grid">
      <Stat label="Zones" value="4" color="#6C3DF4" />
      <Stat label="Flagged moments" value="0" color="#E8930C" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
      <div className="label">New observation card</div>
      <form onSubmit={(e) => e.preventDefault()}>
        <label className="f">Zone</label><input placeholder="e.g. North tables" />
        <label className="f">Participant</label><input placeholder="Badge number" />
        <label className="f">Look-for flags</label><input placeholder="e.g. deal-making, confusion, standout play" />
        <div style={{ marginTop: 12 }}><button className="btn btn-primary" type="submit" style={{ height: 44 }}>File card</button></div>
      </form>
    </div>
    <div className="card">
      <div className="label">System-flagged moments</div>
      <p style={{ color: "var(--fg-muted)" }}>Nothing flagged yet. Big swings, distress entries and viral stories land here automatically.</p>
    </div>
  </div><Footer /></div>);
}
