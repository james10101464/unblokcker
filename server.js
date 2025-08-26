const express = require("express");
const { createProxyServer } = require("http-proxy");
const http = require("http");

const app = express();

// Create proxy with WebSocket support
const proxy = createProxyServer({
  changeOrigin: true,
  ws: true,
  secure: false, // allow self-signed SSL if needed
});

// Default target (Discord login page)
const DEFAULT_TARGET = "https://discord.com";

// Rewrite response headers to avoid CSP / frame issues
proxy.on("proxyRes", (proxyRes, req, res) => {
  // Remove security headers that break embedding
  delete proxyRes.headers["content-security-policy"];
  delete proxyRes.headers["x-frame-options"];
  delete proxyRes.headers["cross-origin-embedder-policy"];
  delete proxyRes.headers["cross-origin-opener-policy"];
  delete proxyRes.headers["cross-origin-resource-policy"];

  // Rewrite Location redirects to stay inside proxy
  if (proxyRes.headers["location"]) {
    const loc = proxyRes.headers["location"];
    proxyRes.headers["location"] = `/?target=${encodeURIComponent(loc)}`;
  }
});

// Proxy HTTP requests
app.use((req, res) => {
  const target = req.query.target || DEFAULT_TARGET;
  try {
    proxy.web(req, res, { target }, (err) => {
      console.error("Proxy error:", err);
      res.status(500).send("Proxy error: " + err.message);
    });
  } catch (err) {
    res.status(500).send("Invalid target URL");
  }
});

// Create server with WebSocket support
const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
  const target = DEFAULT_TARGET;
  proxy.ws(req, socket, head, { target });
});

// Use Cyclic/Railway PORT or 3000 locally
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Proxy server running at http://localhost:${PORT}`);
});
