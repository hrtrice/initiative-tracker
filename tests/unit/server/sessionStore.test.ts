import { describe, it, expect, beforeEach, vi } from "vitest";
import { SessionStore } from "../../../src/server/sessionStore";
import { ErrorCode, MAX_PLAYERS, MIN_NAME_LENGTH, MAX_NAME_LENGTH } from "../../../src/shared/constants";
import type { Player } from "../../../src/shared/types";

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: overrides.id ?? "player-1",
    sessionId: overrides.sessionId ?? "",
    name: overrides.name ?? "TestPlayer",
    initiative: overrides.initiative ?? 10,
    sortOrder: overrides.sortOrder ?? 0,
    isDM: overrides.isDM ?? false,
    clientId: overrides.clientId ?? null,
    playerToken: overrides.playerToken ?? "token-1",
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

describe("SessionStore", () => {
  let store: SessionStore;

  beforeEach(() => {
    store = new SessionStore();
  });

  describe("create", () => {
    it("returns a session with correct structure", () => {
      const session = store.create("dm-token", "dm-player-id");
      expect(session.id).toBeTypeOf("string");
      expect(session.roomCode).toHaveLength(4);
      expect(session.dmToken).toBe("dm-token");
      expect(session.dmPlayerId).toBe("dm-player-id");
      expect(session.status).toBe("WAITING");
      expect(session.turnState).toEqual({ currentIndex: 0, round: 1 });
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.lastActivityAt).toBeGreaterThan(0);
    });

    it("adds the DM player automatically", () => {
      const session = store.create("dm-token", "dm-player-id");
      expect(session.players).toHaveLength(1);
      const dm = session.players[0]!;
      expect(dm.id).toBe("dm-player-id");
      expect(dm.name).toBe("Dungeon Master");
      expect(dm.isDM).toBe(true);
      expect(dm.playerToken).toBe("dm-token");
    });
  });

  describe("findByCode", () => {
    it("returns the session for a valid room code", () => {
      const session = store.create("t1", "p1");
      const found = store.findByCode(session.roomCode);
      expect(found).toBe(session);
    });

    it("returns undefined for an unknown code", () => {
      expect(store.findByCode("ZZZZ")).toBeUndefined();
    });

    it("is case-sensitive based on actual code", () => {
      const session = store.create("t1", "p1");
      expect(store.findByCode(session.roomCode.toLowerCase())).toBeUndefined();
    });
  });

  describe("findById", () => {
    it("returns the session for a valid id", () => {
      const session = store.create("t1", "p1");
      const found = store.findById(session.id);
      expect(found).toBe(session);
    });

    it("returns undefined for an unknown id", () => {
      expect(store.findById("nonexistent")).toBeUndefined();
    });
  });

  describe("addPlayer", () => {
    it("adds a player to the session", () => {
      const session = store.create("t1", "p1");
      const player = createTestPlayer({ id: "p2", name: "Aragorn" });
      store.addPlayer(session, player);
      expect(session.players).toHaveLength(2);
      expect(session.players[1]!.name).toBe("Aragorn");
    });

    it("sets sortOrder based on current player count", () => {
      const session = store.create("t1", "p1");
      const player = createTestPlayer({ id: "p2", name: "Aragorn" });
      store.addPlayer(session, player);
      expect(player.sortOrder).toBe(1);
    });

    it("throws SESSION_FULL when at max capacity", () => {
      const session = store.create("t1", "p1");
      for (let i = 0; i < MAX_PLAYERS - 1; i++) {
        store.addPlayer(session, createTestPlayer({ id: `p${i + 2}`, name: `Player${i}` }));
      }
      expect(session.players).toHaveLength(MAX_PLAYERS);
      expect(() =>
        store.addPlayer(session, createTestPlayer({ id: "extra", name: "Extra" }))
      ).toThrow(ErrorCode.SESSION_FULL);
    });

    it("throws INVALID_NAME for empty name", () => {
      const session = store.create("t1", "p1");
      expect(() =>
        store.addPlayer(session, createTestPlayer({ id: "p2", name: "" }))
      ).toThrow(ErrorCode.INVALID_NAME);
    });

    it("throws INVALID_NAME for name exceeding max length", () => {
      const session = store.create("t1", "p1");
      expect(() =>
        store.addPlayer(session, createTestPlayer({ id: "p2", name: "A".repeat(MAX_NAME_LENGTH + 1) }))
      ).toThrow(ErrorCode.INVALID_NAME);
    });

    it("throws NAME_TAKEN for duplicate names (case-insensitive)", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      expect(() =>
        store.addPlayer(session, createTestPlayer({ id: "p3", name: "aragorn" }))
      ).toThrow(ErrorCode.NAME_TAKEN);
    });
  });

  describe("removePlayer", () => {
    it("removes a player from the session", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.removePlayer(session, "p2");
      expect(session.players).toHaveLength(1);
      expect(session.players.find((p) => p.id === "p2")).toBeUndefined();
    });

    it("re-sortOrders after removal", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.addPlayer(session, createTestPlayer({ id: "p3", name: "Legolas" }));
      store.removePlayer(session, "p2");
      expect(session.players[0]!.sortOrder).toBe(0);
      expect(session.players[1]!.sortOrder).toBe(1);
    });

    it("does nothing when player not found", () => {
      const session = store.create("t1", "p1");
      expect(() => store.removePlayer(session, "nonexistent")).not.toThrow();
    });

    it("cleans up client mappings when player has clientId", () => {
      const session = store.create("t1", "p1");
      const player = createTestPlayer({ id: "p2", name: "Aragorn", clientId: "client-1" });
      store.addPlayer(session, player);
      store.registerClient("client-1", session.id, "p2");
      store.removePlayer(session, "p2");
      expect(session.players).toHaveLength(1);
    });
  });

  describe("updateInitiative", () => {
    it("updates player initiative and re-sorts descending", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Slow", initiative: 5, createdAt: 100 }));
      store.addPlayer(session, createTestPlayer({ id: "p3", name: "Fast", initiative: 20, createdAt: 200 }));
      store.updateInitiative(session, "p2", 25);
      expect(session.players[0]!.id).toBe("p2");
      expect(session.players[0]!.initiative).toBe(25);
    });

    it("breaks ties by join order (createdAt)", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "First", initiative: 10, createdAt: 100 }));
      store.addPlayer(session, createTestPlayer({ id: "p3", name: "Second", initiative: 10, createdAt: 200 }));
      expect(session.players[1]!.id).toBe("p2");
      expect(session.players[2]!.id).toBe("p3");
    });

    it("throws INVALID_INITIATIVE for out-of-range values", () => {
      const session = store.create("t1", "p1");
      expect(() => store.updateInitiative(session, "p1", -11)).toThrow(ErrorCode.INVALID_INITIATIVE);
      expect(() => store.updateInitiative(session, "p1", 41)).toThrow(ErrorCode.INVALID_INITIATIVE);
    });

    it("throws PLAYER_NOT_FOUND for unknown playerId", () => {
      const session = store.create("t1", "p1");
      expect(() => store.updateInitiative(session, "nonexistent", 10)).toThrow(ErrorCode.PLAYER_NOT_FOUND);
    });
  });

  describe("reorderPlayers", () => {
    it("reorders players according to provided ids", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.addPlayer(session, createTestPlayer({ id: "p3", name: "Legolas" }));
      store.reorderPlayers(session, ["p3", "p2", "p1"]);
      expect(session.players[0]!.id).toBe("p3");
      expect(session.players[1]!.id).toBe("p2");
      expect(session.players[2]!.id).toBe("p1");
    });

    it("sets sortOrder correctly after reorder", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.reorderPlayers(session, ["p2", "p1"]);
      expect(session.players[0]!.sortOrder).toBe(0);
      expect(session.players[1]!.sortOrder).toBe(1);
    });

    it("throws PLAYER_NOT_FOUND for unknown id", () => {
      const session = store.create("t1", "p1");
      expect(() => store.reorderPlayers(session, ["unknown"])).toThrow(ErrorCode.PLAYER_NOT_FOUND);
    });

    it("throws INVALID_NAME for duplicate ids", () => {
      const session = store.create("t1", "p1");
      expect(() => store.reorderPlayers(session, ["p1", "p1"])).toThrow(ErrorCode.INVALID_NAME);
    });

    it("throws INVALID_NAME for mismatched count", () => {
      const session = store.create("t1", "p1");
      expect(() => store.reorderPlayers(session, [])).toThrow(ErrorCode.INVALID_NAME);
    });
  });

  describe("advanceTurn", () => {
    it("advances to next player", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.advanceTurn(session);
      expect(session.turnState.currentIndex).toBe(1);
      expect(session.turnState.round).toBe(1);
    });

    it("wraps forward and increments round", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.advanceTurn(session);
      store.advanceTurn(session);
      expect(session.turnState.currentIndex).toBe(0);
      expect(session.turnState.round).toBe(2);
    });

    it("does nothing with no players", () => {
      const store2 = new SessionStore();
      const session = store2.create("t1", "p1");
      session.players = [];
      store2.advanceTurn(session);
      expect(session.turnState.currentIndex).toBe(0);
      expect(session.turnState.round).toBe(1);
    });
  });

  describe("previousTurn", () => {
    it("moves to previous player", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.advanceTurn(session);
      store.previousTurn(session);
      expect(session.turnState.currentIndex).toBe(0);
      expect(session.turnState.round).toBe(1);
    });

    it("wraps backward and floors round at 1", () => {
      const session = store.create("t1", "p1");
      store.addPlayer(session, createTestPlayer({ id: "p2", name: "Aragorn" }));
      store.previousTurn(session);
      expect(session.turnState.currentIndex).toBe(1);
      expect(session.turnState.round).toBe(1);
    });

    it("does nothing with no players", () => {
      const store2 = new SessionStore();
      const session = store2.create("t1", "p1");
      session.players = [];
      store2.previousTurn(session);
      expect(session.turnState.currentIndex).toBe(0);
      expect(session.turnState.round).toBe(1);
    });
  });

  describe("reset", () => {
    it("resets turn state and status", () => {
      const session = store.create("t1", "p1");
      session.status = "ACTIVE";
      session.turnState = { currentIndex: 3, round: 5 };
      store.reset(session);
      expect(session.turnState).toEqual({ currentIndex: 0, round: 1 });
      expect(session.status).toBe("WAITING");
    });
  });

  describe("registerClient / disconnectClient", () => {
    it("registerClient associates client with session and player", () => {
      const session = store.create("t1", "p1");
      store.registerClient("client-1", session.id, "p1");
      expect(session.players[0]!.clientId).toBe("client-1");
    });

    it("disconnectClient clears clientId and mappings", () => {
      const session = store.create("t1", "p1");
      store.registerClient("client-1", session.id, "p1");
      store.disconnectClient("client-1");
      expect(session.players[0]!.clientId).toBeNull();
    });

    it("disconnectClient is safe for unknown client", () => {
      expect(() => store.disconnectClient("unknown")).not.toThrow();
    });
  });

  describe("findExpiredSessions", () => {
    it("returns sessions past expiry with no connected clients", () => {
      const session = store.create("t1", "p1");
      session.lastActivityAt = Date.now() - 7_200_001;
      const expired = store.findExpiredSessions();
      expect(expired).toContain(session);
    });

    it("does not return sessions with connected clients", () => {
      const session = store.create("t1", "p1");
      store.registerClient("client-1", session.id, "p1");
      session.lastActivityAt = Date.now() - 7_200_001;
      const expired = store.findExpiredSessions();
      expect(expired).not.toContain(session);
    });

    it("does not return active sessions", () => {
      const session = store.create("t1", "p1");
      const expired = store.findExpiredSessions();
      expect(expired).not.toContain(session);
    });
  });

  describe("evictSession", () => {
    it("removes session from all maps", () => {
      const session = store.create("t1", "p1");
      const code = session.roomCode;
      store.evictSession(session.id);
      expect(store.findByCode(code)).toBeUndefined();
      expect(store.findById(session.id)).toBeUndefined();
    });

    it("is safe for unknown session", () => {
      expect(() => store.evictSession("unknown")).not.toThrow();
    });
  });
});
