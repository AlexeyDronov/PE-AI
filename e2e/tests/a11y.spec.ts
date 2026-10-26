/** Plan step 8.3: accessibility — axe on every page, landmarks and headings, keyboard and focus, chart table views. */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { allRoutes, settled } from "./routes";

test("no serious or critical WCAG 2.1 AA violations on any page", async ({ page, request }) => {
  test.setTimeout(5 * 60_000);
  const problems: string[] = [];
  for (const route of await allRoutes(request)) {
    await page.goto(route.path);
    await settled(page);
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
      problems.push(`${route.path}: ${v.id} (${v.impact}) — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("every page has one h1 and a main landmark", async ({ page, request }) => {
  for (const route of await allRoutes(request)) {
    await page.goto(route.path);
    await settled(page);
    await expect(page.getByRole("heading", { level: 1 }), route.path).toHaveCount(1);
    await expect(page.getByRole("main"), route.path).toHaveCount(1);
  }
});

test("a skip link is the first stop and jumps to the main content", async ({ page }) => {
  await page.goto("/deals");
  await settled(page);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: /skip to (main )?content/i });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("keyboard focus is always visible", async ({ page }) => {
  await page.goto("/deals");
  await settled(page);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    const visible = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return true;
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const ring = s.boxShadow !== "none";
      return outline || ring;
    });
    expect(visible, `tab stop ${i + 1} has no visible focus indicator`).toBe(true);
  }
});

test("every chart can be read as a table", async ({ page }) => {
  await page.goto("/markets");
  await settled(page);
  const charts = page.locator('[role="img"][aria-label]');
  const count = await charts.count();
  expect(count).toBeGreaterThan(0);
  const toggles = page.getByRole("button", { name: "View as table" });
  await expect(toggles).toHaveCount(count);
  await toggles.first().click();
  await expect(page.getByRole("table").first()).toBeVisible();
});
