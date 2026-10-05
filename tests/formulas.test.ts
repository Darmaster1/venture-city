import { describe, it, expect } from "vitest";
import { nav, rv, multiple, bankPriceStep, creditGrade, founderE, wc } from "../src/formulas";

describe("formulas", () => {
  it("NAV sums cash + stocks + assets - debt", () => {
    expect(nav({ cash: 30050, stocks: { COMPUTE: 60 }, assetBook: 6000, debt: 0 })).toBe(30050 + 60 * 20 + 6000);
  });
  it("RV = max(NAV,0) + 6 x avg verified revenue", () => {
    expect(rv(10000, 1000)).toBe(16000);
    expect(rv(-500, 1000)).toBe(6000);
  });
  it("multiple m = 0.5 + (ceiling-0.5) x k/3", () => {
    expect(multiple(2.0, 3)).toBeCloseTo(2.0);
    expect(multiple(2.0, 0)).toBeCloseTo(0.5);
  });
  it("bank price steps", () => {
    expect(bankPriceStep(20, 400, 400)).toBe(20);
    expect(bankPriceStep(20, 100, 400)).toBe(24);
    expect(bankPriceStep(20, 50, 400)).toBe(30);
    expect(bankPriceStep(20, 0, 400)).toBe(-1);
  });
  it("credit grades", () => {
    expect(creditGrade({ completed: 2, missLast3: false, bankDebt: 0, inDefault: false, distressed: false })).toBe("A");
    expect(creditGrade({ completed: 0, missLast3: false, bankDebt: 0, inDefault: false, distressed: false })).toBe("B");
    expect(creditGrade({ completed: 5, missLast3: true, bankDebt: 0, inDefault: false, distressed: false })).toBe("C");
    expect(creditGrade({ completed: 5, missLast3: false, bankDebt: 0, inDefault: true, distressed: false })).toBe("D");
  });
  it("founder E example", () => {
    expect(founderE(1000, 1000, 80000, 100000)).toBeCloseTo(1.0);
  });
  it("WC sums levels", () => {
    expect(wc([{ level: 0, domain: "X" }], () => 100, 0)).toBe(1);
  });
});
