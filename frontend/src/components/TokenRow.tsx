import React, { useRef, useEffect } from "react";
import { ActiveCircuit, AnalysisResponse, Selection } from "../types";
import { conceptColor, showTok } from "../constants";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Button } from "./ui/button";

interface TokenRowProps {
  analysis: AnalysisResponse | null;
  circuit: ActiveCircuit | null;
  sel: Selection | null;
  onSelectToken: (t: number) => void;
  onNavToken?: (dir: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}

export const TokenRow: React.FC<TokenRowProps> = ({
  analysis,
  circuit,
  sel,
  onSelectToken,
  onNavToken,
  isPlaying = false,
  onTogglePlay,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll selected token into view if out of bounds
  useEffect(() => {
    if (sel && containerRef.current) {
      const activeEl = containerRef.current.querySelector(`[data-idx="${sel.t}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [sel?.t]);

  if (!analysis) {
    return (
      <div
        id="token-row"
        className="flex items-center px-6 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0"
      >
        <span className="text-slate-400 text-xs font-mono">
          Awaiting input forward pass…
        </span>
      </div>
    );
  }

  const curIdx = sel ? sel.t : 0;

  return (
    <div className="flex items-center gap-3 px-8 py-3 bg-slate-50/80 border-b border-slate-200 shrink-0 select-none">
      {/* Playback Controls */}
      <div className="flex items-center gap-1.5 shrink-0 pr-3.5 border-r border-slate-200">
        {onTogglePlay && (
          <Button
            variant={isPlaying ? "default" : "outline"}
            size="icon-sm"
            onClick={onTogglePlay}
            className="cursor-pointer"
            title={isPlaying ? "Pause Step-Through" : "Play Token Step-Through (Space)"}
          >
            {isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
          </Button>
        )}

        {onNavToken && (
          <>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onNavToken(-1)}
              disabled={curIdx <= 0}
              className="text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
              title="Previous Token (←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => onNavToken(1)}
              disabled={curIdx >= analysis.tokens.length - 1}
              className="text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
              title="Next Token (→)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      <span className="text-xs font-mono uppercase tracking-wider text-slate-500 font-semibold shrink-0">
        Tokens:
      </span>

      {/* Scrollable Ribbon */}
      <div
        ref={containerRef}
        id="token-row"
        className="flex items-center gap-2 overflow-x-auto custom-scrollbar flex-1 py-1"
      >
        {analysis.tokens.map((tok, i) => {
          const isSelected = sel?.t === i;
          let title = "";
          let inlineStyle: React.CSSProperties = {};
          let isTinted = false;
          let conceptBadge: { name: string; color: string; z?: number } | null = null;

          if (circuit) {
            const s = circuit.data.token_scores[i] ?? 0;
            const side = s >= 0 ? 0 : 1;
            const alpha = Math.min(Math.abs(s) / 5, 1) * 0.75;
            if (s > 0 || circuit.data.binary) {
              const color = conceptColor(circuit.key, side);
              inlineStyle = {
                backgroundColor: `color-mix(in srgb, ${color} ${Math.round(alpha * 50)}%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${color} 60%, #e2e8f0)`,
              };
              isTinted = true;
            }
            title = `${circuit.data.name}: ${s >= 0 ? "+" : ""}${s.toFixed(2)}σ evidence vs ordinary text`;
          } else {
            const found = analysis.token_concepts[i];
            if (found && found.length > 0) {
              const c = found[0];
              const sideIdx = c.z < 0 ? 1 : 0;
              const color = conceptColor(c.key, sideIdx);
              conceptBadge = { name: c.name, color, z: c.z };
              title = found.map((x) => `${x.name}: ${x.side} (${x.z.toFixed(2)}σ)`).join("\n");
            }
          }

          const tokenText = showTok(tok);

          return (
            <button
              key={i}
              type="button"
              data-idx={i}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-mono transition-all duration-150 shrink-0 border cursor-pointer ${
                isSelected
                  ? "bg-indigo-600 text-white font-bold border-indigo-600 shadow-xs ring-2 ring-indigo-500/30 scale-[1.02] z-10"
                  : isTinted
                  ? "hover:border-indigo-400 hover:bg-slate-50"
                  : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50 shadow-2xs"
              }`}
              style={isSelected ? undefined : inlineStyle}
              title={title}
              onClick={() => onSelectToken(i)}
            >
              <span className={`text-[11px] font-medium transition-colors ${
                isSelected ? "text-indigo-200" : "text-slate-400 group-hover:text-slate-600"
              }`}>
                #{i}
              </span>
              <span className="tracking-tight">{tokenText}</span>
              {conceptBadge && (
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-xs"
                  style={{
                    backgroundColor: conceptBadge.color,
                  }}
                />
              )}
              {isSelected && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-600 rotate-45 shadow-2xs" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
