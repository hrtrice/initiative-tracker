import crypto from "crypto";
import type { Session, Player, PlayerView, TurnState } from "../shared/types";
import {
  MAX_PLAYERS,
  SESSION_EXPIRY_MS,
  MIN_INITIATIVE,
  MAX_INITIATIVE,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  ErrorCode,
} from "../shared/constants";
import { generateUniqueRoomCode } from "./roomCode";
import { ServerError } from "./errors";

/** Which session a connection belongs to, and as whom (null playerId = the DM). */
interface ClientBinding {
  sessionId: string;
  playerId: string | null;
}

export function toPlayerView(p: Player): PlayerView {
  return { id: p.id, name: p.name, initiative: p.initiative, isNpc: p.isNpc };
}

export function snapshot(session: Session): { players: PlayerView[]; turnState: TurnState } {
  return { players: session.players.map(toPlayerView), turnState: { ...session.turnState } };
}

export function validateName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    throw new ServerError(
      ErrorCode.INVALID_NAME,
      `Name must be ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters`
    );
  }
  return name;
}

export function validateInitiative(raw: unknown): number {
  const init = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(init) || init < MIN_INITIATIVE || init > MAX_INITIATIVE) {
    throw new ServerError(
      ErrorCode.INVALID_INITIATIVE,
      `Initiative must be a whole number from ${MIN_INITIATIVE} to ${MAX_INITIATIVE}`
    );
  }
  return init;
}

/**
 * Insert below every entry with equal or higher initiative, so ties keep join order
 * and the DM's manual reorders of other entries are left alone.
 */
function insertByInitiative(players: Player[], player: Player): void {
  const idx = players.findIndex((p) => p.initiative < player.initiative);
  if (idx === -1) players.push(player);
  else players.splice(idx, 0, player);
}

export class SessionStore {
  private sessions = new Map<string, Session>();
  private sessionsByCode = new Map<string, Session>();
  private bindings = new Map<string, ClientBinding>();

  create(dmToken: string): Session {
    const now = Date.now();
    const session: Session = {
      id: crypto.randomUUID(),
      roomCode: generateUniqueRoomCode(new Set(this.sessionsByCode.keys())),
      dmToken,
      dmClientId: null,
      status: "WAITING",
      players: [],
      turnState: { currentPlayerId: null, round: 1 },
      createdAt: now,
      lastActivityAt: now,
    };
    this.sessions.set(session.id, session);
    this.sessionsByCode.set(session.roomCode, session);
    return session;
  }

  findByCode(roomCode: string): Session | undefined {
    return this.sessionsByCode.get(roomCode);
  }

  findById(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  addPlayer(session: Session, player: Player): void {
    if (session.players.length >= MAX_PLAYERS) {
      throw new ServerError(ErrorCode.SESSION_FULL, `This session is full (${MAX_PLAYERS} max)`);
    }
    player.name = validateName(player.name);
    player.initiative = validateInitiative(player.initiative);
    const nameLower = player.name.toLowerCase();
    if (session.players.some((p) => p.name.toLowerCase() === nameLower)) {
      throw new ServerError(ErrorCode.NAME_TAKEN, `"${player.name}" is already in this session`);
    }
    insertByInitiative(session.players, player);
    this.touch(session);
  }

  addNpc(session: Session, name: string, initiative: number): Player {
    const npc: Player = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      name,
      initiative,
      isNpc: true,
      clientId: null,
      playerToken: null,
      createdAt: Date.now(),
    };
    this.addPlayer(session, npc);
    return npc;
  }

  /** Removes a player. If it was their turn, the turn passes to whoever was next. */
  removePlayer(session: Session, playerId: string): Player {
    const idx = session.players.findIndex((p) => p.id === playerId);
    if (idx === -1) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "That player is no longer in the session");
    }
    const [removed] = session.players.splice(idx, 1);
    if (removed!.clientId) this.bindings.delete(removed!.clientId);

    const ts = session.turnState;
    if (ts.currentPlayerId === playerId && session.status === "ACTIVE") {
      if (session.players.length === 0) {
        ts.currentPlayerId = null;
      } else if (idx < session.players.length) {
        ts.currentPlayerId = session.players[idx]!.id;
      } else {
        ts.currentPlayerId = session.players[0]!.id;
        ts.round++;
      }
    }
    this.touch(session);
    return removed!;
  }

  updateInitiative(session: Session, playerId: string, initiative: number): void {
    const value = validateInitiative(initiative);
    const idx = session.players.findIndex((p) => p.id === playerId);
    if (idx === -1) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "That player is no longer in the session");
    }
    const [player] = session.players.splice(idx, 1);
    player!.initiative = value;
    insertByInitiative(session.players, player!);
    this.touch(session);
  }

  reorderPlayers(session: Session, orderedPlayerIds: unknown): void {
    const byId = new Map(session.players.map((p) => [p.id, p]));
    const ids = Array.isArray(orderedPlayerIds) ? orderedPlayerIds : [];
    const reordered = ids.map((id) => byId.get(id)).filter((p): p is Player => !!p);
    if (reordered.length !== session.players.length || new Set(ids).size !== ids.length) {
      throw new ServerError(
        ErrorCode.INVALID_REORDER,
        "The list changed while you were reordering. Please try again."
      );
    }
    session.players = reordered;
    this.touch(session);
  }

  /** Next turn. After the last entry, loops back to the top and starts a new round. */
  advanceTurn(session: Session): void {
    const { players, turnState: ts } = session;
    if (players.length === 0) return;
    session.status = "ACTIVE";
    const idx = players.findIndex((p) => p.id === ts.currentPlayerId);
    if (idx === -1) {
      ts.currentPlayerId = players[0]!.id;
    } else if (idx === players.length - 1) {
      ts.currentPlayerId = players[0]!.id;
      ts.round++;
    } else {
      ts.currentPlayerId = players[idx + 1]!.id;
    }
    this.touch(session);
  }

  /** Previous turn. Before the top, wraps to the last entry of the previous round (round never below 1). */
  previousTurn(session: Session): void {
    const { players, turnState: ts } = session;
    if (players.length === 0) return;
    session.status = "ACTIVE";
    const idx = players.findIndex((p) => p.id === ts.currentPlayerId);
    if (idx <= 0) {
      ts.currentPlayerId = players[players.length - 1]!.id;
      ts.round = Math.max(1, ts.round - 1);
    } else {
      ts.currentPlayerId = players[idx - 1]!.id;
    }
    this.touch(session);
  }

  /** New combat: round 1, turn back at the top of the order. */
  reset(session: Session): void {
    session.status = "WAITING";
    session.turnState = { currentPlayerId: null, round: 1 };
    this.touch(session);
  }

  /** Binds a connection to a session as a player, or as the DM when playerId is null. */
  bindClient(clientId: string, session: Session, playerId: string | null): void {
    this.unbindClient(clientId);
    if (playerId === null) {
      session.dmClientId = clientId;
    } else {
      const player = session.players.find((p) => p.id === playerId);
      if (!player) return;
      player.clientId = clientId;
    }
    this.bindings.set(clientId, { sessionId: session.id, playerId });
  }

  /**
   * Forgets a connection. Only clears the session's pointer if it still points at this
   * connection, so a stale socket closing can't detach someone who already reconnected.
   */
  unbindClient(clientId: string): void {
    const binding = this.bindings.get(clientId);
    if (!binding) return;
    this.bindings.delete(clientId);
    const session = this.sessions.get(binding.sessionId);
    if (!session) return;
    if (binding.playerId === null) {
      if (session.dmClientId === clientId) session.dmClientId = null;
    } else {
      const player = session.players.find((p) => p.id === binding.playerId);
      if (player && player.clientId === clientId) player.clientId = null;
    }
  }

  getBinding(clientId: string): ClientBinding | undefined {
    return this.bindings.get(clientId);
  }

  findExpiredSessions(): Session[] {
    const now = Date.now();
    return Array.from(this.sessions.values()).filter(
      (s) =>
        s.dmClientId === null &&
        s.players.every((p) => p.clientId === null) &&
        now - s.lastActivityAt > SESSION_EXPIRY_MS
    );
  }

  evictSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    for (const [clientId, binding] of this.bindings) {
      if (binding.sessionId === sessionId) this.bindings.delete(clientId);
    }
    this.sessionsByCode.delete(session.roomCode);
    this.sessions.delete(sessionId);
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  /** Whose turn it is is derived, not stored, while combat hasn't started: always the top. */
  private touch(session: Session): void {
    if (session.status === "WAITING") {
      session.turnState.currentPlayerId = session.players[0]?.id ?? null;
    } else if (session.turnState.currentPlayerId === null && session.players.length > 0) {
      session.turnState.currentPlayerId = session.players[0]!.id;
    }
    session.lastActivityAt = Date.now();
  }
}
