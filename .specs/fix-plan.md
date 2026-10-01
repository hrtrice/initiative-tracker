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
- [x] **T1. Make `npm run build` green** (#1, #17, #20, #21)
  - Add `UNKNOWN_ERROR` to `ErrorCode`, and remove the cast in `wsHandler.ts`. `INVALID_REORDER` moves to T5, where it's first used.
  - Add `svelte-check` to `npm run check`. Remove the duplicate esbuild step from the Dockerfile. Delete the `test_ws*` files.
  - Add a CI workflow for PRs: `check`, `test`, `build`.
  - The 3 failing turn tests were written before the DM skipped its turn. They've been rewritten to check *who* holds the turn, including looping from the last player back to the top.
  - **Done when:** `npm run build` and `docker build .` exit 0, and CI runs on PRs.
- [x] **T2. Restore a deploy target** (#2, #23). Railway (paid account). `ci.yml` deploys with `railway up` after CI passes on `master`. The one-time setup is in the README.
  - **Done when:** pushing to `master` deploys, `/health` returns 200, and the host is set so it doesn't auto-stop an idle machine mid-session.

### Phase 1: Session lifecycle (client and protocol)
- [x] **T3. Make joining work end to end** (#3, #4, #12)
  - Call `preventDefault()` in `PlayerEntry`.
  - Add `sessionId` and `roomCode` to `JOIN_ACCEPTED` and set them in `useSession`.
  - Make `wsClient.connect()` reuse the open socket, or detach the old socket's handlers before closing it.
  - **Done when:** a player who joins sees the session view, and the DM sees the player within 500 ms.
- [x] **T4. Rebind sessions on every (re)connect** (#5, #6, #10, #11)
  - On every socket `open`, send `RECOVER_SESSION` or `RECONNECT_SESSION` if tokens are stored, and drop the query-string tokens.
  - `SESSION_STATE_SYNC` should carry and set `sessionId`, `roomCode` and `isDM`.
  - In `disconnectClient`, only clear `clientId` if it still matches the closing socket.
  - Treat close-for-removal and session-expired as terminal states, not retries.
  - Reconnect when the page becomes visible again (`visibilitychange`) on mobile.
  - **Done when:** a DM refresh restores admin view, a player refresh restores player view, a dropped socket resumes receiving broadcasts, and a removed player lands in the lobby with no retry loop.

### Phase 2: Initiative and turn logic (server)
- [x] **T5. Sort automatically and track turns by player ID** (#7, #8, #13)
  - **Decided:** take the DM out of `session.players` entirely (keep only `dmPlayerId`). That removes all the DM-skipping logic and the reorder length mismatch. NPCs stay in the list and take turns like players, and the DM controls them: the DM view marks NPC rows, and when an NPC's turn comes up the DM's view makes clear it's theirs to run.
  - **Decided:** Next after the last entry loops back to the top of the initiative order and increments the round.
  - Sort by initiative (descending), breaking ties by join time, on join, NPC add and initiative update.
  - Track the current turn by player ID so sorts and removals keep the turn on the right player.
  - `reorderPlayers` should validate against the player IDs and return `INVALID_REORDER`.
  - Update the unit tests to match.
  - **Done when:** the list is always sorted unless the DM has manually reordered, reorder works, the turn stays on the same player across sorts and removals, Next loops from the last entry to the top, and all unit tests pass.
- [x] **T6. Fix the `ADD_NPC` broadcast** (#9)
  - Broadcast a normal list update with no `dmPlayerId`.
  - Never set `isDM` from a broadcast, only from `SESSION_CREATED` or a `RECOVER_SESSION` reply.
  - **Done when:** players never see the DM toolbar.

**Phases 1-2 notes:**
- Broadcasts now carry only `{id, name, initiative, isNpc}`. Before this, every client received every player's token, *including the DM's token*, because the DM was a player entry.
- Before combat starts (`WAITING`), the turn always follows the top of the order. The first **Next** starts combat.
- When the current player is removed, the turn passes to the next entry. If they were last, it wraps to the top and the round goes up.
- New joins are inserted by initiative, so a manual DM reorder of everyone else is kept.
- Verified with a 28-check browser run against the production build: join, NPC sorting, turn loop, reorder, DM and player refresh, a socket cut through a TCP proxy, removal, server restart, and retrying a failed join.
- The Playwright specs in `tests/e2e/` still target the old behavior and aren't in CI. T8 rewrites them.

### Phase 3: Spec features that are missing
- [x] **T7. Finish the DM and player controls** (#14, #15, #22)
  - The DM taps any initiative to edit it inline. Enter or tapping away saves, Escape cancels, and the entry moves into place for everyone.
  - **New combat** (was Reset, now asks for confirmation): NPCs from the last fight are removed, players stay with their initiative cleared ("—"), and the turn goes back to round 1 at the top. Each player gets a "Roll initiative" prompt and submits their own roll (`SUBMIT_INITIATIVE`). This only works while their roll is pending; after that, only the DM can change it. Players still pending sort at the bottom, below any new NPCs.
  - **Rejoin as DM** in the lobby (room code and Admin Key). The toolbar now says what the Admin Key is for. Wrong keys show the server's reason ("That Admin Key doesn't match this session").
  - Credentials are written to both `sessionStorage` (this tab) and `localStorage` (the fallback), so reopening a closed tab restores the DM or player.
  - **Leave session:** a player leaving is removed and their name is freed to rejoin. The DM leaving only detaches that device; the session keeps running and can be recovered with the Admin Key.
  - Initiative validation no longer treats a blank or `null` value as 0.
  - The room code and Admin Key are now buttons, and `PlayerEntry`'s unused "edit existing player" mode is gone, so `svelte-check` reports 0 warnings.
  - Verified with 89 unit tests and a 22-check browser run (plus a rerun of the 28-check Phase 1–2 browser run).

### Phase 4: Dev experience and polish
- [x] **T8. Get `npm run dev` and the e2e suite working** (#16)
  - The Vite proxy for `/ws` now sets `ws: true`. Checked with `npm run dev`: a DM and a player complete a session through `localhost:5173/ws`.
  - `npm run test:e2e` was broken in a second way: it never passed the config's path. It now builds first, then runs `playwright test --config tests/e2e/playwright.config.ts`.
  - The old specs relied on `data-testid`s that didn't exist and on the old behavior, and ran DM and player in one shared browser context. They've been replaced by 14 tests covering every flow:
    - joining
    - sorting and turns
    - reorder and inline edit
    - removal
    - refresh and reopening a tab
    - a dropped socket, cut through a TCP proxy
    - new combat
    - Admin Key recovery
    - leaving
    - the app shell
  - Tests run against the production build on a Pixel 7 profile, with one browser context per person. Retries are off, and the suite passed 42/42 over three repeats.
  - CI installs Chromium and runs the suite after the build, and uploads traces when it fails.
- [x] **T9. PWA assets and static-serving hardening** (#18, #19)
  - Vite now builds to `dist/client` and Express serves only that folder, so `/server/index.cjs` returns 404 (covered by a test).
  - A new d20 icon (`public/icon.svg`) is rendered to 192/512 manifest icons, an apple-touch-icon and a 32px favicon. `index.html` links the manifest, the icons and `theme-color`. A test checks that a page load has no failed requests and every manifest icon returns 200.
  - The service worker now only handles same-origin GETs. When offline, a navigation falls back to the cached app shell instead of answering with `undefined`.

### Overlap notes
- T3 and T4 both touch `useSession.svelte.ts`, `wsClient.ts`, `wsHandler.ts` and `messages.ts`. Do them together or one after the other.
- T5 and T6 both touch `sessionStore.ts` and `wsHandler.ts`. T5 changes the player model, so land it before T7.

### Decisions (2026-10-01)
1. **Host:** Railway, on a paid account.
2. **DM:** not in the player list. The DM runs the NPCs' turns.
3. **Reset:** starts a new combat. Players stay and re-enter their initiative; the last fight's NPCs are removed. **Next** after the last entry loops back to the top.

### Open questions
- None right now.
