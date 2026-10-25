"use client";

import { useEffect, useState } from "react";

export type ChartTheme = {
  fontFamily: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  lineStrong: string;
  surface: string;
  raised: string;
  series: string[];
  other: string;
  good: string;
  bad: string;
  diverging: { lo: string; mid: string; hi: string };
};

const SERIES_SLOTS = [1, 2, 3, 4, 5];

export function readChartTheme(root: HTMLElement | null): ChartTheme {
  const styles = root ? getComputedStyle(root) : null;
  const v = (name: string) => styles?.getPropertyValue(name).trim() ?? "";
  return {
    fontFamily: v("--font-sans"),
    ink: v("--ink"),
    ink2: v("--ink-2"),
    ink3: v("--ink-3"),
    line: v("--line"),
    lineStrong: v("--line-strong"),
    surface: v("--surface"),
    raised: v("--surface-raised"),
    series: SERIES_SLOTS.map((n) => v(`--series-${n}`)),
    other: v("--series-other"),
    good: v("--good"),
    bad: v("--bad"),
    diverging: { lo: v("--div-lo"), mid: v("--div-mid"), hi: v("--div-hi") },
  };
}

const read = () => readChartTheme(typeof document === "undefined" ? null : document.documentElement);

/** Chart colours and font from the live CSS variables; refreshes when the theme changes. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(read);

  useEffect(() => {
    const refresh = () =>
      setTheme((prev) => {
        const next = read();
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener("change", refresh);
    return () => {
      observer.disconnect();
      media?.removeEventListener("change", refresh);
    };
  }, []);

  return theme;
}
