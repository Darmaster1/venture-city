"use client";
import { useEffect, useState } from "react";
import { Navbar, Footer, Stat, CoDot, HeroOrbs, HamsterLoader } from "@/src/components/chrome";
import CursorRingField from "@/src/components/cursor-ring-field";

type Board = { tick: number; clock: string; infoMode: string; server_time: string; companies: { id: string; name: string; lifecycle: string; rv: number | null }[]; bankBase: Record<string, number> };
const RES_COLORS: Record<string, string> = { COMPUTE: "#6C3DF4", ENERGY: "#FFB020", LOGISTICS: "#0E9FD8", MATERIALS: "#C25E2B", DATA: "#E84FB8", INFRA: "#2F855A" };
const CLOCK_FRIENDLY: Record<string, string> = {
  PRE: "Warming up",
  RUNNING: "Market open",
  FROZEN_FOR_SETTLEMENT: "Settling the tick",
  PAUSED: "Paused for lunch",
  FINAL_FROZEN: "Market frozen"
};
const CLOCK_BLURB: Record<string, string> = {
  PRE: "Doors open soon. Desks are setting up and teams are finding their tables.",
  RUNNING: "Prices move every tick — buy low, deliver fast.",
  FROZEN_FOR_SETTLEMENT: "Hold tight — the tick is settling. No trades until the board refreshes.",
  PAUSED: "Lunch break. Trading resumes at 13:05.",
  FINAL_FROZEN: "Trading is closed. Investor Day decides the winners."
};

export default function BoardPage() {
  const [b, setB] = useState<Board | null>(null);
  const [err, setErr] = useState("");
  const load = () => fetch("/api/board").then((r) => {
    if (!r.ok) throw new Error(`Board feed failed (${r.status})`);
    return r.json();
  }).then((j) => { setB(j); setErr(""); }).catch(() => setErr("Couldn't reach the city feed. Check your connection."));
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <div className="hero" style={{ padding: "44px 40px" }}>
          <div className="field-bg" aria-hidden="true"><CursorRingField /></div>
          <HeroOrbs />
          <div className="hero-content">
            <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}><span className="live-dot" />Live | {b?.infoMode ?? ""} | {b && CLOCK_FRIENDLY[b.clock] ? CLOCK_FRIENDLY[b.clock] : (b?.clock ?? "")}</div>
            <h1 style={{ fontSize: 48 }}>Tick {b?.tick ?? "-"} of 10</h1>
            <p>{b && CLOCK_BLURB[b.clock] ? CLOCK_BLURB[b.clock] : "Connecting to the city feed."}</p>
            {err && <p className="alert-error" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}>{err} <button className="btn btn-light" onClick={load} style={{ marginLeft: 8, minHeight: 32 }}>Retry</button></p>}
          </div>
        </div>
        <div className="stat-grid">
          <Stat label="Companies live" value={String(b?.companies.length ?? "–")} color="#6C3DF4" />
          <Stat label="Info mode" value={b?.infoMode ?? "–"} color="#E84FB8" />
          <Stat label="Clock" value={b && CLOCK_FRIENDLY[b.clock] ? CLOCK_FRIENDLY[b.clock] : (b?.clock ?? "–")} color="#0E9FD8" />
          <Stat label="Server time" value={b ? new Date(b.server_time).toLocaleTimeString() : "–"} sub="auto-refresh 30s" color="#2F855A" />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="label">Bank prices · VB per unit</div>
            <table className="vc"><thead><tr><th>Resource</th><th className="num">Price</th></tr></thead>
              <tbody>{b ? Object.entries(b.bankBase).map(([k, v]) => (
                <tr key={k}><td><span className="co-dot" style={{ background: RES_COLORS[k] ?? "#999" }} />{k}</td><td className="num">{v} VB</td></tr>
              )) : <tr><td colSpan={2}><HamsterLoader label="Pulling live prices." /></td></tr>}</tbody>
            </table>
          </div>
          <div className="card">
            <div className="label">Leaderboard · reportable value</div>
            <table className="vc"><thead><tr><th>#</th><th>Company</th><th>Status</th><th className="num">RV</th></tr></thead>
              <tbody>{(b?.companies ?? []).map((c, i) => (
                <tr key={c.id}><td className="num">{i + 1}</td><td><CoDot id={c.id} />{c.name}</td>
                  <td><span className={`badge ${c.lifecycle === "OPERATING" ? "op" : "neg"}`}>{c.lifecycle}</span></td>
                  <td className="num">{c.rv ?? "–"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
