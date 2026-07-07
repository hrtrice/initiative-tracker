import type { SessionStatus } from "./constants";

export interface Session {
  id: string;
  roomCode: string;
  dmToken: string;
  dmPlayerId: string;
  status: SessionStatus;
  players: Player[];
  turnState: TurnState;
  createdAt: number;
  lastActivityAt: number;
}

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  initiative: number;
  sortOrder: number;
  isDM: boolean;
  clientId: string | null;
  playerToken: string;
  createdAt: number;
}

export interface TurnState {
  currentIndex: number;
  round: number;
}
