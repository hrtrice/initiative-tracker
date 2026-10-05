# Initiative Tracker

A real-time initiative tracker for in-person D&D games. The DM creates a room, players join from their phones with a 4-digit code and enter their initiative, and everyone sees the turn order update live. No accounts, no installs, no sticky notes.

> A hobby project built with a professional workflow: specs first, typed end to end, unit and browser tests, and CI/CD to production.

## Features

- **Jackbox-style joining.** Players join with a short room code. No sign-up.
- **Live turn order.** Changes reach every device over WebSockets, targeting sub-second latency.
- **DM controls.** The DM runs the table from a phone and can edit, reorder and correct entries. Players can only submit their own initiative.
- **Health tracking** with per-NPC visibility for players, and a table QR code that pre-fills the table number.
- **Installable PWA** with mobile-first layouts that work from 320px wide.
- **Themed UI** (tavern, tome and torchlit designs in `design/themes/`).

## Tech stack

| Area | Choice |
|------|--------|
| Client | Svelte 5, TypeScript, Vite |
| Server | Node.js, Express, `ws` (in-memory session store) |
| Shared | Typed message contracts in `src/shared/` used by client and server |
| Testing | Unit tests plus Playwright end-to-end tests |
| Delivery | GitHub Actions CI, Docker, Railway (infrastructure as code in `.railway/`) |

## Design notes

- Sessions are ephemeral and live in server memory. That fits a single table of about 20 people and keeps the app simple and free to host.
- The DM is the sole authority over the order, so there are no concurrent-edit conflicts to resolve. That is why it uses plain WebSockets instead of CRDTs.
- The product spec and fix plan are in [`.specs/`](.specs/).

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

## License

[MIT](LICENSE)
