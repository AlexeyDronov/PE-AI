/** 7.2: hand-made tools. Core functions are tested directly against recorded fixtures; no live network. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { calculate, parseMoney } from "@/tools/calculator";
import { searchCompanies } from "@/tools/companyRegistry";
import { extractTables } from "@/tools/extractTables";
import { fetchPage } from "@/tools/fetchPage";
import { convertCurrency } from "@/tools/fxRates";
import { readInternal } from "@/tools/internalData";
import { createSourceRegistry } from "@/tools/recordSource";
import { searchFilings } from "@/tools/secFilings";
import { buildTools } from "@/tools";
import { TavilyProvider, searchWeb } from "@/tools/webSearch";
import { API, fixture, testConfig } from "./helpers";
import { server } from "./setup";

const html = (body: string, status = 200, type = "text/html; charset=utf-8") =>
  new HttpResponse(body, { status, headers: { "content-type": type } });

// ---------- calculator: the model never does arithmetic itself ----------
describe("calculator", () => {
  it("computes CAGR, multiples and changes exactly", () => {
    expect(calculate({ op: "cagr", start: 100, end: 150, years: 3 }).value).toBeCloseTo(0.144714, 6);
    expect(calculate({ op: "multiple", numerator: 226.3, denominator: 14.6 }).value).toBeCloseTo(15.5, 6);
    expect(calculate({ op: "pct_change", from: 80, to: 92 }).value).toBeCloseTo(0.15, 6);
    expect(calculate({ op: "share", part: 3.4, whole: 9.1 }).value).toBeCloseTo(0.373626, 6);
  });

  it("refuses impossible inputs with a clear code", () => {
    expect(() => calculate({ op: "cagr", start: 0, end: 10, years: 2 })).toThrow(expect.objectContaining({ code: "invalid_input" }));
    expect(() => calculate({ op: "multiple", numerator: 1, denominator: 0 })).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });

  it("parses money as written in reports into £m-style amounts with currency", () => {
    expect(parseMoney("£9.1bn")).toEqual({ amount_m: 9100, currency: "GBP" });
    expect(parseMoney("$450m")).toEqual({ amount_m: 450, currency: "USD" });
    expect(parseMoney("€30 million")).toEqual({ amount_m: 30, currency: "EUR" });
    expect(parseMoney("GBP 1.2 billion")).toEqual({ amount_m: 1200, currency: "GBP" });
    expect(() => parseMoney("a lot")).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });
});

// ---------- web search (Tavily behind one adapter) ----------
describe("webSearch", () => {
  it("maps Tavily results to the shared shape", async () => {
    let auth = "";
    let body: Record<string, unknown> = {};
    server.use(
      http.post("https://api.tavily.com/search", async ({ request }) => {
        auth = request.headers.get("authorization") ?? "";
        body = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(fixture("tavily-search.json"), { headers: { "content-type": "application/json" } });
      }),
    );
    const out = await searchWeb({ query: "UK compliance outsourcing market size 2026", maxResults: 3 }, new TavilyProvider("tv-key"));
    expect(auth).toBe("Bearer tv-key");
    expect(body).toMatchObject({ query: "UK compliance outsourcing market size 2026", max_results: 3 });
    expect(out.results).toHaveLength(3);
    expect(out.results[0]).toEqual({
      title: "UK RegTech and compliance services market report 2026",
      url: "https://example-research.co.uk/regtech-2026",
      snippet: "The UK compliance outsourcing market reached £9.1bn in 2025 and is forecast to grow 11% a year to 2030.",
      publishedDate: "2026-03-14",
      score: 0.91,
      rawContent: null,
    });
    expect(out.results[1]?.publishedDate).toBeNull();
  });

  it("caps results and explains missing configuration or provider errors", async () => {
    await expect(searchWeb({ query: "x", maxResults: 50 }, new TavilyProvider("k"))).rejects.toMatchObject({ code: "invalid_input" });
    await expect(searchWeb({ query: "x", maxResults: 5 }, null)).rejects.toMatchObject({ code: "not_configured", message: expect.stringMatching(/TAVILY_API_KEY/) });
    server.use(http.post("https://api.tavily.com/search", () => HttpResponse.json({ detail: "quota" }, { status: 429 })));
    await expect(searchWeb({ query: "x", maxResults: 5 }, new TavilyProvider("k"))).rejects.toMatchObject({ code: "rate_limited" });
  });
});

// ---------- fetching pages safely ----------
describe("fetchPage", () => {
  const ok = () =>
    server.use(
      http.get("https://example-research.co.uk/robots.txt", () => html(fixture("robots.txt"), 200, "text/plain")),
      http.get("https://example-research.co.uk/regtech-2026", () => html(fixture("article.html"))),
    );

  it("returns the readable article text without scripts, styles or navigation", async () => {
    ok();
    const page = await fetchPage({ url: "https://example-research.co.uk/regtech-2026", maxChars: 5000 });
    expect(page.title).toBe("UK compliance outsourcing: 2026 outlook");
    expect(page.text).toContain("The UK compliance outsourcing market reached £9.1bn in 2025.");
    expect(page.text).not.toContain("tracking");
    expect(page.text).not.toContain("Subscribe");
    expect(page.truncated).toBe(false);
    expect(page.url).toBe("https://example-research.co.uk/regtech-2026");
  });

  it("truncates long pages", async () => {
    ok();
    const page = await fetchPage({ url: "https://example-research.co.uk/regtech-2026", maxChars: 40 });
    expect(page.text.length).toBeLessThanOrEqual(40);
    expect(page.truncated).toBe(true);
  });

  it.each([
    "file:///etc/passwd",
    "http://localhost:8000/api/deals",
    "http://127.0.0.1/",
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "ftp://example.com/x",
  ])("blocks unsafe URL %s", async (url) => {
    await expect(fetchPage({ url, maxChars: 1000 })).rejects.toMatchObject({ code: "blocked_url" });
  });

  it("respects robots.txt and refuses content that is neither HTML nor PDF", async () => {
    server.use(
      http.get("https://example-research.co.uk/robots.txt", () => html(fixture("robots.txt"), 200, "text/plain")),
      http.get("https://example-research.co.uk/chart.png", () => new HttpResponse("PNG", { headers: { "content-type": "image/png" } })),
    );
    await expect(fetchPage({ url: "https://example-research.co.uk/private/x", maxChars: 1000 })).rejects.toMatchObject({ code: "disallowed_by_robots" });
    await expect(fetchPage({ url: "https://example-research.co.uk/chart.png", maxChars: 1000 })).rejects.toMatchObject({ code: "unsupported_content" });
  });
});

// ---------- tables ----------
describe("extractTables", () => {
  it("turns HTML tables into headers and rows", () => {
    const tables = extractTables(fixture("article.html"));
    expect(tables).toHaveLength(2);
    expect(tables[0]).toEqual({
      caption: "Market size by segment (£bn)",
      headers: ["Segment", "2025", "2030F"],
      rows: [["KYC and AML", "3.4", "5.8"], ["Regulatory reporting", "2.1", "3.2"]],
    });
    expect(tables[1]).toEqual({ caption: null, headers: ["Deal", "EV/EBITDA"], rows: [["Clearmark", "15.2x"]] });
  });
});

// ---------- Companies House ----------
describe("companyRegistry", () => {
  it("searches UK companies with basic auth", async () => {
    let auth = "";
    server.use(
      http.get("https://api.company-information.service.gov.uk/search/companies", ({ request }) => {
        auth = request.headers.get("authorization") ?? "";
        expect(new URL(request.url).searchParams.get("q")).toBe("Northvale");
        return new HttpResponse(fixture("companies-house-search.json"), { headers: { "content-type": "application/json" } });
      }),
    );
    const out = await searchCompanies({ query: "Northvale" }, "ch-key");
    expect(auth).toBe(`Basic ${Buffer.from("ch-key:").toString("base64")}`);
    expect(out.companies[0]).toEqual({
      name: "NORTHVALE COMPLIANCE LIMITED", number: "09876543", status: "active",
      incorporated: "2014-05-02", address: "1 Example Street, London, EC2A 1AA",
    });
  });

  it("is honest when not configured", async () => {
    await expect(searchCompanies({ query: "x" }, undefined)).rejects.toMatchObject({ code: "not_configured" });
  });
});

// ---------- SEC EDGAR ----------
describe("secFilings", () => {
  it("full-text searches EDGAR with a declared user agent", async () => {
    let ua = "";
    server.use(
      http.get("https://efts.sec.gov/LATEST/search-index", ({ request }) => {
        ua = request.headers.get("user-agent") ?? "";
        const q = new URL(request.url).searchParams;
        expect(q.get("q")).toBe('"compliance outsourcing"');
        expect(q.get("forms")).toBe("10-K,10-Q");
        return new HttpResponse(fixture("edgar-search.json"), { headers: { "content-type": "application/json" } });
      }),
    );
    const out = await searchFilings({ phrase: "compliance outsourcing", forms: ["10-K", "10-Q"] }, "Harrowgate research@example.com");
    expect(ua).toBe("Harrowgate research@example.com");
    expect(out.filings[0]).toEqual({
      company: "Example Compliance Corp", cik: "0001234567", form: "10-K", filed: "2026-02-28",
      url: "https://www.sec.gov/Archives/edgar/data/1234567/000123456726000012/filing.htm",
    });
  });
});

// ---------- FX ----------
describe("fxRates", () => {
  const ecb = () => server.use(http.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", () => html(fixture("ecb-daily.xml"), 200, "application/xml")));

  it("converts through EUR reference rates and reports the rate date", async () => {
    ecb();
    const r = await convertCurrency({ amount: 100, from: "USD", to: "GBP" });
    expect(r.amount).toBeCloseTo((100 / 1.08) * 0.84, 6);
    expect(r.asOf).toBe("2026-10-23");
    expect((await convertCurrency({ amount: 50, from: "EUR", to: "GBP" })).amount).toBeCloseTo(42, 6);
    expect((await convertCurrency({ amount: 7, from: "GBP", to: "GBP" })).amount).toBe(7);
  });

  it("rejects unknown currencies", async () => {
    ecb();
    await expect(convertCurrency({ amount: 1, from: "XYZ", to: "GBP" })).rejects.toMatchObject({ code: "unknown_currency" });
  });
});

// ---------- read-only access to our own data ----------
describe("internalData", () => {
  it("reads allowed resources from the API", async () => {
    server.use(http.get(`${API}/api/segments`, () => HttpResponse.json({ items: [{ id: "s1", short: "TIC" }], total: 1 })));
    const out = await readInternal({ resource: "segments", params: {} }, API);
    expect(out).toEqual({ items: [{ id: "s1", short: "TIC" }], total: 1 });
  });

  it("supports a detail id and query params", async () => {
    server.use(
      http.get(`${API}/api/segments/s1`, () => HttpResponse.json({ id: "s1" })),
      http.get(`${API}/api/transactions`, ({ request }) => HttpResponse.json({ q: new URL(request.url).searchParams.get("segment_id") })),
    );
    expect(await readInternal({ resource: "segments", id: "s1", params: {} }, API)).toEqual({ id: "s1" });
    expect(await readInternal({ resource: "transactions", params: { segment_id: "s1" } }, API)).toEqual({ q: "s1" });
  });

  it("refuses anything outside the allow-list", async () => {
    await expect(readInternal({ resource: "annotations", params: {} }, API)).rejects.toMatchObject({ code: "not_allowed" });
    await expect(readInternal({ resource: "../internal/jobs", params: {} }, API)).rejects.toMatchObject({ code: "not_allowed" });
  });
});

// ---------- citations ----------
describe("recordSource", () => {
  it("numbers sources per job and deduplicates by URL", () => {
    const reg = createSourceRegistry();
    const a = reg.record({ url: "https://a.example/x", title: "A", publisher: "Pub", excerpt: "first" });
    const b = reg.record({ url: "https://b.example/y", title: "B", publisher: "Pub", excerpt: "second" });
    const again = reg.record({ url: "https://a.example/x", title: "A2", publisher: "Pub", excerpt: "later" });
    expect([a.ref, b.ref, again.ref]).toEqual([1, 2, 1]);
    expect(reg.list()).toEqual([
      { ref: 1, url: "https://a.example/x", title: "A", publisher: "Pub", excerpt: "first" },
      { ref: 2, url: "https://b.example/y", title: "B", publisher: "Pub", excerpt: "second" },
    ]);
    expect(createSourceRegistry().list()).toEqual([]);
  });
});

// ---------- registry ----------
describe("buildTools", () => {
  it("exposes every tool as a Mastra tool with typed input and output", () => {
    const tools = buildTools({ config: testConfig(), sources: createSourceRegistry() });
    expect(Object.keys(tools).sort()).toEqual(
      ["calculator", "companyRegistry", "extractTables", "fetchPage", "fxRates", "internalData", "recordSource", "secFilings", "webSearch"].sort(),
    );
    for (const [key, tool] of Object.entries(tools)) {
      expect(tool.id, key).toBeTruthy();
      expect(tool.description.length, key).toBeGreaterThan(20);
      expect(tool.inputSchema, key).toBeTruthy();
      expect(tool.outputSchema, key).toBeTruthy();
    }
  });

  it("runs a tool through the Mastra wrapper", async () => {
    const tools = buildTools({ config: testConfig(), sources: createSourceRegistry() });
    const execute = tools.calculator.execute;
    if (!execute) throw new Error("calculator tool has no execute");
    const out = await execute({ op: "cagr", start: 100, end: 121, years: 2 }, {} as Parameters<typeof execute>[1]);
    expect(out).toMatchObject({ value: expect.closeTo(0.1, 9) });
  });
});
