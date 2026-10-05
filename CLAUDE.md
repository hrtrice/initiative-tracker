# Initiative Tracker: notes for Claude

A real-time D&D initiative tracker, live at https://easyinitiative.up.railway.app. A DM opens
a table, players join from their phones, and everyone sees the order of battle update live.
The owner is a solo builder: there are no other reviewers, so CI is the safety net.

`README.md` covers setup and the Railway one-time configuration. This file is the context a
new session needs: what the product decisions are, how the code is laid out, and the
conventions to keep. `AGENTS.md` is a generic agent-workflow template, and `TODO.md` and
`.specs/` are the original build plan; none of them describe the app as it is now.

## Stack and layout

- **Client:** Svelte 5 (runes) SPA built by Vite into `dist/client/`. Entry `src/client/main.ts`,
  root `App.svelte`, components in `src/client/components/`, logic in `src/client/lib/`.
  All session state and server commands live in `src/client/hooks/useSession.svelte.ts`.
- **Server:** Express + `ws`, bundled by esbuild into `dist/server/index.cjs` (Node 22).
  `sessionStore.ts` owns all state and rules, `wsHandler.ts` authorises and routes messages,
  `health.ts` holds the pure HP rules, and `index.ts` serves the app and sets cache headers.
- **Shared:** `src/shared/` holds the message protocol (`messages.ts`), types and constants,
  imported as `@shared/...`. Every client↔server message is typed there.
- **State is in memory only.** One Railway replica, never sleeping. A deploy or restart ends
  every table, and tables with nobody connected expire after 2 hours.

## Commands

```sh
npm run check     # tsc + svelte-check: must be 0 errors AND 0 warnings
npm test          # Vitest unit tests (tests/unit/)
npm run build     # client + server bundle; e2e runs against this build
npx playwright test --config tests/e2e/playwright.config.ts   # e2e (Pixel 7 profile)
```

- Run the e2e tests after `npm run build`; they start `dist/server/index.cjs` on port 4173.
- In a cloud session, use the preinstalled Chromium:
  `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test --config tests/e2e/playwright.config.ts`.
  Don't run `playwright install`.
- `tsconfig.json` only covers `src/`, so test files aren't type-checked. Keep their fixtures
  (for example `makePlayer` in `sessionStore.test.ts`) in step with the types by hand.
- A stale `node dist/server/index.cjs` left running by an aborted screenshot script holds
  its port. Find it with `ps aux | grep '[i]ndex.cjs'`. Don't use `pkill -f`, which matches
  its own shell.

## Shipping

- The default branch is **`master`** (not main). PRs to `master` run CI: check, unit tests,
  build, e2e, a Docker build, and a `railway config plan` preview.
- A merge to `master` runs CI again and then deploys: `railway config apply`, then `railway up`.
  Railway service settings live in `.railway/railway.ts`; don't change them in the dashboard.
- Phones pick up a new deploy on their own: the client compares its build id with
  `/version.json` whenever it reconnects or the tab becomes visible, and reloads once.
  If a phone still shows an old version, closing and reopening the app fixes it.
- The owner merges via chat ("merge it once CI passes"). Merge with a merge commit.

## Product decisions (keep these unless the owner changes them)

- **Roles.** The DM is not in the player list; the DM runs NPC ("foe") turns. Players join
  with a 4-digit table number. The DM can return from another device with the Master Key.
- **Turns.** End Turn after the last entry loops to the top and starts a new round. Rounds
  show as Roman numerals ("Round III"); screen readers get the plain number.
- **New Encounter** keeps players (they re-roll initiative) and removes foes. Custom fields
  and player HP carry over.
- **Custom fields** (AC, Passive Perception, ...) are added by the DM per table. Players edit
  their own values. NPC values are only ever sent to the DM.
- **Health** is optional everywhere: joining and summoning never ask for it.
  - Player characters' HP is shown to everyone.
  - Each NPC has a "Players see" setting: Nothing, Bar only, Number only, or Bar and number.
    New foes take the table default, which starts as "Bar only".
  - The DM can switch health off for players, their own included. The DM always sees it.
  - 5e rules: temp HP absorb damage first and don't stack; HP stops at 0 and at max.
  - Bloodied means half HP or less; Down means 0. Downed foes are struck through; downed
    heroes only dim.
- **d20 roller:** a bonus that the device remembers, a fair `crypto` roll, then "Claim N".
  Typing a number by hand always works too.
- **QR invite:** `/?table=6326` pre-fills the join form. If the device is already at another
  table, it asks before leaving it.

## Conventions

- **Privacy is enforced on the server.** `snapshot(session, viewerIsDM)` builds each viewer's
  own copy of the state. Anything secret (NPC fields, hidden health) must be left out of the
  data a player receives, not just hidden in the UI. Bar-only health sends only a fill level
  rounded to 5% steps.
- **Changes are actions, not totals.** For example, health sends `damage 6` rather than
  `current = 7`, so a player and the DM acting at the same moment can't overwrite each other.
- **Theme tokens.** Every colour and surface is a CSS custom property in `:root` in
  `src/client/app.css`. Components hard-code no colours. The live theme is Torchlit Dungeon
  (Cinzel + Alegreya via `@fontsource`). `design/themes/` holds matching token sets for the
  saved Tome and Tavern themes; add new tokens there too.
- **Contrast.** Text must pass WCAG AA (4.5:1). Check new colours on both the row background
  and the current-turn row.
- **In-world wording.** Say Table (not room or session), Master Key (not Admin Key),
  foe or NPC, End Turn / Turn Back, New Encounter, Leave the Table. The custom fields panel
  keeps plain settings wording.
- **Phones first.** E2E tests run as a Pixel 7. Check screenshots at that size before shipping
  UI changes.
- **Tests come with every change:** unit tests for rules, handler tests for permissions and
  for what each connection receives, and e2e tests for user flows. Flaky tests get fixed, not
  retried.
