import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const db = `${repo}e2e/.tmp/e2e.sqlite`;
const apiEnv = {
  DATABASE_PATH: db,
  AGENT_URL: "http://localhost:4199",
  AGENT_SERVICE_TOKEN: "e2e-token",
  CORS_ORIGINS: '["http://localhost:3100"]',
};
const TIMEOUT = 240_000;

export default defineConfig({
  testDir: "./tests",
  outputDir: "../test-results",
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // Full-page screenshots of long pages (the gallery) need longer than the 5s default to compare.
  expect: { toHaveScreenshot: { timeout: 30_000 } },
  use: {
    baseURL: "http://localhost:3100",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  // Page checks run first, on the freshly seeded DB; flows write data, so they depend on "pages".
  projects: [
    { name: "pages", testMatch: /(a11y|visual)\.spec\.ts/, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "flows", testMatch: /flows\.spec\.ts/, dependencies: ["pages"], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `rm -f "${db}" "${db}"-* && uv run python -m seed.seed && uv run uvicorn app.main:app --port 8100`,
      cwd: `${repo}apps/api`,
      env: apiEnv,
      url: "http://localhost:8100/api/memo-outline",
      reuseExistingServer: false,
      timeout: TIMEOUT,
    },
    {
      command: "node e2e/support/fake-agent.mjs",
      cwd: repo,
      url: "http://localhost:4199/health",
      reuseExistingServer: false,
      timeout: TIMEOUT,
    },
    {
      // Production build + start: no on-demand compiling or file watching, so runs are fast and never disturb the dev server.
      command: "pnpm exec next build && pnpm exec next start -p 3100",
      cwd: `${repo}apps/web`,
      env: { NEXT_PUBLIC_API_URL: "http://localhost:8100", NEXT_DIST_DIR: ".next-e2e" },
      url: "http://localhost:3100",
      reuseExistingServer: false,
      timeout: TIMEOUT,
    },
  ],
});
