/* ==========================================================================
   main.js — page chrome + the three concept interactives
   1. Scroll progress, nav state, reveal-on-scroll
   2. Bayes lab      — evidence buttons update a posterior gauge
   3. Matthew lab    — birth-month slider + roster histogram
   4. Simpson lab    — aggregate / per-department toggle
   ========================================================================== */
(function () {
  "use strict";

  /* ---------------- scroll progress + nav ---------------- */
  const bar = document.getElementById("progressBar");
  const nav = document.getElementById("nav");
  function onScroll() {
    const h = document.documentElement;
    const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    bar.style.width = (p * 100).toFixed(2) + "%";
    nav.classList.toggle("scrolled", h.scrollTop > 10);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- reveal on scroll ---------------- */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------------- scroll-spy: highlight current nav link ---------------- */
  const navLinks = Array.from(document.querySelectorAll(".nav-links a"));
  const spy = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id));
      }
    }),
    { rootMargin: "-40% 0px -55% 0px" }
  );
  document.querySelectorAll("section[id], header[id]").forEach((s) => spy.observe(s));

  /* ---------------- hero: tap-a-CV scanner ---------------- */
  const FLAGS = {
    en: ["Keyword match: 42%", "Gap year detected", "“women's” down-weighted", "Degree-tier filter hit", "No flags — this time"],
    zh: ["关键词匹配：42%", "检测到空窗期", "“women's”被降权", "触发学历门槛", "这次没有标记"],
  };
  document.querySelectorAll("#scanCards .scan-card").forEach((card) => {
    card.addEventListener("click", () => {
      scanCard(card);
    });
  });

  function scanCard(card) {
    if (card.classList.contains("scanning")) return;
    const verdict = card.querySelector(".scan-verdict");
    verdict.textContent = "";
    card.classList.remove("flag-ok", "scanned");
    card.classList.add("scanning");
    setTimeout(() => {
      const n = card.dataset.flag;
      const bad = n !== "5";
      verdict.textContent = (window.getLang() === "zh" ? FLAGS.zh : FLAGS.en)[n - 1];
      card.classList.toggle("flag-ok", !bad);
      card.classList.remove("scanning");
      card.classList.add("scanned");
    }, 900);
  }

  // auto-demo: scan the first card once, so the interaction explains itself
  setTimeout(() => {
    const first = document.querySelector('#scanCards .scan-card[data-flag="1"]');
    if (first && !first.classList.contains("scanned") && !document.hidden) scanCard(first);
  }, 2200);
  document.addEventListener("langchange", () => {
    document.querySelectorAll("#scanCards .scan-card.scanned").forEach((card) => {
      card.querySelector(".scan-verdict").textContent =
        (window.getLang() === "zh" ? FLAGS.zh : FLAGS.en)[card.dataset.flag - 1];
    });
  });

  /* ======================================================================
     1. BAYES LAB — posterior odds = prior odds × Π likelihood ratios
     ====================================================================== */
  const START_P = 5, MAX_P = 96;
  const arc = document.getElementById("gaugeArc");
  const valEl = document.getElementById("posteriorVal");
  const narr = document.getElementById("bayesNarrative");
  const bayesReset = document.getElementById("bayesReset");
  const ARC_LEN = 251.3;
  let bayesP = START_P;
  const bayesLang = () => (window.getLang ? window.getLang() : "en");

  function odds(p) { return p / (100 - p); }
  function fromOdds(o) { return (100 * o) / (1 + o); }

  function renderBayes() {
    valEl.textContent = Math.round(bayesP);
    arc.style.strokeDashoffset = ARC_LEN * (1 - bayesP / 100);
    const n = narr;
    if (bayesP === START_P) {
      n.textContent = bayesLang() === "zh"
        ? "一个 10 岁孩子的后验概率从 5% 开始。点击一个“早期优势”，更新证据。"
        : "A 10-year-old opens the posterior at 5%. Tap an early advantage to update the evidence.";
    } else {
      n.textContent = (bayesLang() === "zh" ? "证据更新后：P(入选) ≈ " : "After the evidence: P(selected) ≈ ")
        + Math.round(bayesP) + "%" +
        (bayesLang() === "zh" ? "——优势是复利的。" : " — advantage compounds.");
    }
  }

  document.querySelectorAll("#bayesButtons .evidence-btn:not(.reset)").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lr = parseFloat(btn.dataset.lr);
      bayesP = Math.min(MAX_P, fromOdds(odds(bayesP) * lr));
      btn.disabled = true;
      bayesReset.disabled = false;
      renderBayes();
    });
  });
  if (bayesReset) bayesReset.addEventListener("click", () => {
    bayesP = START_P;
    document.querySelectorAll("#bayesButtons .evidence-btn:not(.reset)").forEach((b) => (b.disabled = false));
    bayesReset.disabled = true;
    renderBayes();
  });
  renderBayes();

  /* ======================================================================
     2. MATTHEW LAB — birth month → selection probability
        Model: p(m) = 5% × 1.15^(12−m)   (January oldest → highest)
        Roster: a typical elite-team distribution, Jan-heavy.
     ====================================================================== */
  const slider = document.getElementById("monthSlider");
  const selProb = document.getElementById("selProb");
  const selRatio = document.getElementById("selRatio");
  const MONTHS_ZH = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
  const ROSTER = [5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 0, 0]; // 26 players

  function pFor(m) { return 5 * Math.pow(1.15, 12 - m); }

  function renderSlider() {
    const m = parseInt(slider.value, 10);
    const p = pFor(m);
    const ratio = p / pFor(12);
    selProb.textContent = Math.round(p) + "%";
    selRatio.textContent = ratio.toFixed(1) + "×";
    slider.style.setProperty("--fill", ((m - 1) / 11 * 100) + "%");
    document.querySelectorAll(".roster-bar").forEach((bar, i) => {
      bar.classList.toggle("hot", i === m - 1);
    });
  }

  const rosterChartEl = document.getElementById("rosterChart");

  function buildRoster() {
    const chart = rosterChartEl;
    if (!chart) return;
    chart.innerHTML = "";
    const zh = bayesLang() === "zh";
    const max = Math.max(...ROSTER);
    ROSTER.forEach((c, i) => {
      const bar = document.createElement("div");
      bar.className = "roster-bar";
      bar.style.height = c === 0 ? "4px" : (c / max * 100) + "%";
      bar.title = (zh ? MONTHS_ZH[i] : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i])
        + " — " + c + (zh ? " 人" : " players");
      const count = document.createElement("span");
      count.className = "roster-count";
      count.textContent = c || "";
      bar.appendChild(count);
      chart.appendChild(bar);
    });
  }
  if (slider) {
    slider.addEventListener("input", renderSlider);
    buildRoster();
    renderSlider();
    // click a roster bar → jump the slider to that month
    rosterChartEl.addEventListener("click", (e) => {
      const bars = Array.from(rosterChartEl.children);
      const i = bars.indexOf(e.target.closest(".roster-bar"));
      if (i >= 0) { slider.value = i + 1; renderSlider(); }
    });
  }

  /* ======================================================================
     3. SIMPSON LAB — Berkeley 1973, six largest departments
        (Bickel, Hammel & O'Connell, Science 1975)
     ====================================================================== */
  const DEPTS = [
    { label: "A", m: 62, w: 82 },
    { label: "B", m: 63, w: 68 },
    { label: "C", m: 37, w: 34 },
    { label: "D", m: 33, w: 35 },
    { label: "E", m: 28, w: 24 },
    { label: "F", m: 6,  w: 7  },
  ];
  const AGG = { m: 44, w: 35 };
  const simpsonChart = document.getElementById("simpsonChart");
  const simpsonNote = document.getElementById("simpsonNote");
  const btnAgg = document.getElementById("viewAggregate");
  const btnDept = document.getElementById("viewDept");
  const lang = () => (window.getLang ? window.getLang() : "en");

  function makeBar(cls, pct) {
    const bar = document.createElement("div");
    bar.className = "simp-bar " + cls;
    const v = document.createElement("span");
    v.className = "bar-val";
    v.textContent = pct + "%";
    bar.appendChild(v);
    return bar;
  }

  function renderSimpson(view) {
    if (!simpsonChart) return;
    simpsonChart.innerHTML = "";
    const groups = view === "agg"
      ? [{ label: lang() === "zh" ? "全体" : "All", m: AGG.m, w: AGG.w }]
      : DEPTS;
    groups.forEach((g) => {
      const grp = document.createElement("div");
      grp.className = "simp-group";
      const pair = document.createElement("div");
      pair.className = "simp-pair";
      const bm = makeBar("m", g.m);
      const bw = makeBar("w", g.w);
      if (view === "dept") bw.classList.toggle("gap-worse", g.w < g.m);
      pair.appendChild(bm);
      pair.appendChild(bw);
      const lab = document.createElement("span");
      lab.className = "simp-label";
      lab.textContent = g.label;
      grp.appendChild(pair);
      grp.appendChild(lab);
      simpsonChart.appendChild(grp);
      // animate height on next frame
      requestAnimationFrame(() => requestAnimationFrame(() => {
        bm.style.height = (g.m / 100 * 100) + "%";
        bw.style.height = (g.w / 100 * 100) + "%";
      }));
    });
    if (simpsonNote) {
      simpsonNote.textContent = lang() === "zh"
        ? (view === "agg" ? I18N.zh["simpson.noteAgg"] : I18N.zh["simpson.noteDept"])
        : (view === "agg" ? I18N.en["simpson.noteAgg"] : I18N.en["simpson.noteDept"]);
    }
  }

  function setView(view) {
    btnAgg.classList.toggle("active", view === "agg");
    btnDept.classList.toggle("active", view === "dept");
    renderSimpson(view);
  }
  if (btnAgg && btnDept) {
    btnAgg.addEventListener("click", () => { setView("agg"); simpsonTouched = true; });
    btnDept.addEventListener("click", () => { setView("dept"); simpsonTouched = true; });
    // auto-demo: when scrolled into view, morph to per-department after a beat
    let simpsonTouched = false;
    const simpIO = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        renderSimpson("agg");
        setTimeout(() => { if (!simpsonTouched) setView("dept"); }, 1600);
        simpIO.disconnect();
      }
    }, { threshold: 0.3 });
    simpIO.observe(simpsonChart);
  }

  /* ======================================================================
     4. GOVERNANCE — tap-to-check fairness actions with live progress bar
     ====================================================================== */
  const govCards = document.getElementById("govCards");
  const govBar = document.getElementById("govBar");
  const govCount = document.getElementById("govCount");
  if (govCards && govBar && govCount) {
    const cards = Array.from(govCards.querySelectorAll(".gov-card"));
    function renderGov() {
      const done = cards.filter((c) => c.classList.contains("done")).length;
      govBar.style.width = (done / cards.length * 100) + "%";
      govCount.textContent = (window.getLang() === "zh" ? "公平行动清单  " : "Fairness actions  ") + done + " / " + cards.length;
      govBar.classList.toggle("full", done === cards.length);
    }
    cards.forEach((c) => c.addEventListener("click", () => { c.classList.toggle("done"); renderGov(); }));
    renderGov();
    document.addEventListener("langchange", renderGov);
  }

  /* re-render language-dependent bits on toggle */
  document.addEventListener("langchange", () => {
    renderBayes();
    buildRoster();
    renderSlider();
    if (btnAgg) renderSimpson(btnDept.classList.contains("active") ? "dept" : "agg");
  });
})();
