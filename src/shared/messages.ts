import type {
  CustomField,
  CustomFieldType,
  FieldValue,
  HealthSettings,
  HealthVisibility,
  PlayerView,
  TurnState,
} from "./types";
import { ErrorCode } from "./constants";

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export interface CreateSessionPayload {}

export interface JoinSessionPayload {
  roomCode: string;
  characterName: string;
  initiative: number;
}

export interface ReconnectSessionPayload {
  roomCode: string;
  playerToken: string;
}

export interface RecoverSessionPayload {
  roomCode: string;
  dmToken: string;
}

export interface UpdateInitiativePayload {
  dmToken: string;
  playerId: string;
  initiative: number;
}

export interface ReorderPlayersPayload {
  dmToken: string;
  orderedPlayerIds: string[];
}

export interface RemovePlayerPayload {
  dmToken: string;
  playerId: string;
}

export interface AdvanceTurnPayload {
  dmToken: string;
}

export interface PreviousTurnPayload {
  dmToken: string;
}

export interface ResetSessionPayload {
  dmToken: string;
}

export interface AddNpcPayload {
  dmToken: string;
  name: string;
  initiative: number;
  /** Optional max HP; the NPC starts at full health. */
  maxHp?: number | null;
}

/** A player entering their own roll; only allowed while their initiative is pending. */
export interface SubmitInitiativePayload {
  initiative: number;
}

export interface LeaveSessionPayload {}

export interface AddFieldPayload {
  dmToken: string;
  name: string;
  type: CustomFieldType;
}

/** Rename and/or change type. Changing type keeps only values valid for the new type. */
export interface UpdateFieldPayload {
  dmToken: string;
  fieldId: string;
  name?: string;
  type?: CustomFieldType;
}

export interface RemoveFieldPayload {
  dmToken: string;
  fieldId: string;
}

/** DM setting any player's or NPC's value. null clears it. */
export interface SetFieldValuePayload {
  dmToken: string;
  playerId: string;
  fieldId: string;
  value: FieldValue | null;
}

/** A player setting a value on their own character. null clears it. */
export interface SetMyFieldPayload {
  fieldId: string;
  value: FieldValue | null;
}

/**
 * A change to someone's health. Sent as an action rather than new numbers so a player and
 * the DM changing the same character at once can't overwrite each other.
 * - damage: temp HP absorbs it first; HP stops at 0.
 * - heal: up to max HP.
 * - temp: sets temporary HP (they don't stack; 0 clears them).
 * - max: sets max HP. The first time, current HP starts full; null stops tracking health.
 */
export type HealthChange =
  | { kind: "damage" | "heal" | "temp"; amount: number }
  | { kind: "max"; amount: number | null };

export interface SetHealthPayload {
  dmToken: string;
  playerId: string;
  change: HealthChange;
}

/** A player changing their own character's health. */
export interface SetMyHealthPayload {
  change: HealthChange;
}

export interface SetHealthVisibilityPayload {
  dmToken: string;
  playerId: string;
  visibility: HealthVisibility;
}

export interface UpdateHealthSettingsPayload {
  dmToken: string;
  enabled?: boolean;
  npcDefault?: HealthVisibility;
}

export interface ClientMessageMap {
  CREATE_SESSION: CreateSessionPayload;
  JOIN_SESSION: JoinSessionPayload;
  RECONNECT_SESSION: ReconnectSessionPayload;
  RECOVER_SESSION: RecoverSessionPayload;
  UPDATE_INITIATIVE: UpdateInitiativePayload;
  REORDER_PLAYERS: ReorderPlayersPayload;
  REMOVE_PLAYER: RemovePlayerPayload;
  ADVANCE_TURN: AdvanceTurnPayload;
  PREVIOUS_TURN: PreviousTurnPayload;
  RESET_SESSION: ResetSessionPayload;
  ADD_NPC: AddNpcPayload;
  SUBMIT_INITIATIVE: SubmitInitiativePayload;
  LEAVE_SESSION: LeaveSessionPayload;
  ADD_FIELD: AddFieldPayload;
  UPDATE_FIELD: UpdateFieldPayload;
  REMOVE_FIELD: RemoveFieldPayload;
  SET_FIELD_VALUE: SetFieldValuePayload;
  SET_MY_FIELD: SetMyFieldPayload;
  SET_HEALTH: SetHealthPayload;
  SET_MY_HEALTH: SetMyHealthPayload;
  SET_HEALTH_VISIBILITY: SetHealthVisibilityPayload;
  UPDATE_HEALTH_SETTINGS: UpdateHealthSettingsPayload;
}

export type ClientMessage = {
  [K in keyof ClientMessageMap]: {
    type: K;
    payload: ClientMessageMap[K];
  };
}[keyof ClientMessageMap];

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

/** The session as one viewer may see it. Every state broadcast carries a full one. */
export interface SessionSnapshot {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
  healthSettings: HealthSettings;
}

export interface SessionCreatedPayload extends SessionSnapshot {
  roomCode: string;
  dmToken: string;
  sessionId: string;
}

export interface JoinAcceptedPayload extends SessionSnapshot {
  sessionId: string;
  roomCode: string;
  playerId: string;
  playerToken: string;
}

/** Reply to RECONNECT_SESSION / RECOVER_SESSION: who you are plus the full state. */
export interface SessionStateSyncPayload extends SessionSnapshot {
  sessionId: string;
  roomCode: string;
  isDM: boolean;
  /** Your own player id; null for the DM. */
  playerId: string | null;
}

export type PlayerJoinedPayload = SessionSnapshot;

export type InitiativeUpdatedPayload = SessionSnapshot;

export type PlayersReorderedPayload = SessionSnapshot;

export type PlayerRemovedPayload = SessionSnapshot;

export type TurnAdvancedPayload = SessionSnapshot;

export type TurnRegressedPayload = SessionSnapshot;

export type SessionResetPayload = SessionSnapshot;

/** Field definitions or values changed. */
export type FieldsUpdatedPayload = SessionSnapshot;

/** Someone's health, an NPC's health visibility or the table's health settings changed. */
export type HealthUpdatedPayload = SessionSnapshot;

export interface HeartbeatPayload {
  timestamp: number;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
}

export interface YouWereRemovedPayload {
  reason?: string;
}

export interface ServerMessageMap {
  SESSION_CREATED: SessionCreatedPayload;
  JOIN_ACCEPTED: JoinAcceptedPayload;
  SESSION_STATE_SYNC: SessionStateSyncPayload;
  PLAYER_JOINED: PlayerJoinedPayload;
  INITIATIVE_UPDATED: InitiativeUpdatedPayload;
  PLAYERS_REORDERED: PlayersReorderedPayload;
  PLAYER_REMOVED: PlayerRemovedPayload;
  TURN_ADVANCED: TurnAdvancedPayload;
  TURN_REGRESSED: TurnRegressedPayload;
  SESSION_RESET: SessionResetPayload;
  FIELDS_UPDATED: FieldsUpdatedPayload;
  HEALTH_UPDATED: HealthUpdatedPayload;
  HEARTBEAT: HeartbeatPayload;
  ERROR: ErrorPayload;
  YOU_WERE_REMOVED: YouWereRemovedPayload;
}

export type ServerMessage = {
  [K in keyof ServerMessageMap]: {
    type: K;
    payload: ServerMessageMap[K];
  };
}[keyof ServerMessageMap];
