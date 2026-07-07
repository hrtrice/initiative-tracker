# Team Decisions

## Architecture
- REST over WebSocket for all game state (no REST endpoints for state) (decided: 2026-07-07, by: architect)
- In-memory state only — no database, restart clears all state (decided: 2026-07-07, by: architect)
- Svelte 5 with runes for frontend (decided: 2026-07-07, by: frontend)
- Node.js/Express + raw `ws` for backend (decided: 2026-07-07, by: backend)

## Conventions
- All timestamps stored as Unix epoch milliseconds (decided: 2026-07-07, by: backend)
- 4-digit numeric room codes from charset `23456789` (decided: 2026-07-07, by: backend)
- 120 min inactivity session expiry (decided: 2026-07-07, by: architect)
- Max 20 players per session (decided: 2026-07-07, by: architect)
- PWA included in v1 (manifest.json + service worker) (decided: 2026-07-07, by: frontend)
