// @vitest-environment node
/**
 * Renders every option builder through the REAL ECharts engine (server-side SVG),
 * so options that ECharts rejects at runtime fail here, not in the browser.
 * Uses the app's slim build, so a series or component it doesn't register fails here too.
 */
import { SVGRenderer } from "echarts/renderers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type EChartsOption, init, use } from "@/components/charts/echarts";
import {
  barOption,
  heatmapOption,
  lineOption,
  rangeBarOption,
  scatterOption,
  stackedBarOption,
  waterfallOption,
} from "@/components/charts/options";
import type { ChartTheme } from "@/components/charts/theme";

const theme: ChartTheme = {
  fontFamily: "IBM Plex Sans",
  ink: "#0B1B3F",
  ink2: "#3F4A5C",
  ink3: "#6B7280",
  line: "#E6E9F0",
  lineStrong: "#D0D6E0",
  surface: "#FFFFFF",
  raised: "#FFFFFF",
  series: ["#1F45C8", "#E8692E", "#13A06F", "#B98200", "#D9608F"],
  other: "#8A94A6",
  good: "#11734A",
  bad: "#B42330",
  diverging: { lo: "#B42330", mid: "#F1F2F5", hi: "#1F45C8" },
};

const CASES: [string, unknown][] = [
  [
    "bar with markers",
    barOption(
      {
        categories: ["Halden", "Orbis"],
        series: [
          { name: "Actual", values: [39.5, 9.2] },
          { name: "Budget", values: [37, 12.6], role: "comparison", mark: "marker" },
        ],
        orientation: "horizontal",
      },
      theme,
    ),
  ],
  [
    "waterfall",
    waterfallOption(
      {
        steps: [
          { label: "Entry", value: 571, kind: "start" },
          { label: "Growth", value: 241, kind: "delta" },
          { label: "Multiple", value: -62, kind: "delta" },
          { label: "Now", kind: "end" },
        ],
      },
      theme,
    ),
  ],
  [
    "line",
    lineOption(
      { categories: ["2019", "2020", "2021"], series: [{ name: "Net", values: [-80, -260, 100], area: true }], zeroLine: true, projectedFrom: 2 },
      theme,
    ),
  ],
  ["scatter", scatterOption({ points: [{ name: "TIC", x: 6, y: 18, size: 28 }], xLabel: "Growth", yLabel: "Margin" }, theme)],
  [
    "heatmap",
    heatmapOption({ xLabels: ["12x", "14x"], yLabels: ["12x", "14x"], values: [[10, 20], [20, 30]], midpoint: 20, range: [5, 35] }, theme),
  ],
  ["range bar", rangeBarOption({ rows: [{ label: "Trading comps", low: 180, high: 240, marker: 226 }] }, theme)],
  [
    "stacked 100%",
    stackedBarOption(
      { categories: ["TIC"], series: [{ name: "Strategic", values: [45] }, { name: "Sponsor", values: [55] }], percent: true },
      theme,
    ),
  ],
];

use(SVGRenderer);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("options render in real ECharts", () => {
  it.each(CASES)("%s", (_name, option) => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
    const chart = init(null, null, { renderer: "svg", ssr: true, width: 600, height: 300 });
    try {
      expect(() => chart.setOption(option as EChartsOption)).not.toThrow();
      expect([...errors.mock.calls, ...warnings.mock.calls].flat().join("\n")).not.toMatch(/ECharts/);
      // Unregistered series markers are dropped without a warning, so check they made it into the model.
      const series = ((option as { series?: Record<string, unknown>[] }).series ?? []);
      const model = (chart as unknown as { getModel(): { getComponent(type: string): unknown } }).getModel();
      for (const marker of ["markArea", "markLine", "markPoint"]) {
        if (series.some((s) => s[marker])) expect(model.getComponent(marker), marker).toBeTruthy();
      }
      const svg = chart.renderToSVGString();
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(500);
    } finally {
      chart.dispose();
    }
  });
});

