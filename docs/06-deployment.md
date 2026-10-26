# Deployment: web on Vercel, API and agent on Fly

| Service | Where | URL | Notes |
|---|---|---|---|
| Web (Next.js) | Vercel | `https://<project>.vercel.app` | Built from `apps/web`; talks to the API over HTTPS |
| API (FastAPI) | Fly app `harrowgate-api`, London | `https://harrowgate-api.fly.dev` | One always-on machine; SQLite on a 1 GB volume at `/data` |
| Agent (Mastra) | Fly app `harrowgate-agent`, London | private only | One always-on machine; reached by the API at `harrowgate-agent.internal:4111` |

The API and agent call each other over Fly's private network, authenticated with a shared `AGENT_SERVICE_TOKEN`. Only the API is public.

Expected cost: two `shared-cpu-1x` / 512 MB machines plus a 1 GB volume, about **$5–10 a month** on Fly. Vercel Hobby is free. Agent jobs bill to your Anthropic and Tavily accounts as they do locally.

> **Access control is deferred.** Anyone with the Vercel URL can use the app and start paid agent jobs. Keep the URL private until a login or password gate is added.

Run every command below from the repo root unless the step says otherwise.

## 1. Install and sign in to the Fly CLI (once)

```bash
brew install flyctl
```

```bash
fly auth login
```

You don't need Docker: Fly builds the images on its own servers.

## 2. Create the two apps and the volume (once)

```bash
fly apps create harrowgate-api
```

```bash
fly apps create harrowgate-agent
```

If a name is taken, pick another and change `app = ...` in `apps/api/fly.toml` or `apps/agent/fly.toml`. Also change the matching `.internal` hostname in the other app's file.

```bash
fly volumes create harrowgate_data --app harrowgate-api --region lhr --size 1
```

Fly warns that a single volume has no redundancy. Answer yes; step 6 explains backups.

## 3. Set the secrets (once; values never go in git)

A shared token lets the API and agent trust each other. This generates one and stores it on both apps without printing it:

```bash
TOKEN=$(openssl rand -hex 32) && fly secrets set AGENT_SERVICE_TOKEN="$TOKEN" --app harrowgate-api --stage && fly secrets set AGENT_SERVICE_TOKEN="$TOKEN" --app harrowgate-agent --stage && unset TOKEN
```

The agent's model and search keys come from your local `.env`:

```bash
grep -E '^(ANTHROPIC_API_KEY|TAVILY_API_KEY)=' .env | fly secrets import --app harrowgate-agent --stage
```

`CORS_ORIGINS` is set in step 8, once Vercel has given the site its address.

## 4. Deploy the agent, then the API

Agent (built from the repo root, because it uses the workspace lockfile and the shared contracts):

```bash
fly deploy . --config apps/agent/fly.toml --dockerfile apps/agent/Dockerfile --remote-only
```

API (built from its own folder). On first boot it seeds a demo database on the volume:

```bash
cd apps/api && fly deploy --remote-only
```

Check that the API is up:

```bash
curl https://harrowgate-api.fly.dev/api/health
```

## 5. Replace the seeded database with your dev database (once)

Take a consistent snapshot of the local database (stop `make dev` first):

```bash
sqlite3 apps/api/data/harrowgate.sqlite ".backup /tmp/harrowgate-upload.sqlite"
```

Move the seeded file aside on the volume, upload the snapshot and restart:

```bash
fly ssh console --app harrowgate-api -C "mv /data/harrowgate.sqlite /data/harrowgate-seed.sqlite"
```

```bash
fly ssh sftp put /tmp/harrowgate-upload.sqlite /data/harrowgate.sqlite --app harrowgate-api
```

```bash
fly apps restart harrowgate-api
```

Check that your deals are there:

```bash
curl -s https://harrowgate-api.fly.dev/api/deals | head -c 300
```

## 6. Backups

Fly snapshots volumes daily and keeps them for 5 days (`fly volumes snapshots list <volume id>`). For an extra copy, pull the database down whenever you like:

```bash
fly ssh sftp get /data/harrowgate.sqlite /tmp/harrowgate-prod-backup.sqlite --app harrowgate-api
```

## 7. Create the Vercel project (once)

In the Vercel dashboard, **Add New → Project**, import the GitHub repo, then set:

- **Root Directory:** `apps/web` (leave "Include files outside the root directory" on; the web app reads `packages/contracts`)
- **Framework preset:** Next.js (detected)
- **Environment variables** (Production and Preview):
  - `NEXT_PUBLIC_API_URL` = `https://harrowgate-api.fly.dev`
  - `ENABLE_EXPERIMENTAL_COREPACK` = `1` (so Vercel uses the pnpm version pinned in `package.json`)

Deploy, and note the production address, e.g. `https://pe-ai.vercel.app`.

## 8. Allow the Vercel site to call the API

Use your real Vercel address. This restarts the API:

```bash
fly secrets set CORS_ORIGINS='["https://pe-ai.vercel.app"]' --app harrowgate-api
```

Preview deployments get their own random addresses, which this list doesn't allow, so previews show "API unreachable". Production works. Add a custom domain later and list it here too.

## 9. Check it end to end

1. Open the Vercel URL. Overview should show your fund's figures.
2. Open Screen a teaser and run one screen. This is a real paid run, about $0.001.
3. If anything fails, read the logs:

```bash
fly logs --app harrowgate-api
```

```bash
fly logs --app harrowgate-agent
```

## Updating later

- **Web:** every push to the GitHub default branch redeploys on Vercel.
- **API:**

```bash
cd apps/api && fly deploy --remote-only
```

- **Agent:**

```bash
fly deploy . --config apps/agent/fly.toml --dockerfile apps/agent/Dockerfile --remote-only
```

The database on the volume survives deploys and restarts.
