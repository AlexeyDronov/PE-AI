// Fake agent service for E2E: answers jobs with fixed content, no model calls.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 4199);
const API = process.env.API_URL ?? "http://localhost:8100";
const TOKEN = process.env.AGENT_SERVICE_TOKEN ?? "e2e-token";

const USAGE = { calls: 1, inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, costUsd: 0 };
const LABELS = {
  summary: "Summary",
  thesis: "Investment thesis",
  market: "Market",
  financials: "Financials",
  valuation: "Valuation and returns",
  risks: "Risks",
  recommendation: "Recommendation",
};

const PAYLOADS = {
  teaser_screen: () => ({
    company: {
      name: "Fernhill Testing",
      description: "Founder-owned testing laboratory group serving construction and water clients.",
      hq: "Bristol",
      ownership: "Founder-owned",
      moat: "Accreditations and long-standing framework agreements",
    },
    segment: "TIC",
    code_name: "Project Fernhill",
    process: "Teaser circulated by adviser",
    ask_multiple: null,
    financials: {
      revenue: 52,
      ebitda: 11.4,
      growth: 0.1,
      recurring_pct: 0.7,
      capex_pct: 0.05,
      da_pct: 0.05,
      nwc_pct: 0.06,
      top_customer_pct: 0.08,
      gross_retention: 0.92,
      cyclicality: "Low",
      ai_resilience: 70,
      fragmentation: 75,
      key_person_risk: true,
    },
    risk_flags: [
      { severity: "m", text: "Single-site lab concentration", mitigant: "Visit the second site before signing" },
    ],
    diligence_questions: ["How much revenue is on framework agreements?"],
  }),
  market_research: () => ({
    summary: "E2E: UK TIC deal multiples ranged from 11x to 15x.",
    findings: [
      { metric: "Median TIC EV/EBITDA", value: 13.2, unit: "x", period: "2025", confidence: "medium", source_refs: [1] },
    ],
    sources: [
      {
        ref: 1,
        url: "https://example.org/tic",
        title: "TIC deals review 2026",
        publisher: "example.org",
        excerpt: "Median EV/EBITDA of 13.2x across 2025 deals.",
      },
    ],
  }),
  memo_draft: (input) => ({
    sections: input.sections.map((key) => ({
      key,
      markdown: `## ${LABELS[key] ?? key}\n\nE2E draft for ${input.context.deal.code_name}.`,
    })),
  }),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(path, body) {
  const response = await fetch(`${API}/internal/jobs/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) console.error(`fake-agent: ${path} -> ${response.status} ${await response.text()}`);
}

async function run(kind, jobId, input) {
  try {
    await sleep(200);
    await post(`${jobId}/progress`, { step: "working", message: "Reading the inputs" });
    await sleep(400);
    await post(`${jobId}/progress`, { step: "drafting", message: "Drafting the result" });
    await sleep(400);
    await post(`${jobId}/result`, { payload: PAYLOADS[kind](input), usage: USAGE });
  } catch (error) {
    console.error("fake-agent: job failed", error);
    await post(`${jobId}/fail`, { error: String(error) });
  }
}

createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET" && req.url === "/health") return send(200, { ok: true });
  const match = req.method === "POST" && req.url?.match(/^\/jobs\/([a-z_]+)\/start$/);
  if (!match || !(match[1] in PAYLOADS)) return send(404, { error: "not found" });
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(401, { error: "unauthorized" });
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const { jobId, input } = JSON.parse(raw);
    send(202, { jobId });
    void run(match[1], jobId, input);
  });
}).listen(PORT, () => console.log(`fake agent on :${PORT}`));
