/** Plan step 6.12: Screen a teaser (/deals/new) — design §5 "Screen a teaser". */
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { renderWithApi } from "../setup/render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/deals/new",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
const { TeaserScreenView } = await import("@/features/teaser/TeaserScreenView");

const TEASER =
  "Project Birch: a founder-owned UK provider of payroll outsourcing to mid-sized employers, headquartered in Manchester. " +
  "FY26 revenue £48m and EBITDA £9.6m, growing 14% a year with 82% recurring revenue and 94% gross retention.";

const job = (over: Record<string, unknown> = {}) => ({
  id: "j1", kind: "teaser_screen", status: "running", input: { text: TEASER }, result_ref: null, error: null, usage: null,
  progress: [{ step: "extract", message: "Reading the teaser", at: "2026-10-27T10:00:00Z" }],
  created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:00:01Z", source: "user", ...over,
});

const USAGE = { calls: 1, inputTokens: 332, cacheWriteTokens: 0, cacheReadTokens: 3496, outputTokens: 1543, costUsd: 0.0012 };

const DEAL = {
  id: "d9", code_name: "Project Birch", stage: "Teaser", ask_multiple: 12, process: "Teaser circulated by adviser", origin: "teaser", source: "agent",
  company_id: "c9", created_at: "2026-10-27T10:00:05Z", watchlisted: false,
  company: { name: "Birchfield Payroll", hq: "Manchester", description: "Payroll outsourcing for UK mid-sized employers.", segment_id: "s3" },
  segment: { id: "s3", name: "Payroll & finance outsourcing", short: "Payroll BPO", median_multiple: 12 },
  financials: {
    id: "fin9", deal_id: "d9", source: "agent", revenue: 48, ebitda: 9.6, growth: 0.14, recurring_pct: 0.82, capex_pct: 0.03, da_pct: 0.04, nwc_pct: 0.05,
    top_customer_pct: 0.07, gross_retention: 0.94, cyclicality: "Low", ai_resilience: 55, fragmentation: 70, key_person_risk: true,
  },
  screening: {
    score: 64, verdict: "Watch", gate_reason: "EBITDA £9.6m is below the £10m mandate floor",
    criteria: [{ key: "scale", label: "Scale", value: 9.6, score: 0, weight: 0.1, target_text: "£10–60m" }],
  },
  risks: [{ key: "key_person", label: "Key person", status: "flag", detail: "Founder leads sales." }],
  flags: [{ id: "f9", deal_id: "d9", severity: "m", text: "Founder leads sales", mitigant: "Hire a CRO pre-close", source: "agent", created_at: "2026-10-27T10:00:05Z" }],
  questions: ["What share of revenue is on multi-year contracts?"],
  debt_capacity: {
    ebitda: 9.6, senior_multiple: 3, policy_leverage: 4.5, rate_senior: 0.0875, rate_sub: 0.11, stress_drop: 0.225, cover_floor: 2,
    senior_debt: 28.8, total_debt: 43.2, interest: 4.1, interest_cover: 2.34, stressed_cover: 1.81, max_leverage: 4.1, max_debt: 39.4,
  },
};

let starts: unknown[];
let jobState: ReturnType<typeof job>;

beforeEach(() => {
  starts = [];
  jobState = job();
  server.use(
    http.post(`${API}/api/commands/screen-teaser`, async ({ request }) => {
      starts.push(await request.json());
      return HttpResponse.json(job({ status: "queued", progress: [] }), { status: 202 });
    }),
    http.get(`${API}/api/jobs/j1`, () => HttpResponse.json(jobState)),
    http.get(`${API}/api/deals/d9`, () => HttpResponse.json(DEAL)),
    http.get(`${API}/api/funds`, () =>
      HttpResponse.json({ items: [{ id: "f1", name: "Harrowgate Fund VII", verdict_advance: 68, verdict_watch: 55 }], total: 1 }),
    ),
  );
});

async function paste(text = TEASER) {
  const user = userEvent.setup();
  renderWithApi(<TeaserScreenView />);
  const box = await screen.findByLabelText(/teaser text/i);
  await user.click(box);
  await user.paste(text);
  return user;
}

describe("Screen a teaser", () => {
  it("asks for enough text before it can screen", async () => {
    await paste("Too short to screen.");
    expect(screen.getByRole("button", { name: "Extract and screen" })).toBeDisabled();
    expect(screen.getByTestId("teaser-intake")).toHaveTextContent(/at least 200 characters/i);
  });

  it("starts a screen with the pasted text and shows progress while the agent runs", async () => {
    const user = await paste();
    await user.click(screen.getByRole("button", { name: "Extract and screen" }));
    await waitFor(() => expect(starts).toEqual([{ text: TEASER }]));
    const progress = await screen.findByTestId("teaser-progress");
    expect(within(progress).getByText(/extract/i)).toBeInTheDocument();
    expect(within(progress).getByText(/score/i)).toBeInTheDocument();
  });

  it("shows the extracted figures, scorecard and flags of the new deal, with a link to it and the run's cost", async () => {
    jobState = job({ status: "succeeded", result_ref: "d9", usage: USAGE });
    const user = await paste();
    await user.click(screen.getByRole("button", { name: "Extract and screen" }));
    const result = await screen.findByTestId("teaser-result");
    await waitFor(() => expect(result).toHaveTextContent("Birchfield Payroll"));
    expect(result).toHaveTextContent("£48.0m");
    expect(result).toHaveTextContent("82.0%");
    expect(result).toHaveTextContent(/Watch/);
    expect(result).toHaveTextContent(/below the £10m mandate floor/);
    expect(result).toHaveTextContent("Founder leads sales");
    expect(result).toHaveTextContent(/added to the pipeline/i);
    expect(within(result).getByRole("link", { name: /open deal/i })).toHaveAttribute("href", "/deals/d9");
    expect(screen.getByTestId("teaser-progress")).toHaveTextContent(/\$0\.0012/);
  });

  it("explains a failed screen and lets the user retry with the same text", async () => {
    jobState = job({ status: "failed", error: "Claude declined this request.", usage: USAGE });
    const user = await paste();
    await user.click(screen.getByRole("button", { name: "Extract and screen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Claude declined this request.");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(starts).toHaveLength(2));
    expect(starts[1]).toEqual({ text: TEASER });
  });

  it("loads a .txt teaser file into the text box", async () => {
    const user = userEvent.setup();
    renderWithApi(<TeaserScreenView />);
    const file = new File([TEASER], "birch.txt", { type: "text/plain" });
    await user.upload(await screen.findByLabelText(/upload/i), file);
    await waitFor(() => expect(screen.getByLabelText(/teaser text/i)).toHaveValue(TEASER));
  });
});

// ---------- browser review fixes ----------
describe("Screen a teaser review fixes", () => {
  it("cannot start a second screen while one is running", async () => {
    const user = await paste();
    await user.click(screen.getByRole("button", { name: "Extract and screen" }));
    await screen.findByTestId("teaser-progress");
    await waitFor(() => expect(screen.getByRole("button", { name: "Extract and screen" })).toBeDisabled());
  });

  it("names the teaser section once, not twice", async () => {
    renderWithApi(<TeaserScreenView />);
    await screen.findByLabelText(/teaser text/i);
    expect(screen.getAllByRole("heading", { name: "Teaser" })).toHaveLength(1);
  });
});

// Feedback round 8.4 (user note on /deals/new): upload PDF, Word and PowerPoint teasers too; the API extracts the text.
describe("Screen a teaser document uploads", () => {
  it("accepts PDF, Word and PowerPoint files as well as text", async () => {
    renderWithApi(<TeaserScreenView />);
    const input = await screen.findByLabelText(/upload/i);
    for (const ext of [".pdf", ".docx", ".pptx", ".txt", ".md"]) expect(input.getAttribute("accept")).toContain(ext);
  });

  it("sends a document to the API for text extraction and fills the teaser box", async () => {
    const uploads: { name: string | null }[] = [];
    server.use(
      http.post(`${API}/api/extract-text`, async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        uploads.push({ name: file instanceof File ? file.name : null });
        return HttpResponse.json({ filename: "birch.pdf", text: TEASER, pages: 2 });
      }),
    );
    const user = userEvent.setup();
    renderWithApi(<TeaserScreenView />);
    await user.upload(await screen.findByLabelText(/upload/i), new File(["%PDF-1.4"], "birch.pdf", { type: "application/pdf" }));
    await waitFor(() => expect(screen.getByLabelText(/teaser text/i)).toHaveValue(TEASER));
    expect(uploads).toEqual([{ name: "birch.pdf" }]);
  });

  it("explains when a document has no readable text", async () => {
    server.use(
      http.post(`${API}/api/extract-text`, () =>
        HttpResponse.json({ error: { code: "no_text", message: "No readable text in birch.pdf; it may be a scanned image." } }, { status: 422 }),
      ),
    );
    const user = userEvent.setup();
    renderWithApi(<TeaserScreenView />);
    await user.upload(await screen.findByLabelText(/upload/i), new File(["%PDF-1.4"], "birch.pdf", { type: "application/pdf" }));
    expect(await screen.findByText(/no readable text/i)).toBeInTheDocument();
  });
});
