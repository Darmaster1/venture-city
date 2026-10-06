async function main() {
  const login = await fetch("http://localhost:3000/gm", { redirect: "manual" });
  console.log("anon /gm status:", login.status, "->", login.headers.get("location"));
  const auth = await fetch("http://localhost:3000/api/auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ volunteerId: "gm-1", secret: process.env.GM_SECRET ?? process.argv[2] })
  });
  console.log("login status:", auth.status, await auth.text());
  const setCookie = auth.headers.get("set-cookie") || "";
  const m = setCookie.match(/vc_session=([^;]+)/);
  if (!m) { console.log("NO SESSION COOKIE SET"); return; }
  const cookie = `vc_session=${m[1]}`;
  for (const p of ["/gm", "/bank", "/investor", "/government", "/observer"]) {
    const r = await fetch("http://localhost:3000" + p, { headers: { cookie }, redirect: "manual" });
    const t = await r.text();
    console.log(p, "->", r.status, "len=" + t.length, "loginForm=" + t.includes("Volunteers"));
  }
}
main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
