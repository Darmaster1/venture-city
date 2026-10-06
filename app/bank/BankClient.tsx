"use client";
import { useState } from "react";
import { Navbar, Footer, Stat, PageHero } from "@/src/components/chrome";

export default function BankPage({ resources, products, error }: {
  resources: { code: string; bankBasePrice: number; bankStockT1: number; bankStock: number }[];
  products: { id: string; code: string; name: string }[];
  error?: string;
}) {
  const [f, setF] = useState({ companyId: "SWC", resource: "COMPUTE", units: "10", idempotencyKey: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function sell(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/bank/sell", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, units: Number(f.units), idempotencyKey: f.idempotencyKey || undefined }) });
      const j = await r.json();
      setMsg(r.ok ? (j.duplicate ? "Duplicate request ignored." : `Sold ${f.units} ${f.resource} for ${j.total} VB. ${j.remaining} units remain.`) : `Error: ${j.error ?? "failed"}`);
    } catch { setMsg("Could not reach the Bank desk."); } finally { setBusy(false); }
  }
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <PageHero eyebrow="Institution desk" title="Bank desk" sub="Sell resources, buy back surplus, disburse loans. Limit 30 units per company per tick." />
        {error && <p className="alert-error" role="alert">{error}</p>}
        <div className="stat-grid">
          <Stat label="Lending pool" value="80,000 VB" sub="8000 x 10 companies" color="#2F855A" />
          <Stat label="Debt cap" value="30,000 VB" sub="per company" color="#E8930C" />
        </div>
        <div className="grid-2">
          <div className="card" style={{ borderTop: "5px solid #2F855A" }}>
            <div className="label">Resource prices · VB per unit</div>
            <table className="vc"><thead><tr><th>Resource</th><th className="num">Base</th><th className="num">Live stock</th></tr></thead>
              <tbody>{resources.map((r) => <tr key={r.code}><td>{r.code}</td><td className="num">{r.bankBasePrice}</td><td className="num">{r.bankStock} / {r.bankStockT1}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
            <div className="label">Sell resources</div>
            <form onSubmit={sell}>
              <label className="f">Company</label>
              <select value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
                {["SWC", "LED", "MAN", "SKF", "PAI", "GRG", "MED", "STH", "VLT", "TRL"].map((c) => <option key={c}>{c}</option>)}
              </select>
              <label className="f">Resource</label>
              <select value={f.resource} onChange={(e) => setF({ ...f, resource: e.target.value })}>
                {resources.map((r) => <option key={r.code}>{r.code}</option>)}
              </select>
              <label className="f">Units (max 30)</label>
              <input value={f.units} onChange={(e) => setF({ ...f, units: e.target.value })} inputMode="numeric" />
              <div style={{ marginTop: 14 }}><button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", height: 46 }}>{busy ? "Processing..." : "Sell now"}</button></div>
            </form>
            <p style={{ color: "var(--fg-muted)" }}>{msg}</p>
          </div>
        </div>
        <div className="card">
          <div className="label">Loan products</div>
          <table className="vc"><thead><tr><th>Code</th><th>Name</th></tr></thead>
            <tbody>{products.map((p) => <tr key={p.id}><td className="mono">{p.code}</td><td>{p.name}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
}
