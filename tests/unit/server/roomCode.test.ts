import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateRoomCode, generateUniqueRoomCode } from "../../../src/server/roomCode";
import { ROOM_CODE_LENGTH, ROOM_CODE_CHARSET, ErrorCode } from "../../../src/shared/constants";

describe("roomCode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateRoomCode", () => {
    it("returns a string of the correct length", () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
    });

    it("only uses characters from the allowed charset", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateRoomCode();
        for (const ch of code) {
          expect(ROOM_CODE_CHARSET).toContain(ch);
        }
      }
    });

    it("produces different codes on successive calls", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateRoomCode());
      }
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("generateUniqueRoomCode", () => {
    it("returns a code not in the existing set", () => {
      const existing = new Set<string>(["2345", "6789"]);
      const code = generateUniqueRoomCode(existing);
      expect(existing.has(code)).toBe(false);
    });

    it("returns a code of the correct length", () => {
      const code = generateUniqueRoomCode(new Set());
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
    });

    it("throws ROOM_CODE_COLLISION when all possible codes are taken", () => {
      const allCodes = new Set<string>();
      const charset = ROOM_CODE_CHARSET;
      for (const a of charset) {
        for (const b of charset) {
          for (const c of charset) {
            for (const d of charset) {
              allCodes.add(a + b + c + d);
            }
          }
        }
      }
      expect(() => generateUniqueRoomCode(allCodes)).toThrow(ErrorCode.ROOM_CODE_COLLISION);
    });

    it("throws after exhausting max attempts when Math.random is forced to collide", () => {
      let callCount = 0;
      vi.spyOn(Math, "random").mockImplementation(() => {
        callCount++;
        return 0;
      });
      const existing = new Set<string>(["2222"]);
      expect(() => generateUniqueRoomCode(existing)).toThrow(ErrorCode.ROOM_CODE_COLLISION);
    });
  });
});
