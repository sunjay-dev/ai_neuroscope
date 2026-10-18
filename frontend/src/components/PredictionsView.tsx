import React from "react";
import { AnalysisResponse, Selection } from "../types";
import { BAR_COLORS, conceptColor, showTok } from "../constants";
import { Sparkles, TrendingUp } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";

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
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 bg-slate-50">
        <TrendingUp className="w-12 h-12 text-slate-400 mb-4 animate-pulse" />
        <h3 className="text-base font-semibold text-slate-800">Awaiting Forward Pass</h3>
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
    <div className="flex-1 flex flex-col overflow-auto bg-slate-50 p-8 custom-scrollbar select-none">
      {/* Top Banner */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 mb-6 max-w-5xl mx-auto w-full">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Token Prediction Stream &amp; Information Entropy</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Step-by-step next token completion forecasts after each context position. Click any row to inspect its neural flow.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-600">
          <Card className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border-slate-200 shadow-2xs">
            <span className="text-slate-500 font-sans">Total Tokens:</span>
            <span className="text-emerald-700 font-bold text-sm font-mono">{analysis.tokens.length}</span>
          </Card>
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
                  ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-400/40 shadow-md"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-3">
                {/* Token Label */}
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 font-bold">
                    #{t}
                  </span>
                  <span className="text-sm font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-xl shadow-2xs">
                    "{showTok(tok)}"
                  </span>

                  {/* Concept Pills */}
                  {concepts.slice(0, 2).map((c) => (
                    <Badge
                      key={c.key}
                      variant="outline"
                      className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 border shadow-2xs"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${conceptColor(c.key)} 12%, #ffffff)`,
                        borderColor: `color-mix(in srgb, ${conceptColor(c.key)} 40%, transparent)`,
                        color: conceptColor(c.key),
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{c.name}: {c.side} ({c.z >= 0 ? "+" : ""}{c.z.toFixed(1)}σ)</span>
                    </Badge>
                  ))}
                </div>

                {/* Right: Entropy Gauge */}
                <div className="flex items-center gap-3.5 text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-[10px] uppercase font-bold text-slate-500 font-sans">Top Forecast:</span>
                    <span className="text-emerald-800 font-bold text-xs bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {topPred ? `"${showTok(topPred.token)}" (${(topPred.p * 100).toFixed(0)}%)` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 text-xs text-slate-700 shadow-inner">
                    <span className="text-slate-500 font-medium font-sans">H:</span>
                    <span className="text-indigo-700 font-extrabold">{entropy.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 font-sans">bits</span>
                  </div>
                </div>
              </div>

              {/* Predictions Probability Distribution Bars */}
              <div className="grid grid-cols-5 gap-3 pt-2.5 border-t border-slate-100">
                {preds.map((p, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-800 font-semibold truncate max-w-[90px]" title={p.token}>
                        "{showTok(p.token)}"
                      </span>
                      <span className="text-slate-500 font-bold">
                        {(p.p * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
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
