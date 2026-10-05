export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function GET(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const parts = await prisma.participant.findMany({ orderBy: { badgeNo: "asc" } });
  const host = new URL(req.url).origin;
  const rows = parts.map((p) => `<div style="border:1px solid #999;padding:12px;margin:8px;display:inline-block;width:280px"><b>${p.name}</b><br/>Badge ${p.badgeNo}<br/><a href="${host}/login?qr=${p.qrToken}">${host}/login?qr=${p.qrToken}</a><br/><small>${p.qrToken}</small></div>`).join("");
  return new Response(`<html><body><h1>Badges (${parts.length})</h1>${rows}</body></html>`, { headers: { "content-type": "text/html" } });
}
