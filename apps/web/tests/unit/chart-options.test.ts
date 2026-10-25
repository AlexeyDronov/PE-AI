import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/components/charts/color";
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

type AnyOpt = Record<string, any>;
const asObj = (o: unknown) => o as AnyOpt;
const fmt = (v: number) => `£${v.toFixed(1)}m`;

const ALL = () => [
  barOption({ categories: ["A", "B"], series: [{ name: "Actual", values: [1, 2] }] }, theme),
  waterfallOption({ steps: [{ label: "Entry", value: 571, kind: "start" }, { label: "Growth", value: 241, kind: "delta" }, { label: "Now", kind: "end" }] }, theme),
  lineOption({ categories: ["2019", "2020"], series: [{ name: "NAV", values: [1, 2] }] }, theme),
  scatterOption({ points: [{ name: "TIC", x: 6, y: 18, size: 28 }], xLabel: "Growth", yLabel: "Margin" }, theme),
  heatmapOption({ xLabels: ["12x"], yLabels: ["12x"], values: [[20]], midpoint: 20, range: [5, 35] }, theme),
  rangeBarOption({ rows: [{ label: "Trading comps", low: 180, high: 240 }] }, theme),
  stackedBarOption({ categories: ["TIC"], series: [{ name: "Strategic", values: [45] }, { name: "Sponsor", values: [55] }], percent: true }, theme),
];

describe("every chart", () => {
  it("has exactly one y-axis (never dual-axis)", () => {
    for (const o of ALL()) {
      const y = asObj(o).yAxis;
      expect(Array.isArray(y)).toBe(false);
      expect(y).toBeTruthy();
    }
  });

  it("uses theme tokens for text and the sans font", () => {
    for (const o of ALL()) {
      expect(asObj(o).textStyle).toMatchObject({ fontFamily: "IBM Plex Sans" });
      expect(asObj(o).tooltip.backgroundColor).toBe(theme.raised);
    }
  });

  it("only draws horizontal gridlines", () => {
    for (const o of ALL()) {
      const x = asObj(o).xAxis;
      expect(x.splitLine?.show ?? false).toBe(false);
    }
  });
});

describe("barOption", () => {
  it("assigns colours by series order, comparison series in grey", () => {
    const o = asObj(
      barOption(
        {
          categories: ["Halden", "Orbis"],
          series: [
            { name: "Actual", values: [39.5, 9.2] },
            { name: "Budget", values: [37.0, 12.6], role: "comparison", mark: "marker" },
          ],
          orientation: "horizontal",
          valueFormat: fmt,
        },
        theme,
      ),
    );
    expect(o.series[0].type).toBe("bar");
    expect(o.series[0].itemStyle.color).toBe(theme.series[0]);
    expect(o.series[1].type).toBe("scatter");
    expect(o.series[1].itemStyle.color).toBe(theme.other);
    expect(o.yAxis.type).toBe("category");
    expect(o.xAxis.type).toBe("value");
    expect(o.legend.show).toBe(true);
    expect(o.tooltip.valueFormatter(14.6)).toBe("£14.6m");
  });

  it("hides the legend for a single series and rounds the data end", () => {
    const o = asObj(barOption({ categories: ["a"], series: [{ name: "Deals", values: [3] }], orientation: "horizontal" }, theme));
    expect(o.legend.show).toBe(false);
    expect(o.series[0].itemStyle.borderRadius).toEqual([0, 3, 3, 0]);
    const v = asObj(barOption({ categories: ["a"], series: [{ name: "Deals", values: [3] }] }, theme));
    expect(v.series[0].itemStyle.borderRadius).toEqual([3, 3, 0, 0]);
  });

  it("never invents a sixth colour; extra series fall back to grey", () => {
    const series = Array.from({ length: 7 }, (_, i) => ({ name: `s${i}`, values: [i] }));
    const o = asObj(barOption({ categories: ["a"], series }, theme));
    expect(o.series[5].itemStyle.color).toBe(theme.other);
    expect(o.series[6].itemStyle.color).toBe(theme.other);
  });
});

describe("waterfallOption", () => {
  const o = asObj(
    waterfallOption(
      {
        steps: [
          { label: "Entry equity", value: 571, kind: "start" },
          { label: "Revenue growth", value: 241, kind: "delta" },
          { label: "Multiple", value: -62, kind: "delta" },
          { label: "Fair value", kind: "end" },
        ],
      },
      theme,
    ),
  );
  const byName = (n: string) => o.series.find((s: AnyOpt) => s.name === n);

  it("floats deltas on an invisible base", () => {
    expect(byName("base").data).toEqual([0, 571, 750, 0]);
    expect(byName("base").itemStyle.color).toBe("transparent");
  });

  it("totals the end bar and colours by sign", () => {
    expect(byName("total").data).toEqual([571, "-", "-", 750]);
    expect(byName("total").itemStyle.color).toBe(theme.series[0]);
    expect(byName("increase").data).toEqual(["-", 241, "-", "-"]);
    expect(byName("increase").itemStyle.color).toBe(theme.good);
    expect(byName("decrease").data).toEqual(["-", "-", 62, "-"]);
    expect(byName("decrease").itemStyle.color).toBe(theme.bad);
  });
});

describe("lineOption", () => {
  it("draws 2px lines, optional area and a zero baseline", () => {
    const o = asObj(
      lineOption(
        {
          categories: ["2019", "2020", "2021"],
          series: [
            { name: "Net cash flow", values: [-80, -260, 100], area: true },
            { name: "NAV", values: [70, 240, 450], role: "comparison" },
          ],
          zeroLine: true,
        },
        theme,
      ),
    );
    expect(o.series[0].lineStyle.width).toBe(2);
    expect(o.series[0].areaStyle).toBeTruthy();
    expect(o.series[1].lineStyle.color).toBe(theme.other);
    expect(o.series[0].markLine.data).toEqual([{ yAxis: 0 }]);
    expect(o.tooltip.trigger).toBe("axis");
  });
});

describe("scatterOption", () => {
  it("sizes bubbles by area, monotonically", () => {
    const o = asObj(
      scatterOption(
        {
          points: [
            { name: "Small", x: 1, y: 1, size: 4 },
            { name: "Big", x: 2, y: 2, size: 36 },
          ],
          xLabel: "Growth",
          yLabel: "Margin",
        },
        theme,
      ),
    );
    const size = o.series[0].symbolSize as (d: unknown[]) => number;
    const [small, big] = o.series[0].data;
    expect(size(big)).toBeGreaterThan(size(small));
    expect(size(big) / size(small)).toBeCloseTo(3, 5);
    expect(o.series[0].itemStyle.color).toBe(theme.series[0]);
  });
});

describe("heatmapOption", () => {
  const o = asObj(
    heatmapOption(
      {
        xLabels: ["12x", "14x", "16x"],
        yLabels: ["12x", "14x"],
        values: [
          [5, 20, 35],
          [10, 20, 30],
        ],
        midpoint: 20,
        range: [5, 35],
        format: (v) => `${v.toFixed(1)}%`,
      },
      theme,
    ),
  );
  const cells: AnyOpt[] = o.series[0].data;

  it("uses a diverging scale centred on the midpoint", () => {
    const at = (x: number, y: number) => cells.find((c) => c.value[0] === x && c.value[1] === y)!;
    expect(at(1, 0).itemStyle.color.toUpperCase()).toBe(theme.diverging.mid.toUpperCase());
    expect(at(0, 0).itemStyle.color.toUpperCase()).toBe(theme.diverging.lo.toUpperCase());
    expect(at(2, 0).itemStyle.color.toUpperCase()).toBe(theme.diverging.hi.toUpperCase());
  });

  it("keeps every cell label readable", () => {
    for (const c of cells) {
      expect(contrastRatio(c.label.color, c.itemStyle.color)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("rangeBarOption", () => {
  it("floats each range from low to high", () => {
    const o = asObj(rangeBarOption({ rows: [{ label: "Trading comps", low: 180, high: 240, marker: 226 }] }, theme));
    const base = o.series.find((s: AnyOpt) => s.name === "base");
    const span = o.series.find((s: AnyOpt) => s.name === "range");
    expect(base.data).toEqual([180]);
    expect(span.data).toEqual([60]);
  });
});

describe("stackedBarOption", () => {
  it("normalises to 100% when asked", () => {
    const o = asObj(
      stackedBarOption(
        { categories: ["TIC"], series: [{ name: "Strategic", values: [1] }, { name: "Sponsor", values: [3] }], percent: true },
        theme,
      ),
    );
    expect(o.series[0].data).toEqual([25]);
    expect(o.series[1].data).toEqual([75]);
    expect(o.series.every((s: AnyOpt) => s.stack === "total")).toBe(true);
  });
});

describe("contrastRatio", () => {
  it("matches WCAG for black on white", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
});
