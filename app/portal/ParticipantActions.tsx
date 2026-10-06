"use client";

import { useState } from "react";

type Company = { id: string; name: string };
type Signatory = { id: string; name: string; companyId: string | null };
type Mission = { id: string; missionId: string };
type Deal = { id: string; code: string; sellerId: string; buyerId: string; state: string; signatures: { signerId: string; state: string }[] };

export default function ParticipantActions({ participantId, ownCompanyId, companies, signatories, missions, deals }: { participantId: string; ownCompanyId: string; companies: Company[]; signatories: Signatory[]; missions: Mission[]; deals: Deal[] }) {
  const [buyerId, setBuyerId] = useState(companies.find((company) => company.id !== ownCompanyId)?.id ?? "");
  const [buyerSigner, setBuyerSigner] = useState("");
  const [product, setProduct] = useState("");
  const [units, setUnits] = useState("1");
  const [price, setPrice] = useState("");
  const [message, setMessage] = useState("");
  const ownSigner = signatories.find((signatory) => signatory.companyId === ownCompanyId);
  const buyerSigners = signatories.filter((signatory) => signatory.companyId === buyerId);

  async function propose(event: React.FormEvent) {
    event.preventDefault();
    setMessage("Sending deal for signatures...");
    const response = await fetch("/api/deal-sheets", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sellerId: ownCompanyId, buyerId, product, units: Number(units), pricePerUnit: Number(price), floorPrice: Number(price), startTick: 1, endTick: 10, signerIds: [ownSigner?.id, buyerSigner], lane: "TRADE", settlement: "UPFRONT" }) });
    const json = await response.json();
    setMessage(response.ok ? `${json.sheet.code} sent for signatures.` : (json.error ?? "Could not create deal."));
  }

  async function mission(id: string, action: "claim" | "complete") {
    const response = await fetch(`/api/missions/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await response.json();
    setMessage(response.ok ? (action === "complete" ? `Mission paid: ${json.reward} VB.` : "Mission claimed.") : (json.error ?? "Mission action failed."));
  }

  async function sign(dealId: string) {
    const response = await fetch(`/api/deal-sheets/${dealId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "sign", signerId: participantId }) });
    const json = await response.json();
    setMessage(response.ok ? `Deal signed${json.state === "SIGNED" ? " and activated" : ""}.` : (json.error ?? "Could not sign deal."));
  }

  return <div className="grid-2">
    <div className="card"><div className="label">Propose a deal</div><form onSubmit={propose} style={{ display: "grid", gap: 10 }}>
      <select value={buyerId} onChange={(event) => { setBuyerId(event.target.value); setBuyerSigner(""); }}>{companies.filter((company) => company.id !== ownCompanyId).map((company) => <option key={company.id} value={company.id}>{company.id} · {company.name}</option>)}</select>
      <input required value={product} onChange={(event) => setProduct(event.target.value)} placeholder="Product or service" />
      <input required type="number" min="1" value={units} onChange={(event) => setUnits(event.target.value)} placeholder="Units" />
      <input required type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price per unit (VB)" />
      <select required value={buyerSigner} onChange={(event) => setBuyerSigner(event.target.value)}><option value="">Choose buyer signatory</option>{buyerSigners.map((signatory) => <option key={signatory.id} value={signatory.id}>{signatory.name}</option>)}</select>
      <button className="btn btn-primary" type="submit" disabled={!ownSigner || !buyerSigner}>Send for signatures</button>
    </form></div>
    <div className="card"><div className="label">Missions</div>{missions.length ? missions.map((missionItem) => <div key={missionItem.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}><span>{missionItem.missionId}</span><span><button className="btn" onClick={() => mission(missionItem.id, "claim")}>Claim</button> <button className="btn" onClick={() => mission(missionItem.id, "complete")}>Complete</button></span></div>) : <p>No open missions.</p>}</div>
    <div className="card"><div className="label">Your deal sheets</div>{deals.length ? deals.map((deal) => { const signature = deal.signatures.find((item) => item.signerId === participantId); return <div key={deal.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--border)" }}><span>{deal.code} · {deal.state}</span>{signature?.state === "PENDING" && <button className="btn" onClick={() => sign(deal.id)}>Sign</button>}</div>; }) : <p>No deal sheets yet.</p>}</div>
    <p aria-live="polite"><b>{message}</b></p>
  </div>;
}