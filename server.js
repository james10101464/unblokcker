// server.js
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { WebSocketServer } from "ws";
import http from "http";

const app = express();

// Target: put your backend (like discord) here
const target = "https://discord.com"; 

// Proxy middleware with WebSocket support
app.use(
  "/",
  createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    onProxyReq: (proxyReq, req, res) => {
      // Prevent forced redirects to /app
      if (req.url === "/app") {
        proxyReq.path = "/";
      }
    },
  })
);

// Create server with WebSocket upgrade
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket connected");
  ws.on("message", (msg) => {
    console.log("📩 Message:", msg.toString());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Proxy with WebSocket support running at http://localhost:${PORT}`)
);
