# Initiative Tracker

Real-time D&D initiative tracker. The DM creates a room, players join with a 4-digit code and their initiative, and everyone sees the turn order update live.

Stack: Svelte 5 SPA, Express + `ws` server, in-memory session store. The specs and the current fix plan are in `.specs/`.

## Development

```sh
npm ci
npm run dev      # Vite on :5173 + server on :3000
npm run check    # tsc + svelte-check
npm test         # unit tests
npm run test:e2e # build, then browser tests (Playwright) against the production server
npm run build    # client to dist/client/, server to dist/server/index.cjs
npm start        # serve the production build on $PORT (default 3000)
```

## Deploying (Railway)

`.github/workflows/ci.yml` runs check, tests, build and a Docker build on every PR and every push to `master`. On `master`, once CI passes, it deploys with the Railway CLI (`railway up`). The service settings live in `.railway/railway.ts` (Railway Infrastructure as Code). They cover the Dockerfile build, the `/health` healthcheck, the restart policy, 1 replica and no app sleeping. CI previews changes to them with `railway config plan` on every PR, and applies them with `railway config apply` before each deploy.

One-time setup:

1. In Railway, create a project with an empty service (for example `web`). **Don't** connect the GitHub repo to the service. Deploys come from the workflow, and connecting the repo would deploy every push twice, skipping CI.
2. Under the service's **Settings → Networking**, generate a public domain.
3. In the project's **Settings → Tokens**, create a project token for the production environment.
4. In the GitHub repo's **Settings → Secrets and variables → Actions**:
   - add the secret `RAILWAY_TOKEN`, holding the project token
   - add the variable `RAILWAY_SERVICE`, holding the service name (for example `web`)

Sessions live only in server memory, so `.railway/railway.ts` pins the service to **1 replica** with **App Sleeping off**. Don't change either in the Railway dashboard: the next deploy applies the file again.

A deploy or restart ends every active session.
