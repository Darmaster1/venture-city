"use client";
import { useState } from "react";
import { Footer, Navbar, PageHero, Stat } from "@/src/components/chrome";

type Company = { id: string; name: string };
type Signatory = { id: string; name: string; companyId: string | null };
type Sheet = { id: string; code: string; lane: string; sellerId: string; buyerId: string; product: string; units: number; pricePerUnit: number; floorPrice: number; startTick: number; endTick: number; state: string; signatures: { signerId: string; companyId: string; state: string }[] };

export default function DealSheetClient({ companies, signatories, sheets }: { companies: Company[]; signatories: Signatory[]; sheets: Sheet[] }) {
  const [form, setForm] = useState({ sellerId: companies[0]?.id ?? "", buyerId: companies[1]?.id ?? "", product: "", units: "1", pricePerUnit: "", floorPrice: "", startTick: "1", endTick: "1", lane: "TRADE", settlement: "UPFRONT", signerA: "", signerB: "" });
  const [rows, setRows] = useState(sheets);
  const [message, setMessage] = useState("");
  const companySignatories = (companyId: string) => signatories.filter((signatory) => signatory.companyId === companyId);
  function update(key: string, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Checking floor price and signatories...");
    const response = await fetch("/api/deal-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, units: Number(form.units), pricePerUnit: Number(form.pricePerUnit), floorPrice: Number(form.floorPrice), startTick: Number(form.startTick), endTick: Number(form.endTick), signerIds: [form.signerA, form.signerB] }) });
    const json = await response.json();
    if (!response.ok) { setMessage(json.error ?? "Could not send the sheet."); return; }
    setRows((current) => [{ ...json.sheet, signatures: [] }, ...current]);
    setMessage(`${json.sheet.code} sent for signatures.`);
  }
  return <div><Navbar /><div className="wrap">
    <PageHero eyebrow="Day two · commercial desk" title="Deal Sheet" sub="Make the economics explicit, validate the floor, then send one clean sheet to both signatories." />
    <div className="stat-grid"><Stat label="Sheets" value={String(rows.length)} color="#6C3DF4" /><Stat label="Signature rule" value="2 people" sub="one per company" color="#E84FB8" /><Stat label="Price rule" value="At or above floor" color="#2F855A" /></div>
    <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}><div className="label">New sheet · send for signatures</div><form onSubmit={submit} className="grid-2">
      <div><label className="f">Seller</label><select value={form.sellerId} onChange={(event) => update("sellerId", event.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.id} · {company.name}</option>)}</select></div>
      <div><label className="f">Buyer</label><select value={form.buyerId} onChange={(event) => update("buyerId", event.target.value)}>{companies.map((company) => <option key={company.id} value={company.id}>{company.id} · {company.name}</option>)}</select></div>
      <div><label className="f">Product / service</label><input required value={form.product} onChange={(event) => update("product", event.target.value)} placeholder="e.g. Compute capacity" /></div>
      <div><label className="f">Lane</label><select value={form.lane} onChange={(event) => update("lane", event.target.value)}><option>TRADE</option><option>SUPPLY</option><option>ANCHOR</option><option>CAPITAL</option><option>PARTNERSHIP</option></select></div>
      <div><label className="f">Units</label><input required type="number" min="1" value={form.units} onChange={(event) => update("units", event.target.value)} /></div>
      <div><label className="f">Price per unit (VB)</label><input required type="number" min="0" value={form.pricePerUnit} onChange={(event) => update("pricePerUnit", event.target.value)} /></div>
      <div><label className="f">Floor price (VB)</label><input required type="number" min="0" value={form.floorPrice} onChange={(event) => update("floorPrice", event.target.value)} /></div>
      <div><label className="f">Settlement</label><select value={form.settlement} onChange={(event) => update("settlement", event.target.value)}><option>UPFRONT</option><option>PER_TICK</option><option>ESCROW</option></select></div>
      <div><label className="f">Start tick</label><input type="number" min="1" max="10" value={form.startTick} onChange={(event) => update("startTick", event.target.value)} /></div>
      <div><label className="f">End tick</label><input type="number" min="1" max="10" value={form.endTick} onChange={(event) => update("endTick", event.target.value)} /></div>
      <div><label className="f">Seller signatory</label><select required value={form.signerA} onChange={(event) => update("signerA", event.target.value)}><option value="">Select signatory</option>{companySignatories(form.sellerId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
      <div><label className="f">Buyer signatory</label><select required value={form.signerB} onChange={(event) => update("signerB", event.target.value)}><option value="">Select signatory</option>{companySignatories(form.buyerId).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
      <div style={{ gridColumn: "1 / -1" }}><button className="btn btn-primary" type="submit" style={{ width: "100%", height: 46 }}>Send for signatures</button></div>
    </form><p aria-live="polite"><b>{message}</b></p></div>
    <div className="card"><div className="label">Deal register</div><table className="vc"><thead><tr><th>Code</th><th>Lane</th><th>Parties</th><th>Economics</th><th>State</th><th>Checks</th></tr></thead><tbody>{rows.length ? rows.map((sheet) => <tr key={sheet.id}><td className="mono">{sheet.code}</td><td>{sheet.lane}</td><td>{sheet.sellerId} → {sheet.buyerId}</td><td>{sheet.units} × {sheet.pricePerUnit} VB<br /><span className="sub">floor {sheet.floorPrice}</span></td><td><span className="badge info">{sheet.state}</span></td><td>{sheet.signatures.filter((signature) => signature.state === "SIGNED").length} / {sheet.signatures.length || 2} signed</td></tr>) : <tr><td colSpan={6}>No Deal Sheets yet.</td></tr>}</tbody></table></div>
  </div><Footer /></div>;
}
