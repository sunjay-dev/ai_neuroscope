import React from "react";
import { ActiveCircuit, AnalysisResponse, Selection, ViewKind } from "../types";
import { TokenRow } from "./TokenRow";
import { NetworkSvg } from "./NetworkSvg";
import { Button } from "./ui/button";

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
  return (
    <div className="bg-[#0d0f1a] flex flex-col overflow-hidden min-w-0 max-[1100px]:min-h-[520px]">
      {/* Center Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3 bg-[#131627] border-b border-[#1e2235] shrink-0 max-[1100px]:px-4">
        <div className="flex items-center gap-2 text-[13px] font-medium text-[#8892b0] uppercase tracking-[0.8px]">
          <div
            id="live-dot"
            className={`live-dot ${busy ? "busy" : live ? "on" : ""}`}
          />
          2. Model Processing (Live)
        </div>

        {/* View Toggle */}
        <div className="flex bg-[#0a0c14] border border-[#1e2235] rounded-[7px] p-[2px]" id="view-toggle">
          <button
            data-view="head"
            onClick={() => setView("head")}
            className={`text-[12px] py-[5px] px-2.5 rounded-[5px] cursor-pointer transition-colors ${
              view === "head"
                ? "bg-[#7c6af0] text-white"
                : "bg-transparent text-[#8892b0] hover:text-[#e8eaf6]"
            }`}
          >
            Attention heads
          </button>
          <button
            data-view="neuron"
            onClick={() => setView("neuron")}
            className={`text-[12px] py-[5px] px-2.5 rounded-[5px] cursor-pointer transition-colors ${
              view === "neuron"
                ? "bg-[#7c6af0] text-white"
                : "bg-transparent text-[#8892b0] hover:text-[#e8eaf6]"
            }`}
          >
            MLP neurons
          </button>
        </div>

        {/* Token Navigation */}
        <div className="flex items-center gap-2 text-[12px] text-[#8892b0]">
          Token:{" "}
          <span id="token-idx" className="text-[#e8eaf6]">
            {analysis && sel ? `${sel.t + 1} / ${analysis.tokens.length}` : "—"}
          </span>
          <Button
            variant="nav"
            id="prev-btn"
            aria-label="Previous token"
            onClick={() => onNavToken(-1)}
          >
            ‹
          </Button>
          <Button
            variant="nav"
            id="next-btn"
            aria-label="Next token"
            onClick={() => onNavToken(1)}
          >
            ›
          </Button>
        </div>
      </div>

      {/* Token Row */}
      <TokenRow
        analysis={analysis}
        circuit={circuit}
        sel={sel}
        onSelectToken={onSelectToken}
      />

      {/* Network SVG */}
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
      <div className="px-5 py-2 bg-[#131627] border-t border-[#1e2235] text-[11px] text-[#4a5568] flex justify-between items-center gap-3 shrink-0 max-[1100px]:px-4">
        <span id="status-msg">
          {statusMsg.isError ? (
            <span className="text-[#ff6b6b]">{statusMsg.text}</span>
          ) : (
            statusMsg.text
          )}
        </span>
        <span id="status-nodes">{statusNodes}</span>
      </div>
    </div>
  );
};
