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
import { Badge } from "./ui/badge";

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
      <div
        id="right-panel"
        className="bg-[#131627] border-l border-[#1e2235] p-5 overflow-y-auto flex flex-col gap-3.5 scrollbar-hidden max-[1100px]:border-l-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible"
      >
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#8892b0] uppercase tracking-[0.8px] pb-3 border-b border-[#1e2235]">
          <Badge variant="num">3</Badge>
          Neuron Details
        </div>
        <div id="details">
          <div className="text-center py-[30px] text-[#4a5568] text-[13px] leading-[1.7]">
            <div className="text-[24px] mb-2 text-[#7c6af0]">↖</div>
            Hover any word token above,
            <br />
            or click a node in the circuit
            <br />
            to inspect it here.
          </div>
        </div>
      </div>
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
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
            All {a.num_heads} heads in layer {sel.layer} on “{tok}”
          </div>
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${a.num_heads}, 1fr)` }}
          >
            {vals.map((v, h) => (
              <div
                key={h}
                className={`h-[22px] rounded-[4px] cursor-pointer text-[9px] font-mono text-white/75 flex items-center justify-center border ${
                  h === sel.index ? "border-white" : "border-transparent"
                }`}
                title={`Head ${h}: ${v.toFixed(2)}σ`}
                style={{ background: rampColor(Math.max(0, v) / vmax) }}
                onClick={() =>
                  onSelect({ ...sel, index: h, reason: { type: "manual" } })
                }
              >
                {h}
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      const tops = a.neuron_top[sel.layer]?.[sel.t] || [];
      return (
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
            Top neurons in layer {sel.layer} on “{tok}”
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tops.map((n) => (
              <span
                key={n.neuron}
                className={`py-1 px-2 bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[11px] font-mono cursor-pointer transition-colors ${
                  n.neuron === sel.index
                    ? "text-[#e8eaf6] border-[#c47af0]"
                    : "text-[#8892b0] hover:border-[#7c6af0] hover:text-[#e8eaf6]"
                }`}
                onClick={() =>
                  onSelect({ ...sel, index: n.neuron, reason: { type: "manual" } })
                }
              >
                N{n.neuron} · {n.z.toFixed(1)}σ
              </span>
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
    <div
      id="right-panel"
      className="bg-[#131627] border-l border-[#1e2235] p-5 overflow-y-auto flex flex-col gap-3.5 scrollbar-hidden max-[1100px]:border-l-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible"
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#8892b0] uppercase tracking-[0.8px] pb-3 border-b border-[#1e2235]">
        <Badge variant="num">3</Badge>
        Neuron Details
      </div>

      <div id="details" className="flex flex-col gap-4">
        {/* Header */}
        <div>
          <div className="text-[16px] font-semibold text-[#c47af0]">
            {unitName(sel.kind, sel.layer, sel.index)}
          </div>
          <div className="text-[12px] text-[#8892b0] mt-[3px]">
            {sel.kind === "head" ? "Attention head" : "MLP neuron"} on token{" "}
            <b className="text-[#e8eaf6] font-mono font-medium">“{tok}”</b> (#{sel.t + 1})
          </div>
        </div>

        {/* Why this node explanation */}
        {r.type === "concept" && (
          <div
            className="rounded-[7px] p-[9px_11px] text-[12px] leading-[1.5] text-[#8892b0]"
            style={{
              background: `color-mix(in srgb, ${conceptColor(
                r.concept.key,
                r.concept.z < 0 ? 1 : 0
              )} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${conceptColor(
                r.concept.key,
                r.concept.z < 0 ? 1 : 0
              )} 40%, transparent)`,
            }}
          >
            <strong className="text-[#e8eaf6]">
              {r.concept.name} detected → {r.concept.side}
            </strong>{" "}
            ({r.concept.z}σ vs ordinary text). This {sel.kind} is the member of the{" "}
            {r.concept.name.toLowerCase()} circuit firing hardest on “{tok}”.
          </div>
        )}
        {r.type === "circuit" && circuit && (
          <div
            className="rounded-[7px] p-[9px_11px] text-[12px] leading-[1.5] text-[#8892b0]"
            style={{
              background: `color-mix(in srgb, ${conceptColor(
                circuit.key
              )} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${conceptColor(
                circuit.key
              )} 40%, transparent)`,
            }}
          >
            Member of the{" "}
            <strong className="text-[#e8eaf6]">{circuit.data.name}</strong> circuit.
          </div>
        )}
        {r.type === "max" && (
          <div className="rounded-[7px] p-[9px_11px] text-[12px] leading-[1.5] text-[#8892b0] bg-[color-mix(in_srgb,#7c6af0_10%,transparent)] border border-[color-mix(in_srgb,#7c6af0_40%,transparent)]">
            No concept circuit fires on “{tok}”; showing the{" "}
            <strong className="text-[#e8eaf6]">
              most intensely firing {sel.kind}
            </strong>{" "}
            for it instead.
          </div>
        )}

        {/* Activation */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
            Activation
          </div>
          <div className="flex items-center gap-2">
            <div
              className="text-[15px] font-semibold font-mono text-[#e8eaf6] min-w-[54px]"
              id="act-num"
            >
              {z === null ? "…" : `${z.toFixed(2)}σ`}
            </div>
            <div className="flex-1 h-2.5 bg-[#1a1f35] rounded-[5px] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7c6af0] to-[#f072b8] rounded-[5px] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                id="act-fill"
                style={{
                  width: `${
                    z === null ? 0 : Math.max(0, Math.min(z / 10, 1)) * 100
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="text-[11px] text-[#4a5568]">
            σ = standard deviations above this {sel.kind}'s typical activity on ordinary text
            {sel.kind === "head"
              ? " (norm of the head's write into the residual stream)"
              : ""}
            .
          </div>
        </div>

        {/* Siblings */}
        {renderSiblings()}

        {/* Async Unit Dissection */}
        <div id="unit-async">
          {loadingUnit ? (
            <div className="text-[#4a5568] text-[12px]">Dissecting {sel.kind}…</div>
          ) : unitError ? (
            <div className="text-[#4a5568] text-[12px]">
              Couldn't load details: {unitError}
            </div>
          ) : unitData ? (
            <div className="flex flex-col gap-4">
              {/* Influence */}
              {sel.kind === "head" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
                    Top influencing tokens (where this head looks)
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
                      <>
                        {ranked.map((x, i) => (
                          <div key={x.j} className="flex items-center gap-2">
                            <div
                              className="text-[12px] font-mono text-[#e8eaf6] min-w-[70px] max-w-[90px] truncate"
                              title={showTok(a.tokens[x.j])}
                            >
                              {showTok(a.tokens[x.j])}
                            </div>
                            <div className="flex-1 h-1.5 bg-[#1a1f35] rounded-[3px] overflow-hidden">
                              <div
                                className="h-full rounded-[3px] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                                style={{
                                  width: `${Math.max(0, Math.min(100, x.w * 100)).toFixed(0)}%`,
                                  background: BAR_COLORS[i % BAR_COLORS.length],
                                }}
                              />
                            </div>
                            <div className="text-[11px] font-mono text-[#8892b0] min-w-[40px] text-right">
                              {x.w.toFixed(2)}
                            </div>
                          </div>
                        ))}
                        <div className="text-[11px] text-[#4a5568]">
                          {(sink * 100).toFixed(0)}% parked on the start-of-text “attention sink”.
                        </div>
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
                    This neuron across the sentence
                  </div>
                  {unitData.sentence_z.map((v, j) => {
                    const vmax = Math.max(1, ...unitData.sentence_z);
                    const pct = (Math.max(0, v) / vmax) * 100;
                    return (
                      <div key={j} className="flex items-center gap-2">
                        <div
                          className="text-[12px] font-mono text-[#e8eaf6] min-w-[70px] max-w-[90px] truncate"
                          title={showTok(a.tokens[j])}
                        >
                          {showTok(a.tokens[j])}
                        </div>
                        <div className="flex-1 h-1.5 bg-[#1a1f35] rounded-[3px] overflow-hidden">
                          <div
                            className="h-full rounded-[3px] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                            style={{
                              width: `${Math.max(0, Math.min(100, pct)).toFixed(0)}%`,
                              background: j === sel.t ? "#f072b8" : "#7c6af0",
                            }}
                          />
                        </div>
                        <div className="text-[11px] font-mono text-[#8892b0] min-w-[40px] text-right">
                          {v.toFixed(1)}σ
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Possible Concept */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
                  Possible concept
                </div>
                <div className="bg-[rgba(80,216,255,0.05)] border border-[rgba(80,216,255,0.2)] rounded-[7px] p-[10px_12px] text-[12px] text-[#8892b0] leading-[1.5]">
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
                      const also =
                        label && label.key !== reasonKey
                          ? ` It is polysemantic: its strongest probe match is actually ${label.name} → ${label.side} (d=${label.d}).`
                          : "";
                      return (
                        <>
                          <strong className="text-[#50d8ff]">
                            {focus.name} → {focus.side}
                          </strong>
                          <br />
                          <br />
                          Selectivity on the {focus.name.toLowerCase()} probe: d={focus.d} (Cohen's d), which ranks it among the top{" "}
                          {sel.kind === "head" ? "heads" : "neurons"} of the whole model for this concept.
                          {also}
                        </>
                      );
                    } else if (label) {
                      const meta = info?.concepts.find((c) => c.key === label.key);
                      const vs = meta?.binary
                        ? `than ${label.side === meta.side_a ? meta.side_b : meta.side_a} words`
                        : "than ordinary nouns";
                      return (
                        <>
                          <strong className="text-[#50d8ff]">
                            {label.name} → {label.side}
                          </strong>
                          <br />
                          <br />
                          On the probe sets this {sel.kind} fires{" "}
                          {Math.abs(label.d).toFixed(1)} pooled standard deviations more for {label.side} {vs} (Cohen's d).
                        </>
                      );
                    } else {
                      const top = unitData.concepts[0];
                      return (
                        <>
                          <strong className="text-[#50d8ff]">
                            No single dominant concept
                          </strong>
                          <br />
                          <br />
                          Strongest probe match is {top?.name} → {top?.side} (d={top?.d}), below the d ≥ 2 bar. Most heads/neurons are polysemantic or syntactic (position, punctuation, previous-token tracking).
                        </>
                      );
                    }
                  })()}
                </div>

                {/* Other concepts bar rows */}
                {unitData.concepts.map((c, i) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <div
                      className="text-[12px] font-mono text-[#e8eaf6] min-w-[70px] max-w-[90px] truncate"
                      title={c.name}
                    >
                      {c.name}
                    </div>
                    <div className="flex-1 h-1.5 bg-[#1a1f35] rounded-[3px] overflow-hidden">
                      <div
                        className="h-full rounded-[3px] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                        style={{
                          width: `${Math.max(0, Math.min(100, (c.score / 4) * 100)).toFixed(0)}%`,
                          background: BAR_COLORS[i % BAR_COLORS.length],
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-mono text-[#8892b0] min-w-[40px] text-right">
                      d={c.d}
                    </div>
                  </div>
                ))}
              </div>

              {/* Similar Activations */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
                  Similar activations (probe words that fire it most)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {unitData.top_words.map((w) => (
                    <span
                      key={w.word}
                      className="py-1 px-2.5 bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[11px] text-[#8892b0] font-mono"
                    >
                      <b className="text-[#e8eaf6] font-medium">{w.word}</b>{" "}
                      {w.z.toFixed(1)}σ
                    </span>
                  ))}
                </div>
              </div>

              {/* Promotes */}
              {unitData.promotes && unitData.promotes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
                    Pushes the next-word prediction toward
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {unitData.promotes.map((p, idx) => (
                      <span
                        key={idx}
                        className="py-1 px-2.5 bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[11px] text-[#8892b0] font-mono"
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

        {/* Concept read-out for this token across top 5 circuits */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
            Concept read-out for “{tok}”
          </div>
          {readout.map(({ key, meta, v }) => {
            const maxAbs = 6;
            const pct = Math.min(Math.abs(v) / maxAbs, 1) * 50;
            const left = v >= 0 ? 50 : 50 - pct;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="text-[12px] font-mono text-[#e8eaf6] min-w-[70px] max-w-[90px] truncate"
                  title={meta?.name}
                >
                  {meta?.name}
                </div>
                <div className="flex-1 h-1.5 bg-[#1a1f35] rounded-[3px] overflow-hidden relative before:content-[''] before:absolute before:left-1/2 before:top-0 before:bottom-0 before:w-[1px] before:bg-[#4a5568]">
                  <div
                    className="absolute top-0 h-full rounded-[3px] transition-[width,left] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                    style={{
                      left: `${left}%`,
                      width: `${pct}%`,
                      background: v >= 0 ? conceptColor(key, 0) : conceptColor(key, 1),
                    }}
                  />
                </div>
                <div className="text-[11px] font-mono text-[#8892b0] min-w-[40px] text-right">
                  {v > 0 ? "+" : ""}
                  {v.toFixed(1)}σ
                </div>
              </div>
            );
          })}
          <div className="text-[11px] text-[#4a5568]">
            Circuit reading vs ordinary text; |σ| ≥ 1.6 counts as detected. For two-sided concepts, right = first side (feminine, positive, sarcastic).
          </div>
        </div>

        {/* Predictions */}
        <div className="flex flex-col gap-1.5">
          <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">
            Model's next-word guess after “{tok}”
          </div>
          {preds.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="text-[12px] font-mono text-[#e8eaf6] min-w-[70px] max-w-[90px] truncate"
                title={showTok(p.token)}
              >
                {showTok(p.token)}
              </div>
              <div className="flex-1 h-1.5 bg-[#1a1f35] rounded-[3px] overflow-hidden">
                <div
                  className="h-full rounded-[3px] transition-[width] duration-500 ease-[cubic-bezier(.4,0,.2,1)]"
                  style={{
                    width: `${Math.max(0, Math.min(100, p.p * 100)).toFixed(0)}%`,
                    background: BAR_COLORS[i % BAR_COLORS.length],
                  }}
                />
              </div>
              <div className="text-[11px] font-mono text-[#8892b0] min-w-[40px] text-right">
                {(p.p * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
