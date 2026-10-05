export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";
import QRCode from "qrcode";

const CO: Record<string, string> = {
  SWC: "#3B6EA5", LED: "#6A4C93", MAN: "#C25E2B", SKF: "#2F855A", PAI: "#2C6B7A",
  GRG: "#4A7C2F", MED: "#A53F6B", STH: "#5A5A66", VLT: "#B4741A", TRL: "#7A3E9C"
};

export async function GET(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return new Response("GM login required.", { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return new Response("GM only.", { status: 403 });

  const host = new URL(req.url).origin;
  const parts = await prisma.participant.findMany({ orderBy: [{ companyId: "asc" }, { badgeNo: "asc" }] });
  const vols = await prisma.volunteer.findMany({ orderBy: { name: "asc" } });
  const companies = await prisma.company.findMany({ where: { active: true } });
  const coName = new Map(companies.map((x) => [x.id, x.name]));

  const cards: string[] = [];
  for (const p of parts) {
    const url = `${host}/login?qr=${p.qrToken}`;
    const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 });
    const color = CO[p.companyId ?? ""] ?? "#6C3DF4";
    cards.push(`<div class="badge">
      <div class="stripe" style="background:${color}"></div>
      <div class="bbody">
        <div class="bname">${esc(p.name)}</div>
        <div class="bco">${esc(coName.get(p.companyId ?? "") ?? "Unassigned")} · Badge ${esc(p.badgeNo)}</div>
        <div class="brow"><img class="qr" src="${qr}" alt="login qr" /><div class="bhelp">Scan to sign in.<br/>No password needed.<br/><span class="tiny">${esc(url)}</span></div></div>
      </div>
    </div>`);
  }
  const tents: string = vols.map((x) => `<div class="tent">
      <div class="bname">${esc(x.name)}</div>
      <div class="bco">${esc(x.role)}${x.deskOrCompany ? ` · ${esc(x.deskOrCompany)}` : ""}</div>
      <div class="cred">ID <b>${esc(x.id)}</b> · ask the GM for your secret</div>
    </div>`).join("");

  const html = `<!doctype html><html><head><title>Venture City badges (${parts.length})</title><style>
    *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;background:#eee;margin:0;padding:16px}
    .toolbar{max-width:900px;margin:0 auto 16px;display:flex;gap:12px;align-items:center}
    .toolbar button{font-size:15px;padding:10px 22px;border-radius:8px;border:0;background:#6C3DF4;color:#fff;cursor:pointer}
    .sheet{max-width:900px;margin:0 auto}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .badge{background:#fff;border:2px dashed #999;border-radius:10px;display:flex;overflow:hidden;height:215px}
    .stripe{width:12px}
    .bbody{padding:12px 14px;flex:1}
    .bname{font-size:21px;font-weight:800}
    .bco{font-size:14px;color:#444;margin:2px 0 8px}
    .brow{display:flex;gap:12px;align-items:center}
    .qr{width:110px;height:110px}
    .bhelp{font-size:12px;color:#333}
    .tiny{font-size:8px;color:#888;word-break:break-all}
    .tent{background:#fff;border:2px dashed #999;border-radius:10px;padding:14px;margin-top:12px}
    .cred{font-size:14px;margin-top:6px}
    h2{page-break-before:always}
    @media print{
      body{background:#fff;padding:0}
      .toolbar{display:none}
      .sheet{max-width:none}
      .page{page-break-after:always}
      h2{margin:0 0 8px}
    }
  </style></head><body>
  <div class="toolbar"><button onclick="window.print()">Print all ${parts.length} badges</button><span>${parts.length} participants · cut along dashed lines · print after the final T0 reset</span></div>
  <div class="sheet">${pages(cards)}<h2>Crew tent cards (${vols.length}) — hand out with secrets separately</h2><div class="grid">${tents}</div></div>
  </body></html>`;
  return new Response(html, { headers: { "content-type": "text/html" } });
}

function pages(cards: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < cards.length; i += 8)
    out.push(`<div class="page"><div class="grid">${cards.slice(i, i + 8).join("")}</div></div>`);
  return out.join("");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
