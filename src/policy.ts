// Single visibility policy module. Every route passes through here.
export type Role =
  | "PARTICIPANT" | "COMPANY_STAFF" | "COMPANY_LEADERSHIP" | "COMPANY_ROLE"
  | "DESK_VOLUNTEER" | "GM" | "DEPUTY_GM" | "TECH_LEAD" | "LEDGER_LEAD"
  | "OBSERVER" | "MC" | "RUNNER" | "REGISTRATION" | "ANON";

export type Viewer = {
  role: Role;
  participantId?: string;
  companyId?: string;
  desk?: string;
  domain?: string;
  isLeadership?: boolean;
  tick?: number;
};

export const HIDDEN_TOKENS = ["truth_status", "hidden_need", "best_fit", "vulnerability", "lever", "rumour_E20_true"];

export function isGM(v: Viewer): boolean {
  return v.role === "GM" || v.role === "DEPUTY_GM" || v.role === "TECH_LEAD";
}

// Strip hidden fields from any object before returning to non-GM.
export function sanitize<T>(viewer: Viewer, obj: T): T {
  if (isGM(viewer)) return obj;
  if (obj === null || typeof obj !== "object") return obj;
  const strip = new Set(["truthStatus", "truth_status", "hiddenNeed", "hidden_need", "bestFit", "best_fit", "vulnerability", "lever", "rumourE20True", "rumour_E20_true", "levers", "vulnerabilities", "deck", "targets"]);
  if (Array.isArray(obj)) return obj.map((x) => sanitize(viewer, x)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (strip.has(k)) continue;
    out[k] = sanitize(viewer, v as unknown);
  }
  return out as T;
}

export function canReadCompany(viewer: Viewer, companyId: string): boolean {
  if (isGM(viewer)) return true;
  if (viewer.role === "OBSERVER" || viewer.role === "LEDGER_LEAD") return false;
  if (viewer.companyId && viewer.companyId === companyId) return true;
  if (viewer.role === "DESK_VOLUNTEER") return false; // desks get only asker's public fields via explicit allowlist
  return false;
}

export function assertNoLeak(body: string, viewer: Viewer): void {
  if (isGM(viewer)) return;
  for (const t of HIDDEN_TOKENS) {
    if (body.includes(t)) throw new Error(`Hidden field leaked: ${t}`);
  }
}

export function publicCompanyLine(c: { id: string; name: string; lifecycle: string; rv?: number; reliability?: string }): object {
  return { id: c.id, name: c.name, lifecycle: c.lifecycle, rv: c.rv ?? null, reliability: c.reliability ?? "CLEAN" };
}
