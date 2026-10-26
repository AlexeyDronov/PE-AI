# Backlog

- [ ] **Dark mode rework.** The product owner will rework the dark palette and component treatment later (deferred 25 Oct 2026). Until then, keep dark tokens wired up but do not polish them. See design doc §2.1.
- [x] **ResearchFinding.confidence** is stored as a float, and the API maps the agent's "low/medium/high" onto 0.3/0.6/0.9. Change the column to a string enum when the research agent is built, so no meaning is invented.
- [x] **Tighten hook input types.** `useResource` (compute resources) and `useCommand.run` accept `Partial<…>` inputs, because the early hook tests used minimal inputs. Update those tests to use realistic `LboRequest` and command inputs, then make the hook types strict again.
- [ ] **Choose the LLM provider** before plan step 7.4 (OpenRouter vs a direct provider). Then update `apps/agent/src/llm.ts`, the config key names and `.env.example`, and docs/01 decision D3's wording.
- [ ] **Seed data: Project Linden** risk flag says "Entry multiple above segment median", but its ask (15.5x) is below the Compliance median (16.0x). Found by the 7.7 live memo run. Fix the flag text or the multiples in `seed/fixtures/deals.yaml`.
