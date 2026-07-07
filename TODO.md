# Epic: D&D Initiative Tracker

**Goal:** Generate implementation backlog from spec at `.specs/dnd-initiative-tracker.md`

---

## Spikes

- [x] SPIKE: Project scaffold & build tooling — 11 findings, confirmed greenfield
- [x] SPIKE: Shared contracts (message types, constants) — 4 findings, all CONFIRMED
- [x] SPIKE: Server implementation (session store, WS handler, room code) — 6 findings, 17 edge cases
- [x] SPIKE: Client implementation (Svelte components, WS hook) — 12 files identified
- [x] SPIKE: PWA setup + deployment config + tests — 22 findings across 5 areas

---

## Firm Tasks

### Execution order: Layer 0 → Layer 1 → Layers 2+3 (parallel) → Layer 4 → Layer 5
### Agent note: All tasks are greenfield file creation. Use "general" type for all.

### Layer 0: Shared contracts (no deps, ~1 session to create all 3 files)
- [ ] P0: Create `src/shared/constants.ts` — all spec constants + error code enum
  - agent: general — creates single-file module. Requires: TypeScript enums, spec reading.
- [ ] P0: Create `src/shared/types.ts` — Session, Player, TurnState interfaces
  - agent: general — creates single-file module. Requires: TypeScript interfaces, data modeling.
- [ ] P0: Create `src/shared/messages.ts` — discriminated unions for ClientMessage (10 types) + ServerMessage (12 types)
  - agent: general — creates single-file module. Requires: TypeScript discriminated unions, message protocol design.

### Layer 1: Project scaffold (depends on Layer 0, ~1 session)
- [ ] P0: Create `package.json` — runtime (svelte, express, ws) + dev (typescript, vite, @sveltejs/vite-plugin-svelte, tsx, concurrently, vitest, @playwright/test)
  - agent: general — creates root config file. Requires: npm/package.json conventions.
- [ ] P0: Create `.gitignore` — node_modules, dist, .env
  - agent: general — creates root config file. Requires: standard Node gitignore patterns.
- [ ] P0: Create `tsconfig.json` — strict, @shared/* path alias
  - agent: general — creates root config file. Requires: TypeScript strict mode config, path aliases.
- [ ] P0: Create `vite.config.ts` — Svelte plugin, dev proxy (/ws, /api/* -> localhost:3000)
  - agent: general — creates root config file. Requires: Vite config, Svelte plugin, proxy middleware.
- [ ] P0: Create `index.html` at project root — `<script type="module" src="/src/client/main.ts">`
  - agent: general — creates root file. Requires: SPA entry point HTML.
- [ ] P0: Create `src/` directory tree — client/, server/, shared/ subdirectories
  - agent: general — mkdir -p operation.

### Layer 2: Server implementation (depends on Layer 0-1, ~2 sessions)
- [ ] P0: Create `src/server/roomCode.ts` — 4-digit generation from charset 23456789 with collision retry
  - agent: general — single-file module. Requires: random code generation, collision detection.
- [ ] P0: Create `src/server/sessionStore.ts` — in-memory Map store, CRUD, sort logic, session expiry sweep
  - agent: general — core data layer (~100 loc). Requires: Map-based in-memory store, sort algorithms, timer-based sweep.
- [ ] P0: Create `src/server/wsHandler.ts` — message router, 10 handlers, broadcast, auth gating, error codes
  - agent: general — largest server file (~200 loc). Requires: ws library, message routing, broadcast pattern, auth tokens.
- [ ] P0: Create `src/server/index.ts` — Express setup, static serving, WS upgrade, /health, graceful shutdown
  - agent: general — server entry point. Requires: Express, http-server, ws upgrade pattern, signal handling.

### Layer 3: Client implementation (depends on Layer 0-1, ~2-3 sessions)
- [ ] P0: Create `src/client/lib/wsClient.ts` — WebSocket singleton, reconnect with exponential backoff, message send/receive
  - agent: general — client-side WS abstraction. Requires: browser WebSocket API, reconnect patterns, backoff.
- [ ] P0: Create `src/client/lib/types.ts` — client-side types, re-exports from shared
  - agent: general — small types file. Requires: type re-exports.
- [ ] P0: Create `src/client/hooks/useSession.ts` — Svelte 5 runes wrapping wsClient, reactive session state
  - agent: general — Svelte 5 runes ($state, $derived, $effect). Requires: Svelte 5 runes API.
- [ ] P0: Create `src/client/hooks/useTurnState.ts` — $derived turn computations (current player, round)
  - agent: general — Svelte 5 $derived computations. Requires: Svelte 5 derived state.
- [ ] P0: Create `src/client/components/Lobby.svelte` — join/create session form, validation, error display
  - agent: general — Svelte component with form handling. Requires: Svelte 5 event handling, form validation.
- [ ] P0: Create `src/client/components/PlayerList.svelte` — sorted initiative list, turn highlight, DM reorder/remove
  - agent: general — core UI component. Requires: Svelte 5 {#each} with key, drag-style reorder (click up/down).
- [ ] P0: Create `src/client/components/PlayerEntry.svelte` — name + initiative form, inline validation
  - agent: general — inline form component. Requires: controlled input, numeric validation.
- [ ] P0: Create `src/client/components/DMToolbar.svelte` — advance/previous turn, reset, room code + admin key display
  - agent: general — DM controls panel. Requires: button styling, room code/key copy UX.
- [ ] P0: Create `src/client/components/TurnIndicator.svelte` — current turn banner, round counter, reconnection overlay
  - agent: general — display component. Requires: conditional rendering, round tracking.
- [ ] P0: Create `src/client/App.svelte` — view routing (lobby vs session), sessionStorage restore on mount
  - agent: general — root component. Requires: conditional view rendering, sessionStorage persistence.
- [ ] P0: Create `src/client/main.ts` — mount app, register service worker
  - agent: general — entry point. Requires: Svelte 5 mount API, service worker registration.
- [ ] P0: Create `src/client/app.css` — mobile-first responsive, dark theme, large touch targets, reconnection banner
  - agent: general — stylesheet. Requires: CSS custom properties, responsive design, mobile-first.

### Layer 4: PWA + Deployment (depends on Layer 2-3, ~1 session)
- [ ] P1: Create `public/manifest.json` — name, icons 192+512, display standalone
  - agent: general — static JSON file. Requires: PWA manifest spec.
- [ ] P1: Create `public/sw.js` — service worker for asset caching
  - agent: general — SW file. Requires: service worker caching strategies.
- [ ] P1: Create `Dockerfile` — multi-stage Node.js build, dist/ served on port 3000
  - agent: general — Docker config. Requires: multi-stage Dockerfile conventions.
- [ ] P1: Create `fly.toml` — internal_port 3000, shared-cpu-1x 256MB
  - agent: general — Fly.io config. Requires: fly.toml format.
- [ ] P1: Create `.github/workflows/deploy.yml` — push to main -> fly deploy
  - agent: general — CI config. Requires: GitHub Actions, fly deploy action.

### Layer 5: Tests (depends on Layer 2-4, ~2 sessions)
- [ ] P1: Create `tests/vitest.config.ts`
  - agent: general — test config. Requires: Vitest config.
- [ ] P1: Create `tests/unit/server/roomCode.test.ts` — code format, collision retry
  - agent: general — vitest unit tests. Requires: vitest, property-based testing concepts.
- [ ] P1: Create `tests/unit/server/sessionStore.test.ts` — CRUD, sort, expiry, constraints
  - agent: general — vitest unit tests (~100 loc). Requires: vitest mock timers, in-memory store testing.
- [ ] P1: Create `tests/unit/server/wsHandler.test.ts` — message routing, auth, error codes
  - agent: general — vitest unit tests. Requires: WS handler mocking, message protocol testing.
- [ ] P1: Create `tests/e2e/playwright.config.ts`
  - agent: general — test config. Requires: Playwright config.
- [ ] P1: Create `tests/e2e/session-lifecycle.spec.ts` — AC-01 through AC-05, AC-18, AC-19, AC-23
  - agent: general — Playwright e2e. Requires: multi-page Playwright, WS-aware testing.
- [ ] P1: Create `tests/e2e/realtime.spec.ts` — AC-08, AC-11, AC-12, AC-20 (multi-tab)
  - agent: general — Playwright e2e. Requires: multi-client Playwright, realtime sync assertions.
- [ ] P1: Create `tests/e2e/dm.spec.ts` — AC-10, AC-13, AC-14, AC-15
  - agent: general — Playwright e2e. Requires: DM admin actions testing.
- [ ] P2: Create `tests/unit/server/index.test.ts` — health endpoint, WS upgrade
  - agent: general — vitest unit tests. Requires: HTTP server testing patterns.
- [ ] P2: Create `tests/unit/shared/messages.test.ts` — message contracts
  - agent: general — vitest unit tests. Requires: discriminated union exhaustiveness checks.
- [ ] P2: Create `tests/e2e/errors.spec.ts` — AC-16, AC-17, AC-04
  - agent: general — Playwright e2e. Requires: error state assertions, validation testing.
- [ ] P2: Create `tests/e2e/cleanup.spec.ts` — AC-21, AC-22, AC-24
  - agent: general — Playwright e2e. Requires: timeout-based assertions, session expiry testing.
