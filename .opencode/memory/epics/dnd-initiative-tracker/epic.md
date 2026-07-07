# Epic: D&D Initiative Tracker

**Epic ID**: dnd-initiative-tracker
**Created**: 2026-07-07
**Source**: /blossom
**Goal**: Generate implementation backlog for D&D Initiative Tracker from spec at `.specs/dnd-initiative-tracker.md`

## Spike Findings

### Items (42 total)

1. **Create `src/shared/constants.ts`** — spec constants + error code enum
   - source: `.specs/dnd-initiative-tracker.md`
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

2. **Create `src/shared/types.ts`** — Session, Player, TurnState interfaces
   - source: `.specs/dnd-initiative-tracker.md:50-80`
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

3. **Create `src/shared/messages.ts`** — 10 client + 12 server discriminated union message types
   - source: `.specs/dnd-initiative-tracker.md:81-130`
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

4. **Create `package.json`** — runtime + dev deps
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

5. **Create `.gitignore`** — node_modules, dist, .env
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

6. **Create `tsconfig.json`** — strict, @shared/* path alias
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

7. **Create `vite.config.ts`** — Svelte plugin, dev proxy for /ws and /api
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

8. **Create `index.html`** — SPA entry point with module script
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

9. **Create `src/` directory tree** — client/, server/, shared/
   - source: spike-1
   - confidence: CONFIRMED
   - priority: P0
   - depends-on: none
   - agent: general

10. **Create `src/server/roomCode.ts`** — 4-digit code generation with collision retry
    - source: spike-3
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 1, 4, 6
    - agent: general

11. **Create `src/server/sessionStore.ts`** — in-memory Map store, CRUD, sort, expiry
    - source: spike-3
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 1, 2, 4, 6
    - agent: general

12. **Create `src/server/wsHandler.ts`** — message router, 10 handlers, broadcast, auth
    - source: spike-3
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 3, 4, 6, 10, 11
    - agent: general

13. **Create `src/server/index.ts`** — Express setup, WS upgrade, /health, graceful shutdown
    - source: spike-3
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 4, 6, 12
    - agent: general

14. **Create `src/client/lib/wsClient.ts`** — WebSocket singleton, reconnect, backoff
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 3, 4, 6
    - agent: general

15. **Create `src/client/lib/types.ts`** — client types + shared re-exports
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 2, 4, 6
    - agent: general

16. **Create `src/client/hooks/useSession.ts`** — Svelte 5 runes wrapping wsClient
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 14, 15
    - agent: general

17. **Create `src/client/hooks/useTurnState.ts`** — $derived turn computations
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16
    - agent: general

18. **Create `Lobby.svelte`** — join/create session form
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16
    - agent: general

19. **Create `PlayerList.svelte`** — sorted initiative list, DM controls
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16
    - agent: general

20. **Create `PlayerEntry.svelte`** — name + initiative form
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16
    - agent: general

21. **Create `DMToolbar.svelte`** — turn controls, room code, admin key
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16
    - agent: general

22. **Create `TurnIndicator.svelte`** — turn banner, round counter
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 16, 17
    - agent: general

23. **Create `App.svelte`** — view routing, sessionStorage restore
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 18, 19, 20, 21, 22
    - agent: general

24. **Create `main.ts`** — mount app, register SW
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 23, 8
    - agent: general

25. **Create `app.css`** — mobile-first dark theme
    - source: spike-4
    - confidence: CONFIRMED
    - priority: P0
    - depends-on: 23
    - agent: general

26. **Create `manifest.json`** — PWA manifest
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 24
    - agent: general

27. **Create `sw.js`** — service worker
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 24
    - agent: general

28. **Create `Dockerfile`** — multi-stage Node build
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 4, 6, 13, 24
    - agent: general

29. **Create `fly.toml`** — Fly.io config
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 28
    - agent: general

30. **Create `deploy.yml`** — GitHub Actions CI
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 28, 29
    - agent: general

31. **Create `vitest.config.ts`** — test config
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 4, 6
    - agent: general

32. **Create `roomCode.test.ts`** — unit tests
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 10, 31
    - agent: general

33. **Create `sessionStore.test.ts`** — unit tests
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 11, 31
    - agent: general

34. **Create `wsHandler.test.ts`** — unit tests
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 12, 31
    - agent: general

35. **Create `playwright.config.ts`** — e2e config
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 4, 6
    - agent: general

36. **Create `session-lifecycle.spec.ts`** — AC-01-05, AC-18, AC-19, AC-23
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 13, 24, 35
    - agent: general

37. **Create `realtime.spec.ts`** — AC-08, AC-11, AC-12, AC-20
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 13, 24, 35
    - agent: general

38. **Create `dm.spec.ts`** — AC-10, AC-13, AC-14, AC-15
    - source: spike-5
    - confidence: CONFIRMED
    - priority: P1
    - depends-on: 13, 24, 35
    - agent: general

39. **Create `index.test.ts`** — health + WS upgrade
    - confidence: LIKELY
    - priority: P2
    - depends-on: 13, 31
    - agent: general

40. **Create `messages.test.ts`** — contract exhaustiveness
    - confidence: LIKELY
    - priority: P2
    - depends-on: 3, 31
    - agent: general

41. **Create `errors.spec.ts`** — AC-16, AC-17, AC-04
    - confidence: LIKELY
    - priority: P2
    - depends-on: 13, 24, 35
    - agent: general

42. **Create `cleanup.spec.ts`** — AC-21, AC-22, AC-24
    - confidence: LIKELY
    - priority: P2
    - depends-on: 13, 24, 35
    - agent: general

## Priority Order

1. Layer 0: Shared contracts (items 1-3)
2. Layer 1: Project scaffold (items 4-9)
3. Layer 2: Server implementation (items 10-13)
4. Layer 3: Client implementation (items 14-25)
5. Layer 4: PWA + Deployment (items 26-30)
6. Layer 5: Tests (items 31-42)

## Task IDs

| Task ID | Title | Priority | Status | Assigned Agent |
|---------|-------|----------|--------|----------------|
| 1 | Create constants.ts | P0 | open | general |
| 2 | Create types.ts | P0 | open | general |
| 3 | Create messages.ts | P0 | open | general |
| 4 | Create package.json | P0 | open | general |
| 5 | Create .gitignore | P0 | open | general |
| 6 | Create tsconfig.json | P0 | open | general |
| 7 | Create vite.config.ts | P0 | open | general |
| 8 | Create index.html | P0 | open | general |
| 9 | Create src/ directory tree | P0 | open | general |
| 10 | Create roomCode.ts | P0 | open | general |
| 11 | Create sessionStore.ts | P0 | open | general |
| 12 | Create wsHandler.ts | P0 | open | general |
| 13 | Create server/index.ts | P0 | open | general |
| 14 | Create wsClient.ts | P0 | open | general |
| 15 | Create client lib/types.ts | P0 | open | general |
| 16 | Create useSession.ts | P0 | open | general |
| 17 | Create useTurnState.ts | P0 | open | general |
| 18 | Create Lobby.svelte | P0 | open | general |
| 19 | Create PlayerList.svelte | P0 | open | general |
| 20 | Create PlayerEntry.svelte | P0 | open | general |
| 21 | Create DMToolbar.svelte | P0 | open | general |
| 22 | Create TurnIndicator.svelte | P0 | open | general |
| 23 | Create App.svelte | P0 | open | general |
| 24 | Create main.ts | P0 | open | general |
| 25 | Create app.css | P0 | open | general |
| 26 | Create manifest.json | P1 | open | general |
| 27 | Create sw.js | P1 | open | general |
| 28 | Create Dockerfile | P1 | open | general |
| 29 | Create fly.toml | P1 | open | general |
| 30 | Create deploy.yml | P1 | open | general |
| 31 | Create vitest.config.ts | P1 | open | general |
| 32 | Create roomCode.test.ts | P1 | open | general |
| 33 | Create sessionStore.test.ts | P1 | open | general |
| 34 | Create wsHandler.test.ts | P1 | open | general |
| 35 | Create playwright.config.ts | P1 | open | general |
| 36 | Create session-lifecycle.spec.ts | P1 | open | general |
| 37 | Create realtime.spec.ts | P1 | open | general |
| 38 | Create dm.spec.ts | P1 | open | general |
| 39 | Create index.test.ts | P2 | open | general |
| 40 | Create messages.test.ts | P2 | open | general |
| 41 | Create errors.spec.ts | P2 | open | general |
| 42 | Create cleanup.spec.ts | P2 | open | general |

## Critical Path

Layer 0 (shared contracts) → Layer 1 (scaffold) → Layer 2 (server) OR Layer 3 (client) → Layer 4 (PWA + deploy) → Layer 5 (tests) = 5 sequential steps minimum

## Parallel Opportunities

- **Layer 2 (server) and Layer 3 (client):** Full parallelism — no shared files between src/server/ and src/client/. Both depend only on shared contracts + scaffold.
- **Layer 4 items:** manifest.json + sw.js are independent of Dockerfile + fly.toml + deploy.yml.
- **Layer 5 items:** Unit tests (items 31-34, 39-40) are independent of e2e tests (items 35-38, 41-42).
