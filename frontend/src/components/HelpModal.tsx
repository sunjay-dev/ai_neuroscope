import React from "react";
import { X, HelpCircle, Cpu, Network, Activity, Sparkles, Command } from "lucide-react";
import { Button } from "./ui/button";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#0f111a] border border-white/[0.12] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Mechanistic Interpretability Guide</h2>
              <p className="text-xs text-slate-400">Understanding GPT-2 circuit internals and metrics</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close help modal">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-300 leading-relaxed custom-scrollbar">
          {/* Section: Overview */}
          <div className="p-3.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>What is AI Neuroscope?</span>
            </div>
            <p className="text-slate-400">
              A microscope into transformer internals. As text flows forward through GPT-2 (12 layers, 144 attention heads, 36,864 MLP neurons), PyTorch hooks capture precise activation vectors to pinpoint what information is routed and computed at each stage.
            </p>
          </div>

          {/* Section: Units */}
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Network className="w-3.5 h-3.5 text-sky-400" />
                <span>Attention Heads (12L × 12H)</span>
              </div>
              <p className="text-slate-400">
                Information movers. Each head computes attention patterns (where to look) and outputs an update into the residual stream. Activation intensity represents the norm of its output write.
              </p>
            </div>
            <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Cpu className="w-3.5 h-3.5 text-purple-400" />
                <span>MLP Neurons (3,072 / layer)</span>
              </div>
              <p className="text-slate-400">
                Key-value associative memories. Each layer's feed-forward network contains 3,072 non-linear neurons that fire for specific semantic, syntactic, or factual features.
              </p>
            </div>
          </div>

          {/* Section: Metrics */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Key Scientific Metrics</span>
            </div>
            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <div className="font-mono font-medium text-indigo-300 mb-1">σ (Standard Deviations)</div>
                <p className="text-slate-400 text-[11px]">
                  Z-scored against calibration baseline text. A value of <code className="text-slate-200">+3.0σ</code> means this unit is firing 3 standard deviations above its typical activity.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <div className="font-mono font-medium text-emerald-300 mb-1">Cohen's d (Effect Size)</div>
                <p className="text-slate-400 text-[11px]">
                  Selectivity score on contrastive probe pairs. |d| ≥ 2.0 indicates strong, isolated concept selectivity (e.g. royalty or gender).
                </p>
              </div>
            </div>
          </div>

          {/* Section: Shortcuts */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Command className="w-3.5 h-3.5 text-amber-400" />
              <span>Keyboard Navigation</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.06]">
                <span className="text-slate-400">Previous token</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-200 text-[10px]">←</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.06]">
                <span className="text-slate-400">Next token</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-200 text-[10px]">→</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.06]">
                <span className="text-slate-400">Run analysis</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-200 text-[10px]">Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-black/30 border border-white/[0.06]">
                <span className="text-slate-400">Open help</span>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-200 text-[10px]">?</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-white/[0.02] flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};
