import React from "react";
import { ActiveCircuit, AnalysisResponse, ModelInfo, Selection, ViewKind, WorkspaceTab } from "../types";
import { TokenRow } from "./TokenRow";
import { NetworkSvg } from "./NetworkSvg";
import { HeadMatrixView } from "./HeadMatrixView";
import { PredictionsView } from "./PredictionsView";
import { ConceptStudioView } from "./ConceptStudioView";
import { Button } from "./ui/button";
import { 
  Network, 
  Cpu, 
  ChevronLeft, 
  ChevronRight,
  Compass,
  X
} from "lucide-react";
import { conceptColor, showTok } from "../constants";

interface CenterPanelProps {
  activeTab: WorkspaceTab;
  info: ModelInfo | null;
  analysis: AnalysisResponse | null;
  circuit: ActiveCircuit | null;
  view: ViewKind;
  setView: (v: ViewKind) => void;
  sel: Selection | null;
  revealed: number;
  live: boolean;
  busy: boolean;
  statusMsg: { text: string; isError?: boolean };
  statusNodes: string;
  scaleMaxLabel: string;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSelectToken: (t: number) => void;
  onSelectNode: (t: number, l: number) => void;
  onSelectHead: (layer: number, head: number) => void;
  onNavToken: (dir: number) => void;
  onClearCircuit: () => void;
  onSelectConcept: (key: string) => void;
  onCustomConcept: (wordsA: string[], wordsB: string[]) => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({
  activeTab,
  info,
  analysis,
  circuit,
  view,
  setView,
  sel,
  revealed,
  live,
  busy,
  statusMsg,
  statusNodes,
  scaleMaxLabel,
  isPlaying,
  onTogglePlay,
  onSelectToken,
  onSelectNode,
  onSelectHead,
  onNavToken,
  onClearCircuit,
  onSelectConcept,
  onCustomConcept,
}) => {
  const currentTokenText = (analysis && sel) ? showTok(analysis.tokens[sel.t]) : null;

  return (
    <div className="flex-1 bg-[#090a0f] flex flex-col overflow-hidden min-w-0 select-none">
      {/* If in Flow Web tab, show the Flow Canvas Toolbar */}
      {activeTab === "flow" && (
        <div className="flex items-center justify-between gap-3 px-6 py-2 bg-[#0e111a] border-b border-white/[0.08] shrink-0 max-[1100px]:px-4 max-[1100px]:flex-wrap">
          {/* Left: View Switcher (Attn Heads vs MLP Neurons) */}
          <div 
            id="view-toggle"
            className="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08]"
          >
            <button
              type="button"
              data-view="head"
              onClick={() => setView("head")}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md transition-all cursor-pointer ${
                view === "head"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Attention Heads</span>
            </button>
            <button
              type="button"
              data-view="neuron"
              onClick={() => setView("neuron")}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md transition-all cursor-pointer ${
                view === "neuron"
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30 font-semibold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>MLP Neurons</span>
            </button>
          </div>

          {/* Center: Active Circuit Pill (if active) */}
          {circuit && (
            <div 
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border animate-in fade-in duration-150"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 15%, #141724)`,
                borderColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 40%, transparent)`,
                color: conceptColor(circuit.key),
              }}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{circuit.data.name} Circuit Active</span>
              <span className="text-[10px] opacity-75 font-mono">
                ({circuit.data.heads.length}H · {circuit.data.neurons.length}N)
              </span>
              <button
                onClick={onClearCircuit}
                className="w-4 h-4 rounded-full hover:bg-black/40 flex items-center justify-center transition-colors ml-1 cursor-pointer"
                title="Clear circuit filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Right: Token Context Indicator */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.08] px-2.5 py-1 rounded-md text-[11px] font-mono">
              <span className="text-slate-400">Token:</span>
              <span id="token-idx" className="text-indigo-300 font-medium">
                {analysis && sel ? `${sel.t + 1} / ${analysis.tokens.length}` : "—"}
              </span>
              {currentTokenText && (
                <span className="text-slate-200 bg-white/[0.08] px-1 py-0.2 rounded font-mono truncate max-w-[90px]">
                  "{currentTokenText}"
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <Button
                variant="nav"
                id="prev-btn"
                size="icon"
                aria-label="Previous token"
                onClick={() => onNavToken(-1)}
                disabled={!analysis || !sel || sel.t <= 0}
                title="Previous token (←)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="nav"
                id="next-btn"
                size="icon"
                aria-label="Next token"
                onClick={() => onNavToken(1)}
                disabled={!analysis || !sel || sel.t >= analysis.tokens.length - 1}
                title="Next token (→)"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab View Rendering */}
      {activeTab === "flow" && (
        <>
          {/* Interactive Token Ribbon */}
          <TokenRow
            analysis={analysis}
            circuit={circuit}
            sel={sel}
            onSelectToken={onSelectToken}
            onNavToken={onNavToken}
            isPlaying={isPlaying}
            onTogglePlay={onTogglePlay}
          />

          {/* Network SVG Canvas */}
          <NetworkSvg
            analysis={analysis}
            circuit={circuit}
            view={view}
            sel={sel}
            revealed={revealed}
            onSelectToken={onSelectToken}
            onSelectNode={onSelectNode}
          />
        </>
      )}

      {activeTab === "heads" && (
        <HeadMatrixView
          analysis={analysis}
          circuit={circuit}
          sel={sel}
          onSelectHead={onSelectHead}
        />
      )}

      {activeTab === "predictions" && (
        <PredictionsView
          analysis={analysis}
          sel={sel}
          onSelectToken={onSelectToken}
        />
      )}

      {activeTab === "circuits" && (
        <ConceptStudioView
          info={info}
          circuit={circuit}
          onSelectConcept={onSelectConcept}
          onCustomConcept={onCustomConcept}
          onClearCircuit={onClearCircuit}
        />
      )}

      {/* Persistent Status Bar */}
      <div className="px-6 py-2 bg-[#0c0e17] border-t border-white/[0.08] text-xs flex justify-between items-center gap-3 shrink-0 max-[1100px]:px-4">
        {/* Live dot & message */}
        <div className="flex items-center gap-2 truncate">
          <div
            id="live-dot"
            className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
              busy 
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] pulse-busy" 
                : live 
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] pulse-live" 
                : "bg-slate-600"
            }`}
          />
          <span id="status-msg" className="truncate text-slate-400 text-[11px]">
            {statusMsg.isError ? (
              <span className="text-rose-400 font-medium">{statusMsg.text}</span>
            ) : (
              statusMsg.text
            )}
          </span>
        </div>

        {/* Right side: nodes and scale max */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5 max-[800px]:hidden">
            <span>Scale:</span>
            <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-[#1e2538] via-[#6366f1] via-[#a855f7] to-[#f43f5e]" />
            <span id="scale-max" className="text-slate-400">{scaleMaxLabel}</span>
          </div>
          <span id="status-nodes">
            {statusNodes}
          </span>
        </div>
      </div>
    </div>
  );
};
