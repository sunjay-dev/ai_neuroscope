import React, { useState } from "react";
import { ActiveCircuit, ModelInfo } from "../types";
import { conceptColor } from "../constants";
import { Compass, Sparkles, Check, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface ConceptStudioViewProps {
  info: ModelInfo | null;
  circuit: ActiveCircuit | null;
  onSelectConcept: (key: string) => void;
  onCustomConcept: (wordsA: string[], wordsB: string[]) => void;
  onClearCircuit: () => void;
}

export const ConceptStudioView: React.FC<ConceptStudioViewProps> = ({
  info,
  circuit,
  onSelectConcept,
  onCustomConcept,
  onClearCircuit,
}) => {
  const [wordsA, setWordsA] = useState("");
  const [wordsB, setWordsB] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);

  const concepts = info?.concepts || [];

  const handleRunCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const a = wordsA
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean);
    const b = wordsB
      .split(/[,\n]/)
      .map((w) => w.trim())
      .filter(Boolean);

    if (a.length < 2 || b.length < 2) {
      setCustomError("Enter at least 2 words per side (e.g. happy, joyful vs sad, gloomy).");
      return;
    }
    setCustomError(null);
    onCustomConcept(a, b);
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto bg-[#08090e] p-6 custom-scrollbar select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Concept Circuits &amp; Contrastive Probing Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Pre-calibrated semantic subnetwork detectors using Cohen's d selectivity ($d \ge 2.0\sigma$). Filter the neural web to isolate specialized circuits.
          </p>
        </div>

        {circuit && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearCircuit}
            className="text-xs h-7 px-3 bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 cursor-pointer"
          >
            Clear Active Filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-6xl mx-auto w-full mb-8 max-[1000px]:grid-cols-2 max-[700px]:grid-cols-1">
        {concepts.map((c) => {
          const isActive = circuit?.key === c.key;
          const color = conceptColor(c.key);

          return (
            <div
              key={c.key}
              onClick={() => onSelectConcept(c.key)}
              className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isActive
                  ? "bg-indigo-950/40 border-indigo-400 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-500/15"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15]"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="text-sm font-semibold text-white">{c.name}</h3>
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-sky-300 bg-sky-500/20 px-2 py-0.5 rounded-full border border-sky-400/40">
                      <Check className="w-3 h-3" />
                      Active Filter
                    </span>
                  )}
                </div>

                <div className="text-[11px] font-mono text-slate-400 mb-3">
                  {c.binary ? (
                    <span className="text-slate-300">
                      {c.side_a} <span className="text-slate-500">↔</span> {c.side_b}
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      {c.side_a} <span className="text-slate-500">vs</span> baseline
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {c.examples.map((ex, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-300"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                variant={isActive ? "primary" : "secondary"}
                size="sm"
                className="w-full text-xs h-7"
              >
                {isActive ? "Clear Filter" : "Isolate Circuit"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Custom Contrastive Probe Section */}
      <div className="max-w-6xl mx-auto w-full p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] shadow-inner">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Custom Contrastive Probe Studio</h3>
        </div>
        <p className="text-xs text-slate-400 mb-4 max-w-2xl">
          Calibrate a real-time probe vector by contrasting two semantic word classes. The backend runs forward passes on both groups to extract circuit units dedicated to your concept.
        </p>

        <form onSubmit={handleRunCustom} className="space-y-4">
          <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Word Set A (Target Concept)
              </label>
              <textarea
                value={wordsA}
                onChange={(e) => setWordsA(e.target.value)}
                placeholder="doctor, surgeon, engineer, scientist, professor"
                className="w-full h-20 p-2.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Word Set B (Contrast Baseline)
              </label>
              <textarea
                value={wordsB}
                onChange={(e) => setWordsB(e.target.value)}
                placeholder="table, chair, pencil, stone, window, clock"
                className="w-full h-20 p-2.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {customError && (
            <div className="text-xs text-rose-400 font-medium">
              {customError}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" className="gap-1.5 text-xs h-8 px-4">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Calibrate &amp; Extract Circuit</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
