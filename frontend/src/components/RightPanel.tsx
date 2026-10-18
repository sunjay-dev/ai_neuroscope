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
  Compass
} from "lucide-react";

interface RightPanelProps {
  analysis: AnalysisResponse | null;
  info: ModelInfo | null;
  circuit: ActiveCircuit | null;
  sel: Selection | null;
  onSelect: (sel: Selection) => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  analysis,
  info,
  circuit,
  sel,
  onSelect,
}) => {
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
        className="bg-[#0e111a] border-l border-white/[0.08] p-5 overflow-y-auto flex flex-col gap-4 custom-scrollbar select-none max-[1100px]:border-l-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible"
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300 pb-3 border-b border-white/[0.06]">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-mono">
            3
          </span>
          <span>Unit Inspector</span>
        </div>
        <div id="details" className="my-auto flex flex-col items-center justify-center text-center p-6 space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-center text-slate-400 shadow-inner">
            <Compass className="w-6 h-6 text-indigo-400/80 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xs font-medium text-slate-200">No Unit Selected</h3>
            <p className="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
              Hover any word above or click a node in the circuit web to inspect its activations.
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

  // Sibling units
  const renderSiblings = () => {
    if (sel.kind === "head") {
      const vals = a.head_z[sel.layer].map((row) => row[sel.t]);
      const vmax = Math.max(3, ...vals);
      return (
        <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span>Layer {sel.layer} Heads on "{tok}"</span>
            <span className="text-slate-500">{a.num_heads} units</span>
          </div>
          <div
            className="grid gap-1 pt-1"
            style={{ gridTemplateColumns: `repeat(${a.num_heads}, 1fr)` }}
          >
            {vals.map((v, h) => (
              <button
                key={h}
                type="button"
                className={`h-6 rounded cursor-pointer text-[9px] font-mono text-white/90 flex items-center justify-center border transition-all ${
                  h === sel.index ? "border-white ring-1 ring-white/60 font-bold scale-105 z-10" : "border-transparent hover:border-white/40"
                }`}
                title={`Head ${h}: ${(v >= 0 ? "+" : "") + v.toFixed(2)}σ`}
                style={{ backgroundColor: rampColor(Math.max(0, v) / vmax) }}
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
        <div className="space-y-1.5 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span>Top Layer {sel.layer} Neurons on "{tok}"</span>
            <span className="text-slate-500">{tops.length} ranked</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {tops.map((n) => (
              <button
                key={n.neuron}
                type="button"
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                  n.neuron === sel.index
                    ? "bg-purple-500/20 text-purple-200 border-purple-500/50 font-semibold shadow-sm"
                    : "bg-white/[0.04] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/[0.15]"
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

  // Concept read-out for this token across every circuit (top 5)
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
      className="bg-[#0e111a] border-l border-white/[0.08] p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar select-none max-[1100px]:border-l-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible"
    >
      {/* Title */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-mono">
            3
          </span>
          <span>Unit Deep Dive</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-400 uppercase">
          {sel.kind}
        </span>
      </div>

      <div id="details" className="space-y-4">
        {/* Unit Identity & Hero Activation */}
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3.5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
                {sel.kind === "head" ? (
                  <Network className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                )}
                <span>{unitName(sel.kind, sel.layer, sel.index)}</span>
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Evaluated at token{" "}
                <span className="text-slate-200 font-mono font-medium">"{tok}"</span>{" "}
                <span className="text-slate-500 font-mono">(#{sel.t + 1})</span>
              </p>
            </div>
            <div className="text-right">
              <div id="act-num" className="text-base font-mono font-bold text-indigo-300">
                {z === null ? "—" : `${z >= 0 ? "+" : ""}${z.toFixed(2)}σ`}
              </div>
              <span className="text-[9.5px] font-mono text-slate-500 uppercase">Activation</span>
            </div>
          </div>

          {/* Activation Meter */}
          <div className="space-y-1">
            <div className="h-2 bg-black/40 border border-white/[0.06] rounded-full overflow-hidden">
              <div
                id="act-fill"
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-300"
                style={{
                  width: `${z === null ? 0 : Math.max(0, Math.min(z / 8, 1)) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-500">
              <span>Baseline 0.0σ</span>
              <span>4.0σ</span>
              <span>8.0σ+</span>
            </div>
          </div>

          {/* Attribution explanation */}
          {r.type === "concept" && (
            <div
              className="rounded-md p-2.5 text-[11px] leading-relaxed border"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(
                  r.concept.key,
                  r.concept.z < 0 ? 1 : 0
                )} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${conceptColor(
                  r.concept.key,
                  r.concept.z < 0 ? 1 : 0
                )} 30%, transparent)`,
              }}
            >
              <div className="font-semibold text-slate-200 flex items-center gap-1 mb-0.5">
                <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                <span>{r.concept.name} Detected → {r.concept.side} ({r.concept.z.toFixed(1)}σ)</span>
              </div>
              <p className="text-slate-400">
                This {sel.kind} is the core member of the {r.concept.name.toLowerCase()} circuit firing hardest on "{tok}".
              </p>
            </div>
          )}
          {r.type === "circuit" && circuit && (
            <div
              className="rounded-md p-2.5 text-[11px] leading-relaxed border"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 30%, transparent)`,
              }}
            >
              <span className="font-semibold text-slate-200">
                {circuit.data.name} Circuit Member
              </span>
              <p className="text-slate-400 mt-0.5">
                Active within the isolated {circuit.data.name.toLowerCase()} mechanism.
              </p>
            </div>
          )}
          {r.type === "max" && (
            <div className="rounded-md p-2.5 text-[11px] leading-relaxed bg-white/[0.03] border border-white/[0.08] text-slate-400">
              <span className="text-slate-300 font-medium">Layer Salience Peak:</span>{" "}
              No single concept circuit dominates "{tok}"; showing the most active {sel.kind} for this token.
            </div>
          )}
        </div>

        {/* Sibling Units in Layer */}
        {renderSiblings()}

        {/* Async Detailed Dissection */}
        <div id="unit-async">
          {loadingUnit ? (
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center text-xs text-slate-400 space-y-2">
              <div className="w-4 h-4 rounded-full border-2 border-indigo-400/40 border-t-indigo-400 animate-spin mx-auto" />
              <span>Dissecting unit weights &amp; calibration…</span>
            </div>
          ) : unitError ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
              Could not dissect unit: {unitError}
            </div>
          ) : unitData ? (
            <div className="space-y-4">
              {/* Attention Destinations (where this head looks) */}
              {sel.kind === "head" ? (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Attention Targets (where it looks)</span>
                    <span className="text-slate-500">Weight (w)</span>
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
                      <div className="space-y-1.5 pt-0.5">
                        {ranked.map((x, i) => (
                          <div key={x.j} className="flex items-center gap-2 text-xs">
                            <span className="text-[11px] font-mono text-slate-300 min-w-[70px] max-w-[85px] truncate">
                              {showTok(a.tokens[x.j])}
                            </span>
                            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${Math.max(0, Math.min(100, x.w * 100)).toFixed(0)}%`,
                                  backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-slate-400 min-w-[36px] text-right">
                              {(x.w * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                        {sink > 0.05 && (
                          <div className="text-[10px] text-slate-500 pt-1 border-t border-white/[0.04]">
                            {(sink * 100).toFixed(0)}% absorbed by start-of-text attention sink.
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Neuron Sentence Trajectory</span>
                    <span className="text-slate-500">σ</span>
                  </div>
                  <div className="space-y-1.5 pt-0.5">
                    {unitData.sentence_z.map((v, j) => {
                      const vmax = Math.max(1, ...unitData.sentence_z);
                      const pct = (Math.max(0, v) / vmax) * 100;
                      const isCurrent = j === sel.t;
                      return (
                        <div key={j} className="flex items-center gap-2 text-xs">
                          <span className={`text-[11px] font-mono min-w-[70px] max-w-[85px] truncate ${isCurrent ? "text-pink-300 font-semibold" : "text-slate-400"}`}>
                            {showTok(a.tokens[j])}
                          </span>
                          <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.max(0, Math.min(100, pct)).toFixed(0)}%`,
                                backgroundColor: isCurrent ? "#ec4899" : "#6366f1",
                              }}
                            />
                          </div>
                          <span className={`text-[10px] font-mono min-w-[36px] text-right ${isCurrent ? "text-pink-300 font-semibold" : "text-slate-400"}`}>
                            {v.toFixed(1)}σ
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Concept Affinity & Cohen's d */}
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2.5">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Concept Selectivity (Cohen's d)
                </div>

                <div className="p-2.5 rounded-md bg-sky-500/[0.05] border border-sky-500/20 text-[11px] text-slate-300 leading-relaxed">
                  {(() => {
                    const label = unitData.label;
                    const reasonKey =
                      r.type === "concept"
                        ? r.concept.key
                        : r.type === "circuit" && circuit
                        ? circuit.key
                        : null;
                    const focus = reasonKey && unitData.all_concepts[reasonKey];

                    if (focus) {
                      return (
                        <div>
                          <span className="font-semibold text-sky-400">
                            {focus.name} → {focus.side}
                          </span>
                          <p className="text-slate-400 mt-1">
                            Selectivity d={focus.d.toFixed(2)}, placing this unit among the model's primary circuits for this concept.
                          </p>
                        </div>
                      );
                    } else if (label) {
                      return (
                        <div>
                          <span className="font-semibold text-sky-400">
                            {label.name} → {label.side}
                          </span>
                          <p className="text-slate-400 mt-1">
                            Fires {Math.abs(label.d).toFixed(1)} pooled standard deviations more for {label.side} words.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div>
                          <span className="font-semibold text-slate-300">Polysemantic / Syntactic</span>
                          <p className="text-slate-400 mt-1">
                            No single concept exceeded d ≥ 2.0. Likely encodes positional, syntactic, or multi-modal features.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </div>

                {/* Concept breakdown */}
                <div className="space-y-1.5">
                  {unitData.concepts.slice(0, 4).map((c, i) => (
                    <div key={c.key} className="flex items-center gap-2 text-xs">
                      <span className="text-[11px] font-mono text-slate-300 min-w-[70px] max-w-[85px] truncate">
                        {c.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(0, Math.min(100, (c.score / 4) * 100)).toFixed(0)}%`,
                            backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 min-w-[36px] text-right">
                        d={c.d.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Similar probe words */}
              {unitData.top_words && unitData.top_words.length > 0 && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Probed Calibration Words
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unitData.top_words.map((w) => (
                      <span
                        key={w.word}
                        className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] font-mono text-slate-300"
                      >
                        <span className="text-white font-medium">{w.word}</span>{" "}
                        <span className="text-indigo-400">{w.z.toFixed(1)}σ</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Promotes next tokens (for neurons) */}
              {unitData.promotes && unitData.promotes.length > 0 && (
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Promotes Next-Word Logits
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {unitData.promotes.map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-300"
                      >
                        {showTok(p)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Global Concept Read-out across sentence for this token */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span>Overall Concept Read-out</span>
            <span className="text-slate-500">Z-score</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            {readout.map(({ key, meta, v }) => {
              const maxAbs = 5;
              const pct = Math.min(Math.abs(v) / maxAbs, 1) * 50;
              const left = v >= 0 ? 50 : 50 - pct;
              return (
                <div key={key} className="flex items-center gap-2 text-xs">
                  <span className="text-[11px] font-mono text-slate-300 min-w-[70px] max-w-[85px] truncate">
                    {meta?.name}
                  </span>
                  <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden relative before:content-[''] before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-[1px] before:bg-white/20">
                    <div
                      className="absolute top-0 h-full rounded-full transition-all duration-300"
                      style={{
                        left: `${left}%`,
                        width: `${pct}%`,
                        backgroundColor: v >= 0 ? conceptColor(key, 0) : conceptColor(key, 1),
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 min-w-[36px] text-right">
                    {v > 0 ? "+" : ""}{v.toFixed(1)}σ
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Word Prediction distribution */}
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400">
            <span>Next-Word Prediction</span>
            <span className="text-slate-500">Probability</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            {preds.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-[11px] font-mono text-slate-300 min-w-[70px] max-w-[85px] truncate">
                  "{showTok(p.token)}"
                </span>
                <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, p.p * 100)).toFixed(0)}%`,
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
                <span className="text-[10px] font-mono text-slate-400 min-w-[36px] text-right">
                  {(p.p * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
