export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { SALARY_LADDER, TIER_RATES } from "@/src/formulas";
import { pct } from "@/src/rounding";

// Paper fallback: a Deputy GM runbook. Print at every tick boundary.
// Fully server-rendered, no client JS, GM session only.
export async function GET(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return new Response("GM login required.", { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(v.role)) return new Response("GM only.", { status: 403 });
  const tick = Number(new URL(req.url).searchParams.get("tick") ?? 0);
  const next = tick + 1;

  const data = await prisma.$transaction(async (tx) => {
    const companies = await tx.company.findMany({ orderBy: { id: "asc" } });
    const accounts = await tx.account.findMany();
    const accName = new Map(accounts.map((a) => [a.id, `${a.ownerType} ${a.ownerId} ${a.label}`]));
    // Balances per account
    const bals = new Map<string, number>();
    for (const a of accounts) {
      const agg = await tx.journalEntry.aggregate({ where: { accountId: a.id, asset: a.label, tick: { lte: tick } }, _sum: { amount: true } });
      bals.set(a.id, agg._sum.amount ?? 0);
    }
    const coBal = (id: string, label: string) => {
      const a = accounts.find((x) => x.ownerType === "COMPANY" && x.ownerId === id && x.label === label);
      return a ? (bals.get(a.id) ?? 0) : 0;
    };
    const perCo = [];
    for (const co of companies) {
      const staff = await tx.employment.findMany({ where: { companyId: co.id, state: "ACTIVE" } });
      const salaryBill = staff.reduce((sum, e) => sum + Math.max(e.salary, SALARY_LADDER[Math.min(e.level ?? 0, 5)] ?? 100), 0);
      const tiers = await tx.companyTier.findMany({ where: { companyId: co.id } });
      const seats = await tx.requiredSeat.findMany({ where: { companyId: co.id } });
      let empty = 0;
      for (const st of seats) {
        const filled = staff.filter((e) => e.domain === st.domain).length;
        if (filled < st.required) empty += st.required - filled;
      }
      const loans = await tx.loan.findMany({ where: { borrowerCompany: co.id, state: { in: ["DISBURSED", "PARTIAL"] } } });
      const activeContracts = await tx.contract.findMany({ where: { state: "ACTIVE", startTick: { lte: next }, endTick: { gte: next }, OR: [{ sellerId: co.id }, { buyerId: co.id }] }, select: { id: true } });
      const lines = await tx.contractLine.findMany({ where: { tick: next, contractId: { in: activeContracts.map((x) => x.id) } } });
      const latest = await tx.companyTick.findFirst({ where: { companyId: co.id }, orderBy: { tick: "desc" } });
      perCo.push({ co, staff: staff.length, salaryBill, tiers, emptySeats: empty, loans, lines, rv: latest?.rv ?? null });
    }
    const journal = await tx.journalEntry.findMany({ where: { tick: { lte: tick } }, orderBy: { postedAt: "desc" }, take: 2000 });
    return { companies, accName, bals, accounts, coBal, perCo, journal };
  });

  const RES = ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"];
  const coRows = data.companies.map((co) => {
    const cells = RES.map((r) => `<td class="n">${data.coBal(co.id, r)}</td>`).join("");
    return `<tr><td><b>${esc(co.name)}</b><br/><span class="mut">${co.id} · ${co.lifecycle}</span></td><td class="n"><b>${data.coBal(co.id, "VB").toLocaleString("en-IN")}</b></td>${cells}</tr>`;
  }).join("");

  const work = data.perCo.map(({ co, staff, salaryBill, tiers, emptySeats, loans, lines, rv }) => {
    const tierTxt = tiers.map((t) => `${t.resource.slice(0, 4)}:${t.tier}@${TIER_RATES[t.tier] ?? "?"}`).join(" ");
    const loanTxt = loans.length
      ? loans.map((l) => `${l.product} ${l.principal}VB ${l.flatRate}% ${l.termTicks}t from T${l.firstDueTick}${next >= l.firstDueTick ? ` → DUE ~${Math.ceil((l.principal + pct(l.principal, l.flatRate)) / l.termTicks)}VB` : ""} [${l.state}]`).join("<br/>")
      : "none";
    const lineTxt = lines.length
      ? lines.map((l) => `contract ${(l as { contractId: string }).contractId.slice(0, 8)}: deliver ${l.unitsDue}u, collect/pay ${l.paymentDue}VB`).join("<br/>")
      : "none due";
    return `<div class="work"><h3>${esc(co.name)} <span class="mut">${co.id} · staff ${staff} · RV ${rv ?? "–"}</span></h3>
      <table><tr><th>Salaries T${next}</th><th>Consumption/tick</th><th>Empty seats (×225VB)</th></tr>
      <tr><td class="n">${salaryBill.toLocaleString("en-IN")} VB</td><td>${esc(tierTxt) || "—"}</td><td class="n">${emptySeats}</td></tr></table>
      <p><b>Loans:</b><br/>${loanTxt}</p><p><b>Contract lines due T${next}:</b><br/>${lineTxt}</p></div>`;
  }).join("");

  const jrows = [...data.journal].reverse().map((j) =>
    `<tr><td>${j.tick}</td><td>${j.txId.slice(0, 8)}</td><td>${esc(data.accName.get(j.accountId) ?? j.accountId.slice(0, 12))}</td><td>${j.asset}</td><td class="n">${j.amount}</td><td>${j.kind}</td></tr>`
  ).join("");

  const slips = Array.from({ length: 6 }, (_, i) => `<div class="slip">
    <b>TRADE SLIP ${i + 1}</b> — Tick ___ Date ___ Form no ___
    <br/>Seller ___ pays/delivers ___ to Buyer ___ : ___ units of ___ @ ___ = ___ VB.
    <br/>Signatures: ____________ / ____________ Desk: ___ Entered to platform: ☐
  </div>`).join("");

  const html = `<!doctype html><html><head><title>Paper runbook tick ${tick}</title><style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:0;padding:16px;background:#eee}
    .page{background:#fff;max-width:950px;margin:0 auto 16px;padding:20px 24px}
    table{border-collapse:collapse;width:100%;margin:8px 0} td,th{border:1px solid #999;padding:3px 6px;text-align:left} td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
    .mut{color:#555;font-size:11px} .work{border:1px solid #999;border-radius:6px;padding:8px 12px;margin:8px 0;break-inside:avoid}
    .slip{border:2px dashed #333;border-radius:6px;padding:12px;margin:10px 0;line-height:2}
    h1{font-size:22px} h2{font-size:16px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:0}
    .toolbar{display:flex;gap:12px;align-items:center;max-width:950px;margin:0 auto 12px}
    .toolbar button{font-size:15px;padding:10px 24px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer}
    ol.check li{margin:4px 0}
    @media print{ body{background:#fff;padding:0} .toolbar{display:none} .page{max-width:none;margin:0} h2{break-after:avoid} }
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print runbook</button><span>Generated ${new Date().toISOString()} · covers through tick ${tick} · run tick ${next} from this if the platform is down</span></div>
  <div class="page"><h1>Venture City — Deputy GM runbook · after tick ${tick}</h1>
  <h2>1 · Company balances (use these as opening for tick ${next})</h2>
  <table><tr><th>Company</th><th class="n">Cash VB</th>${RES.map((r) => `<th class="n">${r.slice(0, 4)}</th>`).join("")}</tr>${coRows}</table></div>
  <div class="page"><h2>2 · Tick ${next} work list (per company, in settle order)</h2>${work}
  <ol class="check"><li>Contracts: collect deliveries first, then payments; missed = penalty + breach mark, two breaches ends the contract.</li>
  <li>Salaries: pay the bill above; unpaid becomes arrears.</li><li>Consumption: deduct each resource by its tier rate (floored at 0).</li>
  <li>Loans: collect instalments marked DUE; missed twice = default.</li><li>Seats: charge 225 VB per empty seat.</li></ol></div>
  <div class="page"><h2>3 · Journal (latest ${data.journal.length} lines, newest last)</h2>
  <table><tr><th>Tick</th><th>Tx</th><th>Account</th><th>Asset</th><th class="n">Amt</th><th>Kind</th></tr>${jrows}</table></div>
  <div class="page"><h2>4 · Blank trade slips</h2>${slips}</div>
  </body></html>`;
  return new Response(html, { headers: { "content-type": "text/html", "Content-Disposition": "inline" } });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
