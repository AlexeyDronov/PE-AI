/** Plan step 4.7: the remaining primitives (minimal versions), each exported from components/ui and shown in the gallery. */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox, Dialog, Drawer, NumberField, Sparkline, Toast, Tooltip } from "@/components/ui";

describe("remaining primitives", () => {
  it("Tooltip shows its text when the trigger is focused", async () => {
    render(<Tooltip content="Net of fees"><button type="button">IRR</button></Tooltip>);
    await userEvent.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Net of fees");
  });

  it("NumberField is a labelled number input that reports numbers", async () => {
    const onChange = vi.fn();
    render(<NumberField label="Entry multiple" value={12} onChange={onChange} step={0.5} />);
    const input = screen.getByRole("spinbutton", { name: "Entry multiple" });
    await userEvent.clear(input);
    await userEvent.type(input, "13");
    expect(onChange).toHaveBeenLastCalledWith(13);
  });

  it("Toast announces a message politely", () => {
    render(<Toast message="Scenario saved" />);
    expect(screen.getByRole("status")).toHaveTextContent("Scenario saved");
  });

  it("Dialog and Drawer open with a title and close", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<Dialog open title="Confirm" onOpenChange={onOpenChange}>Body</Dialog>);
    expect(screen.getByRole("dialog", { name: "Confirm" })).toHaveTextContent("Body");
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
    rerender(<Drawer open title="Notes" onOpenChange={onOpenChange}>Side</Drawer>);
    expect(screen.getByRole("dialog", { name: "Notes" })).toHaveTextContent("Side");
  });

  it("Combobox filters options as you type and selects one", async () => {
    const onChange = vi.fn();
    render(<Combobox label="Segment" options={[{ value: "s1", label: "TIC" }, { value: "s2", label: "Compliance" }]} value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole("combobox", { name: "Segment" }), "comp");
    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Compliance"]);
    await userEvent.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith("s2");
  });

  it("Sparkline draws a labelled trend line", () => {
    render(<Sparkline label="EBITDA trend" values={[1, 3, 2, 4]} />);
    const img = screen.getByRole("img", { name: "EBITDA trend" });
    expect(img.querySelector("polyline")?.getAttribute("points")?.split(" ")).toHaveLength(4);
  });
});
