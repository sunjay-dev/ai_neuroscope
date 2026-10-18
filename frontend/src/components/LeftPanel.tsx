import React, { useState } from "react";
import { ActiveCircuit, ModelInfo, ViewKind } from "../types";
import { conceptColor, shortUnit } from "../constants";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { 
  Play, 
  Sparkles, 
  RotateCcw, 
  Compass, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Zap
} from "lucide-react";

interface LeftPanelProps {
  text: string;
  setText: (t: string) => void;
  live: boolean;
  setLive: (l: boolean) => void;
  busy: boolean;
  onRun: (force?: boolean, textOverride?: string) => void;
  info: ModelInfo | null;
  circuit: ActiveCircuit | null;
  onSelectConcept: (key: string) => void;
  onCustomConcept: (wordsA: string[], wordsB: string[]) => void;
  onClearCircuit: () => void;
  scaleMaxLabel: string;
  onSelectUnitFromCircuit: (kind: ViewKind, layer: number, index: number) => void;
}

const PRESETS = [
  { label: "Royalty Circuit", icon: "👑", text: "The king ruled the kingdom with wisdom and kindness." },
  { label: "Sarcasm Probe", icon: "🎭", text: "Oh great, another Monday morning meeting." },
  { label: "Gender & Roles", icon: "🩺", text: "She is a doctor and he is a nurse." },
  { label: "Positive Review", icon: "⭐", text: "I love this wonderful, heartwarming film." },
  { label: "Negative Review", icon: "💔", text: "I hate this terrible, boring film." },
  { label: "Mixed Entities", icon: "🐾", text: "The cat chased three dogs in London on Friday." },
];

export const LeftPanel: React.FC<LeftPanelProps> = ({
  text,
  setText,
  live,
  setLive,
  busy,
  onRun,
  info,
  circuit,
  onSelectConcept,
  onCustomConcept,
  onClearCircuit,
  scaleMaxLabel,
  onSelectUnitFromCircuit,
}) => {
  const [customOpen, setCustomOpen] = useState(false);
  const [wordsA, setWordsA] = useState("cat, dog, horse, bird");
  const [wordsB, setWordsB] = useState("car, bus, train, truck");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const split = (v: string) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    onCustomConcept(split(wordsA), split(wordsB));
  };

  return (
    <aside className="bg-[#0e111a] border-r border-white/[0.08] p-4 overflow-y-auto flex flex-col gap-4 custom-scrollbar select-none max-[1100px]:border-r-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible">
      {/* 1. Input Text Card */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-mono">
              1
            </span>
            <span>Prompt Input</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            <span id="char-num" className="text-slate-400">{text.length}</span>/512
          </span>
        </div>

        <div className="relative group">
          <Textarea
            id="input-text"
            placeholder="Type a sentence to analyze through GPT-2..."
            maxLength={512}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onRun(true);
              }
            }}
            className="h-[88px] text-xs font-sans leading-relaxed"
          />
        </div>

        {/* Live toggle & Run action */}
        <div className="flex items-center justify-between gap-3 pt-0.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <div 
              onClick={() => setLive(!live)}
              className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                live ? "bg-indigo-600 justify-end" : "bg-white/[0.1] justify-start"
              }`}
            >
              <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
            </div>
            <span className="text-[11px] font-medium">Live re-analysis</span>
          </label>

          <Button
            variant="primary"
            size="sm"
            id="run-btn"
            disabled={busy}
            onClick={() => onRun(true)}
            className="gap-1.5 px-3 font-medium shadow-sm shadow-indigo-500/25"
          >
            {busy ? (
              <>
                <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Analyze</span>
                <kbd className="text-[9px] font-mono opacity-60 bg-black/30 px-1 py-0.2 rounded ml-0.5">↵</kbd>
              </>
            )}
          </Button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Try an example prompt:</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((ex) => (
              <button
                key={ex.label}
                type="button"
                className="flex items-center gap-1.5 text-left rounded-md px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] hover:border-indigo-500/40 hover:bg-white/[0.06] text-slate-300 hover:text-white transition-all text-[11px] truncate group"
                onClick={() => {
                  setText(ex.text);
                  onRun(true, ex.text);
                }}
                title={ex.text}
              >
                <span className="text-xs shrink-0">{ex.icon}</span>
                <span className="truncate group-hover:text-indigo-300 transition-colors">{ex.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/[0.06]" />

      {/* 2. Concept Circuit Discovery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-mono">
              2
            </span>
            <span>Circuit Finder</span>
          </div>
          {circuit && (
            <button
              onClick={onClearCircuit}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              title="Clear active circuit"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 leading-normal">
          Light up the selective attention heads and MLP neurons dedicated to a concept across this text.
        </p>

        {/* Concept Catalog Grid */}
        <div className="grid grid-cols-2 gap-1.5" id="concept-grid">
          {(info?.concepts || []).map((c) => {
            const isActive = circuit?.key === c.key;
            const color = conceptColor(c.key);
            return (
              <button
                key={c.key}
                type="button"
                className={`flex items-center justify-between text-left rounded-md px-2.5 py-1.5 text-[11px] transition-all border select-none ${
                  isActive
                    ? "text-white font-medium shadow-sm"
                    : "bg-white/[0.03] border-white/[0.06] text-slate-300 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-slate-100"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: color,
                        backgroundColor: `color-mix(in srgb, ${color} 15%, #141724)`,
                        boxShadow: `0 0 12px color-mix(in srgb, ${color} 20%, transparent)`,
                      }
                    : {}
                }
                title={c.binary ? `${c.name}: ${c.side_a} ↔ ${c.side_b}` : `${c.name}: ${c.side_a} (e.g. ${c.examples.join(", ")})`}
                onClick={() => onSelectConcept(c.key)}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ 
                      backgroundColor: color,
                      boxShadow: isActive ? `0 0 6px ${color}` : undefined
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                </div>
                {isActive && <Check className="w-3 h-3 shrink-0 ml-1" style={{ color }} />}
              </button>
            );
          })}
        </div>

        {/* Custom Contrastive Probe Card */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
            onClick={() => setCustomOpen(!customOpen)}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Custom Probe (contrastive words)</span>
            </div>
            {customOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          {customOpen && (
            <form onSubmit={handleCustomSubmit} className="p-3 pt-1 space-y-2 border-t border-white/[0.04]">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Target Concept A (positive)</span>
                <input
                  id="words-a"
                  type="text"
                  placeholder="e.g. cat, dog, horse, lion"
                  value={wordsA}
                  onChange={(e) => setWordsA(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/80 focus:outline-none transition-colors"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono text-slate-400">Baseline Concept B (contrast)</span>
                <input
                  id="words-b"
                  type="text"
                  placeholder="e.g. car, bus, train, plane"
                  value={wordsB}
                  onChange={(e) => setWordsB(e.target.value)}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/80 focus:outline-none transition-colors"
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                id="custom-btn"
                className="w-full mt-1 gap-1 text-xs"
              >
                <Compass className="w-3 h-3 text-indigo-400" />
                <span>Extract Custom Circuit</span>
              </Button>
            </form>
          )}
        </div>

        {/* Active Circuit Inspector Card */}
        {circuit && (
          <div id="circuit-box" className="rounded-lg border p-3 bg-white/[0.02] space-y-2.5" style={{ borderColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 40%, transparent)` }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-xs flex items-center gap-1.5" style={{ color: conceptColor(circuit.key) }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: conceptColor(circuit.key) }} />
                <span>{circuit.data.name} Circuit</span>
              </div>
              <button
                id="clear-circuit"
                onClick={onClearCircuit}
                className="text-[10px] text-slate-400 hover:text-rose-400 transition-colors"
                title="Remove circuit filter"
              >
                Clear
              </button>
            </div>

            <div className="text-[11px] text-slate-400 leading-relaxed">
              Token tint reflects circuit reading vs ordinary text.
              {circuit.data.binary ? (
                <div className="flex items-center gap-2 mt-1 font-mono text-[10px]">
                  <span style={{ color: conceptColor(circuit.key, 0) }}>■ {circuit.data.side_a}</span>
                  <span className="text-slate-600">↔</span>
                  <span style={{ color: conceptColor(circuit.key, 1) }}>■ {circuit.data.side_b}</span>
                </div>
              ) : (
                <div className="mt-1 font-mono text-[10px]" style={{ color: conceptColor(circuit.key, 0) }}>
                  ■ {circuit.data.side_a}
                </div>
              )}
            </div>

            {/* Circuit Units (Heads) */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between">
                <span>Attention Heads</span>
                <span className="text-slate-500">{circuit.data.heads.length} units</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {circuit.data.heads.map((u) => {
                  const peak = Math.max(...u.evidence);
                  return (
                    <button
                      key={`h-${u.layer}-${u.index}`}
                      type="button"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                        peak > 1
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-semibold"
                          : "bg-white/[0.04] text-slate-400 border-white/[0.06] hover:text-slate-200 hover:border-white/[0.15]"
                      }`}
                      title={`Cohen's d = ${u.d} (prefers ${u.side})`}
                      onClick={() => onSelectUnitFromCircuit("head", u.layer, u.index)}
                    >
                      {shortUnit(u.kind, u.layer, u.index)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Circuit Units (Neurons) */}
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center justify-between">
                <span>MLP Neurons</span>
                <span className="text-slate-500">{circuit.data.neurons.length} units</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {circuit.data.neurons.map((u) => {
                  const peak = Math.max(...u.evidence);
                  return (
                    <button
                      key={`n-${u.layer}-${u.index}`}
                      type="button"
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all ${
                        peak > 1
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold"
                          : "bg-white/[0.04] text-slate-400 border-white/[0.06] hover:text-slate-200 hover:border-white/[0.15]"
                      }`}
                      title={`Cohen's d = ${u.d} (prefers ${u.side})`}
                      onClick={() => onSelectUnitFromCircuit("neuron", u.layer, u.index)}
                    >
                      {shortUnit(u.kind, u.layer, u.index)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Scientific Calibration Scale Card */}
      <div className="mt-auto pt-3 border-t border-white/[0.06] max-[1100px]:mt-0">
        <div className="rounded-lg bg-white/[0.02] border border-white/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-300">Activation Scale</span>
            <span className="text-[10px] font-mono text-slate-500">σ over baseline</span>
          </div>
          {/* Chromatic Colormap Bar */}
          <div className="h-2 rounded-full bg-gradient-to-r from-[#1e2538] via-[#6366f1] via-[#a855f7] to-[#f43f5e] shadow-inner" />
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span>0.0σ</span>
            <span>1.5σ</span>
            <span>3.0σ</span>
            <span id="scale-max" className="text-pink-400 font-semibold">{scaleMaxLabel}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
