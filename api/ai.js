/* ==========================================================================
   api/ai.js — Vercel Serverless Function (thin wrapper around lib/ai-core)
   Security design (why the key cannot be stolen from this open-source repo):
   1. The key lives ONLY in the platform env var DEEPSEEK_API_KEY — never in code.
   2. CORS allow-list (env ALLOWED_ORIGINS) — other sites cannot spend your quota.
   3. Per-IP rate limit: 8 requests / 10 minutes.
   4. Hard input-length caps + strict system prompts + capped output tokens.
   5. Error messages never echo the key or upstream internals.
   ========================================================================== */
const { handleAI } = require("../lib/ai-core.js");

module.exports = async function handler(req, res) {
  const { status, headers, payload } = await handleAI({
    method: req.method,
    origin: req.headers.origin,
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        (req.socket && req.socket.remoteAddress) || "unknown",
    body: req.body,
  });

  const out = { ...headers };
  if (payload !== null) out["Content-Type"] = "application/json";
  res.writeHead(status, out);
  res.end(payload === null ? "" : JSON.stringify(payload));
};

module.exports.config = { runtime: "nodejs20.x" };
