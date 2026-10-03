import type {
  CustomField,
  CustomFieldType,
  FieldValue,
  HealthSettings,
  HealthView,
  HealthVisibility,
  Player,
  PlayerView,
  Session,
  TurnState,
} from "@shared/types";
import type { ClientMessage, HealthChange, ServerMessage } from "@shared/messages";
import type { ConnectionStatus } from "./wsClient";

export type {
  CustomField,
  CustomFieldType,
  FieldValue,
  HealthChange,
  HealthSettings,
  HealthView,
  HealthVisibility,
  Session,
  Player,
  PlayerView,
  TurnState,
  ClientMessage,
  ServerMessage,
};
export * from "@shared/constants";

export interface SessionState {
  sessionId: string | null;
  roomCode: string | null;
  players: PlayerView[];
  turnState: TurnState | null;
  customFields: CustomField[];
  healthSettings: HealthSettings;
  isDM: boolean;
  playerId: string | null;
  playerToken: string | null;
  dmToken: string | null;
  error: string | null;
  connectionStatus: ConnectionStatus;
}
