import { describe, it, expect } from "vitest";
import { roundHalfAway, pct } from "../src/rounding";

describe("rounding", () => {
  it("half away from zero", () => {
    expect(roundHalfAway(2.5)).toBe(3);
    expect(roundHalfAway(-2.5)).toBe(-3);
    expect(roundHalfAway(2.4)).toBe(2);
  });
  it("pct uses single rounding", () => {
    expect(pct(999, 10)).toBe(100);
  });
});
