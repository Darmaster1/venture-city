export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

export async function POST(req: Request) {
  const c = req.headers.get("cookie") ?? "";
  const m = c.match(/vc_session=([^;]+)/);
  const s = m ? await verifySession(decodeURIComponent(m[1])) : null;
  if (!s || s.kind !== "volunteer") return Response.json({ error: "Login required." }, { status: 401 });
  const v = await prisma.volunteer.findUnique({ where: { id: s.vid } });
  if (!v || !["GM", "DEPUTY_GM"].includes(v.role)) return Response.json({ error: "GM only." }, { status: 403 });
  const entries = await prisma.journalEntry.findMany({ take: 50000, orderBy: { postedAt: "asc" } });
  const lines = entries.map((e) => JSON.stringify({ tx: e.txId, tick: e.tick, acc: e.accountId, asset: e.asset, amt: e.amount, kind: e.kind })).join("\n");
  try {
    const { put } = await import("@vercel/blob");
    const blob = await put(`backup-${Date.now()}.ndjson`, lines, { access: "public" });
    return Response.json({ ok: true, url: blob.url, count: entries.length });
  } catch {
    return new Response(lines, { headers: { "content-type": "application/x-ndjson" } });
  }
}
