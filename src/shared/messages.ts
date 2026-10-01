import type { CustomField, CustomFieldType, FieldValue, PlayerView, TurnState } from "./types";
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

export interface SessionCreatedPayload {
  roomCode: string;
  dmToken: string;
  sessionId: string;
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface JoinAcceptedPayload {
  sessionId: string;
  roomCode: string;
  playerId: string;
  playerToken: string;
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

/** Reply to RECONNECT_SESSION / RECOVER_SESSION: who you are plus the full state. */
export interface SessionStateSyncPayload {
  sessionId: string;
  roomCode: string;
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
  isDM: boolean;
  /** Your own player id; null for the DM. */
  playerId: string | null;
}

export interface PlayerJoinedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface InitiativeUpdatedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface PlayersReorderedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface PlayerRemovedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface TurnAdvancedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface TurnRegressedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

export interface SessionResetPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

/** Field definitions or values changed. */
export interface FieldsUpdatedPayload {
  players: PlayerView[];
  turnState: TurnState;
  customFields: CustomField[];
}

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
