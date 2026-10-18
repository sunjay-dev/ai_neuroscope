import React from "react";
import { AnalysisResponse, Selection } from "../types";
import { BAR_COLORS, conceptColor, showTok } from "../constants";
import { Sparkles, TrendingUp } from "lucide-react";

interface PredictionsViewProps {
  analysis: AnalysisResponse | null;
  sel: Selection | null;
  onSelectToken: (t: number) => void;
}

export const PredictionsView: React.FC<PredictionsViewProps> = ({
  analysis,
  sel,
  onSelectToken,
}) => {
  if (!analysis) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
        <TrendingUp className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-300">Awaiting Forward Pass</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
          Enter a prompt to inspect next-token distributions, probability forecasts, and prediction entropy.
        </p>
      </div>
    );
  }

  // Calculate Shannon entropy for each token position
  const entropies = analysis.predictions.map((preds) => {
    let h = 0;
    preds.forEach((p) => {
      if (p.p > 0) {
        h -= p.p * Math.log2(p.p);
      }
    });
    return h;
  });

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#07080d] p-8 custom-scrollbar select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-6 max-w-5xl mx-auto w-full">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>Token Prediction Stream &amp; Information Entropy</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Step-by-step next token completion forecasts after each context position. Click any row to inspect its neural flow.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
          <span className="flex items-center gap-2 bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.08]">
            <span className="text-slate-400">Total Tokens:</span>
            <span className="text-emerald-300 font-bold text-sm">{analysis.tokens.length}</span>
          </span>
        </div>
      </div>

      {/* Prediction Cards Grid */}
      <div className="space-y-4 max-w-5xl mx-auto w-full">
        {analysis.tokens.map((tok, t) => {
          const isSelected = sel?.t === t;
          const preds = analysis.predictions[t] || [];
          const concepts = analysis.token_concepts[t] || [];
          const entropy = entropies[t] || 0;
          const topPred = preds[0];

          return (
            <div
              key={t}
              onClick={() => onSelectToken(t)}
              className={`p-4.5 rounded-2xl border transition-all duration-200 cursor-pointer ${
                isSelected
                  ? "bg-indigo-950/35 border-indigo-400 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-500/15"
                  : "bg-[#0c0e17]/80 border-white/[0.08] hover:bg-[#101322]/90 hover:border-white/[0.18] shadow-md"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                {/* Token Label */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-white/[0.06] text-slate-400 font-medium">
                    #{t}
                  </span>
                  <span className="text-sm font-mono font-bold text-white bg-indigo-500/20 border border-indigo-500/35 px-2.5 py-1 rounded-xl shadow-sm">
                    "{showTok(tok)}"
                  </span>

                  {/* Concept Pills */}
                  {concepts.slice(0, 2).map((c) => (
                    <span
                      key={c.key}
                      className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 border shadow-sm"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${conceptColor(c.key)} 15%, #141724)`,
                        borderColor: `color-mix(in srgb, ${conceptColor(c.key)} 40%, transparent)`,
                        color: conceptColor(c.key),
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{c.name}: {c.side} ({c.z >= 0 ? "+" : ""}{c.z.toFixed(1)}σ)</span>
                    </span>
                  ))}
                </div>

                {/* Right: Entropy Gauge */}
                <div className="flex items-center gap-3.5 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Top Forecast:</span>
                    <span className="text-emerald-300 font-bold text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {topPred ? `"${showTok(topPred.token)}" (${(topPred.p * 100).toFixed(0)}%)` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1 rounded-xl border border-white/[0.08] text-xs text-slate-300 shadow-inner">
                    <span className="text-slate-400 font-medium">H:</span>
                    <span className="text-indigo-300 font-extrabold">{entropy.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500">bits</span>
                  </div>
                </div>
              </div>

              {/* Predictions Probability Distribution Bars */}
              <div className="grid grid-cols-5 gap-3 pt-2.5 border-t border-white/[0.06]">
                {preds.map((p, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-200 font-medium truncate max-w-[90px]" title={p.token}>
                        "{showTok(p.token)}"
                      </span>
                      <span className="text-slate-400 font-bold">
                        {(p.p * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/[0.04]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(3, p.p * 100)}%`,
                          backgroundColor: BAR_COLORS[idx % BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
