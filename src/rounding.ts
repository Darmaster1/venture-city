export function roundHalfAway(value: number): number {
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

export function pct(amount: number, percent: number): number {
  return roundHalfAway((amount * percent) / 100);
}

export function formatVB(n: number): string {
  return `${n.toLocaleString("en-IN")} VB`;
}
