import { describe, it, expect, beforeEach, vi } from "vitest";
import { WsHandler } from "../../../src/server/wsHandler";
import { SessionStore } from "../../../src/server/sessionStore";
import { ErrorCode } from "../../../src/shared/constants";
import { WebSocket } from "ws";
import type { IncomingMessage } from "http";

function createMockWs(): WebSocket {
  const ws = new WebSocket(null as unknown as string);
  vi.spyOn(ws, "send").mockImplementation(() => true);
  vi.spyOn(ws, "ping").mockImplementation(() => true);
  vi.spyOn(ws, "close").mockImplementation(() => true);
  vi.spyOn(ws, "terminate").mockImplementation(() => true);
  Object.defineProperty(ws, "readyState", { get: () => WebSocket.OPEN });
  return ws;
}

function createMockReq(): IncomingMessage {
  return {} as IncomingMessage;
}

describe("WsHandler", () => {
  let store: SessionStore;
  let handler: WsHandler;

  beforeEach(() => {
    store = new SessionStore();
    handler = new WsHandler(store);
  });

  describe("handleConnection", () => {
    it("registers a new client", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      expect(handler.clients.size).toBe(1);
    });

    it("calls removeClient on close", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      const removeSpy = vi.spyOn(handler, "removeClient");
      ws.emit("close");
      expect(removeSpy).toHaveBeenCalled();
    });
  });

  describe("CREATE_SESSION", () => {
    it("creates a session and sends SESSION_CREATED", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      const clientId = handler.clients.keys().next().value!;
      ws.emit("message", Buffer.from(JSON.stringify({ type: "CREATE_SESSION", payload: {} })));
      expect(ws.send).toHaveBeenCalled();
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("SESSION_CREATED");
      expect(sent.payload.roomCode).toHaveLength(4);
      expect(sent.payload.dmToken).toBeTypeOf("string");
    });
  });

  describe("JOIN_SESSION", () => {
    it("joins a valid session", () => {
      const dmWs = createMockWs();
      handler.handleConnection(dmWs, createMockReq());
      dmWs.emit("message", Buffer.from(JSON.stringify({ type: "CREATE_SESSION", payload: {} })));
      const created = JSON.parse((dmWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      const roomCode = created.payload.roomCode;

      const playerWs = createMockWs();
      handler.handleConnection(playerWs, createMockReq());
      playerWs.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "JOIN_SESSION",
            payload: { roomCode, characterName: "Aragorn", initiative: 15 },
          })
        )
      );
      const sent = JSON.parse((playerWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("JOIN_ACCEPTED");
    });

    it("sends error for nonexistent room code", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      ws.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "JOIN_SESSION",
            payload: { roomCode: "ZZZZ", characterName: "Aragorn", initiative: 15 },
          })
        )
      );
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("ERROR");
      expect(sent.payload.code).toBe(ErrorCode.SESSION_NOT_FOUND);
    });

    it("sends error for invalid name length", () => {
      const dmWs = createMockWs();
      handler.handleConnection(dmWs, createMockReq());
      dmWs.emit("message", Buffer.from(JSON.stringify({ type: "CREATE_SESSION", payload: {} })));
      const created = JSON.parse((dmWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      const roomCode = created.payload.roomCode;

      const playerWs = createMockWs();
      handler.handleConnection(playerWs, createMockReq());
      playerWs.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "JOIN_SESSION",
            payload: { roomCode, characterName: "", initiative: 15 },
          })
        )
      );
      const sent = JSON.parse((playerWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("ERROR");
      expect(sent.payload.code).toBe(ErrorCode.INVALID_NAME);
    });
  });

  describe("RECONNECT_SESSION", () => {
    it("reconnects with valid playerToken", () => {
      const dmWs = createMockWs();
      handler.handleConnection(dmWs, createMockReq());
      dmWs.emit("message", Buffer.from(JSON.stringify({ type: "CREATE_SESSION", payload: {} })));
      const created = JSON.parse((dmWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      const roomCode = created.payload.roomCode;
      const playerToken = created.payload.dmToken;

      const reconnectWs = createMockWs();
      handler.handleConnection(reconnectWs, createMockReq());
      reconnectWs.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "RECONNECT_SESSION",
            payload: { roomCode, playerToken },
          })
        )
      );
      const sent = JSON.parse((reconnectWs.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("SESSION_STATE_SYNC");
    });
  });

  describe("DM command auth", () => {
    it("sends UNAUTHORIZED for UPDATE_INITIATIVE without valid dmToken", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      ws.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "UPDATE_INITIATIVE",
            payload: { dmToken: "wrong", playerId: "p1", initiative: 10 },
          })
        )
      );
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("ERROR");
      expect(sent.payload.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it("sends UNAUTHORIZED for REMOVE_PLAYER without valid dmToken", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      ws.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "REMOVE_PLAYER",
            payload: { dmToken: "wrong", playerId: "p1" },
          })
        )
      );
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("ERROR");
      expect(sent.payload.code).toBe(ErrorCode.UNAUTHORIZED);
    });

    it("sends UNAUTHORIZED for ADVANCE_TURN without valid dmToken", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      ws.emit(
        "message",
        Buffer.from(
          JSON.stringify({
            type: "ADVANCE_TURN",
            payload: { dmToken: "wrong" },
          })
        )
      );
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      expect(sent.type).toBe("ERROR");
      expect(sent.payload.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });

  describe("removeClient", () => {
    it("removes client from the map", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      const clientId = handler.clients.keys().next().value!;
      handler.removeClient(clientId);
      expect(handler.clients.size).toBe(0);
    });

    it("is safe for unknown clientId", () => {
      expect(() => handler.removeClient("unknown")).not.toThrow();
    });
  });

  describe("sweepExpiredSessions", () => {
    it("evicts expired sessions", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      ws.emit("message", Buffer.from(JSON.stringify({ type: "CREATE_SESSION", payload: {} })));
      const created = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
      const sessionId = created.payload.sessionId;
      const session = store.findById(sessionId)!;
      session.lastActivityAt = Date.now() - 7_200_001;
      handler.sweepExpiredSessions();
      expect(store.findById(sessionId)).toBeUndefined();
    });
  });

  describe("pingAll", () => {
    it("sends ping to all clients", () => {
      const ws = createMockWs();
      handler.handleConnection(ws, createMockReq());
      handler.pingAll();
      expect(ws.ping).toHaveBeenCalled();
    });
  });
});
