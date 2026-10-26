import type { Crumb, SidebarGroup } from "@/components/ui";
import type { ResourceKey } from "@/lib/api/registry";
import type { ResourceParams } from "@/lib/api/types";

export const NAVIGATION: SidebarGroup[] = [
  { items: [{ href: "/", label: "Overview", icon: "home" }] },
  {
    label: "Origination",
    items: [
      { href: "/markets", label: "Markets", icon: "globe" },
      { href: "/research", label: "Research", icon: "search" },
    ],
  },
  {
    label: "Deals",
    items: [
      { href: "/deals", label: "Pipeline", icon: "list" },
      { href: "/deals/new", label: "Screen a teaser", icon: "plus" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { href: "/portfolio", label: "Platforms", icon: "briefcase" },
      { href: "/portfolio/covenants", label: "Covenants", icon: "shield" },
      { href: "/exits", label: "Exits", icon: "logout" },
    ],
  },
  { label: "Fund", items: [{ href: "/fund", label: "Performance", icon: "trending" }] },
];

type PageQuery = { [K in ResourceKey]: [K] | [K, ResourceParams<K>] }[ResourceKey];

/** What each page reads first, keyed and parameterised exactly as its view does, so hovering a link can warm the cache. */
export const PAGE_DATA: Record<string, PageQuery[]> = {
  "/": [["overviewSummary"], ["alerts"], ["deals", { verdict: "Advance", sort: "-score" }]],
  "/markets": [["segments", { sort: "-attractiveness" }], ["marketSummary"], ["exitRouteMixes"]],
  "/research": [["segments"], ["researchReports", { sort: "-created_at" }]],
  "/deals": [["pipelineSummary"], ["deals", { sort: "-score" }]],
  "/portfolio": [["portfolioCompanies"], ["portfolioSummary"]],
  "/portfolio/covenants": [["debtFacilities"], ["covenantSummary"]],
  "/exits": [["exitPlans"], ["exitSummary"], ["exitRouteMixes"]],
};

/** Group label then page label; deeper routes link back to their nearest known parent. */
export function breadcrumbFor(pathname: string): Crumb[] {
  const entries = NAVIGATION.flatMap((group) => group.items.map((item) => ({ group: group.label, item })));
  const match = entries
    .filter(({ item }) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.item.href.length - a.item.href.length)[0];
  if (!match) return [];
  const exact = pathname === match.item.href;
  const page: Crumb = exact ? { label: match.item.label } : { label: match.item.label, href: match.item.href };
  return match.group ? [{ label: match.group }, page] : [page];
}
