const API = "/api";
const SVG_NS = "http://www.w3.org/2000/svg";

// Network geometry (SVG user units). Rows = tokens, columns = layers.
const LABEL_X = 100;
const X0 = 145;
const COL_W = 62;
const TOP = 62;
const ROW_H = 34;

const CONCEPT_COLORS = {
  gender: ["#f072b8", "#50d8ff"],
  sentiment: ["#43d9ad", "#ff6b6b"],
  sarcasm: ["#f0c060", "#8892b0"],
  royalty: ["#c47af0"],
  profession: ["#50d8ff"],
  place: ["#7c9eff"],
  time: ["#ff9f6b"],
  animal: ["#a3e66b"],
  number: ["#ff6b6b"],
  custom: ["#f0c060", "#50d8ff"],
};

const el = (id) => document.getElementById(id);

const S = {
  info: null,
  a: null, // last /api/analyze response
  view: "head", // "head" | "neuron"
  sel: null, // {t, layer, kind, index, reason}
  revealed: Infinity, // layers revealed so far during the live cascade
  circuit: null, // {key, data} from /api/concept
  lastText: null,
  busy: false,
};
const unitCache = new Map();
let sweepTimer = null;
let debounceTimer = null;
let detailSeq = 0;

// ------------------------------------------------------------ helpers

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showTok(tok) {
  const t = tok.replace(/\n/g, "↵").trim();
  return t || "␣";
}

function svg(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

function conceptColor(key, side = 0) {
  const c = CONCEPT_COLORS[key] || CONCEPT_COLORS.custom;
  return c[Math.min(side, c.length - 1)];
}

// Mockup's intensity ramp: #2d3555 → accent → accent2 → pink.
const RAMP = [[45, 53, 85], [124, 106, 240], [196, 122, 240], [240, 114, 184]];
function rampColor(f) {
  f = Math.max(0, Math.min(1, f)) * (RAMP.length - 1);
  const i = Math.min(Math.floor(f), RAMP.length - 2);
  const t = f - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function setStatus(msg, isError = false) {
  el("status-msg").innerHTML = isError ? `<span class="error">${esc(msg)}</span>` : esc(msg);
}

function unitName(kind, layer, index) {
  return kind === "head" ? `Layer ${layer} · Head ${index}` : `Layer ${layer} · Neuron ${index}`;
}

function shortUnit(kind, layer, index) {
  return kind === "head" ? `L${layer}·H${index}` : `L${layer}·N${index}`;
}

async function api(path, body) {
  const res = await fetch(`${API}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (_) { /* non-JSON error */ }
    throw new Error(detail);
  }
  return res.json();
}

// ------------------------------------------------------------ data accessors

// Activation (σ above typical text) of a specific unit at token t, when known.
function unitZ(kind, layer, index, t) {
  const a = S.a;
  if (kind === "head") return a.head_z[layer][index][t];
  const hit = a.neuron_top[layer][t].find((n) => n.neuron === index);
  return hit ? hit.z : null;
}

// Circuit units of the current view kind that live in a given layer.
function circuitUnitsAt(layer) {
  if (!S.circuit) return [];
  const list = S.view === "head" ? S.circuit.data.heads : S.circuit.data.neurons;
  return list.filter((u) => u.layer === layer);
}

// What a node (token t, layer l) shows: which unit, and how hot it is.
function cellInfo(t, l) {
  const a = S.a;
  const sel = S.sel;
  if (S.circuit) {
    const units = circuitUnitsAt(l);
    if (!units.length) return { kind: S.view, index: null, value: null, circuit: false };
    let best = units[0];
    for (const u of units) if (u.evidence[t] > best.evidence[t]) best = u;
    if (sel && sel.t === t && sel.layer === l && sel.kind === S.view) {
      const pinned = units.find((u) => u.index === sel.index);
      if (pinned) best = pinned;
    }
    return { kind: S.view, index: best.index, value: best.evidence[t], circuit: true, unit: best };
  }
  if (sel && sel.t === t && sel.layer === l && sel.kind === S.view) {
    return { kind: S.view, index: sel.index, value: unitZ(sel.kind, l, sel.index, t) ?? cellDefault(t, l).value };
  }
  return cellDefault(t, l);
}

function cellDefault(t, l) {
  const a = S.a;
  if (S.view === "head") {
    let h = 0;
    for (let i = 1; i < a.num_heads; i++) if (a.head_z[l][i][t] > a.head_z[l][h][t]) h = i;
    return { kind: "head", index: h, value: a.head_z[l][h][t] };
  }
  const top = a.neuron_top[l][t][0];
  return { kind: "neuron", index: top.neuron, value: top.z };
}

// Color-scale ceiling: robust max over everything currently drawable.
function scaleMax() {
  if (S.circuit) return 4;
  const vals = [];
  for (let t = 0; t < S.a.tokens.length; t++)
    for (let l = 0; l < S.a.num_layers; l++) vals.push(cellDefault(t, l).value);
  vals.sort((x, y) => x - y);
  return Math.max(3, vals[Math.floor(vals.length * 0.95)] || 3);
}

// The node that best explains a token: the concept-circuit unit driving a
// detected concept if there is one, otherwise the most intensely firing unit.
function bestSelection(t) {
  const a = S.a;
  if (S.circuit) {
    const list = S.view === "head" ? S.circuit.data.heads : S.circuit.data.neurons;
    let best = list[0];
    for (const u of list) if (u.evidence[t] > best.evidence[t]) best = u;
    return { t, layer: best.layer, kind: S.view, index: best.index, reason: { type: "circuit" } };
  }
  const found = a.token_concepts[t][0];
  if (found) {
    const [layer, index] = a.concepts[found.key][S.view][t];
    return { t, layer, kind: S.view, index, reason: { type: "concept", concept: found } };
  }
  let bestL = 0;
  for (let l = 1; l < a.num_layers; l++) if (cellDefault(t, l).value > cellDefault(t, bestL).value) bestL = l;
  return { t, layer: bestL, kind: S.view, index: cellDefault(t, bestL).index, reason: { type: "max" } };
}

// ------------------------------------------------------------ analysis

async function runAnalysis({ force = false } = {}) {
  const text = el("input-text").value.trim();
  if (!text || (!force && text === S.lastText)) return;
  clearTimeout(debounceTimer);
  S.busy = true;
  el("run-btn").disabled = true;
  updateLiveDot();
  setStatus("Running forward pass through GPT-2…");
  try {
    const a = await api("/analyze", { text });
    if (el("input-text").value.trim() !== text && !force) return; // typed on; a newer run will follow
    S.a = a;
    S.lastText = text;
    S.sel = null;
    unitCache.clear();
    if (S.circuit) await loadCircuit(S.circuit.key, S.circuit.custom, { quiet: true });
    buildTokenRow();
    el("status-nodes").textContent =
      `${a.tokens.length} tokens × ${a.num_layers} layers · ${a.num_heads} heads + ${a.mlp_dim.toLocaleString()} neurons per layer`;
    startCascade();
  } catch (err) {
    setStatus(`Error: ${err.message}`, true);
  } finally {
    S.busy = false;
    el("run-btn").disabled = false;
    updateLiveDot();
  }
}

// Replays the forward pass layer by layer: each column lights up as the
// residual stream flows through it, then focuses the most telling token.
function startCascade() {
  clearTimeout(sweepTimer);
  const a = S.a;
  S.revealed = -1;
  const step = () => {
    S.revealed++;
    drawNetwork();
    if (S.revealed < a.num_layers - 1) {
      setStatus(`Processing layer ${S.revealed + 1} / ${a.num_layers} — attention heads, then MLP neurons…`);
      sweepTimer = setTimeout(step, 90);
      return;
    }
    S.revealed = Infinity;
    const t = mostInterestingToken();
    selectToken(t);
    const found = a.token_concepts.map((c, i) => c.length ? `“${showTok(a.tokens[i])}” → ${c[0].name}` : null).filter(Boolean);
    setStatus(found.length
      ? `Analysis complete — concepts detected: ${found.slice(0, 4).join(", ")}${found.length > 4 ? "…" : ""}. Hover any word.`
      : "Analysis complete — no strong concept detected; hover any word to see what fires.");
    if (a.truncated) setStatus(`Only the first ${a.tokens.length} tokens were analyzed. Hover any word.`);
  };
  step();
}

function mostInterestingToken() {
  const a = S.a;
  let best = 0, bestZ = -1;
  a.token_concepts.forEach((c, i) => {
    if (c.length && Math.abs(c[0].z) > bestZ) { bestZ = Math.abs(c[0].z); best = i; }
  });
  return best;
}

// ------------------------------------------------------------ concept circuits

async function loadCircuit(key, custom = null, { quiet = false } = {}) {
  if (!S.a) { setStatus("Run an analysis first.", true); return; }
  if (!quiet) setStatus(`Tracing the ${key === "custom" ? "custom" : key} circuit…`);
  const body = custom
    ? { analysis_id: S.a.analysis_id, words_a: custom.a, words_b: custom.b }
    : { analysis_id: S.a.analysis_id, key };
  try {
    const data = await api("/concept", body);
    S.circuit = { key, custom, data };
  } catch (err) {
    S.circuit = null;
    setStatus(`Error: ${err.message}`, true);
  }
  renderConceptGrid();
  renderCircuitBox();
  if (!quiet && S.circuit) {
    buildTokenRow();
    const scores = S.circuit.data.token_scores;
    let t = 0;
    scores.forEach((s, i) => { if (Math.abs(s) > Math.abs(scores[t])) t = i; });
    selectToken(t);
    setStatus(`${S.circuit.data.name} circuit: ${S.circuit.data.heads.length} heads + ${S.circuit.data.neurons.length} neurons. Strongest on “${showTok(S.a.tokens[t])}”.`);
  }
}

function clearCircuit() {
  S.circuit = null;
  renderConceptGrid();
  renderCircuitBox();
  if (S.a) {
    buildTokenRow();
    selectToken(S.sel ? S.sel.t : 0);
  }
}

function renderConceptGrid() {
  const grid = el("concept-grid");
  grid.innerHTML = "";
  (S.info?.concepts || []).forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "concept-chip" + (S.circuit?.key === c.key ? " active" : "");
    chip.style.setProperty("--cc", conceptColor(c.key));
    chip.title = c.binary ? `${c.side_a} vs ${c.side_b}` : `${c.side_a}, e.g. ${c.examples.join(", ")}`;
    chip.innerHTML = `<span class="swatch" style="background:${conceptColor(c.key)}"></span>${esc(c.name)}`;
    chip.addEventListener("click", () => (S.circuit?.key === c.key ? clearCircuit() : loadCircuit(c.key)));
    grid.appendChild(chip);
  });
}

function renderCircuitBox() {
  const box = el("circuit-box");
  if (!S.circuit) { box.innerHTML = ""; return; }
  const d = S.circuit.data;
  const key = S.circuit.key;
  const legend = d.binary
    ? `<span style="color:${conceptColor(key, 0)}">■ ${esc(d.side_a)}</span> &nbsp; <span style="color:${conceptColor(key, 1)}">■ ${esc(d.side_b)}</span>`
    : `<span style="color:${conceptColor(key, 0)}">■ ${esc(d.side_a)}</span>`;
  const chips = (list) => list.map((u) => {
    const peak = Math.max(...u.evidence);
    return `<span class="unit-chip${peak > 1 ? " firing" : ""}" data-kind="${u.kind}" data-layer="${u.layer}" data-index="${u.index}"
      title="effect size d=${u.d} (prefers ${esc(u.side)})">${shortUnit(u.kind, u.layer, u.index)}</span>`;
  }).join("");
  box.innerHTML = `
    <div class="circuit-card">
      <div class="circuit-name" style="color:${conceptColor(key)}">${esc(d.name)} circuit</div>
      <div class="circuit-sub">Token tint = circuit reading vs ordinary text. ${legend}</div>
      <div class="section-label">Heads</div><div class="unit-list">${chips(d.heads)}</div>
      <div class="section-label">Neurons</div><div class="unit-list">${chips(d.neurons)}</div>
      <button class="clear-link" id="clear-circuit">Clear circuit</button>
    </div>`;
  box.querySelectorAll(".unit-chip").forEach((chip) => chip.addEventListener("click", () => {
    const kind = chip.dataset.kind, layer = +chip.dataset.layer, index = +chip.dataset.index;
    const u = [...d.heads, ...d.neurons].find((x) => x.kind === kind && x.layer === layer && x.index === index);
    let t = 0;
    u.evidence.forEach((v, i) => { if (v > u.evidence[t]) t = i; });
    setView(kind, false);
    select({ t, layer, kind, index, reason: { type: "circuit" } });
  }));
  el("clear-circuit").addEventListener("click", clearCircuit);
}

// ------------------------------------------------------------ token row

function buildTokenRow() {
  const row = el("token-row");
  row.innerHTML = "";
  const a = S.a;
  a.tokens.forEach((tok, i) => {
    const chip = document.createElement("div");
    chip.className = "token-chip";
    chip.textContent = showTok(tok);
    chip.dataset.idx = i;

    if (S.circuit) {
      const s = S.circuit.data.token_scores[i];
      const side = s >= 0 ? 0 : 1;
      const alpha = Math.min(Math.abs(s) / 5, 1) * 0.75;
      if (s > 0 || S.circuit.data.binary) {
        const color = conceptColor(S.circuit.key, side);
        chip.style.background = `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, var(--token-bg))`;
        chip.classList.add("tinted");
      }
      chip.title = `${S.circuit.data.name}: ${s >= 0 ? "+" : ""}${s}σ vs ordinary text`;
    } else {
      const found = a.token_concepts[i];
      if (found.length) {
        const c = found[0];
        const sideIdx = c.z < 0 ? 1 : 0;
        const dot = document.createElement("span");
        dot.className = "cdot";
        dot.style.background = conceptColor(c.key, sideIdx);
        chip.appendChild(dot);
        chip.title = found.map((x) => `${x.name}: ${x.side} (${x.z}σ)`).join("\n");
      }
    }
    // Hovering a word pinpoints the node that explains it.
    chip.addEventListener("mouseenter", () => selectToken(i));
    chip.addEventListener("click", () => selectToken(i));
    row.appendChild(chip);
  });
}

function selectToken(t) {
  if (!S.a) return;
  select(bestSelection(t));
}

function select(sel) {
  const same = S.sel && S.sel.t === sel.t && S.sel.layer === sel.layer && S.sel.kind === sel.kind && S.sel.index === sel.index;
  S.sel = sel;
  document.querySelectorAll(".token-chip").forEach((c) => c.classList.toggle("selected", +c.dataset.idx === sel.t));
  el("token-idx").textContent = `${sel.t + 1} / ${S.a.tokens.length}`;
  drawNetwork();
  if (!same) renderDetails();
}

function setView(view, reselect = true) {
  if (S.view === view) return;
  S.view = view;
  document.querySelectorAll("#view-toggle button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  if (!S.a) return;
  if (reselect) selectToken(S.sel ? S.sel.t : 0);
  else drawNetwork();
}

// ------------------------------------------------------------ network diagram

function drawNetwork() {
  const a = S.a;
  const svgEl = el("network-svg");
  const L = a ? a.num_layers : 12;
  const n = a ? a.tokens.length : 0;
  const W = X0 + (L - 1) * COL_W + 40;
  const H = TOP + Math.max(n, 1) * ROW_H;
  svgEl.setAttribute("viewBox", `0 0 ${W} ${H}`);

  const labels = el("layer-labels");
  labels.innerHTML = "";
  for (let l = 0; l < L; l++) {
    const x = X0 + l * COL_W;
    const lit = a && l <= S.revealed;
    svg("text", { x, y: 26, "text-anchor": "middle", fill: lit ? "#8892b0" : "#4a5568", "font-size": 12, "font-family": "Inter" }, labels).textContent = `L${l}`;
    const units = S.circuit && a ? circuitUnitsAt(l).length : null;
    const sub = units !== null ? (units ? `${units} in circuit` : "") : (S.view === "head" ? "attn" : "MLP");
    svg("text", { x, y: 40, "text-anchor": "middle", fill: "#3a4060", "font-size": 9, "font-family": "Inter" }, labels).textContent = sub;
  }
  svg("text", { x: LABEL_X, y: 26, "text-anchor": "end", fill: "#4a5568", "font-size": 11, "font-family": "Inter" }, labels).textContent = "token ↓  layer →";

  const tokG = el("token-labels"), wires = el("wires-layer"), active = el("active-path"), nodes = el("nodes-layer");
  [tokG, wires, active, nodes].forEach((g) => (g.innerHTML = ""));
  if (!a) return;

  const sel = S.sel;
  const xOf = (l) => (l < 0 ? LABEL_X + 10 : X0 + l * COL_W);
  const yOf = (t) => TOP + t * ROW_H;

  // Token labels + faint residual-stream line per token.
  for (let t = 0; t < n; t++) {
    const isSel = sel && sel.t === t;
    const label = svg("text", {
      x: LABEL_X, y: yOf(t) + 4, "text-anchor": "end", class: "tok-label",
      fill: isSel ? "#e8eaf6" : "#8892b0", "font-size": 12, "font-weight": isSel ? 600 : 400,
      "font-family": "JetBrains Mono, monospace",
    }, tokG);
    label.textContent = showTok(a.tokens[t]).slice(0, 12);
    label.addEventListener("mouseenter", () => selectToken(t));
    svg("line", { x1: LABEL_X + 10, y1: yOf(t), x2: xOf(L - 1), y2: yOf(t), stroke: "#1e2235", "stroke-width": 1 }, wires);
  }

  // Attention wires into the selected token: for every layer, where does the
  // head shown at that node pull information from? Width/opacity = weight.
  if (sel && S.view === "head") {
    const t = sel.t;
    for (let l = 0; l < L && l <= S.revealed; l++) {
      const info = cellInfo(t, l);
      if (info.index === null) continue;
      const row = a.attention[l][info.index][t];
      const focus = l === sel.layer;
      for (let j = 0; j <= t; j++) {
        const w = row[j];
        if (w < 0.04) continue;
        const x1 = xOf(l - 1), y1 = yOf(j), x2 = xOf(l), y2 = yOf(t);
        const mx = (x1 + x2) / 2;
        const path = svg("path", {
          d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`,
          fill: "none",
          stroke: focus ? "#c47af0" : "#7c6af0",
          "stroke-width": (focus ? 1 : 0.5) + w * (focus ? 4 : 2.5),
          opacity: (focus ? 0.35 : 0.12) + w * (focus ? 0.65 : 0.45),
        }, active);
        if (focus) {
          path.setAttribute("stroke-dasharray", "4 2");
          path.setAttribute("class", "wire-flow");
          path.setAttribute("filter", "url(#glow)");
        }
      }
    }
  } else if (sel) {
    // MLP neurons act per position: the signal flows along the token's own row.
    const y = yOf(sel.t);
    svg("line", {
      x1: LABEL_X + 10, y1: y, x2: xOf(Math.min(sel.layer, S.revealed)), y2: y,
      stroke: "#7c6af0", "stroke-width": 2, "stroke-dasharray": "4 2", class: "wire-flow",
      opacity: 0.8, filter: "url(#glow)",
    }, active);
  }

  // Nodes.
  const vmax = scaleMax();
  el("scale-max").textContent = S.circuit ? "4σ+ (circuit evidence)" : `${vmax.toFixed(1)}σ+`;
  for (let t = 0; t < n; t++) {
    for (let l = 0; l < L; l++) {
      const cx = xOf(l), cy = yOf(t);
      const revealed = l <= S.revealed;
      const info = revealed ? cellInfo(t, l) : null;
      const isSel = sel && sel.t === t && sel.layer === l;
      const f = info && info.value !== null ? Math.max(0, info.value) / vmax : 0;

      let fill = "#1a1f35", stroke = "#2d3555", r = 7, opacity = 0.55;
      if (info && info.value !== null) {
        fill = f > 0.08 ? rampColor(f) : "#1a1f35";
        stroke = f > 0.5 ? "#c47af0" : "#2d3555";
        r = 6 + Math.min(f, 1) * 4;
        opacity = 0.45 + Math.min(f, 1) * 0.55;
      }
      if (S.circuit && info && !info.circuit) opacity = 0.18;

      const circle = svg("circle", { cx, cy, r, fill, stroke, "stroke-width": 1, opacity }, nodes);
      if (S.circuit && info?.circuit) {
        const side = S.circuit.data.binary && info.unit.d < 0 ? 1 : 0;
        circle.setAttribute("stroke", conceptColor(S.circuit.key, side));
        circle.setAttribute("stroke-width", 1.5);
      }
      if (f >= 0.85) circle.setAttribute("filter", "url(#glow)");
      if (isSel) {
        circle.setAttribute("r", 12);
        circle.setAttribute("fill", "#7c6af0");
        circle.setAttribute("stroke", "#c47af0");
        circle.setAttribute("stroke-width", 2);
        circle.setAttribute("opacity", 1);
        circle.setAttribute("filter", "url(#glow-hot)");
        svg("circle", { cx, cy, r: 4, fill: "#fff", opacity: 0.85 }, nodes);
      }

      const hit = svg("circle", { cx, cy, r: 15, fill: "transparent", class: "node-hit" }, nodes);
      hit.addEventListener("mouseenter", (e) => showTooltip(e, t, l));
      hit.addEventListener("mousemove", moveTooltip);
      hit.addEventListener("mouseleave", hideTooltip);
      hit.addEventListener("click", () => {
        if (!revealed) return;
        const c = cellInfo(t, l);
        if (c.index === null) return;
        select({ t, layer: l, kind: c.kind, index: c.index, reason: { type: S.circuit ? "circuit" : "manual" } });
      });
    }
  }
}

// ------------------------------------------------------------ tooltip

function showTooltip(e, t, l) {
  if (!S.a || l > S.revealed) return;
  const info = cellInfo(t, l);
  if (info.index === null) return;
  const a = S.a;
  el("tt-title").textContent = unitName(info.kind, l, info.index);
  el("tt-token").textContent = `“${showTok(a.tokens[t])}”`;
  el("tt-activation").textContent = info.circuit
    ? `${info.value.toFixed(2)}σ circuit evidence`
    : `${info.value === null ? "—" : info.value.toFixed(2) + "σ"} above typical`;

  let concept = "Top concept: — (no clear concept; likely syntactic)";
  const label = info.kind === "head"
    ? a.head_labels[l][info.index]
    : (a.neuron_top[l][t].find((x) => x.neuron === info.index) || {}).label;
  const found = a.token_concepts[t][0];
  const witness = found && a.concepts[found.key][info.kind][t];
  if (info.circuit) concept = `Part of the ${S.circuit.data.name} circuit (prefers ${info.unit.side})`;
  else if (witness && witness[0] === l && witness[1] === info.index) concept = `Top concept: ${found.name} → ${found.side} (${found.z}σ)`;
  else if (label) concept = `Top concept: ${label.name} → ${label.side} (d=${label.d})`;
  el("tt-concept").textContent = concept;

  el("neuron-tooltip").classList.add("visible");
  moveTooltip(e);
}

function moveTooltip(e) {
  const container = el("network-container");
  const rect = container.getBoundingClientRect();
  const tt = el("neuron-tooltip");
  let left = e.clientX - rect.left + container.scrollLeft + 16;
  let top = e.clientY - rect.top + container.scrollTop - 30;
  if (left + 270 > container.clientWidth + container.scrollLeft) left -= 290;
  tt.style.left = `${Math.max(4, left)}px`;
  tt.style.top = `${Math.max(4, top)}px`;
}

function hideTooltip() {
  el("neuron-tooltip").classList.remove("visible");
}

// ------------------------------------------------------------ details panel

async function fetchUnit(kind, layer, index) {
  const key = `${S.a.analysis_id}:${kind}:${layer}:${index}`;
  if (!unitCache.has(key)) {
    unitCache.set(key, api(`/unit/${S.a.analysis_id}?kind=${kind}&layer=${layer}&index=${index}`)
      .catch((err) => { unitCache.delete(key); throw err; }));
  }
  return unitCache.get(key);
}

function barRow(label, value, pct, color, valueText) {
  return `<div class="ti-row">
    <div class="ti-label" title="${esc(label)}">${esc(label)}</div>
    <div class="ti-bar-wrap"><div class="ti-bar" style="width:${Math.max(0, Math.min(100, pct)).toFixed(0)}%;background:${color}"></div></div>
    <div class="ti-val">${valueText ?? value}</div>
  </div>`;
}

function divergingRow(label, value, maxAbs, colorPos, colorNeg) {
  const pct = Math.min(Math.abs(value) / maxAbs, 1) * 50;
  const left = value >= 0 ? 50 : 50 - pct;
  return `<div class="ti-row">
    <div class="ti-label" title="${esc(label)}">${esc(label)}</div>
    <div class="ti-bar-wrap diverging"><div class="ti-bar" style="left:${left}%;width:${pct}%;background:${value >= 0 ? colorPos : colorNeg}"></div></div>
    <div class="ti-val">${value > 0 ? "+" : ""}${value.toFixed(1)}σ</div>
  </div>`;
}

const BAR_COLORS = ["#7c6af0", "#c47af0", "#f072b8", "#50d8ff", "#43d9ad", "#f0c060"];

async function renderDetails() {
  const a = S.a, sel = S.sel;
  const box = el("details");
  if (!a || !sel) return;
  const seq = ++detailSeq;
  const tok = showTok(a.tokens[sel.t]);
  const z = unitZ(sel.kind, sel.layer, sel.index, sel.t);

  // "Why this node" explanation.
  let why = "";
  const r = sel.reason || {};
  if (r.type === "concept") {
    const c = r.concept;
    const color = conceptColor(c.key, c.z < 0 ? 1 : 0);
    why = `<div class="why-box" style="--cc:${color}">
      <strong>${esc(c.name)} detected → ${esc(c.side)}</strong> (${c.z}σ vs ordinary text).
      This ${sel.kind} is the member of the ${esc(c.name.toLowerCase())} circuit firing hardest on “${esc(tok)}”.</div>`;
  } else if (r.type === "circuit" && S.circuit) {
    why = `<div class="why-box" style="--cc:${conceptColor(S.circuit.key)}">
      Member of the <strong>${esc(S.circuit.data.name)}</strong> circuit.</div>`;
  } else if (r.type === "max") {
    why = `<div class="why-box">No concept circuit fires on “${esc(tok)}”; showing the <strong>most intensely firing ${sel.kind}</strong> for it instead.</div>`;
  }

  // Sibling units in the same layer for this token.
  let siblings = "";
  if (sel.kind === "head") {
    const vals = a.head_z[sel.layer].map((row) => row[sel.t]);
    const vmax = Math.max(3, ...vals);
    siblings = `<div class="detail-section">
      <div class="section-label">All ${a.num_heads} heads in layer ${sel.layer} on “${esc(tok)}”</div>
      <div class="strip" style="grid-template-columns:repeat(${a.num_heads},1fr)">
        ${vals.map((v, h) => `<div class="strip-cell${h === sel.index ? " sel" : ""}" data-h="${h}" title="Head ${h}: ${v.toFixed(2)}σ" style="background:${rampColor(Math.max(0, v) / vmax)}">${h}</div>`).join("")}
      </div></div>`;
  } else {
    const tops = a.neuron_top[sel.layer][sel.t];
    siblings = `<div class="detail-section">
      <div class="section-label">Top neurons in layer ${sel.layer} on “${esc(tok)}”</div>
      <div class="similar-grid">${tops.map((n) => `<span class="unit-chip${n.neuron === sel.index ? " firing" : ""}" data-n="${n.neuron}">N${n.neuron} · ${n.z.toFixed(1)}σ</span>`).join("")}</div></div>`;
  }

  // Concept read-out for this token across every circuit.
  const readout = Object.entries(a.concepts).map(([key, c]) => {
    const meta = S.info.concepts.find((x) => x.key === key);
    const v = c.z[sel.t];
    return { key, meta, v };
  }).sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 5);
  const readoutHtml = `<div class="detail-section">
    <div class="section-label">Concept read-out for “${esc(tok)}”</div>
    ${readout.map(({ key, meta, v }) => divergingRow(
      meta.name, v, 6, conceptColor(key, 0), conceptColor(key, 1))).join("")}
    <div class="footnote">Circuit reading vs ordinary text; |σ| ≥ 1.6 counts as detected. For two-sided concepts, right = first side (feminine, positive, sarcastic).</div>
  </div>`;

  const preds = a.predictions[sel.t];
  const predsHtml = `<div class="detail-section">
    <div class="section-label">Model's next-word guess after “${esc(tok)}”</div>
    ${preds.map((p, i) => barRow(showTok(p.token), p.p, p.p * 100, BAR_COLORS[i], `${(p.p * 100).toFixed(0)}%`)).join("")}
  </div>`;

  box.innerHTML = `
    <div>
      <div class="neuron-header">${unitName(sel.kind, sel.layer, sel.index)}</div>
      <div class="neuron-sub">${sel.kind === "head" ? "Attention head" : "MLP neuron"} on token <b>“${esc(tok)}”</b> (#${sel.t + 1})</div>
    </div>
    ${why}
    <div class="detail-section">
      <div class="section-label">Activation</div>
      <div class="activation-bar-wrap">
        <div class="activation-num" id="act-num">${z === null ? "…" : z.toFixed(2) + "σ"}</div>
        <div class="activation-track"><div class="activation-fill" id="act-fill" style="width:${z === null ? 0 : Math.max(0, Math.min(z / 10, 1)) * 100}%"></div></div>
      </div>
      <div class="footnote">σ = standard deviations above this ${sel.kind}'s typical activity on ordinary text${sel.kind === "head" ? " (norm of the head's write into the residual stream)" : ""}.</div>
    </div>
    ${siblings}
    <div id="unit-async"><div class="loading">Dissecting ${sel.kind}…</div></div>
    ${readoutHtml}
    ${predsHtml}`;

  box.querySelectorAll(".strip-cell").forEach((c) => c.addEventListener("click", () =>
    select({ ...sel, index: +c.dataset.h, reason: { type: "manual" } })));
  box.querySelectorAll("[data-n]").forEach((c) => c.addEventListener("click", () =>
    select({ ...sel, index: +c.dataset.n, reason: { type: "manual" } })));

  let u;
  try {
    u = await fetchUnit(sel.kind, sel.layer, sel.index);
  } catch (err) {
    if (seq === detailSeq) el("unit-async").innerHTML = `<div class="loading">Couldn't load details: ${esc(err.message)}</div>`;
    return;
  }
  if (seq !== detailSeq) return;

  const zNow = u.sentence_z[sel.t];
  el("act-num").textContent = `${zNow.toFixed(2)}σ`;
  el("act-fill").style.width = `${Math.max(0, Math.min(zNow / 10, 1)) * 100}%`;

  let influence = "";
  if (sel.kind === "head") {
    const row = a.attention[sel.layer][sel.index][sel.t];
    const ranked = row.map((w, j) => ({ j, w })).filter((x) => x.j <= sel.t).sort((x, y) => y.w - x.w).slice(0, 5);
    const sink = a.attention_sink[sel.layer][sel.index][sel.t];
    influence = `<div class="detail-section">
      <div class="section-label">Top influencing tokens (where this head looks)</div>
      ${ranked.map((x, i) => barRow(showTok(a.tokens[x.j]), x.w, x.w * 100, BAR_COLORS[i], x.w.toFixed(2))).join("")}
      <div class="footnote">${(sink * 100).toFixed(0)}% parked on the start-of-text “attention sink”.</div>
    </div>`;
  } else {
    const vmax = Math.max(1, ...u.sentence_z);
    influence = `<div class="detail-section">
      <div class="section-label">This neuron across the sentence</div>
      ${u.sentence_z.map((v, j) => barRow(showTok(a.tokens[j]), v, (Math.max(0, v) / vmax) * 100,
        j === sel.t ? "#f072b8" : "#7c6af0", `${v.toFixed(1)}σ`)).join("")}
    </div>`;
  }

  const label = u.label;
  // When the node was picked for a concept, explain it in terms of that concept.
  const reasonKey = r.type === "concept" ? r.concept.key : (r.type === "circuit" && S.circuit ? S.circuit.key : null);
  const focus = reasonKey && u.all_concepts[reasonKey];
  let conceptHtml;
  if (focus) {
    const also = label && label.key !== reasonKey
      ? ` It is polysemantic: its strongest probe match is actually ${esc(label.name)} → ${esc(label.side)} (d=${label.d}).`
      : "";
    conceptHtml = `<strong>${esc(focus.name)} → ${esc(focus.side)}</strong><br><br>
      Selectivity on the ${esc(focus.name.toLowerCase())} probe: d=${focus.d} (Cohen's d), which ranks it among the
      top ${sel.kind === "head" ? "heads" : "neurons"} of the whole model for this concept.${also}`;
  } else if (label) {
    const meta = S.info.concepts.find((c) => c.key === label.key);
    const vs = meta.binary ? `than ${label.side === meta.side_a ? meta.side_b : meta.side_a} words` : "than ordinary nouns";
    conceptHtml = `<strong>${esc(label.name)} → ${esc(label.side)}</strong><br><br>
      On the probe sets this ${sel.kind} fires ${Math.abs(label.d).toFixed(1)} pooled standard deviations more for ${esc(label.side)} ${esc(vs)} (Cohen's d).`;
  } else {
    const top = u.concepts[0];
    conceptHtml = `<strong>No single dominant concept</strong><br><br>
      Strongest probe match is ${esc(top.name)} → ${esc(top.side)} (d=${top.d}), below the d ≥ 2 bar. Most heads/neurons are polysemantic or syntactic (position, punctuation, previous-token tracking).`;
  }
  const others = u.concepts.map((c, i) => barRow(`${c.name}`, c.score, (c.score / 4) * 100, BAR_COLORS[i], `d=${c.d}`)).join("");

  const similar = u.top_words.map((w) => `<span class="similar-chip"><b>${esc(w.word)}</b> ${w.z.toFixed(1)}σ</span>`).join("");
  const promotes = u.promotes
    ? `<div class="detail-section"><div class="section-label">Pushes the next-word prediction toward</div>
        <div class="similar-grid">${u.promotes.map((p) => `<span class="similar-chip">${esc(showTok(p))}</span>`).join("")}</div></div>`
    : "";

  el("unit-async").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${influence}
      <div class="detail-section">
        <div class="section-label">Possible concept</div>
        <div class="concept-box">${conceptHtml}</div>
        ${others}
      </div>
      <div class="detail-section">
        <div class="section-label">Similar activations (probe words that fire it most)</div>
        <div class="similar-grid">${similar}</div>
      </div>
      ${promotes}
    </div>`;
}

// ------------------------------------------------------------ wiring

function updateCharCount() {
  el("char-num").textContent = el("input-text").value.length;
}

function updateLiveDot() {
  const dot = el("live-dot");
  dot.classList.toggle("busy", S.busy);
  dot.classList.toggle("on", !S.busy && el("live-toggle").checked);
}

function navToken(dir) {
  if (!S.a) return;
  const cur = S.sel ? S.sel.t : -1;
  const t = Math.max(0, Math.min(S.a.tokens.length - 1, cur + dir));
  if (t !== cur) selectToken(t);
}

el("run-btn").addEventListener("click", () => runAnalysis({ force: true }));
el("input-text").addEventListener("input", () => {
  updateCharCount();
  if (!el("live-toggle").checked) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => runAnalysis(), 650);
});
el("input-text").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAnalysis({ force: true }); }
});
el("live-toggle").addEventListener("change", updateLiveDot);
document.querySelectorAll(".example-chip").forEach((chip) => chip.addEventListener("click", () => {
  el("input-text").value = chip.dataset.text;
  updateCharCount();
  runAnalysis({ force: true });
}));
document.querySelectorAll("#view-toggle button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
el("prev-btn").addEventListener("click", () => navToken(-1));
el("next-btn").addEventListener("click", () => navToken(1));
document.addEventListener("keydown", (e) => {
  if (e.target.matches("textarea, input")) return;
  if (e.key === "ArrowLeft") navToken(-1);
  if (e.key === "ArrowRight") navToken(1);
});
el("custom-btn").addEventListener("click", () => {
  const split = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);
  loadCircuit("custom", { a: split(el("words-a").value), b: split(el("words-b").value) });
});

async function init() {
  updateCharCount();
  updateLiveDot();
  drawNetwork();
  setStatus("Connecting to the model…");
  try {
    S.info = await api("/model-info");
  } catch (err) {
    setStatus(`Backend not reachable (${err.message}). Is the server running?`, true);
    return;
  }
  el("model-badge").textContent = `${S.info.model_name} · ${S.info.num_layers}L × ${S.info.num_heads}H`;
  renderConceptGrid();
  runAnalysis({ force: true });
}

init();
