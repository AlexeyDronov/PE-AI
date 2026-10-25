/** Found in browser review of the Deal model with real data (step 6.3). */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { waterfallOption } from "@/components/charts/options";
import type { ChartTheme } from "@/components/charts/theme";
import { AssumptionsPanel } from "@/components/domain/model/AssumptionsPanel";

const theme = {
  fontFamily: "x", ink: "#000000", ink2: "#111111", ink3: "#222222", line: "#EEEEEE", lineStrong: "#DDDDDD",
  surface: "#FFFFFF", raised: "#FFFFFF", series: ["#1F45C8", "#E8692E", "#13A06F", "#B98200", "#D9608F"],
  other: "#8A94A6", good: "#11734A", bad: "#B42330", diverging: { lo: "#B42330", mid: "#F1F2F5", hi: "#1F45C8" },
} satisfies ChartTheme;

type AnyOpt = Record<string, any>;
const labelOf = (series: AnyOpt, value: number | string) => series.label.formatter({ value });

describe("waterfall labels with unit money", () => {
  const o = waterfallOption(
    {
      steps: [
        { label: "Entry equity", value: 168.7, kind: "start" },
        { label: "EBITDA growth", value: 257.9873017917594, kind: "delta" },
        { label: "Multiple", value: 0, kind: "delta" },
        { label: "Fees", value: -6.1685, kind: "delta" },
        { label: "Exit equity", kind: "end" },
      ],
      unit: "money",
    },
    theme,
  ) as AnyOpt;
  const s = (name: string) => o.series.find((x: AnyOpt) => x.name === name);

  it("formats gains and losses as compact money, never raw floats", () => {
    expect(labelOf(s("increase"), 257.9873017917594)).toBe("+£258m");
    expect(labelOf(s("decrease"), 6.1685)).toBe("(£6.2m)");
  });

  it("does not label zero steps or empty cells", () => {
    expect(labelOf(s("increase"), 0)).toBe("");
    expect(labelOf(s("increase"), "-")).toBe("");
  });
});

describe("AssumptionsPanel before the model has loaded", () => {
  it("shows placeholders instead of sliders parked at their minimums", () => {
    render(
      <AssumptionsPanel overrides={{}} scenario="base" onScenarioChange={vi.fn()} onOverride={vi.fn()} onReset={vi.fn()} />,
    );
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(6);
  });
});
