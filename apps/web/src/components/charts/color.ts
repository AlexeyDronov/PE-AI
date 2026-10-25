type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Linear blend of two hex colours; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  return toHex([ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k]);
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The candidate with the best contrast against the background. */
export function readableOn(bg: string, candidates: string[]): string {
  return candidates.reduce((best, c) => (contrastRatio(c, bg) > contrastRatio(best, bg) ? c : best));
}

/** A fill and label pair reaching `min` contrast: the fill is nudged away from the label only if no candidate is readable as-is. */
export function legiblePair(fill: string, candidates: string[], min = 4.5): { fill: string; label: string } {
  let current = fill;
  let label = readableOn(current, candidates);
  for (let i = 0; i < 25 && contrastRatio(label, current) < min; i++) {
    current = mix(current, luminance(label) > 0.5 ? "#000000" : "#FFFFFF", 0.04);
    label = readableOn(current, candidates);
  }
  return { fill: current, label };
}
