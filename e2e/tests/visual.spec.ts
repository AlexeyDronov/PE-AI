/**
 * Plan step 8.2: visual baselines for every page and the component gallery, light theme, at 1440px and 390px.
 * Runs on the freshly seeded E2E database before the flow tests write anything; the clock is fixed and motion
 * reduced (charts honour prefers-reduced-motion), so screenshots are stable.
 */
import { expect, test } from "@playwright/test";
import { allRoutes, settled } from "./routes";

const WIDTHS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
];

test("every page matches its baseline at desktop and phone widths", async ({ page, request }) => {
  test.setTimeout(10 * 60_000);
  await page.clock.setFixedTime(new Date("2026-10-27T09:00:00Z"));
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  for (const route of await allRoutes(request)) {
    for (const size of WIDTHS) {
      await test.step(`${route.name} @${size.width}`, async () => {
        await page.setViewportSize(size);
        await page.goto(route.path);
        await settled(page);
        await expect(page).toHaveScreenshot(`${route.name}-${size.width}.png`, { fullPage: true, maxDiffPixelRatio: 0.002 });
      });
    }
  }
});

test("the phone layout never scrolls sideways", async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of await allRoutes(request)) {
    await page.goto(route.path);
    await settled(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${route.path} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
