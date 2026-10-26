# Agent service: cost-optimised design

Status: **APPROVED** 26 Oct 2026 · Amends architecture §8 and decision D3.

## Decisions

| | Before | Now |
|---|---|---|
| Provider | OpenRouter | **Anthropic API directly** (`@anthropic-ai/sdk`), key `ANTHROPIC_API_KEY` |
| Model | Sonnet per role | **`claude-haiku-5-5` for every job**, `output_config.effort: "medium"` (adaptive thinking, always on) |
| Shape | Autonomous agent loops with nine tools | **Code-orchestrated workflows**: code searches, fetches, filters and does arithmetic; the model is called a fixed, small number of times per job with a schema-constrained output |

Mastra stays the server and workflow engine (steps, retries, progress), and the nine tools stay. Code calls the tools directly instead of the model choosing them turn by turn. That removes the main cost driver in agent loops: resending the growing conversation every turn.

## Cost rules (apply to every request)

1. **One call per job where possible, at most two.** No open-ended tool loops on the hot path.
2. **Structured outputs** (`output_config.format`, JSON schema from the contract). No retries to fix malformed JSON, and no prose to parse.
3. **Prompt caching on the static prefix.** Each job type has a frozen system prompt: role, output rules, and only the playbook it needs. An explicit `cache_control` breakpoint sits on it, so it bills at the cache-read rate after the first call. Nothing volatile (dates, ids, user text) goes above the breakpoint. Haiku 5.5's minimum cacheable prefix is 512 tokens, which all three prompts exceed.
4. **Small, filtered input.**
   - Fetched pages are cut to the passages that mention the question's terms or contain figures, at most ~1,500 tokens per source and at most 6 sources.
   - Teasers pass a token-count gate first.
   - Deal and LBO context is sent as a compact JSON summary, not full API objects.
5. **Bounded output.**
   - `max_tokens` per job type: teaser 6,000; research 8,000; memo 10,000. Raised from 2,000 / 4,000 / 6,000 after live runs were cut off: adaptive thinking counts against the cap. The memo prompt also sets a 120–250 word budget per section. Caps bound the worst case (≤ $0.005 per call); typical use is far lower.
   - Every field in the schema has a length limit.
   - The prompt specifies the exact output shape.
6. **No model arithmetic or verification calls.** Code checks every cited figure: the number must appear in the cited source excerpt, otherwise the finding is dropped. Unit and currency conversion use the calculator and FX tools in code.
7. **Cache tool results** (search and page fetches keyed by query/URL, 24h). A repeated question spends no Tavily credits and fetches nothing.
8. **Handle refusals.** Haiku 5.5 has no server-side fallback, so `callClaude` checks `stop_reason` before reading content. `refusal` and `max_tokens` fail the job cleanly with a readable reason and never retry automatically.
9. **Measure every call.** Each job records input, cache-read, cache-write and output tokens, plus a £/$ estimate, on the job record. The UI and the cache-hit check read those figures.

## Per-job design

| Job | Code does | Model calls | Est. tokens per job | Est. cost* |
|---|---|---|---|---|
| **Teaser screen** | Token gate; afterwards validates extracted figures against ranges; the backend computes the score and verdict deterministically | **1**: extract financials, segment, flags with mitigants, diligence questions | ~1.5K cached system + ~2K teaser in; ~0.8K out | **≈ $0.0005** |
| **Market research** | Query templates → Tavily (basic depth, 5 results × ≤4 queries) → dedupe → fetch top 6 pages → passage filter → number sources | **1**, plus at most **1** gap-fill: findings with source refs, summary, up to 2 follow-up queries if evidence is thin. The second call reuses the cached prefix | ~1.5K cached + ~9K sources in; ~1.5K out (×2 worst case) | **≈ $0.002–0.004** |
| **IC memo draft** | Builds a compact deal + model summary (score, risks, debt capacity, LBO returns and sensitivity extremes) | **1**: all selected sections in one structured response | ~1.5K cached + ~3K context in; ~4K out | **≈ $0.003** |

\*Haiku 5.5 list prices: $0.10 input / $0.50 output per million tokens. Cache reads are cheaper still. Thinking tokens bill as output, and effort "medium" keeps them moderate. Estimates exclude Tavily credits.

## Not adopted (and why)

- **Message Batches (50% off):** results can take up to 24h, and these jobs are user-facing. Revisit for scheduled refreshes.
- **Autonomous agent loops:** they cost more per job and vary widely; the bounded gap-fill gives most of the benefit. The `market-researcher` agent stays available in Mastra Studio for manual deep dives only, and is never called by the app.
- **Server-side web search/fetch tools:** not available on Haiku 5.5 in their dynamic-filtering form, and Tavily plus local filtering is cheaper per source.

## Verification

- A **cache probe** script sends one representative request twice and fails unless the second call reads from the cache.
- Per-job **usage** is recorded and asserted in tests, using a stubbed client with recorded usage.
- One **live run per job type**, with your approval, reporting real token use and cost before ticking each step.
