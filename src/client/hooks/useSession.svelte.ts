import { WsClient } from "../lib/wsClient";
import { reloadIfOutdated } from "../lib/updateCheck";
import type { ConnectionStatus } from "../lib/wsClient";
import type { CustomFieldType, FieldValue, SessionState } from "../lib/types";
import type { ClientMessage, ServerMessage } from "@shared/messages";
import { ErrorCode } from "@shared/constants";

const wsClient = new WsClient();

/** What this tab needs to rejoin its session after a refresh or a dropped connection. */
type Credentials =
  | { role: "dm"; roomCode: string; dmToken: string }
  | { role: "player"; roomCode: string; playerToken: string };

const CREDENTIALS_KEY = "initiativeTracker.credentials";

/**
 * sessionStorage is this tab's own; localStorage is the fallback that survives closing
 * the tab, so a phone that drops the page can still get back in.
 */
const stores = (): Storage[] => [sessionStorage, localStorage];

function loadCredentials(): Credentials | null {
  for (const store of stores()) {
    try {
      const raw = store.getItem(CREDENTIALS_KEY);
      if (raw) return JSON.parse(raw) as Credentials;
    } catch {
      // Storage unavailable or corrupt; try the next one.
    }
  }
  return null;
}

function saveCredentials(creds: Credentials): void {
  for (const store of stores()) {
    try {
      store.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    } catch {
      // Storage unavailable (private mode); the session still works until refresh.
    }
  }
}

function clearCredentials(): void {
  for (const store of stores()) {
    try {
      store.removeItem(CREDENTIALS_KEY);
    } catch {
      // ignore
    }
  }
}

/** The table this device would rejoin on load, if any. */
export function storedTableCode(): string | null {
  return loadCredentials()?.roomCode ?? null;
}

/** Errors in reply to a rebind that mean the stored session is gone for good. */
const SESSION_GONE_CODES = new Set<ErrorCode>([
  ErrorCode.SESSION_NOT_FOUND,
  ErrorCode.PLAYER_NOT_FOUND,
  ErrorCode.UNAUTHORIZED,
]);

type DmCommand = Exclude<
  ClientMessage,
  { type: "CREATE_SESSION" | "JOIN_SESSION" | "RECONNECT_SESSION" | "RECOVER_SESSION" }
>;
type DmCommandPayload<T extends DmCommand["type"]> = Omit<
  Extract<DmCommand, { type: T }>["payload"],
  "dmToken"
>;

export function createSessionState() {
  let state = $state<SessionState>({
    sessionId: null,
    roomCode: null,
    players: [],
    turnState: null,
    customFields: [],
    isDM: false,
    playerId: null,
    playerToken: null,
    dmToken: null,
    error: null,
    connectionStatus: "disconnected" as ConnectionStatus,
  });

  /** True between sending a rebind and hearing back, so its errors can be told apart. */
  let rebinding = false;
  /** The rebind was the DM typing in an Admin Key, so show the server's reason on failure. */
  let manualRecover = false;
  /** Leave as soon as the stored table is rejoined (the player scanned another table's invite). */
  let leaveAfterRebind = false;

  function leaveSessionState(error: string | null) {
    clearCredentials();
    state.sessionId = null;
    state.roomCode = null;
    state.players = [];
    state.turnState = null;
    state.customFields = [];
    state.isDM = false;
    state.playerId = null;
    state.playerToken = null;
    state.dmToken = null;
    state.error = error;
  }

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "SESSION_CREATED":
        state.sessionId = msg.payload.sessionId;
        state.roomCode = msg.payload.roomCode;
        state.dmToken = msg.payload.dmToken;
        state.playerToken = null;
        state.playerId = null;
        state.isDM = true;
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        state.customFields = msg.payload.customFields;
        state.error = null;
        saveCredentials({ role: "dm", roomCode: msg.payload.roomCode, dmToken: msg.payload.dmToken });
        break;
      case "JOIN_ACCEPTED":
        state.sessionId = msg.payload.sessionId;
        state.roomCode = msg.payload.roomCode;
        state.playerId = msg.payload.playerId;
        state.playerToken = msg.payload.playerToken;
        state.dmToken = null;
        state.isDM = false;
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        state.customFields = msg.payload.customFields;
        state.error = null;
        saveCredentials({
          role: "player",
          roomCode: msg.payload.roomCode,
          playerToken: msg.payload.playerToken,
        });
        break;
      case "SESSION_STATE_SYNC": {
        rebinding = false;
        manualRecover = false;
        const creds = loadCredentials();
        state.sessionId = msg.payload.sessionId;
        state.roomCode = msg.payload.roomCode;
        state.isDM = msg.payload.isDM;
        state.playerId = msg.payload.playerId;
        state.dmToken = creds?.role === "dm" ? creds.dmToken : null;
        state.playerToken = creds?.role === "player" ? creds.playerToken : null;
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        state.customFields = msg.payload.customFields;
        if (leaveAfterRebind) {
          leaveAfterRebind = false;
          leaveSession();
        }
        break;
      }
      case "PLAYER_JOINED":
      case "INITIATIVE_UPDATED":
      case "PLAYERS_REORDERED":
      case "PLAYER_REMOVED":
      case "TURN_ADVANCED":
      case "TURN_REGRESSED":
      case "SESSION_RESET":
      case "FIELDS_UPDATED":
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        state.customFields = msg.payload.customFields;
        break;
      case "ERROR":
        if (rebinding && SESSION_GONE_CODES.has(msg.payload.code)) {
          rebinding = false;
          leaveAfterRebind = false;
          leaveSessionState(
            manualRecover ? msg.payload.message : "That table has closed, or you're no longer at it."
          );
          manualRecover = false;
        } else {
          state.error = msg.payload.message;
        }
        break;
      case "YOU_WERE_REMOVED":
        leaveSessionState("The Dungeon Master removed you from the table.");
        break;
      case "HEARTBEAT":
        break;
    }
  }

  /** On every (re)connect, tell the server who this tab is before anything else is sent. */
  function rebind() {
    const creds = loadCredentials();
    if (!creds) return;
    rebinding = true;
    if (creds.role === "dm") {
      wsClient.send({
        type: "RECOVER_SESSION",
        payload: { roomCode: creds.roomCode, dmToken: creds.dmToken },
      });
    } else {
      wsClient.send({
        type: "RECONNECT_SESSION",
        payload: { roomCode: creds.roomCode, playerToken: creds.playerToken },
      });
    }
  }

  wsClient.onMessage(handleMessage);
  wsClient.onOpen(() => {
    rebind();
    // A (re)connect is the moment a deploy becomes visible: pick up the new build.
    void reloadIfOutdated();
  });
  wsClient.onStatusChange((s) => {
    state.connectionStatus = s;
  });

  // Phones drop sockets when the screen locks; reconnect as soon as the page is back.
  const resume = () => {
    if (document.visibilityState !== "visible") return;
    void reloadIfOutdated();
    if (loadCredentials()) wsClient.connect();
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", resume);

  if (loadCredentials()) wsClient.connect();

  /** Leaving needs the server to know who we are, so it goes out right after rejoining. */
  function leaveSession() {
    wsClient.send({ type: "LEAVE_SESSION", payload: {} });
    leaveSessionState(null);
  }

  function dmCommand<T extends DmCommand["type"]>(type: T, payload: DmCommandPayload<T>) {
    if (!state.dmToken) return;
    wsClient.send({ type, payload: { ...payload, dmToken: state.dmToken } } as ClientMessage);
  }

  return {
    get state() {
      return state;
    },
    createSession: () => {
      wsClient.send({ type: "CREATE_SESSION", payload: {} });
    },
    joinSession: (roomCode: string, characterName: string, initiative: number) => {
      wsClient.send({
        type: "JOIN_SESSION",
        payload: { roomCode: roomCode.trim().toUpperCase(), characterName, initiative },
      });
    },
    updateInitiative: (playerId: string, initiative: number) =>
      dmCommand("UPDATE_INITIATIVE", { playerId, initiative }),
    reorderPlayers: (orderedPlayerIds: string[]) =>
      dmCommand("REORDER_PLAYERS", { orderedPlayerIds }),
    removePlayer: (playerId: string) => dmCommand("REMOVE_PLAYER", { playerId }),
    advanceTurn: () => dmCommand("ADVANCE_TURN", {}),
    previousTurn: () => dmCommand("PREVIOUS_TURN", {}),
    resetSession: () => dmCommand("RESET_SESSION", {}),
    addNpc: (name: string, initiative: number) => dmCommand("ADD_NPC", { name, initiative }),
    addField: (name: string, type: CustomFieldType) => dmCommand("ADD_FIELD", { name, type }),
    updateField: (fieldId: string, changes: { name?: string; type?: CustomFieldType }) =>
      dmCommand("UPDATE_FIELD", { fieldId, ...changes }),
    removeField: (fieldId: string) => dmCommand("REMOVE_FIELD", { fieldId }),
    /** DMs can set anyone's value; players only their own. null clears the value. */
    setFieldValue: (playerId: string, fieldId: string, value: FieldValue | null) => {
      if (state.isDM) dmCommand("SET_FIELD_VALUE", { playerId, fieldId, value });
      else if (playerId === state.playerId) {
        wsClient.send({ type: "SET_MY_FIELD", payload: { fieldId, value } });
      }
    },
    /** Rejoin as DM from another device or after clearing the browser, using the Admin Key. */
    recoverAsDm: (roomCode: string, dmToken: string) => {
      saveCredentials({ role: "dm", roomCode: roomCode.trim().toUpperCase(), dmToken: dmToken.trim() });
      manualRecover = true;
      state.error = null;
      if (wsClient.status === "connected") rebind();
      else wsClient.connect(); // rebinds on open
    },
    submitInitiative: (initiative: number) => {
      wsClient.send({ type: "SUBMIT_INITIATIVE", payload: { initiative } });
    },
    leaveSession,
    /** Leave the stored table to take up an invite to a different one. */
    leaveStoredTable: () => {
      if (state.sessionId) leaveSession();
      else leaveAfterRebind = true;
    },
    clearError: () => {
      state.error = null;
    },
  };
}
