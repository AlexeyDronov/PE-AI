import { describe, expect, it } from "vitest";
import { fmt } from "@/lib/format";

describe("fmt.money (input in £m)", () => {
  it("formats millions with one decimal", () => {
    expect(fmt.money(14.6)).toBe("£14.6m");
    expect(fmt.money(0.25)).toBe("£0.3m");
  });
  it("switches to billions at £1,000m", () => {
    expect(fmt.money(1400)).toBe("£1.4bn");
    expect(fmt.money(999.9)).toBe("£999.9m");
  });
  it("uses a true minus sign for negatives", () => {
    expect(fmt.money(-6.2)).toBe("−£6.2m");
  });
  it("financial style: bare figure, parentheses for negatives", () => {
    expect(fmt.money(14.6, { style: "financial" })).toBe("14.6");
    expect(fmt.money(-6.2, { style: "financial" })).toBe("(6.2)");
    expect(fmt.money(1234.5, { style: "financial" })).toBe("1,234.5");
  });
  it("renders missing values as an en dash", () => {
    expect(fmt.money(null)).toBe("–");
    expect(fmt.money(undefined)).toBe("–");
    expect(fmt.money(Number.NaN)).toBe("–");
  });
});

describe("fmt.multiple", () => {
  it("one decimal by default, two on request", () => {
    expect(fmt.multiple(15.5)).toBe("15.5x");
    expect(fmt.multiple(2.523, { dp: 2 })).toBe("2.52x");
    expect(fmt.multiple(null)).toBe("–");
  });
});

describe("fmt.pct", () => {
  it("treats input as a fraction by default", () => {
    expect(fmt.pct(0.203)).toBe("20.3%");
    expect(fmt.pct(0.2, { dp: 0 })).toBe("20%");
  });
  it("accepts values already in percent", () => {
    expect(fmt.pct(11, { input: "percent" })).toBe("11.0%");
  });
  it("can show an explicit sign", () => {
    expect(fmt.pct(0.031, { signed: true })).toBe("+3.1%");
    expect(fmt.pct(-0.047, { signed: true })).toBe("−4.7%");
  });
});

describe("fmt.bp", () => {
  it("is signed and whole", () => {
    expect(fmt.bp(50)).toBe("+50bp");
    expect(fmt.bp(-25)).toBe("−25bp");
    expect(fmt.bp(0)).toBe("0bp");
  });
});

describe("fmt.int, fmt.date, fmt.quarter", () => {
  it("groups thousands", () => {
    expect(fmt.int(1182)).toBe("1,182");
  });
  it("formats ISO dates the British way", () => {
    expect(fmt.date("2026-10-25")).toBe("25 Oct 2026");
    expect(fmt.date("2026-10-25T14:03:00Z")).toBe("25 Oct 2026");
  });
  it("formats quarter keys", () => {
    expect(fmt.quarter("2026Q3")).toBe("Q3 26");
  });
});
