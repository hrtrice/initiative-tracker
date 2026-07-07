# Learnings: frontend

## Codebase Patterns
- Frontend uses Svelte 5 with runes ($state, $derived, $effect) (added: 2026-07-07)
- WebSocket client at `src/client/lib/wsClient.ts` with reconnect + exponential backoff (added: 2026-07-07)
- Vite dev server proxies `/ws` and `/api/*` to `localhost:3000` (added: 2026-07-07)
- Mobile-first responsive dark theme with large touch targets (added: 2026-07-07)
- PWA in v1: manifest.json + service worker for asset caching (added: 2026-07-07)
- View routing: lobby (join/create) vs session (active game) with sessionStorage persistence (added: 2026-07-07)

## Gotchas
- (none yet)

## Preferences
- (none yet)

## Cross-Agent Notes
- (from architect) Message protocol uses discriminated unions — `wsClient.ts` must type the `data` handler via ServerMessage union (added: 2026-07-07)
