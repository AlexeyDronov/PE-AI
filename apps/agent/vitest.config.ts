import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@contracts": fileURLToPath(new URL("../../packages/contracts/src", import.meta.url)),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      zod: fileURLToPath(new URL("./node_modules/zod", import.meta.url)),
    },
  },
  test: { environment: "node", globals: true, include: ["tests/**/*.test.ts"], setupFiles: ["./tests/setup.ts"] },
});
