import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Slider } from "@/components/ui/Slider";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea, TextField } from "@/components/ui/TextField";

describe("Button", () => {
  it("defaults to a secondary, type=button control", () => {
    render(<Button>Export</Button>);
    const b = screen.getByRole("button", { name: "Export" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveAttribute("data-variant", "secondary");
  });

  it("supports variants and sizes", () => {
    render(
      <Button variant="primary" size="sm">
        Build model
      </Button>,
    );
    const b = screen.getByRole("button", { name: "Build model" });
    expect(b).toHaveAttribute("data-variant", "primary");
    expect(b).toHaveAttribute("data-size", "sm");
  });

  it("is busy and inert while loading, keeping its name", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Screening
      </Button>,
    );
    const b = screen.getByRole("button", { name: /screening/i });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toBeDisabled();
    await userEvent.click(b);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders an optional leading icon", () => {
    render(<Button icon={<svg data-testid="icon" />}>Export</Button>);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("carries its tone and text", () => {
    render(<Badge tone="good">Advance</Badge>);
    expect(screen.getByText("Advance")).toHaveAttribute("data-tone", "good");
  });
  it("defaults to neutral", () => {
    render(<Badge>CIM</Badge>);
    expect(screen.getByText("CIM")).toHaveAttribute("data-tone", "neutral");
  });
});

function Seg() {
  const [v, setV] = useState("base");
  return (
    <SegmentedControl
      label="Case"
      value={v}
      onChange={setV}
      options={[
        { value: "down", label: "Downside" },
        { value: "base", label: "Base" },
        { value: "up", label: "Upside" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("is a labelled group of pressed buttons", () => {
    render(<Seg />);
    expect(screen.getByRole("group", { name: "Case" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Base" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Upside" })).toHaveAttribute("aria-pressed", "false");
  });

  it("changes on click and with arrow keys", async () => {
    render(<Seg />);
    await userEvent.click(screen.getByRole("button", { name: "Upside" }));
    expect(screen.getByRole("button", { name: "Upside" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Upside" }), { key: "ArrowLeft" });
    expect(screen.getByRole("button", { name: "Base" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.keyDown(screen.getByRole("button", { name: "Base" }), { key: "ArrowRight" });
    expect(screen.getByRole("button", { name: "Upside" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Tabs", () => {
  it("renders link tabs with the current one selected", () => {
    render(
      <Tabs
        label="Deal"
        value="model"
        tabs={[
          { value: "overview", label: "Overview", href: "/deals/d1" },
          { value: "model", label: "Model", href: "/deals/d1/model" },
          { value: "memo", label: "IC memo", href: "/deals/d1/memo" },
        ]}
      />,
    );
    expect(screen.getByRole("tablist", { name: "Deal" })).toBeInTheDocument();
    const model = screen.getByRole("tab", { name: "Model" });
    expect(model).toHaveAttribute("aria-selected", "true");
    expect(model).toHaveAttribute("href", "/deals/d1/model");
    expect(screen.getByRole("tab", { name: "Overview" })).toHaveAttribute("aria-selected", "false");
  });

  it("can be a controlled button group", async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="View"
        value="chart"
        onChange={onChange}
        tabs={[
          { value: "chart", label: "Chart" },
          { value: "table", label: "Table" },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Table" }));
    expect(onChange).toHaveBeenCalledWith("table");
  });
});

function Sl() {
  const [v, setV] = useState(15.5);
  return (
    <Slider
      label="Entry EV / EBITDA"
      value={v}
      min={6}
      max={20}
      step={0.5}
      onChange={setV}
      format={(x) => `${x.toFixed(1)}x`}
      hint="Segment median 16.0x"
    />
  );
}

describe("Slider", () => {
  it("shows a labelled, formatted value and hint", () => {
    render(<Sl />);
    const s = screen.getByRole("slider", { name: "Entry EV / EBITDA" });
    expect(s).toHaveAttribute("aria-valuenow", "15.5");
    expect(s).toHaveAttribute("aria-valuetext", "15.5x");
    expect(screen.getByText("Segment median 16.0x")).toBeInTheDocument();
    expect(screen.getByTestId("slider-value")).toHaveTextContent("15.5x");
  });

  it("steps with the keyboard", () => {
    render(<Sl />);
    const s = screen.getByRole("slider", { name: "Entry EV / EBITDA" });
    fireEvent.keyDown(s, { key: "ArrowRight" });
    expect(s).toHaveAttribute("aria-valuenow", "16");
    expect(screen.getByTestId("slider-value")).toHaveTextContent("16.0x");
  });
});

describe("TextField and Textarea", () => {
  it("associate label, help text and error", () => {
    render(
      <>
        <TextField label="Search" value="" onChange={() => {}} help="Company or code name" />
        <Textarea label="Teaser text" value="" onChange={() => {}} error="Paste at least one paragraph" />
      </>,
    );
    const input = screen.getByLabelText("Search");
    expect(input).toHaveAccessibleDescription("Company or code name");
    const ta = screen.getByLabelText("Teaser text");
    expect(ta.tagName).toBe("TEXTAREA");
    expect(ta).toHaveAttribute("aria-invalid", "true");
    expect(ta).toHaveAccessibleDescription("Paste at least one paragraph");
  });

  it("reports changes as plain strings", async () => {
    const onChange = vi.fn();
    render(<TextField label="Search" value="" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Search"), "a");
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
