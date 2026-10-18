import React from "react";
import { ActiveCircuit, AnalysisResponse, Selection, ViewKind } from "../types";
import { TokenRow } from "./TokenRow";
import { NetworkSvg } from "./NetworkSvg";
import { Button } from "./ui/button";
import { 
  Network, 
  Cpu, 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { showTok } from "../constants";

interface CenterPanelProps {
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
  onSelectToken: (t: number) => void;
  onSelectNode: (t: number, l: number) => void;
  onNavToken: (dir: number) => void;
}

export const CenterPanel: React.FC<CenterPanelProps> = ({
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
  onSelectToken,
  onSelectNode,
  onNavToken,
}) => {
  const currentTokenText = (analysis && sel) ? showTok(analysis.tokens[sel.t]) : null;

  return (
    <div className="bg-[#090a0f] flex flex-col overflow-hidden min-w-0 select-none max-[1100px]:min-h-[540px]">
      {/* Center Top Toolbar */}
      <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-[#0e111a] border-b border-white/[0.08] shrink-0 max-[1100px]:px-4 max-[1100px]:flex-wrap">
        {/* Left: Section Indicator */}
        <div className="flex items-center gap-2.5">
          <div
            id="live-dot"
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              busy 
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] pulse-busy" 
                : live 
                ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] pulse-live" 
                : "bg-slate-600"
            }`}
          />
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-[10px] text-indigo-400 font-mono">
              2
            </span>
            <span>Network Circuit Flow</span>
          </div>
          {analysis && (
            <span className="text-[11px] font-mono text-slate-500 max-[900px]:hidden">
              12 Layers
            </span>
          )}
        </div>

        {/* Center: View Switcher Segmented Control */}
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

        {/* Right: Token Navigation */}
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

      {/* Interactive Token Ribbon */}
      <TokenRow
        analysis={analysis}
        circuit={circuit}
        sel={sel}
        onSelectToken={onSelectToken}
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

      {/* Status Bar */}
      <div className="px-5 py-2 bg-[#0c0e17] border-t border-white/[0.08] text-xs flex justify-between items-center gap-3 shrink-0 max-[1100px]:px-4">
        <div className="flex items-center gap-2 truncate">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 shrink-0" />
          <span id="status-msg" className="truncate text-slate-400 text-[11px]">
            {statusMsg.isError ? (
              <span className="text-rose-400 font-medium">{statusMsg.text}</span>
            ) : (
              statusMsg.text
            )}
          </span>
        </div>
        <span id="status-nodes" className="text-[11px] font-mono text-slate-500 shrink-0">
          {statusNodes}
        </span>
      </div>
    </div>
  );
};
