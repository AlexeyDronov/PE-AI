/** Found in browser review of the portfolio pages (steps 6.4–6.6). */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { barOption } from "@/components/charts/options";
import type { ChartTheme } from "@/components/charts/theme";
import { CapitalStructure } from "@/components/domain/portfolio/CapitalStructure";
import { CovenantTable } from "@/components/domain/portfolio/CovenantTable";

const theme = {
  fontFamily: "x", ink: "#000000", ink2: "#111111", ink3: "#222222", line: "#EEEEEE", lineStrong: "#DDDDDD",
  surface: "#FFFFFF", raised: "#FFFFFF", series: ["#1F45C8", "#E8692E", "#13A06F", "#B98200", "#D9608F"],
  other: "#8A94A6", good: "#11734A", bad: "#B42330", diverging: { lo: "#B42330", mid: "#F1F2F5", hi: "#1F45C8" },
} satisfies ChartTheme;

const facility = {
  id: "f1", company_id: "c1", created_at: "", type: "Senior term loan", pricing: "SONIA + 5.75%", covenant: "Net leverage below 6.0x",
  test_level: 6, actual: 5.6, interest_cover: 1.5, cov_lite: false, headroom: 1 - 5.6 / 6, band: "tight", next_test_date: "2027-03-31",
  company: { name: "Orbis Language Tech", hq: "London", description: "", segment_id: "s1" },
};

describe("signed bars", () => {
  it("colours each bar by sign when asked, so losses read as losses", () => {
    const o = barOption({ categories: ["Revenue growth", "Add-ons"], series: [{ name: "Lever", values: [-4, 6] }], signed: true }, theme) as Record<string, any>;
    const data = o.series[0].data;
    expect(data[0].itemStyle.color).toBe(theme.bad);
    expect(data[1].itemStyle.color).toBe(theme.good);
  });
});

describe("CapitalStructure", () => {
  it("gives the headroom meter its own full-width row, not a cramped list value", () => {
    render(<CapitalStructure facility={facility as never} threshold={0.15} />);
    const meter = screen.getByRole("meter", { name: "Covenant headroom" });
    expect(meter.closest("dd")).toBeNull();
    expect(meter.closest("[data-layout='full']")).not.toBeNull();
  });
});

describe("CovenantTable", () => {
  it("keeps short terms on one line", () => {
    render(<CovenantTable facilities={[facility as never]} threshold={0.15} />);
    const row = screen.getByRole("row", { name: /Orbis/ });
    expect(within(row).getByText("SONIA + 5.75%").closest("td")).toHaveAttribute("data-nowrap", "true");
    expect(within(row).getByText("Senior term loan").closest("td")).toHaveAttribute("data-nowrap", "true");
  });
});
