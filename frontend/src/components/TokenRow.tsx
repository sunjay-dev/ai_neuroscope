import React from "react";
import { ActiveCircuit, AnalysisResponse, Selection } from "../types";
import { conceptColor, showTok } from "../constants";

interface TokenRowProps {
  analysis: AnalysisResponse | null;
  circuit: ActiveCircuit | null;
  sel: Selection | null;
  onSelectToken: (t: number) => void;
}

export const TokenRow: React.FC<TokenRowProps> = ({
  analysis,
  circuit,
  sel,
  onSelectToken,
}) => {
  if (!analysis) {
    return (
      <div
        id="token-row"
        className="flex flex-wrap gap-1.5 px-5 py-3 bg-[#131627] border-b border-[#1e2235] shrink-0 max-h-[140px] overflow-y-auto max-[1100px]:px-4"
      >
        <div className="text-[#4a5568] text-[12px] py-[3px]">
          Run analysis to see tokens...
        </div>
      </div>
    );
  }

  return (
    <div
      id="token-row"
      className="flex flex-wrap gap-1.5 px-5 py-3 bg-[#131627] border-b border-[#1e2235] shrink-0 max-h-[140px] overflow-y-auto max-[1100px]:px-4"
    >
      {analysis.tokens.map((tok, i) => {
        const isSelected = sel?.t === i;
        let title = "";
        let inlineStyle: React.CSSProperties = {};
        let isTinted = false;
        let dotColor: string | null = null;

        if (circuit) {
          const s = circuit.data.token_scores[i] ?? 0;
          const side = s >= 0 ? 0 : 1;
          const alpha = Math.min(Math.abs(s) / 5, 1) * 0.75;
          if (s > 0 || circuit.data.binary) {
            const color = conceptColor(circuit.key, side);
            inlineStyle = {
              background: `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, #1a1f35)`,
            };
            isTinted = true;
          }
          title = `${circuit.data.name}: ${s >= 0 ? "+" : ""}${s}σ vs ordinary text`;
        } else {
          const found = analysis.token_concepts[i];
          if (found && found.length > 0) {
            const c = found[0];
            const sideIdx = c.z < 0 ? 1 : 0;
            dotColor = conceptColor(c.key, sideIdx);
            title = found.map((x) => `${x.name}: ${x.side} (${x.z}σ)`).join("\n");
          }
        }

        return (
          <div
            key={i}
            data-idx={i}
            className={`relative py-[5px] px-2.5 rounded-[5px] text-[12px] font-mono cursor-pointer transition-all border ${
              isSelected
                ? "border-[#7c6af0] text-white font-medium shadow-[0_0_0_1px_#7c6af0,0_0_12px_rgba(124,106,240,0.35)]"
                : isTinted
                ? "border-[#1e2235] text-[#e8eaf6] hover:border-[#7c6af0]"
                : "bg-[#1a1f35] border-[#1e2235] text-[#8892b0] hover:border-[#7c6af0] hover:text-[#e8eaf6]"
            }`}
            style={inlineStyle}
            title={title}
            onMouseEnter={() => onSelectToken(i)}
            onClick={() => onSelectToken(i)}
          >
            {showTok(tok)}
            {dotColor && (
              <span
                className="absolute -top-[3px] -right-[3px] w-2 h-2 rounded-full border border-[#131627]"
                style={{ background: dotColor }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
