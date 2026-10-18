import React, { useState } from "react";
import { ActiveCircuit, ModelInfo } from "../types";
import { conceptColor } from "../constants";
import { Compass, Sparkles, Check, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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
    <div className="flex-1 flex flex-col overflow-auto bg-slate-50 p-8 custom-scrollbar select-none">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200 mb-8 max-w-6xl mx-auto w-full">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" />
            <span>Concept Circuits &amp; Contrastive Probing Studio</span>
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Pre-calibrated semantic subnetwork detectors using Cohen's d selectivity (d &ge; 2.0σ). Filter the neural web to isolate specialized circuits.
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
                  ? "bg-indigo-50/70 border-indigo-500 ring-2 ring-indigo-400 shadow-md scale-[1.01]"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md shadow-2xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shadow-2xs"
                      style={{ backgroundColor: color }}
                    />
                    <h3 className="text-sm font-bold text-slate-900">{c.name}</h3>
                  </div>
                  {isActive && (
                    <Badge variant="outline" className="flex items-center gap-1 text-xs font-mono font-bold text-sky-700 bg-sky-50 border-sky-300">
                      <Check className="w-3 h-3" />
                      Active Filter
                    </Badge>
                  )}
                </div>

                <div className="text-xs font-mono text-slate-500 mb-3.5">
                  {c.binary ? (
                    <span>
                      {c.side_a} <span className="text-slate-400">↔</span> {c.side_b}
                    </span>
                  ) : (
                    <span>
                      {c.side_a} <span className="text-slate-400">vs</span> baseline
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-5">
                  {c.examples.map((ex, i) => (
                    <span
                      key={i}
                      className="text-xs font-mono px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 shadow-2xs"
                    >
                      {ex}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                variant={isActive ? "outline" : "default"}
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
      <div className="max-w-6xl mx-auto w-full p-7 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Custom Contrastive Probe Studio</h3>
        </div>
        <p className="text-xs text-slate-600 mb-5 max-w-2xl leading-relaxed">
          Calibrate a real-time probe vector by contrasting two semantic word classes. The backend runs forward passes on both groups to extract circuit units dedicated to your concept.
        </p>

        <form onSubmit={handleRunCustom} className="space-y-5">
          <div className="grid grid-cols-2 gap-5 max-[700px]:grid-cols-1">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Word Set A (Target Concept)
              </label>
              <textarea
                value={wordsA}
                onChange={(e) => setWordsA(e.target.value)}
                placeholder="doctor, surgeon, engineer, scientist, professor"
                className="w-full h-28 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner resize-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">
                Word Set B (Contrast Baseline)
              </label>
              <textarea
                value={wordsB}
                onChange={(e) => setWordsB(e.target.value)}
                placeholder="table, chair, pencil, stone, window, clock"
                className="w-full h-28 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all shadow-inner resize-none"
              />
            </div>
          </div>

          {customError && (
            <div className="text-xs text-rose-600 font-medium">
              {customError}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="default" size="default" className="gap-2 text-xs font-bold h-10 px-5 rounded-xl cursor-pointer shadow-xs">
              <RefreshCw className="w-4 h-4" />
              <span>Calibrate &amp; Extract Circuit</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
