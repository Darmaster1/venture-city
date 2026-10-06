const BASE = process.env.PROD_BASE ?? "https://venture-city.vercel.app";
const GM_SECRET = process.env.GM_SECRET ?? process.argv[2];
if (!GM_SECRET) { console.error("Set GM_SECRET env or pass the gm-1 secret as argv[2]."); process.exit(1); }
async function main() {
  const auth = await fetch(BASE + "/api/auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ volunteerId: "gm-1", secret: GM_SECRET })
  });
  const setCookie = auth.headers.get("set-cookie") || "";
  const m = setCookie.match(/vc_session=([^;]+)/);
  if (!m) { console.log("LOGIN FAILED", auth.status); return; }
  const cookie = `vc_session=${m[1]}`;
  // wait for any in-flight deploy? just fetch
  const t0 = Date.now();
  const r = await fetch(BASE + "/api/paper-export?tick=0", { headers: { cookie } });
  const text = await r.text();
  console.log("status:", r.status, "wall=" + (Date.now() - t0) + "ms", "len=" + text.length);
  console.log(text.substring(0, 500));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
