import React, { useRef, useState } from "react";
import { ActiveCircuit, AnalysisResponse, Selection, ViewKind } from "../types";
import {
  COL_W,
  LABEL_X,
  ROW_H,
  TOP,
  X0,
  cellInfo,
  circuitUnitsAt,
  conceptColor,
  rampColor,
  scaleMax,
  showTok,
  unitName,
} from "../constants";

interface NetworkSvgProps {
  analysis: AnalysisResponse | null;
  circuit: ActiveCircuit | null;
  view: ViewKind;
  sel: Selection | null;
  revealed: number;
  onSelectToken: (t: number) => void;
  onSelectNode: (t: number, l: number) => void;
}

interface TooltipData {
  visible: boolean;
  x: number;
  y: number;
  title: string;
  kind: ViewKind;
  token: string;
  activation: string;
  actVal: number;
  concept: string;
}

export const NetworkSvg: React.FC<NetworkSvgProps> = ({
  analysis,
  circuit,
  view,
  sel,
  revealed,
  onSelectToken,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipData>({
    visible: false,
    x: 0,
    y: 0,
    title: "",
    kind: "head",
    token: "",
    activation: "",
    actVal: 0,
    concept: "",
  });

  const a = analysis;
  const L = a ? a.num_layers : 12;
  const n = a ? a.tokens.length : 0;
  const W = X0 + (L - 1) * COL_W + 50;
  const H = TOP + Math.max(n, 1) * ROW_H + 20;

  const xOf = (l: number) => (l < 0 ? LABEL_X + 12 : X0 + l * COL_W);
  const yOf = (t: number) => TOP + t * ROW_H;

  const vmax = scaleMax(a, view, circuit);

  const handleMouseEnterNode = (e: React.MouseEvent, t: number, l: number) => {
    if (!a || l > revealed) return;
    const info = cellInfo(a, view, circuit, sel, t, l);
    if (info.index === null) return;

    const title = unitName(info.kind, l, info.index);
    const tokStr = `"${showTok(a.tokens[t])}"`;
    const actVal = info.value !== null ? info.value : 0;
    const activation = info.circuit
      ? `${info.value !== null ? info.value.toFixed(2) : "0.00"}σ (circuit evidence)`
      : `${info.value === null ? "—" : (info.value >= 0 ? "+" : "") + info.value.toFixed(2) + "σ"} above typical`;

    let concept = "Top concept: — (syntactic / polysemantic)";
    const label =
      info.kind === "head"
        ? a.head_labels[l]?.[info.index]
        : a.neuron_top[l]?.[t]?.find((x) => x.neuron === info.index)?.label;
    const found = a.token_concepts[t]?.[0];
    const witness = found && a.concepts[found.key]?.[info.kind]?.[t];

    if (info.circuit && info.unit) {
      concept = `Member of ${circuit?.data.name} circuit (prefers ${info.unit.side}, d=${info.unit.d})`;
    } else if (witness && witness[0] === l && witness[1] === info.index) {
      concept = `Top concept: ${found.name} → ${found.side} (${found.z.toFixed(1)}σ)`;
    } else if (label) {
      concept = `Top concept: ${label.name} → ${label.side} (d=${label.d})`;
    }

    updateTooltipPos(e, {
      visible: true,
      title,
      kind: info.kind,
      token: tokStr,
      activation,
      actVal,
      concept,
    });
  };

  const updateTooltipPos = (
    e: React.MouseEvent,
    baseData?: Partial<TooltipData>
  ) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let left = e.clientX - rect.left + containerRef.current.scrollLeft + 16;
    const top = e.clientY - rect.top + containerRef.current.scrollTop - 40;
    if (left + 280 > containerRef.current.clientWidth + containerRef.current.scrollLeft) {
      left -= 300;
    }
    setTooltip((prev) => ({
      ...prev,
      ...baseData,
      x: Math.max(8, left),
      y: Math.max(8, top),
    }));
  };

  const handleMouseMoveNode = (e: React.MouseEvent) => {
    if (!tooltip.visible) return;
    updateTooltipPos(e);
  };

  const handleMouseLeaveNode = () => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div
      ref={containerRef}
      id="network-container"
      className="flex-1 relative overflow-auto min-h-0 custom-scrollbar select-none bg-white"
    >
      <svg
        id="network-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMin meet"
        className="w-full h-auto block"
      >
        <defs>
          {/* Subtle light glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-hot" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="1" />
          </linearGradient>
        </defs>

        {/* Layer Column Guide Panels */}
        <g id="layer-columns">
          {Array.from({ length: L }).map((_, l) => {
            const x = X0 + l * COL_W;
            const isHoveredLayer = sel?.layer === l;
            return (
              <rect
                key={`col-${l}`}
                x={x - COL_W / 2 + 8}
                y={18}
                width={COL_W - 16}
                height={H - 32}
                rx={8}
                fill={isHoveredLayer ? "#eef2ff" : "#f8fafc"}
                stroke={isHoveredLayer ? "#c7d2fe" : "transparent"}
                strokeWidth={1}
              />
            );
          })}
        </g>

        {/* Layer Headers (L0 -> L11) */}
        <g id="layer-labels">
          <text
            x={LABEL_X}
            y={28}
            textAnchor="end"
            fill="#94a3b8"
            fontSize={11}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight={600}
          >
            TOKENS &darr;
          </text>
          {Array.from({ length: L }).map((_, l) => {
            const isSelL = sel?.layer === l;
            return (
              <g key={`lhdr-${l}`}>
                <text
                  x={X0 + l * COL_W}
                  y={26}
                  textAnchor="middle"
                  fill={isSelL ? "#4338ca" : "#64748b"}
                  fontSize={12.5}
                  fontWeight={isSelL ? 800 : 700}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  L{l}
                </text>
                <text
                  x={X0 + l * COL_W}
                  y={38}
                  textAnchor="middle"
                  fill={isSelL ? "#6366f1" : "#94a3b8"}
                  fontSize={9.5}
                  fontWeight={600}
                  fontFamily="'Inter', sans-serif"
                >
                  {view === "head" ? "Attn" : "MLP"}
                </text>
              </g>
            );
          })}
        </g>

        {/* Token Y-Axis Row Labels */}
        <g id="token-labels">
          {a &&
            a.tokens.map((tok, t) => {
              const isSel = sel && sel.t === t;
              return (
                <text
                  key={`tok-${t}`}
                  x={LABEL_X}
                  y={yOf(t) + 5}
                  textAnchor="end"
                  fill={isSel ? "#1e1b4b" : "#475569"}
                  fontSize={isSel ? 14.5 : 13}
                  fontWeight={isSel ? 800 : 500}
                  fontFamily="'JetBrains Mono', monospace"
                  className="cursor-pointer transition-all duration-150"
                  onClick={() => onSelectToken(t)}
                >
                  {showTok(tok)}
                </text>
              );
            })}
        </g>

        {/* Token Horizontal Guide Rails */}
        <g id="guide-rails">
          {a &&
            a.tokens.map((_, t) => (
              <line
                key={`rail-${t}`}
                x1={X0 - 18}
                y1={yOf(t)}
                x2={W - 40}
                y2={yOf(t)}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="2,3"
              />
            ))}
        </g>

        {/* Attention Flow Connections */}
        <g id="flow-wires">
          {a &&
            a.tokens.map((_, t) =>
              Array.from({ length: L }).map((_, l) => {
                if (l > revealed) return null;
                const isFocused = sel && sel.t === t && sel.layer === l;

                // When inspecting an attention head, render attention target wires
                if (
                  isFocused &&
                  sel.kind === "head" &&
                  a.attention?.[l]?.[sel.index]?.[t]
                ) {
                  const weights = a.attention[l][sel.index][t];
                  return weights.map((w: number, srcT: number) => {
                    if (w < 0.05) return null;
                    const x1 = l > 0 ? xOf(l - 1) : LABEL_X + 15;
                    const y1 = yOf(srcT);
                    const x2 = xOf(l);
                    const y2 = yOf(t);
                    const dx = (x2 - x1) * 0.55;

                    return (
                      <path
                        key={`attn-${l}-${t}-${srcT}`}
                        d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth={Math.max(1.5, w * 5)}
                        strokeOpacity={Math.min(0.9, w + 0.2)}
                        strokeLinecap="round"
                        filter="url(#glow)"
                      />
                    );
                  });
                }

                // Default sequential layer flow
                if (l === 0) return null;
                const x1 = xOf(l - 1);
                const y1 = yOf(t);
                const x2 = xOf(l);
                const y2 = yOf(t);

                return (
                  <line
                    key={`wire-${l}-${t}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#cbd5e1"
                    strokeWidth={1}
                    strokeOpacity={0.7}
                  />
                );
              })
            )}
        </g>

        {/* Circuit Subnetwork Highlighting Overlay */}
        {circuit && a && (
          <g id="circuit-flow-overlay">
            {Array.from({ length: L }).map((_, l) => {
              if (l === 0 || l > revealed) return null;
              const prevUnits = circuitUnitsAt(circuit, view, l - 1);
              const currUnits = circuitUnitsAt(circuit, view, l);
              if (!prevUnits.length || !currUnits.length) return null;

              const t = sel ? sel.t : 0;
              const x1 = xOf(l - 1);
              const y1 = yOf(t);
              const x2 = xOf(l);
              const y2 = yOf(t);
              const dx = (x2 - x1) * 0.5;

              return (
                <path
                  key={`ckt-path-${l}`}
                  d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={conceptColor(circuit.key)}
                  strokeWidth={2.5}
                  strokeOpacity={0.8}
                  strokeDasharray="4,4"
                  filter="url(#glow)"
                />
              );
            })}
          </g>
        )}

        {/* Neural Nodes Grid */}
        <g id="nodes-grid">
          {a &&
            a.tokens.map((_, t) =>
              Array.from({ length: L }).map((_, l) => {
                const cx = xOf(l);
                const cy = yOf(t);
                const isRevealed = l <= revealed;
                const isSel = sel && sel.t === t && sel.layer === l;

                const info = isRevealed
                  ? cellInfo(a, view, circuit, sel, t, l)
                  : null;
                const val = info?.value ?? 0;
                const normFraction = Math.max(0, val) / vmax;

                let r = view === "head" ? 8 : 7;
                let fill = isRevealed ? rampColor(normFraction) : "#f1f5f9";
                let stroke = "#cbd5e1";
                let strokeWidth = 1;
                let opacity = isRevealed ? (normFraction > 0.1 ? 1 : 0.85) : 0.4;

                if (circuit && info?.circuit && info.unit) {
                  const side = circuit.data.binary && info.unit.d < 0 ? 1 : 0;
                  stroke = conceptColor(circuit.key, side);
                  strokeWidth = 2;
                  opacity = 1;
                }

                return (
                  <React.Fragment key={`node-${t}-${l}`}>
                    {/* Visual Node */}
                    {!isSel ? (
                      view === "head" ? (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          opacity={opacity}
                        />
                      ) : (
                        <rect
                          x={cx - r}
                          y={cy - r}
                          width={r * 2}
                          height={r * 2}
                          rx={3}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          opacity={opacity}
                        />
                      )
                    ) : (
                      <>
                        {/* Selected Reticle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={15}
                          fill="rgba(79, 70, 229, 0.12)"
                          stroke="#4f46e5"
                          strokeWidth={2}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#4f46e5"
                          stroke="#fff"
                          strokeWidth={1.5}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={2}
                          fill="#fff"
                        />
                      </>
                    )}

                    {/* Hit Target Circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={22}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={(e) => handleMouseEnterNode(e, t, l)}
                      onMouseMove={handleMouseMoveNode}
                      onMouseLeave={handleMouseLeaveNode}
                      onClick={() => {
                        if (!isRevealed) return;
                        const c = cellInfo(a, view, circuit, sel, t, l);
                        if (c.index === null) return;
                        onSelectNode(t, l);
                      }}
                    />
                  </React.Fragment>
                );
              })
            )}
        </g>
      </svg>

      {/* Floating Precision Tooltip */}
      <div
        id="neuron-tooltip"
        className={`absolute bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3.5 text-xs pointer-events-none transition-all duration-150 z-20 min-w-[220px] max-w-[290px] shadow-xl text-slate-800 space-y-2 ${
          tooltip.visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
          <span className="font-bold text-slate-900" id="tt-title">
            {tooltip.title}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase font-semibold border border-indigo-200">
            {tooltip.kind}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-500 text-xs" id="tt-token">
          <span>Token Context:</span>
          <span className="text-slate-800 font-mono font-bold">{tooltip.token}</span>
        </div>

        <div className="flex items-center justify-between text-slate-500 text-xs" id="tt-activation">
          <span>Activation:</span>
          <span className="text-indigo-600 font-mono font-bold">{tooltip.activation}</span>
        </div>

        <div
          className="pt-2 border-t border-slate-100 text-slate-700 text-xs leading-snug font-medium"
          id="tt-concept"
        >
          {tooltip.concept}
        </div>
      </div>
    </div>
  );
};
export default NetworkSvg;
