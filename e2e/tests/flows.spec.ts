/**
 * Plan step 8.1: end-to-end flows against an isolated stack (seeded throwaway DB, real API, web, and a fake agent
 * that answers jobs with the fixed content in e2e/support/fake-agent — no model calls, no cost).
 */
import { expect, test } from "@playwright/test";

const TEASER =
  "Project Fernhill: a founder-owned UK testing laboratory group based in Bristol serving construction and water " +
  "clients. FY26 revenue £52m and EBITDA £11.4m, growing 10% a year, with 70% of revenue from framework agreements.";

test("screen a teaser: the job runs and the new deal appears live in the pipeline", async ({ page, context }) => {
  const pipeline = await context.newPage();
  await pipeline.goto("/deals");
  await expect(pipeline.getByRole("table")).toBeVisible();
  await expect(pipeline.getByText("Project Fernhill")).toHaveCount(0);

  await page.goto("/deals/new");
  await page.getByLabel("Teaser text").fill(TEASER);
  await page.getByRole("button", { name: "Extract and screen" }).click();
  await expect(page.getByTestId("teaser-progress")).toBeVisible();

  const result = page.getByTestId("teaser-result");
  await expect(result).toContainText("Fernhill Testing", { timeout: 20_000 });
  await expect(result).toContainText("£52.0m");
  await expect(result).toContainText("Single-site lab concentration");

  // The other tab updates over the live event stream, without a reload.
  await expect(pipeline.getByText("Project Fernhill")).toBeVisible({ timeout: 10_000 });

  await result.getByRole("link", { name: /open deal/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Fernhill Testing");
});

test("deal model: moving the entry multiple slider updates the LBO returns", async ({ page }) => {
  await page.goto("/deals");
  await page.getByText("Project Linden").click();
  await page.getByRole("tab", { name: "Model" }).click();
  const model = page.getByTestId("deal-model");
  const irrStat = model.getByText("Gross IRR").locator("xpath=..");
  await expect(irrStat).toContainText("%", { timeout: 15_000 });
  const before = await irrStat.innerText();

  const slider = page.getByRole("slider", { name: "Entry EV / EBITDA" });
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // +2.0x entry multiple
  await expect(irrStat).not.toHaveText(before, { timeout: 10_000 });
});

test("research: a run completes and its report renders with findings and numbered sources", async ({ page }) => {
  await page.goto("/research");
  await page.getByLabel("Research question").fill("What multiples do UK TIC deals trade at?");
  await page.getByRole("button", { name: "Run research" }).click();
  await expect(page.getByTestId("research-progress")).toBeVisible();

  const detail = page.getByTestId("report-detail");
  await expect(detail).toContainText("UK TIC deal multiples ranged from 11x to 15x", { timeout: 20_000 });
  await expect(detail.getByTestId("findings-table")).toContainText("Median TIC EV/EBITDA");
  await expect(detail.getByTestId("findings-table")).toContainText("13.2 x");
  await expect(detail.getByTestId("source-list").getByRole("link", { name: "TIC deals review 2026" })).toHaveAttribute(
    "href",
    "https://example.org/tic",
  );
  await expect(page).toHaveURL(/report=/);
});

test("IC memo: drafting fills the memo document", async ({ page }) => {
  await page.goto("/deals");
  await page.getByText("Project Linden").click();
  await page.getByRole("tab", { name: "IC memo" }).click();
  await expect(page.getByText(/no memo yet/i)).toBeVisible();
  await page.getByTestId("memo-picker").getByRole("button", { name: /draft memo/i }).click();
  const doc = page.getByTestId("memo-document");
  await expect(doc).toContainText("E2E draft for Project Linden", { timeout: 20_000 });
  await expect(doc.getByRole("heading", { name: "Recommendation" })).toBeVisible();
});

test("feedback: a note left on an element persists across a reload", async ({ page }) => {
  await page.goto("/markets");
  await expect(page.getByRole("button", { name: "Feedback notes (0)" })).toBeVisible();
  await page.getByRole("button", { name: "Leave feedback" }).click();
  await expect(page.getByRole("status", { name: "Feedback mode" })).toBeVisible();
  await page.getByRole("heading", { level: 1 }).click();
  await page.getByLabel("Note").fill("E2E: title should say which fund");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByRole("button", { name: "Feedback notes (1)" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Feedback notes (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Note 1: E2E: title should say which fund/ })).toBeVisible();
});
