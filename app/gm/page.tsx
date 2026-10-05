"use client";
import { useState } from "react";
import { Navbar, Footer } from "@/src/components/chrome";

export default function GMPage() {
  const [log, setLog] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function settle() {
    setBusy(true); setMsg("Settling the tick.");
    const r = await fetch("/api/gm/settle", { method: "POST" });
    const j = await r.json();
    if (r.ok) { setLog(j.log ?? []); setMsg(`Tick ${j.tick} settled in ${(j.ms / 1000).toFixed(1)}s.`); }
    else setMsg(j.error ?? "Settle failed.");
    setBusy(false);
  }
  async function freeze(f: boolean) {
    const r = await fetch("/api/gm/freeze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ freeze: f }) });
    const j = await r.json();
    setMsg(r.ok ? `Clock: ${j.clockState}` : (j.error ?? "Failed."));
  }
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <div className="hero" style={{ padding: "36px 32px" }}>
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>Game master console</div>
          <h1 style={{ fontSize: 40 }}>Run the city.</h1>
          <p>Settle ticks, freeze the market, post manual entries. Every action is journaled.</p>
          <div className="hero-cta">
            <button className="btn btn-danger" onClick={settle} disabled={busy} style={{ height: 48, padding: "0 28px", fontSize: 16 }}>{busy ? "Settling." : "Settle tick"}</button>
            <button className="btn btn-light" onClick={() => freeze(true)}>Freeze the city</button>
            <button className="btn btn-light" onClick={() => freeze(false)}>Resume</button>
            <a className="btn btn-light" href="/api/paper-export?tick=0">Paper export</a>
            <a className="btn btn-light" href="/api/gm/badges">Badges</a>
          </div>
        </div>
        <p aria-live="polite"><b>{msg}</b></p>
        <div className="grid-2">
          <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
            <div className="label">Settlement step log</div>
            <pre className="mono" style={{ whiteSpace: "pre-wrap", background: "var(--bg)", borderRadius: 10, padding: 12 }}>{log.join("\n") || "No settle yet this session."}</pre>
          </div>
          <div className="card" style={{ borderTop: "5px solid #E5484D" }}>
            <div className="label">Manual entry · reason mandatory</div>
            <EntryForm />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function EntryForm() {
  const [f, setF] = useState({ toAccountId: "", asset: "VB", amount: "", reason: "", idempotencyKey: "" });
  const [msg, setMsg] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/gm/entry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, amount: Number(f.amount) }) });
    const j = await r.json();
    setMsg(r.ok ? `Posted ${j.tx}` : (j.error ?? "Failed."));
  }
  return (
    <form onSubmit={submit}>
      {(["toAccountId", "asset", "amount", "reason", "idempotencyKey"] as const).map((k) => (
        <div key={k}><label className="f">{k}</label><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
      ))}
      <div style={{ marginTop: 12 }}><button className="btn btn-primary" type="submit" style={{ width: "100%", height: 44 }}>Post entry</button></div>
      <p style={{ color: "var(--fg-muted)" }}>{msg}</p>
    </form>
  );
}
