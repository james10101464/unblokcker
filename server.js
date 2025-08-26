import express from "express";
import fetch from "node-fetch";
import http from "http";
import { WebSocketServer } from "ws";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve frontend files from public folder
app.use(express.static(path.join(__dirname, "public")));

// Proxy route
app.use("/proxy/", async (req, res) => {
  let rawUrl = decodeURIComponent(req.url.slice(1 + "proxy/".length));
  let targetUrl;

  try {
    // Try to parse as full URL
    targetUrl = new URL(rawUrl);
  } catch {
    // If it's relative (like /cdn/image.png), prepend https://discord.com
    targetUrl = new URL(rawUrl, "https://discord.com");
  }

  try {
    const r = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
      body: req.method === "GET" ? undefined : req,
    });

    const headers = {};
    r.headers.forEach((v, k) => {
      if (k === "set-cookie") {
        headers[k] = v.replace(/; *Domain=[^;]+/gi, "").replace(/; *Path=[^;]+/gi, "");
      } else if (k === "location") {
        headers[k] = "/proxy/" + encodeURIComponent(v);
      } else {
        headers[k] = v;
      }
    });

    let body;
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("text/html") || ct.includes("application/javascript") || ct.includes("text/css")) {
      body = (await r.text()).replace(/(href|src|action)=["'](\/[^"']+)/g, (match, attr, url) => {
        // Rewrite relative paths
        return `${attr}="/proxy/${encodeURIComponent(url)}"`;
      }).replace(/https?:\/\/[^"'\s]+/g, (url) => {
        // Rewrite absolute URLs
        return "/proxy/" + encodeURIComponent(url);
      });
    } else {
      body = Buffer.from(await r.arrayBuffer());
    }

    res.writeHead(r.status, headers);
    res.end(body);
  } catch (err) {
    res.status(500).send("Proxy error: " + err.message);
  }
});

// WebSocket passthrough
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  console.log("🔌 WebSocket connected to proxy");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Mini rewrite proxy running at http://localhost:${PORT}`)
);
