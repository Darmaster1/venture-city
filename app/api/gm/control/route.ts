import { prisma } from "@/src/db";
import { verifySession } from "@/src/auth";

async function gmFrom(req: Request) {
  const raw = req.headers.get("cookie") ?? "";
  const match = raw.match(/vc_session=([^;]+)/);
  const session = match ? await verifySession(decodeURIComponent(match[1])) : null;
  return session?.kind === "volunteer" && ["GM", "DEPUTY_GM", "TECH_LEAD"].includes(session.role) ? session : null;
}

export async function GET(req: Request) {
  const session = await gmFrom(req);
  if (!session) return Response.json({ error: "GM login required." }, { status: 403 });
  const [lanes, toggles, rulings, accounts] = await Promise.all([
    prisma.lane.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.featureToggle.findMany({ orderBy: { key: "asc" } }),
    prisma.ruling.findMany({ orderBy: { id: "desc" }, take: 50 }),
    prisma.volunteer.findMany({ where: { role: { in: ["GM", "DEPUTY_GM", "TECH_LEAD"] } }, select: { id: true, name: true, role: true, deskOrCompany: true } })
  ]);
  return Response.json({ lanes, toggles, rulings, accounts });
}

export async function POST(req: Request) {
  const session = await gmFrom(req);
  if (!session) return Response.json({ error: "GM login required." }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (action === "ruling") {
    const text = String(body.text ?? "").trim();
    if (!text) return Response.json({ error: "Ruling text is required." }, { status: 400 });
    const run = await prisma.run.findFirst({ orderBy: { date: "desc" } });
    const ruling = await prisma.ruling.create({ data: { tick: run?.currentTick ?? 0, text, by: session.vid } });
    await prisma.auditLog.create({ data: { tick: run?.currentTick ?? 0, actor: session.vid, action: "RULING_CREATED", refType: "Ruling", refId: ruling.id } });
    return Response.json({ ok: true, ruling }, { status: 201 });
  }
  if (action === "toggle") {
    const key = String(body.key ?? "");
    const enabled = Boolean(body.enabled);
    const exists = await prisma.featureToggle.findUnique({ where: { key } });
    if (!exists) return Response.json({ error: "Unknown feature toggle." }, { status: 400 });
    const toggle = await prisma.featureToggle.update({ where: { key }, data: { enabled } });
    await prisma.auditLog.create({ data: { actor: session.vid, action: enabled ? "FEATURE_ENABLED" : "FEATURE_DISABLED", refType: "FeatureToggle", refId: key } });
    return Response.json({ ok: true, toggle });
  }
  if (action === "lane") {
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!code || !name) return Response.json({ error: "Lane code and name are required." }, { status: 400 });
    const lane = await prisma.lane.upsert({ where: { code }, create: { code, name, desk: String(body.desk ?? "GM"), description: String(body.description ?? ""), sortOrder: Number(body.sortOrder ?? 99) }, update: { name, desk: String(body.desk ?? "GM"), description: String(body.description ?? ""), active: body.active !== false } });
    return Response.json({ ok: true, lane });
  }
  return Response.json({ error: "Action must be ruling, toggle, or lane." }, { status: 400 });
}
