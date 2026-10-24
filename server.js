/* ==========================================================================
   server.js — local development server
   Serves the static site AND the /api/ai proxy on one port, so you can test
   the full AI flow locally before deploying to Vercel.

   Usage:
     1. Create a .env file next to this script:
          DEEPSEEK_API_KEY=sk-...
          ALLOWED_ORIGINS=http://localhost:3000
     2. node server.js
     3. Open http://localhost:3000

   .env is git-ignored — your key never enters the repository.
   ========================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleAI } = require("./lib/ai-core.js");

/* ---- minimal .env loader ---- */
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function send(res, status, headers, payload) {
  const out = { ...headers };
  if (payload !== null && !Buffer.isBuffer(payload)) {
    out["Content-Type"] = out["Content-Type"] || "application/json; charset=utf-8";
  }
  res.writeHead(status, out);
  // Buffers (static file contents) go out raw — only JSON objects get stringified
  res.end(payload === null ? "" : (typeof payload === "string" || Buffer.isBuffer(payload)) ? payload : JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  /* ---- AI proxy ---- */
  if (url.pathname === "/api/ai") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      const ip = req.socket && req.socket.remoteAddress || "unknown";
      const { status, headers, payload } = await handleAI({
        method: req.method, origin: req.headers.origin, ip, body,
      });
      send(res, status, headers, payload);
    });
    return;
  }

  /* ---- static files ---- */
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, {}, { error: "Method not allowed" });
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) return send(res, 403, {}, { error: "Forbidden" });
  if (url.pathname === "/" || url.pathname === "") file = path.join(ROOT, "index.html");

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, {}, { error: "Not found" });
    send(res, 200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" }, data);
  });
});

server.listen(PORT, () => {
  console.log(`✔ Fairness by Design (dev) → http://localhost:${PORT}`);
  console.log(process.env.DEEPSEEK_API_KEY
    ? "✔ DEEPSEEK_API_KEY loaded from .env — AI features active."
    : "⚠ No DEEPSEEK_API_KEY found — create a .env file to enable AI features.");
});
