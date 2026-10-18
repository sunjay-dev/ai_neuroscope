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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
        <TrendingUp className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
        <h3 className="text-sm font-medium text-slate-400">Awaiting Forward Pass</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
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
    <div className="flex-1 flex flex-col overflow-auto bg-[#08090e] p-6 custom-scrollbar select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span>Token Prediction Stream &amp; Information Entropy</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Step-by-step next token completion forecasts after each context position. Click any row to inspect its neural flow.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1.5 bg-white/[0.03] px-2.5 py-1 rounded border border-white/[0.06]">
            <span>Total Tokens:</span>
            <span className="text-emerald-300 font-bold">{analysis.tokens.length}</span>
          </span>
        </div>
      </div>

      {/* Prediction Cards Grid */}
      <div className="space-y-3 max-w-4xl mx-auto w-full">
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
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "bg-indigo-950/30 border-indigo-500/80 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-2.5">
                {/* Token Label */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-slate-400">
                    #{t}
                  </span>
                  <span className="text-sm font-mono font-bold text-white bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded">
                    "{showTok(tok)}"
                  </span>

                  {/* Concept Pills */}
                  {concepts.slice(0, 2).map((c) => (
                    <span
                      key={c.key}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${conceptColor(c.key)} 15%, #141724)`,
                        borderColor: `color-mix(in srgb, ${conceptColor(c.key)} 40%, transparent)`,
                        color: conceptColor(c.key),
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>{c.name}: {c.side} ({c.z >= 0 ? "+" : ""}{c.z.toFixed(1)}σ)</span>
                    </span>
                  ))}
                </div>

                {/* Right: Entropy Gauge */}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="text-[10px] uppercase">Top Forecast:</span>
                    <span className="text-emerald-300 font-bold">
                      {topPred ? `"${showTok(topPred.token)}" (${(topPred.p * 100).toFixed(0)}%)` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded text-[11px] text-slate-400">
                    <span>H:</span>
                    <span className="text-indigo-300 font-bold">{entropy.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-500">bits</span>
                  </div>
                </div>
              </div>

              {/* Predictions Probability Distribution Bars */}
              <div className="grid grid-cols-5 gap-2 pt-1 border-t border-white/[0.04]">
                {preds.map((p, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-300 truncate max-w-[80px]" title={p.token}>
                        "{showTok(p.token)}"
                      </span>
                      <span className="text-slate-400 font-semibold">
                        {(p.p * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-black/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(2, p.p * 100)}%`,
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
