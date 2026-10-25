import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AlertItem } from "@/components/ui/AlertItem";
import { Card } from "@/components/ui/Card";
import { DotRating } from "@/components/ui/DotRating";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { HeadroomMeter } from "@/components/ui/HeadroomMeter";
import { KeyValueList } from "@/components/ui/KeyValueList";
import { ProgressSteps } from "@/components/ui/ProgressSteps";
import { ScoreBar } from "@/components/ui/ScoreBar";
import { Stat, StatStrip } from "@/components/ui/Stat";

describe("Stat and StatStrip", () => {
  it("shows label, value, hint and a directional delta", () => {
    render(<Stat label="Net IRR" value="12.6%" hint="Gross 17.8%" delta={{ text: "0.3pt", direction: "up", good: true }} />);
    expect(screen.getByText("Net IRR")).toBeInTheDocument();
    expect(screen.getByText("12.6%")).toBeInTheDocument();
    expect(screen.getByText("Gross 17.8%")).toBeInTheDocument();
    const delta = screen.getByTestId("stat-delta");
    expect(delta).toHaveAttribute("data-tone", "good");
    expect(delta).toHaveTextContent("▲");
    expect(delta).toHaveTextContent("0.3pt");
  });

  it("a fall can still be good (e.g. leverage)", () => {
    render(<Stat label="Leverage" value="3.6x" delta={{ text: "0.4x", direction: "down", good: true }} />);
    expect(screen.getByTestId("stat-delta")).toHaveAttribute("data-tone", "good");
    expect(screen.getByTestId("stat-delta")).toHaveTextContent("▼");
  });

  it("strip lays stats out as one list and marks only the first as the headline", () => {
    render(
      <StatStrip
        items={[
          { label: "NAV", value: "£1.2bn" },
          { label: "Net IRR", value: "12.6%" },
          { label: "TVPI", value: "1.46x" },
        ]}
      />,
    );
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("data-hero", "true");
    expect(items[1]).not.toHaveAttribute("data-hero", "true");
  });

  it("shows skeletons while loading", () => {
    render(<StatStrip loading count={4} items={[]} />);
    expect(screen.getAllByTestId("skeleton")).toHaveLength(4);
  });
});

describe("Card", () => {
  it("has a heading, description and actions", () => {
    render(
      <Card title="Sources and uses" description="£m" actions={<button type="button">Copy</button>}>
        body
      </Card>,
    );
    expect(screen.getByRole("heading", { name: "Sources and uses" })).toBeInTheDocument();
    expect(screen.getByText("£m")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
  it("can be flush for tables", () => {
    render(<Card flush testId="t">x</Card>);
    expect(screen.getByTestId("t")).toHaveAttribute("data-flush", "true");
  });
});

describe("ScoreBar", () => {
  it("is a meter whose tone follows passed-in thresholds", () => {
    const { rerender } = render(<ScoreBar value={83} thresholds={{ good: 68, warn: 55 }} label="Score" />);
    const m = screen.getByRole("meter", { name: "Score" });
    expect(m).toHaveAttribute("aria-valuenow", "83");
    expect(m).toHaveAttribute("data-tone", "good");
    expect(screen.getByText("83")).toBeInTheDocument();
    rerender(<ScoreBar value={60} thresholds={{ good: 68, warn: 55 }} label="Score" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "warn");
    rerender(<ScoreBar value={40} thresholds={{ good: 68, warn: 55 }} label="Score" />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "bad");
  });
});

describe("HeadroomMeter", () => {
  it("shows headroom against a comfort threshold", () => {
    const { rerender } = render(<HeadroomMeter label="Covenant headroom" value={0.27} threshold={0.15} />);
    const m = screen.getByRole("meter", { name: "Covenant headroom" });
    expect(m).toHaveAttribute("data-tone", "good");
    expect(screen.getByText("27%")).toBeInTheDocument();
    rerender(<HeadroomMeter label="Covenant headroom" value={0.07} threshold={0.15} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "warn");
    rerender(<HeadroomMeter label="Covenant headroom" value={-0.02} threshold={0.15} />);
    expect(screen.getByRole("meter")).toHaveAttribute("data-tone", "bad");
  });
});

describe("DotRating", () => {
  it("is announced as a score out of the max", () => {
    render(<DotRating value={2} max={3} label="Technical moat" />);
    expect(screen.getByRole("img", { name: "Technical moat: 2 of 3" })).toBeInTheDocument();
  });
});

describe("KeyValueList", () => {
  it("renders terms and values, with an emphasised total", () => {
    render(
      <KeyValueList
        items={[
          { label: "Senior debt", value: "43.8" },
          { label: "Total uses", value: "234.5", emphasis: true },
        ]}
      />,
    );
    expect(screen.getByText("Senior debt").tagName).toBe("DT");
    expect(screen.getByText("234.5").closest("dd")).toHaveAttribute("data-emphasis", "true");
  });
});

describe("AlertItem", () => {
  it("shows severity label, entity, body and suggested action", () => {
    render(
      <AlertItem
        severity="bad"
        label="Action"
        title="Orbis Language Tech"
        body="Net leverage of 5.6x leaves 7% headroom."
        action="Open lender dialogue."
        meta="2h ago"
      />,
    );
    expect(screen.getByText("Action")).toHaveAttribute("data-tone", "bad");
    expect(screen.getByText("Orbis Language Tech")).toBeInTheDocument();
    expect(screen.getByText(/Suggested:/)).toHaveTextContent("Suggested: Open lender dialogue.");
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });
});

describe("ProgressSteps", () => {
  const steps = [
    { key: "extract", label: "Extract" },
    { key: "score", label: "Score" },
    { key: "flags", label: "Flags" },
  ];

  it("marks steps before the current one as done", () => {
    render(<ProgressSteps steps={steps} current="score" status="running" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[1]).toHaveAttribute("data-state", "current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).toHaveAttribute("data-state", "todo");
  });

  it("marks everything done on success", () => {
    render(<ProgressSteps steps={steps} current="flags" status="succeeded" />);
    expect(screen.getAllByRole("listitem").every((i) => i.getAttribute("data-state") === "done")).toBe(true);
  });

  it("shows the failed step with a retry", async () => {
    const onRetry = vi.fn();
    render(<ProgressSteps steps={steps} current="score" status="failed" error="Quota exceeded" onRetry={onRetry} />);
    expect(screen.getAllByRole("listitem")[1]).toHaveAttribute("data-state", "failed");
    expect(screen.getByText("Quota exceeded")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("States", () => {
  it("EmptyState has a title, sentence and action", () => {
    render(<EmptyState title="No reports yet" body="Run research to create one." action={<button type="button">Run research</button>} />);
    expect(screen.getByText("No reports yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run research" })).toBeInTheDocument();
  });
  it("ErrorState offers retry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Couldn't load deals." onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load deals.");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
  it("Skeleton is hidden from assistive tech", () => {
    render(<Skeleton width="60%" />);
    expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden", "true");
  });
});
