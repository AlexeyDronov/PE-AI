/** Found in browser review of a real deal (step 6.2). */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebtCapacityPanel } from "@/components/domain/deal/DebtCapacityPanel";
import { Scorecard } from "@/components/domain/deal/Scorecard";

const DC = {
  ebitda: 14.6, senior_multiple: 3, policy_leverage: 4.5, rate_senior: 0.0875, rate_sub: 0.11, stress_drop: 0.225,
  cover_floor: 2, senior_debt: 43.8, total_debt: 65.7, interest: 6.24, interest_cover: 2.34, stressed_cover: 1.81,
  max_leverage: 4.14, max_debt: 60.4,
};

describe("DebtCapacityPanel", () => {
  it("warns when fund policy leverage exceeds what the business can carry under stress", () => {
    render(<DebtCapacityPanel capacity={DC} />);
    const warning = screen.getByRole("note");
    expect(warning).toHaveTextContent("Policy leverage of 4.5x is above the 4.14x this business supports under stress");
    expect(warning).toHaveAttribute("data-tone", "warn");
  });

  it("stays quiet when policy is within capacity", () => {
    render(<DebtCapacityPanel capacity={{ ...DC, max_leverage: 5.2, max_debt: 75.9 }} />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("Scorecard", () => {
  it("does not repeat the section's description in its own header", () => {
    render(
      <section aria-label="Scorecard">
        <p>Each criterion against the fund&apos;s target</p>
        <Scorecard
          criteria={[{ key: "margin", label: "EBITDA margin", value: 0.239, score: 94, weight: 0.15, target_text: "≥ 18%" }]}
          thresholds={{ good: 68, warn: 55 }}
        />
      </section>,
    );
    const region = screen.getByRole("region", { name: "Scorecard" });
    expect(within(region).getAllByText(/each criterion against the fund.s target/i)).toHaveLength(1);
  });
});
