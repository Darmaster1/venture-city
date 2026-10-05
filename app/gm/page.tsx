"use client";
import { useState } from "react";
import { Navbar, Footer, HeroOrbs } from "@/src/components/chrome";

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
  async function backup() {
    setMsg("Exporting journal backup.");
    const r = await fetch("/api/gm/backup", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Backup saved (${j.count ?? "?"} entries).` : (j.error ?? "Backup failed."));
  }
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <div className="hero" style={{ padding: "36px 32px" }}>
          <HeroOrbs />
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>Game master console</div>
          <h1 style={{ fontSize: 40 }}>Run the city.</h1>
          <p>Settle ticks, freeze the market, post manual entries. Every action is journaled.</p>
          <div className="hero-cta">
            <button className="btn btn-danger" onClick={settle} disabled={busy} style={{ height: 48, padding: "0 28px", fontSize: 16 }}>{busy ? "Settling." : "Settle tick"}</button>
            <details className="menu">
              <summary className="btn btn-light">More actions ▾</summary>
              <div className="drop">
                <button onClick={() => freeze(true)}>Freeze the city</button>
                <button onClick={() => freeze(false)}>Resume</button>
                <a href="/api/paper-export?tick=0">Paper export</a>
                <a href="/api/gm/badges">Badges</a>
                <button onClick={backup}>Backup journal</button>
              </div>
            </details>
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
        <div className="grid-2">
          <div className="card" style={{ borderTop: "5px solid #2F855A" }}>
            <div className="label">Crew · new volunteer login</div>
            <VolunteerForm />
          </div>
          <div className="card" style={{ borderTop: "5px solid #E8930C" }}>
            <div className="label">Late registration · new participant</div>
            <ParticipantForm />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function VolunteerForm() {
  const [f, setF] = useState({ name: "", role: "DESK", deskOrCompany: "BANK" });
  const [out, setOut] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/gm/volunteers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json();
    setOut(r.ok ? `ID: ${j.id} — secret (copy now, shown once): ${j.secret}` : (j.error ?? "Failed."));
    if (r.ok) setF({ name: "", role: "DESK", deskOrCompany: "BANK" });
  }
  return (
    <form onSubmit={submit}>
      <label className="f">Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Priya Nair" />
      <label className="f">Role</label>
      <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
        {["DESK", "GM", "DEPUTY_GM", "TECH_LEAD", "LEDGER_LEAD", "OBSERVER", "MC", "RUNNER", "REGISTRATION"].map((r) => <option key={r}>{r}</option>)}
      </select>
      <label className="f">Desk / company (for DESK)</label>
      <select value={f.deskOrCompany} onChange={(e) => setF({ ...f, deskOrCompany: e.target.value })}>
        {["BANK", "INVESTOR", "CUSTOMER", "TALENT", "SUPPLIER", "LOGISTICS", "GOVERNMENT", "MEDIA", "SWC", "LED", "MAN", "SKF", "PAI", "GRG", "MED", "STH", "VLT", "TRL"].map((d) => <option key={d}>{d}</option>)}
      </select>
      <div style={{ marginTop: 12 }}><button className="btn btn-primary" type="submit" style={{ width: "100%", height: 44 }}>Create login</button></div>
      <p className="mono" style={{ wordBreak: "break-all" }}>{out}</p>
    </form>
  );
}

function ParticipantForm() {
  const [f, setF] = useState({ name: "", companyId: "SWC", domain: "Operations" });
  const [out, setOut] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/gm/participants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json();
    setOut(r.ok ? `Badge ${j.badgeNo} — login: ${j.loginUrl}` : (j.error ?? "Failed."));
    if (r.ok) setF({ name: "", companyId: "SWC", domain: "Operations" });
  }
  return (
    <form onSubmit={submit}>
      <label className="f">Name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Arjun Rao" />
      <label className="f">Company</label>
      <select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
        {["SWC", "LED", "MAN", "SKF", "PAI", "GRG", "MED", "STH", "VLT", "TRL"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <label className="f">Domain</label><input value={f.domain} onChange={(e) => setF({ ...f, domain: e.target.value })} />
      <div style={{ marginTop: 12 }}><button className="btn btn-primary" type="submit" style={{ width: "100%", height: 44 }}>Register + print badge</button></div>
      <p className="mono" style={{ wordBreak: "break-all" }}>{out}</p>
    </form>
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
