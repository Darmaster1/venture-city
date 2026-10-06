export const runtime = "nodejs";

export async function POST() {
  const r = Response.json({ ok: true });
  r.headers.append("Set-Cookie", "vc_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  r.headers.append("Set-Cookie", "vc_csrf=; SameSite=Lax; Path=/; Max-Age=0");
  return r;
}
