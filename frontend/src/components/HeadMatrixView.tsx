import React from "react";
import { ActiveCircuit, AnalysisResponse, Selection } from "../types";
import { conceptColor, rampColor, showTok } from "../constants";
import { Network, Sparkles } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-slate-50">
        <Network className="w-12 h-12 text-slate-400 mb-4 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-800">Awaiting Forward Pass</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
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
    <div className="flex-1 flex flex-col overflow-auto bg-slate-50 p-10 custom-scrollbar select-none">
      {/* Header Info Banner */}
      <div className="flex items-center justify-between gap-6 pb-6 border-b border-slate-200 mb-8 max-w-6xl mx-auto w-full">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              <span>144 Attention Heads Matrix</span>
            </h2>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-mono">
              12 Layers × 12 Heads
            </Badge>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Inspecting activation write norms on token{" "}
            <span className="text-slate-900 font-mono font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md shadow-2xs">
              "{currentToken}"
            </span>{" "}
            (position #{currentT}). Click any head to inspect its attention pattern.
          </p>
        </div>

        {/* Quick Stats Banner Cards */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <Card className="flex flex-col items-center px-3.5 py-1.5 bg-white border-slate-200 shadow-2xs">
            <span className="text-indigo-600 font-bold text-sm">{countHighZ} / 144</span>
            <span className="text-[10px] text-slate-500 font-sans">Heads &gt;2.0σ</span>
          </Card>
          <Card className="flex flex-col items-center px-3.5 py-1.5 bg-white border-slate-200 shadow-2xs">
            <span className="text-amber-600 font-bold text-sm">{countSink}</span>
            <span className="text-[10px] text-slate-500 font-sans">Sink Heads</span>
          </Card>
          {circuit && (
            <Card className="flex flex-col items-center px-3.5 py-1.5 bg-sky-50 border-sky-200 shadow-2xs">
              <span className="text-sky-700 font-bold text-sm">{countCircuit}</span>
              <span className="text-[10px] text-sky-600 font-sans">Circuit Heads</span>
            </Card>
          )}
        </div>
      </div>

      {/* 12x12 Grid Container */}
      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full min-w-[820px]">
        {/* Column Headers: Head 0 to Head 11 */}
        <div className="grid grid-cols-[64px_repeat(12,1fr)] gap-2.5 mb-2.5 text-center text-xs font-mono text-slate-500">
          <div className="text-right pr-3 self-center font-bold text-slate-500">Layer</div>
          {Array.from({ length: numHeads }).map((_, h) => (
            <div key={h} className="py-2 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold shadow-2xs">
              H{h}
            </div>
          ))}
        </div>

        {/* Rows: Layer 0 to Layer 11 */}
        <div className="space-y-2.5">
          {Array.from({ length: numLayers }).map((_, l) => {
            const isSelectedLayer = sel?.kind === "head" && sel?.layer === l;

            return (
              <div
                key={l}
                className={`grid grid-cols-[64px_repeat(12,1fr)] gap-2.5 transition-colors ${
                  isSelectedLayer ? "bg-indigo-50/70 border border-indigo-200/60 rounded-2xl p-1.5" : ""
                }`}
              >
                {/* Row Header */}
                <div className="flex items-center justify-end pr-3.5 text-xs font-mono font-bold text-slate-500">
                  <span className={isSelectedLayer ? "text-indigo-700 text-sm font-black" : ""}>
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

                  let borderColor = "border-slate-200";
                  let ringStyle = "";

                  if (isSelected) {
                    borderColor = "border-indigo-600 ring-2 ring-indigo-500 ring-offset-2 ring-offset-white scale-105 z-20 shadow-md";
                  } else if (circuitUnit) {
                    borderColor = "border-sky-500 shadow-sm";
                    ringStyle = "ring-1.5 ring-sky-400";
                  }

                  const isHighContrastWhiteText = normFraction > 0.45;

                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onSelectHead(l, h)}
                      className={`group relative h-[76px] rounded-xl border transition duration-150 p-2 flex flex-col justify-between text-left cursor-pointer hover:scale-105 hover:z-10 hover:shadow-md ${borderColor} ${ringStyle}`}
                      style={{
                        backgroundColor: normFraction > 0.05 ? cellBg : "#ffffff",
                      }}
                      title={`L${l}H${h} on "${currentToken}": ${z >= 0 ? "+" : ""}${z.toFixed(2)}σ | Sink: ${(sink * 100).toFixed(0)}%${
                        label ? ` | Concept: ${label.name}` : ""
                      }`}
                    >
                      {/* Top row: Head title & sink indicator */}
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] font-mono font-bold leading-none ${
                          isHighContrastWhiteText ? "text-white" : "text-slate-800"
                        }`}>
                          H{h}
                        </span>
                        {sink >= 0.25 && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-500 shadow-xs"
                            title={`Attention Sink: ${(sink * 100).toFixed(0)}% to start token`}
                          />
                        )}
                        {circuitUnit && (
                          <Sparkles className="w-3 h-3 text-sky-500 animate-pulse" />
                        )}
                      </div>

                      {/* Middle: Activation value */}
                      <div className="text-right">
                        <span className={`text-xs font-mono font-bold ${
                          isHighContrastWhiteText ? "text-white" : z >= 1.5 ? "text-indigo-700" : "text-slate-500"
                        }`}>
                          {z >= 0 ? "+" : ""}{z.toFixed(1)}σ
                        </span>
                      </div>

                      {/* Bottom tag: Concept or specialization */}
                      {label ? (
                        <div
                          className="text-[9px] font-semibold truncate px-1.5 py-0.5 rounded-md text-white shadow-xs"
                          style={{
                            backgroundColor: conceptColor(label.name.toLowerCase()),
                          }}
                        >
                          {label.name}
                        </div>
                      ) : (
                        <div className="h-2" />
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
