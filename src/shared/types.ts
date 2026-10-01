import type { SessionStatus } from "./constants";

export interface Session {
  id: string;
  roomCode: string;
  dmToken: string;
  /** Connection currently acting as the DM; null while the DM is offline. */
  dmClientId: string | null;
  status: SessionStatus;
  /** Players and NPCs in turn order. The DM is not in this list. */
  players: Player[];
  turnState: TurnState;
  createdAt: number;
  lastActivityAt: number;
}

export interface Player {
  id: string;
  sessionId: string;
  name: string;
  /** null while waiting for the player to roll for a new combat. */
  initiative: number | null;
  /** NPCs are added and run by the DM; they have no connection or token. */
  isNpc: boolean;
  clientId: string | null;
  playerToken: string | null;
  createdAt: number;
}

/** What clients see of a player: never includes tokens or connection ids. */
export interface PlayerView {
  id: string;
  name: string;
  initiative: number | null;
  isNpc: boolean;
}

export interface TurnState {
  /** Whose turn it is; null when the list is empty. */
  currentPlayerId: string | null;
  round: number;
}
