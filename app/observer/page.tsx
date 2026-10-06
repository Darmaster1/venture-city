"use client";
import { useEffect, useState } from "react";
import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export default function Page() {
  const [form, setForm] = useState({ zone: "", participant: "", flags: "" });
  const [observations, setObservations] = useState<Array<{ id: string; tick: number; text: string; severity: string }>>([]);
  const [message, setMessage] = useState("");
  const load = () => fetch("/api/observer/observation").then((response) => response.json()).then((json) => setObservations(json.observations ?? [])).catch(() => setMessage("Could not load observation cards."));
  useEffect(() => { load(); }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/observer/observation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const json = await response.json();
    if (!response.ok) { setMessage(json.error ?? "Could not file card."); return; }
    setMessage("Observation filed."); setForm({ zone: "", participant: "", flags: "" }); load();
  }
  return (<div><Navbar /><div className="wrap">
    <PageHero eyebrow="Crew" title="Observer deck" sub="Watch zones, file observation cards, flag moments. Observer eyes only." />
    <div className="stat-grid">
      <Stat label="Zones" value="4" color="#6C3DF4" />
      <Stat label="Flagged moments" value={String(observations.length)} color="#E8930C" />
    </div>
    <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
      <div className="label">New observation card</div>
      <form onSubmit={submit}>
        <label className="f" htmlFor="observation-zone">Zone</label><input id="observation-zone" required value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} placeholder="e.g. North tables" />
        <label className="f" htmlFor="observation-participant">Participant</label><input id="observation-participant" required value={form.participant} onChange={(event) => setForm({ ...form, participant: event.target.value })} placeholder="Badge number" />
        <label className="f" htmlFor="observation-flags">Look-for flags</label><input id="observation-flags" required value={form.flags} onChange={(event) => setForm({ ...form, flags: event.target.value })} placeholder="e.g. deal-making, confusion, standout play" />
        <div style={{ marginTop: 12 }}><button className="btn btn-primary" type="submit" style={{ height: 44 }}>File card</button></div>
      </form>
      <p aria-live="polite"><b>{message}</b></p>
    </div>
    <div className="card">
      <div className="label">System-flagged moments</div>
      {observations.length ? observations.map((observation) => <p key={observation.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>T{observation.tick} · {observation.text}</p>) : <p style={{ color: "var(--fg-muted)" }}>Nothing flagged yet. Big swings, distress entries and viral stories land here automatically.</p>}
    </div>
  </div><Footer /></div>);
}
