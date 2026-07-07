import type { Session, Player, TurnState } from "@shared/types";
import type { ClientMessage, ServerMessage } from "@shared/messages";

export type { Session, Player, TurnState, ClientMessage, ServerMessage };
export * from "@shared/constants";

export interface SessionState {
  sessionId: string | null;
  roomCode: string | null;
  players: Player[];
  turnState: TurnState | null;
  isDM: boolean;
  playerId: string | null;
  playerToken: string | null;
  dmToken: string | null;
  error: string | null;
}
