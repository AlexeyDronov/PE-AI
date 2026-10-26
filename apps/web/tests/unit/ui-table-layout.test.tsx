import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { type Column, DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSection } from "@/components/ui/PageSection";
import { Sidebar } from "@/components/ui/Sidebar";

type Row = { id: string; name: string; sub: string; ebitda: number };
const rows: Row[] = [
  { id: "a", name: "Northvale", sub: "Compliance", ebitda: 14.6 },
  { id: "b", name: "Veritest", sub: "TIC", ebitda: 31.0 },
  { id: "c", name: "Ledgerline", sub: "Payroll", ebitda: 19.0 },
];
const columns: Column<Row>[] = [
  { key: "name", header: "Company", render: (r) => r.name, sub: (r) => r.sub, sortValue: (r) => r.name },
  { key: "ebitda", header: "EBITDA £m", align: "right", render: (r) => r.ebitda.toFixed(1), sortValue: (r) => r.ebitda },
];

function bodyRows() {
  return within(screen.getAllByRole("rowgroup")[1]!).getAllByRole("row");
}

describe("DataTable", () => {
  it("renders headers, cells and sub-lines", () => {
    render(<DataTable label="Deals" columns={columns} rows={rows} getRowId={(r) => r.id} />);
    expect(screen.getByRole("table", { name: "Deals" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /EBITDA/ })).toHaveAttribute("data-align", "right");
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByText("Compliance")).toBeInTheDocument();
  });

  it("sorts by a column, toggling direction", async () => {
    render(<DataTable label="Deals" columns={columns} rows={rows} getRowId={(r) => r.id} />);
    const header = screen.getByRole("columnheader", { name: /EBITDA/ });
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(bodyRows().map((r) => r.textContent)).toEqual([
      expect.stringContaining("Northvale"),
      expect.stringContaining("Ledgerline"),
      expect.stringContaining("Veritest"),
    ]);
    await userEvent.click(within(header).getByRole("button"));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(bodyRows()[0]).toHaveTextContent("Veritest");
  });

  it("selects rows by click and arrow keys", async () => {
    const onRowClick = vi.fn();
    const { rerender } = render(
      <DataTable label="Deals" columns={columns} rows={rows} getRowId={(r) => r.id} selectedId="a" onRowClick={onRowClick} />,
    );
    expect(bodyRows()[0]).toHaveAttribute("aria-selected", "true");
    await userEvent.click(bodyRows()[1]!);
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
    rerender(
      <DataTable label="Deals" columns={columns} rows={rows} getRowId={(r) => r.id} selectedId="b" onRowClick={onRowClick} />,
    );
    fireEvent.keyDown(bodyRows()[1]!, { key: "ArrowDown" });
    expect(onRowClick).toHaveBeenLastCalledWith(rows[2]);
    fireEvent.keyDown(bodyRows()[1]!, { key: "Enter" });
    expect(onRowClick).toHaveBeenLastCalledWith(rows[1]);
  });

  it("flags recently changed rows for the live highlight", () => {
    render(<DataTable label="Deals" columns={columns} rows={rows} getRowId={(r) => r.id} isRecent={(id) => id === "c"} />);
    expect(bodyRows()[2]).toHaveAttribute("data-recent", "true");
    expect(bodyRows()[0]).not.toHaveAttribute("data-recent");
  });

  it("has loading, empty and error states", async () => {
    const { rerender } = render(<DataTable label="Deals" columns={columns} rows={[]} getRowId={(r) => r.id} loading />);
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(5);
    rerender(<DataTable label="Deals" columns={columns} rows={[]} getRowId={(r) => r.id} empty="No deals match this filter." />);
    expect(screen.getByText("No deals match this filter.")).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(
      <DataTable label="Deals" columns={columns} rows={[]} getRowId={(r) => r.id} error="Couldn't load deals." onRetry={onRetry} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("Sidebar", () => {
  it("groups links and marks the active one", () => {
    render(
      <Sidebar
        fund={{ name: "Harrowgate", detail: "Fund VII · £1.4bn" }}
        activeHref="/deals"
        groups={[
          { items: [{ href: "/", label: "Overview", icon: "home" }] },
          { label: "Deals", items: [{ href: "/deals", label: "Pipeline", icon: "list", count: 8 }] },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByText("Deals")).toBeInTheDocument();
    const active = within(nav).getByRole("link", { name: /Pipeline/ });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveTextContent("8");
    expect(within(nav).getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("treats nested routes as active for their section", () => {
    render(
      <Sidebar
        fund={{ name: "Harrowgate", detail: "Fund VII" }}
        activeHref="/deals/d1/model"
        groups={[{ items: [{ href: "/", label: "Overview", icon: "home" }, { href: "/deals", label: "Pipeline", icon: "list" }] }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Pipeline" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  // User request: a child page's own link wins, so only one item is ever selected.
  it.each([
    ["/deals/new", "Screen a teaser"],
    ["/deals", "Pipeline"],
    ["/deals/d1", "Pipeline"],
    ["/portfolio/covenants", "Covenants"],
    ["/portfolio", "Platforms"],
    ["/portfolio/p1", "Platforms"],
  ])("marks only the most specific link active on %s", (activeHref, label) => {
    render(
      <Sidebar
        fund={{ name: "Harrowgate", detail: "Fund VII" }}
        activeHref={activeHref}
        groups={[
          {
            items: [
              { href: "/deals", label: "Pipeline", icon: "list" },
              { href: "/deals/new", label: "Screen a teaser", icon: "plus" },
            ],
          },
          {
            items: [
              { href: "/portfolio", label: "Platforms", icon: "briefcase" },
              { href: "/portfolio/covenants", label: "Covenants", icon: "shield" },
            ],
          },
        ]}
      />,
    );
    const current = screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual([label]);
  });
});

describe("Breadcrumb", () => {
  it("links ancestors and marks the current page", () => {
    render(<Breadcrumb items={[{ label: "Deals", href: "/deals" }, { label: "Northvale Compliance" }]} />);
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Deals" })).toHaveAttribute("href", "/deals");
    expect(within(nav).getByText("Northvale Compliance")).toHaveAttribute("aria-current", "page");
  });
});

describe("PageHeader and PageSection", () => {
  it("page header is the single h1", () => {
    render(<PageHeader title="Pipeline" description="Scored against the buyout criteria." actions={<button type="button">Export</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Pipeline" })).toBeInTheDocument();
    expect(screen.getByText("Scored against the buyout criteria.")).toBeInTheDocument();
  });

  it("sections are labelled regions with an h2 and an anchor id", () => {
    render(
      <PageSection id="scorecard" title="Scorecard" description="Each criterion against the target">
        content
      </PageSection>,
    );
    const region = screen.getByRole("region", { name: "Scorecard" });
    expect(region).toHaveAttribute("id", "scorecard");
    expect(within(region).getByRole("heading", { level: 2, name: "Scorecard" })).toBeInTheDocument();
  });
});
