const BASE = process.env.PROD_BASE ?? "https://venture-city.vercel.app";
const GM_SECRET = process.env.GM_SECRET ?? process.argv[2];
async function main() {
  const auth = await fetch(BASE + "/api/auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ volunteerId: "gm-1", secret: GM_SECRET })
  });
  const m = (auth.headers.get("set-cookie") || "").match(/vc_session=([^;]+)/);
  const cookie = `vc_session=${m[1]}`;
  const t0 = Date.now();
  const r = await fetch(BASE + "/api/gm/settle", { method: "POST", headers: { cookie } });
  const text = await r.text();
  console.log("status:", r.status, "wall=" + ((Date.now() - t0) / 1000).toFixed(1) + "s len=" + text.length);
  console.log(text.substring(0, 1500));
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
