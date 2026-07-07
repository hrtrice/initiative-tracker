import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { SessionStore } from "../../../src/server/sessionStore";
import { WsHandler } from "../../../src/server/wsHandler";

describe("Express Server", () => {
  let server: http.Server;
  let port: number;
  let store: SessionStore;
  let wsHandler: WsHandler;

  beforeAll(() => {
    const app = express();
    server = createServer(app);
    const wss = new WebSocketServer({ server });
    store = new SessionStore();
    wsHandler = new WsHandler(store);

    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        activeSessions: store.getActiveCount(),
        activeConnections: wsHandler.getActiveConnections(),
      });
    });

    app.get("/api/session/:roomCode/exists", (req, res) => {
      const { roomCode } = req.params;
      if (!roomCode) {
        res.status(400).json({ exists: false });
        return;
      }
      const session = store.findByCode(roomCode.toUpperCase());
      res.json({ exists: !!session });
    });

    wss.on("connection", (ws, req) => {
      wsHandler.handleConnection(ws, req);
    });

    port = 0;
    server.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        port = addr.port;
      }
    });
  });

  afterAll(() => {
    server.close();
  });

  it("/health returns status ok with zero counts", async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.activeSessions).toBe(0);
    expect(body.activeConnections).toBe(0);
  });

  it("/health returns accurate counts after creating session", async () => {
    store.create("dm-token", "dm-player-id");
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    expect(body.activeSessions).toBe(1);
  });

  it("/api/session/:roomCode/exists returns true for valid session", async () => {
    const session = store.create("dm-token", "dm-player-id");
    const res = await fetch(
      `http://localhost:${port}/api/session/${session.roomCode}/exists`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(true);
  });

  it("/api/session/:roomCode/exists returns false for unknown code", async () => {
    const res = await fetch(
      `http://localhost:${port}/api/session/ZZZZ/exists`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.exists).toBe(false);
  });
});
