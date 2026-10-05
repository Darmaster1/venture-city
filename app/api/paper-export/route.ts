export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

// Paper fallback: printable HTML from the primary in one transaction. No client JS.
export async function GET(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return new Response("GM login required.", { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(v.role)) return new Response("GM only.", { status: 403 });
  const tick = Number(new URL(req.url).searchParams.get("tick") ?? 0);
  const data = await prisma.$transaction(async (tx) => {
    const companies = await tx.company.findMany({ orderBy: { id: "asc" } });
    const balances: Array<{ company: string; asset: string; bal: number }> = [];
    for (const co of companies) {
      const accs = await tx.account.findMany({ where: { ownerType: "COMPANY", ownerId: co.id } });
      for (const a of accs) {
        const agg = await tx.journalEntry.aggregate({ where: { accountId: a.id, asset: a.label, tick: { lte: tick } }, _sum: { amount: true } });
        balances.push({ company: co.id, asset: a.label, bal: agg._sum.amount ?? 0 });
      }
    }
    const journal = await tx.journalEntry.findMany({ where: { tick: { lte: tick } }, orderBy: { postedAt: "asc" }, take: 5000 });
    const contracts = await tx.contract.findMany({ where: { state: "ACTIVE" } });
    return { companies, balances, journal, contracts };
  });
  const rows = data.balances.map((b) => `<tr><td>${b.company}</td><td>${b.asset}</td><td style="text-align:right">${b.bal}</td></tr>`).join("");
  const jrows = data.journal.map((j) => `<tr><td>${j.tick}</td><td>${j.txId.slice(0, 8)}</td><td>${j.accountId.slice(0, 12)}</td><td>${j.asset}</td><td style="text-align:right">${j.amount}</td><td>${j.kind}</td></tr>`).join("");
  const html = `<!doctype html><html><head><title>Paper snapshot tick ${tick}</title><style>body{font-family:monospace;font-size:12px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:2px 4px}@media print{.noprint{display:none}}</style></head><body>
<h1>Venture City paper snapshot — tick ${tick} — ${new Date().toISOString()}</h1>
<p class="noprint">Print this page. Run the next tick from these balances if the platform is down.</p>
<h2>Balances</h2><table><tr><th>Company</th><th>Asset</th><th>Balance</th></tr>${rows}</table>
<h2>Journal (first 5000 lines)</h2><table><tr><th>Tick</th><th>Tx</th><th>Account</th><th>Asset</th><th>Amt</th><th>Kind</th></tr>${jrows}</table>
<h2>Trade slip (copy by hand)</h2><p>Tick __ Company __ pays __ VB to __ for __ units of __. Signatures: __ / __. Form no __.</p>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html", "Content-Disposition": "inline" } });
}
