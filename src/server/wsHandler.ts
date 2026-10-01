import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import crypto from "crypto";
import { SessionStore, snapshot, validateInitiative, validateName } from "./sessionStore";
import { ServerError } from "./errors";
import type { ClientMessage, ClientMessageMap, ServerMessage } from "../shared/messages";
import { ErrorCode, WS_CLOSE_REMOVED } from "../shared/constants";
import type { Player, Session } from "../shared/types";

export interface WsClient {
  ws: WebSocket;
  id: string;
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
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw);
      if (!msg || typeof msg !== "object" || typeof msg.payload !== "object" || !msg.payload) {
        throw new Error();
      }
    } catch {
      this.sendError(client.id, ErrorCode.UNKNOWN_ERROR, "Invalid message");
      return;
    }

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
          return this.handleTurnCommand(client, msg.payload, "TURN_ADVANCED");
        case "PREVIOUS_TURN":
          return this.handleTurnCommand(client, msg.payload, "TURN_REGRESSED");
        case "RESET_SESSION":
          return this.handleTurnCommand(client, msg.payload, "SESSION_RESET");
        case "ADD_NPC":
          return this.handleAddNpc(client, msg.payload);
        case "SUBMIT_INITIATIVE":
          return this.handleSubmitInitiative(client, msg.payload);
        case "LEAVE_SESSION":
          return this.handleLeaveSession(client);
        default:
          this.sendError(client.id, ErrorCode.UNKNOWN_ERROR, "Unknown message type");
      }
    } catch (err) {
      if (err instanceof ServerError) {
        this.sendError(client.id, err.code, err.message);
      } else {
        console.error("Unhandled error processing message", err);
        this.sendError(client.id, ErrorCode.UNKNOWN_ERROR, "Something went wrong on the server");
      }
    }
  }

  private handleCreateSession(client: WsClient): void {
    const dmToken = crypto.randomUUID();
    const session = this.store.create(dmToken);
    this.store.bindClient(client.id, session, null);
    this.send(client.id, {
      type: "SESSION_CREATED",
      payload: { sessionId: session.id, roomCode: session.roomCode, dmToken, ...snapshot(session) },
    });
  }

  private handleJoinSession(client: WsClient, payload: ClientMessageMap["JOIN_SESSION"]): void {
    const session = this.findSession(payload.roomCode);
    const playerToken = crypto.randomUUID();
    const player: Player = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      name: validateName(payload.characterName),
      initiative: validateInitiative(payload.initiative),
      isNpc: false,
      clientId: null,
      playerToken,
      createdAt: Date.now(),
    };
    this.store.addPlayer(session, player);
    this.store.bindClient(client.id, session, player.id);
    this.send(client.id, {
      type: "JOIN_ACCEPTED",
      payload: {
        sessionId: session.id,
        roomCode: session.roomCode,
        playerId: player.id,
        playerToken,
        ...snapshot(session),
      },
    });
    this.broadcast(session.id, { type: "PLAYER_JOINED", payload: snapshot(session) }, client.id);
  }

  private handleReconnectSession(
    client: WsClient,
    payload: ClientMessageMap["RECONNECT_SESSION"]
  ): void {
    const session = this.findSession(payload.roomCode);
    const player = session.players.find(
      (p) => p.playerToken !== null && p.playerToken === payload.playerToken
    );
    if (!player) {
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "You're no longer in that session");
    }
    this.store.bindClient(client.id, session, player.id);
    this.sendStateSync(client.id, session, player.id);
  }

  private handleRecoverSession(
    client: WsClient,
    payload: ClientMessageMap["RECOVER_SESSION"]
  ): void {
    const session = this.findSession(payload.roomCode);
    if (session.dmToken !== payload.dmToken) {
      throw new ServerError(ErrorCode.UNAUTHORIZED, "That Admin Key doesn't match this session");
    }
    this.store.bindClient(client.id, session, null);
    this.sendStateSync(client.id, session, null);
  }

  private handleUpdateInitiative(
    client: WsClient,
    payload: ClientMessageMap["UPDATE_INITIATIVE"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.updateInitiative(session, payload.playerId, payload.initiative);
    this.broadcast(session.id, { type: "INITIATIVE_UPDATED", payload: snapshot(session) });
  }

  private handleReorderPlayers(
    client: WsClient,
    payload: ClientMessageMap["REORDER_PLAYERS"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.reorderPlayers(session, payload.orderedPlayerIds);
    this.broadcast(session.id, { type: "PLAYERS_REORDERED", payload: snapshot(session) });
  }

  private handleRemovePlayer(client: WsClient, payload: ClientMessageMap["REMOVE_PLAYER"]): void {
    const session = this.requireDm(client, payload.dmToken);
    const removed = this.store.removePlayer(session, payload.playerId);
    if (removed.clientId) {
      this.send(removed.clientId, { type: "YOU_WERE_REMOVED", payload: {} });
      this.clients.get(removed.clientId)?.ws.close(WS_CLOSE_REMOVED, "Removed from session");
    }
    this.broadcast(session.id, { type: "PLAYER_REMOVED", payload: snapshot(session) });
  }

  private handleAddNpc(client: WsClient, payload: ClientMessageMap["ADD_NPC"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.addNpc(session, validateName(payload.name), validateInitiative(payload.initiative));
    this.broadcast(session.id, { type: "PLAYER_JOINED", payload: snapshot(session) });
  }

  private handleSubmitInitiative(
    client: WsClient,
    payload: ClientMessageMap["SUBMIT_INITIATIVE"]
  ): void {
    const { session, playerId } = this.requirePlayer(client);
    this.store.submitInitiative(session, playerId, payload.initiative);
    this.broadcast(session.id, { type: "INITIATIVE_UPDATED", payload: snapshot(session) });
  }

  /** A player leaving frees their name; the DM leaving just detaches this connection. */
  private handleLeaveSession(client: WsClient): void {
    const binding = this.store.getBinding(client.id);
    const session = binding && this.store.findById(binding.sessionId);
    if (!binding || !session) return;
    if (binding.playerId === null) {
      this.store.unbindClient(client.id);
      return;
    }
    this.store.removePlayer(session, binding.playerId);
    this.broadcast(session.id, { type: "PLAYER_REMOVED", payload: snapshot(session) });
  }

  private handleTurnCommand(
    client: WsClient,
    payload: { dmToken: string },
    reply: "TURN_ADVANCED" | "TURN_REGRESSED" | "SESSION_RESET"
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    if (reply === "TURN_ADVANCED") this.store.advanceTurn(session);
    else if (reply === "TURN_REGRESSED") this.store.previousTurn(session);
    else this.store.reset(session);
    this.broadcast(session.id, { type: reply, payload: snapshot(session) });
  }

  private findSession(roomCode: unknown): Session {
    const session =
      typeof roomCode === "string" ? this.store.findByCode(roomCode.trim().toUpperCase()) : undefined;
    if (!session) {
      throw new ServerError(ErrorCode.SESSION_NOT_FOUND, "No session with that room code");
    }
    return session;
  }

  /** DM commands must come from a connection bound to the session as DM, carrying its token. */
  private requireDm(client: WsClient, dmToken: unknown): Session {
    const binding = this.store.getBinding(client.id);
    const session = binding ? this.store.findById(binding.sessionId) : undefined;
    if (!binding || !session) {
      throw new ServerError(ErrorCode.UNAUTHORIZED, "You're not connected to a session");
    }
    if (binding.playerId !== null || session.dmToken !== dmToken) {
      throw new ServerError(ErrorCode.UNAUTHORIZED, "Only the DM can do that");
    }
    return session;
  }

  private requirePlayer(client: WsClient): { session: Session; playerId: string } {
    const binding = this.store.getBinding(client.id);
    const session = binding ? this.store.findById(binding.sessionId) : undefined;
    if (!binding || !session || binding.playerId === null) {
      throw new ServerError(ErrorCode.UNAUTHORIZED, "You're not a player in a session");
    }
    return { session, playerId: binding.playerId };
  }

  removeClient(clientId: string): void {
    if (!this.clients.has(clientId)) return;
    this.store.unbindClient(clientId);
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

  /** Expired sessions have no connected clients by definition, so eviction is enough. */
  sweepExpiredSessions(): void {
    for (const session of this.store.findExpiredSessions()) {
      this.store.evictSession(session.id);
    }
  }

  getActiveConnections(): number {
    return this.clients.size;
  }

  private sendStateSync(clientId: string, session: Session, playerId: string | null): void {
    this.send(clientId, {
      type: "SESSION_STATE_SYNC",
      payload: {
        sessionId: session.id,
        roomCode: session.roomCode,
        isDM: playerId === null,
        playerId,
        ...snapshot(session),
      },
    });
  }

  private broadcast(sessionId: string, message: ServerMessage, excludeClientId?: string): void {
    for (const id of this.clients.keys()) {
      if (id !== excludeClientId && this.store.getBinding(id)?.sessionId === sessionId) {
        this.send(id, message);
      }
    }
  }

  private sendError(clientId: string, code: ErrorCode, message: string): void {
    this.send(clientId, { type: "ERROR", payload: { code, message } });
  }

  private send(clientId: string, message: ServerMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;
    client.ws.send(JSON.stringify(message));
  }
}
