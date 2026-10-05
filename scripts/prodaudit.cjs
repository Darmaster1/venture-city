const BASE = "https://venture-city.vercel.app";
async function main() {
  const home = await fetch(BASE + "/");
  const homeText = await home.text();
  console.log("landing:", home.status, "hasBrand=" + homeText.includes("Venture City"));
  const board = await fetch(BASE + "/api/board").then((r) => r.json());
  console.log("board: tick=" + board.tick, "clock=" + board.clock, "companies=" + board.companies.length);
  const auth = await fetch(BASE + "/api/auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ volunteerId: "gm-1", secret: "8f7426b65673c92b1701cc7e77ba1de6" })
  });
  console.log("gm login:", auth.status);
  const setCookie = auth.headers.get("set-cookie") || "";
  const m = setCookie.match(/vc_session=([^;]+)/);
  if (!m) { console.log("NO SESSION COOKIE"); return; }
  const cookie = `vc_session=${m[1]}`;
  const t0 = Date.now();
  const settle = await fetch(BASE + "/api/gm/settle", { method: "POST", headers: { cookie } }).then((r) => r.json().then((j) => ({ status: r.status, j })));
  console.log("settle:", settle.status, "tick=" + settle.j.tick, "ms=" + settle.j.ms, "steps=" + (settle.j.log || []).length, "err=" + (settle.j.error || "none"), "wall=" + (Date.now() - t0) + "ms");
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
