import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@contracts": fileURLToPath(new URL("../../packages/contracts/src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.polyfills.ts", "./tests/setup/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    css: false,
    // Vite rewrites `new URL("<dir>", import.meta.url)` to an http asset URL in the web transform mode; the contract test reads real files.
    testTransformMode: { ssr: ["**/contracts.test.ts"] },
  },
});
