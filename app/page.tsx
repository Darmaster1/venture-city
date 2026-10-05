import { Navbar, Footer, HeroOrbs } from "@/src/components/chrome";
import { prisma } from "@/src/db";

export const dynamic = "force-dynamic";

const PILLARS: Array<[string, string, string]> = [
  ["Trade live", "Buy resources, sign customer contracts, bid in auctions — every rupee hits the journal.", "#6C3DF4"],
  ["Get funded", "Pitch the Investor desk, unlock term sheets, and climb the RV leaderboard.", "#E84FB8"],
  ["Survive the city", "Crises, rumours and blackouts hit every tick. Distressed companies face rescue or ruin.", "#FF9F2E"]
];

export default async function Landing() {
  let companies: Array<{ id: string; name: string }> = [];
  try {
    companies = await prisma.company.findMany({ where: { active: true }, orderBy: { id: "asc" }, select: { id: true, name: true } });
  } catch { /* pre-migration */ }
  return (
    <div>
      <Navbar />
      <div className="wrap">
        <div className="hero">
          <HeroOrbs />
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>One day · ten startups · one economy</div>
          <h1>Build your venture before the market freezes.</h1>
          <p>Venture City is a live-action startup simulation: trade resources, win customers, raise funding and survive ten market ticks. Every balance is journaled. Nothing is paper — until the internet drops.</p>
          <div className="hero-cta">
            <a className="btn btn-light" href="/login" style={{ height: 48, padding: "0 28px", fontSize: 16 }}>Enter the city</a>
            <a className="btn" href="/board" style={{ height: 48, padding: "0 28px", fontSize: 16, background: "#fff" }}>Watch the board</a>
          </div>
        </div>
        <div className="grid-3">
          {PILLARS.map(([t, d, c]) => (
            <div className="card" key={t} style={{ borderTop: `5px solid ${c}` }}>
              <h3 style={{ margin: "0 0 6px", fontSize: 20 }}>{t}</h3>
              <p style={{ color: "var(--fg-muted)", margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="label">Tonight's lineup · the City 10</div>
          <div className="marquee" style={{ marginTop: 10 }}>
            <div className="marquee-track">
              {(companies.length ? companies.map((c) => c.name) : ["SwiftCart", "Ledgerly", "Mango & Co.", "SkillForge", "PulseAI", "GreenGrid", "MediLink", "StackHouse", "Voltway", "TrustLayer"]).map((n) => (
                <span className="chip" key={n}>{n}</span>
              ))}
              {(companies.length ? companies.map((c) => c.name) : ["SwiftCart", "Ledgerly", "Mango & Co.", "SkillForge", "PulseAI", "GreenGrid", "MediLink", "StackHouse", "Voltway", "TrustLayer"]).map((n) => (
                <span className="chip" key={n + "-2"} aria-hidden="true">{n}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
