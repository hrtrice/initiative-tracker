import { describe, it, expect, beforeEach } from "vitest";
import { SessionStore, snapshot } from "../../../src/server/sessionStore";
import { ErrorCode, MAX_PLAYERS, MAX_NAME_LENGTH } from "../../../src/shared/constants";
import type { Player, Session } from "../../../src/shared/types";

let nextId = 0;
function makePlayer(overrides: Partial<Player> = {}): Player {
  nextId++;
  return {
    id: overrides.id ?? `p${nextId}`,
    sessionId: overrides.sessionId ?? "",
    name: overrides.name ?? `Player${nextId}`,
    initiative: overrides.initiative ?? 10,
    isNpc: overrides.isNpc ?? false,
    fields: overrides.fields ?? {},
    clientId: overrides.clientId ?? null,
    playerToken: overrides.playerToken ?? `token-${nextId}`,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

const names = (s: Session) => s.players.map((p) => p.name);
const current = (s: Session) => s.players.find((p) => p.id === s.turnState.currentPlayerId)?.name;

function expectCode(fn: () => unknown, code: ErrorCode) {
  try {
    fn();
  } catch (err) {
    expect((err as { code?: string }).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code} to be thrown`);
}

describe("SessionStore", () => {
  let store: SessionStore;
  let session: Session;

  /** Adds players by name and initiative, in join order. */
  function seed(...entries: [string, number][]) {
    for (const [name, initiative] of entries) store.addPlayer(session, makePlayer({ name, initiative }));
  }

  beforeEach(() => {
    store = new SessionStore();
    session = store.create("dm-token");
  });

  describe("create", () => {
    it("starts empty, waiting, round 1, with no DM in the player list", () => {
      expect(session.roomCode).toHaveLength(4);
      expect(session.dmToken).toBe("dm-token");
      expect(session.status).toBe("WAITING");
      expect(session.players).toEqual([]);
      expect(session.turnState).toEqual({ currentPlayerId: null, round: 1 });
      expect(store.findByCode(session.roomCode)).toBe(session);
      expect(store.findById(session.id)).toBe(session);
    });
  });

  describe("addPlayer / addNpc ordering", () => {
    it("keeps the list sorted by initiative, highest first", () => {
      seed(["Aragorn", 15], ["Gimli", 8], ["Legolas", 22]);
      expect(names(session)).toEqual(["Legolas", "Aragorn", "Gimli"]);
    });

    it("breaks ties by join order", () => {
      seed(["Aragorn", 12], ["Boromir", 12]);
      expect(names(session)).toEqual(["Aragorn", "Boromir"]);
    });

    it("sorts NPCs in with players", () => {
      seed(["Aragorn", 15]);
      const goblin = store.addNpc(session, "Goblin", 20);
      expect(goblin.isNpc).toBe(true);
      expect(goblin.playerToken).toBeNull();
      expect(names(session)).toEqual(["Goblin", "Aragorn"]);
    });

    it("inserts newcomers without undoing the DM's manual reorder", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      store.reorderPlayers(session, [session.players[1]!.id, session.players[0]!.id]);
      seed(["Legolas", 22]);
      expect(names(session)).toEqual(["Legolas", "Gimli", "Aragorn"]);
    });

    it("rejects a full session", () => {
      for (let i = 0; i < MAX_PLAYERS; i++) seed([`P${i}`, 10]);
      expectCode(() => seed(["Late", 10]), ErrorCode.SESSION_FULL);
    });

    it("rejects empty and over-long names", () => {
      expectCode(() => seed(["   ", 10]), ErrorCode.INVALID_NAME);
      expectCode(() => seed(["x".repeat(MAX_NAME_LENGTH + 1), 10]), ErrorCode.INVALID_NAME);
    });

    it("rejects duplicate names, case-insensitively, including NPCs", () => {
      seed(["Aragorn", 10]);
      expectCode(() => seed(["aragorn", 5]), ErrorCode.NAME_TAKEN);
      expectCode(() => store.addNpc(session, "ARAGORN", 5), ErrorCode.NAME_TAKEN);
    });

    it("rejects out-of-range or fractional initiative", () => {
      expectCode(() => seed(["A", 99]), ErrorCode.INVALID_INITIATIVE);
      expectCode(() => seed(["B", 2.5]), ErrorCode.INVALID_INITIATIVE);
    });
  });

  describe("updateInitiative", () => {
    it("moves the player to their new place in the order", () => {
      seed(["Aragorn", 15], ["Gimli", 8], ["Legolas", 22]);
      const gimli = session.players.find((p) => p.name === "Gimli")!;
      store.updateInitiative(session, gimli.id, 30);
      expect(names(session)).toEqual(["Gimli", "Legolas", "Aragorn"]);
    });

    it("keeps the turn with the same player when the order changes", () => {
      seed(["Aragorn", 15], ["Gimli", 8], ["Legolas", 22]);
      store.advanceTurn(session); // Legolas -> Aragorn
      const gimli = session.players.find((p) => p.name === "Gimli")!;
      store.updateInitiative(session, gimli.id, 30);
      expect(current(session)).toBe("Aragorn");
    });

    it("rejects unknown players and bad values", () => {
      seed(["Aragorn", 15]);
      expectCode(() => store.updateInitiative(session, "nope", 10), ErrorCode.PLAYER_NOT_FOUND);
      expectCode(
        () => store.updateInitiative(session, session.players[0]!.id, 100),
        ErrorCode.INVALID_INITIATIVE
      );
    });
  });

  describe("reorderPlayers", () => {
    it("applies the DM's order", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      const [a, g] = session.players;
      store.reorderPlayers(session, [g!.id, a!.id]);
      expect(names(session)).toEqual(["Gimli", "Aragorn"]);
    });

    it("rejects lists that don't exactly match the players", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      const [a] = session.players;
      expectCode(() => store.reorderPlayers(session, [a!.id]), ErrorCode.INVALID_REORDER);
      expectCode(() => store.reorderPlayers(session, [a!.id, a!.id]), ErrorCode.INVALID_REORDER);
      expectCode(() => store.reorderPlayers(session, [a!.id, "x"]), ErrorCode.INVALID_REORDER);
      expectCode(() => store.reorderPlayers(session, "junk"), ErrorCode.INVALID_REORDER);
      expect(names(session)).toEqual(["Aragorn", "Gimli"]);
    });
  });

  describe("turns", () => {
    it("before combat starts, the turn is whoever is at the top", () => {
      seed(["Aragorn", 15]);
      expect(current(session)).toBe("Aragorn");
      seed(["Legolas", 22]);
      expect(current(session)).toBe("Legolas");
    });

    it("Next walks down the order", () => {
      seed(["Legolas", 22], ["Aragorn", 15], ["Gimli", 8]);
      store.advanceTurn(session);
      expect(current(session)).toBe("Aragorn");
      store.advanceTurn(session);
      expect(current(session)).toBe("Gimli");
      expect(session.turnState.round).toBe(1);
    });

    it("Next after the last entry loops to the top and starts a new round", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.advanceTurn(session);
      store.advanceTurn(session);
      expect(current(session)).toBe("Legolas");
      expect(session.turnState.round).toBe(2);
    });

    it("Next with a single entry keeps it and advances the round", () => {
      seed(["Aragorn", 15]);
      store.advanceTurn(session);
      expect(current(session)).toBe("Aragorn");
      expect(session.turnState.round).toBe(2);
    });

    it("Previous walks back, wrapping to the bottom of the previous round", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.advanceTurn(session);
      store.advanceTurn(session); // round 2, Legolas
      store.previousTurn(session);
      expect(current(session)).toBe("Aragorn");
      expect(session.turnState.round).toBe(1);
    });

    it("Previous never takes the round below 1", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.previousTurn(session);
      expect(current(session)).toBe("Aragorn");
      expect(session.turnState.round).toBe(1);
    });

    it("a newcomer sorting above the current player doesn't steal the turn mid-combat", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      store.advanceTurn(session); // Gimli
      seed(["Legolas", 22]);
      expect(current(session)).toBe("Gimli");
    });

    it("Next and Previous do nothing on an empty list", () => {
      store.advanceTurn(session);
      store.previousTurn(session);
      expect(session.turnState).toEqual({ currentPlayerId: null, round: 1 });
    });
  });

  describe("removePlayer", () => {
    it("removes the player", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      store.removePlayer(session, session.players[0]!.id);
      expect(names(session)).toEqual(["Gimli"]);
    });

    it("passes the turn to the next entry when the current player is removed", () => {
      seed(["Legolas", 22], ["Aragorn", 15], ["Gimli", 8]);
      store.advanceTurn(session); // Aragorn
      store.removePlayer(session, session.turnState.currentPlayerId!);
      expect(current(session)).toBe("Gimli");
      expect(session.turnState.round).toBe(1);
    });

    it("wraps to the top and starts a new round when the last entry is removed on its turn", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.advanceTurn(session); // Aragorn
      store.removePlayer(session, session.turnState.currentPlayerId!);
      expect(current(session)).toBe("Legolas");
      expect(session.turnState.round).toBe(2);
    });

    it("keeps the turn where it is when someone else is removed", () => {
      seed(["Legolas", 22], ["Aragorn", 15], ["Gimli", 8]);
      store.advanceTurn(session); // Aragorn
      store.removePlayer(session, session.players[0]!.id);
      expect(current(session)).toBe("Aragorn");
    });

    it("rejects unknown players", () => {
      expectCode(() => store.removePlayer(session, "nope"), ErrorCode.PLAYER_NOT_FOUND);
    });
  });

  describe("reset (new combat)", () => {
    it("returns to round 1 with the turn at the top of the order", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.advanceTurn(session);
      store.advanceTurn(session);
      store.advanceTurn(session);
      store.reset(session);
      expect(session.status).toBe("WAITING");
      expect(session.turnState.round).toBe(1);
      expect(current(session)).toBe("Legolas");
    });

    it("keeps players, clears their initiative, and removes NPCs", () => {
      seed(["Legolas", 22], ["Aragorn", 15]);
      store.addNpc(session, "Goblin", 18);
      store.reset(session);
      expect(names(session)).toEqual(["Legolas", "Aragorn"]);
      expect(session.players.map((p) => p.initiative)).toEqual([null, null]);
    });

    it("players who re-roll sort above those still pending, by their new roll", () => {
      seed(["Legolas", 22], ["Aragorn", 15], ["Gimli", 8]);
      store.reset(session);
      const id = (n: string) => session.players.find((p) => p.name === n)!.id;
      store.submitInitiative(session, id("Gimli"), 12);
      store.submitInitiative(session, id("Aragorn"), 19);
      expect(names(session)).toEqual(["Aragorn", "Gimli", "Legolas"]);
      expect(session.players.at(-1)!.initiative).toBeNull();
      expect(current(session)).toBe("Aragorn");
    });

    it("new NPCs sort above players who haven't re-rolled yet", () => {
      seed(["Aragorn", 15]);
      store.reset(session);
      store.addNpc(session, "Orc", 3);
      expect(names(session)).toEqual(["Orc", "Aragorn"]);
    });
  });

  describe("submitInitiative", () => {
    it("is refused once the player's initiative is set (only the DM can change it)", () => {
      seed(["Aragorn", 15]);
      expectCode(
        () => store.submitInitiative(session, session.players[0]!.id, 20),
        ErrorCode.UNAUTHORIZED
      );
      expect(session.players[0]!.initiative).toBe(15);
    });

    it("rejects blank or missing values instead of treating them as 0", () => {
      seed(["Aragorn", 15]);
      store.reset(session);
      const id = session.players[0]!.id;
      expectCode(() => store.submitInitiative(session, id, null), ErrorCode.INVALID_INITIATIVE);
      expectCode(() => store.submitInitiative(session, id, ""), ErrorCode.INVALID_INITIATIVE);
      expect(session.players[0]!.initiative).toBeNull();
    });

    it("lets the DM set a pending player's initiative", () => {
      seed(["Aragorn", 15]);
      store.reset(session);
      store.updateInitiative(session, session.players[0]!.id, 11);
      expect(session.players[0]!.initiative).toBe(11);
    });
  });

  describe("client bindings", () => {
    it("binds the DM and players", () => {
      seed(["Aragorn", 15]);
      const aragorn = session.players[0]!;
      store.bindClient("c-dm", session, null);
      store.bindClient("c-1", session, aragorn.id);
      expect(session.dmClientId).toBe("c-dm");
      expect(aragorn.clientId).toBe("c-1");
      expect(store.getBinding("c-1")).toEqual({ sessionId: session.id, playerId: aragorn.id });
    });

    it("a stale connection closing doesn't detach a player who already reconnected", () => {
      seed(["Aragorn", 15]);
      const aragorn = session.players[0]!;
      store.bindClient("old", session, aragorn.id);
      store.bindClient("new", session, aragorn.id);
      store.unbindClient("old");
      expect(aragorn.clientId).toBe("new");
    });

    it("same for the DM", () => {
      store.bindClient("old", session, null);
      store.bindClient("new", session, null);
      store.unbindClient("old");
      expect(session.dmClientId).toBe("new");
    });

    it("rebinding a connection releases its previous binding", () => {
      const other = store.create("t2");
      store.bindClient("c", session, null);
      store.bindClient("c", other, null);
      expect(session.dmClientId).toBeNull();
      expect(store.getBinding("c")?.sessionId).toBe(other.id);
    });

    it("removing a player releases their connection", () => {
      seed(["Aragorn", 15]);
      store.bindClient("c-1", session, session.players[0]!.id);
      store.removePlayer(session, session.players[0]!.id);
      expect(store.getBinding("c-1")).toBeUndefined();
    });
  });

  describe("expiry", () => {
    it("expires idle sessions with nobody connected", () => {
      session.lastActivityAt = Date.now() - 7_200_001;
      expect(store.findExpiredSessions()).toEqual([session]);
      store.evictSession(session.id);
      expect(store.findById(session.id)).toBeUndefined();
      expect(store.findByCode(session.roomCode)).toBeUndefined();
    });

    it("keeps idle sessions while the DM is connected", () => {
      store.bindClient("c-dm", session, null);
      session.lastActivityAt = Date.now() - 7_200_001;
      expect(store.findExpiredSessions()).toEqual([]);
    });

    it("keeps idle sessions while a player is connected", () => {
      seed(["Aragorn", 15]);
      store.bindClient("c-1", session, session.players[0]!.id);
      session.lastActivityAt = Date.now() - 7_200_001;
      expect(store.findExpiredSessions()).toEqual([]);
    });
  });

  describe("snapshot", () => {
    it("never exposes tokens or connection ids", () => {
      seed(["Aragorn", 15]);
      store.bindClient("c-1", session, session.players[0]!.id);
      const json = JSON.stringify(snapshot(session, true));
      expect(json).not.toContain("token");
      expect(json).not.toContain("c-1");
      expect(snapshot(session, true).players[0]).toEqual({
        id: session.players[0]!.id,
        name: "Aragorn",
        initiative: 15,
        isNpc: false,
        fields: {},
      });
    });
  });
  describe("custom fields", () => {
    const fieldNamed = (name: string) => session.customFields.find((f) => f.name === name)!;
    const valueOf = (playerName: string, fieldName: string) =>
      session.players.find((p) => p.name === playerName)!.fields[fieldNamed(fieldName).id];

    it("adds fields with a name and type", () => {
      store.addField(session, "  AC  ", "number");
      store.addField(session, "Notes", "text");
      expect(session.customFields.map((f) => [f.name, f.type])).toEqual([
        ["AC", "number"],
        ["Notes", "text"],
      ]);
    });

    it("rejects bad names, duplicates (case-insensitive), bad types and too many fields", () => {
      expectCode(() => store.addField(session, "  ", "number"), ErrorCode.INVALID_FIELD);
      expectCode(() => store.addField(session, "x".repeat(21), "number"), ErrorCode.INVALID_FIELD);
      expectCode(() => store.addField(session, "AC", "dice"), ErrorCode.INVALID_FIELD);
      store.addField(session, "AC", "number");
      expectCode(() => store.addField(session, "ac", "text"), ErrorCode.INVALID_FIELD);
      for (let i = 1; i < 8; i++) store.addField(session, `F${i}`, "text");
      expectCode(() => store.addField(session, "Ninth", "text"), ErrorCode.INVALID_FIELD);
    });

    it("sets, validates and clears values", () => {
      seed(["Aragorn", 15]);
      const aragorn = session.players[0]!;
      const ac = store.addField(session, "AC", "number");
      const notes = store.addField(session, "Notes", "text");

      store.setFieldValue(session, aragorn.id, ac.id, "16");
      store.setFieldValue(session, aragorn.id, notes.id, "  ranger  ");
      expect(aragorn.fields).toEqual({ [ac.id]: 16, [notes.id]: "ranger" });

      expectCode(() => store.setFieldValue(session, aragorn.id, ac.id, 2.5), ErrorCode.INVALID_FIELD);
      expectCode(() => store.setFieldValue(session, aragorn.id, ac.id, 1000), ErrorCode.INVALID_FIELD);
      expectCode(() => store.setFieldValue(session, aragorn.id, ac.id, "abc"), ErrorCode.INVALID_FIELD);
      expectCode(
        () => store.setFieldValue(session, aragorn.id, notes.id, "x".repeat(41)),
        ErrorCode.INVALID_FIELD
      );
      expectCode(() => store.setFieldValue(session, aragorn.id, "nope", 1), ErrorCode.FIELD_NOT_FOUND);
      expectCode(() => store.setFieldValue(session, "nope", ac.id, 1), ErrorCode.PLAYER_NOT_FOUND);
      expect(aragorn.fields[ac.id]).toBe(16);

      store.setFieldValue(session, aragorn.id, ac.id, null);
      store.setFieldValue(session, aragorn.id, notes.id, "");
      expect(aragorn.fields).toEqual({});
    });

    it("renames fields, keeping values; rejects renaming onto another field", () => {
      seed(["Aragorn", 15]);
      store.addField(session, "AC", "number");
      store.addField(session, "PP", "number");
      store.setFieldValue(session, session.players[0]!.id, fieldNamed("AC").id, 16);
      store.updateField(session, fieldNamed("AC").id, { name: "Armor Class" });
      expect(valueOf("Aragorn", "Armor Class")).toBe(16);
      store.updateField(session, fieldNamed("PP").id, { name: "pp" }); // case change of itself is fine
      expectCode(
        () => store.updateField(session, fieldNamed("pp").id, { name: "armor class" }),
        ErrorCode.INVALID_FIELD
      );
    });

    it("changing type keeps values that fit and drops ones that don't", () => {
      seed(["Aragorn", 15], ["Gimli", 8]);
      const f = store.addField(session, "Speed", "text");
      store.setFieldValue(session, session.players[0]!.id, f.id, "30");
      store.setFieldValue(session, session.players[1]!.id, f.id, "fast");
      store.updateField(session, f.id, { type: "number" });
      expect(valueOf("Aragorn", "Speed")).toBe(30);
      expect(session.players[1]!.fields).toEqual({});
      store.updateField(session, f.id, { type: "text" });
      expect(valueOf("Aragorn", "Speed")).toBe("30");
    });

    it("deleting a field removes everyone's value for it", () => {
      seed(["Aragorn", 15]);
      const ac = store.addField(session, "AC", "number");
      store.setFieldValue(session, session.players[0]!.id, ac.id, 16);
      store.removeField(session, ac.id);
      expect(session.customFields).toEqual([]);
      expect(session.players[0]!.fields).toEqual({});
      expectCode(() => store.removeField(session, ac.id), ErrorCode.FIELD_NOT_FOUND);
    });

    it("fields and players' values survive a new combat", () => {
      seed(["Aragorn", 15]);
      const ac = store.addField(session, "AC", "number");
      store.setFieldValue(session, session.players[0]!.id, ac.id, 16);
      store.reset(session);
      expect(session.customFields.map((f) => f.name)).toEqual(["AC"]);
      expect(session.players[0]!.fields[ac.id]).toBe(16);
    });

    it("are per room: other sessions are unaffected", () => {
      const other = store.create("t2");
      store.addField(session, "AC", "number");
      expect(other.customFields).toEqual([]);
      store.addField(other, "AC", "text"); // same name is fine in another room
      expect(session.customFields[0]!.type).toBe("number");
    });

    it("snapshots hide NPC values from players but not from the DM", () => {
      seed(["Aragorn", 15]);
      const goblin = store.addNpc(session, "Goblin", 12);
      const ac = store.addField(session, "AC", "number");
      store.setFieldValue(session, session.players[0]!.id, ac.id, 16);
      store.setFieldValue(session, goblin.id, ac.id, 13);

      const asPlayer = snapshot(session, false).players;
      const asDm = snapshot(session, true).players;
      expect(asPlayer.find((p) => p.name === "Aragorn")!.fields).toEqual({ [ac.id]: 16 });
      expect(asPlayer.find((p) => p.name === "Goblin")!.fields).toEqual({});
      expect(asDm.find((p) => p.name === "Goblin")!.fields).toEqual({ [ac.id]: 13 });
      expect(snapshot(session, false).customFields).toEqual([{ id: ac.id, name: "AC", type: "number" }]);
    });
  });
});
