import React, { useState } from "react";
import { ActiveCircuit, ModelInfo } from "../types";
import { conceptColor } from "../constants";
import { Button } from "./ui/button";
import { 
  X, 
  Compass, 
  RotateCcw, 
  Zap 
} from "lucide-react";

interface ConceptModalProps {
  isOpen: boolean;
  onClose: () => void;
  info: ModelInfo | null;
  circuit: ActiveCircuit | null;
  onSelectConcept: (key: string) => void;
  onCustomConcept: (wordsA: string[], wordsB: string[]) => void;
  onClearCircuit: () => void;
}

export const ConceptModal: React.FC<ConceptModalProps> = ({
  isOpen,
  onClose,
  info,
  circuit,
  onSelectConcept,
  onCustomConcept,
  onClearCircuit,
}) => {
  const [activeTab, setActiveTab] = useState<"catalog" | "custom">("catalog");
  const [wordsA, setWordsA] = useState("cat, dog, horse, bird");
  const [wordsB, setWordsB] = useState("car, bus, train, truck");

  if (!isOpen) return null;

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const split = (v: string) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    onCustomConcept(split(wordsA), split(wordsB));
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-[#0f111a] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Concept Circuit Explorer</h2>
              <p className="text-xs text-slate-400">Isolate subnetworks dedicated to semantic &amp; factual concepts</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {circuit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClearCircuit();
                }}
                className="text-xs gap-1.5 text-slate-400 hover:text-rose-400 hover:border-rose-500/40"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close circuit modal">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/[0.08] px-6 bg-white/[0.01]">
          <button
            type="button"
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "catalog"
                ? "border-indigo-500 text-indigo-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("catalog")}
          >
            Pre-Calibrated Circuits ({info?.concepts.length || 9})
          </button>
          <button
            type="button"
            className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === "custom"
                ? "border-indigo-500 text-indigo-300 font-semibold"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab("custom")}
          >
            Custom Contrastive Probe
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
          {activeTab === "catalog" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Click a concept to filter the neural web. When active, only heads and neurons with verified selectivity (Cohen's d) for that concept will remain prominent.
              </p>

              <div className="grid grid-cols-2 gap-2.5 max-[600px]:grid-cols-1">
                {(info?.concepts || []).map((c) => {
                  const isActive = circuit?.key === c.key;
                  const color = conceptColor(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      className={`flex flex-col text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? "bg-white/[0.06] shadow-md ring-1"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15]"
                      }`}
                      style={{
                        borderColor: isActive ? color : undefined,
                        boxShadow: isActive ? `0 0 16px color-mix(in srgb, ${color} 25%, transparent)` : undefined,
                      }}
                      onClick={() => {
                        onSelectConcept(c.key);
                        onClose();
                      }}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ 
                              backgroundColor: color,
                              boxShadow: `0 0 8px ${color}`
                            }}
                          />
                          <span className="text-xs font-semibold text-slate-100">{c.name}</span>
                        </div>
                        {isActive && (
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {c.binary ? (
                          <span className="font-mono text-[10px] text-slate-300">
                            {c.side_a} ↔ {c.side_b}
                          </span>
                        ) : (
                          <span>{c.side_a}</span>
                        )}
                      </div>

                      {c.examples && c.examples.length > 0 && (
                        <div className="text-[10px] text-slate-500 mt-1 truncate">
                          e.g. {c.examples.slice(0, 4).join(", ")}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide two contrasting word sets. Neuroscope will run contrastive activation passes to find the heads and neurons that fire significantly more for Set A than Set B.
              </p>

              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-3">
                <div className="space-y-1">
                  <label htmlFor="words-a" className="text-xs font-medium text-slate-200">
                    Target Concept Words (Side A)
                  </label>
                  <input
                    id="words-a"
                    type="text"
                    placeholder="e.g. cat, dog, horse, lion"
                    value={wordsA}
                    onChange={(e) => setWordsA(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/80 focus:outline-none transition-colors"
                  />
                  <span className="text-[10px] text-slate-500">Comma-separated tokens for the positive feature</span>
                </div>

                <div className="space-y-1">
                  <label htmlFor="words-b" className="text-xs font-medium text-slate-200">
                    Contrast Baseline Words (Side B)
                  </label>
                  <input
                    id="words-b"
                    type="text"
                    placeholder="e.g. car, bus, train, truck"
                    value={wordsB}
                    onChange={(e) => setWordsB(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/80 focus:outline-none transition-colors"
                  />
                  <span className="text-[10px] text-slate-500">Comma-separated tokens for the contrast baseline</span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" id="custom-btn" className="gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Extract Circuit</span>
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Active Circuit Info Footer */}
        {circuit && (
          <div className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Active: <strong className="text-slate-200">{circuit.data.name}</strong> ({circuit.data.heads.length} heads, {circuit.data.neurons.length} neurons)
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClearCircuit}
              className="text-xs"
            >
              Clear Circuit Filter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
