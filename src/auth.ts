import * as jose from "jose";
import { createHash, randomBytes } from "crypto";

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me-64chars-minimum-length-ok-1234567890");

export type Session = { kind: "participant"; pid: string } | { kind: "volunteer"; vid: string; role: string; desk?: string };

export async function signSession(s: Session): Promise<string> {
  return await new jose.SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret());
    if (payload.kind === "participant") return { kind: "participant", pid: String(payload.pid) };
    return { kind: "volunteer", vid: String(payload.vid), role: String(payload.role ?? ""), desk: payload.desk ? String(payload.desk) : undefined };
  } catch {
    return null;
  }
}

export function hashSecret(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function newQrToken(): string {
  return randomBytes(32).toString("hex");
}

export async function signImpersonate(vid: string): Promise<string> {
  return await new jose.SignJWT({ impersonate: vid })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .sign(secret());
}

export async function verifyImpersonate(token: string): Promise<string | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret());
    return typeof payload.impersonate === "string" ? payload.impersonate : null;
  } catch {
    return null;
  }
}

export function csrfToken(): string {
  return randomBytes(16).toString("hex");
}
