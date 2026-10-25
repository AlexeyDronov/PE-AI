/** Real responses recorded from the live services (found by a live smoke check after 7.2):
 *  the ECB feed uses single-quoted attributes, and real pages broke the regex HTML-to-text helper. */
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { fetchPage } from "@/tools/fetchPage";
import { convertCurrency } from "@/tools/fxRates";
import { fixture } from "./helpers";
import { server } from "./setup";

describe("ECB live format", () => {
  it("parses the real feed (single-quoted attributes)", async () => {
    server.use(
      http.get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", () =>
        new HttpResponse(fixture("ecb-daily-live.xml"), { headers: { "content-type": "text/xml" } }),
      ),
    );
    const xml = fixture("ecb-daily-live.xml");
    const rate = (c: string) => Number(new RegExp(`currency='${c}' rate='([0-9.]+)'`).exec(xml)?.[1]);
    const r = await convertCurrency({ amount: 100, from: "USD", to: "GBP" });
    expect(r.asOf).toBe("2026-10-23");
    expect(r.amount).toBeCloseTo((100 / rate("USD")) * rate("GBP"), 6);
  });
});

describe("HTML to text on a real page", () => {
  it("returns clean prose: no markup fragments, attribute debris, scripts or styles", async () => {
    server.use(
      http.get("https://www.gov.uk/robots.txt", () => new HttpResponse("User-agent: *\nDisallow: /search/\n", { headers: { "content-type": "text/plain" } })),
      http.get("https://www.gov.uk/government/organisations/financial-conduct-authority", () =>
        new HttpResponse(fixture("govuk-fca.html"), { headers: { "content-type": "text/html; charset=utf-8" } }),
      ),
    );
    const page = await fetchPage({ url: "https://www.gov.uk/government/organisations/financial-conduct-authority", maxChars: 20000 });
    expect(page.title).toBe("Financial Conduct Authority - GOV.UK");
    expect(page.text).toContain("Financial Conduct Authority");
    for (const debris of ['">', "</", "<a ", "class=", "{", "function(", "window."]) expect(page.text).not.toContain(debris);
    expect(page.text).not.toMatch(/[ \t]{3,}/);
    expect(page.text).not.toMatch(/\n{3,}/);
  });
});
