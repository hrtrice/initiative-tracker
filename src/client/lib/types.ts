import type { Session, Player, PlayerView, TurnState } from "@shared/types";
import type { ClientMessage, ServerMessage } from "@shared/messages";
import type { ConnectionStatus } from "./wsClient";

export type { Session, Player, PlayerView, TurnState, ClientMessage, ServerMessage };
export * from "@shared/constants";

export interface SessionState {
  sessionId: string | null;
  roomCode: string | null;
  players: PlayerView[];
  turnState: TurnState | null;
  isDM: boolean;
  playerId: string | null;
  playerToken: string | null;
  dmToken: string | null;
  error: string | null;
  connectionStatus: ConnectionStatus;
}
