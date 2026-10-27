/** Plan step 8.11: a report the sources only partly answer is labelled "Partial answer". */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReportDetail, ReportList } from "@/components/domain/research";
import type { ReportDetailData, ReportSummary } from "@/components/domain/research/types";

const summary = (id: string, status: string) =>
  ({ id, question: `Question ${id}`, summary: `Summary ${id}`, created_at: "2026-10-27T10:00:00Z", source: "agent", segment_id: null, status, model: null }) as ReportSummary;

const detail = (status: string) =>
  ({ ...summary("r1", status), findings: [], sources: [] }) as unknown as ReportDetailData;

describe("Partial answers", () => {
  it("labels a partial report in the list, and only that one", () => {
    render(<ReportList reports={[summary("r1", "partial"), summary("r2", "complete")]} onSelect={() => undefined} />);
    const [partial, complete] = within(screen.getByTestId("report-list")).getAllByRole("button") as [HTMLElement, HTMLElement];
    expect(within(partial).getByText("Partial answer")).toBeTruthy();
    expect(within(complete).queryByText("Partial answer")).toBeNull();
  });

  it("labels a partial report's detail and explains what it means", () => {
    render(<ReportDetail report={detail("partial")} />);
    const detailEl = screen.getByTestId("report-detail");
    expect(within(detailEl).getByText("Partial answer")).toBeTruthy();
    expect(detailEl.textContent).toMatch(/sources did not directly answer/i);
  });

  it("shows no label on a complete report", () => {
    render(<ReportDetail report={detail("complete")} />);
    expect(screen.queryByText("Partial answer")).toBeNull();
  });
});
