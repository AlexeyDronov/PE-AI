/** Every page, with ids looked up from the isolated E2E API (seeded fresh each run). */
import type { APIRequestContext } from "@playwright/test";

export const E2E_API = "http://localhost:8100/api";

type Item = { id: string; code_name?: string; short?: string; name?: string };

async function items(request: APIRequestContext, path: string): Promise<Item[]> {
  const res = await request.get(`${E2E_API}${path}`);
  return ((await res.json()) as { items: Item[] }).items;
}

export async function allRoutes(request: APIRequestContext): Promise<{ name: string; path: string }[]> {
  const deals = await items(request, "/deals");
  const linden = deals.find((d) => d.code_name === "Project Linden")!;
  const tic = (await items(request, "/segments")).find((s) => s.short === "TIC")!;
  const platform = (await items(request, "/portfolio-companies"))[0]!;
  return [
    { name: "overview", path: "/" },
    { name: "markets", path: "/markets" },
    { name: "segment", path: `/markets/${tic.id}` },
    { name: "research", path: "/research" },
    { name: "pipeline", path: "/deals" },
    { name: "screen-teaser", path: "/deals/new" },
    { name: "deal-overview", path: `/deals/${linden.id}` },
    { name: "deal-model", path: `/deals/${linden.id}/model` },
    { name: "deal-memo", path: `/deals/${linden.id}/memo` },
    { name: "portfolio", path: "/portfolio" },
    { name: "platform", path: `/portfolio/${platform.id}` },
    { name: "covenants", path: "/portfolio/covenants" },
    { name: "exits", path: "/exits" },
    { name: "fund", path: "/fund" },
    { name: "gallery", path: "/dev/components" },
  ];
}

/** Wait until data has loaded: no skeletons left and web fonts ready. */
export async function settled(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="skeleton"]').length === 0, null, { timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}
