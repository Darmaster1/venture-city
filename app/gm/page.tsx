"use client";
import { useEffect, useState } from "react";
import { Navbar, Footer, HeroOrbs, HamsterLoader, PageHero } from "@/src/components/chrome";

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
        <PageHero eyebrow="Game master console" title="Run the city." sub="Settle ticks, freeze the market, post manual entries. Every action is journaled." />
        <div style={{ margin: "-10px 0 16px" }}>
          <button className="btn btn-danger" onClick={settle} disabled={busy} style={{ height: 48, padding: "0 28px", fontSize: 16 }}>{busy ? "Settling..." : "Settle tick"}</button>
        </div>
        <div className="card" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span className="label">City controls</span>
          <button className="btn" onClick={() => freeze(true)}>Freeze the city</button>
          <button className="btn" onClick={() => freeze(false)}>Resume</button>
          <a className="btn" href="/api/paper-export?tick=0">Paper export</a>
          <a className="btn" href="/api/gm/badges">Badges</a>
          <button className="btn" onClick={backup}>Backup journal</button>
        </div>
        <p aria-live="polite"><b>{msg}</b></p>
        {busy && <div className="card"><HamsterLoader label="Settling the tick — writing to the journal." /></div>}
        <div className="card" style={{ borderTop: "5px solid #B42318" }}>
          <div className="label">Test runs · crew quick-check</div>
          <CrewTable />
        </div>
        <div className="card" style={{ borderTop: "5px solid #0E7C9E" }}>
          <div className="label">Test runs · participant spot-check</div>
          <ParticipantChecks />
        </div>
        <div className="card" style={{ borderTop: "5px solid #7A271A" }}>
          <div className="label">Danger zone · reset all game data</div>
          <ResetPanel />
        </div>
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
          <ControlPanel />
        </div>
      </div>
      <Footer />
    </div>
  );
}

function CrewTable() {
  const [crew, setCrew] = useState<Array<{ id: string; name: string; role: string; deskOrCompany: string | null }>>([]);
  const [note, setNote] = useState("");
  const load = () => fetch("/api/gm/volunteers").then((r) => r.json()).then((j) => setCrew(j.volunteers ?? [])).catch(() => null);
  useEffect(() => { load(); }, []);

  async function newSecret(id: string) {
    const r = await fetch("/api/gm/volunteers/reset-secret", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const j = await r.json();
    setNote(r.ok ? `${j.name}: new secret (copy now) ${j.secret}` : (j.error ?? "Failed."));
  }

  async function checkAs(id: string) {
    const r = await fetch("/api/gm/impersonate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const j = await r.json();
    if (r.ok) window.open(j.loginUrl, "_blank", "noopener");
    else setNote(j.error ?? "Failed.");
  }

  async function renameCrew(id: string, currentName: string) {
    const newName = prompt("Enter new name for crew member:", currentName);
    if (!newName || newName.trim() === currentName) return;
    const r = await fetch("/api/gm/volunteers", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, name: newName.trim() }) });
    const j = await r.json();
    if (r.ok) { setNote(`Updated name to ${newName}`); load(); }
    else setNote(j.error ?? "Failed to update.");
  }

  async function deleteCrew(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete crew member ${name}?`)) return;
    const r = await fetch(`/api/gm/volunteers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (r.ok) { setNote(`Deleted ${name}`); load(); }
    else setNote(j.error ?? "Failed to delete.");
  }

  async function copyLink(id: string) {
    const r = await fetch("/api/gm/impersonate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    const j = await r.json();
    if (r.ok && j.loginUrl) {
      await navigator.clipboard.writeText(j.loginUrl);
      setNote("Copied login URL to clipboard!");
    } else {
      setNote(j.error ?? "Failed to copy link.");
    }
  }

  return (
    <div>
      <p style={{ color: "var(--fg-muted)" }}>Sign-in-as opens that desk in a new tab for fast checking. Copy link lets you open it in an Incognito window without affecting your GM session.</p>
      <table className="vc"><thead><tr><th>Name</th><th>Role</th><th>Desk</th><th>Actions</th></tr></thead>
        <tbody>{crew.map((v) => {
          return (
            <tr key={v.id}>
              <td><b>{v.name}</b></td>
              <td>{v.role}</td>
              <td>{v.deskOrCompany ?? "-"}</td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="btn" style={{ minHeight: 32 }} onClick={() => copyLink(v.id)}>Copy link</button>
                  <button className="btn" style={{ minHeight: 32 }} onClick={() => checkAs(v.id)}>Check desk</button>
                  <button className="btn" style={{ minHeight: 32 }} onClick={() => newSecret(v.id)}>New secret</button>
                  <button className="btn" style={{ minHeight: 32 }} onClick={() => renameCrew(v.id, v.name)}>Rename</button>
                  {v.id !== "gm-1" && <button className="btn btn-danger" style={{ minHeight: 32 }} onClick={() => deleteCrew(v.id, v.name)}>Delete</button>}
                </div>
              </td>
            </tr>
          );
        })}</tbody>
      </table>
      <p className="mono" style={{ wordBreak: "break-all" }}>{note}</p>
    </div>
  );
}

function ParticipantChecks() {
  const [parts, setParts] = useState<Array<{ id: string; name: string; badgeNo: string; companyId: string | null; loginUrl: string }>>([]);
  const [copyMsg, setCopyMsg] = useState("");

  useEffect(() => { fetch("/api/gm/participants").then((r) => r.json()).then((j) => setParts((j.participants ?? []).slice(0, 12))).catch(() => null); }, []);

  async function copyParticipantLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopyMsg("Copied portal link to clipboard!");
    setTimeout(() => setCopyMsg(""), 3000);
  }

  return (
    <div>
      <p style={{ color: "var(--fg-muted)" }}>First 12 participants — copy any login link to open in an incognito window without logging out your GM account. Full list: <a href="/api/gm/participants">participants API</a>.</p>
      {copyMsg && <p className="mono" style={{ color: "#2F855A" }}>{copyMsg}</p>}
      <table className="vc"><thead><tr><th>Badge</th><th>Name</th><th>Company</th><th>Actions</th></tr></thead>
        <tbody>{parts.map((p) => (
          <tr key={p.id}>
            <td className="num">{p.badgeNo}</td>
            <td>{p.name}</td>
            <td>{p.companyId ?? "-"}</td>
            <td>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn" style={{ minHeight: 32 }} onClick={() => copyParticipantLink(p.loginUrl)}>Copy portal link</button>
                <a className="btn" style={{ minHeight: 32 }} href={p.loginUrl} target="_blank" rel="noreferrer">Open portal</a>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function ResetPanel() {
  const [confirm, setConfirm] = useState("");
  const [cleanParticipants, setCleanParticipants] = useState(false);
  const [out, setOut] = useState("");
  const [crew, setCrew] = useState<Array<{ id: string; name: string; secret: string | null }>>([]);
  async function reset(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/gm/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm, cleanParticipants }) });
    const j = await r.json();
    if (r.ok) { setCrew(j.crew ?? []); setOut("Reset complete. Tick 0, fresh badges. gm-1 unchanged."); }
    else setOut(j.error ?? "Failed.");
    setConfirm("");
  }
  return (
    <div>
      <p style={{ color: "var(--fg-muted)" }}>Wipes journal, contracts, loans, players, missions — back to a fresh T0. <b>gm-1 keeps its password.</b> Every other volunteer gets a new secret (shown once below). Badge tokens change: reprint badges after reset.</p>
      <form onSubmit={reset} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder='Type RESET to confirm' style={{ maxWidth: 260 }} />
          <button className="btn btn-danger" type="submit">Reset all data</button>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" checked={cleanParticipants} onChange={(e) => setCleanParticipants(e.target.checked)} />
          Clear participants and keep only default companies (Clean seed)
        </label>
      </form>
      <p><b>{out}</b></p>
      {crew.length > 0 && <table className="vc"><thead><tr><th>Name</th><th>ID</th><th>Secret</th></tr></thead>
        <tbody>{crew.map((v) => <tr key={v.id}><td>{v.name}</td><td className="mono">{v.id}</td><td className="mono">{v.secret ?? "unchanged (gm-1)"}</td></tr>)}</tbody>
      </table>}
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

function ControlPanel() {
  const [data, setData] = useState<{ accounts: { id: string; name: string; role: string; deskOrCompany: string | null }[]; lanes: { code: string; name: string; desk: string; active: boolean }[]; toggles: { key: string; enabled: boolean; description: string }[]; rulings: { id: string; tick: number; text: string; by: string }[] }>({ accounts: [], lanes: [], toggles: [], rulings: [] });
  const [ruling, setRuling] = useState("");
  const [note, setNote] = useState("");
  const load = () => fetch("/api/gm/control").then((r) => r.json()).then(setData).catch(() => setNote("Could not load GM controls."));
  useEffect(() => { load(); }, []);
  async function post(body: object) {
    const response = await fetch("/api/gm/control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    setNote(response.ok ? "Saved." : (json.error ?? "Save failed."));
    if (response.ok) load();
  }
  return <div className="card" style={{ borderTop: "5px solid #0E7C9E" }}>
    <div className="label">Day two controls</div>
    <div className="grid-2">
      <div><h3>GM accounts ({data.accounts.length} / 5)</h3><table className="vc"><thead><tr><th>Name</th><th>Role</th><th>ID</th></tr></thead><tbody>{data.accounts.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.role}</td><td className="mono">{account.id}</td></tr>)}</tbody></table></div>
      <div><h3>Lanes</h3><table className="vc"><thead><tr><th>Code</th><th>Desk</th><th>State</th></tr></thead><tbody>{data.lanes.map((lane) => <tr key={lane.code}><td className="mono">{lane.code}</td><td>{lane.desk}</td><td>{lane.active ? "LIVE" : "OFF"}</td></tr>)}</tbody></table></div>
    </div>
    <div className="grid-2" style={{ marginTop: 18 }}>
      <div><h3>Feature toggles</h3>{data.toggles.map((toggle) => <label key={toggle.key} style={{ display: "flex", gap: 8, alignItems: "center", margin: "10px 0" }}><input type="checkbox" checked={toggle.enabled} onChange={(event) => post({ action: "toggle", key: toggle.key, enabled: event.target.checked })} /><span><b>{toggle.key}</b><br /><span className="sub">{toggle.description}</span></span></label>)}</div>
      <div><h3>Ruling log</h3><form onSubmit={(event) => { event.preventDefault(); post({ action: "ruling", text: ruling }); setRuling(""); }}><textarea value={ruling} onChange={(event) => setRuling(event.target.value)} placeholder="Record the ruling and its interpretation." rows={3} style={{ width: "100%" }} /><button className="btn btn-primary" type="submit" style={{ marginTop: 8 }}>Log ruling</button></form><ul>{data.rulings.slice(0, 5).map((item) => <li key={item.id}>T{item.tick}: {item.text}</li>)}</ul></div>
    </div>
    <p aria-live="polite"><b>{note}</b></p>
  </div>;
}
