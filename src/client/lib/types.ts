export type { Session, Player, TurnState } from "@shared/types";
export { ErrorCode, MAX_PLAYERS, MIN_INITIATIVE, MAX_INITIATIVE } from "@shared/constants";
export type { ClientMessage, ServerMessage } from "@shared/messages";

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
