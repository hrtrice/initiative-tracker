import { describe, it, expect, beforeEach, vi } from "vitest";
import { WsHandler } from "../../../src/server/wsHandler";
import { SessionStore } from "../../../src/server/sessionStore";
import { ErrorCode, WS_CLOSE_REMOVED } from "../../../src/shared/constants";
import type { ClientMessage, ServerMessage } from "../../../src/shared/messages";
import { EventEmitter } from "events";
import type { IncomingMessage } from "http";

function createMockWs() {
  const ws = new EventEmitter() as any;
  ws.send = vi.fn(() => true);
  ws.ping = vi.fn(() => true);
  ws.close = vi.fn(() => true);
  ws.terminate = vi.fn(() => true);
  ws.readyState = 1;
  return ws;
}

describe("WsHandler", () => {
  let store: SessionStore;
  let handler: WsHandler;

  beforeEach(() => {
    store = new SessionStore();
    handler = new WsHandler(store);
  });

  /** A fake browser tab: sends client messages and records what the server sent back. */
  function connect() {
    const ws = createMockWs();
    handler.handleConnection(ws, {} as IncomingMessage);
    const received = (): ServerMessage[] =>
      ws.send.mock.calls.map((c: [string]) => JSON.parse(c[0]) as ServerMessage);
    return {
      ws,
      send(msg: ClientMessage) {
        ws.emit("message", Buffer.from(JSON.stringify(msg)));
      },
      received,
      last: () => received().at(-1)!,
      clear: () => ws.send.mockClear(),
      close: () => ws.emit("close"),
    };
  }

  function createSession() {
    const dm = connect();
    dm.send({ type: "CREATE_SESSION", payload: {} });
    const created = dm.last();
    if (created.type !== "SESSION_CREATED") throw new Error("expected SESSION_CREATED");
    return { dm, ...created.payload };
  }

  function join(roomCode: string, characterName: string, initiative: number) {
    const tab = connect();
    tab.send({ type: "JOIN_SESSION", payload: { roomCode, characterName, initiative } });
    const reply = tab.received()[0]!;
    if (reply.type !== "JOIN_ACCEPTED") throw new Error(`join failed: ${JSON.stringify(reply)}`);
    return { tab, ...reply.payload };
  }

  describe("connections", () => {
    it("tracks and forgets connections", () => {
      const tab = connect();
      expect(handler.getActiveConnections()).toBe(1);
      tab.close();
      expect(handler.getActiveConnections()).toBe(0);
    });

    it("pings every connection", () => {
      const tab = connect();
      handler.pingAll();
      expect(tab.ws.ping).toHaveBeenCalled();
    });

    it("rejects malformed messages", () => {
      const tab = connect();
      tab.ws.emit("message", Buffer.from("not json"));
      tab.ws.emit("message", Buffer.from(JSON.stringify({ type: "JOIN_SESSION" })));
      expect(tab.received().map((m) => m.type)).toEqual(["ERROR", "ERROR"]);
    });
  });

  describe("CREATE_SESSION", () => {
    it("replies with room code, DM token and an empty list", () => {
      const { roomCode, dmToken, players, turnState } = createSession();
      expect(roomCode).toHaveLength(4);
      expect(dmToken).toBeTypeOf("string");
      expect(players).toEqual([]);
      expect(turnState).toEqual({ currentPlayerId: null, round: 1 });
    });
  });

  describe("JOIN_SESSION", () => {
    it("accepts the player with session details and tells everyone else", () => {
      const { dm, roomCode, sessionId } = createSession();
      dm.clear();
      const p = join(roomCode, "Aragorn", 15);
      expect(p.sessionId).toBe(sessionId);
      expect(p.roomCode).toBe(roomCode);
      expect(p.players.map((x) => x.name)).toEqual(["Aragorn"]);
      expect(dm.last().type).toBe("PLAYER_JOINED");
    });

    it("never sends tokens to other clients", () => {
      const { dm, roomCode, dmToken } = createSession();
      const p1 = join(roomCode, "Aragorn", 15);
      join(roomCode, "Gimli", 8);
      const everything = JSON.stringify([...dm.received(), ...p1.tab.received()]);
      expect(everything.split(p1.playerToken).length - 1).toBe(1); // only its own JOIN_ACCEPTED
      expect(p1.tab.received().some((m) => JSON.stringify(m).includes(dmToken))).toBe(false);
    });

    it("rejects unknown room codes, bad names and bad initiative", () => {
      const { roomCode } = createSession();
      const tab = connect();
      tab.send({ type: "JOIN_SESSION", payload: { roomCode: "9999", characterName: "A", initiative: 1 } });
      tab.send({ type: "JOIN_SESSION", payload: { roomCode, characterName: "", initiative: 1 } });
      tab.send({ type: "JOIN_SESSION", payload: { roomCode, characterName: "A", initiative: 99 } });
      expect(tab.received().map((m) => m.type === "ERROR" && m.payload.code)).toEqual([
        ErrorCode.SESSION_NOT_FOUND,
        ErrorCode.INVALID_NAME,
        ErrorCode.INVALID_INITIATIVE,
      ]);
    });

    it("lets a player retry on the same connection after an error", () => {
      const { roomCode } = createSession();
      const tab = connect();
      tab.send({ type: "JOIN_SESSION", payload: { roomCode: "9999", characterName: "A", initiative: 1 } });
      tab.send({ type: "JOIN_SESSION", payload: { roomCode, characterName: "A", initiative: 1 } });
      expect(tab.last().type).toBe("JOIN_ACCEPTED");
    });
  });

  describe("RECONNECT_SESSION / RECOVER_SESSION", () => {
    it("a player's new connection gets their identity and keeps receiving updates", () => {
      const { dm, roomCode, dmToken } = createSession();
      const p = join(roomCode, "Aragorn", 15);
      p.tab.close();

      const tab2 = connect();
      tab2.send({ type: "RECONNECT_SESSION", payload: { roomCode, playerToken: p.playerToken } });
      const sync = tab2.last();
      expect(sync.type).toBe("SESSION_STATE_SYNC");
      if (sync.type !== "SESSION_STATE_SYNC") return;
      expect(sync.payload).toMatchObject({ roomCode, isDM: false, playerId: p.playerId });

      dm.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(tab2.last().type).toBe("TURN_ADVANCED");
    });

    it("the DM's new connection regains DM control", () => {
      const { dm, roomCode, dmToken } = createSession();
      dm.close();

      const dm2 = connect();
      dm2.send({ type: "RECOVER_SESSION", payload: { roomCode, dmToken } });
      expect(dm2.last()).toMatchObject({
        type: "SESSION_STATE_SYNC",
        payload: { isDM: true, playerId: null },
      });
      dm2.send({ type: "ADD_NPC", payload: { dmToken, name: "Goblin", initiative: 12 } });
      expect(dm2.last().type).toBe("PLAYER_JOINED");
    });

    it("rejects bad tokens", () => {
      const { roomCode } = createSession();
      const tab = connect();
      tab.send({ type: "RECONNECT_SESSION", payload: { roomCode, playerToken: "nope" } });
      tab.send({ type: "RECOVER_SESSION", payload: { roomCode, dmToken: "nope" } });
      expect(tab.received().map((m) => m.type === "ERROR" && m.payload.code)).toEqual([
        ErrorCode.PLAYER_NOT_FOUND,
        ErrorCode.UNAUTHORIZED,
      ]);
    });

    it("an old connection closing after a reconnect doesn't cut off the new one", () => {
      const { dm, roomCode, dmToken } = createSession();
      const p = join(roomCode, "Aragorn", 15);
      const tab2 = connect();
      tab2.send({ type: "RECONNECT_SESSION", payload: { roomCode, playerToken: p.playerToken } });
      p.tab.close();

      dm.send({ type: "REMOVE_PLAYER", payload: { dmToken, playerId: p.playerId } });
      expect(tab2.received().map((m) => m.type)).toContain("YOU_WERE_REMOVED");
    });
  });

  describe("DM commands", () => {
    it("are refused from players, even with the right token", () => {
      const { roomCode, dmToken } = createSession();
      const p = join(roomCode, "Aragorn", 15);
      p.tab.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(p.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });

    it("are refused from unbound connections", () => {
      const { dmToken } = createSession();
      const tab = connect();
      tab.send({ type: "RESET_SESSION", payload: { dmToken } });
      expect(tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });

    it("ADD_NPC sorts the NPC in and broadcasts a plain list update", () => {
      const { dm, roomCode, dmToken } = createSession();
      const p = join(roomCode, "Aragorn", 15);
      dm.send({ type: "ADD_NPC", payload: { dmToken, name: "Goblin", initiative: 20 } });
      const update = p.tab.last();
      expect(update.type).toBe("PLAYER_JOINED");
      if (update.type !== "PLAYER_JOINED") return;
      expect(update.payload.players.map((x) => [x.name, x.isNpc])).toEqual([
        ["Goblin", true],
        ["Aragorn", false],
      ]);
    });

    it("REORDER_PLAYERS applies a full order and broadcasts it", () => {
      const { dm, roomCode, dmToken } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      const g = join(roomCode, "Gimli", 8);
      dm.send({ type: "REORDER_PLAYERS", payload: { dmToken, orderedPlayerIds: [g.playerId, a.playerId] } });
      expect(a.tab.last()).toMatchObject({ type: "PLAYERS_REORDERED" });
      dm.send({ type: "REORDER_PLAYERS", payload: { dmToken, orderedPlayerIds: [g.playerId] } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.INVALID_REORDER } });
    });

    it("UPDATE_INITIATIVE re-sorts and broadcasts", () => {
      const { dm, roomCode, dmToken } = createSession();
      join(roomCode, "Aragorn", 15);
      const g = join(roomCode, "Gimli", 8);
      dm.send({ type: "UPDATE_INITIATIVE", payload: { dmToken, playerId: g.playerId, initiative: 20 } });
      const update = g.tab.last();
      expect(update.type).toBe("INITIATIVE_UPDATED");
      if (update.type !== "INITIATIVE_UPDATED") return;
      expect(update.payload.players.map((x) => x.name)).toEqual(["Gimli", "Aragorn"]);
    });

    it("ADVANCE_TURN loops from the last entry to the top", () => {
      const { dm, roomCode, dmToken } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      join(roomCode, "Gimli", 8);
      dm.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      dm.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(dm.last()).toMatchObject({
        type: "TURN_ADVANCED",
        payload: { turnState: { currentPlayerId: a.playerId, round: 2 } },
      });
    });

    it("REMOVE_PLAYER notifies and closes the removed player, and updates everyone else", () => {
      const { dm, roomCode, dmToken } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      const g = join(roomCode, "Gimli", 8);
      dm.send({ type: "REMOVE_PLAYER", payload: { dmToken, playerId: a.playerId } });
      expect(a.tab.last().type).toBe("YOU_WERE_REMOVED");
      expect(a.tab.ws.close).toHaveBeenCalledWith(WS_CLOSE_REMOVED, expect.any(String));
      expect(g.tab.last().type).toBe("PLAYER_REMOVED");
      a.tab.clear();
      dm.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(a.tab.received()).toEqual([]);
    });
  });

  describe("new combat", () => {
    it("players re-enter their own initiative after RESET_SESSION", () => {
      const { dm, roomCode, dmToken } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      dm.send({ type: "ADD_NPC", payload: { dmToken, name: "Goblin", initiative: 20 } });
      dm.send({ type: "RESET_SESSION", payload: { dmToken } });
      expect(a.tab.last()).toMatchObject({
        type: "SESSION_RESET",
        payload: { players: [{ name: "Aragorn", initiative: null }] },
      });

      a.tab.send({ type: "SUBMIT_INITIATIVE", payload: { initiative: 17 } });
      expect(dm.last()).toMatchObject({
        type: "INITIATIVE_UPDATED",
        payload: { players: [{ name: "Aragorn", initiative: 17 }] },
      });

      a.tab.send({ type: "SUBMIT_INITIATIVE", payload: { initiative: 25 } });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });

    it("SUBMIT_INITIATIVE is refused from the DM and unbound connections", () => {
      const { dm } = createSession();
      dm.send({ type: "SUBMIT_INITIATIVE", payload: { initiative: 10 } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
      const tab = connect();
      tab.send({ type: "SUBMIT_INITIATIVE", payload: { initiative: 10 } });
      expect(tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });
  });

  describe("LEAVE_SESSION", () => {
    it("a leaving player is removed, everyone is told, and the name is free again", () => {
      const { dm, roomCode } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      a.tab.send({ type: "LEAVE_SESSION", payload: {} });
      expect(dm.last()).toMatchObject({ type: "PLAYER_REMOVED", payload: { players: [] } });
      const again = join(roomCode, "Aragorn", 12);
      expect(again.players.map((p) => p.name)).toEqual(["Aragorn"]);
    });

    it("the DM leaving keeps the session, recoverable with the Admin Key", () => {
      const { dm, roomCode, dmToken, sessionId } = createSession();
      const a = join(roomCode, "Aragorn", 15);
      dm.send({ type: "LEAVE_SESSION", payload: {} });
      expect(store.findById(sessionId)).toBeDefined();
      dm.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });

      const dm2 = connect();
      dm2.send({ type: "RECOVER_SESSION", payload: { roomCode, dmToken } });
      dm2.send({ type: "ADVANCE_TURN", payload: { dmToken } });
      expect(a.tab.last().type).toBe("TURN_ADVANCED");
    });
  });

  describe("sweepExpiredSessions", () => {
    it("evicts idle sessions nobody is connected to", () => {
      const { dm, sessionId } = createSession();
      dm.close();
      store.findById(sessionId)!.lastActivityAt = Date.now() - 7_200_001;
      handler.sweepExpiredSessions();
      expect(store.findById(sessionId)).toBeUndefined();
    });
  });
});
