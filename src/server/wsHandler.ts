import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import crypto from "crypto";
import { SessionStore } from "./sessionStore";
import type {
  ClientMessage,
  ClientMessageMap,
  ServerMessage,
} from "../shared/messages";
import {
  ErrorCode,
  MIN_INITIATIVE,
  MAX_INITIATIVE,
  MIN_NAME_LENGTH,
  MAX_NAME_LENGTH,
} from "../shared/constants";
import type { Player } from "../shared/types";

const GEN_ERROR = "UNKNOWN_ERROR" as ErrorCode;

export interface WsClient {
  ws: WebSocket;
  id: string;
  playerId?: string;
  sessionId?: string;
  isDM?: boolean;
  isAlive: boolean;
}

export class WsHandler {
  clients: Map<string, WsClient>;
  private store: SessionStore;

  constructor(store: SessionStore) {
    this.clients = new Map();
    this.store = store;
  }

  handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    const id = crypto.randomUUID();
    const client: WsClient = { ws, id, isAlive: true };
    this.clients.set(id, client);

    ws.on("message", (raw: Buffer) => {
      this.handleMessage(client, raw.toString());
    });

    ws.on("pong", () => {
      client.isAlive = true;
    });

    ws.on("close", () => {
      this.removeClient(id);
    });

    ws.on("error", () => {
      this.removeClient(id);
    });
  }

  private handleMessage(client: WsClient, raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: GEN_ERROR, message: "Invalid JSON" },
      });
      return;
    }

    const msg = parsed as ClientMessage;

    try {
      switch (msg.type) {
        case "CREATE_SESSION":
          return this.handleCreateSession(client);
        case "JOIN_SESSION":
          return this.handleJoinSession(client, msg.payload);
        case "RECONNECT_SESSION":
          return this.handleReconnectSession(client, msg.payload);
        case "RECOVER_SESSION":
          return this.handleRecoverSession(client, msg.payload);
        case "UPDATE_INITIATIVE":
          return this.handleUpdateInitiative(client, msg.payload);
        case "REORDER_PLAYERS":
          return this.handleReorderPlayers(client, msg.payload);
        case "REMOVE_PLAYER":
          return this.handleRemovePlayer(client, msg.payload);
        case "ADVANCE_TURN":
          return this.handleAdvanceTurn(client, msg.payload);
        case "PREVIOUS_TURN":
          return this.handlePreviousTurn(client, msg.payload);
        case "RESET_SESSION":
          return this.handleResetSession(client, msg.payload);
        default:
          this.sendToClient(client.id, {
            type: "ERROR",
            payload: { code: GEN_ERROR, message: "Unknown message type" },
          });
      }
    } catch (err) {
      const code =
        err instanceof Error &&
        Object.values(ErrorCode).includes(err.message as ErrorCode)
          ? (err.message as ErrorCode)
          : GEN_ERROR;
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code,
          message: err instanceof Error ? err.message : "Server error",
        },
      });
    }
  }

  private handleCreateSession(client: WsClient): void {
    const dmToken = crypto.randomUUID();
    const dmPlayerId = crypto.randomUUID();
    const session = this.store.create(dmToken, dmPlayerId);
    this.store.registerClient(client.id, session.id, dmPlayerId);
    client.sessionId = session.id;
    client.playerId = dmPlayerId;
    client.isDM = true;
    this.sendToClient(client.id, {
      type: "SESSION_CREATED",
      payload: {
        roomCode: session.roomCode,
        dmToken,
        sessionId: session.id,
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handleJoinSession(
    client: WsClient,
    payload: ClientMessageMap["JOIN_SESSION"]
  ): void {
    const { roomCode, characterName, initiative } = payload;
    if (!roomCode || typeof roomCode !== "string") {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: GEN_ERROR, message: "Missing roomCode" },
      });
      return;
    }
    const session = this.store.findByCode(roomCode.toUpperCase());
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    const name = (characterName || "").trim();
    if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.INVALID_NAME, message: "Invalid name length" },
      });
      return;
    }
    const init =
      typeof initiative === "number" ? initiative : Number(initiative);
    if (isNaN(init) || init < MIN_INITIATIVE || init > MAX_INITIATIVE) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.INVALID_INITIATIVE,
          message: "Initiative out of range",
        },
      });
      return;
    }
    const playerToken = crypto.randomUUID();
    const player: Player = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      name,
      initiative: init,
      sortOrder: 0,
      isDM: false,
      clientId: null,
      playerToken,
      createdAt: Date.now(),
    };
    try {
      this.store.addPlayer(session, player);
    } catch (err) {
      const code =
        err instanceof Error &&
        Object.values(ErrorCode).includes(err.message as ErrorCode)
          ? (err.message as ErrorCode)
          : GEN_ERROR;
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code,
          message: err instanceof Error ? err.message : "Failed to join",
        },
      });
      return;
    }
    this.store.registerClient(client.id, session.id, player.id);
    client.sessionId = session.id;
    client.playerId = player.id;
    client.isDM = false;
    this.sendToClient(client.id, {
      type: "JOIN_ACCEPTED",
      payload: {
        playerId: player.id,
        playerToken,
        players: session.players,
        turnState: session.turnState,
      },
    });
    this.broadcastToSession(
      session.id,
      {
        type: "SESSION_STATE_SYNC",
        payload: {
          players: session.players,
          turnState: session.turnState,
        },
      },
      client.id
    );
  }

  private handleReconnectSession(
    client: WsClient,
    payload: ClientMessageMap["RECONNECT_SESSION"]
  ): void {
    const { roomCode, playerToken } = payload;
    const session = this.store.findByCode(roomCode.toUpperCase());
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    const player = session.players.find((p) => p.playerToken === playerToken);
    if (!player) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.PLAYER_NOT_FOUND,
          message: "Player not found",
        },
      });
      return;
    }
    this.store.registerClient(client.id, session.id, player.id);
    client.sessionId = session.id;
    client.playerId = player.id;
    client.isDM = player.isDM;
    this.sendToClient(client.id, {
      type: "SESSION_STATE_SYNC",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handleRecoverSession(
    client: WsClient,
    payload: ClientMessageMap["RECOVER_SESSION"]
  ): void {
    const { roomCode, dmToken } = payload;
    const session = this.store.findByCode(roomCode.toUpperCase());
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.registerClient(client.id, session.id, session.dmPlayerId);
    client.sessionId = session.id;
    client.playerId = session.dmPlayerId;
    client.isDM = true;
    this.sendToClient(client.id, {
      type: "SESSION_STATE_SYNC",
      payload: {
        players: session.players,
        turnState: session.turnState,
        dmPlayerId: session.dmPlayerId,
      },
    });
  }

  private handleUpdateInitiative(
    client: WsClient,
    payload: ClientMessageMap["UPDATE_INITIATIVE"]
  ): void {
    const { dmToken, playerId, initiative } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.updateInitiative(session, playerId, initiative);
    this.broadcastToSession(session.id, {
      type: "INITIATIVE_UPDATED",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handleReorderPlayers(
    client: WsClient,
    payload: ClientMessageMap["REORDER_PLAYERS"]
  ): void {
    const { dmToken, orderedPlayerIds } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.reorderPlayers(session, orderedPlayerIds);
    this.broadcastToSession(session.id, {
      type: "PLAYERS_REORDERED",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handleRemovePlayer(
    client: WsClient,
    payload: ClientMessageMap["REMOVE_PLAYER"]
  ): void {
    const { dmToken, playerId } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    const removedPlayer = session.players.find((p) => p.id === playerId);
    if (!removedPlayer) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.PLAYER_NOT_FOUND,
          message: "Player not found",
        },
      });
      return;
    }
    const removedClientId = removedPlayer.clientId;
    this.store.removePlayer(session, playerId);
    if (removedClientId) {
      const removedClient = this.clients.get(removedClientId);
      if (removedClient && removedClient.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(removedClientId, {
          type: "YOU_WERE_REMOVED",
          payload: {},
        });
        removedClient.ws.close(1000, "Removed from session");
      }
      this.removeClient(removedClientId);
    }
    this.broadcastToSession(
      session.id,
      {
        type: "PLAYER_REMOVED",
        payload: {
          players: session.players,
          turnState: session.turnState,
        },
      },
      removedClientId ?? undefined
    );
  }

  private handleAdvanceTurn(
    client: WsClient,
    payload: ClientMessageMap["ADVANCE_TURN"]
  ): void {
    const { dmToken } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.advanceTurn(session);
    this.broadcastToSession(session.id, {
      type: "TURN_ADVANCED",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handlePreviousTurn(
    client: WsClient,
    payload: ClientMessageMap["PREVIOUS_TURN"]
  ): void {
    const { dmToken } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.previousTurn(session);
    this.broadcastToSession(session.id, {
      type: "TURN_REGRESSED",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  private handleResetSession(
    client: WsClient,
    payload: ClientMessageMap["RESET_SESSION"]
  ): void {
    const { dmToken } = payload;
    if (!client.sessionId) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Not in a session" },
      });
      return;
    }
    const session = this.store.findById(client.sessionId);
    if (!session) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: "Session not found",
        },
      });
      return;
    }
    if (session.dmToken !== dmToken) {
      this.sendToClient(client.id, {
        type: "ERROR",
        payload: { code: ErrorCode.UNAUTHORIZED, message: "Invalid DM token" },
      });
      return;
    }
    this.store.reset(session);
    this.broadcastToSession(session.id, {
      type: "SESSION_RESET",
      payload: {
        players: session.players,
        turnState: session.turnState,
      },
    });
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    if (client.sessionId) {
      this.store.disconnectClient(clientId);
    }
    this.clients.delete(clientId);
  }

  pingAll(): void {
    for (const [id, client] of this.clients) {
      if (!client.isAlive) {
        client.ws.terminate();
        this.removeClient(id);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }

  sweepExpiredSessions(): void {
    const expired = this.store.findExpiredSessions();
    for (const session of expired) {
      for (const player of session.players) {
        if (player.clientId) {
          const client = this.clients.get(player.clientId);
          if (client) {
            client.ws.close(1000, "Session expired");
            this.removeClient(player.clientId);
          }
        }
      }
      this.store.evictSession(session.id);
    }
  }

  getActiveConnections(): number {
    return this.clients.size;
  }

  private broadcastToSession(
    sessionId: string,
    message: ServerMessage,
    excludeClientId?: string
  ): void {
    for (const [id, client] of this.clients) {
      if (id === excludeClientId) continue;
      if (
        client.sessionId === sessionId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        this.sendToClient(id, message);
      }
    }
  }

  private sendToClient(clientId: string, message: ServerMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    client.ws.send(JSON.stringify(message));
  }
}
