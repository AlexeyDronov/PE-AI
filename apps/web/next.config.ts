import type { NextConfig } from "next";

// A second dev server (E2E) needs its own build dir AND its own tsconfig: Next rewrites the tsconfig it uses to
// include its build dir's types, and a rewrite of the shared tsconfig.json restarts every other running dev server.
const distDir = process.env.NEXT_DIST_DIR ?? ".next";

const config: NextConfig = {
  distDir,
  reactStrictMode: true,
  typescript: { tsconfigPath: distDir === ".next" ? "tsconfig.json" : `tsconfig${distDir.replace(/^\.next/, "")}.json` },
};

export default config;
