import crypto from "crypto";
import type { Session, Player } from "../shared/types";
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

export class SessionStore {
  private sessions: Map<string, Session>;
  private sessionsByCode: Map<string, Session>;
  private clientToSession: Map<string, string>;
  private clientToPlayer: Map<string, string>;

  constructor() {
    this.sessions = new Map();
    this.sessionsByCode = new Map();
    this.clientToSession = new Map();
    this.clientToPlayer = new Map();
  }

  create(dmToken: string, dmPlayerId: string): Session {
    const id = crypto.randomUUID();
    const code = generateUniqueRoomCode(
      new Set(this.sessionsByCode.keys())
    );
    const now = Date.now();
    const session: Session = {
      id,
      roomCode: code,
      dmToken,
      dmPlayerId,
      status: "WAITING",
      players: [],
      turnState: { currentIndex: 0, round: 1 },
      createdAt: now,
      lastActivityAt: now,
    };
    const dmPlayer: Player = {
      id: dmPlayerId,
      sessionId: id,
      name: "Dungeon Master",
      initiative: 0,
      sortOrder: 0,
      isDM: true,
      clientId: null,
      playerToken: dmToken,
      createdAt: now,
    };
    session.players.push(dmPlayer);
    this.sessions.set(id, session);
    this.sessionsByCode.set(code, session);
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
      throw new Error(ErrorCode.SESSION_FULL);
    }
    const nameLower = player.name.trim().toLowerCase();
    if (
      nameLower.length < MIN_NAME_LENGTH ||
      nameLower.length > MAX_NAME_LENGTH
    ) {
      throw new Error(ErrorCode.INVALID_NAME);
    }
    if (session.players.some((p) => p.name.toLowerCase() === nameLower)) {
      throw new Error(ErrorCode.NAME_TAKEN);
    }
    player.sortOrder = session.players.length;
    session.players.push(player);
    session.lastActivityAt = Date.now();
  }

  removePlayer(session: Session, playerId: string): void {
    const idx = session.players.findIndex((p) => p.id === playerId);
    if (idx === -1) return;
    const removed = session.players[idx]!;
    if (removed.clientId) {
      this.clientToSession.delete(removed.clientId);
      this.clientToPlayer.delete(removed.clientId);
    }
    session.players.splice(idx, 1);
    session.players.forEach((p, i) => {
      p.sortOrder = i;
    });
    session.lastActivityAt = Date.now();
  }

  updateInitiative(session: Session, playerId: string, initiative: number): void {
    if (initiative < MIN_INITIATIVE || initiative > MAX_INITIATIVE) {
      throw new Error(ErrorCode.INVALID_INITIATIVE);
    }
    const player = session.players.find((p) => p.id === playerId);
    if (!player) {
      throw new Error(ErrorCode.PLAYER_NOT_FOUND);
    }
    player.initiative = initiative;
    session.players.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      return a.createdAt - b.createdAt;
    });
    session.players.forEach((p, i) => {
      p.sortOrder = i;
    });
    session.lastActivityAt = Date.now();
  }

  reorderPlayers(session: Session, orderedPlayerIds: string[]): void {
    const idSet = new Set(orderedPlayerIds);
    if (idSet.size !== orderedPlayerIds.length) {
      throw new Error(ErrorCode.INVALID_NAME);
    }
    if (orderedPlayerIds.length !== session.players.length) {
      throw new Error(ErrorCode.INVALID_NAME);
    }
    const playerMap = new Map(session.players.map((p) => [p.id, p]));
    const reordered: Player[] = [];
    for (const id of orderedPlayerIds) {
      const player = playerMap.get(id);
      if (!player) {
        throw new Error(ErrorCode.PLAYER_NOT_FOUND);
      }
      reordered.push(player);
    }
    reordered.forEach((p, i) => {
      p.sortOrder = i;
    });
    session.players = reordered;
    session.lastActivityAt = Date.now();
  }

  advanceTurn(session: Session): void {
    if (session.players.length === 0) return;
    session.turnState.currentIndex++;
    if (session.turnState.currentIndex >= session.players.length) {
      session.turnState.currentIndex = 0;
      session.turnState.round++;
    }
    session.lastActivityAt = Date.now();
  }

  previousTurn(session: Session): void {
    if (session.players.length === 0) return;
    session.turnState.currentIndex--;
    if (session.turnState.currentIndex < 0) {
      session.turnState.currentIndex = session.players.length - 1;
      session.turnState.round = Math.max(1, session.turnState.round - 1);
    }
    session.lastActivityAt = Date.now();
  }

  reset(session: Session): void {
    session.turnState = { currentIndex: 0, round: 1 };
    session.status = "WAITING";
    session.lastActivityAt = Date.now();
  }

  registerClient(clientId: string, sessionId: string, playerId: string): void {
    this.clientToSession.set(clientId, sessionId);
    this.clientToPlayer.set(clientId, playerId);
    const session = this.sessions.get(sessionId);
    if (session) {
      const player = session.players.find((p) => p.id === playerId);
      if (player) {
        player.clientId = clientId;
      }
    }
  }

  disconnectClient(clientId: string): void {
    const sessionId = this.clientToSession.get(clientId);
    const playerId = this.clientToPlayer.get(clientId);
    if (sessionId && playerId) {
      const session = this.sessions.get(sessionId);
      if (session) {
        const player = session.players.find((p) => p.id === playerId);
        if (player) {
          player.clientId = null;
        }
      }
    }
    this.clientToSession.delete(clientId);
    this.clientToPlayer.delete(clientId);
  }

  findExpiredSessions(): Session[] {
    const now = Date.now();
    const expired: Session[] = [];
    for (const session of this.sessions.values()) {
      const hasConnected = session.players.some((p) => p.clientId !== null);
      if (hasConnected) continue;
      if (now - session.lastActivityAt > SESSION_EXPIRY_MS) {
        expired.push(session);
      }
    }
    return expired;
  }

  evictSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    for (const player of session.players) {
      if (player.clientId) {
        this.clientToSession.delete(player.clientId);
        this.clientToPlayer.delete(player.clientId);
      }
    }
    this.sessionsByCode.delete(session.roomCode);
    this.sessions.delete(sessionId);
  }

  findConnectedSessions(): Session[] {
    return Array.from(this.sessions.values()).filter((s) =>
      s.players.some((p) => p.clientId !== null)
    );
  }

  getActiveCount(): number {
    return this.sessions.size;
  }

  getConnectionCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      for (const player of session.players) {
        if (player.clientId !== null) count++;
      }
    }
    return count;
  }
}
