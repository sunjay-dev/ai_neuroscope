import React, { useEffect, useState } from "react";
import {
  ActiveCircuit,
  AnalysisResponse,
  ModelInfo,
  Selection,
  UnitDetailResponse,
} from "../types";
import {
  BAR_COLORS,
  conceptColor,
  rampColor,
  showTok,
  unitName,
  unitZ,
} from "../constants";
import { getUnitDetails } from "../api/client";
import { 
  Network, 
  Cpu, 
  Sparkles, 
  Compass, 
  X
} from "lucide-react";
import { Button } from "./ui/button";
import { TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";

interface RightPanelProps {
  analysis: AnalysisResponse | null;
  info: ModelInfo | null;
  circuit: ActiveCircuit | null;
  sel: Selection | null;
  onSelect: (sel: Selection) => void;
  onClose?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  analysis,
  info,
  circuit,
  sel,
  onSelect,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"flow" | "concepts" | "predictions">("flow");
  const [unitData, setUnitData] = useState<UnitDetailResponse | null>(null);
  const [loadingUnit, setLoadingUnit] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  const a = analysis;

  useEffect(() => {
    if (!a || !sel) {
      setUnitData(null);
      return;
    }

    let active = true;
    setLoadingUnit(true);
    setUnitError(null);

    getUnitDetails(a.analysis_id, sel.kind, sel.layer, sel.index)
      .then((data) => {
        if (active) {
          setUnitData(data);
          setLoadingUnit(false);
        }
      })
      .catch((err) => {
        if (active) {
          setUnitError(err.message);
          setLoadingUnit(false);
        }
      });

    return () => {
      active = false;
    };
  }, [a?.analysis_id, sel?.kind, sel?.layer, sel?.index]);

  if (!a || !sel) {
    return (
      <aside
        id="right-panel"
        className="w-[390px] bg-white border-l border-slate-200 p-6 overflow-y-auto flex flex-col gap-5 custom-scrollbar select-none shrink-0 max-[1100px]:w-full max-[1100px]:border-l-0 max-[1100px]:border-b"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-slate-800">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-xs text-indigo-600 font-mono font-bold">
              3
            </span>
            <span>Unit Inspector</span>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close inspector" className="cursor-pointer text-slate-400 hover:text-slate-900">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div id="details" className="my-auto flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
            <Compass className="w-7 h-7 text-indigo-500 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold text-slate-900">No Unit Selected</h3>
            <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">
              Hover any word above or click a node in the circuit web to inspect its mechanistic activations.
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const tok = showTok(a.tokens[sel.t]);
  const zNow = unitData?.sentence_z?.[sel.t];
  const z = zNow !== undefined ? zNow : unitZ(a, sel.kind, sel.layer, sel.index, sel.t);
  const r = sel.reason || { type: "manual" as const };

  // Sibling units in layer
  const renderSiblings = () => {
    if (sel.kind === "head") {
      const vals = a.head_z[sel.layer].map((row) => row[sel.t]);
      const vmax = Math.max(3, ...vals);
      return (
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
            <span>Layer {sel.layer} Heads on "{tok}"</span>
            <span className="text-slate-400">{a.num_heads} units</span>
          </div>
          <div
            className="grid gap-1.5 pt-1"
            style={{ gridTemplateColumns: `repeat(${a.num_heads}, 1fr)` }}
          >
            {vals.map((v, h) => (
              <button
                key={h}
                type="button"
                className={`h-7 rounded-md cursor-pointer text-[10px] font-mono flex items-center justify-center border transition-all ${
                  h === sel.index ? "border-indigo-600 ring-2 ring-indigo-500/30 font-bold scale-105 z-10 shadow-xs" : "border-slate-200 hover:border-slate-400"
                }`}
                title={`Head ${h}: ${(v >= 0 ? "+" : "") + v.toFixed(2)}σ`}
                style={{
                  backgroundColor: rampColor(Math.max(0, v) / vmax),
                  color: (v / vmax) > 0.5 ? "#ffffff" : "#0f172a",
                }}
                onClick={() =>
                  onSelect({ ...sel, index: h, reason: { type: "manual" } })
                }
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      );
    } else {
      const tops = a.neuron_top[sel.layer]?.[sel.t] || [];
      return (
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
            <span>Top Layer {sel.layer} Neurons on "{tok}"</span>
            <span className="text-slate-400">{tops.length} ranked</span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {tops.map((n) => (
              <button
                key={n.neuron}
                type="button"
                className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all cursor-pointer ${
                  n.neuron === sel.index
                    ? "bg-indigo-50 text-indigo-700 border-indigo-300 font-bold shadow-2xs"
                    : "bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300"
                }`}
                onClick={() =>
                  onSelect({ ...sel, index: n.neuron, reason: { type: "manual" } })
                }
              >
                N{n.neuron} · {n.z.toFixed(1)}σ
              </button>
            ))}
          </div>
        </div>
      );
    }
  };

  // Concept read-out
  const readout = Object.entries(a.concepts)
    .map(([key, c]) => {
      const meta = info?.concepts.find((x) => x.key === key);
      const v = c.z[sel.t];
      return { key, meta, v };
    })
    .filter((x) => x.meta)
    .sort((x, y) => Math.abs(y.v) - Math.abs(x.v))
    .slice(0, 5);

  const preds = a.predictions[sel.t] || [];

  return (
    <aside
      id="right-panel"
      className="w-[390px] bg-white border-l border-slate-200 flex flex-col custom-scrollbar select-none shrink-0 max-[1100px]:w-full max-[1100px]:border-l-0 max-[1100px]:border-b shadow-2xs"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Unit Inspector
          </span>
          <Badge variant="outline" className="uppercase font-mono text-[10px]">
            {sel.kind}
          </Badge>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close inspector" className="cursor-pointer text-slate-400 hover:text-slate-900">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Tabs (Clean Shadcn UI TabsList) */}
      <div className="px-6 py-2.5 border-b border-slate-200 bg-slate-50/60">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger
            active={activeTab === "flow"}
            onClick={() => setActiveTab("flow")}
          >
            Flow &amp; Weights
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === "concepts"}
            onClick={() => setActiveTab("concepts")}
          >
            Concept Probes
          </TabsTrigger>
          <TabsTrigger
            active={activeTab === "predictions"}
            onClick={() => setActiveTab("predictions")}
          >
            Predictions
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Body */}
      <div id="details" className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1 bg-white">
        {/* Unit Identity Card (Shared) */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3.5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                {sel.kind === "head" ? (
                  <Network className="w-4 h-4 text-indigo-600 shrink-0" />
                ) : (
                  <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
                )}
                <span>{unitName(sel.kind, sel.layer, sel.index)}</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                On token <span className="text-slate-900 font-mono font-bold bg-white border border-slate-200 px-1.5 py-0.5 rounded">"{tok}"</span> (#{sel.t + 1})
              </p>
            </div>
            <div className="text-right">
              <div id="act-num" className="text-lg font-mono font-black text-indigo-600">
                {z === null ? "—" : `${z >= 0 ? "+" : ""}${z.toFixed(2)}σ`}
              </div>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Activation</span>
            </div>
          </div>

          {/* Activation Meter */}
          <div className="space-y-1.5">
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                id="act-fill"
                className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full transition-all duration-300"
                style={{
                  width: `${z === null ? 0 : Math.max(0, Math.min(z / 8, 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span>0.0σ</span>
              <span>4.0σ</span>
              <span>8.0σ+</span>
            </div>
          </div>

          {/* Attribution explanation */}
          {r.type === "concept" && (
            <div
              className="rounded-lg p-3 text-xs leading-relaxed border shadow-2xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(
                  r.concept.key,
                  r.concept.z < 0 ? 1 : 0
                )} 10%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${conceptColor(
                  r.concept.key,
                  r.concept.z < 0 ? 1 : 0
                )} 30%, #e2e8f0)`,
              }}
            >
              <div className="font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{r.concept.name} Detected → {r.concept.side} ({r.concept.z.toFixed(1)}σ)</span>
              </div>
              <p className="text-slate-600 text-xs">
                Core member of the {r.concept.name.toLowerCase()} circuit firing hardest on "{tok}".
              </p>
            </div>
          )}
          {r.type === "circuit" && circuit && (
            <div
              className="rounded-lg p-3 text-xs leading-relaxed border shadow-2xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 10%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 30%, #e2e8f0)`,
              }}
            >
              <span className="font-bold text-slate-900">
                {circuit.data.name} Circuit Member
              </span>
            </div>
          )}
          {r.type === "max" && (
            <div className="rounded-lg p-3 text-xs leading-relaxed bg-white border border-slate-200 text-slate-700 shadow-2xs">
              <span className="text-slate-900 font-semibold">Layer Peak:</span> Highest activation on "{tok}".
            </div>
          )}
        </div>

        {/* Tab 1: Flow & Weights */}
        {activeTab === "flow" && (
          <div className="space-y-4">
            {/* Sibling Units in Layer */}
            {renderSiblings()}

            {/* Attention Targets or Sentence dynamics */}
            <div id="unit-async">
              {loadingUnit ? (
                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500 space-y-2.5">
                  <div className="w-5 h-5 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin mx-auto" />
                  <span>Loading attention flow…</span>
                </div>
              ) : unitError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {unitError}
                </div>
              ) : unitData ? (
                sel.kind === "head" ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                      <span>Attention Targets (where it looks)</span>
                      <span className="text-slate-400">Weight</span>
                    </div>
                    {(() => {
                      const row = a.attention[sel.layer]?.[sel.index]?.[sel.t] || [];
                      const ranked = row
                        .map((w, j) => ({ j, w }))
                        .filter((x) => x.j <= sel.t)
                        .sort((x, y) => y.w - x.w)
                        .slice(0, 5);
                      const sink = a.attention_sink[sel.layer]?.[sel.index]?.[sel.t] || 0;
                      return (
                        <div className="space-y-2 pt-1">
                          {ranked.map((x, i) => (
                            <div key={x.j} className="flex items-center gap-2.5 text-xs font-mono">
                              <span className="text-slate-800 min-w-[75px] max-w-[95px] truncate font-medium">
                                "{showTok(a.tokens[x.j])}"
                              </span>
                              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.max(3, Math.min(100, x.w * 100)).toFixed(0)}%`,
                                    backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                                  }}
                                />
                              </div>
                              <span className="text-slate-600 min-w-[40px] text-right font-bold">
                                {(x.w * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                          {sink > 0.05 && (
                            <div className="text-xs text-slate-500 pt-2 border-t border-slate-200 mt-2">
                              {(sink * 100).toFixed(0)}% absorbed by start-of-text attention sink.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                      <span>Neuron Sentence Trajectory</span>
                      <span className="text-slate-400">σ</span>
                    </div>
                    <div className="space-y-2 pt-1">
                      {unitData.sentence_z.map((v, j) => {
                        const vmax = Math.max(1, ...unitData.sentence_z);
                        const pct = (Math.max(0, v) / vmax) * 100;
                        const isCurrent = j === sel.t;
                        return (
                          <div key={j} className="flex items-center gap-2.5 text-xs font-mono">
                            <span className={`min-w-[75px] max-w-[95px] truncate ${isCurrent ? "text-indigo-600 font-bold" : "text-slate-600"}`}>
                              "{showTok(a.tokens[j])}"
                            </span>
                            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(3, Math.min(100, pct)).toFixed(0)}%`,
                                  backgroundColor: isCurrent ? "#4f46e5" : "#94a3b8",
                                }}
                              />
                            </div>
                            <span className={`min-w-[40px] text-right font-bold ${isCurrent ? "text-indigo-600" : "text-slate-500"}`}>
                              {v.toFixed(1)}σ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        )}

        {/* Tab 2: Concept Probes */}
        {activeTab === "concepts" && (
          <div className="space-y-4">
            {unitData && (
              <>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                    Dominant Concept Feature
                  </div>
                  <div className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed shadow-2xs">
                    {(() => {
                      const label = unitData.label;
                      if (label) {
                        return (
                          <div>
                            <span className="font-bold text-indigo-600 text-sm">
                              {label.name} → {label.side}
                            </span>
                            <p className="text-slate-600 mt-1 text-xs leading-relaxed">
                              Selectivity d={label.d.toFixed(2)} (Cohen's d). Fires {Math.abs(label.d).toFixed(1)} standard deviations more for {label.side} words.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div>
                          <span className="font-bold text-slate-800 text-sm">Syntactic / Polysemantic</span>
                          <p className="text-slate-500 mt-1 text-xs">
                            No single concept exceeded d ≥ 2.0 bar.
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Concept breakdown */}
                  <div className="space-y-2 pt-2">
                    {unitData.concepts.slice(0, 5).map((c, i) => (
                      <div key={c.key} className="flex items-center gap-2.5 text-xs font-mono">
                        <span className="text-slate-700 min-w-[75px] max-w-[95px] truncate font-medium">
                          {c.name}
                        </span>
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(3, Math.min(100, (c.score / 4) * 100)).toFixed(0)}%`,
                              backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                            }}
                          />
                        </div>
                        <span className="text-slate-600 min-w-[40px] text-right font-bold">
                          d={c.d.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Probed words */}
                {unitData.top_words && unitData.top_words.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                      Probed Calibration Words
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unitData.top_words.map((w) => (
                        <span
                          key={w.word}
                          className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-mono text-slate-800 shadow-2xs"
                        >
                          <span className="font-bold">{w.word}</span>{" "}
                          <span className="text-indigo-600 font-semibold">{w.z.toFixed(1)}σ</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Overall Concept Readout on token */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                <span>Token Concept Read-out</span>
                <span className="text-slate-400">Z-score</span>
              </div>
              <div className="space-y-2 pt-1">
                {readout.map(({ key, meta, v }) => {
                  const maxAbs = 5;
                  const pct = Math.min(Math.abs(v) / maxAbs, 1) * 50;
                  const left = v >= 0 ? 50 : 50 - pct;
                  return (
                    <div key={key} className="flex items-center gap-2.5 text-xs font-mono">
                      <span className="text-slate-700 min-w-[75px] max-w-[95px] truncate font-medium">
                        {meta?.name}
                      </span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden relative before:content-[''] before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-400">
                        <div
                          className="absolute top-0 h-full rounded-full transition-all duration-300"
                          style={{
                            left: `${left}%`,
                            width: `${Math.max(3, pct)}%`,
                            backgroundColor: v >= 0 ? conceptColor(key, 0) : conceptColor(key, 1),
                          }}
                        />
                      </div>
                      <span className="text-slate-600 min-w-[40px] text-right font-bold">
                        {v > 0 ? "+" : ""}{v.toFixed(1)}σ
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Predictions */}
        {activeTab === "predictions" && (
          <div className="space-y-4">
            {/* Next Word Prediction distribution */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                <span>Next-Word Prediction after "{tok}"</span>
                <span className="text-slate-400">Prob</span>
              </div>
              <div className="space-y-2 pt-1">
                {preds.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs font-mono">
                    <span className="text-slate-800 min-w-[75px] max-w-[95px] truncate font-medium">
                      "{showTok(p.token)}"
                    </span>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(3, Math.min(100, p.p * 100)).toFixed(0)}%`,
                          backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                    <span className="text-slate-600 min-w-[40px] text-right font-bold">
                      {(p.p * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Promotes (for neurons) */}
            {unitData?.promotes && unitData.promotes.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-600 font-semibold">
                  Neuron Promotes Next-Word Logits
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unitData.promotes.map((p, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 font-semibold shadow-2xs"
                    >
                      {showTok(p)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
