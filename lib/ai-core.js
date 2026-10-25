/* ==========================================================================
   lib/ai-core.js — shared DeepSeek proxy core
   Consumers:
   • api/ai.js         (Vercel serverless, Node/CJS require)
   • server.js         (local dev server, Node/CJS require)
   • edge-functions/api/ai.js  (Tencent EdgeOne Pages, ESM side-effect import
                                → exposes globalThis.AI_CORE)
   CommonJS core so it runs identically on Node and Vercel without config.
   ========================================================================== */

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MODEL = "deepseek-chat";

const RATE_LIMIT = 12;                   // requests (CV analyse / ask / polish share the budget)
const RATE_WINDOW_MS = 10 * 60 * 1000;   // per 10 min
const MAX_CV_CHARS = 15000;             // ~6-7k tokens, well within DeepSeek context
const MAX_QUESTION_CHARS = 500;
const MAX_POLISH_CHARS = 800;

/* ---- naive in-memory sliding-window rate limiter (per server instance) ---- */
const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((ts) => now - ts < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return false;
}

function corsHeaders(origin, env) {
  const E = env || process.env;
  const allow = String(E.ALLOWED_ORIGINS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  // Origin "null" is sent by pages opened via file:// — listing "null"
  // in ALLOWED_ORIGINS opts in to the local-dev bridge explicitly.
  const allowOrigin = allow.length === 0 ? origin || "*" :
    (allow.includes(origin) ? origin : allow[0]);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const SYSTEM_ASK = `You are the AI assistant of "Fairness by Design", an open-source educational website about fairness in automated AI recruitment, built by students for the module PSP405TC (Ethics, Privacy and Artificial Intelligence in Society).
Answer ONLY questions about: AI/algorithmic hiring, algorithmic bias and fairness metrics (demographic parity, equal opportunity, equalized odds), explainability (SHAP, LIME, counterfactual explanations), privacy and GDPR/PIPL, the Bayesian cumulative-advantage argument, the Matthew Effect (relative age effect in Canadian hockey), Simpson's Paradox (Berkeley 1973 admissions), governance of automated recruitment, and related laws (EU AI Act, NYC Local Law 144, Title VII, Equality Act 2010, PIPL).
Be concise (under 250 words), neutral and educational. If asked anything unrelated, politely refuse and steer back to the topic. Never claim to be a licensed advisor. Reply in the language of the user's question.`;

const SYSTEM_CV = `You are a career-fairness advisor on the educational website "Fairness by Design". A user pastes their CV text (personal identifiers already removed). Your job: predict how an AUTOMATED recruitment screening system (ATS / résumé-scoring model) might misread or unfairly penalise this CV, and give constructive, dignity-preserving advice. You are NOT judging the person; you are auditing how biased screens might misjudge them.
Analyse through these lenses (drawn from published research):
1. Keyword-match gaming — does the CV under-match typical job-description keywords (the tuned-CV vs broad-experience problem)?
2. Proxy variables — any wording that could act as a proxy for protected attributes or trigger unfair down-weighting (e.g. "women's chess club", "motherhood", gap-year, religious/cultural terms)?
3. Non-linear paths — career breaks, self-taught skills, career changes that naive models read as instability.
4. Privacy & format — sensitive data still present, or formatting that parsers fail on.
5. Counterfactual advice — for each issue, a concrete "what would have changed the outcome" suggestion.
Respond in the language indicated by the "lang" field ("zh" → Chinese, "en" → English).
Return ONLY valid JSON in exactly this schema:
{"summary": "2-3 sentence overall assessment", "overall_risk": "low"|"medium"|"high", "findings": [{"area": "lens name", "level": "low"|"medium"|"high", "issue": "what a biased screen might conclude", "advice": "concrete counterfactual suggestion"}]}
Use 4-6 findings. Be honest but never cruel: truthful without harm.`;

const SYSTEM_POLISH = `You are a concise CV-writing coach on the educational website "Fairness by Design".
The user gives ONE small piece of their CV (a career objective, a work/activity line, or hobbies) plus the kind of field it is.
Rewrite it so that:
1. It stays 100% truthful — never invent employers, numbers, dates, skills or achievements the user did not state. You may only rephrase and sharpen what is given.
2. It is concrete and professional: strong verbs, specific scope, and — only if already implied by the input — measurable detail phrased cautiously (e.g. "weekly", "40+ members" only if stated).
3. It is bias-aware: remove or neutralise wording that could act as a proxy for protected attributes (gender, age, family status, religion, health) and avoid unnecessary self-identifying details.
4. It is ONE compact sentence or bullet, at most ~40 words, plain text only — no quotes, no markdown, no explanations.
5. Reply in the same language as the user's input text (do not translate it).
Output ONLY the rewritten text.`;

/**
 * Core handler — framework-agnostic.
 * @param {object} p
 * @param {string} p.method  HTTP method
 * @param {string} p.origin  request Origin header
 * @param {string} p.ip      client IP for rate limiting
 * @param {object|string} p.body  parsed or raw JSON body
 * @returns {Promise<{status:number, headers:object, payload:object}>}
 */
async function handleAI({ method, origin, ip, body, env }) {
  const E = env || process.env;
  const headers = corsHeaders(origin, E);

  if (method === "OPTIONS") return { status: 204, headers, payload: null };
  if (method !== "POST") return { status: 405, headers, payload: { error: "Method not allowed" } };

  const key = E.DEEPSEEK_API_KEY;
  if (!key) return { status: 500, headers, payload: { error: "Server not configured: missing DEEPSEEK_API_KEY" } };

  if (rateLimited(ip)) return { status: 429, headers, payload: { error: "Rate limit exceeded. Try again later." } };

  let data;
  try { data = typeof body === "string" ? JSON.parse(body) : body; }
  catch (e) { return { status: 400, headers, payload: { error: "Invalid JSON" } }; }

  const mode = data.mode === "cv" ? "cv" : data.mode === "polish" ? "polish" : "ask";
  const lang = data.lang === "zh" ? "zh" : "en";
  let userContent, maxTokens, temperature, jsonMode = false;

  if (mode === "cv") {
    const text = String(data.text || "").trim();
    if (text.length < 100 || text.length > MAX_CV_CHARS) {
      return { status: 400, headers, payload: { error: `CV text must be 100–${MAX_CV_CHARS} characters.` } };
    }
    userContent = `lang=${lang}\nCV TEXT (between the markers):\n<<<CV\n${text}\nCV>>>`;
    maxTokens = 1600; temperature = 0.3; jsonMode = true;
  } else if (mode === "polish") {
    const text = String(data.text || "").trim();
    const field = String(data.field || "general");
    if (!text) return { status: 400, headers, payload: { error: "Nothing to polish." } };
    if (text.length > MAX_POLISH_CHARS) {
      return { status: 400, headers, payload: { error: `Text too long (max ${MAX_POLISH_CHARS} characters).` } };
    }
    userContent = `field=${field}\nlang=${lang}\nTEXT:\n<<<\n${text}\n>>>`;
    maxTokens = 220; temperature = 0.5;
  } else {
    const q = String(data.question || "").trim();
    if (!q || q.length > MAX_QUESTION_CHARS) {
      return { status: 400, headers, payload: { error: `Question must be 1–${MAX_QUESTION_CHARS} characters.` } };
    }
    userContent = q;
    maxTokens = 700; temperature = 0.7;
  }

  try {
    const payload = {
      model: MODEL,
      messages: [
        { role: "system", content: mode === "cv" ? SYSTEM_CV : mode === "polish" ? SYSTEM_POLISH : SYSTEM_ASK },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
      temperature,
      stream: false,
    };
    if (jsonMode) payload.response_format = { type: "json_object" };

    const upstream = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
    });

    if (!upstream.ok) {
      // never echo the upstream body — it may contain account details
      return { status: 502, headers, payload: { error: "AI service is temporarily unavailable." } };
    }

    const result = await upstream.json();
    const content = result?.choices?.[0]?.message?.content || "";

    if (mode === "cv") {
      let parsed;
      try { parsed = JSON.parse(content); }
      catch (e) {
        const m = content.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      }
      if (!parsed || !parsed.findings) {
        return { status: 502, headers, payload: { error: "Unexpected AI response. Please retry." } };
      }
      return {
        status: 200, headers,
        payload: { summary: parsed.summary || "", overall_risk: parsed.overall_risk || "medium", findings: parsed.findings || [] },
      };
    }

    if (mode === "polish") {
      const out = content.trim().replace(/^["“”']+|["“”']+$/g, "");
      return { status: 200, headers, payload: { answer: out } };
    }
    return { status: 200, headers, payload: { answer: content } };
  } catch (err) {
    return { status: 502, headers, payload: { error: "AI service is temporarily unavailable." } };
  }
}

/* Dual-format export (both set, so it works under CJS *and* ESM bundlers):
   • Node (require)         → module.exports = { handleAI }
   • Edge ESM (side-effect) → globalThis.AI_CORE = { handleAI }  */
globalThis.AI_CORE = { handleAI };
if (typeof module !== "undefined" && module.exports) {
  module.exports = { handleAI };
}
