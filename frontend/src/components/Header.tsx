import React, { useState, useRef, useEffect } from "react";
import { ActiveCircuit, ModelInfo } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { 
  Sparkles, 
  HelpCircle, 
  Play, 
  Compass, 
  SidebarOpen, 
  SidebarClose, 
  ChevronDown, 
  X
} from "lucide-react";
import { conceptColor } from "../constants";

interface HeaderProps {
  info: ModelInfo | null;
  error?: string | null;
  text: string;
  setText: (t: string) => void;
  live: boolean;
  setLive: (l: boolean) => void;
  busy: boolean;
  onRun: (force?: boolean, textOverride?: string) => void;
  circuit: ActiveCircuit | null;
  onOpenCircuitModal: () => void;
  onClearCircuit: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onOpenHelp: () => void;
}

const PRESETS = [
  { label: "Royalty Circuit", icon: "👑", text: "The king ruled the kingdom with wisdom and kindness." },
  { label: "Sarcasm Probe", icon: "🎭", text: "Oh great, another Monday morning meeting." },
  { label: "Gender & Roles", icon: "🩺", text: "She is a doctor and he is a nurse." },
  { label: "Positive Review", icon: "⭐", text: "I love this wonderful, heartwarming film." },
  { label: "Negative Review", icon: "💔", text: "I hate this terrible, boring film." },
  { label: "Mixed Entities", icon: "🐾", text: "The cat chased three dogs in London on Friday." },
];

export const Header: React.FC<HeaderProps> = ({
  info,
  error,
  text,
  setText,
  live,
  setLive,
  busy,
  onRun,
  circuit,
  onOpenCircuitModal,
  onClearCircuit,
  isInspectorOpen,
  onToggleInspector,
  onOpenHelp,
}) => {
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // Close presets dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    };
    if (presetOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [presetOpen]);

  return (
    <header className="flex flex-col bg-[#0c0e17] border-b border-white/[0.08] shrink-0 select-none z-30">
      {/* Top Bar: Brand, Model Specs & Utilities */}
      <div className="flex items-center justify-between gap-4 px-6 py-2.5 max-[1100px]:px-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 p-[1px] shadow-sm shadow-indigo-500/20">
            <div className="w-full h-full bg-[#0c0e17] rounded-[7px] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-slate-100 m-0">
              AI Neuroscope
            </h1>
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 text-slate-400 border-white/[0.06]">
              GPT-2
            </Badge>
          </div>
        </div>

        {/* Center: Model Status */}
        <div 
          id="model-badge" 
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-mono max-[900px]:hidden"
        >
          {error ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="text-rose-400">Model Offline</span>
            </>
          ) : info ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] pulse-live" />
              <span className="text-slate-300 font-medium">{info.model_name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-[11px]">{info.num_layers}L × {info.num_heads}H</span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-400 text-[11px]">{info.mlp_dim.toLocaleString()} MLP</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-busy" />
              <span className="text-slate-400">Connecting…</span>
            </>
          )}
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2 text-xs">
          {/* Circuit Filter Button */}
          <Button
            variant={circuit ? "default" : "secondary"}
            size="sm"
            onClick={onOpenCircuitModal}
            className={`gap-1.5 text-xs h-7 px-2.5 transition-all ${
              circuit 
                ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-sm" 
                : "text-slate-300 hover:text-white"
            }`}
            title="Open Concept Circuit Catalog"
          >
            <Compass className="w-3.5 h-3.5" style={{ color: circuit ? conceptColor(circuit.key) : undefined }} />
            <span>
              {circuit ? `${circuit.data.name} Circuit` : "Concept Circuits"}
            </span>
          </Button>

          {circuit && (
            <button
              id="clear-circuit"
              onClick={onClearCircuit}
              className="w-5 h-5 rounded-full bg-white/[0.08] hover:bg-rose-500/20 hover:text-rose-300 text-slate-400 flex items-center justify-center transition-colors"
              title="Clear active circuit"
              aria-label="Clear active circuit"
            >
              <X className="w-3 h-3" />
            </button>
          )}

          {/* Inspector Panel Toggle Button */}
          <Button
            variant={isInspectorOpen ? "default" : "secondary"}
            size="sm"
            onClick={onToggleInspector}
            className={`gap-1.5 text-xs h-7 px-2.5 transition-all ${
              isInspectorOpen
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-300 hover:text-white"
            }`}
            title="Toggle Unit Inspector Panel (I)"
          >
            {isInspectorOpen ? (
              <SidebarClose className="w-3.5 h-3.5" />
            ) : (
              <SidebarOpen className="w-3.5 h-3.5" />
            )}
            <span className="max-[800px]:hidden">Inspector</span>
          </Button>

          {/* Guide Modal Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenHelp}
            className="text-slate-400 hover:text-slate-200 gap-1 text-xs h-7 px-2"
            title="Keyboard Shortcuts & Guide (?)"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <kbd className="text-[10px] bg-white/[0.08] px-1 py-0.2 rounded text-slate-300 font-mono">?</kbd>
          </Button>

          {/* GitHub Link */}
          <a
            href="https://github.com/sunjay-dev/ai_neuroscope"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] transition-colors"
            title="View on GitHub"
            aria-label="GitHub Repository"
          >
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Primary Prompt Command Bar */}
      <div className="px-6 pb-2.5 pt-0.5 flex items-center gap-3 max-[1100px]:px-4">
        <div className="flex-1 flex items-center gap-2 bg-black/40 border border-white/[0.1] rounded-lg px-3 py-1.5 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/40 transition-all shadow-inner">
          <input
            id="input-text"
            type="text"
            placeholder="Type a sentence to analyze through GPT-2…"
            maxLength={512}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRun(true);
              }
            }}
            className="flex-1 bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-sans"
          />

          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            <span id="char-num">{text.length}</span>/512
          </span>

          {/* Presets dropdown */}
          <div ref={presetRef} className="relative shrink-0">
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
              onClick={() => setPresetOpen(!presetOpen)}
            >
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {presetOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-[#0f111a] border border-white/[0.12] rounded-lg shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in duration-100">
                <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                  Example Prompts
                </div>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors group"
                    onClick={() => {
                      setText(p.text);
                      onRun(true, p.text);
                      setPresetOpen(false);
                    }}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate group-hover:text-indigo-300 transition-colors">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live toggle */}
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0">
          <input
            type="checkbox"
            id="live-toggle"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="sr-only"
          />
          <div 
            onClick={() => setLive(!live)}
            className={`w-6 h-3.5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
              live ? "bg-indigo-600 justify-end" : "bg-white/[0.1] justify-start"
            }`}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
          </div>
          <span className="text-[11px] font-medium max-[700px]:hidden">Live</span>
        </label>

        {/* Run Button */}
        <Button
          variant="primary"
          size="sm"
          id="run-btn"
          disabled={busy}
          onClick={() => onRun(true)}
          className="gap-1.5 px-3.5 h-8 font-medium shadow-sm shadow-indigo-500/25 shrink-0"
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
    </header>
  );
};
