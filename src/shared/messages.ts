import type { PlayerView, TurnState } from "./types";
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
}

export interface JoinAcceptedPayload {
  sessionId: string;
  roomCode: string;
  playerId: string;
  playerToken: string;
  players: PlayerView[];
  turnState: TurnState;
}

/** Reply to RECONNECT_SESSION / RECOVER_SESSION: who you are plus the full state. */
export interface SessionStateSyncPayload {
  sessionId: string;
  roomCode: string;
  players: PlayerView[];
  turnState: TurnState;
  isDM: boolean;
  /** Your own player id; null for the DM. */
  playerId: string | null;
}

export interface PlayerJoinedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface InitiativeUpdatedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface PlayersReorderedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface PlayerRemovedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface TurnAdvancedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface TurnRegressedPayload {
  players: PlayerView[];
  turnState: TurnState;
}

export interface SessionResetPayload {
  players: PlayerView[];
  turnState: TurnState;
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
