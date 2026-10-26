import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  // The pnpm workspace root; set explicitly so a checkout nested in another (a git worktree) doesn't pick the outer one.
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
};

export default config;
