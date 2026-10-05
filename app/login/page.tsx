"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar, Footer } from "@/src/components/chrome";

export default function LoginPage() {
  return (
    <div>
      <Navbar />
      <Suspense>
        <Forms />
      </Suspense>
      <Footer />
    </div>
  );
}

function Forms() {
  const pre = useSearchParams().get("qr") ?? "";
  const [qr, setQr] = useState(pre);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!qr.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ qrToken: qr.trim() }) });
      const j = await r.json();
      setMsg(r.ok ? "Signed in. Opening your portal." : (j.error ?? "Sign in failed."));
      if (r.ok) window.location.href = j.next;
    } finally { setBusy(false); }
  }
  return (
    <div className="wrap" style={{ maxWidth: 520 }}>
        <div className="hero" style={{ padding: "36px 32px" }}>
          <h1 style={{ fontSize: 36 }}>Your badge is your ticket.</h1>
          <p>Paste the code from your badge QR. Volunteers, use your desk account below.</p>
        </div>
        <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
          <div className="label">Participants</div>
          <form onSubmit={login}>
            <label className="f">Badge code</label>
            <input value={qr} onChange={(e) => setQr(e.target.value)} placeholder="Paste qr token" autoComplete="off" />
            <div style={{ marginTop: 14 }}><button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", height: 46, fontSize: 16 }}>{busy ? "Signing in." : "Sign in"}</button></div>
          </form>
          <p aria-live="polite" style={{ minHeight: 20, color: "var(--fg-muted)" }}>{msg}</p>
        </div>
        <div className="card" style={{ borderTop: "5px solid #E84FB8" }}>
          <div className="label">Desks and crew</div>
          <Volunteer />
        </div>
      </div>
  );
}

function Volunteer() {
  const [id, setId] = useState("");
  const [secret, setSecret] = useState("");
  const [msg, setMsg] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ volunteerId: id.trim(), secret }) });
    const j = await r.json();
    setMsg(r.ok ? "Signed in." : (j.error ?? "Failed."));
    if (r.ok) window.location.href = j.next;
  }
  return (
    <form onSubmit={go}>
      <label className="f">Volunteer id</label><input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" />
      <label className="f">Secret</label><input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="current-password" />
      <div style={{ marginTop: 14 }}><button className="btn" type="submit" style={{ width: "100%", height: 46, fontSize: 16 }}>Sign in as volunteer</button></div>
      <p aria-live="polite" style={{ minHeight: 20, color: "var(--fg-muted)" }}>{msg}</p>
    </form>
  );
}
