# Spec: D&D Initiative Tracker

**Status:** READY FOR REVIEW
**Created:** 2026-07-06

---

## Problem Statement

Initiative tracking in in-person D&D games is slow and manual. The DM has to ask each person what their initiative number is, manage sticky notes with character/enemy info, and rearrange them by turn order. This tracker needs to be a site where players join via a shareable code (Jackbox-style), input their character's info and initiative count, and get auto-ordered. The DM must also be able to manage and edit the order in case of errors.

---

## Context & Constraints

**Greenfield project.** The codebase contains only opencode orchestration infrastructure — no application code, framework, package manifest, or database schema. All design decisions are unconstrained by legacy.

**Usage environment (in-person table):**
- Players connect on phones/tablets/laptops over the venue's WiFi or internet.
- **Stable internet assumed.** Can rely on a hosted server — cloud-only architectures are viable.
- **DM runs from their phone.** Table space for a laptop may be limited. The DM should be able to open a URL on their phone and have full admin control — no laptop required. This means no local-server approach; the app must be always-on and hosted.
- **Zero run cost at small scale.** Must operate on free-tier hosting (no monthly bills). The app's resource needs are tiny — a single table of ~20 users fits comfortably within Fly.io free tier, Railway free tier, or similar.
- **Latency sensitive.** Order changes must propagate sub-second (<500ms).
- **Device heterogeneity.** Players use any OS/browser/screen size. UI must be mobile-first, responsive, functional at 320px+ widths.
- **No app installation.** Pure web — no native install required.

**Session model (room-based, code-join):**
- Sessions are ephemeral, created by the DM. Players join via a short code (Jackbox model).
- **No authentication.** Joining requires only the code. Trust-based model for co-located friends.
- **DM-as-admin.** The session creator is the DM with unilateral authority over the order. Players submit their own initiative but cannot modify others.
- **No cross-session persistence.** State is discarded when the session ends.

**Real-time synchronization:**
- Initiative order is the single source of truth. DM actions always win. Player submissions are additive.
- Scale: 1 DM + up to ~20 players. Single room. Tiny state (5-30 entries per session).

**Deployment:**
- **Always-on hosted.** Must be deployed to a free-tier hosting platform (Fly.io, Railway, or equivalent). The DM opens a URL — no local server, no terminal, no laptop.
- **Zero cost.** Must stay within free-tier limits: Fly.io free allowance (3 shared-cpu-1x 256MB VMs, 3GB persistent storage) is more than sufficient for a single table.
- **CI/CD from GitHub.** Push to main → auto-deploys. The DM never touches infrastructure.
- **Fallback:** Local dev mode (`npm start` on laptop) for development only.

---

## Prior Art

No existing application code to draw from. However, established patterns inform this design:

**Room-based multiplayer (Jackbox, Board Game Arena):**
- Server holds room state; clients connect via short code; one client has admin privileges; state broadcasts to all clients.
- Session code: 4-char alphanumeric yields enough combinations for local play.

**Real-time sync patterns:**
- **WebSocket** is the natural fit — full-duplex, low latency, persistent. Avoids polling.
- **Raw `ws` + manual rooms** is the simplest viable architecture. A `Map<string, Set<WebSocket>>` pattern is well-documented and dependency-free.
- **Socket.IO** adds reconnection, buffering, and fallback transports — useful for spotty venue WiFi.
- **CRDT/OT** is overengineered — DM is the sole mutator, no concurrent edit conflicts.

**Server architecture:**
- Single-process Node.js with `ws` + Express — serves HTTP (static files) and WebSocket on one port. In-memory state. Express chosen for cleaner static file serving and middleware readability. Simple enough to run locally or deploy to Fly.io/Railway.

**Existing initiative trackers** (D&D Beyond, Improved Initiative, kobold.club) store a flat array of combatants with `{ id, name, initiative, isEnemy }`. Order is computed server-side as descending initiative. This pattern is proven and should be adopted directly.

---

## Proposed Approach

**Stack:** TypeScript (single `package.json`), Svelte 5 SPA frontend, Node.js/Express + WebSocket backend. Unified language shares types between client and server.

**Architecture:**

```
┌──────────────────────────────────────────────┐
│              Internet                         │
│                                               │
│   ┌────────────┐    ┌──────────────────┐      │
│   │ DM Phone   │    │  Player Phones   │      │
│   │ Admin View │    │  Player View     │      │
│   └─────┬──────┘    └────────┬─────────┘      │
│         └──────────┬─────────┘                 │
│                    │ HTTPS / WSS               │
│                    ▼                           │
│          ┌────────────────────────┐            │
│          │  Fly.io / Railway      │            │
│          │  (Node Server)         │            │
│          │  Session Store         │            │
│          │  (in-memory)           │            │
│          └────────────────────────┘            │
└──────────────────────────────────────────────┘
```

Dev mode: `npm run dev` runs Vite (port 5173) + server (port 3000) locally for development only. Production is always hosted.

**Key design decisions:**
1. **Hosted server process** — deployed to Fly.io/Railway free tier. Serves SPA + WebSocket on a single public URL.
2. **WebSocket as primary transport** — all session state over a single WSS connection. REST only for initial page load and health check.
3. **In-memory session store** — `Map<string, Session>`. No database. Sessions are ephemeral — this is fine since the app is always-on hosted, and sessions only live as long as a combat encounter.
4. **No authentication** — 4-digit room code is the access gate. DM identity via a `dmToken` (UUID) stored in sessionStorage.
5. **DM-as-first-client** — DM's browser is a WebSocket client with elevated privileges. Same real-time events, plus mutation commands.
6. **DM recovery** — The `dmToken` is displayed as a recoverable "Admin Key" (click-to-copy, showing first 8 chars). If the DM loses their tab, they can re-enter the room code + Admin Key via a `RECOVER_SESSION` message to reclaim admin control. The `dmToken` is also persisted in `localStorage` as a fallback.

**File structure (at project root):**
```
my-project/
├── package.json              # Dependencies: svelte, express, ws; devDeps: typescript, vite, @sveltejs/vite-plugin-svelte, tsx, vitest, @playwright/test
├── tsconfig.json             # Path alias: @shared/* -> ./src/shared/*
├── vite.config.ts            # server.proxy: /ws, /api -> localhost:3000 (dev)
├── index.html                # At project root per Vite convention; references src/client/main.tsx
├── src/
│   ├── client/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Lobby.tsx
│   │   │   ├── PlayerList.tsx
│   │   │   ├── PlayerEntry.tsx
│   │   │   ├── DMToolbar.tsx
│   │   │   └── TurnIndicator.tsx
│   │   ├── hooks/
│   │   │   ├── useSession.ts
│   │   │   └── useTurnState.ts
│   │   ├── lib/
│   │   │   ├── wsClient.ts
│   │   │   └── types.ts
│   │   └── styles/
│   │       └── app.css
│   ├── server/
│   │   ├── index.ts
│   │   ├── wsHandler.ts
│   │   ├── sessionStore.ts
│   │   ├── roomCode.ts
│   │   └── types.ts
│   └── shared/
│       ├── messages.ts
│       └── constants.ts
├── public/
│   └── favicon.ico           # Static assets only (index.html goes at root)
└── tests/
    ├── vitest.config.ts
    └── e2e/
        └── playwright.config.ts
```

**Dev workflow:** Run `vite` (port 5173) and `tsx watch src/server/index.ts` (port 3000) in parallel. Vite proxies `/ws` and `/api/*` to the Express server. In production, `vite build` produces `dist/` served by Express on the same port.

---

## API / Interface Contract

The API is entirely WebSocket-based after initial connection. Client opens `ws://<host>:<port>/ws`.

**Message envelope:** `{ "type": "<type>", "payload": { ... } }`

### Client-to-Server Messages

| Type | Payload | Auth | Response |
|------|---------|------|----------|
| `CREATE_SESSION` | `{}` | None | `SESSION_CREATED` with `roomCode`, `dmToken`, empty `players` |
| `JOIN_SESSION` | `{ roomCode, characterName, initiative }` | None | `JOIN_ACCEPTED` with `playerId`, `playerToken`, `players` list |
| `RECONNECT_SESSION` | `{ roomCode, playerToken }` | playerToken | `SESSION_STATE_SYNC` with full state |
| `RECOVER_SESSION` | `{ roomCode, dmToken }` | dmToken | `SESSION_STATE_SYNC` with full state (reclaims DM) |
| `UPDATE_INITIATIVE` | `{ dmToken, playerId, initiative }` | dmToken | `INITIATIVE_UPDATED` broadcast with re-sorted list |
| `REORDER_PLAYERS` | `{ dmToken, orderedPlayerIds }` | dmToken | `PLAYERS_REORDERED` broadcast with list in new order |
| `REMOVE_PLAYER` | `{ dmToken, playerId }` | dmToken | `PLAYER_REMOVED` broadcast; `YOU_WERE_REMOVED` to removed client |
| `ADVANCE_TURN` | `{ dmToken }` | dmToken | `TURN_ADVANCED` with new index, round, current player |
| `PREVIOUS_TURN` | `{ dmToken }` | dmToken | `TURN_REGRESSED` (wraps backward, floor round at 1) |
| `RESET_SESSION` | `{ dmToken }` | dmToken | `SESSION_RESET` — clears players, resets turn |

### Server-to-Client Events

| Type | Payload | Trigger |
|------|---------|---------|
| `SESSION_STATE_SYNC` | Full `players`, `turnState` | Reconnect |
| `HEARTBEAT` | `{ timestamp }` | Every 30s |
| `ERROR` | `{ code, message }` | Any invalid operation |

### REST Endpoints (Minimal)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Serve SPA (`index.html`) |
| `GET` | `/health` | `{ "status": "ok", "activeSessions": N }` |
| `GET` | `/api/session/:roomCode/exists` | Pre-connect code validation |

**Error codes:** `SESSION_NOT_FOUND`, `SESSION_FULL`, `NAME_TAKEN`, `UNAUTHORIZED`, `PLAYER_NOT_FOUND`, `INVALID_INITIATIVE`, `ROOM_CODE_COLLISION`.

---

## Data Model Changes

### Session

```
Session {
  id: string               // UUID v4
  roomCode: string         // 4-digit numeric (charset: 23456789)
  dmToken: string          // UUID v4, secret held by DM's client
  dmPlayerId: string       // References DM's Player entry
  status: "WAITING" | "ACTIVE" | "COMPLETED"
  players: Player[]        // Sorted by initiative desc, then createdAt asc
  turnState: TurnState
  createdAt: number        // Unix ms
  lastActivityAt: number   // Unix ms
}
```

### Player

```
Player {
  id: string               // UUID v4
  sessionId: string        // FK to Session.id
  name: string             // 1-50 chars, trimmed
  initiative: number       // Integer [-10, 40]
  sortOrder: number        // Explicit position for DM reorder; 0 = highest. Default matches initiative sort. After REORDER_PLAYERS, list uses sortOrder. Subsequent UPDATE_INITIATIVE re-computes sortOrder from initiative desc + createdAt asc, replacing manual order.
  isDM: boolean
  clientId: string | null  // WS connection ID, null if disconnected
  playerToken: string      // UUID v4, stored in client sessionStorage, used for reconnect
  createdAt: number        // Unix ms
}
```

Uniqueness: `(sessionId, name)` — no duplicate character names. `(sessionId, isDM)` — at most one DM.

### TurnState

```
TurnState {
  currentIndex: number     // Index into sorted players array
  round: number            // Starts at 1, increments on wrap
}
```

Embedded within `Session`. Wraps forward (last -> first, round++) and backward (first -> last, round-- floor at 1).

**Storage:** In-memory `Map<string, Session>` with `sessionsByCode` and `sessionsById` indices. Zero persistence. Restart clears all state.

---

## Migration / Rollout Plan

**Greenfield — no migration needed.**

**Deployment targets (MVP):**
- **Local**: DM runs `npm install && npm start` on laptop. Players connect via `http://<laptop-ip>:3000`.
- **Hosted**: Fly.io (WebSocket-native) or Railway — single `fly deploy` / `railway up`.

**First deploy steps:**
1. `npm run build` produces static assets in `dist/`
2. Server serves `dist/` as static files
3. `fly launch` generates `fly.toml` + `Dockerfile`
4. `fly deploy` from `main`

**Rollback:** Trivial — no database. `git revert && redeploy` or `fly deploy <prev-release>`. Worst case: 5 min downtime.

**Backward compatibility:** Not applicable for v1. Future protocol changes should increment a handshake version field.

---

## Non-Requirements

| Item | Rationale |
|------|-----------|
| User accounts / auth | Joining by code is intentionally anonymous |
| Persistent game history | Session state is discarded after expiry |
| Native mobile app | PWA is sufficient for in-person play |
| Voice/video chat | Players are co-located at the table |
| Campaign management | Separate product concern |
| Dice rolling | Physical dice are part of the in-person experience |
| Character sheets / stat blocks | Only need name + initiative |
| Monster manual / NPC stats | DM enters names and counts manually |
| Public REST API | No third-party integration contracts |
| Webhooks / integrations | No Discord, Roll20, D&D Beyond until v2+ |
| Offline mode (PWA offline) | Requires fundamentally different (local-first) architecture |
| Formal WCAG accessibility | Screen-reader support for real-time game UI is a specialization |

---

## Acceptance Criteria

| ID | Criterion | Verification |
|----|-----------|-------------|
| AC-01 | Landing page shows code input + Join button + Create button | Load root URL; all controls visible |
| AC-02 | Creating a session generates 4-digit code displayed prominently | Code appears <2s; matches `^\d{4}$` |
| AC-03 | Player joins with valid code, name (1-50 chars), initiative (-10 to 40) | Success; player sees name in ordered list |
| AC-04 | Invalid code shows "Session not found" error | Test empty, wrong length, expired code |
| AC-05 | Duplicate name in same session shows error | Second "Gandalf" rejected |
| AC-06 | List sorted descending by initiative | A(15), B(20), C(10) -> B, A, C |
| AC-07 | Ties broken by join order | A joins at 15, B at 15 -> A above B |
| AC-08 | New player appears on all connected clients in real-time | 3 tabs; join on tab 2; tabs 1 & 3 update <2s |
| AC-09 | Current turn indicator on highest-initiative player | Visual highlight (background/arrow) |
| AC-10 | Session creator sees "Advance Turn" button | Only visible to DM |
| AC-11 | Advance Turn moves indicator to next in order | Verify after click |
| AC-12 | Wrapping past last resets to first, increments round | 3 players, advance 4 times -> "Round 2" |
| AC-13 | DM can reorder via drag-and-drop or up/down buttons | Order persists on all clients |
| AC-14 | DM can remove a character | Removed from all clients' lists |
| AC-15 | DM edits initiative; list re-sorts automatically | A: 15->5; list re-sorts on all clients |
| AC-16 | Empty name shows validation error | Client-side, no request sent |
| AC-17 | Non-numeric/out-of-range initiative shows error | Test "abc", -11, 41, "hello" |
| AC-18 | Joining full session shows "Session is full" | 21st player rejected |
| AC-19 | Expired session code shows "Session not found" | Rejoin after expiry |
| AC-20 | Disconnection shows "Connection lost. Reconnecting..." banner | Kill server or disconnect network |
| AC-21 | Inactive session (60 min, no clients) evicted from memory | Rejoin -> "Session not found" |
| AC-22 | Session with at least one connected WebSocket client NOT evicted (even if idle) | Keep tab open 65 min; state intact |
| AC-23 | Server restart clears all sessions | Restart; old code returns "Session not found" |
| AC-24 | `/health` reports session and connection counts | `{"sessions_active": N, "connections_active": M}` |

---

## Open Questions

| # | Question | Decision |
|---|----------|----------|
| OQ-01 | Frontend framework? | **Svelte 5** |
| OQ-02 | Backend runtime? | **Node.js + TypeScript** |
| OQ-03 | Real-time protocol? | **WebSocket via `ws`** — lightweight, zero extra deps |
| OQ-04 | Session storage? | **In-memory** — no database |
| OQ-05 | Code generation? | **4-digit numeric** with collision retry |
| OQ-06 | Session expiry? | **120 min** inactivity |
| OQ-07 | Max players? | **20** |
| OQ-08 | Testing framework? | **Vitest** (unit) + **Playwright** (E2E) |
| OQ-09 | Build tooling? | **Vite** |
| OQ-10 | PWA support? | **Yes, v1** — manifest.json + service worker |

---
