# Agent image for Fly. Build context: the repo root (for the pnpm workspace lockfile).
FROM node:22-slim AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Workspace manifests and lockfile first, so dependency installs are cached across code changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent/package.json apps/agent/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter "@harrowgate/agent..."

COPY apps/agent apps/agent
# The agent imports the generated API schemas through the `@contracts/*` path alias.
COPY packages/contracts packages/contracts
RUN cd apps/agent && pnpm exec mastra build --dir src/mastra

# Runtime: only the self-contained Mastra output (bundle, playbooks and its node_modules).
FROM node:22-slim
WORKDIR /app
COPY --from=build /repo/apps/agent/.mastra/output ./
ENV NODE_ENV=production \
    HOST=:: \
    PORT=4111
EXPOSE 4111
CMD ["node", "index.mjs"]
