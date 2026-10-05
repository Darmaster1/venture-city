export const runtime = "nodejs";
import { prisma } from "@/src/db";
import { signSession, hashSecret, csrfToken } from "@/src/auth";

async function checkRate(ip: string, route: string, limit: number): Promise<boolean> {
  // Postgres-backed token bucket (simplified): count audit rows in last minute
  const since = new Date(Date.now() - 60_000);
  const n = await prisma.auditLog.count({ where: { actor: `rl:${ip}:${route}`, createdAt: { gte: since } } }).catch(() => 0);
  if (n >= limit) return false;
  await prisma.auditLog.create({ data: { actor: `rl:${ip}:${route}`, action: "HIT" } }).catch(() => null);
  return true;
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await checkRate(ip, "login", 5))) return Response.json({ error: "Too many logins. Wait a minute." }, { status: 429 });
  const body = await req.json().catch(() => ({}));
  const res = Response.json({ ok: true });
  // Participant QR login
  if (body.qrToken) {
    const p = await prisma.participant.findUnique({ where: { qrToken: String(body.qrToken) } });
    if (!p) return Response.json({ error: "Unknown badge code." }, { status: 401 });
    const jwt = await signSession({ kind: "participant", pid: p.id });
    const csrf = csrfToken();
    const r = Response.json({ ok: true, next: "/portal", csrf });
    r.headers.append("Set-Cookie", `vc_session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`);
    r.headers.append("Set-Cookie", `vc_csrf=${csrf}; SameSite=Lax; Path=/; Max-Age=43200`);
    return r;
  }
  // Volunteer login
  if (body.volunteerId && body.secret !== undefined) {
    const v = await prisma.volunteer.findUnique({ where: { id: String(body.volunteerId) } });
    if (!v || v.loginSecretHash !== hashSecret(String(body.secret))) return Response.json({ error: "Bad credentials." }, { status: 401 });
    if (body.bootstrap === true) return Response.json({ error: "Use setup for first account." }, { status: 400 });
    const jwt = await signSession({ kind: "volunteer", vid: v.id, role: v.role, desk: v.deskOrCompany ?? undefined });
    const csrf = csrfToken();
    const next = v.role === "GM" || v.role === "DEPUTY_GM" || v.role === "TECH_LEAD" ? "/gm" : v.role === "OBSERVER" ? "/observer" : `/${(v.deskOrCompany ?? "bank").toLowerCase()}`;
    const r = Response.json({ ok: true, next, csrf });
    r.headers.append("Set-Cookie", `vc_session=${jwt}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`);
    r.headers.append("Set-Cookie", `vc_csrf=${csrf}; SameSite=Lax; Path=/; Max-Age=43200`);
    return r;
  }
  // Bootstrap first GM
  if (body.createGM && process.env.GM_BOOTSTRAP_SECRET && body.bootstrapSecret === process.env.GM_BOOTSTRAP_SECRET) {
    const v = await prisma.volunteer.create({ data: { name: String(body.name ?? "GM"), role: "GM", loginSecretHash: hashSecret(String(body.secret)), createdBy: "bootstrap" } });
    return Response.json({ ok: true, volunteerId: v.id });
  }
  return Response.json({ error: "Provide qrToken or volunteerId+secret." }, { status: 400 });
}
