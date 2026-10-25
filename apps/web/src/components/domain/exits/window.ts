/** Sort key for an exit window such as "H1 2027", "2026-2027" or "2028": year first, then H1 before H2. */
export function windowStart(window: string): number {
  const year = Number(/\d{4}/.exec(window)?.[0] ?? Number.MAX_SAFE_INTEGER / 10);
  const half = /H([12])/.exec(window)?.[1];
  return year * 10 + (half ? Number(half) : 0);
}
