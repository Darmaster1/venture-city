const BASE = "https://venture-city.vercel.app";
async function main() {
  const auth = await fetch(BASE + "/api/auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ volunteerId: "gm-1", secret: "8f7426b65673c92b1701cc7e77ba1de6" })
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
