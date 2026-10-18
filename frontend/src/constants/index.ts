import { ActiveCircuit, AnalysisResponse, CircuitUnit, Selection, ViewKind } from "../types";

export const LABEL_X = 132;
export const X0 = 178;
export const COL_W = 84;
export const TOP = 78;
export const ROW_H = 46;

export const CONCEPT_COLORS: Record<string, string[]> = {
  gender: ["#e11d48", "#0284c7"],
  sentiment: ["#059669", "#dc2626"],
  sarcasm: ["#d97706", "#64748b"],
  royalty: ["#7c3aed"],
  profession: ["#0891b2"],
  place: ["#2563eb"],
  time: ["#ea580c"],
  animal: ["#65a30d"],
  number: ["#db2777"],
  custom: ["#d97706", "#0891b2"],
};

export const RAMP = [
  [226, 232, 240],  // 0σ baseline: light clean slate (slate-200)
  [165, 180, 252],  // 1-2σ: soft indigo (indigo-300)
  [99, 102, 241],   // 2-3σ: vibrant electric indigo (indigo-500)
  [225, 29, 72],    // 3-4σ+: vivid rose (rose-600)
];

export const BAR_COLORS = [
  "#4f46e5",
  "#0284c7",
  "#059669",
  "#d97706",
  "#db2777",
  "#7c3aed",
];

export function conceptColor(key: string, side = 0): string {
  const c = CONCEPT_COLORS[key] || CONCEPT_COLORS.custom;
  return c[Math.min(side, c.length - 1)];
}

export function rampColor(f: number): string {
  f = Math.max(0, Math.min(1, f)) * (RAMP.length - 1);
  const i = Math.min(Math.floor(f), RAMP.length - 2);
  const t = f - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function showTok(tok: string): string {
  const t = tok.replace(/\n/g, "↵").trim();
  return t || "␣";
}

export function unitName(kind: ViewKind, layer: number, index: number): string {
  return kind === "head" ? `Layer ${layer} · Head ${index}` : `Layer ${layer} · Neuron ${index}`;
}

export function shortUnit(kind: ViewKind, layer: number, index: number): string {
  return kind === "head" ? `L${layer}H${index}` : `L${layer}N${index}`;
}

export function unitZ(
  a: AnalysisResponse | null,
  kind: ViewKind,
  layer: number,
  index: number,
  token: number
): number | null {
  if (!a) return null;
  if (kind === "head") {
    return a.head_z[layer]?.[index]?.[token] ?? null;
  }
  const row = a.neuron_top[layer]?.[token] || [];
  const hit = row.find((x) => x.neuron === index);
  return hit ? hit.z : null;
}

export function cellInfo(
  a: AnalysisResponse | null,
  view: ViewKind,
  circuit: ActiveCircuit | null,
  sel: Selection | null,
  token: number,
  layer: number
): {
  kind: ViewKind;
  index: number | null;
  value: number | null;
  circuit: boolean;
  unit?: CircuitUnit;
} {
  if (!a) return { kind: view, index: null, value: null, circuit: false };

  if (circuit) {
    const list = circuitUnitsAt(circuit, view, layer);
    if (list.length) {
      let best = list[0];
      let bestEv = Math.abs(best.evidence[token] ?? 0);
      for (let i = 1; i < list.length; i++) {
        const ev = Math.abs(list[i].evidence[token] ?? 0);
        if (ev > bestEv) {
          bestEv = ev;
          best = list[i];
        }
      }
      return {
        kind: view,
        index: best.index,
        value: best.evidence[token] ?? null,
        circuit: true,
        unit: best,
      };
    }
  }

  if (view === "head") {
    const heads = a.head_z[layer];
    if (!heads || !heads.length) {
      return { kind: "head", index: null, value: null, circuit: false };
    }
    const idx =
      sel && sel.kind === "head" && sel.layer === layer && sel.index < heads.length
        ? sel.index
        : maxHeadInLayer(a, layer, token);
    return {
      kind: "head",
      index: idx,
      value: heads[idx]?.[token] ?? null,
      circuit: false,
    };
  }

  const top = a.neuron_top[layer]?.[token];
  if (!top || !top.length) {
    return { kind: "neuron", index: null, value: null, circuit: false };
  }
  const match =
    sel && sel.kind === "neuron" && sel.layer === layer
      ? top.find((x) => x.neuron === sel.index)
      : null;
  const chosen = match || top[0];
  return {
    kind: "neuron",
    index: chosen.neuron,
    value: chosen.z,
    circuit: false,
  };
}

export function circuitUnitsAt(
  circuit: ActiveCircuit,
  view: ViewKind,
  layer: number
): CircuitUnit[] {
  const arr = view === "head" ? circuit.data.heads : circuit.data.neurons;
  return arr.filter((u) => u.layer === layer);
}

export function maxHeadInLayer(
  a: AnalysisResponse,
  layer: number,
  token: number
): number {
  const heads = a.head_z[layer];
  if (!heads || !heads.length) return 0;
  let best = 0;
  let maxV = heads[0]?.[token] ?? -Infinity;
  for (let h = 1; h < heads.length; h++) {
    const v = heads[h]?.[token] ?? -Infinity;
    if (v > maxV) {
      maxV = v;
      best = h;
    }
  }
  return best;
}

export function scaleMax(
  a: AnalysisResponse | null,
  view: ViewKind,
  circuit: ActiveCircuit | null
): number {
  if (circuit) return 4.0;
  if (!a) return 3.0;
  let m = 3.0;
  if (view === "head") {
    for (let l = 0; l < a.num_layers; l++) {
      for (let h = 0; h < a.num_heads; h++) {
        const row = a.head_z[l]?.[h] || [];
        for (let t = 0; t < row.length; t++) {
          if (row[t] > m) m = row[t];
        }
      }
    }
  } else {
    for (let l = 0; l < a.num_layers; l++) {
      const perTok = a.neuron_top[l] || [];
      for (let t = 0; t < perTok.length; t++) {
        const tops = perTok[t] || [];
        for (let i = 0; i < tops.length; i++) {
          if (tops[i].z > m) m = tops[i].z;
        }
      }
    }
  }
  return m;
}

export function bestSelection(
  a: AnalysisResponse,
  view: ViewKind,
  circuit: ActiveCircuit | null,
  token: number
): Selection {
  token = Math.max(0, Math.min(a.tokens.length - 1, token));

  if (circuit) {
    const arr = view === "head" ? circuit.data.heads : circuit.data.neurons;
    if (arr.length) {
      let best = arr[0];
      let bestScore = Math.abs(best.evidence[token] ?? 0);
      for (let i = 1; i < arr.length; i++) {
        const s = Math.abs(arr[i].evidence[token] ?? 0);
        if (s > bestScore) {
          bestScore = s;
          best = arr[i];
        }
      }
      return {
        t: token,
        layer: best.layer,
        kind: view,
        index: best.index,
        reason: { type: "circuit" },
      };
    }
  }

  const found = a.token_concepts[token];
  if (found && found.length) {
    const topC = found[0];
    const wit = a.concepts[topC.key]?.[view]?.[token];
    if (wit) {
      return {
        t: token,
        layer: wit[0],
        kind: view,
        index: wit[1],
        reason: { type: "concept", concept: topC },
      };
    }
  }

  let bestL = 0;
  let bestIdx = 0;
  let bestVal = -Infinity;

  if (view === "head") {
    for (let l = 0; l < a.num_layers; l++) {
      const h = maxHeadInLayer(a, l, token);
      const v = a.head_z[l]?.[h]?.[token] ?? -Infinity;
      if (v > bestVal) {
        bestVal = v;
        bestL = l;
        bestIdx = h;
      }
    }
  } else {
    for (let l = 0; l < a.num_layers; l++) {
      const top = a.neuron_top[l]?.[token]?.[0];
      if (top && top.z > bestVal) {
        bestVal = top.z;
        bestL = l;
        bestIdx = top.neuron;
      }
    }
  }

  return {
    t: token,
    layer: bestL,
    kind: view,
    index: bestIdx,
    reason: { type: "max" },
  };
}
