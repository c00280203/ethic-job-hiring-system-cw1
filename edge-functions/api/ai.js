/* ==========================================================================
   edge-functions/api/ai.js — Tencent EdgeOne Pages Edge Function
   Route: /api/ai  (same path as the Vercel deployment, so the frontend
   code needs zero changes — whichever host the page loads from, the
   same-origin /api/ai call just works).

   Security design (why the key cannot be stolen from this open-source repo):
   1. The key lives ONLY in the project env var DEEPSEEK_API_KEY (set in the
      EdgeOne Pages console) — never in code.
   2. CORS allow-list (env ALLOWED_ORIGINS) — other sites cannot spend quota.
   3. Per-IP rate limit: 12 requests / 10 minutes (best-effort per isolate).
   4. Hard input-length caps + strict system prompts + capped output tokens.
   5. Error messages never echo the key or upstream internals.
   ========================================================================== */
import "../../lib/ai-core.js"; // exposes globalThis.AI_CORE (see lib header)
const { handleAI } = globalThis.AI_CORE;

async function respond(request, env) {
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("eo-connecting-ip") ||
    "unknown";
  let body = null;
  if (request.method === "POST") {
    try { body = await request.text(); } catch (e) { body = null; }
  }
  const { status, headers, payload } = await handleAI({
    method: request.method,
    origin: request.headers.get("origin") || "",
    ip,
    body,
    env,
  });
  return new Response(payload === null ? null : JSON.stringify(payload), {
    status,
    headers,
  });
}

export async function onRequestPost({ request, env }) {
  return respond(request, env);
}

export async function onRequestOptions({ request, env }) {
  return respond(request, env);
}
