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

  describe("custom fields", () => {
    function fieldsSetup() {
      const s = createSession();
      const a = join(s.roomCode, "Aragorn", 15);
      const g = join(s.roomCode, "Gimli", 8);
      s.dm.send({ type: "ADD_FIELD", payload: { dmToken: s.dmToken, name: "AC", type: "number" } });
      const added = s.dm.last();
      if (added.type !== "FIELDS_UPDATED") throw new Error(JSON.stringify(added));
      return { ...s, a, g, acId: added.payload.customFields[0]!.id };
    }
    const fieldsOf = (msg: ServerMessage, name: string) =>
      msg.type === "FIELDS_UPDATED" ? msg.payload.players.find((p) => p.name === name)?.fields : undefined;

    it("only the DM can add, rename or remove fields, and everyone gets the new list", () => {
      const { dm, dmToken, a, acId } = fieldsSetup();
      expect(a.tab.last()).toMatchObject({
        type: "FIELDS_UPDATED",
        payload: { customFields: [{ id: acId, name: "AC", type: "number" }] },
      });

      a.tab.send({ type: "ADD_FIELD", payload: { dmToken, name: "PP", type: "number" } });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });

      dm.send({ type: "UPDATE_FIELD", payload: { dmToken, fieldId: acId, name: "Armor Class" } });
      expect(a.tab.last()).toMatchObject({ payload: { customFields: [{ name: "Armor Class" }] } });
      dm.send({ type: "REMOVE_FIELD", payload: { dmToken, fieldId: acId } });
      expect(a.tab.last()).toMatchObject({ type: "FIELDS_UPDATED", payload: { customFields: [] } });
    });

    it("players set their own values, which everyone can see", () => {
      const { dm, a, g, acId } = fieldsSetup();
      a.tab.send({ type: "SET_MY_FIELD", payload: { fieldId: acId, value: 16 } });
      expect(fieldsOf(dm.last(), "Aragorn")).toEqual({ [acId]: 16 });
      expect(fieldsOf(g.tab.last(), "Aragorn")).toEqual({ [acId]: 16 });
    });

    it("players can't set anyone else's values", () => {
      const { dmToken, a, g, acId } = fieldsSetup();
      a.tab.send({
        type: "SET_FIELD_VALUE",
        payload: { dmToken, playerId: g.playerId, fieldId: acId, value: 1 },
      });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });

    it("the DM sets anyone's values; NPC values reach only the DM", () => {
      const { dm, dmToken, a, g, acId } = fieldsSetup();
      dm.send({ type: "ADD_NPC", payload: { dmToken, name: "Goblin", initiative: 12 } });
      const joined = dm.last();
      if (joined.type !== "PLAYER_JOINED") throw new Error("expected PLAYER_JOINED");
      const goblinId = joined.payload.players.find((p) => p.name === "Goblin")!.id;

      dm.send({ type: "SET_FIELD_VALUE", payload: { dmToken, playerId: goblinId, fieldId: acId, value: 13 } });
      dm.send({ type: "SET_FIELD_VALUE", payload: { dmToken, playerId: g.playerId, fieldId: acId, value: 18 } });
      expect(fieldsOf(dm.last(), "Goblin")).toEqual({ [acId]: 13 });
      expect(fieldsOf(a.tab.last(), "Goblin")).toEqual({});
      expect(fieldsOf(a.tab.last(), "Gimli")).toEqual({ [acId]: 18 });
      // Nothing a player received ever carried the NPC's value.
      expect(JSON.stringify(a.tab.received())).not.toMatch(/:13\b/);
    });

    it("invalid values are rejected with a readable error", () => {
      const { a, acId } = fieldsSetup();
      a.tab.send({ type: "SET_MY_FIELD", payload: { fieldId: acId, value: "lots" } });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.INVALID_FIELD } });
    });

    it("a reconnecting player gets the field list and values", () => {
      const { roomCode, a, acId } = fieldsSetup();
      a.tab.send({ type: "SET_MY_FIELD", payload: { fieldId: acId, value: 16 } });
      const tab2 = connect();
      tab2.send({ type: "RECONNECT_SESSION", payload: { roomCode, playerToken: a.playerToken } });
      expect(tab2.last()).toMatchObject({
        type: "SESSION_STATE_SYNC",
        payload: { customFields: [{ id: acId, name: "AC" }] },
      });
    });
  });

  describe("health", () => {
    function healthSetup() {
      const s = createSession();
      const a = join(s.roomCode, "Aragorn", 15);
      s.dm.send({
        type: "ADD_NPC",
        payload: { dmToken: s.dmToken, name: "Goblin", initiative: 12, maxHp: 13 },
      });
      const joined = s.dm.last();
      if (joined.type !== "PLAYER_JOINED") throw new Error(JSON.stringify(joined));
      return { ...s, a, goblinId: joined.payload.players.find((p) => p.name === "Goblin")!.id };
    }
    const healthOf = (msg: ServerMessage, name: string) =>
      "players" in msg.payload ? msg.payload.players.find((p) => p.name === name)?.health : undefined;

    it("joining and summoning don't need HP; an NPC's HP is optional and starts full", () => {
      const { dm, a } = healthSetup();
      expect(healthOf(dm.last(), "Aragorn")).toBeNull();
      expect(healthOf(dm.last(), "Goblin")).toMatchObject({ current: 13, max: 13 });
      // New foes default to a bar for players: no numbers.
      expect(healthOf(a.tab.last(), "Goblin")).toEqual({ ratio: 1, state: "healthy", showBar: true });
    });

    it("players track their own health, which everyone can see", () => {
      const { dm, a } = healthSetup();
      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "max", amount: 30 } } });
      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "damage", amount: 18 } } });
      expect(dm.last().type).toBe("HEALTH_UPDATED");
      expect(healthOf(dm.last(), "Aragorn")).toMatchObject({ current: 12, max: 30, state: "bloodied" });
      expect(healthOf(a.tab.last(), "Aragorn")).toMatchObject({ current: 12, max: 30, showBar: true });
    });

    it("players can't change anyone else's health or visibility", () => {
      const { dmToken, a, goblinId } = healthSetup();
      a.tab.send({
        type: "SET_HEALTH",
        payload: { dmToken, playerId: goblinId, change: { kind: "damage", amount: 5 } },
      });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
      a.tab.send({ type: "SET_HEALTH_VISIBILITY", payload: { dmToken, playerId: goblinId, visibility: "both" } });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.UNAUTHORIZED } });
    });

    it("the DM controls what players see of each NPC, and bar-only never leaks the numbers", () => {
      const { dm, dmToken, a, goblinId } = healthSetup();
      dm.send({ type: "SET_HEALTH", payload: { dmToken, playerId: goblinId, change: { kind: "damage", amount: 6 } } });
      expect(healthOf(a.tab.last(), "Goblin")).toEqual({ ratio: 0.55, state: "healthy", showBar: true });
      expect(JSON.stringify(a.tab.received())).not.toMatch(/"(current|max)"/);

      dm.send({ type: "SET_HEALTH_VISIBILITY", payload: { dmToken, playerId: goblinId, visibility: "number" } });
      expect(healthOf(a.tab.last(), "Goblin")).toMatchObject({ current: 7, max: 13, showBar: false });
      dm.send({ type: "SET_HEALTH_VISIBILITY", payload: { dmToken, playerId: goblinId, visibility: "hidden" } });
      expect(healthOf(a.tab.last(), "Goblin")).toBeNull();
      // Only the DM is told each NPC's setting.
      expect(dm.last().type === "HEALTH_UPDATED" && dm.last()).toBeTruthy();
      const dmGoblin = (dm.last().payload as { players: { name: string; healthVisibility?: string }[] }).players.find(
        (p) => p.name === "Goblin"
      );
      expect(dmGoblin?.healthVisibility).toBe("hidden");
      expect(JSON.stringify(a.tab.last())).not.toContain("healthVisibility");
    });

    it("switching health off hides it from players, who then can't change their own", () => {
      const { dm, dmToken, a } = healthSetup();
      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "max", amount: 30 } } });
      dm.send({ type: "UPDATE_HEALTH_SETTINGS", payload: { dmToken, enabled: false } });
      expect(a.tab.last()).toMatchObject({ payload: { healthSettings: { enabled: false } } });
      expect(healthOf(a.tab.last(), "Aragorn")).toBeNull();
      expect(healthOf(a.tab.last(), "Goblin")).toBeNull();
      expect(healthOf(dm.last(), "Aragorn")).toMatchObject({ current: 30 });

      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "damage", amount: 1 } } });
      expect(a.tab.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.HEALTH_DISABLED } });
    });

    it("the NPC default applies to foes summoned afterwards", () => {
      const { dm, dmToken, a } = healthSetup();
      dm.send({ type: "UPDATE_HEALTH_SETTINGS", payload: { dmToken, npcDefault: "both" } });
      dm.send({ type: "ADD_NPC", payload: { dmToken, name: "Orc", initiative: 9, maxHp: 15 } });
      expect(healthOf(a.tab.last(), "Orc")).toMatchObject({ current: 15, max: 15, showBar: true });
      expect(healthOf(a.tab.last(), "Goblin")).not.toHaveProperty("current");
    });

    it("bad HP and settings are rejected with a readable error", () => {
      const { dm, dmToken, goblinId } = healthSetup();
      dm.send({ type: "ADD_NPC", payload: { dmToken, name: "Orc", initiative: 9, maxHp: 0 } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.INVALID_HEALTH } });
      dm.send({ type: "SET_HEALTH_VISIBILITY", payload: { dmToken, playerId: goblinId, visibility: "x" as never } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.INVALID_HEALTH } });
      dm.send({ type: "UPDATE_HEALTH_SETTINGS", payload: { dmToken, enabled: "yes" as never } });
      expect(dm.last()).toMatchObject({ type: "ERROR", payload: { code: ErrorCode.INVALID_HEALTH } });
    });

    it("player HP carries over to a new encounter", () => {
      const { dm, dmToken, a } = healthSetup();
      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "max", amount: 30 } } });
      a.tab.send({ type: "SET_MY_HEALTH", payload: { change: { kind: "damage", amount: 5 } } });
      dm.send({ type: "RESET_SESSION", payload: { dmToken } });
      expect(healthOf(a.tab.last(), "Aragorn")).toMatchObject({ current: 25, max: 30 });
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
