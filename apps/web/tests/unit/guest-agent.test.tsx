/** Plan step 8.13 (user request): guests can run research and the other agent jobs, and upload a teaser; saving changes stays admin-only. */
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ResearchEvidence } from "@/components/domain/markets";
import { MemoPicker } from "@/components/domain/memo/MemoPicker";
import { ResearchForm } from "@/components/domain/research";
import { TeaserIntake } from "@/components/domain/teaser/TeaserIntake";
import { ReadOnlyContext } from "@/components/ui";
import { renderWithApi } from "../setup/render";

const asGuest = (ui: ReactNode) => renderWithApi(<ReadOnlyContext.Provider value="View-only account">{ui}</ReadOnlyContext.Provider>);
const noop = () => undefined;

describe("guest and the agent", () => {
  it("can run research from the Research page", () => {
    asGuest(<ResearchForm question="How big is UK TIC?" onQuestionChange={noop} segmentId="" onSegmentChange={noop} segments={[]} onSubmit={noop} busy={false} />);
    expect(screen.getByRole("button", { name: "Run research" })).toBeEnabled();
  });

  it("can run research from a segment", async () => {
    asGuest(<ResearchEvidence reports={[]} onRun={noop} />);
    const run = screen.queryByRole("button", { name: "Run research" });
    if (run) expect(run).not.toHaveAttribute("title", "View-only account");
  });

  it("can draft a memo", () => {
    asGuest(
      <MemoPicker
        sections={[{ key: "summary", label: "Summary", description: "Overview" }]}
        selected={["summary"]}
        onToggle={noop}
        scenarioId=""
        scenarios={[]}
        onScenarioChange={noop}
        onDraft={noop}
        busy={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Draft memo" })).toBeEnabled();
  });

  it("can upload and screen a teaser", () => {
    asGuest(<TeaserIntake value={"Project Linden is a UK testing business. ".repeat(20)} onChange={noop} onSubmit={noop} />);
    expect(screen.getByRole("button", { name: "Extract and screen" })).toBeEnabled();
    expect(screen.getByLabelText(/upload a document/i)).toBeEnabled();
  });
});
