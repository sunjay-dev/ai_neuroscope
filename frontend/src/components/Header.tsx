import React, { useState, useRef, useEffect } from "react";
import { ActiveCircuit, ModelInfo, WorkspaceTab } from "../types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { TabsList, TabsTrigger } from "./ui/tabs";
import { 
  HelpCircle, 
  Play, 
  Compass, 
  SidebarOpen, 
  SidebarClose, 
  ChevronDown, 
  X,
  Network,
  Grid,
  TrendingUp
} from "lucide-react";

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
  onClearCircuit: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  onOpenHelp: () => void;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
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
  onClearCircuit,
  isInspectorOpen,
  onToggleInspector,
  onOpenHelp,
  activeTab,
  onTabChange,
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
    <header className="flex flex-col bg-white border-b border-slate-200 shrink-0 select-none z-30 shadow-2xs">
      {/* Top Bar: Brand, Studio Tabs & Global Actions */}
      <div className="flex items-center justify-between gap-5 px-8 py-3.5 max-[1100px]:px-5">
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <img
            src="/logo.png"
            alt="AI Neuroscope logo"
            className="w-9 h-9 rounded-xl shadow-xs object-cover"
          />
          <div className="flex items-center gap-2.5">
            <h1 className="text-[15px] font-bold tracking-tight text-slate-900 m-0">
              AI Neuroscope
            </h1>
            <Badge variant="secondary" className="text-[11px] py-0 px-2 font-mono text-slate-600">
              GPT-2
            </Badge>
          </div>
        </div>

        {/* Studio View Navigation Tabs (Shadcn UI Tabs) */}
        <TabsList className="max-[900px]:hidden">
          <TabsTrigger
            active={activeTab === "flow"}
            onClick={() => onTabChange("flow")}
            className="flex items-center gap-1.5"
          >
            <Network className="w-3.5 h-3.5 text-indigo-600" />
            <span>Circuit Flow</span>
          </TabsTrigger>

          <TabsTrigger
            active={activeTab === "heads"}
            onClick={() => onTabChange("heads")}
            className="flex items-center gap-1.5"
          >
            <Grid className="w-3.5 h-3.5 text-indigo-600" />
            <span>144 Heads Matrix</span>
          </TabsTrigger>

          <TabsTrigger
            active={activeTab === "predictions"}
            onClick={() => onTabChange("predictions")}
            className="flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            <span>Predictions &amp; Entropy</span>
          </TabsTrigger>

          <TabsTrigger
            active={activeTab === "circuits"}
            onClick={() => onTabChange("circuits")}
            className="flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            <span>Concept Circuits</span>
            {circuit && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 ml-0.5" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Right Tools */}
        <div className="flex items-center gap-2 text-xs">
          {/* Active circuit chip in header */}
          {circuit && (
            <Badge variant="outline" className="flex items-center gap-1.5 bg-indigo-50 border-indigo-200 text-indigo-700 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
              <span>{circuit.data.name}</span>
              <button
                id="clear-circuit"
                onClick={onClearCircuit}
                className="hover:text-indigo-900 transition-colors ml-1 cursor-pointer"
                title="Clear circuit filter"
                aria-label="Clear active circuit"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}

          {/* Model Status Pill */}
          <div 
            id="model-badge" 
            className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-mono max-[1100px]:hidden text-slate-700"
          >
            {error ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-red-600 text-xs font-sans">Offline</span>
              </>
            ) : info ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs" />
                <span className="text-slate-800 font-semibold">{info.model_name}</span>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">{info.num_layers}L × {info.num_heads}H</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-slate-500">Connecting…</span>
              </>
            )}
          </div>

          {/* Inspector Panel Toggle Button */}
          <Button
            variant={isInspectorOpen ? "default" : "outline"}
            size="sm"
            onClick={onToggleInspector}
            className="gap-1.5 cursor-pointer font-medium"
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
            size="icon-sm"
            onClick={onOpenHelp}
            className="text-slate-500 hover:text-slate-900 cursor-pointer"
            title="Keyboard Shortcuts & Guide (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Primary Prompt Command Bar */}
      <div className="px-8 pb-4 pt-2 flex items-center gap-4 max-[1100px]:px-5">
        <div className="flex-1 h-12 flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:bg-white transition-all shadow-2xs">
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
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-sans"
          />

          <span className="text-xs font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded shrink-0">
            <span id="char-num">{text.length}</span>/512
          </span>

          {/* Presets dropdown */}
          <div ref={presetRef} className="relative shrink-0">
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              onClick={() => setPresetOpen(!presetOpen)}
            >
              <span>Presets</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </button>

            {presetOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 z-50 space-y-0.5 animate-in fade-in duration-100">
                <div className="px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  Example Prompts
                </div>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors group cursor-pointer"
                    onClick={() => {
                      setText(p.text);
                      onRun(true, p.text);
                      setPresetOpen(false);
                    }}
                  >
                    <span className="text-sm">{p.icon}</span>
                    <span className="truncate group-hover:text-indigo-600 font-medium transition-colors">{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors shrink-0">
          <input
            type="checkbox"
            id="live-toggle"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="sr-only"
          />
          <div 
            onClick={() => setLive(!live)}
            className={`w-7 h-4 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
              live ? "bg-indigo-600 justify-end" : "bg-slate-200 justify-start"
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
          </div>
          <span className="text-xs max-[700px]:hidden">Live</span>
        </label>

        {/* Run Button */}
        <Button
          variant="primary"
          size="default"
          id="run-btn"
          disabled={busy}
          onClick={() => onRun(true)}
          className="gap-2 px-5 h-12 font-semibold shadow-xs shrink-0 cursor-pointer rounded-xl"
        >
          {busy ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              <span>Running…</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Analyze</span>
              <kbd className="text-[10px] font-mono opacity-80 bg-indigo-700/60 px-1.5 py-0.5 rounded ml-0.5">↵</kbd>
            </>
          )}
        </Button>
      </div>
    </header>
  );
};
