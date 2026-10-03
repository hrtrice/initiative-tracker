import { WebSocket } from "ws";
import type { IncomingMessage } from "http";
import crypto from "crypto";
import { SessionStore, snapshot, validateInitiative, validateName } from "./sessionStore";
import { ServerError } from "./errors";
import { validateOptionalMaxHp } from "./health";
import type { ClientMessage, ClientMessageMap, ServerMessage } from "../shared/messages";
import { ErrorCode, WS_CLOSE_REMOVED } from "../shared/constants";
import type { Player, Session } from "../shared/types";

/** Broadcasts whose payload is exactly a session snapshot. */
type SnapshotMessageType =
  | "PLAYER_JOINED"
  | "INITIATIVE_UPDATED"
  | "PLAYERS_REORDERED"
  | "PLAYER_REMOVED"
  | "TURN_ADVANCED"
  | "TURN_REGRESSED"
  | "SESSION_RESET"
  | "FIELDS_UPDATED"
  | "HEALTH_UPDATED";

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
        case "ADD_FIELD":
          return this.handleAddField(client, msg.payload);
        case "UPDATE_FIELD":
          return this.handleUpdateField(client, msg.payload);
        case "REMOVE_FIELD":
          return this.handleRemoveField(client, msg.payload);
        case "SET_FIELD_VALUE":
          return this.handleSetFieldValue(client, msg.payload);
        case "SET_MY_FIELD":
          return this.handleSetMyField(client, msg.payload);
        case "SET_HEALTH":
          return this.handleSetHealth(client, msg.payload);
        case "SET_MY_HEALTH":
          return this.handleSetMyHealth(client, msg.payload);
        case "SET_HEALTH_VISIBILITY":
          return this.handleSetHealthVisibility(client, msg.payload);
        case "UPDATE_HEALTH_SETTINGS":
          return this.handleUpdateHealthSettings(client, msg.payload);
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
      payload: { sessionId: session.id, roomCode: session.roomCode, dmToken, ...snapshot(session, true) },
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
      fields: {},
      health: null,
      healthVisibility: "both",
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
        ...snapshot(session, false),
      },
    });
    this.broadcastSnapshot(session, "PLAYER_JOINED", client.id);
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
      throw new ServerError(ErrorCode.PLAYER_NOT_FOUND, "You're no longer at that table");
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
      throw new ServerError(ErrorCode.UNAUTHORIZED, "That Master Key doesn't match this table");
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
    this.broadcastSnapshot(session, "INITIATIVE_UPDATED");
  }

  private handleReorderPlayers(
    client: WsClient,
    payload: ClientMessageMap["REORDER_PLAYERS"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.reorderPlayers(session, payload.orderedPlayerIds);
    this.broadcastSnapshot(session, "PLAYERS_REORDERED");
  }

  private handleRemovePlayer(client: WsClient, payload: ClientMessageMap["REMOVE_PLAYER"]): void {
    const session = this.requireDm(client, payload.dmToken);
    const removed = this.store.removePlayer(session, payload.playerId);
    if (removed.clientId) {
      this.send(removed.clientId, { type: "YOU_WERE_REMOVED", payload: {} });
      this.clients.get(removed.clientId)?.ws.close(WS_CLOSE_REMOVED, "Removed from session");
    }
    this.broadcastSnapshot(session, "PLAYER_REMOVED");
  }

  private handleAddNpc(client: WsClient, payload: ClientMessageMap["ADD_NPC"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.addNpc(
      session,
      validateName(payload.name),
      validateInitiative(payload.initiative),
      validateOptionalMaxHp(payload.maxHp)
    );
    this.broadcastSnapshot(session, "PLAYER_JOINED");
  }

  private handleSubmitInitiative(
    client: WsClient,
    payload: ClientMessageMap["SUBMIT_INITIATIVE"]
  ): void {
    const { session, playerId } = this.requirePlayer(client);
    this.store.submitInitiative(session, playerId, payload.initiative);
    this.broadcastSnapshot(session, "INITIATIVE_UPDATED");
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
    this.broadcastSnapshot(session, "PLAYER_REMOVED");
  }

  private handleAddField(client: WsClient, payload: ClientMessageMap["ADD_FIELD"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.addField(session, payload.name, payload.type);
    this.broadcastSnapshot(session, "FIELDS_UPDATED");
  }

  private handleUpdateField(client: WsClient, payload: ClientMessageMap["UPDATE_FIELD"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.updateField(session, payload.fieldId, { name: payload.name, type: payload.type });
    this.broadcastSnapshot(session, "FIELDS_UPDATED");
  }

  private handleRemoveField(client: WsClient, payload: ClientMessageMap["REMOVE_FIELD"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.removeField(session, payload.fieldId);
    this.broadcastSnapshot(session, "FIELDS_UPDATED");
  }

  /** The DM can set anyone's values, NPCs included. */
  private handleSetFieldValue(
    client: WsClient,
    payload: ClientMessageMap["SET_FIELD_VALUE"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.setFieldValue(session, payload.playerId, payload.fieldId, payload.value);
    this.broadcastSnapshot(session, "FIELDS_UPDATED");
  }

  /** Players can only set values on their own character. */
  private handleSetMyField(client: WsClient, payload: ClientMessageMap["SET_MY_FIELD"]): void {
    const { session, playerId } = this.requirePlayer(client);
    this.store.setFieldValue(session, playerId, payload.fieldId, payload.value);
    this.broadcastSnapshot(session, "FIELDS_UPDATED");
  }

  private handleSetHealth(client: WsClient, payload: ClientMessageMap["SET_HEALTH"]): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.changeHealth(session, payload.playerId, payload.change);
    this.broadcastSnapshot(session, "HEALTH_UPDATED");
  }

  /** Players track their own character's health, but not while the DM has it switched off. */
  private handleSetMyHealth(client: WsClient, payload: ClientMessageMap["SET_MY_HEALTH"]): void {
    const { session, playerId } = this.requirePlayer(client);
    if (!session.healthSettings.enabled) {
      throw new ServerError(ErrorCode.HEALTH_DISABLED, "The DM has health tracking switched off");
    }
    this.store.changeHealth(session, playerId, payload.change);
    this.broadcastSnapshot(session, "HEALTH_UPDATED");
  }

  private handleSetHealthVisibility(
    client: WsClient,
    payload: ClientMessageMap["SET_HEALTH_VISIBILITY"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.setHealthVisibility(session, payload.playerId, payload.visibility);
    this.broadcastSnapshot(session, "HEALTH_UPDATED");
  }

  private handleUpdateHealthSettings(
    client: WsClient,
    payload: ClientMessageMap["UPDATE_HEALTH_SETTINGS"]
  ): void {
    const session = this.requireDm(client, payload.dmToken);
    this.store.updateHealthSettings(session, payload);
    this.broadcastSnapshot(session, "HEALTH_UPDATED");
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
    this.broadcastSnapshot(session, reply);
  }

  private findSession(roomCode: unknown): Session {
    const session =
      typeof roomCode === "string" ? this.store.findByCode(roomCode.trim().toUpperCase()) : undefined;
    if (!session) {
      throw new ServerError(ErrorCode.SESSION_NOT_FOUND, "No table with that number");
    }
    return session;
  }

  /** DM commands must come from a connection bound to the session as DM, carrying its token. */
  private requireDm(client: WsClient, dmToken: unknown): Session {
    const binding = this.store.getBinding(client.id);
    const session = binding ? this.store.findById(binding.sessionId) : undefined;
    if (!binding || !session) {
      throw new ServerError(ErrorCode.UNAUTHORIZED, "You're not seated at a table");
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
      throw new ServerError(ErrorCode.UNAUTHORIZED, "You're not a player at a table");
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
        ...snapshot(session, playerId === null),
      },
    });
  }

  /**
   * Sends every connection in the session its own view of the state: the DM sees
   * NPC custom field values, players don't.
   */
  private broadcastSnapshot(
    session: Session,
    type: SnapshotMessageType,
    excludeClientId?: string
  ): void {
    for (const id of this.clients.keys()) {
      const binding = this.store.getBinding(id);
      if (id === excludeClientId || binding?.sessionId !== session.id) continue;
      this.send(id, { type, payload: snapshot(session, binding.playerId === null) } as ServerMessage);
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
