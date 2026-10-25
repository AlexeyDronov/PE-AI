import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { Config } from "../config";
import { calculate } from "./calculator";
import { searchCompanies } from "./companyRegistry";
import { extractTables } from "./extractTables";
import { fetchHtml, fetchPage } from "./fetchPage";
import { convertCurrency } from "./fxRates";
import { readInternal } from "./internalData";
import type { SourceRegistry } from "./recordSource";
import { searchFilings } from "./secFilings";
import { MAX_SEARCH_RESULTS, TavilyProvider, searchWeb } from "./webSearch";

const calcInput = z.discriminatedUnion("op", [
  z.object({ op: z.literal("cagr"), start: z.number(), end: z.number(), years: z.number() }),
  z.object({ op: z.literal("multiple"), numerator: z.number(), denominator: z.number() }),
  z.object({ op: z.literal("pct_change"), from: z.number(), to: z.number() }),
  z.object({ op: z.literal("share"), part: z.number(), whole: z.number() }),
]);

/** Build the agent's tools; config and the per-job source registry are captured by closure. */
export function buildTools({ config, sources }: { config: Config; sources: SourceRegistry }) {
  const provider = config.keys.tavily ? new TavilyProvider(config.keys.tavily) : null;

  const calculator = createTool({
    id: "calculator",
    description:
      "Exact arithmetic. Use for every calculation instead of doing maths yourself. ops: cagr (start, end, years), multiple (numerator/denominator), pct_change (from, to), share (part/whole). Ratios return as fractions (0.15 = 15%) with the formula used.",
    inputSchema: calcInput,
    outputSchema: z.object({ value: z.number(), formula: z.string() }),
    execute: async (input) => calculate(input),
  });

  const webSearch = createTool({
    id: "webSearch",
    description: `Search the web for market data, news, deals and company information. Returns up to ${MAX_SEARCH_RESULTS} results with title, url, snippet, publishedDate (or null) and relevance score. Follow up with fetchPage to read a promising result.`,
    inputSchema: z.object({ query: z.string().min(1), maxResults: z.number().int().min(1).max(MAX_SEARCH_RESULTS).default(5) }),
    outputSchema: z.object({
      results: z.array(
        z.object({ title: z.string(), url: z.string(), snippet: z.string(), publishedDate: z.string().nullable(), score: z.number() }),
      ),
    }),
    execute: async (input) => searchWeb(input, provider),
  });

  const fetchPageTool = createTool({
    id: "fetchPage",
    description:
      "Fetch a public web page (http/https HTML only) and return its readable text with scripts and navigation removed. Respects robots.txt; refuses private addresses and non-HTML files. Output is truncated to maxChars (flagged by truncated).",
    inputSchema: z.object({ url: z.string().min(1), maxChars: z.number().int().min(100).max(50_000).default(12_000) }),
    outputSchema: z.object({ url: z.string(), title: z.string(), text: z.string(), truncated: z.boolean() }),
    execute: async (input) => fetchPage(input),
  });

  const extractTablesTool = createTool({
    id: "extractTables",
    description:
      "Fetch a public web page and extract its HTML tables as structured data. Returns each table's caption (or null), headers and rows of cell text. Use for market-size tables, comparable multiples and other figures that plain text loses.",
    inputSchema: z.object({ url: z.string().min(1) }),
    outputSchema: z.object({
      tables: z.array(z.object({ caption: z.string().nullable(), headers: z.array(z.string()), rows: z.array(z.array(z.string())) })),
    }),
    execute: async ({ url }) => ({ tables: extractTables(await fetchHtml(url)) }),
  });

  const companyRegistry = createTool({
    id: "companyRegistry",
    description:
      "Search UK Companies House by company name. Returns matching companies with name, company number, status, incorporation date and registered address. Use to verify a UK target exists and is active.",
    inputSchema: z.object({ query: z.string().min(1) }),
    outputSchema: z.object({
      companies: z.array(
        z.object({ name: z.string(), number: z.string(), status: z.string(), incorporated: z.string().nullable(), address: z.string() }),
      ),
    }),
    execute: async (input) => searchCompanies(input, config.keys.companiesHouse),
  });

  const secFilings = createTool({
    id: "secFilings",
    description:
      "Full-text search of SEC EDGAR filings (default forms 10-K and 10-Q) for a phrase. Use to find US-listed comparable companies and what they say about a market. Returns company, CIK, form, filing date and the filing URL.",
    inputSchema: z.object({ phrase: z.string().min(1), forms: z.array(z.string()).min(1).default(["10-K", "10-Q"]) }),
    outputSchema: z.object({
      filings: z.array(z.object({ company: z.string(), cik: z.string(), form: z.string(), filed: z.string(), url: z.string() })),
    }),
    execute: async (input) => searchFilings(input, config.secUserAgent),
  });

  const fxRates = createTool({
    id: "fxRates",
    description:
      "Convert an amount between currencies (for example USD to GBP) using ECB daily reference rates. Returns the converted amount, the rate applied and the rate date (asOf). Use it to normalise figures to pounds.",
    inputSchema: z.object({ amount: z.number(), from: z.string().length(3), to: z.string().length(3) }),
    outputSchema: z.object({ amount: z.number(), rate: z.number(), asOf: z.string() }),
    execute: async (input) => convertCurrency(input),
  });

  const internalData = createTool({
    id: "internalData",
    description:
      "Read-only access to Harrowgate's own data for context. resource is one of segments, deals, transactions, research-reports, portfolio-companies, market-summary, pipeline-summary; optional id for one record; params are query-string filters such as segment_id. Returns the API's JSON.",
    inputSchema: z.object({
      resource: z.string().min(1),
      id: z.string().optional(),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    }),
    outputSchema: z.unknown(),
    execute: async (input) => readInternal(input, config.apiUrl),
  });

  const recordSource = createTool({
    id: "recordSource",
    description:
      "Register a citation for a fact you found, with its url, title, publisher and a short supporting excerpt. Returns a numeric ref; every numeric finding must reference at least one recorded source. Recording the same URL again returns the same ref.",
    inputSchema: z.object({ url: z.string().min(1), title: z.string().min(1), publisher: z.string().min(1), excerpt: z.string().min(1) }),
    outputSchema: z.object({ ref: z.number().int() }),
    execute: async (input) => sources.record(input),
  });

  return { calculator, webSearch, fetchPage: fetchPageTool, extractTables: extractTablesTool, companyRegistry, secFilings, fxRates, internalData, recordSource };
}
