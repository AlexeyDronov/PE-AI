/** Plan step 6.14: IC memo (/deals/[id]/memo) — design §5 "Deal → IC memo". */
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/deals/d1/memo",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
const { DealMemo } = await import("@/features/deal/DealMemo");

const OUTLINE = {
  sections: [
    { key: "summary", label: "Summary", description: "The deal and the ask in one paragraph." },
    { key: "thesis", label: "Investment thesis", description: "Why we would own it." },
    { key: "market", label: "Market", description: "Segment size, growth and structure." },
    { key: "financials", label: "Financials", description: "Revenue, margin, cash conversion." },
    { key: "valuation", label: "Valuation and returns", description: "Entry, structure and returns." },
    { key: "risks", label: "Risks", description: "Key risks and mitigants." },
    { key: "recommendation", label: "Recommendation", description: "What we ask the committee to approve." },
  ],
};
const MEMO = {
  id: "m1", deal_id: "d1", scenario_id: null, scenario_name: null, status: "draft", source: "agent", created_at: "2026-10-27T11:00:00Z",
  sections: [
    { id: "ms1", key: "summary", label: "Summary", status: "draft", markdown: "## Summary\n\nWe recommend **advancing** Project Linden.\n\n- IRR 23.2%\n- MOIC 2.8x" },
    { id: "ms2", key: "risks", label: "Risks", status: "draft", markdown: "## Risks\n\nLeverage of 4.5x exceeds the 4.1x maximum. <script>alert(1)</script>" },
  ],
};
const SCENARIOS = [{ id: "sc1", deal_id: "d1", name: "Downside", case: "down", overrides: {}, created_at: "", source: "user" }];
const job = (over: Record<string, unknown> = {}) => ({
  id: "j5", kind: "memo_draft", status: "running", input: {}, result_ref: null, error: null, usage: null,
  progress: [], created_at: "", updated_at: "", source: "user", ...over,
});

let memos: { id: string }[];
let memoParams: URLSearchParams[];
let drafts: unknown[];
let jobState: ReturnType<typeof job>;

beforeEach(() => {
  memos = [{ id: "m1" }];
  memoParams = [];
  drafts = [];
  jobState = job();
  server.use(
    http.get(`${API}/api/memo-outline`, () => HttpResponse.json(OUTLINE)),
    http.get(`${API}/api/lbo-scenarios`, () => HttpResponse.json({ items: SCENARIOS, total: 1 })),
    http.get(`${API}/api/memos`, ({ request }) => {
      memoParams.push(new URL(request.url).searchParams);
      return HttpResponse.json({ items: memos.map((m) => ({ ...MEMO, ...m, sections: undefined })), total: memos.length });
    }),
    http.get(`${API}/api/memos/m1`, () => HttpResponse.json(MEMO)),
    http.post(`${API}/api/commands/draft-memo`, async ({ request }) => {
      drafts.push(await request.json());
      return HttpResponse.json(job({ status: "queued" }), { status: 202 });
    }),
    http.get(`${API}/api/jobs/j5`, () => HttpResponse.json(jobState)),
  );
});

describe("IC memo", () => {
  it("shows the deal's latest memo with each section's status, rendering markdown safely", async () => {
    renderWithApi(<DealMemo dealId="d1" />);
    const doc = await screen.findByTestId("memo-document");
    await waitFor(() => expect(doc).toHaveTextContent("We recommend advancing Project Linden."));
    expect(memoParams[0]?.get("deal_id")).toBe("d1");
    expect(memoParams[0]?.get("sort")).toBe("-created_at");
    expect(within(doc).getByRole("heading", { name: "Summary" })).toBeInTheDocument();
    expect(within(doc).getByText("advancing").tagName).toBe("STRONG");
    expect(within(doc).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["IRR 23.2%", "MOIC 2.8x"]);
    expect(doc.querySelector("script")).toBeNull();
    expect(doc).toHaveTextContent("<script>alert(1)</script>"); // shown as text, never executed
    expect(within(doc).getAllByText(/draft/i).length).toBeGreaterThanOrEqual(2);
  });

  it("drafts a memo for the chosen sections and scenario", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealMemo dealId="d1" />);
    const picker = await screen.findByTestId("memo-picker");
    await waitFor(() => expect(within(picker).getAllByRole("checkbox")).toHaveLength(7));
    for (const box of within(picker).getAllByRole("checkbox")) expect(box).toBeChecked();
    await user.click(within(picker).getByRole("checkbox", { name: /market/i }));
    await user.click(within(picker).getByRole("checkbox", { name: /financials/i }));
    await user.selectOptions(within(picker).getByLabelText(/scenario/i), "sc1");
    await user.click(within(picker).getByRole("button", { name: /draft memo/i }));
    await waitFor(() =>
      expect(drafts).toEqual([{ deal_id: "d1", scenario_id: "sc1", sections: ["summary", "thesis", "valuation", "risks", "recommendation"] }]),
    );
    expect(await screen.findByTestId("memo-progress")).toBeInTheDocument();
  });

  it("cannot draft with no sections selected", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealMemo dealId="d1" />);
    const picker = await screen.findByTestId("memo-picker");
    await waitFor(() => expect(within(picker).getAllByRole("checkbox")).toHaveLength(7));
    for (const box of within(picker).getAllByRole("checkbox")) await user.click(box);
    expect(within(picker).getByRole("button", { name: /draft memo/i })).toBeDisabled();
  });

  it("uses the base case when no scenario is chosen", async () => {
    const user = userEvent.setup();
    renderWithApi(<DealMemo dealId="d1" />);
    const picker = await screen.findByTestId("memo-picker");
    await waitFor(() => expect(within(picker).getAllByRole("checkbox")).toHaveLength(7));
    await user.click(within(picker).getByRole("button", { name: /draft memo/i }));
    await waitFor(() => expect((drafts[0] as { scenario_id: unknown }).scenario_id).toBeNull());
  });

  it("copies and exports the memo as markdown", async () => {
    const user = userEvent.setup(); // before the clipboard stub: setup() installs its own clipboard
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    const createObjectURL = vi.fn(() => "blob:memo");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    renderWithApi(<DealMemo dealId="d1" />);
    const doc = await screen.findByTestId("memo-document");
    await waitFor(() => expect(doc).toHaveTextContent("Project Linden"));
    await user.click(screen.getByRole("button", { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("## Summary"));
    expect(writeText.mock.calls[0]![0]).toContain("## Risks");
    await act(async () => user.click(screen.getByRole("button", { name: /export/i })));
    expect(createObjectURL).toHaveBeenCalled();
  });

  it("invites a first draft when the deal has no memo", async () => {
    memos = [];
    renderWithApi(<DealMemo dealId="d1" />);
    expect(await screen.findByText(/no memo yet/i)).toBeInTheDocument();
  });

  it("shows the run's cost and error when drafting fails", async () => {
    jobState = job({ status: "failed", error: "Claude's answer was cut off before it finished.", usage: { calls: 1, inputTokens: 1826, cacheWriteTokens: 2152, cacheReadTokens: 0, outputTokens: 6000, costUsd: 0.0035 } });
    const user = userEvent.setup();
    renderWithApi(<DealMemo dealId="d1" />);
    const picker = await screen.findByTestId("memo-picker");
    await waitFor(() => expect(within(picker).getAllByRole("checkbox")).toHaveLength(7));
    await user.click(within(picker).getByRole("button", { name: /draft memo/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("cut off");
    expect(screen.getByTestId("memo-progress")).toHaveTextContent(/\$0\.0035/);
  });
});

// Browser review: each section showed its label twice (a small label beside the badge, then the markdown heading).
describe("IC memo review fixes", () => {
  it("names each section once, keeping its status badge", async () => {
    renderWithApi(<DealMemo dealId="d1" />);
    const doc = await screen.findByTestId("memo-document");
    await waitFor(() => expect(doc).toHaveTextContent("Project Linden"));
    expect(within(doc).getAllByText("Summary")).toHaveLength(1);
    expect(within(doc).getAllByText("Risks")).toHaveLength(1);
    expect(within(doc).getAllByText(/^draft$/i)).toHaveLength(2);
  });
});
