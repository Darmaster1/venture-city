"use client";
import { useEffect, useState } from "react";
import { Navbar, Footer, Stat, CoDot } from "@/src/components/chrome";

type Board = { tick: number; clock: string; infoMode: string; server_time: string; companies: { id: string; name: string; lifecycle: string; rv: number | null }[]; bankBase: Record<string, number> };
const RES_COLORS: Record<string, string> = { COMPUTE: "#6C3DF4", ENERGY: "#FFB020", LOGISTICS: "#0E9FD8", MATERIALS: "#C25E2B", DATA: "#E84FB8", INFRA: "#2F855A" };

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
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>Live · {b?.infoMode ?? ""} · {b?.clock ?? ""}</div>
          <h1 style={{ fontSize: 48 }}>Tick {b?.tick ?? "–"} of 10</h1>
          <p>The market is {b?.clock === "PRE" ? "warming up" : b?.clock === "FINAL_FROZEN" ? "frozen" : "open"}. Prices move every tick — buy low, deliver fast.</p>
          {err && <p className="alert-error" style={{ background: "rgba(0,0,0,0.35)", borderColor: "rgba(255,255,255,0.4)", color: "#fff" }}>{err} <button className="btn btn-light" onClick={load} style={{ marginLeft: 8, minHeight: 32 }}>Retry</button></p>}
        </div>
        <div className="stat-grid">
          <Stat label="Companies live" value={String(b?.companies.length ?? "–")} color="#6C3DF4" />
          <Stat label="Info mode" value={b?.infoMode ?? "–"} color="#E84FB8" />
          <Stat label="Clock" value={b?.clock ?? "–"} color="#0E9FD8" />
          <Stat label="Server time" value={b ? new Date(b.server_time).toLocaleTimeString() : "–"} sub="auto-refresh 30s" color="#2F855A" />
        </div>
        <div className="grid-2">
          <div className="card">
            <div className="label">Bank prices · VB per unit</div>
            <table className="vc"><thead><tr><th>Resource</th><th className="num">Price</th></tr></thead>
              <tbody>{b ? Object.entries(b.bankBase).map(([k, v]) => (
                <tr key={k}><td><span className="co-dot" style={{ background: RES_COLORS[k] ?? "#999" }} />{k}</td><td className="num">{v} VB</td></tr>
              )) : <tr><td>Loading.</td><td /></tr>}</tbody>
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
