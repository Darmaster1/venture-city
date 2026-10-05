import { roundHalfAway } from "./rounding";

export const BANK_BASE: Record<string, number> = {
  COMPUTE: 20, ENERGY: 15, LOGISTICS: 20, MATERIALS: 15, DATA: 25, INFRA: 30
};

export const TIER_RATES: Record<string, number> = { LOW: 4, MEDIUM: 7, HIGH: 10, VERY_HIGH: 14 };
export const SALARY_LADDER = [100, 150, 225, 325, 450, 600];
export const DEFICIT_CHARGE = 225;
export const STORAGE_CAP = 200;

export function nav(o: { cash: number; stocks: Record<string, number>; assetBook?: number; receivables?: number; debt?: number; due?: number }): number {
  let s = o.cash + (o.assetBook ?? 0) + (o.receivables ?? 0) - (o.debt ?? 0) - (o.due ?? 0);
  for (const [r, q] of Object.entries(o.stocks)) s += q * (BANK_BASE[r] ?? 0);
  return s;
}

export function rv(navV: number, revLast2Avg: number): number {
  return Math.max(navV, 0) + 6 * revLast2Avg;
}

export function wc(employees: { level: number; domain: string }[], indexOf: (d: string) => number, specialists: number): number {
  let s = 0;
  for (const e of employees) s += (1 + e.level / 2) * (indexOf(e.domain) / 100);
  return roundHalfAway(s + 2.5 * specialists);
}

export function pricePerShare(preMoney: number, sharesOut: number): number {
  return preMoney / sharesOut;
}
export function newShares(investment: number, pps: number): number {
  return Math.floor(investment / pps);
}

export function founderE(foundingShares: number, sharesOut: number, finalRV: number, baselineRV: number): number {
  if (!baselineRV) return 0;
  return (foundingShares / sharesOut) * finalRV / (0.8 * baselineRV);
}

export function multiple(ceiling: number, k: number): number {
  return 0.5 + (ceiling - 0.5) * (k / 3);
}

export function bankPriceStep(base: number, stock: number, t1: number): number {
  if (stock <= 0) return -1; // unavailable
  const r = stock / t1;
  if (r >= 0.5) return base;
  if (r >= 0.25) return roundHalfAway(base * 1.2);
  return roundHalfAway(base * 1.5);
}

export function creditGrade(o: { completed: number; missLast3: boolean; bankDebt: number; inDefault: boolean; distressed: boolean }): string {
  if (o.inDefault || o.distressed) return "D";
  if (o.missLast3 || o.bankDebt > 20000) return "C";
  if (o.completed >= 2) return "A";
  return "B";
}

export function runway(cash: number, avgOutflow: number): number {
  if (avgOutflow <= 0) return 99;
  return Math.floor(cash / avgOutflow);
}
