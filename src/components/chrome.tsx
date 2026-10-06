export const COMPANY_COLORS: Record<string, string> = {
  SWC: "#3B6EA5", LED: "#6A4C93", MAN: "#C25E2B", SKF: "#12B76A", PAI: "#06AED4",
  GRG: "#4A7C2F", MED: "#E84FB8", STH: "#5A5A66", VLT: "#F79009", TRL: "#7A3E9C"
};

const DESKS: Array<[string, string]> = [
  ["/bank", "Bank"], ["/investor", "Investor"], ["/customer", "Customers"],
  ["/supplier", "Suppliers"], ["/logistics", "Logistics"], ["/government", "Government"],
  ["/media", "Media"], ["/talent", "Talent"]
];

export function Navbar() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="brand" href="/"><span className="brand-mark">V</span>Venture City</a>
        <div className="nav-links">
          <a href="/board">Board</a>
          <a href="/portal">Portal</a>
          <details className="nav-menu">
            <summary>Desks ▾</summary>
            <div className="drop">{DESKS.map(([h, l]) => <a key={h} href={h}>{l}</a>)}</div>
          </details>
          <a href="/gm">GM</a>
          <button onClick={handleLogout} className="btn" style={{ minHeight: 32, padding: "0 14px", marginLeft: 8, background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}>Logout</button>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "rgba(255,255,255,0.65)" }}>{process.env.NEXT_PUBLIC_VENUE_NAME ?? ""}</span>
      </div>
    </nav>
  );
}

export function BrandBar({ tick, clock }: { tick?: number; clock?: string }) {
  return (
    <div className="topbar">
      <b>Venture City</b>
      <span style={{ color: "var(--fg-muted)" }}>{process.env.NEXT_PUBLIC_VENUE_NAME ?? ""}</span>
      {tick !== undefined && <span className="mono">Tick {tick} of 10</span>}
      {clock && <span className="badge vip">{clock}</span>}
    </div>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="stat" style={color ? ({ "--stat-color": color } as React.CSSProperties) : undefined}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function Footer() {
  return (
    <div className="footer">
      <span className="mono">Venture City v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"}</span>
      <a href="/api/paper-export?tick=0">Paper export</a>
      <a href="/board">City Board</a>
      <a href="/login">Sign in</a>
    </div>
  );
}

export function CoDot({ id }: { id: string }) {
  return <span className="co-dot" style={{ background: COMPANY_COLORS[id] ?? "#999" }} />;
}

export function HamsterLoader({ label }: { label?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "18px 0" }} role="status" aria-live="polite">
      <div className="wheel-and-hamster" aria-hidden="true">
        <div className="wheel" />
        <div className="hamster">
          <div className="hamster__head"><div className="hamster__ear" /><div className="hamster__eye" /><div className="hamster__nose" /></div>
          <div className="hamster__body"><div className="hamster__limb--fr" /><div className="hamster__limb--fl" /><div className="hamster__limb--br" /><div className="hamster__limb--bl" /><div className="hamster__tail" /></div>
        </div>
        <div className="spoke" />
      </div>
      {label && <p style={{ color: "var(--fg-muted)" }}>{label}</p>}
    </div>
  );
}

export function HeroOrbs() {
  return (<><span className="orb orb-a" /><span className="orb orb-b" /></>);
}

import CursorRingField from "@/src/components/cursor-ring-field";

export function PageHero({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="hero" style={{ padding: "30px 30px" }}>
      <div className="field-bg" aria-hidden="true"><CursorRingField /></div>
      <HeroOrbs />
      <div className="hero-content">
        <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>{eyebrow}</div>
        <h1 style={{ fontSize: 34 }}>{title}</h1>
        <p style={{ marginBottom: 0 }}>{sub}</p>
      </div>
    </div>
  );
}
