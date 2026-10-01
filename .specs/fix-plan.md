# Fix Plan: D&D Initiative Tracker

**Created:** 2026-10-01
**Baseline commit:** `a8c5c77`
**Method:** Read all the source. Ran `tsc`, `vitest`, and `npm run build`. Ran a Playwright probe against the built server (DM creates a session, a player joins, the DM adds an NPC, the DM reorders, the DM refreshes).

Confidence tags: **CONFIRMED** means it was reproduced or proven by reading the code. **LIKELY** means there is strong evidence but it was not run end to end.

---

## Breakdown

### P0: The app can't be used

| # | Finding | Where | Evidence |
|---|---------|-------|----------|
| 1 | **The production build fails.** `ErrorCode.UNKNOWN_ERROR` doesn't exist, so `tsc --noEmit` fails. That makes `npm run build` exit 2, which also fails the Docker build. The error came in with `a8c5c77`. The server works around the same gap with a cast (`"UNKNOWN_ERROR" as ErrorCode`). | `src/client/lib/wsClient.ts:84`, `src/server/wsHandler.ts:19` | CONFIRMED (build output) |
| 2 | **There is no working deploy target.** `fly.toml` was deleted in `a8c5c77`. What's left is `railway.json` plus a GitHub Action that uses `bervProject/railway-deploy@master`, while the commit history targets Fly.io. The spec assumes Railway has a free tier, which it no longer does (Fly.io's free allowances have also ended for new orgs). | `railway.json`, `.github/workflows/deploy.yml` | CONFIRMED (config). LIKELY (pricing, needs checking) |
| 3 | **Joining reloads the page.** `<form onsubmit={handleSubmit}>` never calls `preventDefault()`. The JOIN message goes out, then the browser navigates to `/?` and the player is back in the lobby. | `src/client/components/PlayerEntry.svelte:46` | CONFIRMED (probe: `P1 NAV /?`) |
| 4 | **Players never reach the session view, even without the reload.** The view switches on `state.sessionId`, but `JOIN_ACCEPTED` neither carries nor sets `sessionId` or `roomCode`. | `src/client/hooks/useSession.svelte.ts:36-41`, `src/client/App.svelte:38`, `src/shared/messages.ts` | CONFIRMED (code) |
| 5 | **Refresh and recovery do nothing.** `reconnectSession` and `recoverSession` put the tokens in the WS query string. The server ignores the request (`_req`), and the client never sends `RECONNECT_SESSION` or `RECOVER_SESSION`. When the DM refreshes, they land in the lobby and the session is orphaned. | `src/client/lib/wsClient.ts:33-36`, `src/server/wsHandler.ts:39` | CONFIRMED (probe step 5) |
| 6 | **An automatic reconnect leaves the client silently unbound.** After a drop (for example, a phone locking), the new socket has no `sessionId` on the server. Broadcasts stop arriving and DM actions return "Not in a session", while the UI still looks connected. | `wsClient.ts` `onopen`, `wsHandler.ts` `handleConnection` | CONFIRMED (code) |
| 7 | **Initiative is never sorted automatically**, which is the app's core feature. Only `updateInitiative` sorts, and nothing in the UI calls it. Joins and NPC adds just append to the end. | `src/server/sessionStore.ts:102,211` | CONFIRMED (probe: Goblin 20 listed below Aragorn 15) |
| 8 | **The DM's reorder always fails.** The client sends IDs with the DM filtered out, but the server requires every ID including the DM's, so it throws. The error code is also wrong (`INVALID_NAME`). | `PlayerList.svelte:19`, `sessionStore.ts:143-150` | CONFIRMED (probe: `INVALID_NAME` banner) |

### P1: Wrong behavior

| # | Finding | Where | Evidence |
|---|---------|-------|----------|
| 9 | `ADD_NPC` broadcasts `SESSION_STATE_SYNC` with `dmPlayerId` to everyone. Every player's client then sets `isDM = true` and shows the DM toolbar. | `wsHandler.ts` `handleAddNpc` | CONFIRMED (code) |
| 10 | A stale socket's `close` sets `player.clientId = null` even after the player has re-registered on a new socket. As a result, `YOU_WERE_REMOVED` isn't delivered, and the expiry sweep can evict a session that's still live. This only shows up once #5 and #6 are fixed. | `sessionStore.ts` `disconnectClient` | CONFIRMED (code) |
| 11 | A removed player keeps reconnecting. The server closes with code 1000, the client treats that as unintentional and retries 10 times, then shows "Could not connect". | `wsClient.ts` `onclose` | CONFIRMED (code) |
| 12 | Calling `connect()` twice (retrying a join after an error, or creating a session after a failed join) races. The old socket's `onclose` schedules a reconnect that replaces the live socket. | `wsClient.ts` `connect` / `onclose` | LIKELY |
| 13 | Turn tracking is inconsistent. The DM shows as the current turn before anyone joins. Three `sessionStore` unit tests fail because `a8c5c77` changed how the DM is skipped. `currentIndex` is a position in the list, so sorting or removing players changes whose turn it is. | `sessionStore.ts`, `tests/unit/server/sessionStore.test.ts` | CONFIRMED (3 failing tests, probe step 1) |
| 14 | Features in the spec are missing from the UI: the DM can't edit a player's initiative, there's no Admin Key entry for recovery, there's no `localStorage` fallback for `dmToken`, and there's no Leave button. | `App.svelte`, `Lobby.svelte` | CONFIRMED (code) |
| 15 | Reset doesn't match the spec. The spec says it clears players; the code only resets the turn. | `sessionStore.ts` `reset` | CONFIRMED (spec vs. code) |

### P2: Dev, tests, and polish

| # | Finding | Where | Evidence |
|---|---------|-------|----------|
| 16 | The Vite proxy for `/ws` is a plain string with no `ws: true`, so WebSockets don't reach the server under `npm run dev`. The Playwright e2e suite runs against the dev server, so it most likely can't pass. | `vite.config.ts` | LIKELY |
| 17 | `.svelte` files are never type-checked (`tsc` skips them and `svelte-check` isn't installed). No CI runs the tests either; the only workflow is the deploy. | `package.json`, `.github/workflows/` | CONFIRMED |
| 18 | `favicon.ico`, `icon-192.png` and `icon-512.png` are missing, and `index.html` doesn't link the manifest. | `public/`, `index.html` | CONFIRMED |
| 19 | `express.static("dist")` publicly serves the server bundle at `/server/index.cjs`. | `src/server/index.ts:17` | CONFIRMED |
| 20 | The Dockerfile runs esbuild twice, because the `build` script already does it. Harmless. | `Dockerfile:7` | CONFIRMED |
| 21 | Debug files are committed: `test_ws.cjs`, `test_ws2.cjs`, `test_ws.png`. | repo root | CONFIRMED |
| 22 | Constants have drifted. The NPC inputs use `max=30` and `maxlength=20`, against constants of 40 and 50. Error banners show raw codes (`INVALID_NAME`). | `DMToolbar.svelte` | CONFIRMED |
| 23 | All state is in memory, so any restart, deploy or idle auto-stop wipes every session. This constrains the choice of host. | design | CONFIRMED |

---

## Task Plan

Order: **Phase 0**, then **Phases 1 and 2 in parallel**, then **Phase 3**. Phase 4 can run anytime after Phase 0.

### Phase 0: Unblock build and deploy
- [ ] **T1. Make `npm run build` green** (#1, #17, #20, #21)
  - Add `UNKNOWN_ERROR` and `INVALID_REORDER` to `ErrorCode`, and remove the cast in `wsHandler.ts`.
  - Add `svelte-check` to `npm run check`. Remove the duplicate esbuild step from the Dockerfile. Delete the `test_ws*` files.
  - Add a CI workflow for PRs: `check`, `test`, `build`.
  - **Done when:** `npm run build` and `docker build .` exit 0, and CI runs on PRs.
- [ ] **T2. Restore a deploy target** (#2, #23). *Needs a decision on the host.*
  - **Done when:** pushing to `main` deploys, `/health` returns 200, and the host is set so it doesn't auto-stop an idle machine mid-session.

### Phase 1: Session lifecycle (client and protocol)
- [ ] **T3. Make joining work end to end** (#3, #4, #12)
  - Call `preventDefault()` in `PlayerEntry`.
  - Add `sessionId` and `roomCode` to `JOIN_ACCEPTED` and set them in `useSession`.
  - Make `wsClient.connect()` reuse the open socket, or detach the old socket's handlers before closing it.
  - **Done when:** a player who joins sees the session view, and the DM sees the player within 500 ms.
- [ ] **T4. Rebind sessions on every (re)connect** (#5, #6, #10, #11)
  - On every socket `open`, send `RECOVER_SESSION` or `RECONNECT_SESSION` if tokens are stored, and drop the query-string tokens.
  - `SESSION_STATE_SYNC` should carry and set `sessionId`, `roomCode` and `isDM`.
  - In `disconnectClient`, only clear `clientId` if it still matches the closing socket.
  - Treat close-for-removal and session-expired as terminal states, not retries.
  - Reconnect when the page becomes visible again (`visibilitychange`) on mobile.
  - **Done when:** a DM refresh restores admin view, a player refresh restores player view, a dropped socket resumes receiving broadcasts, and a removed player lands in the lobby with no retry loop.

### Phase 2: Initiative and turn logic (server)
- [ ] **T5. Sort automatically and track turns by player ID** (#7, #8, #13). *Needs a decision on the DM's place in the list.*
  - Recommended: take the DM out of `session.players` entirely (keep only `dmPlayerId`). That removes all the DM-skipping logic and the reorder length mismatch.
  - Sort by initiative (descending), breaking ties by join time, on join, NPC add and initiative update.
  - Track the current turn by player ID so sorts and removals keep the turn on the right player.
  - `reorderPlayers` should validate against the player IDs and return `INVALID_REORDER`.
  - Update the unit tests to match.
  - **Done when:** the list is always sorted unless the DM has manually reordered, reorder works, the turn stays on the same player across sorts and removals, and all unit tests pass.
- [ ] **T6. Fix the `ADD_NPC` broadcast** (#9)
  - Broadcast a normal list update with no `dmPlayerId`.
  - Never set `isDM` from a broadcast, only from `SESSION_CREATED` or a `RECOVER_SESSION` reply.
  - **Done when:** players never see the DM toolbar.

### Phase 3: Spec features that are missing
- [ ] **T7. Finish the DM and player controls** (#14, #15, #22). *Needs a decision on what Reset does.*
  - DM can edit a player's initiative inline (wire up the `updateInitiative` that already exists).
  - "Recover as DM" form in the lobby (room code and Admin Key), with a `localStorage` fallback.
  - Leave Session button.
  - Reset behavior as decided.
  - Use the shared constants in the NPC form, and show readable error messages.
  - **Done when:** the spec's acceptance criteria for editing, recovery and reset pass in e2e.

### Phase 4: Dev experience and polish
- [ ] **T8. Get `npm run dev` and the e2e suite working** (#16)
  - Set `"/ws": { target: "ws://localhost:3000", ws: true }`.
  - Run Playwright in CI.
  - **Done when:** `npm run test:e2e` passes locally and in CI.
- [ ] **T9. PWA assets and static-serving hardening** (#18, #19)
  - Add the icons and favicon, and link the manifest.
  - Serve only the client build directory (for example, `dist/client`), not `dist/`.
  - **Done when:** there are no 404s on page load and `/server/index.cjs` returns 404.

### Overlap notes
- T3 and T4 both touch `useSession.svelte.ts`, `wsClient.ts`, `wsHandler.ts` and `messages.ts`. Do them together or one after the other.
- T5 and T6 both touch `sessionStore.ts` and `wsHandler.ts`. T5 changes the player model, so land it before T7.

### Open decisions
1. **Host for T2:** Railway, Fly.io, Render, or something else. None of them has a true free tier any more, and the in-memory design needs a machine that stays on.
2. **DM in the player list for T5:** remove the DM from `players` (recommended), or keep the DM in the list as a non-turn entry.
3. **What Reset does for T7:** clear all players, as the spec says, or only reset round and turn, as the code does today. Possibly offer both: "New combat" and "Restart rounds".
