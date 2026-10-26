import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const instance = { setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn(), on: vi.fn(), off: vi.fn() };
const init = vi.fn(() => instance);
vi.mock("@/components/charts/loadEcharts", () => ({ loadEcharts: async () => ({ init }) }));

const { Chart } = await import("@/components/charts/Chart");
const { useChartTheme } = await import("@/components/charts/theme");

type Row = { id: string; label: string; value: number };
const rows: Row[] = [
  { id: "a", label: "Halden", value: 39.5 },
  { id: "b", label: "Orbis", value: 9.2 },
];

beforeEach(() => {
  init.mockClear();
  instance.setOption.mockClear();
  instance.dispose.mockClear();
  instance.on.mockClear();
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.cssText = "";
});

describe("Chart", () => {
  const option = { yAxis: {}, xAxis: {}, series: [] };
  const table = {
    columns: [
      { key: "label", header: "Company", render: (r: Row) => r.label },
      { key: "value", header: "EBITDA £m", align: "right" as const, render: (r: Row) => r.value.toFixed(1) },
    ],
    rows,
    getRowId: (r: Row) => r.id,
  };

  it("renders an accessible chart and passes the option to echarts", async () => {
    render(<Chart label="LTM EBITDA vs budget" option={option} table={table} />);
    expect(screen.getByRole("img", { name: "LTM EBITDA vs budget" })).toBeInTheDocument();
    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(instance.setOption).toHaveBeenCalledWith(option, expect.objectContaining({ notMerge: true }));
  });

  it("plots the latest option when it changes before ECharts has loaded", async () => {
    const { rerender } = render(<Chart label="x" option={option} table={table} />);
    const next = { ...option, series: [{ type: "line" }] };
    rerender(<Chart label="x" option={next} table={table} />);
    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    expect(instance.setOption).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenLastCalledWith(next, expect.anything());
  });

  it("updates in place when the option changes and disposes on unmount", async () => {
    const { rerender, unmount } = render(<Chart label="x" option={option} table={table} />);
    await waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    const next = { ...option, series: [{ type: "bar" }] };
    rerender(<Chart label="x" option={next} table={table} />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenLastCalledWith(next, expect.anything());
    unmount();
    expect(instance.dispose).toHaveBeenCalled();
  });

  it("switches to a table view and back", async () => {
    const user = userEvent.setup();
    render(<Chart label="LTM EBITDA vs budget" option={option} table={table} />);
    await user.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.getByRole("table", { name: "LTM EBITDA vs budget" })).toBeInTheDocument();
    expect(screen.getByText("39.5")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View as chart" }));
    expect(screen.getByRole("img", { name: "LTM EBITDA vs budget" })).toBeInTheDocument();
  });

  it("reports clicks on marks that represent an entity", async () => {
    const onSelect = vi.fn();
    render(<Chart label="x" option={option} table={table} onSelect={onSelect} />);
    await waitFor(() => expect(init).toHaveBeenCalled());
    const handler = instance.on.mock.calls.find((c) => c[0] === "click")?.[1] as (p: unknown) => void;
    handler({ name: "Halden", dataIndex: 0, seriesName: "Actual" });
    expect(onSelect).toHaveBeenCalledWith({ name: "Halden", dataIndex: 0, seriesName: "Actual" });
  });

  it("shows a skeleton instead of the plot while loading", () => {
    render(<Chart label="x" option={option} table={table} loading />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(init).not.toHaveBeenCalled();
  });
});

describe("useChartTheme", () => {
  it("reads chart tokens from CSS variables and refreshes when the theme changes", async () => {
    const root = document.documentElement;
    root.style.setProperty("--series-1", "#1F45C8");
    root.style.setProperty("--ink", "#0B1B3F");
    const { result } = renderHook(() => useChartTheme());
    expect(result.current.series[0]).toBe("#1F45C8");
    expect(result.current.ink).toBe("#0B1B3F");

    await act(async () => {
      root.style.setProperty("--series-1", "#7FA2EC");
      root.setAttribute("data-theme", "dark");
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(result.current.series[0]).toBe("#7FA2EC");
  });
});
