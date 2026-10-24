/* ==========================================================================
   builder.js — CV Builder: guided form → live preview → editable .docx
   Everything runs locally in the browser. Nothing is uploaded.
   DOCX layout: left photo slot (table cell), right-aligned blank contact
   lines, then fixed sections: objective / experience / education /
   activities / hobbies.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (k) => (window.I18N[window.getLang ? window.getLang() : "en"] || {})[k] || k;

  /* ---------------- i18n label maps (for DOCX content) ---------------- */
  const DOC = {
    en: {
      title: "CURRICULUM VITAE",
      objective: "Career Objective", exp: "Work Experience", edu: "Education",
      act: "Activities", hobby: "Hobbies",
      name: "Name", gender: "Gender", phone: "Phone", email: "Email", addr: "Address",
      photo: "[ Your Photo ]",
      hs: "High School", bs: "Bachelor", ms: "Master", phd: "PhD", other: "Other",
    },
    zh: {
      title: "个 人 简 历",
      objective: "求职目标", exp: "工作经历", edu: "教育背景",
      act: "活动经历", hobby: "兴趣爱好",
      name: "姓名", gender: "性别", phone: "电话", email: "邮箱", addr: "地址",
      photo: "[ 粘贴照片 ]",
      hs: "高中", bs: "本科", ms: "硕士", phd: "博士", other: "其他",
    },
  };

  const DEGREES = ["hs", "bs", "ms", "phd", "other"];

  /* ---------------- dynamic entry rows ---------------- */
  function entryRow(kind) {
    const div = document.createElement("div");
    div.className = "entry-row";
    if (kind === "exp") {
      div.innerHTML =
        '<input class="e-main" data-i18n-placeholder="builder.roleHolder" placeholder="Position — Company">' +
        '<input class="e-start b-date" placeholder="2024.06">' +
        '<input class="e-end b-date" placeholder="2025.08">' +
        '<input class="e-desc" data-i18n-placeholder="builder.descHolder" placeholder="One line about what you did">' +
        '<button class="del-btn" title="Remove">✕</button>';
    } else if (kind === "edu") {
      const sel = DEGREES.map((d) => `<option value="${d}"></option>`).join("");
      div.innerHTML =
        `<select class="e-degree">${sel}</select>` +
        '<input class="e-school" data-i18n-placeholder="builder.schoolHolder" placeholder="School / University">' +
        '<input class="e-start b-date" placeholder="2022.09">' +
        '<input class="e-end b-date" placeholder="2026.06">' +
        '<button class="del-btn" title="Remove">✕</button>';
    } else {
      div.innerHTML =
        '<input class="e-main" data-i18n-placeholder="builder.actHolder" placeholder="e.g. Organised a 40-person charity run">' +
        '<button class="del-btn" title="Remove">✕</button>';
    }
    div.querySelector(".del-btn").addEventListener("click", () => { div.remove(); refresh(); });
    div.querySelectorAll("input, select").forEach((el) => el.addEventListener("input", refresh));
    // ✨ polish the free-text fields: exp description / activity line
    const descEl = div.querySelector(".e-desc");
    if (descEl) {
      const wrap = document.createElement("div");
      wrap.className = "desc-wrap";
      descEl.replaceWith(wrap);
      wrap.append(descEl, makePolishBtn(descEl));
    } else {
      const mainEl = div.querySelector(".e-main");
      if (mainEl) mainEl.insertAdjacentElement("afterend", makePolishBtn(mainEl));
    }
    // translate placeholders of this row
    div.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
    const degSel = div.querySelector(".e-degree");
    if (degSel) {
      DEGREES.forEach((d) => (degSel.querySelector(`option[value="${d}"]`).textContent =
        (DOC[lang()].hasOwnProperty(d) ? DOC[lang()][d] : d)));
      degSel.value = "bs";
    }
    return div;
  }

  function lang() { return window.getLang ? window.getLang() : "en"; }

  /* ---------------- AI polish ---------------- */
  const FIELD_OF = (input) =>
    input.id === "bObjective" ? "objective" :
    input.id === "bHobbies" ? "hobby" :
    input.classList.contains("e-desc") ? "exp" :
    input.classList.contains("e-main") ? "act" : "general";

  let toastEl, toastMsg, toastUndo, toastTimer, lastUndo = null;
  function toast(msg, undoPrev, inputEl) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "builder-toast";
      toastMsg = document.createElement("span");
      toastUndo = document.createElement("button");
      toastUndo.textContent = t("builder.undo");
      toastUndo.addEventListener("click", () => {
        if (lastUndo) { lastUndo.input.value = lastUndo.prev; refresh(); }
        hideToast();
      });
      toastEl.append(toastMsg, toastUndo);
      $("builderLab").appendChild(toastEl);
    }
    lastUndo = undoPrev ? { input: inputEl, prev: undoPrev } : null;
    toastUndo.hidden = !undoPrev;
    toastMsg.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 5000);
  }
  function hideToast() { if (toastEl) toastEl.classList.remove("show"); }

  async function polishField(inputEl, btn) {
    const text = inputEl.value.trim();
    if (!text) { toast(t("builder.polishEmpty"), null); return; }
    if (!window.fbdCallAI) { toast(t("cv.errDevServer"), null); return; }
    const prev = inputEl.value;
    btn.disabled = true;
    btn.classList.add("working");
    try {
      const data = await window.fbdCallAI({
        mode: "polish", field: FIELD_OF(inputEl), text, lang: lang(),
      });
      if (data && data.answer) {
        inputEl.value = data.answer;
        refresh();
        toast(t("builder.polished"), prev, inputEl);
      } else {
        toast(t("builder.polishFail"), null);
      }
    } catch (err) {
      toast((err && err.message) || t("cv.errNetwork"), null);
    } finally {
      btn.disabled = false;
      btn.classList.remove("working");
    }
  }

  function makePolishBtn(inputEl) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ai-polish";
    b.title = t("builder.polish");
    b.textContent = "✨";
    b.addEventListener("click", () => polishField(inputEl, b));
    return b;
  }

  // inject ✨ next to career objective + hobbies (static fields)
  ["bObjective", "bHobbies"].forEach((id) => {
    const el = $(id);
    const wrap = document.createElement("div");
    wrap.className = "field-wrap";
    el.replaceWith(wrap);
    wrap.append(el, makePolishBtn(el));
  });

  function addEntry(listId, kind) { $(listId).appendChild(entryRow(kind)); refresh(); }
  $("addExp").addEventListener("click", () => addEntry("expList", "exp"));
  $("addEdu").addEventListener("click", () => addEntry("eduList", "edu"));
  $("addAct").addEventListener("click", () => addEntry("actList", "act"));
  addEntry("expList", "exp");
  addEntry("eduList", "edu");

  document.addEventListener("langchange", () => {
    // refresh option labels + placeholders of all rows
    document.querySelectorAll("#builderLab .entry-row").forEach((row) => {
      row.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
      });
      const sel = row.querySelector(".e-degree");
      if (sel) DEGREES.forEach((d) => (sel.querySelector(`option[value="${d}"]`).textContent = DOC[lang()][d]));
    });
    document.querySelectorAll(".ai-polish").forEach((b) => (b.title = t("builder.polish")));
    if (toastUndo) toastUndo.textContent = t("builder.undo");
    refresh();
  });

  /* ---------------- collect ---------------- */
  function collect() {
    const rows = (id) => Array.from($(id).querySelectorAll(".entry-row"));
    return {
      objective: $("bObjective").value.trim(),
      exp: rows("expList").map((r) => ({
        role: r.querySelector(".e-main").value.trim(),
        start: r.querySelector(".e-start").value.trim(),
        end: r.querySelector(".e-end").value.trim(),
        desc: r.querySelector(".e-desc").value.trim(),
      })).filter((e) => e.role || e.desc),
      edu: rows("eduList").map((r) => ({
        degree: DOC[lang()][r.querySelector(".e-degree").value] || "",
        school: r.querySelector(".e-school").value.trim(),
        start: r.querySelector(".e-start").value.trim(),
        end: r.querySelector(".e-end").value.trim(),
      })).filter((e) => e.school),
      act: rows("actList").map((r) => r.querySelector(".e-main").value.trim()).filter(Boolean),
      hobby: $("bHobbies").value.trim(),
    };
  }

  /* ---------------- live preview ---------------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const period = (a, b) => [a, b].filter(Boolean).join(" – ");

  function refresh() {
    const d = collect();
    const L = DOC[lang()];
    let html = "";
    if (d.objective) html += `<div class="p-sec"><div class="p-h">${esc(L.objective)}</div><p>${esc(d.objective)}</p></div>`;
    if (d.exp.length) {
      html += `<div class="p-sec"><div class="p-h">${esc(L.exp)}</div>` + d.exp.map((e) =>
        `<div class="p-entry"><div class="p-line"><b>${esc(e.role)}</b><span>${esc(period(e.start, e.end))}</span></div>${e.desc ? `<p>${esc(e.desc)}</p>` : ""}</div>`).join("") + `</div>`;
    }
    if (d.edu.length) {
      html += `<div class="p-sec"><div class="p-h">${esc(L.edu)}</div>` + d.edu.map((e) =>
        `<div class="p-entry"><div class="p-line"><b>${esc(e.degree)}${e.degree && e.school ? " · " : ""}${esc(e.school)}</b><span>${esc(period(e.start, e.end))}</span></div></div>`).join("") + `</div>`;
    }
    if (d.act.length) html += `<div class="p-sec"><div class="p-h">${esc(L.act)}</div>${d.act.map((a) => `<p class="p-li">• ${esc(a)}</p>`).join("")}</div>`;
    if (d.hobby) html += `<div class="p-sec"><div class="p-h">${esc(L.hobby)}</div><p>${esc(d.hobby)}</p></div>`;
    $("paperBody").innerHTML = html || `<p class="paper-empty" data-i18n="builder.empty">${t("builder.empty")}</p>`;
  }
  $("bObjective").addEventListener("input", refresh);
  $("bHobbies").addEventListener("input", refresh);
  refresh();

  /* ---------------- DOCX generation ---------------- */
  const TPL = window.DOCXTPL;

  $("bGenerate").addEventListener("click", () => {
    const d = collect();
    if (!d.objective && !d.exp.length && !d.edu.length && !d.act.length && !d.hobby) {
      alert(t("builder.errEmpty"));
      return;
    }
    const blob = window.DOCXZIP.build([
      { name: "[Content_Types].xml", xml: TPL.CONTENT_TYPES },
      { name: "_rels/.rels", xml: TPL.RELS },
      { name: "word/document.xml", xml: TPL.buildDocxXml(d, DOC[lang()]) },
      { name: "word/styles.xml", xml: TPL.STYLES_XML },
      { name: "word/_rels/document.xml.rels", xml: TPL.DOC_RELS },
    ]);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "My_CV.docx";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    $("bGenerate").textContent = "✓ " + t("builder.done");
    setTimeout(() => ($("bGenerate").textContent = t("builder.generate")), 2500);
  });
})();
