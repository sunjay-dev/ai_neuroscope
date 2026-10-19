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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shadow-2xs">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Mechanistic Interpretability Guide</h2>
              <p className="text-xs text-slate-500 mt-0.5">Understanding GPT-2 circuit internals, metrics, and workbench views</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close help modal" className="cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed custom-scrollbar">
          {/* Section: Overview */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
              <Sparkles className="w-4 h-4 text-violet-600" />
              <span>What is AI Neuroscope?</span>
            </div>
            <p className="text-slate-600 text-xs leading-relaxed">
              A high-precision microscope into transformer internals. As text flows forward through GPT-2 (12 layers, 144 attention heads, 36,864 MLP neurons), PyTorch hooks capture precise activation vectors to pinpoint what information is routed, transformed, and promoted at each stage.
            </p>
          </div>

          {/* Section: Units */}
          <div className="grid grid-cols-2 gap-3.5 max-[600px]:grid-cols-1">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Network className="w-4 h-4 text-sky-600" />
                <span>Attention Heads (12L × 12H)</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Information movers. Each head computes attention patterns (where to look) and outputs an update into the residual stream. Activation intensity represents the norm of its output write.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Cpu className="w-4 h-4 text-purple-600" />
                <span>MLP Neurons (3,072 / layer)</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Key-value associative memories. Each layer's feed-forward network contains 3,072 non-linear neurons that fire for specific semantic, syntactic, or factual features.
              </p>
            </div>
          </div>

          {/* Section: Metrics */}
          <div className="space-y-2.5">
            <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Key Scientific Metrics</span>
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-[600px]:grid-cols-1">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="font-bold text-violet-700 mb-1 text-xs">σ (Standard Deviations)</div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Z-scored against calibration baseline text. A value of <code className="text-slate-900 bg-white border border-slate-200 px-1 py-0.5 rounded shadow-2xs">+3.0σ</code> means this unit is firing 3 standard deviations above its typical activity.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <div className="font-bold text-emerald-700 mb-1 text-xs">Cohen's d (Effect Size)</div>
                <p className="text-slate-600 text-xs leading-relaxed">
                  Selectivity score on contrastive probe pairs. |d| &ge; 2.0 indicates strong, isolated concept selectivity (e.g. royalty, gender, sarcasm).
                </p>
              </div>
            </div>
          </div>

          {/* Section: Shortcuts */}
          <div className="space-y-2.5">
            <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <Command className="w-4 h-4 text-amber-600" />
              <span>Keyboard Navigation &amp; Hotkeys</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans">Step Token</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">←</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">→</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans">Play / Pause Step</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans">Switch Views</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">1</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">2</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">3</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">4</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
                <span className="text-slate-600 font-sans">Toggle Inspector</span>
                <kbd className="px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-800 text-[11px] shadow-2xs">I</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex justify-end">
          <Button variant="default" size="sm" onClick={onClose} className="cursor-pointer px-4">
            Close Guide
          </Button>
        </div>
      </div>
    </div>
  );
};
