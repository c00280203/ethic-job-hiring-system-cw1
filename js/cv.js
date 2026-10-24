/* ==========================================================================
   cv.js — CV fairness checker + Ask-the-AI
   - Files are parsed LOCALLY in the browser (pdf.js / mammoth.js, lazy-loaded)
   - Only extracted TEXT is sent to our serverless proxy (/api/ai)
   - Nothing is ever stored server-side
   ========================================================================== */
(function () {
  "use strict";

  /* If the frontend is hosted on GitHub Pages and the API on Vercel,
     set: <script>window.FBD_API_BASE = "https://your-app.vercel.app"</script>
     Same-origin deployment (frontend + api on Vercel) needs nothing.
     Opening index.html directly via file://? We auto-bridge to a local
     dev server (node server.js) on http://localhost:3000 if one runs.  */
  const API_BASE = (window.FBD_API_BASE || "").replace(/\/$/, "");
  let API_URL = API_BASE + "/api/ai";
  let devBridge = false;   // true once we've found a local dev server
  let devProbed = false;   // true after the probe settles (ok or not)

  if (!API_BASE && location.protocol === "file:") {
    const LOCAL = "http://localhost:3000";
    fetch(LOCAL + "/api/ai", { method: "OPTIONS", mode: "cors" })
      .then((r) => {
        if (r.ok || r.status === 204) { API_URL = LOCAL + "/api/ai"; devBridge = true; }
      })
      .catch(() => {})
      .finally(() => { devProbed = true; });
  } else {
    devProbed = true;
  }

  const $ = (id) => document.getElementById(id);
  const t = (k, vars) => {
    const lang = window.getLang ? window.getLang() : "en";
    let s = (window.I18N[lang] || window.I18N.en)[k] || k;
    if (vars) Object.keys(vars).forEach((v) => (s = s.replace("{" + v + "}", vars[v])));
    return s;
  };

  /* ---------------- tabs ---------------- */
  const tabCheck = $("tabCheck"), tabAsk = $("tabAsk");
  const paneCheck = $("paneCheck"), paneAsk = $("paneAsk");
  function setTab(ask) {
    tabAsk.classList.toggle("active", ask);
    tabCheck.classList.toggle("active", !ask);
    paneAsk.hidden = !ask;
    paneCheck.hidden = ask;
  }
  tabCheck.addEventListener("click", () => setTab(false));
  tabAsk.addEventListener("click", () => setTab(true));

  /* ---------------- upload zone ---------------- */
  const zone = $("uploadZone"), fileInput = $("cvFile"), cvText = $("cvText");
  const privacyOk = $("privacyOk"), submitBtn = $("cvSubmit"), statusEl = $("cvStatus");
  const counterEl = $("charCounter");

  const MAX_CV_CHARS = 15000; // keep in sync with lib/ai-core.js

  function updateCounter() {
    if (!counterEl) return;
    const n = cvText.value.length;
    counterEl.textContent = t("cv.charCount", { n: n, max: MAX_CV_CHARS });
    counterEl.classList.toggle("over", n > MAX_CV_CHARS);
  }

  function updateSubmit() {
    const hasText = (cvText.value.trim().length > 0) || (fileInput.files && fileInput.files.length > 0);
    submitBtn.disabled = !(hasText && privacyOk.checked);
  }
  privacyOk.addEventListener("change", updateSubmit);
  cvText.addEventListener("input", () => { updateSubmit(); updateCounter(); });

  zone.addEventListener("click", () => fileInput.click());
  zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });
  ["dragover", "dragenter"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("dragover"); }));
  zone.addEventListener("drop", (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      handleFile(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  function showStatus(msg, isErr) {
    statusEl.hidden = false;
    statusEl.textContent = msg;
    statusEl.classList.toggle("error", !!isErr);
  }
  function hideStatus() { statusEl.hidden = true; }

  /* ---------------- lazy loaders for parsers ----------------
     Local vendor/ copies first (works offline + on file://),
     CDN as fallback if the local file is missing.            */
  function loadScript(src) {
    return new Promise((res, rej) => {
      if (document.querySelector('script[src="' + src + '"]')) return res();
      const s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const SOURCES = {
    pdfjsLib: ["vendor/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"],
    pdfjsWorker: ["vendor/pdf.worker.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"],
    mammoth: ["vendor/mammoth.browser.min.js", "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js"],
  };
  async function loadAny(key) {
    for (const src of SOURCES[key]) {
      try { await loadScript(src); return src; } catch (e) { /* try next */ }
    }
    throw new Error("cannot load " + key);
  }

  async function parsePDF(file) {
    const libSrc = await loadAny("pdfjsLib");
    // keep worker same-origin with the lib that actually loaded
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      libSrc.includes("vendor/") ? SOURCES.pdfjsWorker[0] : SOURCES.pdfjsWorker[1];
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const c = await page.getTextContent();
      // preserve line breaks so section structure survives extraction
      text += c.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
  }
  async function parseDOCX(file) {
    await loadAny("mammoth");
    const buf = await file.arrayBuffer();
    const r = await window.mammoth.extractRawText({ arrayBuffer: buf });
    return r.value;
  }
  async function handleFile(file) {
    hideStatus();
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    try {
      let text = "";
      if (ext === "pdf") text = await parsePDF(file);
      else if (ext === "docx") text = await parseDOCX(file);
      else if (["txt", "md", "markdown"].includes(ext)) text = await file.text();
      else { showStatus(t("cv.errFile"), true); return; }
      cvText.value = text.trim();
      updateSubmit();
      updateCounter();
      showStatus(t("cv.parseOk", { n: text.trim().length, name: file.name }), false);
    } catch (err) {
      showStatus(t("cv.errFile"), true);
    }
  }

  /* ---------------- submit CV ---------------- */
  const resultEl = $("cvResult"), findingsEl = $("findings"),
        riskBadge = $("riskBadge"), summaryEl = $("resultSummary");

  submitBtn.addEventListener("click", async () => {
    const text = cvText.value.trim();
    if (text.length < 100) return showStatus(t("cv.errTooShort"), true);
    if (text.length > MAX_CV_CHARS) return showStatus(t("cv.errTooLong", { max: MAX_CV_CHARS }), true);
    hideStatus();
    resultEl.hidden = true;
    submitBtn.disabled = true;
    showStatus(t("cv.analysing"), false);
    try {
      const data = await callAI({ mode: "cv", text, lang: getLang() });
      renderResult(data);
      hideStatus();
    } catch (err) {
      if (location.protocol === "file:" && !devBridge) {
        showStatus(t("cv.errDevServer"), true);
      } else {
        showStatus(err && err.message ? err.message : t("cv.errNetwork"), true);
      }
    } finally {
      updateSubmit();
    }
  });

  function levelKey(l) {
    const s = String(l || "").toLowerCase();
    if (s.includes("high") || s.includes("高")) return "high";
    if (s.includes("medium") || s.includes("mid") || s.includes("中")) return "medium";
    return "low";
  }

  function renderResult(data) {
    const lvl = levelKey(data.overall_risk);
    riskBadge.textContent = t("risk." + lvl);
    riskBadge.className = "result-badge " + lvl;
    summaryEl.textContent = (getLang() === "zh" ? "AI 对你简历的评审：" : "AI review of your CV: ") + (data.summary || "");
    findingsEl.innerHTML = "";
    (data.findings || []).forEach((f) => {
      const fl = levelKey(f.level);
      const div = document.createElement("div");
      div.className = "finding";
      const head = document.createElement("div");
      head.className = "finding-head";
      head.innerHTML = '<span class="finding-area"></span><span class="finding-level ' + fl + '"></span>';
      head.querySelector(".finding-area").textContent = f.area || "";
      head.querySelector(".finding-level").textContent = t("risk." + fl);
      div.appendChild(head);
      const issue = document.createElement("p");
      issue.textContent = f.issue || "";
      div.appendChild(issue);
      if (f.advice) {
        const adv = document.createElement("p");
        adv.className = "advice";
        adv.textContent = f.advice;
        div.appendChild(adv);
      }
      findingsEl.appendChild(div);
    });
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------------- Ask the AI ---------------- */
  const PRESET_KEYS = ["cv.preset1", "cv.preset2", "cv.preset3", "cv.preset4", "cv.preset5"];
  const presetRow = $("presetRow"), askInput = $("askInput"),
        askSubmit = $("askSubmit"), askAnswer = $("askAnswer");

  function renderPresets() {
    presetRow.innerHTML = "";
    PRESET_KEYS.forEach((k) => {
      const b = document.createElement("button");
      b.className = "preset-btn";
      b.textContent = t(k);
      b.addEventListener("click", () => { askInput.value = t(k); ask(); });
      presetRow.appendChild(b);
    });
  }
  renderPresets();
  document.addEventListener("langchange", renderPresets);
  document.addEventListener("langchange", updateCounter);

  async function ask() {
    const q = askInput.value.trim();
    if (!q) return;
    askInput.value = "";
    askAnswer.hidden = false;
    askAnswer.textContent = t("cv.thinking");
    try {
      const data = await callAI({ mode: "ask", question: q, lang: getLang() });
      askAnswer.textContent = data.answer || "…";
    } catch (err) {
      if (location.protocol === "file:" && !devBridge) {
        askAnswer.textContent = t("cv.errDevServer");
      } else {
        askAnswer.textContent = err && err.message ? err.message : t("cv.errNetwork");
      }
      askAnswer.hidden = false;
    }
  }
  askSubmit.addEventListener("click", ask);
  askInput.addEventListener("keydown", (e) => { if (e.key === "Enter") ask(); });

  /* ---------------- shared API call ---------------- */
  async function callAI(body) {
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(t("cv.errNetwork"));
    }
    if (res.status === 429) throw new Error(t("cv.errRate"));
    if (!res.ok) {
      let msg = t("cv.errNetwork");
      try { const j = await res.json(); if (j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  }

  /* shared with builder.js (inherits the file:// dev-server bridge) */
  window.fbdCallAI = callAI;
})();
