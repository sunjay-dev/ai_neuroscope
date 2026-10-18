import { ActiveCircuit, AnalysisResponse, CircuitUnit, Selection, ViewKind } from "../types";

export const LABEL_X = 110;
export const X0 = 155;
export const COL_W = 64;
export const TOP = 64;
export const ROW_H = 36;

export const CONCEPT_COLORS: Record<string, string[]> = {
  gender: ["#f43f5e", "#0ea5e9"],
  sentiment: ["#10b981", "#ef4444"],
  sarcasm: ["#f59e0b", "#94a3b8"],
  royalty: ["#a855f7"],
  profession: ["#06b6d4"],
  place: ["#3b82f6"],
  time: ["#f97316"],
  animal: ["#84cc16"],
  number: ["#ec4899"],
  custom: ["#f59e0b", "#06b6d4"],
};

export const RAMP = [
  [30, 37, 56],    // Low / baseline activity (dark slate indigo)
  [99, 102, 241],  // 1-2σ: Electric Indigo
  [168, 85, 247],  // 2-3σ: Modern Purple
  [244, 63, 94],   // 3-4σ+: Electric Rose/Pink
];

export const BAR_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
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
  return kind === "head" ? `L${layer}·H${index}` : `L${layer}·N${index}`;
}

export function unitZ(
  a: AnalysisResponse,
  kind: ViewKind,
  layer: number,
  index: number,
  t: number
): number | null {
  if (kind === "head") return a.head_z[layer][index][t];
  const hit = a.neuron_top[layer][t].find((n) => n.neuron === index);
  return hit ? hit.z : null;
}

export function circuitUnitsAt(circuit: ActiveCircuit | null, view: ViewKind, layer: number): CircuitUnit[] {
  if (!circuit) return [];
  const list = view === "head" ? circuit.data.heads : circuit.data.neurons;
  return list.filter((u) => u.layer === layer);
}

export function cellDefault(a: AnalysisResponse, view: ViewKind, t: number, l: number) {
  if (view === "head") {
    let h = 0;
    for (let i = 1; i < a.num_heads; i++) {
      if (a.head_z[l][i][t] > a.head_z[l][h][t]) h = i;
    }
    return { kind: "head" as const, index: h, value: a.head_z[l][h][t] };
  }
  const top = a.neuron_top[l][t][0];
  return { kind: "neuron" as const, index: top.neuron, value: top.z };
}

export function cellInfo(
  a: AnalysisResponse,
  view: ViewKind,
  circuit: ActiveCircuit | null,
  sel: Selection | null,
  t: number,
  l: number
): {
  kind: ViewKind;
  index: number | null;
  value: number | null;
  circuit?: boolean;
  unit?: CircuitUnit;
} {
  if (circuit) {
    const units = circuitUnitsAt(circuit, view, l);
    if (!units.length) return { kind: view, index: null, value: null, circuit: false };
    let best = units[0];
    for (const u of units) {
      if (u.evidence[t] > best.evidence[t]) best = u;
    }
    if (sel && sel.t === t && sel.layer === l && sel.kind === view) {
      const pinned = units.find((u) => u.index === sel.index);
      if (pinned) best = pinned;
    }
    return { kind: view, index: best.index, value: best.evidence[t], circuit: true, unit: best };
  }
  if (sel && sel.t === t && sel.layer === l && sel.kind === view) {
    return {
      kind: view,
      index: sel.index,
      value: unitZ(a, sel.kind, l, sel.index, t) ?? cellDefault(a, view, t, l).value,
    };
  }
  return cellDefault(a, view, t, l);
}

export function scaleMax(
  a: AnalysisResponse | null,
  view: ViewKind,
  circuit: ActiveCircuit | null
): number {
  if (circuit) return 4;
  if (!a) return 3;
  const vals: number[] = [];
  for (let t = 0; t < a.tokens.length; t++) {
    for (let l = 0; l < a.num_layers; l++) {
      vals.push(cellDefault(a, view, t, l).value);
    }
  }
  vals.sort((x, y) => x - y);
  return Math.max(3, vals[Math.floor(vals.length * 0.95)] || 3);
}

export function bestSelection(
  a: AnalysisResponse,
  view: ViewKind,
  circuit: ActiveCircuit | null,
  t: number
): Selection {
  if (circuit) {
    const list = view === "head" ? circuit.data.heads : circuit.data.neurons;
    let best = list[0];
    for (const u of list) {
      if (u.evidence[t] > best.evidence[t]) best = u;
    }
    return { t, layer: best.layer, kind: view, index: best.index, reason: { type: "circuit" } };
  }
  const found = a.token_concepts[t][0];
  if (found) {
    const [layer, index] = a.concepts[found.key][view][t];
    return { t, layer, kind: view, index, reason: { type: "concept", concept: found } };
  }
  let bestL = 0;
  for (let l = 1; l < a.num_layers; l++) {
    if (cellDefault(a, view, t, l).value > cellDefault(a, view, t, bestL).value) bestL = l;
  }
  return { t, layer: bestL, kind: view, index: cellDefault(a, view, t, bestL).index, reason: { type: "max" } };
}
