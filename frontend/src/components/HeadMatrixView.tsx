import React from "react";
import { ActiveCircuit, AnalysisResponse, Selection } from "../types";
import { conceptColor, rampColor, showTok } from "../constants";
import { Network, Sparkles } from "lucide-react";

interface HeadMatrixViewProps {
  analysis: AnalysisResponse | null;
  circuit: ActiveCircuit | null;
  sel: Selection | null;
  onSelectHead: (layer: number, head: number) => void;
}

export const HeadMatrixView: React.FC<HeadMatrixViewProps> = ({
  analysis,
  circuit,
  sel,
  onSelectHead,
}) => {
  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <Network className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-sm font-medium text-slate-400">Awaiting Forward Pass</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Enter a prompt and run analysis to inspect all 144 attention heads across the 12 transformer layers.
        </p>
      </div>
    );
  }

  const currentT = sel ? sel.t : 0;
  const currentToken = showTok(analysis.tokens[currentT]);
  const numLayers = analysis.num_layers; // 12
  const numHeads = analysis.num_heads; // 12

  // Find max activation for scale
  let maxZ = 3.0;
  for (let l = 0; l < numLayers; l++) {
    for (let h = 0; h < numHeads; h++) {
      const z = analysis.head_z[l]?.[h]?.[currentT] ?? 0;
      if (z > maxZ) maxZ = z;
    }
  }

  // Count active units
  let countHighZ = 0;
  let countSink = 0;
  let countCircuit = 0;

  for (let l = 0; l < numLayers; l++) {
    for (let h = 0; h < numHeads; h++) {
      const z = analysis.head_z[l]?.[h]?.[currentT] ?? 0;
      if (z >= 2.0) countHighZ++;
      const sink = analysis.attention_sink[l]?.[h]?.[currentT] ?? 0;
      if (sink >= 0.2) countSink++;
      if (circuit?.data.heads.some((u) => u.layer === l && u.index === h)) {
        countCircuit++;
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#08090e] p-6 custom-scrollbar select-none">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/[0.08] mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
              <Network className="w-4 h-4 text-indigo-400" />
              <span>144 Attention Heads Matrix</span>
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              12 Layers × 12 Heads
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Inspecting activation write norms on token{" "}
            <span className="text-slate-200 font-mono font-medium bg-white/[0.06] px-1.5 py-0.5 rounded">
              "{currentToken}"
            </span>{" "}
            (position #{currentT}). Click any head to inspect its attention pattern.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-indigo-300 font-bold">{countHighZ} / 144</span>
            <span className="text-[10px] text-slate-500">Heads &gt;2.0σ</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-amber-300 font-bold">{countSink}</span>
            <span className="text-[10px] text-slate-500">Sink Heads</span>
          </div>
          {circuit && (
            <div className="flex flex-col items-end">
              <span className="text-sky-300 font-bold">{countCircuit}</span>
              <span className="text-[10px] text-slate-500">Circuit Heads</span>
            </div>
          )}
        </div>
      </div>

      {/* 12x12 Grid Container */}
      <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full min-w-[700px]">
        {/* Column Headers: Head 0 to Head 11 */}
        <div className="grid grid-cols-[60px_repeat(12,1fr)] gap-1.5 mb-1.5 text-center text-[11px] font-mono text-slate-400">
          <div className="text-right pr-2 self-center text-slate-500">Layer</div>
          {Array.from({ length: numHeads }).map((_, h) => (
            <div key={h} className="py-1 rounded bg-white/[0.02] border border-white/[0.04] text-slate-400">
              H{h}
            </div>
          ))}
        </div>

        {/* Rows: Layer 0 to Layer 11 */}
        <div className="space-y-1.5">
          {Array.from({ length: numLayers }).map((_, l) => {
            const isSelectedLayer = sel?.kind === "head" && sel?.layer === l;

            return (
              <div
                key={l}
                className={`grid grid-cols-[60px_repeat(12,1fr)] gap-1.5 transition-colors ${
                  isSelectedLayer ? "bg-indigo-950/20 rounded-lg p-0.5" : ""
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center justify-end pr-3 text-xs font-mono font-medium text-slate-400">
                  <span className={isSelectedLayer ? "text-indigo-300 font-bold" : ""}>
                    L{l}
                  </span>
                </div>

                {/* 12 Head Cells in this Layer */}
                {Array.from({ length: numHeads }).map((_, h) => {
                  const z = analysis.head_z[l]?.[h]?.[currentT] ?? 0;
                  const sink = analysis.attention_sink[l]?.[h]?.[currentT] ?? 0;
                  const isSelected =
                    sel?.kind === "head" && sel?.layer === l && sel?.index === h;
                  const label = analysis.head_labels[l]?.[h];
                  const circuitUnit = circuit?.data.heads.find(
                    (u) => u.layer === l && u.index === h
                  );

                  const normFraction = Math.max(0, z) / maxZ;
                  const cellBg = rampColor(normFraction);

                  let borderColor = "border-white/[0.08]";
                  let ringStyle = "";

                  if (isSelected) {
                    borderColor = "border-white ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#08090e]";
                  } else if (circuitUnit) {
                    borderColor = "border-sky-400 shadow-sm shadow-sky-500/20";
                    ringStyle = "ring-1 ring-sky-400/80";
                  }

                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onSelectHead(l, h)}
                      className={`group relative h-14 rounded-lg border transition-all duration-150 p-1 flex flex-col justify-between text-left cursor-pointer hover:scale-105 hover:z-10 hover:shadow-xl ${borderColor} ${ringStyle}`}
                      style={{
                        backgroundColor: normFraction > 0.05 ? cellBg : "rgba(255, 255, 255, 0.02)",
                      }}
                      title={`L${l}H${h} on "${currentToken}": ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ | Sink: ${(sink * 100).toFixed(0)}%${
                        label ? ` | Concept: ${label.name}` : ""
                      }`}
                    >
                      {/* Top row: Head title & sink indicator */}
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-mono font-bold leading-none ${
                          isSelected ? "text-white" : normFraction > 0.4 ? "text-white/90" : "text-slate-300"
                        }`}>
                          H{h}
                        </span>
                        {sink >= 0.25 && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-amber-400"
                            title={`Attention Sink: ${(sink * 100).toFixed(0)}% to start token`}
                          />
                        )}
                        {circuitUnit && (
                          <Sparkles className="w-2.5 h-2.5 text-sky-300 animate-pulse" />
                        )}
                      </div>

                      {/* Middle: Activation value */}
                      <div className="text-right">
                        <span className={`text-[11px] font-mono font-semibold ${
                          normFraction > 0.4 ? "text-white" : z >= 1.5 ? "text-indigo-300" : "text-slate-400"
                        }`}>
                          {z >= 0 ? "+" : ""}{z.toFixed(1)}σ
                        </span>
                      </div>

                      {/* Bottom tag: Concept or specialization */}
                      {label ? (
                        <div
                          className="text-[8px] font-medium truncate px-1 rounded text-white"
                          style={{
                            backgroundColor: conceptColor(label.name.toLowerCase()),
                          }}
                        >
                          {label.name}
                        </div>
                      ) : (
                        <div className="h-1.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
