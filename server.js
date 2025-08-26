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

// Encode target URLs like: /proxy/https://example.com/path
app.use("/proxy/", async (req, res) => {
  const targetUrl = decodeURIComponent(req.url.slice(1 + "proxy/".length));

  try {
    const r = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: new URL(targetUrl).host },
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
      body = (await r.text()).replace(/https?:\/\/[^"'\s]+/g, (url) => {
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
