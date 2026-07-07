import { describe, it, expect } from "vitest";
import type {
  ClientMessage,
  ServerMessage,
  ClientMessageMap,
  ServerMessageMap,
} from "../../../src/shared/messages";
import { ErrorCode } from "../../../src/shared/constants";

describe("ClientMessage union narrowing", () => {
  it("CREATE_SESSION has no required payload fields", () => {
    const msg: ClientMessage = { type: "CREATE_SESSION", payload: {} };
    expect(msg.type).toBe("CREATE_SESSION");
  });

  it("JOIN_SESSION has roomCode, characterName, initiative", () => {
    const msg: ClientMessage = {
      type: "JOIN_SESSION",
      payload: { roomCode: "ABCD", characterName: "Aragorn", initiative: 15 },
    };
    expect(msg.payload.roomCode).toBe("ABCD");
    expect(msg.payload.characterName).toBe("Aragorn");
    expect(msg.payload.initiative).toBe(15);
  });

  it("RECONNECT_SESSION has roomCode and playerToken", () => {
    const msg: ClientMessage = {
      type: "RECONNECT_SESSION",
      payload: { roomCode: "ABCD", playerToken: "token-1" },
    };
    expect(msg.payload.roomCode).toBe("ABCD");
    expect(msg.payload.playerToken).toBe("token-1");
  });

  it("UPDATE_INITIATIVE has dmToken, playerId, initiative", () => {
    const msg: ClientMessage = {
      type: "UPDATE_INITIATIVE",
      payload: { dmToken: "dm-token", playerId: "p1", initiative: 10 },
    };
    expect(msg.payload.dmToken).toBe("dm-token");
    expect(msg.payload.playerId).toBe("p1");
    expect(msg.payload.initiative).toBe(10);
  });

  it("REMOVE_PLAYER has dmToken and playerId", () => {
    const msg: ClientMessage = {
      type: "REMOVE_PLAYER",
      payload: { dmToken: "dm-token", playerId: "p1" },
    };
    expect(msg.payload.dmToken).toBe("dm-token");
    expect(msg.payload.playerId).toBe("p1");
  });

  it("ADVANCE_TURN and PREVIOUS_TURN have dmToken", () => {
    const advance: ClientMessage = { type: "ADVANCE_TURN", payload: { dmToken: "t1" } };
    const previous: ClientMessage = { type: "PREVIOUS_TURN", payload: { dmToken: "t1" } };
    expect(advance.payload.dmToken).toBe("t1");
    expect(previous.payload.dmToken).toBe("t1");
  });
});

describe("ServerMessage union narrowing", () => {
  it("SESSION_CREATED has roomCode, dmToken, sessionId, players, turnState", () => {
    const msg: ServerMessage = {
      type: "SESSION_CREATED",
      payload: {
        roomCode: "ABCD",
        dmToken: "dm-token",
        sessionId: "session-1",
        players: [],
        turnState: { currentIndex: 0, round: 1 },
      },
    };
    expect(msg.payload.roomCode).toBe("ABCD");
    expect(msg.payload.players).toEqual([]);
  });

  it("JOIN_ACCEPTED has playerId, playerToken, players, turnState", () => {
    const msg: ServerMessage = {
      type: "JOIN_ACCEPTED",
      payload: {
        playerId: "p1",
        playerToken: "token-1",
        players: [],
        turnState: { currentIndex: 0, round: 1 },
      },
    };
    expect(msg.payload.playerId).toBe("p1");
  });

  it("ERROR has code and message", () => {
    const msg: ServerMessage = {
      type: "ERROR",
      payload: { code: ErrorCode.SESSION_NOT_FOUND, message: "Not found" },
    };
    expect(msg.payload.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    expect(msg.payload.message).toBe("Not found");
  });

  it("HEARTBEAT has timestamp", () => {
    const msg: ServerMessage = {
      type: "HEARTBEAT",
      payload: { timestamp: 1234567890 },
    };
    expect(msg.payload.timestamp).toBe(1234567890);
  });

  it("TURN_ADVANCED has players and turnState", () => {
    const msg: ServerMessage = {
      type: "TURN_ADVANCED",
      payload: {
        players: [],
        turnState: { currentIndex: 1, round: 2 },
      },
    };
    expect(msg.payload.turnState.currentIndex).toBe(1);
  });
});
