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
  healthSettings: HealthSettings;
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
  /** null until a max HP is set: health isn't tracked for this character. */
  health: Health | null;
  /** What players may see of this NPC's health. Player characters always show both. */
  healthVisibility: HealthVisibility;
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
  /** What this viewer may see of the character's health; null when there's nothing to show. */
  health: HealthView | null;
  /** The NPC's visibility setting; only sent to the DM, who is the one who can change it. */
  healthVisibility?: HealthVisibility;
}

export interface Health {
  current: number;
  max: number;
  /** Temporary hit points: absorb damage first and don't count toward max (5e rules). */
  temp: number;
}

/** How much of an NPC's health players see. */
export type HealthVisibility = "hidden" | "bar" | "number" | "both";

export type HealthState = "healthy" | "bloodied" | "down";

export interface HealthView {
  /** Fill level from 0 to 1. Rounded when the viewer may not see the numbers behind it. */
  ratio: number;
  state: HealthState;
  /** Show the bar and its Bloodied/Down label. */
  showBar: boolean;
  /** The numbers are included only when the viewer may see them. */
  current?: number;
  max?: number;
  temp?: number;
}

export interface HealthSettings {
  /** Off: players see no health at all, their own included. The DM always sees it. */
  enabled: boolean;
  /** The visibility newly summoned NPCs start with. */
  npcDefault: HealthVisibility;
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
