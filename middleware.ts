import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/src/auth";

const PUBLIC = ["/", "/board", "/login", "/api/board", "/api/auth", "/api/health", "/api/paper-export"];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (PUBLIC.some((p) => path === p || path.startsWith(p + "/") || path.startsWith("/_next") || path.includes("."))) return NextResponse.next();
  const token = req.cookies.get("vc_session")?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));
  const s = await verifySession(token);
  if (!s) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
