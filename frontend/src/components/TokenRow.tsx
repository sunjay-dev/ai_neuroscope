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
        className="flex items-center px-6 py-2.5 bg-[#090b12] border-b border-white/[0.08] shrink-0"
      >
        <span className="text-slate-500 text-xs font-mono">
          Awaiting input forward pass…
        </span>
      </div>
    );
  }

  const curIdx = sel ? sel.t : 0;

  return (
    <div className="flex items-center gap-2 px-6 py-2 bg-[#090b12] border-b border-white/[0.08] shrink-0 select-none">
      {/* Playback Controls */}
      <div className="flex items-center gap-1 shrink-0 pr-2 border-r border-white/[0.08]">
        {onTogglePlay && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onTogglePlay}
            className={`w-7 h-7 text-xs cursor-pointer ${
              isPlaying
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50"
                : "text-slate-400 hover:text-white"
            }`}
            title={isPlaying ? "Pause Step-Through" : "Play Token Step-Through"}
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
              variant="ghost"
              size="icon"
              onClick={() => onNavToken(-1)}
              disabled={curIdx <= 0}
              className="w-6 h-6 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Previous Token (←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onNavToken(1)}
              disabled={curIdx >= analysis.tokens.length - 1}
              className="w-6 h-6 text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
              title="Next Token (→)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 shrink-0">
        Tokens:
      </span>

      {/* Scrollable Ribbon */}
      <div
        ref={containerRef}
        id="token-row"
        className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-1 py-0.5"
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
                backgroundColor: `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, #141724)`,
                borderColor: `color-mix(in srgb, ${color} ${Math.round(alpha * 80) + 20}%, transparent)`,
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
              className={`group relative flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono transition-all duration-150 shrink-0 border cursor-pointer ${
                isSelected
                  ? "bg-indigo-600/30 text-white font-semibold border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.4)] ring-1 ring-indigo-500/60"
                  : isTinted
                  ? "text-slate-100 hover:border-indigo-400"
                  : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:border-white/[0.2] hover:bg-white/[0.06] hover:text-white"
              }`}
              style={inlineStyle}
              title={title}
              onClick={() => onSelectToken(i)}
            >
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400 transition-colors">
                #{i}
              </span>
              <span className="tracking-tight">{tokenText}</span>
              {conceptBadge && (
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0 shadow-sm"
                  style={{
                    backgroundColor: conceptBadge.color,
                    boxShadow: `0 0 6px ${conceptBadge.color}`,
                  }}
                />
              )}
              {isSelected && (
                <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-indigo-400 rotate-45 shadow-sm" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
