import { AnalysisResponse, CircuitData, ModelInfo, UnitDetailResponse, ViewKind } from "../types";

const API = "/api";

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : undefined);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch (_) {
      // non-JSON error
    }
    throw new Error(detail);
  }
  return res.json();
}

export function getModelInfo() {
  return api<ModelInfo>("/model-info");
}

export function runAnalyze(text: string) {
  return api<AnalysisResponse>("/analyze", { text });
}

export function getConceptCircuit(body: { analysis_id: string; key?: string; words_a?: string[]; words_b?: string[] }) {
  return api<CircuitData>("/concept", body);
}

const unitCache = new Map<string, Promise<UnitDetailResponse>>();

export function getUnitDetails(analysis_id: string, kind: ViewKind, layer: number, index: number): Promise<UnitDetailResponse> {
  const key = `${analysis_id}:${kind}:${layer}:${index}`;
  if (!unitCache.has(key)) {
    const promise = api<UnitDetailResponse>(`/unit/${analysis_id}?kind=${kind}&layer=${layer}&index=${index}`)
      .catch((err) => {
        unitCache.delete(key);
        throw err;
      });
    unitCache.set(key, promise);
  }
  return unitCache.get(key)!;
}

export function clearUnitCache() {
  unitCache.clear();
}
