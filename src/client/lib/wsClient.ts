import type { ClientMessage, ServerMessage } from "@shared/messages";
import { ErrorCode } from "@shared/constants";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;
type OpenHandler = () => void;

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/** Close codes 4000-4999 are the server telling us not to come back (e.g. removed by the DM). */
function isTerminalClose(code: number): boolean {
  return code >= 4000 && code < 5000;
}

/** One persistent connection to /ws that reconnects with backoff after unexpected drops. */
export class WsClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectDelay = INITIAL_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();
  private openHandlers: Set<OpenHandler> = new Set();
  private _status: ConnectionStatus = "disconnected";
  private intentionalClose = false;
  private messageQueue: string[] = [];

  /** Opens the connection now if there isn't one open or opening. Safe to call repeatedly. */
  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.intentionalClose = false;
    this.clearReconnectTimer();
    this.reconnectAttempts = 0;
    this.reconnectDelay = INITIAL_RECONNECT_DELAY;
    this.setStatus("connecting");
    this.open();
  }

  private open(): void {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    // Every handler ignores events from a socket that has since been replaced.
    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.reconnectAttempts = 0;
      this.reconnectDelay = INITIAL_RECONNECT_DELAY;
      this.setStatus("connected");
      // Open handlers (session re-binding) must reach the server before queued commands.
      this.openHandlers.forEach((h) => h());
      this.flushQueue();
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.handleMessage(event);
    };

    ws.onclose = (event) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.intentionalClose || isTerminalClose(event.code)) {
        this.messageQueue = [];
        this.setStatus("disconnected");
      } else {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setStatus("disconnected");
      this.emit({
        type: "ERROR",
        payload: {
          code: ErrorCode.UNKNOWN_ERROR,
          message: "Could not connect to server. Please check your connection and try again.",
        },
      });
      return;
    }

    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.open();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.messageQueue.shift()!);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.statusHandlers.forEach((h) => h(status));
  }

  /** Sends now if open; otherwise queues the message and makes sure a connection is on its way. */
  send(msg: ClientMessage): void {
    const data = JSON.stringify(msg);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
      return;
    }
    this.messageQueue.push(data);
    if (this._status === "disconnected") this.connect();
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /** Runs on every successful (re)connect, before queued messages are flushed. */
  onOpen(handler: OpenHandler): () => void {
    this.openHandlers.add(handler);
    return () => this.openHandlers.delete(handler);
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.messageQueue = [];
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.setStatus("disconnected");
  }

  get status(): ConnectionStatus {
    return this._status;
  }

  private emit(msg: ServerMessage): void {
    this.messageHandlers.forEach((h) => h(msg));
  }

  private handleMessage(event: MessageEvent): void {
    let data: ServerMessage;
    try {
      data = JSON.parse(event.data) as ServerMessage;
    } catch {
      return; // Ignore malformed messages
    }
    this.emit(data);
  }
}
