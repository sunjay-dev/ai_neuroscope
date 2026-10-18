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
    <div className="flex-1 flex flex-col overflow-auto bg-[#07080d] p-8 custom-scrollbar select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-5 border-b border-white/[0.08] mb-8 max-w-6xl mx-auto w-full">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Compass className="w-5 h-5 text-sky-400" />
            <span>Concept Circuits &amp; Contrastive Probing Studio</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pre-calibrated semantic subnetwork detectors using Cohen's d selectivity ($d \ge 2.0\sigma$). Filter the neural web to isolate specialized circuits.
          </p>
        </div>

        {circuit && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onClearCircuit}
            className="text-xs h-8 px-4 cursor-pointer"
          >
            Clear Active Filter
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5 max-w-6xl mx-auto w-full mb-10 max-[1000px]:grid-cols-2 max-[700px]:grid-cols-1">
        {concepts.map((c) => {
          const isActive = circuit?.key === c.key;
          const color = conceptColor(c.key);

          return (
            <div
              key={c.key}
              onClick={() => onSelectConcept(c.key)}
              className={`p-6 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isActive
                  ? "bg-indigo-950/45 border-indigo-400 ring-2 ring-indigo-500/50 shadow-2xl shadow-indigo-500/20 scale-[1.02]"
                  : "bg-[#0c0e17]/80 border-white/[0.08] hover:bg-[#101322]/90 hover:border-white/[0.18] shadow-lg"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="text-sm font-bold text-white">{c.name}</h3>
                  </div>
                  {isActive && (
                    <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-sky-300 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-400/40 shadow-sm">
                      <Check className="w-3 h-3" />
                      Active Filter
                    </span>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-400 mb-3.5">
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

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {c.examples.map((ex, i) => (
                    <span
                      key={i}
                      className="text-xs font-mono px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-slate-300"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                variant={isActive ? "primary" : "secondary"}
                size="sm"
                className="w-full text-xs h-8 font-semibold rounded-xl"
              >
                {isActive ? "Clear Filter" : "Isolate Circuit"}
              </Button>
            </div>
          );
        })}
      </div>

      {/* Custom Contrastive Probe Section */}
      <div className="max-w-6xl mx-auto w-full p-7 rounded-3xl bg-[#0c0e17]/90 border border-white/[0.1] shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold text-white">Custom Contrastive Probe Studio</h3>
        </div>
        <p className="text-xs text-slate-400 mb-5 max-w-2xl leading-relaxed">
          Calibrate a real-time probe vector by contrasting two semantic word classes. The backend runs forward passes on both groups to extract circuit units dedicated to your concept.
        </p>

        <form onSubmit={handleRunCustom} className="space-y-5">
          <div className="grid grid-cols-2 gap-5 max-[700px]:grid-cols-1">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">
                Word Set A (Target Concept)
              </label>
              <textarea
                value={wordsA}
                onChange={(e) => setWordsA(e.target.value)}
                placeholder="doctor, surgeon, engineer, scientist, professor"
                className="w-full h-28 p-3.5 rounded-xl bg-black/60 border border-white/[0.12] text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500/90 focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-inner resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-200">
                Word Set B (Contrast Baseline)
              </label>
              <textarea
                value={wordsB}
                onChange={(e) => setWordsB(e.target.value)}
                placeholder="table, chair, pencil, stone, window, clock"
                className="w-full h-28 p-3.5 rounded-xl bg-black/60 border border-white/[0.12] text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-indigo-500/90 focus:ring-2 focus:ring-indigo-500/30 transition-all shadow-inner resize-none"
              />
            </div>
          </div>

          {customError && (
            <div className="text-xs text-rose-400 font-medium">
              {customError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="default" className="gap-2 text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-lg shadow-indigo-600/30">
              <RefreshCw className="w-4 h-4" />
              <span>Calibrate &amp; Extract Circuit</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
