import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/src/auth";

const PUBLIC = ["/", "/board", "/login", "/api/board", "/api/auth", "/api/health", "/api/paper-export"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (req.method === "POST" && path.startsWith("/api/") && path !== "/api/auth") {
    const csrfCookie = req.cookies.get("vc_csrf")?.value;
    const csrfHeader = req.headers.get("x-csrf-token");
    if (csrfCookie && csrfHeader && csrfCookie !== csrfHeader) {
      return NextResponse.json({ error: "CSRF verification failed." }, { status: 403 });
    }
  }

  if (PUBLIC.some((p) => path === p || path.startsWith(p + "/") || path.startsWith("/_next") || path.includes("."))) return NextResponse.next();
  const token = req.cookies.get("vc_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));
  const s = await verifySession(token);
  if (!s) return NextResponse.redirect(new URL("/login", req.url));

  // Protect /gm and /api/gm routes: Only GM, DEPUTY_GM, TECH_LEAD roles allowed
  if (path === "/gm" || path.startsWith("/gm/") || path.startsWith("/api/gm")) {
    if (s.kind !== "volunteer" || !["GM", "DEPUTY_GM", "TECH_LEAD"].includes(s.role)) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
