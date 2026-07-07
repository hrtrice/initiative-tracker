import {
  ROOM_CODE_LENGTH,
  ROOM_CODE_CHARSET,
  ErrorCode,
} from "../shared/constants";

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARSET.length);
    code += ROOM_CODE_CHARSET[idx]!;
  }
  return code;
}

export function generateUniqueRoomCode(existingCodes: Set<string>): string {
  const maxAttempts = 4096;
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateRoomCode();
    if (!existingCodes.has(code)) {
      return code;
    }
  }
  throw new Error(ErrorCode.ROOM_CODE_COLLISION);
}
