export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import { SALARY_LADDER, TIER_RATES } from "@/src/formulas";
import { pct } from "@/src/rounding";

// Paper fallback: a Deputy GM runbook. Print at every tick boundary.
// Fully server-rendered, no client JS, GM session only.
// Reads are tick-bounded against the append-only journal, so they are
// consistent without an interactive transaction (which would time out
// on serverless). Balances come from one GROUP BY query.
export async function GET(req: Request) {
  try {
    const c = req.headers.get("cookie") ?? "";
    const m = c.match(/vc_session=([^;]+)/);
    const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
    if (!s || s.kind !== "volunteer") return new Response("GM login required.", { status: 401 });
    const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
    if (!v || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(v.role)) return new Response("GM only.", { status: 403 });
    const tick = Number(new URL(req.url).searchParams.get("tick") ?? 0);
    const next = tick + 1;

    const [balRows, companies, accounts, employments, tiers, seats, loans, contracts, lines, latest, journal] = await Promise.all([
      prisma.$queryRaw<Array<{ accountId: string; asset: string; bal: bigint }>>`
        SELECT "accountId", asset, SUM(amount)::bigint AS bal FROM "JournalEntry" WHERE tick <= ${tick} GROUP BY "accountId", asset`,
      prisma.company.findMany({ orderBy: { id: "asc" } }),
      prisma.account.findMany(),
      prisma.employment.findMany({ where: { state: "ACTIVE" } }),
      prisma.companyTier.findMany(),
      prisma.requiredSeat.findMany(),
      prisma.loan.findMany({ where: { state: { in: ["DISBURSED", "PARTIAL"] } } }),
      prisma.contract.findMany({ where: { state: "ACTIVE", startTick: { lte: next }, endTick: { gte: next } }, select: { id: true, sellerId: true, buyerId: true } }),
      prisma.contractLine.findMany({ where: { tick: next } }),
      prisma.companyTick.findMany({ orderBy: { tick: "desc" } }),
      prisma.journalEntry.findMany({ where: { tick: { lte: tick } }, orderBy: { postedAt: "desc" }, take: 2000 })
    ]);

    const balOf = new Map<string, number>();
    for (const r of balRows) balOf.set(`${r.accountId}|${r.asset}`, Number(r.bal));
    const accById = new Map(accounts.map((a) => [a.id, a]));
    const accName = (id: string) => {
      const a = accById.get(id);
      return a ? `${a.ownerType} ${a.ownerId} ${a.label}` : id.slice(0, 12);
    };
    const coBal = (id: string, label: string) => {
      const a = accounts.find((x) => x.ownerType === "COMPANY" && x.ownerId === id && x.label === label);
      return a ? (balOf.get(`${a.id}|${label}`) ?? 0) : 0;
    };
    const rvOf = new Map<string, number>();
    for (const t of latest) if (!rvOf.has(t.companyId)) rvOf.set(t.companyId, t.rv);
    const liveLines = lines.filter((l) => contracts.some((x) => x.id === l.contractId));

    const RES = ["COMPUTE", "ENERGY", "LOGISTICS", "MATERIALS", "DATA", "INFRA"];
    const coRows = companies.map((co) => {
      const cells = RES.map((r) => `<td class="n">${coBal(co.id, r)}</td>`).join("");
      return `<tr><td><b>${esc(co.name)}</b><br/><span class="mut">${co.id} · ${co.lifecycle}</span></td><td class="n"><b>${coBal(co.id, "VB").toLocaleString("en-IN")}</b></td>${cells}</tr>`;
    }).join("");

    const work = companies.map((co) => {
      const staff = employments.filter((e) => e.companyId === co.id);
      const salaryBill = staff.reduce((sum, e) => sum + Math.max(e.salary, SALARY_LADDER[Math.min(e.level ?? 0, 5)] ?? 100), 0);
      const tierTxt = tiers.filter((t) => t.companyId === co.id).map((t) => `${t.resource.slice(0, 4)}:${t.tier}@${TIER_RATES[t.tier] ?? "?"}`).join(" ");
      const empty = seats.filter((st) => st.companyId === co.id).reduce((n, st) => {
        const filled = staff.filter((e) => e.domain === st.domain).length;
        return n + Math.max(0, st.required - filled);
      }, 0);
      const coLoans = loans.filter((l) => l.borrowerCompany === co.id);
      const loanTxt = coLoans.length
        ? coLoans.map((l) => `${l.product} ${l.principal}VB ${l.flatRate}% ${l.termTicks}t from T${l.firstDueTick}${next >= l.firstDueTick ? ` → DUE ~${Math.ceil((l.principal + pct(l.principal, l.flatRate)) / l.termTicks)}VB` : ""} [${l.state}]`).join("<br/>")
        : "none";
      const coLines = liveLines.filter((l) => contracts.some((x) => x.id === l.contractId && (x.sellerId === co.id || x.buyerId === co.id)));
      const lineTxt = coLines.length
        ? coLines.map((l) => `contract ${l.contractId.slice(0, 8)}: deliver ${l.unitsDue}u, collect/pay ${l.paymentDue}VB`).join("<br/>")
        : "none due";
      return `<div class="work"><h3>${esc(co.name)} <span class="mut">${co.id} · staff ${staff.length} · RV ${rvOf.get(co.id) ?? "–"}</span></h3>
        <table><tr><th>Salaries T${next}</th><th>Consumption/tick</th><th>Empty seats (×225VB)</th></tr>
        <tr><td class="n">${salaryBill.toLocaleString("en-IN")} VB</td><td>${esc(tierTxt) || "—"}</td><td class="n">${empty}</td></tr></table>
        <p><b>Loans:</b><br/>${loanTxt}</p><p><b>Contract lines due T${next}:</b><br/>${lineTxt}</p></div>`;
    }).join("");

    const jrows = [...journal].reverse().map((j) =>
      `<tr><td>${j.tick}</td><td>${j.txId.slice(0, 8)}</td><td>${esc(accName(j.accountId))}</td><td>${j.asset}</td><td class="n">${j.amount}</td><td>${j.kind}</td></tr>`
    ).join("");

    const slips = Array.from({ length: 6 }, (_, i) => `<div class="slip">
      <b>TRADE SLIP ${i + 1}</b> — Tick ___ Date ___ Form no ___
      <br/>Seller ___ pays/delivers ___ to Buyer ___ : ___ units of ___ @ ___ = ___ VB.
      <br/>Signatures: ____________ / ____________ Desk: ___ Entered to platform: ☐
    </div>`).join("");

    const html = `<!doctype html><html><head><title>Paper runbook tick ${tick}</title><style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:0;padding:16px;background:#eee}
      .page{background:#fff;max-width:950px;margin:0 auto 16px;padding:20px 24px}
      table{border-collapse:collapse;width:100%;margin:8px 0} td,th{border:1px solid #999;padding:3px 6px;text-align:left} td.n{text-align:right;font-variant-numeric:tabular-nums}
      .mut{color:#555;font-size:11px} .work{border:1px solid #999;border-radius:6px;padding:8px 12px;margin:8px 0;break-inside:avoid}
      .slip{border:2px dashed #333;border-radius:6px;padding:12px;margin:10px 0;line-height:2}
      h1{font-size:22px} h2{font-size:16px;border-bottom:2px solid #111;padding-bottom:4px;margin-top:0}
      .toolbar{display:flex;gap:12px;align-items:center;max-width:950px;margin:0 auto 12px}
      .toolbar button{font-size:15px;padding:10px 24px;border-radius:8px;border:0;background:#111;color:#fff;cursor:pointer}
      ol.check li{margin:4px 0}
      @media print{ body{background:#fff;padding:0} .toolbar{display:none} .page{max-width:none;margin:0} }
    </style></head><body>
    <div class="toolbar"><button onclick="window.print()">Print runbook</button><span>Generated ${new Date().toISOString()} · covers through tick ${tick} · run tick ${next} from this if the platform is down</span></div>
    <div class="page"><h1>Venture City — Deputy GM runbook · after tick ${tick}</h1>
    <h2>1 · Company balances (opening for tick ${next})</h2>
    <table><tr><th>Company</th><th class="n">Cash VB</th>${RES.map((r) => `<th class="n">${r.slice(0, 4)}</th>`).join("")}</tr>${coRows}</table></div>
    <div class="page"><h2>2 · Tick ${next} work list (in settle order)</h2>${work}
    <ol class="check"><li>Contracts: deliveries first, then payments; missed = penalty + breach mark, two breaches ends the contract.</li>
    <li>Salaries: pay the bill above; unpaid becomes arrears.</li><li>Consumption: deduct each resource by its tier rate (floored at 0).</li>
    <li>Loans: collect instalments marked DUE; missed twice = default.</li><li>Seats: charge 225 VB per empty seat.</li></ol></div>
    <div class="page"><h2>3 · Journal (latest ${journal.length} lines, newest last)</h2>
    <table><tr><th>Tick</th><th>Tx</th><th>Account</th><th>Asset</th><th class="n">Amt</th><th>Kind</th></tr>${jrows}</table></div>
    <div class="page"><h2>4 · Blank trade slips</h2>${slips}</div>
    </body></html>`;
    return new Response(html, { headers: { "content-type": "text/html", "Content-Disposition": "inline" } });
  } catch (e) {
    return new Response(`Paper export failed: ${(e as Error).message}`, { status: 500, headers: { "content-type": "text/plain" } });
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
