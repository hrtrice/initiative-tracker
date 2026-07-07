# Learnings: backend

## Codebase Patterns
- Server uses Node.js/Express with raw `ws` library for WebSocket (added: 2026-07-07)
- In-memory session store via `Map<string, Session>` — no database (added: 2026-07-07)
- 4-digit numeric room codes from charset `23456789` (added: 2026-07-07)
- Session expiry at 120 min inactivity, server sweep evicts stale sessions (added: 2026-07-07)
- DM identified via `dmToken`, players via `playerToken` (both UUIDs) (added: 2026-07-07)

## Gotchas
- (none yet)

## Preferences
- (none yet)

## Cross-Agent Notes
- (from architect) Shared contracts at `src/shared/` define 10 client-to-server + 12 server-to-client message types as discriminated unions (added: 2026-07-07)
