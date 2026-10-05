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

export function HeroOrbs() {
  return (<><span className="orb orb-a" /><span className="orb orb-b" /></>);
}
