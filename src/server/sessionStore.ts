import crypto from "crypto";
import type {
  CustomField,
  CustomFieldType,
  FieldValue,
  Player,
  PlayerView,
  Session,
  TurnState,
} from "../shared/types";
import {
  MAX_PLAYERS,
  SESSION_EXPIRY_MS,
  MIN_INITIATIVE,
  MAX_INITIATIVE,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
  MAX_CUSTOM_FIELDS,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_TEXT_LENGTH,
  MIN_FIELD_NUMBER,
  MAX_FIELD_NUMBER,
  ErrorCode,
} from "../shared/constants";
import { generateUniqueRoomCode } from "./roomCode";
import { ServerError } from "./errors";

/** Which session a connection belongs to, and as whom (null playerId = the DM). */
interface ClientBinding {
  sessionId: string;
  playerId: string | null;
}

/** NPC custom field values (AC etc.) are only ever sent to the DM. */
export function toPlayerView(p: Player, viewerIsDM: boolean): PlayerView {
  return {
    id: p.id,
    name: p.name,
    initiative: p.initiative,
    isNpc: p.isNpc,
    fields: p.isNpc && !viewerIsDM ? {} : { ...p.fields },
  };
}

export interface SessionSnapshot {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

/** What one viewer may see of the session. Broadcasts build this per recipient. */
export function snapshot(session: Session, viewerIsDM: boolean): SessionSnapshot {
  return {
    players: session.players.map((p) => toPlayerView(p, viewerIsDM)),
    turnState: { ...session.turnState },
    customFields: session.customFields.map((f) => ({ ...f })),
  };
}

function validateFieldName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name.length < 1 || name.length > MAX_FIELD_NAME_LENGTH) {
    throw new ServerError(
      ErrorCode.INVALID_FIELD,
      `Field names must be 1-${MAX_FIELD_NAME_LENGTH} characters`
    );
  }
  return name;
}

function validateFieldType(raw: unknown): CustomFieldType {
  if (raw !== "number" && raw !== "text") {
    throw new ServerError(ErrorCode.INVALID_FIELD, "Field type must be Number or Text");
  }
  return raw;
}

/**
 * Normalizes a value for a field, or returns null for "no value" (null, blank).
 * Numbers must be whole numbers in range; text is trimmed and length-capped.
 */
export function validateFieldValue(field: CustomField, raw: unknown): FieldValue | null {
  if (raw === null || raw === undefined || (typeof raw === "string" && raw.trim() === "")) {
    return null;
  }
  if (field.type === "number") {
    const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.trim()) : NaN;
    if (!Number.isInteger(n) || n < MIN_FIELD_NUMBER || n > MAX_FIELD_NUMBER) {
      throw new ServerError(
        ErrorCode.INVALID_FIELD,
        `${field.name} must be a whole number from ${MIN_FIELD_NUMBER} to ${MAX_FIELD_NUMBER}`
      );
    }
    return n;
  }
  const text = (typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "").trim();
  if (!text || text.length > MAX_FIELD_TEXT_LENGTH) {
    throw new ServerError(
      ErrorCode.INVALID_FIELD,
      `${field.name} must be 1-${MAX_FIELD_TEXT_LENGTH} characters`
    );
  }
  return text;
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
  // Blank and null must not coerce to 0.
  const init =
    typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  if (!Number.isInteger(init) || init < MIN_INITIATIVE || init > MAX_INITIATIVE) {
    throw new ServerError(
      ErrorCode.INVALID_INITIATIVE,
      `Initiative must be a whole number from ${MIN_INITIATIVE} to ${MAX_INITIATIVE}`
    );
  }
  return init;
}

/** Pending (null) initiative ranks below every roll. */
const rank = (p: Player) => p.initiative ?? -Infinity;

/**
 * Insert below every entry with equal or higher initiative, so ties keep join order
 * and the DM's manual reorders of other entries are left alone.
 */
function insertByInitiative(players: Player[], player: Player): void {
  const idx = players.findIndex((p) => rank(p) < rank(player));
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
      customFields: [],
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
      throw new ServerError(ErrorCode.SESSION_FULL, `This table is full (${MAX_PLAYERS} max)`);
    }
    player.name = validateName(player.name);
    player.initiative = validateInitiative(player.initiative);
    const nameLower = player.name.toLowerCase();
    if (session.players.some((p) => p.name.toLowerCase() === nameLower)) {
      throw new ServerError(ErrorCode.NAME_TAKEN, `"${player.name}" is already at this table`);
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
      fields: {},
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
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "That player is no longer at the table");
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

  /** DM edit: sets anyone's initiative, pending or not, and moves them into place. */
  updateInitiative(session: Session, playerId: string, initiative: unknown): void {
    const value = validateInitiative(initiative);
    const idx = session.players.findIndex((p) => p.id === playerId);
    if (idx === -1) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "That player is no longer at the table");
    }
    const [player] = session.players.splice(idx, 1);
    player!.initiative = value;
    insertByInitiative(session.players, player!);
    this.touch(session);
  }

  /** A player entering their own roll for a new combat. Once set, only the DM can change it. */
  submitInitiative(session: Session, playerId: string, initiative: unknown): void {
    const player = session.players.find((p) => p.id === playerId);
    if (!player) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "You're no longer at this table");
    }
    if (player.initiative !== null) {
      throw new ServerError(
        ErrorCode.UNAUTHORIZED,
        "Your initiative is already set. Ask the DM if it needs changing."
      );
    }
    this.updateInitiative(session, playerId, initiative);
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

  /**
   * New combat: the previous fight's NPCs are removed, players stay with their
   * initiative cleared until they re-enter it, and the turn goes back to round 1.
   * Custom fields and players' values carry over.
   */
  reset(session: Session): void {
    session.players = session.players.filter((p) => !p.isNpc);
    for (const p of session.players) p.initiative = null;
    session.status = "WAITING";
    session.turnState = { currentPlayerId: null, round: 1 };
    this.touch(session);
  }

  addField(session: Session, name: unknown, type: unknown): CustomField {
    if (session.customFields.length >= MAX_CUSTOM_FIELDS) {
      throw new ServerError(
        ErrorCode.INVALID_FIELD,
        `A table can have at most ${MAX_CUSTOM_FIELDS} custom fields`
      );
    }
    const field: CustomField = {
      id: crypto.randomUUID(),
      name: this.uniqueFieldName(session, validateFieldName(name)),
      type: validateFieldType(type),
    };
    session.customFields.push(field);
    this.touch(session);
    return field;
  }

  /** Rename and/or retype a field. On a type change, values that don't fit the new type are dropped. */
  updateField(session: Session, fieldId: string, changes: { name?: unknown; type?: unknown }): void {
    const field = this.findField(session, fieldId);
    const name =
      changes.name === undefined
        ? field.name
        : this.uniqueFieldName(session, validateFieldName(changes.name), field.id);
    const type = changes.type === undefined ? field.type : validateFieldType(changes.type);
    if (type !== field.type) {
      const retyped: CustomField = { ...field, type };
      for (const p of session.players) {
        if (!(field.id in p.fields)) continue;
        try {
          p.fields[field.id] = validateFieldValue(retyped, p.fields[field.id])!;
        } catch {
          delete p.fields[field.id];
        }
      }
    }
    field.name = name;
    field.type = type;
    this.touch(session);
  }

  removeField(session: Session, fieldId: string): void {
    this.findField(session, fieldId);
    session.customFields = session.customFields.filter((f) => f.id !== fieldId);
    for (const p of session.players) delete p.fields[fieldId];
    this.touch(session);
  }

  /** Sets (or with a blank/null value, clears) one player's value for one field. */
  setFieldValue(session: Session, playerId: string, fieldId: string, raw: unknown): void {
    const field = this.findField(session, fieldId);
    const player = session.players.find((p) => p.id === playerId);
    if (!player) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "That player is no longer at the table");
    }
    const value = validateFieldValue(field, raw);
    if (value === null) delete player.fields[fieldId];
    else player.fields[fieldId] = value;
    this.touch(session);
  }

  private findField(session: Session, fieldId: string): CustomField {
    const field = session.customFields.find((f) => f.id === fieldId);
    if (!field) {
      throw new ServerError(ErrorCode.FIELD_NOT_FOUND, "That field no longer exists");
    }
    return field;
  }

  private uniqueFieldName(session: Session, name: string, exceptId?: string): string {
    const lower = name.toLowerCase();
    if (session.customFields.some((f) => f.id !== exceptId && f.name.toLowerCase() === lower)) {
      throw new ServerError(ErrorCode.INVALID_FIELD, `There is already a "${name}" field`);
    }
    return name;
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
