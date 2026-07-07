import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { SessionStore } from "./sessionStore";
import { WsHandler } from "./wsHandler";
import {
  WS_HEARTBEAT_INTERVAL_MS,
  WS_CLOSE_TIMEOUT_MS,
} from "../shared/constants";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const store = new SessionStore();
const wsHandler = new WsHandler(store);

app.use(express.static("dist"));

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

const heartbeatInterval = setInterval(() => {
  wsHandler.pingAll();
}, WS_HEARTBEAT_INTERVAL_MS);

const sweepInterval = setInterval(() => {
  wsHandler.sweepExpiredSessions();
}, 60_000);

function shutdown(): void {
  clearInterval(heartbeatInterval);
  clearInterval(sweepInterval);
  wss.clients.forEach((ws) => {
    ws.close(1001, "Server shutting down");
  });
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
  setTimeout(() => {
    process.exit(1);
  }, WS_CLOSE_TIMEOUT_MS);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`Server listening on ${HOST}:${PORT}`);
});
