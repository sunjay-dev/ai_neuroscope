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
    <div className="flex-1 bg-slate-50 flex flex-col overflow-hidden min-w-0 select-none">
      {/* If in Flow Web tab, show the Flow Canvas Toolbar */}
      {activeTab === "flow" && (
        <div className="flex items-center justify-between gap-5 px-8 py-3.5 bg-white border-b border-slate-200 shrink-0 max-[1100px]:px-5 max-[1100px]:flex-wrap shadow-2xs">
          {/* Left: View Switcher (Attn Heads vs MLP Neurons) */}
          <div 
            id="view-toggle"
            className="flex items-center p-1.5 rounded-xl bg-slate-100 border border-slate-200 shadow-inner"
          >
            <button
              type="button"
              data-view="head"
              onClick={() => setView("head")}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                view === "head"
                  ? "bg-white text-violet-600 shadow-xs border border-slate-200/60 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Attention Heads</span>
            </button>
            <button
              type="button"
              data-view="neuron"
              onClick={() => setView("neuron")}
              className={`flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer ${
                view === "neuron"
                  ? "bg-white text-violet-600 shadow-xs border border-slate-200/60 font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>MLP Neurons</span>
            </button>
          </div>

          {/* Center: Active Circuit Pill (if active) */}
          {circuit && (
            <div 
              className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border shadow-2xs animate-in fade-in duration-150"
              style={{
                backgroundColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 10%, #ffffff)`,
                borderColor: `color-mix(in srgb, ${conceptColor(circuit.key)} 35%, transparent)`,
                color: conceptColor(circuit.key),
              }}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="font-semibold">{circuit.data.name} Circuit Active</span>
              <span className="text-[11px] opacity-80">
                ({circuit.data.heads.length}H · {circuit.data.neurons.length}N)
              </span>
              <button
                onClick={onClearCircuit}
                className="w-4 h-4 rounded-full hover:bg-slate-200/60 flex items-center justify-center transition-colors ml-0.5 cursor-pointer text-slate-500 hover:text-slate-900"
                title="Clear circuit filter"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Right: Token Context Indicator */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs shadow-2xs">
              <span className="text-slate-500">Token:</span>
              <span id="token-idx" className="text-violet-600 font-bold">
                {analysis && sel ? `${sel.t + 1} / ${analysis.tokens.length}` : "—"}
              </span>
              {currentTokenText && (
                <span className="text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md font-bold truncate max-w-[110px] shadow-2xs">
                  "{currentTokenText}"
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                id="prev-btn"
                size="icon-sm"
                aria-label="Previous token"
                onClick={() => onNavToken(-1)}
                disabled={!analysis || !sel || sel.t <= 0}
                title="Previous token (←)"
                className="cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </Button>
              <Button
                variant="outline"
                id="next-btn"
                size="icon-sm"
                aria-label="Next token"
                onClick={() => onNavToken(1)}
                disabled={!analysis || !sel || sel.t >= analysis.tokens.length - 1}
                title="Next token (→)"
                className="cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
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
      <div className="px-8 py-3.5 bg-white border-t border-slate-200 text-xs flex justify-between items-center gap-5 shrink-0 max-[1100px]:px-5 shadow-2xs">
        {/* Live dot & message */}
        <div className="flex items-center gap-2.5 truncate">
          <div
            id="live-dot"
            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-300 ${
              busy 
                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] pulse-busy" 
                : live 
                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] pulse-live" 
                : "bg-slate-400"
            }`}
          />
          <span id="status-msg" className="truncate text-slate-600 text-xs font-medium">
            {statusMsg.isError ? (
              <span className="text-rose-600 font-semibold">{statusMsg.text}</span>
            ) : (
              statusMsg.text
            )}
          </span>
        </div>

        {/* Right side: nodes and scale max */}
        <div className="flex items-center gap-4 text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2 max-[800px]:hidden">
            <span>Scale:</span>
            <div className="w-16 h-2 rounded-full bg-primary border border-slate-200" />
            <span id="scale-max" className="text-slate-700 font-semibold">{scaleMaxLabel}</span>
          </div>
          <span id="status-nodes" className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md border border-slate-200 shadow-2xs font-medium">
            {statusNodes}
          </span>
        </div>
      </div>
    </div>
  );
};
