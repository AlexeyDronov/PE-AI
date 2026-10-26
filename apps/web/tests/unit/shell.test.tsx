import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API, server } from "../setup/server";
import { FakeEventSource, renderWithApi } from "../setup/render";

let pathname = "/deals";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { AppShell } = await import("@/components/shell/AppShell");
const { NAVIGATION, breadcrumbFor } = await import("@/app/navigation");

let jobs: { id: string; kind: string; status: string; progress: { step: string; message: string }[] }[] = [];

beforeEach(() => {
  pathname = "/deals";
  jobs = [];
  server.use(
    http.get(`${API}/api/jobs`, ({ request }) => {
      const status = new URL(request.url).searchParams.get("status");
      const items = status ? jobs.filter((j) => j.status === status) : jobs;
      return HttpResponse.json({ items, total: items.length });
    }),
    http.get(`${API}/api/annotations`, () => HttpResponse.json({ items: [], total: 0 })),
    http.get(`${API}/api/funds`, () =>
      HttpResponse.json({ items: [{ id: "f1", name: "Harrowgate Fund VII", committed: 1400 }], total: 1 }),
    ),
  );
});

describe("navigation", () => {
  it("follows the fund lifecycle, in order", () => {
    const labels = NAVIGATION.map((g) => g.label ?? null);
    expect(labels).toEqual([null, "Origination", "Deals", "Portfolio", "Fund"]);
    const hrefs = NAVIGATION.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toEqual(["/", "/markets", "/research", "/deals", "/deals/new", "/portfolio", "/portfolio/covenants", "/exits", "/fund"]);
  });

  it("builds breadcrumbs from the route", () => {
    expect(breadcrumbFor("/")).toEqual([{ label: "Overview" }]);
    expect(breadcrumbFor("/deals")).toEqual([{ label: "Deals" }, { label: "Pipeline" }]);
    expect(breadcrumbFor("/portfolio/covenants")).toEqual([{ label: "Portfolio" }, { label: "Covenants" }]);
  });
});

describe("AppShell", () => {
  it("renders sidebar, breadcrumb, page content and the feedback tool", async () => {
    renderWithApi(
      <AppShell>
        <h1>Pipeline</h1>
      </AppShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: /Pipeline/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Pipeline");
    expect(screen.getByRole("main")).toHaveTextContent("Pipeline");
    expect(screen.getByRole("button", { name: /leave feedback/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Harrowgate Fund VII")).toBeInTheDocument());
  });

  it("lets a breadcrumb override come from the page", () => {
    pathname = "/deals/d1";
    renderWithApi(
      <AppShell breadcrumb={[{ label: "Deals", href: "/deals" }, { label: "Northvale Compliance" }]}>
        <p>x</p>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Northvale Compliance");
  });

  it("starts loading a page's data when its sidebar link is hovered, once", async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/api/portfolio-companies`, ({ request }) => {
        requests.push(request.url);
        return HttpResponse.json({ items: [], total: 0 });
      }),
      http.get(`${API}/api/portfolio-summary`, () => HttpResponse.json({})),
    );
    const user = userEvent.setup();
    renderWithApi(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    const link = within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", { name: /Platforms/ });
    await user.hover(link);
    await waitFor(() => expect(requests).toHaveLength(1));
    await user.unhover(link);
    await user.hover(link);
    await new Promise((r) => setTimeout(r, 50));
    expect(requests).toHaveLength(1);
  });

  // Feedback round 8.4 (user note on /): the top-bar jobs widget ("Idle") is removed; each page shows its own job.
  it("has no jobs widget in the top bar", async () => {
    jobs = [{ id: "j1", kind: "market_research", status: "running", progress: [{ step: "search", message: "6 queries" }] }];
    renderWithApi(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    await waitFor(() => expect(screen.getByText("Harrowgate Fund VII")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /copilot job/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Idle")).not.toBeInTheDocument();
  });


  it("toggles the theme", async () => {
    renderWithApi(
      <AppShell>
        <p>x</p>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.click(screen.getByRole("button", { name: /switch to light theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
