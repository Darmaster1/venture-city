import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Navbar, Footer, Stat, CoDot, HeroOrbs } from "@/src/components/chrome";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const tok = cookies().get("vc_session")?.value;
  const s = tok ? await verifySession(tok) : null;
  if (!s || s.kind !== "participant") redirect("/login");
  const p = await prisma.participant.findUnique({ where: { id: s.pid } });
  if (!p) redirect("/login");
  const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
  if (run?.infoMode === "DARK")
    return (<div><Navbar /><div className="wrap" style={{ maxWidth: 640 }}><div className="hero"><h1>Devices away until Market Open.</h1><p>Talk to humans. The city wakes at 10:35.</p></div></div><Footer /></div>);
  const wAcc = p.walletAccountId ? await prisma.journalEntry.aggregate({ where: { accountId: p.walletAccountId, asset: "VB" }, _sum: { amount: true } }) : null;
  const obj = await prisma.objectiveAssignment.findFirst({ where: { holderId: p.id } });
  const co = p.companyId ? await prisma.company.findUnique({ where: { id: p.companyId } }) : null;
  const cards = await prisma.infoHolding.findMany({ where: { holderId: p.id }, take: 10 });
  const missions = await prisma.missionInstance.findMany({ where: { holderId: p.id, state: "OPEN" }, take: 10 });
  return (
    <div>
      <Navbar />
      <div className="wrap" style={{ maxWidth: 760 }}>
        <div className="hero" style={{ padding: "36px 32px" }}>
          <HeroOrbs />
          <div className="label" style={{ color: "rgba(255,255,255,0.75)" }}>Tick {run?.currentTick ?? 0} of 10 · {p.domain} L{p.level}</div>
          <h1 style={{ fontSize: 38 }}>Hey {p.name.split(" ")[0]}, here's your city.</h1>
          <p>{co ? (<span>Running with {co.name}. Wallet below, objective below that — go make money.</span>) : "No company yet — find registration."}</p>
        </div>
        <div className="stat-grid">
          <Stat label="Wallet" value={`${wAcc?._sum.amount ?? 0} VB`} color="#2F855A" />
          <Stat label="Company" value={co?.name ?? "–"} sub={co?.lifecycle} color="#6C3DF4" />
          <Stat label="Salary" value={`${p.salary} VB`} sub={`per tick · L${p.level}`} color="#E84FB8" />
        </div>
        <div className="grid-2">
          <div className="card" style={{ borderTop: "5px solid #6C3DF4" }}>
            <div className="label">Your objective</div>
            <h3 style={{ margin: "6px 0" }}>{obj ? obj.templateId : "No objective yet"}</h3>
            <p style={{ color: "var(--fg-muted)" }}>{obj ? `Status: ${obj.state}${obj.note ? ` — ${obj.note}` : ""}` : "Objectives drop at Market Open."}</p>
          </div>
          <div className="card" style={{ borderTop: "5px solid #E8930C" }}>
            <div className="label">Missions claimed ({missions.length}/2)</div>
            {missions.length ? missions.map((m) => <div key={m.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>{m.missionId}</div>) : <p style={{ color: "var(--fg-muted)" }}>No missions yet.</p>}
            <div className="label" style={{ marginTop: 12 }}>Intel cards ({cards.length})</div>
            {cards.length ? cards.map((c) => <div key={c.id} style={{ padding: "6px 0" }}>{c.cardId} · {c.state}</div>) : <p style={{ color: "var(--fg-muted)" }}>No cards yet.</p>}
          </div>
        </div>
        {co && <div className="card"><CoDot id={co.id} /><b>{co.name}</b> <span className="badge op">{co.lifecycle}</span></div>}
      </div>
      <Footer />
    </div>
  );
}
