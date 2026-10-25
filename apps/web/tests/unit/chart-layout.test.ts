/**
 * Layout rules found during browser review of /dev/components:
 * clipped edge labels, crowded money ticks, skipped category labels, bubbles cut off at the plot edge.
 */
import { describe, expect, it } from "vitest";
import {
  barOption,
  rangeBarOption,
  scatterOption,
  waterfallOption,
} from "@/components/charts/options";
import { compactMoney } from "@/components/charts/options/base";
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

type AnyOpt = Record<string, any>;
const o = (x: unknown) => x as AnyOpt;

describe("compactMoney (axis ticks, input in £m)", () => {
  it("drops needless decimals on ticks", () => {
    expect(compactMoney(0)).toBe("£0");
    expect(compactMoney(40)).toBe("£40m");
    expect(compactMoney(2.5)).toBe("£2.5m");
    expect(compactMoney(1200)).toBe("£1.2bn");
    expect(compactMoney(-200)).toBe("−£200m");
  });
});

describe("value axes use compact ticks when the values are money", () => {
  it("bar", () => {
    const opt = o(barOption({ categories: ["a"], series: [{ name: "x", values: [40] }], orientation: "horizontal", unit: "money" }, theme));
    expect(opt.xAxis.axisLabel.formatter(40)).toBe("£40m");
  });
  it("range bar", () => {
    const opt = o(rangeBarOption({ rows: [{ label: "DCF", low: 180, high: 260 }], unit: "money" }, theme));
    expect(opt.xAxis.axisLabel.formatter(200)).toBe("£200m");
    expect(opt.xAxis.splitNumber).toBeLessThanOrEqual(4);
  });
});

describe("nothing is clipped at the plot edge", () => {
  it("grids contain their labels and leave room on the right for the last tick", () => {
    const opts = [
      barOption({ categories: ["a"], series: [{ name: "x", values: [40] }], orientation: "horizontal" }, theme),
      rangeBarOption({ rows: [{ label: "DCF", low: 180, high: 260 }] }, theme),
      scatterOption({ points: [{ name: "TIC", x: 6, y: 18, size: 28 }], xLabel: "Growth", yLabel: "Margin" }, theme),
    ];
    for (const opt of opts) {
      expect(o(opt).grid.containLabel).toBe(true);
      expect(o(opt).grid.right).toBeGreaterThanOrEqual(24);
    }
  });

  it("scatter pads its axes so the largest bubble fits, and keeps axis titles off the ticks", () => {
    const opt = o(
      scatterOption(
        {
          points: [
            { name: "Small", x: 5, y: 12, size: 6 },
            { name: "Big", x: 14, y: 24, size: 41 },
          ],
          xLabel: "Growth",
          yLabel: "Margin",
        },
        theme,
      ),
    );
    const xMin = opt.xAxis.min({ min: 5, max: 14 });
    const xMax = opt.xAxis.max({ min: 5, max: 14 });
    const yMin = opt.yAxis.min({ min: 12, max: 24 });
    const yMax = opt.yAxis.max({ min: 12, max: 24 });
    expect(xMin).toBeLessThan(5);
    expect(xMax).toBeGreaterThan(14);
    expect(yMin).toBeLessThan(12);
    expect(yMax).toBeGreaterThan(24);
    expect(opt.xAxis.nameLocation).toBe("middle");
    expect(opt.yAxis.nameLocation).toBe("middle");
    expect(opt.yAxis.nameGap).toBeGreaterThanOrEqual(36);
  });
});

describe("category labels", () => {
  it("waterfall shows every step label, wrapping long ones", () => {
    const opt = o(
      waterfallOption(
        {
          steps: [
            { label: "Entry equity", value: 571, kind: "start" },
            { label: "Revenue growth", value: 241, kind: "delta" },
            { label: "Margin", value: 71, kind: "delta" },
            { label: "Multiple", value: -62, kind: "delta" },
            { label: "Fair value", kind: "end" },
          ],
        },
        theme,
      ),
    );
    expect(opt.xAxis.axisLabel.interval).toBe(0);
    expect(opt.xAxis.axisLabel.overflow).toBe("break");
    expect(opt.xAxis.axisLabel.width).toBeGreaterThan(0);
  });

  it("waterfall labels each bar with its value", () => {
    const opt = o(waterfallOption({ steps: [{ label: "Entry", value: 571, kind: "start" }, { label: "End", kind: "end" }] }, theme));
    const total = opt.series.find((s: AnyOpt) => s.name === "total");
    expect(total.label.show).toBe(true);
  });
});

describe("scatter bounds and labels (browser review round 2)", () => {
  const opt = o(
    scatterOption(
      {
        points: [
          { name: "Engineering", x: 5, y: 12, size: 22 },
          { name: "Compliance", x: 11, y: 24, size: 9 },
          { name: "Data services", x: 14, y: 17, size: 12 },
        ],
        xLabel: "Growth",
        yLabel: "Margin",
      },
      theme,
    ),
  );

  it("pads to round numbers so edge ticks read cleanly", () => {
    for (const [axis, ext] of [
      [opt.xAxis, { min: 5, max: 14 }],
      [opt.yAxis, { min: 12, max: 24 }],
    ] as const) {
      const lo = axis.min(ext);
      const hi = axis.max(ext);
      expect(Number.isInteger(lo)).toBe(true);
      expect(Number.isInteger(hi)).toBe(true);
      expect(lo).toBeLessThan(ext.min);
      expect(hi).toBeGreaterThan(ext.max);
    }
  });

  it("puts bubble labels above the bubble so the rightmost one is never clipped", () => {
    expect(opt.series[0].label.position).toBe("top");
  });
});

describe("crowded category axes (found in browser review of /portfolio: 'Deleveraging' vanished)", () => {
  const steps = (n: number) => [
    { label: "Invested", value: 571, kind: "start" as const },
    ...Array.from({ length: n - 2 }, (_, i) => ({ label: `Lever number ${i}`, value: 10, kind: "delta" as const })),
    { label: "Fair value", kind: "end" as const },
  ];

  it("angles labels when there are more than six categories, without truncating them", () => {
    const opt = o(waterfallOption({ steps: steps(8) }, theme));
    expect(opt.xAxis.axisLabel.rotate).toBe(30);
    expect(opt.xAxis.axisLabel.interval).toBe(0);
    expect(opt.xAxis.axisLabel.overflow).toBeUndefined();
  });

  it("keeps horizontal wrapped labels for six or fewer", () => {
    const opt = o(waterfallOption({ steps: steps(6) }, theme));
    expect(opt.xAxis.axisLabel.rotate ?? 0).toBe(0);
    expect(opt.xAxis.axisLabel.overflow).toBe("break");
  });

  it("applies the same rule to vertical bar charts", () => {
    const cats = Array.from({ length: 7 }, (_, i) => `Segment ${i}`);
    const opt = o(barOption({ categories: cats, series: [{ name: "x", values: cats.map(() => 1) }] }, theme));
    expect(opt.xAxis.axisLabel.rotate).toBe(30);
  });
});
