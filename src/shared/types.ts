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
  /** DM-defined extra columns (AC, Passive Perception, ...). Kept across combats. */
  customFields: CustomField[];
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
  /** Custom field values by field id; a missing key means no value. */
  fields: FieldValues;
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
  /** Empty for NPCs when the viewer isn't the DM: NPC stats stay secret. */
  fields: FieldValues;
}

export type CustomFieldType = "number" | "text";

export interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
}

export type FieldValue = number | string;
export type FieldValues = Record<string, FieldValue>;

export interface TurnState {
  /** Whose turn it is; null when the list is empty. */
  currentPlayerId: string | null;
  round: number;
}
