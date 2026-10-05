import { describe, it, expect } from "vitest";
import { sanitize, assertNoLeak, canReadCompany } from "../src/policy";

describe("policy", () => {
  it("company A cannot read company B", () => {
    expect(canReadCompany({ role: "COMPANY_STAFF", companyId: "SWC" }, "LED")).toBe(false);
    expect(canReadCompany({ role: "COMPANY_STAFF", companyId: "SWC" }, "SWC")).toBe(true);
  });
  it("hidden fields stripped for non-GM, kept for GM", () => {
    const obj = { name: "x", truth_status: "TRUE", hidden_need: 1, best_fit: 2, vulnerability: 3, lever: 4, rumour_E20_true: true };
    const clean = sanitize({ role: "PARTICIPANT" }, obj);
    expect(JSON.stringify(clean)).not.toContain("truth_status");
    const kept = sanitize({ role: "GM" }, obj);
    expect(JSON.stringify(kept)).toContain("truth_status");
  });
  it("leak assertion throws on hidden tokens", () => {
    expect(() => assertNoLeak('{"truth_status":1}', { role: "PARTICIPANT" })).toThrow();
    expect(() => assertNoLeak('{"ok":1}', { role: "PARTICIPANT" })).not.toThrow();
  });
});
