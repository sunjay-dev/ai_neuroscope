import React, { useState } from "react";
import { ActiveCircuit, ModelInfo, ViewKind } from "../types";
import { conceptColor, shortUnit } from "../constants";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

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

const EXAMPLES = [
  { label: "The king ruled…", text: "The king ruled the kingdom with wisdom and kindness." },
  { label: "I love this movie", text: "I love this movie" },
  { label: "Sarcasm", text: "Oh great, another Monday morning meeting." },
  { label: "She is a doctor", text: "She is a doctor and he is a nurse." },
  { label: "Negative review", text: "I hate this terrible, boring film." },
  { label: "Mixed concepts", text: "The cat chased three dogs in London on Friday." },
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
  const [wordsA, setWordsA] = useState("cat, dog, horse, bird");
  const [wordsB, setWordsB] = useState("car, bus, train, truck");

  const handleCustomSubmit = () => {
    const split = (v: string) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    onCustomConcept(split(wordsA), split(wordsB));
  };

  return (
    <div className="bg-[#131627] border-r border-[#1e2235] p-5 overflow-y-auto flex flex-col gap-3.5 scrollbar-hidden max-[1100px]:border-r-0 max-[1100px]:border-b max-[1100px]:p-4 max-[1100px]:overflow-visible">
      {/* 1. Input Text Title */}
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#8892b0] uppercase tracking-[0.8px] pb-3 border-b border-[#1e2235]">
        <Badge variant="num">1</Badge>
        Input Text
      </div>

      {/* Textarea */}
      <Textarea
        id="input-text"
        placeholder="Type a sentence to analyze..."
        maxLength={512}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onRun(true);
          }
        }}
        className="h-[100px]"
      />

      {/* Input Meta */}
      <div className="flex justify-between items-center -mt-1.5">
        <label className="text-[11px] text-[#8892b0] flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            id="live-toggle"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
            className="accent-[#7c6af0]"
          />
          Live: re-analyze as I type
        </label>
        <div className="text-[11px] text-[#4a5568]">
          <span id="char-num">{text.length}</span> / 512
        </div>
      </div>

      {/* Run button */}
      <Button
        variant="gradient"
        id="run-btn"
        disabled={busy}
        onClick={() => onRun(true)}
      >
        ▶ Run Analysis
      </Button>

      {/* Examples */}
      <div>
        <div className="text-[11px] text-[#8892b0] mb-2">Try these examples:</div>
        <div className="grid grid-cols-2 gap-1.5">
          {EXAMPLES.map((ex) => (
            <div
              key={ex.label}
              className="bg-[#1a1f35] border border-[#1e2235] rounded-[6px] py-[7px] px-2.5 text-[11px] text-[#8892b0] cursor-pointer hover:border-[#7c6af0] hover:text-[#e8eaf6] hover:bg-[#1a1f35] transition-all text-center truncate"
              onClick={() => {
                setText(ex.text);
                onRun(true, ex.text);
              }}
            >
              {ex.label}
            </div>
          ))}
        </div>
      </div>

      {/* Concept Circuit Finder */}
      <div className="text-[12px] font-medium text-[#8892b0] uppercase tracking-[0.8px] pt-3 border-t border-[#1e2235]">
        Concept Circuit Finder
      </div>
      <div className="text-[11px] text-[#4a5568] leading-[1.5]">
        Pick a concept to light up its circuit — the heads &amp; neurons that GPT-2 uses for it — across your sentence.
      </div>

      {/* Concept Grid */}
      <div className="grid grid-cols-2 gap-1.5" id="concept-grid">
        {(info?.concepts || []).map((c) => {
          const isActive = circuit?.key === c.key;
          const color = conceptColor(c.key);
          return (
            <div
              key={c.key}
              className={`flex items-center gap-1.5 text-left rounded-[6px] py-[7px] px-2.5 text-[11px] cursor-pointer transition-all truncate border ${
                isActive
                  ? "text-[#e8eaf6]"
                  : "bg-[#1a1f35] border-[#1e2235] text-[#8892b0] hover:border-[#7c6af0] hover:text-[#e8eaf6] hover:bg-[#1a1f35]"
              }`}
              style={
                isActive
                  ? {
                      borderColor: color,
                      background: `color-mix(in srgb, ${color} 14%, #1a1f35)`,
                    }
                  : {}
              }
              title={c.binary ? `${c.side_a} vs ${c.side_b}` : `${c.side_a}, e.g. ${c.examples.join(", ")}`}
              onClick={() => onSelectConcept(c.key)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: color }}
              />
              <span className="truncate">{c.name}</span>
            </div>
          );
        })}
      </div>

      {/* Custom Probe */}
      <details className="text-[12px] text-[#8892b0]">
        <summary className="cursor-pointer mb-2 font-normal">Custom probe (your own words)</summary>
        <div className="flex flex-col gap-1.5 mt-1">
          <input
            id="words-a"
            type="text"
            placeholder="side A, e.g. cat, dog, horse"
            value={wordsA}
            onChange={(e) => setWordsA(e.target.value)}
            className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-[8px] p-2 text-[12px] text-[#e8eaf6] focus:border-[#7c6af0] focus:outline-none transition-colors"
          />
          <div className="text-center text-[11px] text-[#4a5568] my-1">vs</div>
          <input
            id="words-b"
            type="text"
            placeholder="side B, e.g. car, bus, train"
            value={wordsB}
            onChange={(e) => setWordsB(e.target.value)}
            className="w-full bg-[#0a0c14] border border-[#1e2235] rounded-[8px] p-2 text-[12px] text-[#e8eaf6] focus:border-[#7c6af0] focus:outline-none transition-colors"
          />
          <Button
            variant="ghost"
            id="custom-btn"
            onClick={handleCustomSubmit}
          >
            Find circuit
          </Button>
        </div>
      </details>

      {/* Circuit Box */}
      {circuit && (
        <div id="circuit-box">
          <div className="bg-[#0a0c14] border border-[#1e2235] rounded-[8px] p-3 flex flex-col gap-2 text-[12px]">
            <div
              className="font-semibold"
              style={{ color: conceptColor(circuit.key) }}
            >
              {circuit.data.name} circuit
            </div>
            <div className="text-[11px] text-[#8892b0] leading-[1.5]">
              Token tint = circuit reading vs ordinary text.{" "}
              {circuit.data.binary ? (
                <>
                  <span style={{ color: conceptColor(circuit.key, 0) }}>
                    ■ {circuit.data.side_a}
                  </span>{" "}
                  &nbsp;{" "}
                  <span style={{ color: conceptColor(circuit.key, 1) }}>
                    ■ {circuit.data.side_b}
                  </span>
                </>
              ) : (
                <span style={{ color: conceptColor(circuit.key, 0) }}>
                  ■ {circuit.data.side_a}
                </span>
              )}
            </div>

            <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">Heads</div>
            <div className="flex flex-wrap gap-1.5">
              {circuit.data.heads.map((u) => {
                const peak = Math.max(...u.evidence);
                return (
                  <span
                    key={`h-${u.layer}-${u.index}`}
                    className={`py-1 px-2 bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[11px] font-mono cursor-pointer transition-colors ${
                      peak > 1
                        ? "text-[#e8eaf6] border-[#c47af0]"
                        : "text-[#8892b0] hover:border-[#7c6af0] hover:text-[#e8eaf6]"
                    }`}
                    title={`effect size d=${u.d} (prefers ${u.side})`}
                    onClick={() => onSelectUnitFromCircuit("head", u.layer, u.index)}
                  >
                    {shortUnit(u.kind, u.layer, u.index)}
                  </span>
                );
              })}
            </div>

            <div className="text-[11px] text-[#8892b0] uppercase tracking-[0.7px]">Neurons</div>
            <div className="flex flex-wrap gap-1.5">
              {circuit.data.neurons.map((u) => {
                const peak = Math.max(...u.evidence);
                return (
                  <span
                    key={`n-${u.layer}-${u.index}`}
                    className={`py-1 px-2 bg-[#1a1f35] border border-[#1e2235] rounded-[5px] text-[11px] font-mono cursor-pointer transition-colors ${
                      peak > 1
                        ? "text-[#e8eaf6] border-[#c47af0]"
                        : "text-[#8892b0] hover:border-[#7c6af0] hover:text-[#e8eaf6]"
                    }`}
                    title={`effect size d=${u.d} (prefers ${u.side})`}
                    onClick={() => onSelectUnitFromCircuit("neuron", u.layer, u.index)}
                  >
                    {shortUnit(u.kind, u.layer, u.index)}
                  </span>
                );
              })}
            </div>

            <button
              className="text-[11px] text-[#8892b0] bg-transparent border-none cursor-pointer underline self-start p-0 mt-1"
              id="clear-circuit"
              onClick={onClearCircuit}
            >
              Clear circuit
            </button>
          </div>
        </div>
      )}

      {/* Intensity Box */}
      <div className="bg-[#0a0c14] border border-[#1e2235] rounded-[8px] p-3 mt-auto max-[1100px]:mt-0">
        <div className="text-[13px] font-medium text-[#8892b0] mb-2">
          Activation Intensity{" "}
          <span className="text-[#4a5568] font-normal">(σ above typical text)</span>
        </div>
        <div className="h-2 rounded-[4px] bg-gradient-to-r from-[#2d3555] via-[#7c6af0] via-[#c47af0] to-[#f072b8]" />
        <div className="flex justify-between mt-1 text-[10px] text-[#4a5568]">
          <span>0σ</span>
          <span id="scale-max">{scaleMaxLabel}</span>
        </div>
      </div>
    </div>
  );
};
