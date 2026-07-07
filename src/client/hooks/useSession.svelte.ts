import { WsClient, type ConnectionStatus } from "../lib/wsClient";
import type { SessionState } from "../lib/types";
import type { ServerMessage } from "@shared/messages";

let wsClient = new WsClient();

export function createSessionState() {
  let state = $state<SessionState>({
    sessionId: null,
    roomCode: null,
    players: [],
    turnState: null,
    isDM: false,
    playerId: null,
    playerToken: null,
    dmToken: null,
    error: null,
  });

  let connectionStatus = $state<ConnectionStatus>("disconnected");

  function handleMessage(msg: ServerMessage) {
    switch (msg.type) {
      case "SESSION_CREATED":
        state.sessionId = msg.payload.sessionId;
        state.roomCode = msg.payload.roomCode;
        state.dmToken = msg.payload.dmToken;
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        state.isDM = true;
        sessionStorage.setItem("dmToken", msg.payload.dmToken);
        sessionStorage.setItem("roomCode", msg.payload.roomCode);
        break;
      case "JOIN_ACCEPTED":
        state.playerId = msg.payload.playerId;
        state.playerToken = msg.payload.playerToken;
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        sessionStorage.setItem("playerToken", msg.payload.playerToken);
        break;
      case "SESSION_STATE_SYNC":
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        if (msg.payload.dmPlayerId) {
          state.isDM = true;
          state.dmToken = sessionStorage.getItem("dmToken");
        }
        break;
      case "INITIATIVE_UPDATED":
      case "PLAYERS_REORDERED":
      case "PLAYER_REMOVED":
      case "TURN_ADVANCED":
      case "TURN_REGRESSED":
      case "SESSION_RESET":
        state.players = msg.payload.players;
        state.turnState = msg.payload.turnState;
        break;
      case "ERROR":
        state.error = msg.payload.message;
        break;
      case "YOU_WERE_REMOVED":
        state.players = [];
        state.sessionId = null;
        state.playerId = null;
        state.playerToken = null;
        state.turnState = null;
        sessionStorage.removeItem("playerToken");
        sessionStorage.removeItem("roomCode");
        break;
      case "HEARTBEAT":
        break;
    }
  }

  wsClient.onMessage(handleMessage);
  wsClient.onStatusChange((s) => {
    connectionStatus = s;
  });

  return {
    get state() {
      return state;
    },
    get connectionStatus() {
      return connectionStatus;
    },
    createSession: () => {
      wsClient.connect("", undefined, true);
      wsClient.send({ type: "CREATE_SESSION", payload: {} });
    },
    joinSession: (roomCode: string, characterName: string, initiative: number) => {
      sessionStorage.setItem("roomCode", roomCode.toUpperCase());
      wsClient.connect(roomCode.toUpperCase());
      wsClient.send({
        type: "JOIN_SESSION",
        payload: { roomCode: roomCode.toUpperCase(), characterName, initiative },
      });
    },
    reconnectSession: (roomCode: string, playerToken: string) => {
      wsClient.connect(roomCode, playerToken);
    },
    recoverSession: (roomCode: string, dmToken: string) => {
      wsClient.connect(roomCode, dmToken, true);
    },
    updateInitiative: (dmToken: string, playerId: string, initiative: number) => {
      wsClient.send({ type: "UPDATE_INITIATIVE", payload: { dmToken, playerId, initiative } });
    },
    reorderPlayers: (dmToken: string, orderedPlayerIds: string[]) => {
      wsClient.send({ type: "REORDER_PLAYERS", payload: { dmToken, orderedPlayerIds } });
    },
    removePlayer: (dmToken: string, playerId: string) => {
      wsClient.send({ type: "REMOVE_PLAYER", payload: { dmToken, playerId } });
    },
    advanceTurn: (dmToken: string) => {
      wsClient.send({ type: "ADVANCE_TURN", payload: { dmToken } });
    },
    previousTurn: (dmToken: string) => {
      wsClient.send({ type: "PREVIOUS_TURN", payload: { dmToken } });
    },
    resetSession: (dmToken: string) => {
      wsClient.send({ type: "RESET_SESSION", payload: { dmToken } });
    },
    clearError: () => {
      state.error = null;
    },
    disconnect: () => {
      wsClient.disconnect();
      sessionStorage.removeItem("dmToken");
      sessionStorage.removeItem("playerToken");
      sessionStorage.removeItem("roomCode");
    },
  };
}
