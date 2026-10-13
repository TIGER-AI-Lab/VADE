(function () {
  "use strict";

  const S = window.VADE_SITE;
  const publicIds = S.public_task_ids || {};
  const sourceIds = Object.fromEntries(Object.entries(publicIds).map(([source, label]) => [label, source]));
  const publicId = id => publicIds[id] || id;
  const sourceId = id => sourceIds[id] || id;
  const publicText = text => String(text).replace(/\b(?:FIN2-\d{3}|L\d{3})\b/g, publicId);
  const publicHash = hash => hash.replace(/^(#(?:task-|trajectory\/))([^/?]+)/, (_, prefix, id) => prefix + publicId(id));
  const sourceHash = hash => hash.replace(/^(#(?:task-|trajectory\/))([^/?]+)/, (_, prefix, id) => prefix + sourceId(id));
  const SVGNS = "http://www.w3.org/2000/svg";
  const reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const $ = (sel, el) => (el || document).querySelector(sel);

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    setAttrs(el, attrs);
    append(el, kids);
    return el;
  }
  function sv(tag, attrs, ...kids) {
    const el = document.createElementNS(SVGNS, tag);
    setAttrs(el, attrs);
    append(el, kids);
    return el;
  }
  function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.setAttribute("class", v);
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : k === "href" ? publicHash(v) : v);
    }
  }
  function append(el, kids) {
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false || kid === "") continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
  }

  // Colours are the paper's palette (preamble: discblue, buildgreen, compileamber, evalpurple,
  // feedred, archgray, inkblack); the three phases are the three authoring panels of its
  // pipeline figure.
  const C = { blue: "#4F7CAC", green: "#4E8F6E", amber: "#BF8F3A", purple: "#7D5BA6", red: "#B9463F", gray: "#8A8F98", ink: "#2B2D33" };
  const PHASES = [
    { key: "discover", label: "Discover", note: "a relationship worth analysing", color: C.blue, tint: "#E6EDF6",
      stages: ["discovery", "novelty_check", "integration", "difficulty"] },
    { key: "reproduce", label: "Independent reproduction", note: "an independent agent, the same evidence, no reference answer", color: C.green, tint: "#E4F0E9",
      stages: ["evidence", "reproduction", "comparison", "family"] },
    { key: "write", label: "Question written last", note: "then reviewed as the evaluated model sees it, and against the sources", color: C.amber, tint: "#F7EFDD",
      stages: ["question", "validity", "consistency", "polish", "acceptance"] },
  ];
  const PHASE_OF = {};
  PHASES.forEach((p) => p.stages.forEach((k) => (PHASE_OF[k] = p)));
  const STAGE_I = {};
  S.stages.forEach((st, i) => (STAGE_I[st.key] = i));
  const STATUS = { passed: "Passed", returned: "Returned", edited: "Edited", skipped: "No record" };
  const STATUS_COLOR = { passed: C.green, returned: C.red, edited: C.blue, skipped: "#C9CCD2" };
  const STATUS_NOTE = { returned: "the step sent the task back; it was corrected and then passed",
    edited: "the question's wording was polished; the final wording is shown above" };
  const SHORT = { discovery: "Discovery", novelty_check: "Novelty", integration: "Integration", difficulty: "Difficulty", evidence: "Reference",
    reproduction: "Reproduction", comparison: "Comparison", family: "Family", question: "Question", validity: "Validity",
    consistency: "Consistency", polish: "Polish", acceptance: "Acceptance" };
  const num2 = (i) => String(i + 1).padStart(2, "0");
  const fmtNum = (n) => Number(n).toLocaleString("en-US");
  function fmtTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  const safeUrl = (url) => (/^https?:\/\//i.test(url || "") ? url : null);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const RELEASE = { finance: "Finance", law: "Law" };  // which release a task belongs to

  /* ------------------------------------------------------------------ header & footer */

  // Only show resources that have an actual destination.
  function linkButtons() {
    const shown = S.links.filter((l) => safeUrl(l.url) || l.always);
    if (!shown.length) return null;
    return h("nav", { class: "paper-links", "aria-label": "Paper and resources" }, shown.map((l) => {
      const mark = (window.VADE_MARKS || {})[l.icon];
      const glyph = mark
        ? sv("svg", { width: 15, height: 15, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": "true" }, sv("path", { d: mark }))
        : icon(l.icon, "currentColor", 15, 2);
      return safeUrl(l.url) ? h("a", { class: "pbtn", href: l.url, target: "_blank", rel: "noopener" }, glyph, l.label)
        : h("span", { class: "pbtn", "aria-disabled": "true" }, glyph, l.label);
    }));
  }
  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
  function goHome(id) {
    if (overlayOpen) closeOverlay(false);
    if (id) setTimeout(() => scrollToId(id), 30);
  }
  function renderHeader() {
    const bar = $("#topbar");
    append(bar, [
      h("nav", { class: "int-links" },
        [["Leaderboard", "results"]].map(([t, id]) => h("a", { href: "#", text: t, onclick: (e) => { e.preventDefault(); goHome(id); } })),
        h("a", { href: "#step-discovery", text: "Pipeline" }),
        h("a", { href: "#bank", text: "Task bank" })),
    ]);
    const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  function renderHeroCopy() {
    append($("#hero-copy"), [
      h("h1", { text: S.project.name }),
      h("p", { class: "title", text: S.project.title }),
      linkButtons(),
    ]);
  }

  /* ------------------------------------------------------------------ hero pipeline */

  // The core pipeline only: the steps with the paper's icons and their names. Professional sources
  // feed Discovery as a dense stream of small dots, so the ratio between what goes in and what comes
  // out is visible; the other discovery routes join as a quiet bypass (click for the list). The
  // reproducer works on a side lane below, on the evidence alone. A defect found by comparison or by
  // the consistency review travels back along a dashed red arc above the line. Grey brackets are the
  // paper's funnel (Table tab:exits) with its own percentages; candidates that exit drop out in grey.
  function icon(name, color, size, strokeWidth) {
    const s = sv("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, "stroke-width": strokeWidth || 1.9,
      "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" });
    s.innerHTML = (window.VADE_ICONS || {})[name] || "";
    return s;
  }
  function wrap(text, max) {
    const lines = [];
    let cur = "";
    String(text).split(" ").forEach((w) => {
      if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function Pipeline() {
    const svg = $("#pipeline");
    const wrapEl = $("#pipeline-wrap");
    const tip = $("#pipe-tip");
    const ST = {};
    S.stages.forEach((st, i) => (ST[st.key] = { ...st, n: i + 1 }));
    const STEP_KEYS = S.stages.map((s) => s.key);
    const NODES = STEP_KEYS.map((k) => ({ key: k, ...ST[k], lane: ST[k].isolated && k === "reproduction" ? "side" : "main" }));
    const byKey = {};
    NODES.forEach((n) => (byKey[n.key] = n));
    const MAIN = NODES.filter((n) => n.lane === "main");
    const SOURCES = { key: "sources", label: "Professional sources", icon: "files" };
    const ROUTES = { key: "routes", label: "Other routes", icon: "route" };
    // the paper's funnel rows, over the steps each row spans
    const SPANS = [["novelty_check"], ["integration"], ["difficulty", "evidence"], ["comparison", "family", "question"],
      ["validity", "consistency", "polish", "acceptance"]];
    const funnel = (S.funnel || []).map((f, i) => ({ ...f, span: SPANS[i] || [], p: 1 - f.continued / f.entered }));
    const REPAIR = { comparison: { to: "evidence", p: 0.26 }, consistency: { to: "question", p: 0.22 } };
    const phaseOf = (n) => PHASE_OF[n.key];
    const colorOf = (n) => (phaseOf(n) ? phaseOf(n).color : C.ink);
    const tintOf = (n) => (phaseOf(n) ? phaseOf(n).tint : "#efeeea");

    let vertical = null, total = 0, M = 0, layer, streamLayer, side = null, arcs = {}, nodeEls = {};
    let particles = [], kids = [], dots = [], last = 0, spawnAcc = 0, dotAcc = 0, raf = 0, running = false, visible = true;

    function layout() {
      if (vertical) {
        SOURCES.x = 110; SOURCES.y = 34; ROUTES.x = 330; ROUTES.y = 34;
        NODES.forEach((n, i) => { n.y = 124 + i * 50; n.x = n.lane === "main" ? 110 : 38; });
        return { W: 390, H: 124 + (NODES.length - 1) * 50 + 46 };
      }
      SOURCES.x = 62; SOURCES.y = 230; ROUTES.x = 126; ROUTES.y = 122;
      let x = 196;
      NODES.forEach((n) => {
        if (n.lane === "side") { n.x = x; n.y = 322; } else { n.x = x; n.y = 230; }
        x += 86;
      });
      return { W: 1290, H: 432 };
    }
    const posOf = (n) => (vertical ? n.y - MAIN[0].y : n.x - MAIN[0].x);
    const pointAt = (s) => (vertical ? { x: MAIN[0].x, y: MAIN[0].y + s } : { x: MAIN[0].x + s, y: MAIN[0].y });

    function badge(n, opts) {
      const color = opts.color, g = sv("g", { class: "p-node" + (opts.cls ? " " + opts.cls : ""), tabindex: "0", role: "link",
        "aria-label": opts.aria, transform: `translate(${n.x} ${n.y})` });
      g.append(sv("rect", { class: "halo", x: -21, y: -21, width: 42, height: 42, rx: 10, stroke: color }));
      g.append(sv("rect", { class: "badge", x: -18, y: -18, width: 36, height: 36, rx: 8, fill: opts.fill, stroke: opts.stroke || "none",
        "stroke-dasharray": opts.dashed ? "3 2.5" : null }));
      const ic = icon(n.icon, opts.iconColor || color, 20);
      ic.setAttribute("x", -10); ic.setAttribute("y", -10);
      g.append(ic);
      return g;
    }
    function label(g, n, text, below) {
      if (vertical) {
        g.append(sv("text", { class: "lbl", x: 138 - n.x, y: 4, style: "text-anchor:start", text }));
        return;
      }
      const lines = wrap(text, 12);
      lines.forEach((t, i) => g.append(sv("text", { class: "lbl", y: (below || 36) + i * 14, text: t })));
    }
    function hook(g, n, open) {
      g.addEventListener("mouseenter", () => showTip(n, g));
      g.addEventListener("focus", () => showTip(n, g));
      g.addEventListener("mouseleave", hideTip);
      g.addEventListener("blur", hideTip);
      g.addEventListener("click", () => { hideTip(); open(); });
      g.addEventListener("keydown", (e) => { if (e.key === "Enter") { hideTip(); open(); } });
    }

    function build() {
      const isV = wrapEl.clientWidth < 760;
      if (isV === vertical && svg.childNodes.length) return;
      vertical = isV;
      svg.textContent = "";
      particles.forEach((p) => p.el.remove());
      particles = []; kids = []; dots = []; nodeEls = {}; arcs = {}; side = null;
      const { W, H } = layout();
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      M = MAIN[0].y;
      total = posOf(MAIN[MAIN.length - 1]);

      if (!vertical) {  // the three panels of the paper's Figure 1
        const ext = { discover: [null, "difficulty"], reproduce: ["evidence", "family"], write: ["question", "acceptance"] };
        PHASES.forEach((ph) => {
          const xa = ext[ph.key][0] ? byKey[ext[ph.key][0]].x - 41 : 8, xb = byKey[ext[ph.key][1]].x + 41;
          svg.append(sv("rect", { class: "p-band", x: xa, y: 6, width: xb - xa, height: H - 12, rx: 10, fill: ph.tint }));
          svg.append(sv("rect", { x: xa + 10, y: 6, width: xb - xa - 20, height: 2.5, rx: 1.25, fill: ph.color }));
          svg.append(sv("text", { class: "p-band-title", x: xa + 14, y: 32, fill: ph.color, text: ph.label }));
          svg.append(sv("text", { class: "p-band-note", x: xa + 14, y: 48, text: ph.note }));
        });
      }
      const a = MAIN[0], z = MAIN[MAIN.length - 1];
      const md = `M ${a.x} ${a.y} L ${z.x} ${z.y}`;
      svg.append(sv("path", { class: "p-track", d: md }), sv("path", { class: "p-flow", d: md }));

      // the reproducer's side lane: it gets the evidence, never the reference analysis
      {
        const e = byKey.evidence, r = byKey.reproduction, c = byKey.comparison;
        const d = vertical
          ? `M ${e.x} ${e.y} C ${e.x - 44} ${e.y + 10}, ${r.x} ${r.y - 30}, ${r.x} ${r.y} C ${r.x} ${r.y + 30}, ${c.x - 44} ${c.y - 10}, ${c.x} ${c.y}`
          : `M ${e.x} ${e.y} C ${e.x + 60} ${e.y}, ${e.x + 60} ${r.y}, ${r.x} ${r.y} C ${c.x - 60} ${r.y}, ${c.x - 60} ${c.y}, ${c.x} ${c.y}`;
        const path = sv("path", { class: "p-side", d, stroke: C.green });
        svg.append(path);
        side = { path, len: path.getTotalLength(), sideAt: null };
      }
      // repair loops: dashed red arcs above the line (the paper's dashed red returns)
      if (!vertical) {
        Object.entries(REPAIR).forEach(([from, r]) => {
          const f = byKey[from], t = byKey[r.to], top = M - 96;
          const d = `M ${f.x} ${f.y - 22} C ${f.x} ${top}, ${t.x} ${top}, ${t.x} ${t.y - 22}`;
          const path = sv("path", { class: "p-repair", d });
          svg.append(path);
          svg.append(sv("path", { class: "p-repair-head", d: `M ${t.x - 4} ${t.y - 29} L ${t.x} ${t.y - 22} L ${t.x + 4} ${t.y - 29}` }));
          svg.append(sv("text", { class: "p-repair-label", x: (f.x + t.x) / 2, y: top + 14, text: "defect → repair" }));
          arcs[from] = { path, len: path.getTotalLength() };
        });
      }
      // funnel brackets
      if (!vertical) {
        funnel.forEach((f) => {
          if (!f.span.length) return;
          const xa = byKey[f.span[0]].x - 38, xb = byKey[f.span[f.span.length - 1]].x + 38, y = 384;
          svg.append(sv("path", { class: "p-bracket", d: `M ${xa} ${y - 5} L ${xa} ${y} L ${xb} ${y} L ${xb} ${y - 5}` }));
          svg.append(sv("text", { class: "p-exit-pct", x: (xa + xb) / 2, y: y + 15, text: `−${f.pct}%` }));
          wrap(f.reason, Math.max(14, Math.floor((xb - xa) / 5.4))).slice(0, 2)
            .forEach((t, i) => svg.append(sv("text", { class: "p-exit", x: (xa + xb) / 2, y: y + 28 + i * 12, text: t })));
        });
      }

      // where candidates come from: a dense stream from the sources, and a quiet bypass
      streamLayer = sv("g", { class: "p-stream" });
      svg.append(streamLayer);
      {
        const g = badge(SOURCES, { color: C.blue, fill: "#fff", stroke: "#cfcbc2", iconColor: C.ink, aria: "Professional sources: the discovery routes" });
        if (vertical) g.append(sv("text", { class: "lbl", x: 28, y: 4, style: "text-anchor:start", text: SOURCES.label }));
        else label(g, SOURCES, SOURCES.label, 36);
        hook(g, SOURCES, () => (location.hash = "#routes"));
        svg.append(g);
        const rg = badge(ROUTES, { color: C.gray, fill: "#fff", stroke: "#b9b5ac", dashed: true, iconColor: C.gray, cls: "p-bypass", aria: "Other discovery routes" });
        const dsc = byKey.discovery;
        const bp = vertical
          ? `M ${ROUTES.x} ${ROUTES.y + 46} C ${ROUTES.x} ${dsc.y - 26}, ${dsc.x + 40} ${dsc.y - 30}, ${dsc.x + 14} ${dsc.y - 19}`
          : `M ${ROUTES.x + 20} ${ROUTES.y} C ${dsc.x - 10} ${ROUTES.y}, ${dsc.x} ${ROUTES.y + 40}, ${dsc.x} ${dsc.y - 22}`;
        svg.append(sv("path", { class: "p-bypass-line", d: bp }));
        if (vertical) rg.append(sv("text", { class: "lbl muted", y: 34, text: "Other routes" }));
        else rg.append(sv("text", { class: "lbl muted", y: -28, text: "Other discovery routes" }));
        hook(rg, ROUTES, () => (location.hash = "#routes"));
        svg.append(rg);
      }

      NODES.forEach((n) => {
        const color = colorOf(n);
        const g = badge(n, { color, fill: tintOf(n), dashed: n.lane === "side", cls: n.lane === "side" ? "p-sidenode" : "", aria: `${n.label}: open the step page` });
        if (n.hidden) {  // the paper's crossed eye: this step does not see part of the task
          const eo = icon("eye-off", C.red, 12, 2.2);
          eo.setAttribute("x", 12); eo.setAttribute("y", -27);
          g.append(sv("circle", { cx: 18, cy: -21, r: 8, fill: "#fff" }), eo);
        }
        label(g, n, n.label, n.lane === "side" ? 38 : 36);
        if (vertical) {
          const f = funnel.find((x) => x.span[x.span.length - 1] === n.key);
          if (f) g.append(sv("text", { class: "exit", x: 138 - n.x, y: 18, style: "text-anchor:start", text: `−${f.pct}% ${f.reason}` }));
        }
        hook(g, n, () => (location.hash = `#step-${n.key}`));
        svg.append(g);
        nodeEls[n.key] = g;
      });
      layer = sv("g", {});
      svg.append(layer);
      renderLegend();
    }

    function showTip(n, g) {
      const ph = phaseOf(n);
      tip.textContent = "";
      if (n.key === "sources" || n.key === "routes") {
        tip.append(h("b", { text: n.key === "sources" ? "Professional sources" : "Other discovery routes" }));
        tip.append(h("div", { text: n.key === "sources"
          ? "Filings, transcripts, statutes, regulations, and agency records that professionals work from. The source-first routes draw candidates from them directly."
          : "Candidates can also start from published analyses, earlier verified tasks, related task types or known model errors. Each candidate must have a reference answer supported by source evidence." }));
        tip.append(h("div", { class: "tip-more", text: "Open the ten discovery routes →" }));
      } else {
        if (ph) tip.append(h("div", { class: "ph", style: `color:${ph.color}`, text: `${ph.label} · step ${n.n}` }));
        tip.append(h("b", { text: n.label }));
        tip.append(h("div", { text: n.description }));
        if (n.hidden) tip.append(h("div", { class: "tip-hid", text: `Does not see: ${n.hidden}` }));
        tip.append(h("div", { class: "tip-more", text: "Open the step page →" }));
      }
      tip.hidden = false;
      const r = g.getBoundingClientRect(), w = wrapEl.getBoundingClientRect();
      const left = Math.min(Math.max(8, r.left - w.left + r.width / 2 - 160), w.width - 330);
      const below = r.top - w.top < w.height / 2;
      tip.style.left = left + "px";
      tip.style.top = below ? (r.bottom - w.top + 8) + "px" : "auto";
      tip.style.bottom = below ? "auto" : (w.bottom - r.top + 8) + "px";
    }
    function hideTip() { tip.hidden = true; }

    function renderLegend() {
      const lg = $("#pipe-legend");
      lg.textContent = "";
      append(lg, [
        h("span", {}, h("b", { class: "dash", style: `border-color:${C.red}` }), "defect sent back for repair"),
        h("span", {}, h("i", { style: `background:${C.gray}` }), "share of candidates leaving at a step"),
        h("span", { class: "eye" }, icon("eye-off", C.red, 13, 2.2), "step that does not see the reference answer"),
      ]);
    }

    function spawn() {
      let exitAt = null;
      for (const f of funnel) {
        if (f.span.length && Math.random() < f.p) { exitAt = f.span[Math.floor(Math.random() * f.span.length)]; break; }
      }
      const repairs = {};
      Object.entries(REPAIR).forEach(([k, r]) => { if (Math.random() < r.p) repairs[k] = true; });
      const el = sv("circle", { r: "2.6", fill: C.blue });
      layer.append(el);
      const p = { el, s: 0, v: 82 + Math.random() * 24, mode: "main", exitAt, repairs, child: null };
      particles.push(p);
      return p;
    }
    function spawnDot() {  // one piece of source material on its way into Discovery
      const d = byKey.discovery;
      const el = sv("circle", { r: (0.9 + Math.random() * 0.8).toFixed(2), fill: C.blue });
      streamLayer.append(el);
      if (vertical) {
        dots.push({ el, t: 0, dur: 0.7 + Math.random() * 0.5, x0: SOURCES.x + (Math.random() - 0.5) * 70, y0: SOURCES.y + 20, x1: d.x + (Math.random() - 0.5) * 6, y1: d.y - 20 });
      } else {
        dots.push({ el, t: 0, dur: 0.8 + Math.random() * 0.6, x0: SOURCES.x + 20, y0: SOURCES.y + (Math.random() - 0.5) * 34,
          x1: d.x - 20, y1: d.y + (Math.random() - 0.5) * 6, spread: (Math.random() - 0.5) * 70 });
      }
    }
    function spawnKid(p) {
      const el = sv("circle", { r: "3.2", fill: "#fff", stroke: C.green, "stroke-width": "1.6" });
      layer.append(el);
      const span = posOf(byKey.comparison) - posOf(byKey.evidence);
      kids.push((p.child = { el, s: 0, v: p.v * (side.len / Math.max(1, span)) * 0.8, done: false, dead: false, hitSide: false }));
    }
    function colorAt(s) {
      if (s < posOf(byKey.evidence) - 40) return C.blue;
      if (s < posOf(byKey.question) - 40) return C.green;
      return C.amber;
    }
    function hit(key) {
      const g = nodeEls[key];
      if (!g) return;
      const now = performance.now();
      if (g._t && now - g._t < 360) return;
      g._t = now;
      g.classList.remove("hit");
      void g.getBBox();
      g.classList.add("hit");
    }
    function sendBack(p, key) {
      p.repairs[key] = false;
      if (p.child) { p.child.dead = true; p.child = null; }
      if (arcs[key]) { p.mode = "arc"; p.arc = arcs[key]; p.as = 0; p.backTo = posOf(byKey[REPAIR[key].to]); }
      else { p.mode = "back"; p.backTo = posOf(byKey[REPAIR[key].to]); }
    }
    function stepParticle(p, dt) {
      if (p.mode === "main") {
        const prev = p.s;
        p.s += p.v * dt;
        for (const n of MAIN) {
          const L = posOf(n);
          if (!(prev < L && p.s >= L)) continue;
          hit(n.key);
          if (p.exitAt === n.key) { p.mode = "exit"; p.t = 0; p.s = L; if (p.child) p.child.dead = true; return; }
          if (n.key === "comparison" && p.child) {
            if (!p.child.done) { p.mode = "wait"; p.at = n.key; p.s = L; return; }
            p.child.remove = true; p.child = null;
          }
          if (REPAIR[n.key] && p.repairs[n.key]) { p.s = L; sendBack(p, n.key); return; }
          if (n.key === "evidence") spawnKid(p);
          if (n.key === MAIN[MAIN.length - 1].key) { p.mode = "done"; return; }
        }
      } else if (p.mode === "wait") {
        if (!p.child || p.child.done || p.child.dead) {
          if (p.child) { p.child.remove = true; p.child = null; }
          if (REPAIR[p.at] && p.repairs[p.at]) sendBack(p, p.at);
          else { p.mode = "main"; p.s += 0.01; }
        }
      } else if (p.mode === "arc") {
        p.as += p.v * 1.1 * dt;
        if (p.as >= p.arc.len) { p.s = p.backTo - 0.01; p.mode = "main"; }
      } else if (p.mode === "back") {
        p.s -= p.v * 1.25 * dt;
        if (p.s <= p.backTo) { p.s = p.backTo - 0.01; p.mode = "main"; }
      } else if (p.mode === "exit") {
        p.t += dt / 1.1;
        if (p.t >= 1) p.mode = "gone";
      }
    }
    function drawParticle(p) {
      let x, y, op = 1, fill;
      const r = 2.4 + 2.8 * Math.max(0, Math.min(1, p.s / total));
      if (p.mode === "arc") {
        const pt = p.arc.path.getPointAtLength(Math.min(p.as, p.arc.len));
        x = pt.x; y = pt.y; fill = C.red;
      } else {
        const base = pointAt(Math.max(0, Math.min(total, p.s)));
        x = base.x; y = base.y;
        if (p.mode === "exit") {
          if (vertical) { x += 10 + 30 * p.t * p.t; y += 6 * p.t; } else { x += p.t * 12; y += 40 * p.t * p.t + 6 * p.t; }
          op = Math.max(0, 1 - p.t); fill = C.gray;
        } else if (p.mode === "back") fill = C.red;
        else fill = colorAt(p.s);
      }
      p.el.setAttribute("cx", x.toFixed(1));
      p.el.setAttribute("cy", y.toFixed(1));
      p.el.setAttribute("r", r.toFixed(2));
      p.el.setAttribute("fill", fill);
      p.el.setAttribute("opacity", String(op));
    }
    function stepKid(k, dt) {
      if (k.dead) {
        k.fade = (k.fade || 0) + dt / 0.5;
        k.el.setAttribute("opacity", String(Math.max(0, 1 - k.fade)));
        if (k.fade >= 1) k.remove = true;
        return;
      }
      if (k.done) return;
      k.s += k.v * dt;
      if (side.sideAt == null) {
        const m = byKey.reproduction;
        let best = 0, bd = Infinity;
        for (let s = 0; s <= side.len; s += 3) {
          const pt = side.path.getPointAtLength(s);
          const d = (pt.x - m.x) ** 2 + (pt.y - m.y) ** 2;
          if (d < bd) { bd = d; best = s; }
        }
        side.sideAt = best;
      }
      if (!k.hitSide && k.s >= side.sideAt) { k.hitSide = true; hit("reproduction"); }
      if (k.s >= side.len) { k.s = side.len; k.done = true; }
      const pt = side.path.getPointAtLength(k.s);
      k.el.setAttribute("cx", pt.x.toFixed(1));
      k.el.setAttribute("cy", pt.y.toFixed(1));
    }
    function stepDot(o, dt) {
      o.t += dt / o.dur;
      const t = Math.min(1, o.t), e = t * t * (3 - 2 * t);
      let x, y;
      if (vertical) { x = o.x0 + (o.x1 - o.x0) * e; y = o.y0 + (o.y1 - o.y0) * t; }
      else { x = o.x0 + (o.x1 - o.x0) * t; y = o.y0 + (o.y1 - o.y0) * e + (o.spread || 0) * Math.sin(Math.PI * t) * 0.5; }
      o.el.setAttribute("cx", x.toFixed(1));
      o.el.setAttribute("cy", y.toFixed(1));
      o.el.setAttribute("opacity", (t < 0.15 ? t / 0.15 : t > 0.85 ? (1 - t) / 0.15 : 1).toFixed(2));
    }
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      spawnAcc += dt;
      if (spawnAcc > 0.95) { spawnAcc = 0; if (particles.length < 28) spawn(); }
      dotAcc += dt * 85;  // source material arrives far faster than candidates leave Discovery
      while (dotAcc >= 1) { dotAcc -= 1; if (dots.length < 150) spawnDot(); }
      dots.forEach((o) => stepDot(o, dt));
      dots = dots.filter((o) => { if (o.t >= 1) { o.el.remove(); return false; } return true; });
      particles.forEach((p) => { stepParticle(p, dt); if (p.mode !== "gone" && p.mode !== "done") drawParticle(p); });
      kids.forEach((k) => stepKid(k, dt));
      particles = particles.filter((p) => { if (p.mode === "gone" || p.mode === "done") { p.el.remove(); return false; } return true; });
      kids = kids.filter((k) => { if (k.remove) { k.el.remove(); return false; } return true; });
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || reduceMotion || !visible || document.hidden || overlayOpen) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() { running = false; cancelAnimationFrame(raf); }

    build();
    if (!reduceMotion) {
      const comp = posOf(byKey.comparison);
      for (let i = 0; i < 6; i++) {
        const p = spawn();
        p.s = Math.random() * comp * 0.95;
        if (p.s > posOf(byKey.evidence)) spawnKid(p);
      }
    }
    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const was = running; stop(); build(); if (was) start(); }, 150); });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.05 }).observe(wrapEl);
    }
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    start();
    return { start, stop };
  }

  /* ------------------------------------------------------------------ reveal on scroll */

  function onReveal(el, fn, threshold) {
    if (reduceMotion || !("IntersectionObserver" in window)) { fn(); return; }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: threshold || 0.25 });
    io.observe(el);
  }
  /* ------------------------------------------------------------------ results */

  function heatColor(v) {  // buildgreen-lt → buildgreen
    const t = Math.max(0, Math.min(1, v / 85));
    const lo = [242, 247, 244], hi = [78, 143, 110];
    return `rgb(${lo.map((x, i) => Math.round(x + (hi[i] - x) * t)).join(",")})`;
  }
  // Model makers and their icons (S.logos, keyed by icon file name).
  const MAKERS = [[/^Claude/, "Anthropic", "Anthropic"], [/^GPT/, "OpenAI", "OpenAI"], [/^Grok/, "xAI", "xAI"],
    [/^DeepSeek/, "DeepSeek", "DeepSeek"], [/^GLM/, "Zhipu AI", "zAI"], [/^Qwen/, "Alibaba", "Alibaba"], [/^MiniMax/, "MiniMax", "MiniMax"],
    [/^Gemini/, "Google", "Google"], [/^MiMo/, "Xiaomi", "Xiaomi"]];
  function makerOf(model) {
    const m = MAKERS.find(([re]) => re.test(model));
    return m ? { name: m[1], logo: (S.logos || {})[m[2]] || null } : { name: "", logo: null };
  }
  const makerIcon = (mk, size) => (mk.logo ? h("img", { class: "mk-logo", src: mk.logo, alt: mk.name, title: mk.name, width: size, height: size })
    : h("i", { class: "mk-logo blank", title: mk.name }));
  const fmtPct = (v) => (v == null ? "–" : v.toFixed(1));
  const fmtCost = (v) => (v == null ? "–" : "$" + (v < 0.1 ? v.toFixed(3) : v.toFixed(2)));
  const fmtMin = (m) => {
    if (m == null) return "–";
    const s = Math.round(m * 60);
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  };
  const fmtPrice = (p) => (p ? [p.input, p.cached, p.output].map((x) => `$${x}`).join(" / ") : "–");

  // Pass rate against cost (log scale) or time per task. Models on the Pareto frontier (no other model
  // is both better and cheaper/faster) are joined by a line.
  function scatter(rows, axis, width) {
    const pts = rows.filter((r) => r.overall != null && (axis === "cost" ? r.cost : r.minutes) != null)
      .map((r) => ({ r, x: axis === "cost" ? r.cost : r.minutes, y: r.overall, maker: makerOf(r.model) }));
    const W = Math.max(300, Math.round(width || 1000)), narrow = W < 640;
    const H = narrow ? Math.round(W * 1.15) : Math.max(320, Math.min(400, Math.round(W * 0.38)));
    const ts = narrow ? 9 : 12, fs = narrow ? 11 : 12;  // tile half-size, label font size
    const L = narrow ? 44 : 56, R = narrow ? 10 : 24, T = 18, B = 44;
    const box = h("div", { class: "sc" });
    if (!pts.length) return box;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    let x0, x1, X, ticks;
    if (axis === "cost") {
      x0 = Math.min(...xs) / 1.6; x1 = Math.max(...xs) * 1.6;
      const lx0 = Math.log10(x0), lx1 = Math.log10(x1);
      X = (v) => L + ((Math.log10(v) - lx0) / (lx1 - lx0)) * (W - L - R);
      ticks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].filter((t) => t >= x0 && t <= x1);
    } else {
      x0 = 0; x1 = Math.max(...xs) * 1.15;
      const step = x1 > 12 ? 2 : 1;
      X = (v) => L + (v / x1) * (W - L - R);
      ticks = []; for (let t = 0; t <= x1; t += step) ticks.push(t);
    }
    const y0 = Math.max(0, Math.floor((Math.min(...ys) - 8) / 10) * 10), y1 = Math.min(100, Math.ceil((Math.max(...ys) + 8) / 10) * 10);
    const Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    const g = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sc-svg", role: "img", "aria-label": `Pass rate against ${axis === "cost" ? "cost" : "time"} per task` });
    for (let t = y0; t <= y1; t += 10) {
      g.append(sv("line", { x1: L, x2: W - R, y1: Y(t), y2: Y(t), class: "sc-grid" }),
        sv("text", { x: L - 10, y: Y(t) + 4, class: "sc-tick", "text-anchor": "end" }, `${t}%`));
    }
    let lastX = -Infinity;
    ticks = ticks.filter((t) => (X(t) - lastX >= 38 ? ((lastX = X(t)), true) : false));
    ticks.forEach((t) => g.append(sv("line", { x1: X(t), x2: X(t), y1: T, y2: H - B, class: "sc-grid v" }),
      sv("text", { x: X(t), y: H - B + 18, class: "sc-tick", "text-anchor": "middle" }, axis === "cost" ? `$${t}` : `${t}m`)));
    g.append(sv("text", { x: (L + W - R) / 2, y: H - 6, class: "sc-axis", "text-anchor": "middle" },
      axis === "cost" ? "Cost per task (USD, log scale)" : "Time per task (median minutes)"));
    // Pareto frontier
    const sorted = pts.slice().sort((a, b) => a.x - b.x || b.y - a.y);
    const front = [];
    sorted.forEach((p) => { if (!front.length || p.y > front[front.length - 1].y) front.push(p); });
    if (front.length > 1) g.append(sv("polyline", { points: front.map((p) => `${X(p.x)},${Y(p.y)}`).join(" "), class: "sc-front" }));
    // labels: each takes the first spot (right, left, above, below, then shifted) that covers no
    // model's tile and no label already placed; tiles are drawn under all labels
    const measure = (() => { const c = document.createElement("canvas").getContext("2d"); c.font = `500 ${fs}px Inter, system-ui, sans-serif`; return (t) => c.measureText(t).width; })();
    const tiles = pts.map((p) => ({ x0: X(p.x) - ts - 1, x1: X(p.x) + ts + 1, y0: Y(p.y) - ts - 1, y1: Y(p.y) + ts + 1 }));
    const placed = [];
    const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const order = pts.map((p, i) => i).sort((i, j) => pts[j].y - pts[i].y);
    const labs = [];
    order.forEach((i) => {
      const p = pts[i], px = X(p.x), py = Y(p.y), w = measure(p.r.model) + 2;
      const d = ts + 5, up = ts + 6, dn = ts + fs + 3;
      const spots = [[px + d, py + 4], [px - d - w, py + 4], [px - w / 2, py - up], [px - w / 2, py + dn],
        [px + d, py - 9], [px + d, py + 17], [px - d - w, py - 9], [px - d - w, py + 17],
        [px - w / 2, py - up - fs - 2], [px - w / 2, py + dn + fs + 2], [px + d, py - 22], [px + d, py + 30],
        [px - d - w, py - 22], [px - d - w, py + 30], [px - w, py - up - 2], [px, py + dn + 2]];
      const fits = ([x, y]) => {
        const r = { x0: x - 2, x1: x + w + 2, y0: y - fs + 1, y1: y + 3 };
        return x >= L - 4 && x + w <= W - 2 && y - 11 >= 0 && y <= H - B + 2 && !tiles.some((t, k) => k !== i && hit(r, t)) && !placed.some((q) => hit(r, q));
      };
      const [x, y] = spots.find(fits) || (px + d + w > W - R ? spots[1] : spots[0]);
      placed.push({ x0: x - 2, x1: x + w + 2, y0: y - fs + 1, y1: y + 3 });
      labs[i] = { p, px, py, x, y };
    });
    const tip = h("div", { class: "sc-tip", hidden: true });
    const tileLayer = sv("g"), labelLayer = sv("g", { class: "sc-labels" });
    labs.forEach((l) => {
      const { p } = l;
      const grp = sv("g", { class: "sc-pt" + (front.includes(p) ? " front" : ""), tabindex: "0", "aria-label": `${p.r.model}: ${fmtPct(p.r.overall)}%` },
        sv("g", { class: "tile", transform: `translate(${l.px} ${l.py})` },
          sv("rect", { x: -ts, y: -ts, width: 2 * ts, height: 2 * ts, rx: ts / 2.4 }),
          p.maker.logo ? sv("image", { href: p.maker.logo, x: -ts * 0.67, y: -ts * 0.67, width: ts * 1.34, height: ts * 1.34 }) : null));
      labelLayer.append(sv("text", { x: l.x, y: l.y, class: "sc-lab", style: `font-size:${fs}px` }, p.r.model));
      const showTip = () => {
        tip.textContent = "";
        tip.append(h("b", { text: p.r.model }), h("span", { class: "mk", text: p.maker.name }),
          h("span", { text: `Pass rate ${fmtPct(p.r.overall)}%` }), h("span", { text: `Cost / task ${fmtCost(p.r.cost)}` }),
          h("span", { text: `Time / task ${fmtMin(p.r.minutes)}` }));
        tip.hidden = false;
        tip.style.left = `${(l.px / W) * 100}%`;
        tip.style.top = `${(l.py / H) * 100}%`;
      };
      grp.addEventListener("mouseenter", showTip); grp.addEventListener("focus", showTip);
      grp.addEventListener("mouseleave", () => (tip.hidden = true)); grp.addEventListener("blur", () => (tip.hidden = true));
      tileLayer.append(grp);
    });
    g.append(tileLayer, labelLayer);
    box.append(g, tip);
    return box;
  }

  // The Finance tab displays the current v1.1 results; archived v1 data is not shown.
  function previewStatus() {
    return h("div", { class: "live", role: "status" },
      h("div", { class: "live-head" }, h("span", { class: "live-dot", "aria-hidden": "true" }),
        h("b", { text: "Pipeline running" })),
      h("p", { text: "Evaluation is ongoing. Results may change as the pipeline progresses." }));
  }
  function slidingIndicator(container, selector, previous = null) {
    const indicator = h("i", { class: "sliding-indicator", "aria-hidden": "true" });
    container.classList.add("has-slider");
    container.append(indicator);
    let initialized = false;
    const update = () => {
      const selected = container.querySelector(selector);
      if (!selected || !container.isConnected) return;
      const box = container.getBoundingClientRect(), target = selected.getBoundingClientRect();
      const shape = { left: target.left - box.left, top: target.top - box.top, width: target.width, height: target.height };
      const apply = rect => Object.assign(indicator.style, { transform: `translate(${rect.left}px, ${rect.top}px)`, width: `${rect.width}px`, height: `${rect.height}px` });
      if (!initialized) {
        indicator.style.transition = "none";
        apply(previous || shape);
        indicator.getBoundingClientRect();
        indicator.style.transition = "";
        initialized = true;
      }
      apply(shape);
      indicator.style.setProperty("--slider-color", getComputedStyle(selected).getPropertyValue("--pc") || "var(--ink)");
    };
    requestAnimationFrame(update);
    return update;
  }
  const barObserver = !reduceMotion && "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) { entry.target.firstElementChild.classList.add("grown"); barObserver.unobserve(entry.target); } });
  }, { threshold: .5 }) : null;
  function growBars(root) {
    // Bars added while their table is already on screen (e.g. after switching tabs) grow at once.
    requestAnimationFrame(() => root.querySelectorAll(".pbar i").forEach(bar => {
      const r = bar.parentElement.getBoundingClientRect();
      if (!barObserver || (r.top < innerHeight && r.bottom > 0)) bar.classList.add("grown");
      else barObserver.observe(bar.parentElement);
    }));
  }
  function renderResults() {
    const tabs = $("#result-tabs"), body = $("#results-body");
    const names = Object.keys(S.results || {});
    const preview = { Energy: true, Medicine: true };
    let moveTabs = () => {};
    let current = names[0], axis = "cost", sort = { key: "overall", dir: -1 }, redraw = null, lastW = 0, rt = 0;
    window.addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => { moveTabs(); if (redraw && body.clientWidth !== lastW) { lastW = body.clientWidth; redraw(); } }, 150);
    });
    const blockOf = (name) => name === "Finance" ? S.result_versions.Finance["v1.1"] : S.results[name];
    function show(name) {
      current = name;
      tabs.querySelectorAll(".tab").forEach((t) => {
        t.setAttribute("aria-selected", String(t.dataset.k === name));
      });
      moveTabs();
      const block = blockOf(name);
      if (barObserver) barObserver.disconnect();
      body.textContent = "";
      const byRate = block.rows.slice().sort((a, b) => b.overall - a.overall);
      const rank = (r) => 1 + byRate.filter((x) => x.overall > r.overall).length;
      const lead = byRate.slice(0, 3);
      const hasExtra = block.rows.some((r) => r.extra);

      // headline
      body.append(h("div", { class: "lb-head" },
        h("h3", { text: name }),
        lead.length >= 3 ? h("p", { class: "lb-lead" },
          h("b", { text: lead[0].model }), ` ranks first with ${fmtPct(lead[0].overall)}%, followed by `,
          h("b", { text: lead[1].model }), ` (${fmtPct(lead[1].overall)}%) and `, h("b", { text: lead[2].model }), ` (${fmtPct(lead[2].overall)}%).`) : null,
        previewStatus()));

      // chart
      const makers = [...new Set(byRate.map((r) => makerOf(r.model).name))].map((n) => MAKERS.find((m) => m[1] === n));
      const chartSlot = h("div", { class: "lb-chart" });
      const seg = h("div", { class: "seg", role: "group", "aria-label": "Horizontal axis" },
        [["cost", "Cost"], ["time", "Time"]].map(([k, t]) => h("button", { type: "button", class: axis === k ? "on" : "", "aria-pressed": String(axis === k),
          onclick: () => { axis = k; seg.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b.textContent === t); b.setAttribute("aria-pressed", String(b.textContent === t)); }); }, text: t })));
      const drawChart = () => { chartSlot.textContent = ""; chartSlot.append(scatter(block.rows, axis, chartSlot.clientWidth - 16)); };
      body.append(h("div", { class: "lb-card" },
        h("div", { class: "lb-card-head" },
          h("div", {}, h("b", { text: "Pass rate vs. " }), h("span", { class: "axis-name", text: "cost per task" })),
          h("div", { class: "lb-tools" }, h("span", { class: "muted small", text: "x-axis" }), seg)),
        h("div", { class: "lb-legend" }, makers.filter(Boolean).map(([, n]) => h("span", {}, makerIcon({ name: n, logo: (S.logos || {})[MAKERS.find((m) => m[1] === n)[2]] }, 14), n)),
          h("span", { class: "fr" }, h("i", { class: "line" }), "Pareto frontier")),
        chartSlot));
      const axisName = body.querySelector(".axis-name");
      const drawAll = () => { axisName.textContent = axis === "cost" ? "cost per task" : "time per task"; drawChart(); };
      seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", drawAll));
      drawAll();
      redraw = drawAll;

      // leaderboard table
      const COLS = [
        { k: "rank", t: "#" }, { k: "model", t: "Model" },
        { k: "overall", t: "Pass rate", sort: -1, cls: "num" },
        { k: "cost", t: "Cost / task", sort: 1, cls: "num" },
        { k: "price", t: "Input / cached / output price", sub: "USD per 1M tokens", cls: "num pc" },
        { k: "minutes", t: "Time / task", sort: 1, cls: "num" }];
      const tbody = h("tbody");
      const thead = h("thead", {}, h("tr", {}, COLS.map((c) => {
        const th = h("th", { class: [c.cls, c.sort ? "sortable" : ""].filter(Boolean).join(" "), scope: "col" },
          c.t, c.sub ? h("small", { text: c.sub }) : null);
        if (c.sort) {
          th.tabIndex = 0;
          const go = () => { sort = sort.key === c.k ? { key: c.k, dir: -sort.dir } : { key: c.k, dir: c.sort }; fillRows(); };
          th.addEventListener("click", go);
          th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
        }
        return th;
      })));
      function fillRows() {
        thead.querySelectorAll("th").forEach((th, i) => {
          const c = COLS[i];
          th.removeAttribute("aria-sort");
          th.classList.toggle("sorted", c.k === sort.key);
          if (c.k === sort.key) th.setAttribute("aria-sort", sort.dir < 0 ? "descending" : "ascending");
        });
        const val = (r) => (r[sort.key] == null ? Infinity * sort.dir : r[sort.key]);  // missing values sort last
        const rows = block.rows.slice().sort((a, b) => (val(a) - val(b)) * sort.dir || b.overall - a.overall);
        const top = byRate[0] ? byRate[0].overall : null;
        if (barObserver) barObserver.disconnect();
        tbody.textContent = "";
        rows.forEach((r) => {
          const mk = makerOf(r.model);
          tbody.append(h("tr", {},
            h("td", { class: "rk", text: String(rank(r)) }),
            h("td", { class: "md" }, makerIcon(mk, 18), h("span", { text: r.model }),
              r.extra ? h("sup", { text: "†", title: "Not in the paper's table" }) : null),
            h("td", { class: "num pr" + (r.overall === top ? " best" : "") }, h("span", { class: "prw" },
              h("span", { text: `${fmtPct(r.overall)}%` }), h("i", { class: "pbar" }, h("i", { style: `width:${r.overall || 0}%` })))),
            h("td", { class: "num", text: fmtCost(r.cost) }),
            h("td", { class: "num muted pc", text: fmtPrice(r.price) }),
            h("td", { class: "num", text: fmtMin(r.minutes) })));
        });
        growBars(tbody);
      }
      fillRows();
      const notes = [
        "Cost per task: each model's mean tokens per task at its list API prices, with cached input and cache writes at their cache rates.",
        block.time_basis?.includes("model time") ? "Time per task: median model and tool execution time." : "Time per task: median elapsed time per run.",
        hasExtra ? "† Not in the paper's table." : null,
        preview[name] ? `${name} is a preview set from a smaller, experimental run.` : null].filter(Boolean);
      append(body, [h("div", { class: "lb-card" },
        h("div", { class: "lb-table-wrap" }, h("table", { class: "lb-table" }, thead, tbody))),
        name === "Finance" ? h("div", { class: "analysis-entry" }, h("p", { text: "Explore model responses and the reasons behind their scores." }),
          h("a", { class: "entry-btn", href: "#analysis", text: "Failure analysis →" })) : null,
        h("div", { class: "lb-notes" }, notes.map((t) => h("p", { text: t })))]);
    }
    names.forEach((n) => {
      tabs.append(h("button", { class: "tab", role: "tab", "data-k": n,
        onclick: () => show(n) }, n,
        (n === "Law" || preview[n]) ? h("span", { class: "pv", text: "preview" }) : null));
    });
    moveTabs = slidingIndicator(tabs, '[aria-selected="true"]');
    if (names.length) show(current);
  }

  /* ------------------------------------------------------------------ task bank */

  const filters = { domain: "all", group: "", category: "", q: "" };
  function openTaskBank() {
    const d = openOverlay("bank");
    d.append(subBar("Task bank", null, null, "Home"),
      h("div", { class: "page bank-page" },
        h("header", { class: "section-head" },
          h("h1", {}, "Task bank", h("span", { class: "preview-label", text: "preview" })),
          h("p", { text: "Explore questions, reference analyses, scoring criteria and source evidence. The Finance examples also include original model responses, research steps and evaluation notes. The full task collection will be released later." })),
        h("div", { class: "review-actions" }, h("a", { href: "#analysis", text: "Failure analysis of the 50 Finance examples →" })),
        h("div", { class: "filters", id: "filters" }),
        h("div", { class: "task-grid", id: "task-grid" }),
        h("p", { class: "empty", id: "task-empty", hidden: true, text: "No task matches these filters." })));
    renderFilters();
    renderTasks();
    if (bankScroll) d.scrollTop = bankScroll;
  }
  function renderFilters() {
    const box = $("#filters");
    const domains = [["all", "All"], ["finance", RELEASE.finance], ["law", RELEASE.law]].filter(([k]) => k === "all" || S.tasks.some((t) => t.domain === k));
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Domain" });
    const group = h("select", { id: "f-group", "aria-label": "Industry or practice area", onchange: (e) => { filters.group = e.target.value; renderTasks(); } });
    const cat = h("select", { id: "f-cat", "aria-label": "Category", onchange: (e) => { filters.category = e.target.value; renderTasks(); } });
    const search = h("input", { id: "f-q", type: "search", placeholder: "Search tasks", "aria-label": "Search tasks", value: filters.q || null,
      oninput: (e) => { filters.q = e.target.value.trim().toLowerCase(); renderTasks(); } });
    function refreshSelects() {
      const pool = S.tasks.filter((t) => filters.domain === "all" || t.domain === filters.domain);
      [[group, "group", "All industries & areas"], [cat, "category", "All categories"]].forEach(([sel, key, label]) => {
        sel.textContent = "";
        sel.append(h("option", { value: "", text: label }));
        [...new Set(pool.map((t) => t[key]).filter(Boolean))].sort().forEach((v) => sel.append(h("option", { value: v, text: v })));
        sel.value = filters[key] || "";
      });
    }
    domains.forEach(([k, label]) => seg.append(h("button", { "aria-pressed": String(filters.domain === k), text: label, onclick: (e) => {
      const me = e.currentTarget;
      filters.domain = k; filters.group = ""; filters.category = "";
      refreshSelects();
      [...seg.children].forEach((b) => b.setAttribute("aria-pressed", String(b === me)));
      renderTasks();
    } })));
    refreshSelects();
    append(box, [seg, group, cat, search, h("span", { class: "count", id: "task-count" })]);
  }
  function matches(t) {
    if (filters.domain !== "all" && t.domain !== filters.domain) return false;
    if (filters.group && t.group !== filters.group) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.q) {
      const hay = `${publicId(t.id)} ${t.title} ${t.question} ${t.group} ${t.category}`.toLowerCase();
      if (!filters.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }
  function renderTasks() {
    const grid = $("#task-grid");
    grid.textContent = "";
    const list = S.tasks.filter(matches);
    $("#task-count").textContent = `${list.length} of ${S.tasks.length} tasks`;
    $("#task-empty").hidden = list.length > 0;
    list.forEach((t) => grid.append(h("a", { class: "task", href: `#task-${encodeURIComponent(t.id)}` },
      h("div", { class: "top" }, h("span", { class: "tid", text: publicId(t.id) }), h("span", { class: `dom ${t.domain}`, text: RELEASE[t.domain] || t.domain }), h("span", { text: t.group })),
      h("h4", { text: t.title }),
      h("p", { class: "q", text: t.question.length >= 255 && !/[.?!]$/.test(t.question) ? t.question.replace(/\s+\S*$/, "") + "…" : t.question }),
      h("div", { class: "strip", style: `--n:${t.stage_status.length}`, title: "Pipeline steps: green passed, red returned and corrected, blue wording edited" },
        t.stage_status.map((st, si) => h("i", { class: st, title: `${num2(si)} ${S.stages[si].label}: ${STATUS[st]}` }))),
      h("div", { class: "meta", text: [t.category, plural(t.sources, "source"), plural(t.evidence, "quote"), plural(t.atoms, "scored item")].join(" · ") }))));
  }

  /* ------------------------------------------------------------------ sub-pages (step pages, task pages) */

  const taskScroll = new Map();
  let activeTask = null, returningTask = false, pendingStage = null;  // pendingStage: a step page link asked to open this step of the task
  let overlayOpen = false, view = null, pipeline = null, timers = [], lastScroll = 0, bankScroll = 0, spy = null;
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function openOverlay(next) {
    const d = $("#detail");
    if (view === "task" && activeTask) taskScroll.set(activeTask, d.scrollTop);
    if (!overlayOpen) lastScroll = window.scrollY;
    if (view === "bank" && next === "task") bankScroll = d.scrollTop; // come back to the same place in the list
    else if (next !== "bank") bankScroll = 0;
    view = next;
    overlayOpen = true;
    if (pipeline) pipeline.stop();
    clearTimers();
    if (spy) { spy.disconnect(); spy = null; }
    document.body.classList.add("locked");
    d.hidden = false;
    d.scrollTop = 0;
    d.textContent = "";
    return d;
  }
  function closeOverlay(silent) {
    if (!overlayOpen) return;
    overlayOpen = false;
    view = null;
    bankScroll = 0;
    clearTimers();
    if (spy) { spy.disconnect(); spy = null; }
    const d = $("#detail");
    d.hidden = true;
    d.textContent = "";
    document.body.classList.remove("locked");
    if (!silent && /^#(bank|routes|task-|step-|trajectory\/|analysis)/.test(location.hash)) {
      try { history.pushState("", document.title, location.pathname + location.search); } catch (e) { location.hash = "top"; }
    }
    window.scrollTo(0, lastScroll);
    if (pipeline) pipeline.start();
  }
  function subBar(crumb, prev, next, backLabel, backHash) {
    const nav = h("div", { class: "nav" });
    if (prev) nav.append(h("a", { href: prev.href, text: `← ${prev.label}` }));
    if (next) nav.append(h("a", { href: next.href, text: `${next.label} →` }));
    return h("div", { class: "d-bar" },
      h("button", { class: "back", type: "button", onclick: () => (backHash ? (location.hash = publicHash(backHash)) : closeOverlay(false)) }, `← ${backLabel}`),
      h("span", { class: "crumb", text: publicText(crumb) }), nav);
  }
  function scrollInDetail(sel) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  /* step pages */

  function openStage(key) {
    const oldMini = $(".mini-pipe"), oldActive = $(".mini-pipe .current");
    const oldBox = oldMini?.getBoundingClientRect(), oldRect = oldActive?.getBoundingClientRect();
    const previous = oldRect ? { left: oldRect.left-oldBox.left, top: oldRect.top-oldBox.top, width: oldRect.width, height: oldRect.height } : null;
    const d = openOverlay("stage");
    const i = STAGE_I[key];
    if (i == null) { d.append(subBar("Pipeline", null, null, "Home"), h("div", { class: "loading", text: "Unknown step." })); return; }
    const st = S.stages[i], ph = PHASE_OF[key];
    const prev = i > 0 ? { href: `#step-${S.stages[i - 1].key}`, label: S.stages[i - 1].label } : null;
    const next = i < S.stages.length - 1 ? { href: `#step-${S.stages[i + 1].key}`, label: S.stages[i + 1].label } : null;
    const mini = h("nav", { class: "mini-pipe", "aria-label": "Pipeline steps" }, PHASES.map((p) =>
      h("div", { class: "mp-phase", style: `--pc:${p.color};--pt:${p.tint};flex:${p.stages.length}` }, h("div", { class: "mp-label", text: p.label }),
        h("div", { class: "mp-steps" }, p.stages.map((k) => h("a", { href: `#step-${k}`, class: "mp-step" + (k === key ? " current" : ""), "aria-current": k === key ? "step" : null, title: S.stages[STAGE_I[k]].label },
          h("span", { class: "mp-n", text: num2(STAGE_I[k]) }), h("span", { class: "mp-name", text: SHORT[k] })))))));
    const rows = [["Inputs", st.brings_in], ["Sees", st.sees], ["Does not see", st.hidden], ["Produces", st.produces], ["If a correction is needed", st.returns_to], ["Reasons for removal", st.exit]]
      .filter(([, v]) => v);
    d.append(subBar(`Pipeline / ${num2(i)} ${st.label}`, prev, next, "Home"),
      h("article", { class: "page stage-page", style: `--pc:${ph.color};--pt:${ph.tint}` },
        mini,
        h("header", { class: "sp-head" },
          h("div", { class: "sp-phase", text: `${ph.label} · step ${num2(i)}` }),
          h("h1", {}, h("span", { class: "sp-badge" }, icon(st.icon, ph.color, 26)), st.label),
          h("p", { class: "lead", text: st.description }),
        ),
        h("dl", { class: "sp-dl" }, rows.map(([k, v]) => h("div", { class: k === "Does not see" ? "row hidden" : "row" }, h("dt", { text: k }), h("dd", { text: v })))),
        stageExamples(key, i),
        h("nav", { class: "sp-nav" },
          prev ? h("a", { href: prev.href }, h("small", { text: "Previous step" }), prev.label) : h("span"),
          next ? h("a", { href: next.href, class: "next" }, h("small", { text: "Next step" }), next.label) : h("span"))));
    const move = slidingIndicator(mini, ".current", previous);
    const resize = new ResizeObserver(() => { if (!mini.isConnected) resize.disconnect(); else move(); });
    resize.observe(mini);
  }

  // Tasks from the bank that show this step: one that passed it directly and, when there is one, one
  // it sent back for correction or edited. Examples come from the five opening tasks of each domain
  // where possible; the directly passing example rotates across them from step to step.
  function stageExamples(key, i) {
    const lead = ["finance", "law"].flatMap((d) => S.tasks.filter((t) => t.domain === d).slice(0, 5));
    const pick = (status, rotate) => {
      const pool = lead.filter((t) => t.stage_status[i] === status);
      return pool.length ? pool[rotate ? i % pool.length : 0] : S.tasks.find((t) => t.stage_status[i] === status);
    };
    const ex = [[pick("passed", true), "passed directly"], [pick("returned"), "sent back, corrected, then passed"],
      [pick("edited"), "wording edited, then passed"]].filter(([t]) => t);
    const paper = S.links.find((l) => /arxiv|paper/i.test(l.label) && safeUrl(l.url));
    return h("section", { class: "sp-examples" },
      h("h2", { text: "See this step in a task" }),
      ex.length ? h("ul", {}, ex.map(([t, label]) => h("li", {},
        h("a", { href: `#task-${encodeURIComponent(t.id)}`, onclick: () => { pendingStage = key; } },
          h("span", { class: "mono", text: publicId(t.id) }), ` ${t.title}`),
        h("span", { class: "muted", text: ` · ${label}` })))) : null,
      h("p", { class: "muted" }, ex.length ? "Each link opens the task at this step of its construction history. " : "",
        "For more detail on this step, see ", paper ? h("a", { href: paper.url, target: "_blank", rel: "noopener noreferrer", text: "the paper" }) : "the paper", "."));
  }

  /* discovery routes page */

  function openRoutes() {
    const d = openOverlay("routes");
    const groups = [];
    (S.routes || []).forEach((r) => {
      let g = groups.find((x) => x.name === r.group);
      if (!g) groups.push((g = { name: r.group, routes: [] }));
      g.routes.push(r);
    });
    const ph = PHASES[0];
    d.append(subBar("Pipeline / Discovery routes", null, { href: "#step-discovery", label: "Discovery" }, "Home"),
      h("article", { class: "page stage-page", style: `--pc:${ph.color};--pt:${ph.tint}` },
        h("header", { class: "sp-head" },
          h("div", { class: "sp-phase", text: "Discover · where candidates come from" }),
          h("h1", {}, h("span", { class: "sp-badge" }, icon("route", ph.color, 26)), "Discovery routes"),
          h("p", { class: "lead", text: "The ten discovery routes provide starting points for new tasks: primary sources, published analyses, earlier verified tasks, related task types and known model errors. Each proposed analysis must be supported by the sources." }),
          h("p", { class: "muted", text: "In the homepage diagram, the main stream represents candidates found directly in professional sources. The dashed path represents the other discovery routes." })),
        groups.map((g) => h("section", { class: "sp-sec" }, h("h2", { text: g.name }),
          h("dl", { class: "sp-dl" }, g.routes.map((r) => h("div", { class: "row" }, h("dt", { text: r.name }), h("dd", { text: r.rule }))))))));
  }

  /* task pages */

  function loadTask(id) {
    const store = (window.VADE_TASKS = window.VADE_TASKS || {});
    if (store[id]) return Promise.resolve(store[id]);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `data/tasks/${encodeURIComponent(id)}.js`;
      s.onload = () => (store[id] ? resolve(store[id]) : reject(new Error("missing")));
      s.onerror = () => reject(new Error("missing"));
      document.head.append(s);
    });
  }
  function openTask(id) {
    returningTask = view === "trajectory";
    const d = openOverlay("task");
    activeTask = id;
    d.append(h("div", { class: "loading", text: "Loading task…" }));
    loadTask(id).then((t) => { if (overlayOpen && sourceHash(location.hash) === `#task-${encodeURIComponent(id)}`) renderTask(t); }).catch(() => {
      d.textContent = "";
      d.append(subBar(id, null, null, "Task bank", "#bank"), h("div", { class: "loading", text: `Task ${id} was not found.` }));
    });
  }
  const fragId = (t, f) => `frag-${t.id}-${String(f).replace(/[^A-Za-z0-9_-]/g, "_")}`;

  function renderTask(t) {
    const d = $("#detail");
    d.textContent = "";
    const L = t.lineage;
    const list = S.tasks.filter(matches);
    const pos = list.findIndex((x) => x.id === t.id);
    const prev = pos > 0 ? { href: `#task-${encodeURIComponent(list[pos - 1].id)}`, label: publicId(list[pos - 1].id) } : null;
    const next = pos >= 0 && pos < list.length - 1 ? { href: `#task-${encodeURIComponent(list[pos + 1].id)}`, label: publicId(list[pos + 1].id) } : null;
    const linked = t.evidence.filter((e) => safeUrl(e.link)).length;
    const SECTIONS = [
      ["sec-overview", "Overview"], ["sec-question", "Question"], ["sec-reference", "Reference analysis"],
      t.requirements.length ? ["sec-contract", "Scoring criteria"] : null,
      ["sec-sources", `Sources & evidence (${t.sources.length})`], ["sec-stages", "How it was built"],
    ].filter(Boolean);

    // left navigation
    const navLinks = {};
    const side = h("aside", { class: "d-side" },
      h("div", { class: "side-id" }, h("span", { class: "mono", text: publicId(t.id) }), h("span", { class: `dom ${t.domain}`, text: RELEASE[t.domain] || t.domain })),
      h("nav", { class: "side-nav", "aria-label": "Sections" }, SECTIONS.map(([id, label]) => {
        const a = h("a", { href: "#", "data-sec": id, text: label, onclick: (e) => { e.preventDefault(); scrollInDetail(`#${id}`); } });
        navLinks[id] = a;
        return a;
      })),
    );

    // overview
    const steps = [];
    const stepper = h("div", { class: "stepper", style: `--n:${L.stages.length}` }, L.stages.map((st, i) => {
      const el = h("button", { class: "step", type: "button", title: `${num2(i)} ${st.label}: ${STATUS[st.status]}${st.note ? ` — ${st.note}` : ""}`,
        onclick: () => scrollInDetail(`#stage-${st.key}`) },
        h("span", { class: "dot", text: num2(i) }),
        h("span", { class: "name", text: SHORT[st.key] }));
      steps.push(el);
      return el;
    }));
    const meta = [plural(t.sources.length, "source"), plural(t.evidence.length, "verbatim quote"), plural(t.atoms.length, t.has_trajectories ? "reference item" : "scored item")].join(" · ");
    const overview = h("section", { class: "sec", id: "sec-overview" },
      h("div", { class: "tags" }, h("span", { class: "task-mobile-id mono", text: publicId(t.id) }), h("span", { text: RELEASE[t.domain] || t.domain }), h("span", { class: "sep", text: "·" }), h("span", { text: t.group }),
        h("span", { class: "sep", text: "·" }), h("span", { text: t.category })),
      h("h1", { text: t.title }),
      h("p", { class: "meta", text: meta }),
      t.sources.length ? h("p", { class: "src-line" }, h("span", { class: "lab", text: "Sources" }), t.sources.map((s, i) => {
        const url = safeUrl(s.view_url) || safeUrl(s.url);
        return url ? h("a", { href: url, target: "_blank", rel: "noopener noreferrer", title: url }, `S${i + 1} ${s.title || s.id} ↗`)
          : h("span", { class: "muted", title: "Written for this task; no public URL" }, `S${i + 1} ${s.title || s.id}`);
      })) : null,
      h("div", { class: "stepper-wrap" },
        h("div", { class: "stepper-head" }, h("span", { class: "lab", text: "How this task was built" })),
        stepper,
        h("p", { class: "step-legend" }, ["passed", "returned", "edited"].map((s) => h("span", {}, h("i", { style: `border-color:${STATUS_COLOR[s]}` }), STATUS[s])))));

    const question = h("section", { class: "sec", id: "sec-question" }, h("h2", { text: "Question" }),
      h("p", { class: "question", text: t.question }),
      t.cutoff_display ? h("div", { class: "muted small" },
        h("p", { text: `Matter as of: ${t.cutoff_display.as_of}` }),
        h("p", { text: `Applicable law: ${t.cutoff_display.applicable_law}` }),
        t.cutoff_display.additional_dates ? h("details", {}, h("summary", { text: "Other dates in the case record" }), h("p", { text: t.cutoff_display.additional_dates })) : null)
        : t.cutoff ? h("p", { class: "muted small", text: `Information cutoff: ${fmtTime(t.cutoff) || t.cutoff}` }) : null);
    const supplied = t.evidence.find(e => e.quote.length > 5000 && t.sources.some(s => s.id === e.source_id && s.synthetic));
    if (supplied) question.append(h("button", { class: "frag-link", type: "button", "data-target": fragId(t, supplied.n), text: "Read the supplied matter record →" }));

    // reference analysis
    const known = new Set(t.evidence.map((e) => e.n));
    const reference = h("section", { class: "sec", id: "sec-reference" }, h("h2", {}, "Reference analysis", h("small", { text: "verified by independent reproduction" })),
      t.core_conclusion ? h("p", { class: "core", text: t.core_conclusion }) : null,
      h("ol", { class: "atoms" }, t.atoms.map((a) => {
        let tol = "";
        if (a.tolerance && typeof a.tolerance === "object") tol = Object.entries(a.tolerance).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`).join(", ");
        else if (a.tolerance) tol = String(a.tolerance);
        const ev = (a.evidence || []).filter((f) => known.has(f));
        return h("li", {},
          h("div", { class: "a-label" }, a.label, a.scored === false ? h("span", {class:"req",text:"reference only · not scored"}) : a.fatal ? h("span", { class: "req", text: "required" }) : null),
          a.expected ? h("div", { class: "a-exp" }, String(a.expected), a.unit && !/[A-Za-z%]/.test(String(a.expected)) ? h("span", { class: "muted", text: ` ${a.unit}` }) : null,
            tol ? h("span", { class: "muted", text: ` · tolerance ${tol}` }) : null) : null,
          ev.length ? h("div", { class: "a-ev" }, ev.length === 1 ? "Rests on quote " : "Rests on quotes ", ev.map((f, k) => [k ? ", " : "", h("button", { class: "frag-link", type: "button", "data-target": fragId(t, f), text: String(f) })])) : null);
      })));

    const contract = t.requirements.length ? h("section", { class: "sec", id: "sec-contract" },
      h("h2", {}, "Scoring criteria", h("small", { text: "a task passes only if every item passes" })),
      h("ol", { class: "reqs" }, t.requirements.map((r) => h("li", {}, r.atom ? h("b", { class: "req-of", text: `${r.atom}. ` }) : null, r.criterion)))) : null;

    // sources & evidence
    const bySrc = {};
    t.evidence.forEach((e) => (bySrc[e.source_id] = bySrc[e.source_id] || []).push(e));
    const ordered = t.sources.slice();
    Object.keys(bySrc).forEach((sid) => { if (!ordered.some((s) => s.id === sid)) ordered.push({ id: sid, title: sid }); });
    const QUOTE_LIMIT = 6;
    const sources = h("section", { class: "sec", id: "sec-sources" }, h("h2", { text: "Sources & evidence" }),
      linked ? h("p", { class: "muted", text: "“Open at this passage” opens the original source at the quoted text: highlighted in a web page, at the right page in a PDF." }) : null,
      ordered.map((s, si) => {
        const open = safeUrl(s.view_url) || safeUrl(s.url);
        const raw = safeUrl(s.view_url) && safeUrl(s.url) && s.view_url !== s.url ? safeUrl(s.url) : null;
        const index = safeUrl(s.index_url);
        const quotes = bySrc[s.id] || [];
        const metaLine = [s.publisher, s.date ? `dated ${fmtTime(s.date) || s.date}` : null].filter(Boolean).join(" · ");  // the title names the document type
        const qList = h("ol", { class: "quotes" }, quotes.map((q, qi) => h("li", { class: "quote", id: fragId(t, q.n), hidden: qi >= QUOTE_LIMIT },
          h("div", { class: "qh" }, h("span", { class: "mono", text: `Quote ${q.n}` }), q.locator ? h("span", { class: "loc", text: q.locator }) : null,
            safeUrl(q.link) ? h("a", { class: "jump", href: q.link, target: "_blank", rel: "noopener noreferrer",
              title: q.link_method === "text" ? "Opens the source with this passage highlighted" : "Opens the PDF at the page that contains this passage",
              text: q.link_method === "text" ? "open at this passage ↗" : `open at page ${(/#page=(\d+)/.exec(q.link) || [])[1] || ""} ↗` }) : null),
          h("blockquote", { class: s.synthetic && q.quote.length > 5000 ? "supplied-matter" : null, text: q.quote }),
          q.note && q.note.replace(/\s+/g, " ").trim() !== q.quote.replace(/\s+/g, " ").trim() ? h("p", { class: "qn", text: q.note }) : null)));
        return h("div", { class: "source" },
          h("div", { class: "s-head" }, h("span", { class: "mono muted", text: `S${si + 1}` }), h("span", { class: "s-title", text: s.title || s.id })),
          metaLine ? h("div", { class: "s-meta", text: metaLine }) : null,
          open ? h("div", { class: "s-links" },
            h("a", { href: open, target: "_blank", rel: "noopener noreferrer" }, "Open source ↗"),
            index ? h("a", { href: index, target: "_blank", rel: "noopener noreferrer" }, "Filing index ↗") : null,
            raw ? h("a", { href: raw, target: "_blank", rel: "noopener noreferrer" }, "Original file ↗") : null,
            h("span", { class: "url", text: open }))
            : h("div", { class: "s-meta", text: s.synthetic ? "A stipulated record written for this task and provided with the question." : "No public link." }),
          quotes.length ? qList : null,
          quotes.length > QUOTE_LIMIT ? h("button", { class: "more", type: "button", text: `Show ${quotes.length - QUOTE_LIMIT} more quotes`, onclick: (e) => {
            qList.querySelectorAll(".quote").forEach((q) => (q.hidden = false));
            e.currentTarget.remove();
          } }) : null);
      }));

    // how it was built
    const used = ["returned", "edited"].filter((s) => L.stages.some((st) => st.status === s));
    const stagesSec = h("section", { class: "sec", id: "sec-stages" }, h("h2", { text: "How it was built" }),
      used.length ? h("p", { class: "muted small" }, used.map((s, k) => [k ? " " : "", h("b", { text: STATUS[s] }), `: ${STATUS_NOTE[s]}.`])) : null,
      h("ol", { class: "sb-list" }, L.stages.map((st, i) => stageBlock(st, i))));

    d.append(subBar(`Task bank / ${publicId(t.id)}`, prev, next, "Task bank", "#bank"),
      h("div", { class: "d-layout" }, side, h("main", { class: "d-main" }, overview, t.has_trajectories ? review.actions(t.id) : null, question, t.reference_note ? review.reviewNote(t.reference_note) : null, reference, contract, sources, stagesSec, t.has_trajectories ? review.actions(t.id) : null)));

    // reference items point at their quotes
    d.querySelectorAll(".frag-link").forEach((b) => b.addEventListener("click", () => {
      const el = document.getElementById(b.dataset.target);
      if (!el) return;
      if (el.hidden) {
        el.parentElement.querySelectorAll(".quote").forEach((q) => (q.hidden = false));
        const more = el.parentElement.parentElement.querySelector(".more");
        if (more) more.remove();
      }
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: el.scrollHeight > d.clientHeight * 0.6 ? "start" : "center" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }));

    // the left navigation follows the reader
    if ("IntersectionObserver" in window) {
      spy = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          Object.values(navLinks).forEach((a) => a.classList.remove("active"));
          if (navLinks[en.target.id]) navLinks[en.target.id].classList.add("active");
        });
      }, { root: d, rootMargin: "-15% 0px -75% 0px" });
      SECTIONS.forEach(([id]) => spy.observe(document.getElementById(id)));
    }
    navLinks["sec-overview"].classList.add("active");

    function play() {
      clearTimers();
      steps.forEach((el) => el.classList.remove("on", "passed", "returned", "edited", "skipped"));
      L.stages.forEach((st, i) => {
        const apply = () => steps[i].classList.add("on", st.status);
        if (reduceMotion) apply();
        else timers.push(setTimeout(apply, 200 + i * 220));
      });
    }
    play();
    if (pendingStage) {
      const target = document.getElementById(`stage-${pendingStage}`);
      pendingStage = null;
      if (target) {
        const history = target.querySelector("details.lineage-events");
        if (history) history.open = true;
        requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
        target.classList.add("flash");
        setTimeout(() => target.classList.remove("flash"), 1600);
      }
    }
    if (returningTask && taskScroll.has(t.id)) requestAnimationFrame(() => { if (view === "task" && activeTask === t.id) d.scrollTop = taskScroll.get(t.id); });
  }

  // Construction records, condensed: repeated records of the same kind (successive versions of the
  // reference analysis, repeated duplicate checks) show once, with their final content and a count;
  // records that state why a revision was needed are all kept.
  const KEEP_ALL = /^(Defect found|Review decision: revision|Question–reference consistency: inconsistent|Selected for revision|Answer-by-answer comparison: (?:revision|new))/;
  // Interim counts (passages found during integration, automatic-failure rules) differ from the final
  // evidence and criteria shown on the page, so titles keep only the final-facing counts.
  const tidyTitle = (t) => t.replace(/,? \d[\d,]* automatic-failure rules?/g, "").replace(/,? \d[\d,]* supporting passages/g, "");
  function condensedEvents(events) {
    const groups = new Map();
    events = events.map((e) => ({ ...e, title: tidyTitle(e.title) }));
    events.forEach((e, i) => {
      const key = KEEP_ALL.test(e.title) ? `${e.title}#${i}` : e.title.replace(/\d[\d,.]*/g, "N");
      const g = groups.get(key) || { n: 0 };
      groups.set(key, { ...g, n: g.n + 1, last: e, at: i });
    });
    return [...groups.values()].sort((x, y) => x.at - y.at);
  }
  function stageBlock(st, i) {
    const ph = PHASE_OF[st.key];
    const groups = condensedEvents(st.events || []);
    const countOnly = st.note && /^\d+ documented steps?\.$/.test(st.note);
    return h("li", { class: `sb ${st.status}`, id: `stage-${st.key}`, style: `--pc:${ph ? ph.color : C.gray}` },
      h("div", { class: "sb-head" },
        h("span", { class: "sb-n", text: num2(i) }),
        h("a", { class: "sb-name", href: `#step-${st.key}`, title: "What this step does", text: st.label }),
        h("span", { class: "sb-status", style: `color:${STATUS_COLOR[st.status]}`, text: STATUS[st.status] })),
      st.note && !countOnly ? h("p", { class: "sb-note", text: st.note }) : null,
      countOnly && groups.length ? h("ul", { class: "sb-steps" }, groups.map(g => h("li", { text: g.n > 1 ? `${g.last.title} (×${g.n})` : g.last.title }))) : null,
      groups.length ? h("details", {class:"lineage-events"}, h("summary", {text:"Read the construction history"}),
        groups.map(g => h("div", {class:"lineage-event"}, h("b",{text: g.n > 1 ? `${g.last.title} (${g.n} records; final shown)` : g.last.title}),
          g.last.date && g.last.date !== "None" ? h("small",{text:fmtTime(g.last.date)}) : null,
          g.last.detail ? h("p",{text:g.last.detail}) : null))) : null);
  }

  /* ------------------------------------------------------------------ routing */

  const review = window.FinanceReview({h, append, S, openOverlay, subBar, loadTask, publicId, publicText, publicHash, sourceId, sourceHash});
  function route() {
    if (review.route()) return;
    if (location.hash === "#bank") { openTaskBank(); return; }
    if (location.hash === "#routes") { openRoutes(); return; }
    const m = /^#(task|step)-(.+)$/.exec(location.hash);
    if (!m) { closeOverlay(true); return; }
    if (m[1] === "task") openTask(sourceId(decodeURIComponent(m[2])));
    else openStage(decodeURIComponent(m[2]));
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !overlayOpen) return;
    if (view === "task") location.hash = "#bank"; else closeOverlay(false);
  });

  renderHeader();
  renderHeroCopy();
  pipeline = Pipeline();
  renderResults();
  window.addEventListener("hashchange", route);
  route();
})();
