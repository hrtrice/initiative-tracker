export const MAX_PLAYERS = 20;
export const SESSION_EXPIRY_MS = 7_200_000;
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_CHARSET = "23456789";
export const MIN_INITIATIVE = -10;
export const MAX_INITIATIVE = 40;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 50;
export const MAX_CUSTOM_FIELDS = 8;
export const MAX_FIELD_NAME_LENGTH = 20;
export const MAX_FIELD_TEXT_LENGTH = 40;
export const MIN_FIELD_NUMBER = -999;
export const MAX_FIELD_NUMBER = 999;
/** Offered to the DM as one-tap suggestions when adding custom fields. */
export const SUGGESTED_FIELDS: ReadonlyArray<{ name: string; type: "number" | "text" }> = [
  { name: "AC", type: "number" },
  { name: "Passive Perception", type: "number" },
  { name: "Passive Investigation", type: "number" },
];
export const WS_HEARTBEAT_INTERVAL_MS = 30_000;
export const WS_CLOSE_TIMEOUT_MS = 5_000;
/** Close code the server uses when the DM removes a player; clients must not auto-reconnect. */
export const WS_CLOSE_REMOVED = 4001;

export enum ErrorCode {
  SESSION_NOT_FOUND = "SESSION_NOT_FOUND",
  SESSION_FULL = "SESSION_FULL",
  NAME_TAKEN = "NAME_TAKEN",
  UNAUTHORIZED = "UNAUTHORIZED",
  PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND",
  INVALID_INITIATIVE = "INVALID_INITIATIVE",
  ROOM_CODE_COLLISION = "ROOM_CODE_COLLISION",
  INVALID_NAME = "INVALID_NAME",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  INVALID_REORDER = "INVALID_REORDER",
  INVALID_FIELD = "INVALID_FIELD",
  FIELD_NOT_FOUND = "FIELD_NOT_FOUND",
}

export type SessionStatus = "WAITING" | "ACTIVE" | "COMPLETED";
