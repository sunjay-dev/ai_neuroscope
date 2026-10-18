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
      className="flex-1 relative overflow-auto min-h-0 custom-scrollbar select-none bg-[#090a0f]"
    >
      <svg
        id="network-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMin meet"
        className="w-full h-auto block"
      >
        <defs>
          {/* Subtle modern glow filters */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-hot" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Gradient definitions for focused attention ribbons */}
          <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {/* Layer Column Background Guides */}
        <g id="layer-columns">
          {Array.from({ length: L }).map((_, l) => {
            const x = X0 + l * COL_W;
            const isHoveredLayer = sel?.layer === l;
            return (
              <rect
                key={`col-${l}`}
                x={x - COL_W / 2 + 6}
                y={15}
                width={COL_W - 12}
                height={H - 25}
                rx={6}
                fill={isHoveredLayer ? "rgba(99, 102, 241, 0.04)" : "rgba(255, 255, 255, 0.01)"}
                stroke={isHoveredLayer ? "rgba(99, 102, 241, 0.15)" : "transparent"}
                strokeWidth={1}
              />
            );
          })}
        </g>

        {/* Layer Headers (L0 -> L11) */}
        <g id="layer-labels">
          <text
            x={LABEL_X}
            y={24}
            textAnchor="end"
            fill="#64748b"
            fontSize={10}
            fontFamily="'JetBrains Mono', monospace"
            fontWeight={500}
          >
            TOKENS ↓
          </text>
          {Array.from({ length: L }).map((_, l) => {
            const x = X0 + l * COL_W;
            const lit = a && l <= revealed;
            const isFocused = sel?.layer === l;
            const units = circuit && a ? circuitUnitsAt(circuit, view, l).length : null;
            const sub =
              units !== null
                ? units
                  ? `${units} in circuit`
                  : ""
                : view === "head"
                ? "Attn"
                : "MLP";

            return (
              <React.Fragment key={`lbl-${l}`}>
                <text
                  x={x}
                  y={24}
                  textAnchor="middle"
                  fill={isFocused ? "#818cf8" : lit ? "#cbd5e1" : "#475569"}
                  fontSize={11}
                  fontWeight={isFocused ? 600 : 500}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  L{l}
                </text>
                <text
                  x={x}
                  y={38}
                  textAnchor="middle"
                  fill={isFocused ? "#6366f1" : "#475569"}
                  fontSize={8.5}
                  fontFamily="'Inter', sans-serif"
                >
                  {sub}
                </text>
              </React.Fragment>
            );
          })}
        </g>

        {/* Token Labels on Left Axis */}
        <g id="token-labels">
          {a &&
            Array.from({ length: n }).map((_, t) => {
              const isSel = sel && sel.t === t;
              return (
                <text
                  key={`tok-${t}`}
                  x={LABEL_X}
                  y={yOf(t) + 4}
                  textAnchor="end"
                  fill={isSel ? "#f8fafc" : "#94a3b8"}
                  fontSize={11.5}
                  fontWeight={isSel ? 600 : 400}
                  fontFamily="'JetBrains Mono', monospace"
                  className="cursor-pointer hover:fill-indigo-300 transition-colors"
                  onMouseEnter={() => onSelectToken(t)}
                  onClick={() => onSelectToken(t)}
                >
                  {showTok(a.tokens[t]).slice(0, 14)}
                </text>
              );
            })}
        </g>

        {/* Horizontal Guide Rails */}
        <g id="wires-layer">
          {a &&
            Array.from({ length: n }).map((_, t) => {
              const isSel = sel && sel.t === t;
              return (
                <line
                  key={`wire-${t}`}
                  x1={LABEL_X + 10}
                  y1={yOf(t)}
                  x2={xOf(L - 1)}
                  y2={yOf(t)}
                  stroke={isSel ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.03)"}
                  strokeWidth={isSel ? 1.5 : 1}
                  strokeDasharray={isSel ? undefined : "3 3"}
                />
              );
            })}
        </g>

        {/* Attention Wires / Active Flow Path */}
        <g id="active-path">
          {a && sel && view === "head" && (
            <>
              {Array.from({ length: Math.min(L, revealed + 1) }).map((_, l) => {
                const info = cellInfo(a, view, circuit, sel, sel.t, l);
                if (info.index === null) return null;
                const row = a.attention[l]?.[info.index]?.[sel.t];
                if (!row) return null;
                const focus = l === sel.layer;

                return Array.from({ length: sel.t + 1 }).map((__, j) => {
                  const w = row[j];
                  if (w < 0.035) return null;
                  const x1 = xOf(l - 1);
                  const y1 = yOf(j);
                  const x2 = xOf(l);
                  const y2 = yOf(sel.t);
                  const mx = (x1 + x2) / 2;

                  return (
                    <path
                      key={`path-${l}-${j}`}
                      d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
                      fill="none"
                      stroke={focus ? "url(#flow-gradient)" : "#6366f1"}
                      strokeWidth={(focus ? 1.2 : 0.6) + w * (focus ? 3.5 : 2.2)}
                      opacity={(focus ? 0.4 : 0.12) + w * (focus ? 0.6 : 0.4)}
                      strokeDasharray={focus ? "5 3" : undefined}
                      className={focus ? "wire-flow" : undefined}
                      filter={focus && w > 0.15 ? "url(#glow)" : undefined}
                    />
                  );
                });
              })}
            </>
          )}

          {a && sel && view === "neuron" && (
            <line
              x1={LABEL_X + 10}
              y1={yOf(sel.t)}
              x2={xOf(Math.min(sel.layer, revealed))}
              y2={yOf(sel.t)}
              stroke="#818cf8"
              strokeWidth={2}
              strokeDasharray="4 3"
              className="wire-flow"
              opacity={0.85}
              filter="url(#glow)"
            />
          )}
        </g>

        {/* Nodes Layer */}
        <g id="nodes-layer">
          {a &&
            Array.from({ length: n }).flatMap((_, t) =>
              Array.from({ length: L }).map((__, l) => {
                const cx = xOf(l);
                const cy = yOf(t);
                const isRevealed = l <= revealed;
                const info = isRevealed
                  ? cellInfo(a, view, circuit, sel, t, l)
                  : null;
                const isSel = sel && sel.t === t && sel.layer === l;
                const f =
                  info && info.value !== null
                    ? Math.max(0, info.value) / vmax
                    : 0;

                let fill = "#141724";
                let stroke = "rgba(255, 255, 255, 0.12)";
                let strokeWidth = 1;
                let r = 6.5;
                let opacity = 0.55;

                if (info && info.value !== null) {
                  fill = f > 0.08 ? rampColor(f) : "#141724";
                  stroke = f > 0.5 ? "#c084fc" : "rgba(255, 255, 255, 0.15)";
                  r = 5.5 + Math.min(f, 1) * 4;
                  opacity = 0.5 + Math.min(f, 1) * 0.5;
                }

                if (circuit && info && !info.circuit) {
                  opacity = 0.14;
                }

                if (circuit && info?.circuit && info.unit) {
                  const side = circuit.data.binary && info.unit.d < 0 ? 1 : 0;
                  stroke = conceptColor(circuit.key, side);
                  strokeWidth = 1.8;
                  opacity = Math.max(opacity, 0.85);
                }

                let filter: string | undefined;
                if (f >= 0.8) filter = "url(#glow)";

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
                          filter={filter}
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
                          filter={filter}
                        />
                      )
                    ) : (
                      <>
                        {/* Selected Reticle */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={13}
                          fill="rgba(99, 102, 241, 0.25)"
                          stroke="#818cf8"
                          strokeWidth={2}
                          filter="url(#glow-hot)"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#6366f1"
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
                      r={16}
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
        className={`absolute bg-[#0f121e]/95 backdrop-blur-md border border-indigo-500/30 rounded-xl p-3 text-xs pointer-events-none transition-all duration-150 z-20 min-w-[210px] max-w-[280px] shadow-2xl shadow-black/80 space-y-1.5 ${
          tooltip.visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
      >
        <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
          <span className="font-semibold text-slate-100" id="tt-title">
            {tooltip.title}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 uppercase">
            {tooltip.kind}
          </span>
        </div>

        <div className="flex items-center justify-between text-slate-400 text-[11px]" id="tt-token">
          <span>Token Context:</span>
          <span className="text-slate-200 font-mono font-medium">{tooltip.token}</span>
        </div>

        <div className="flex items-center justify-between text-slate-400 text-[11px]" id="tt-activation">
          <span>Activation:</span>
          <span className="text-indigo-300 font-mono font-semibold">{tooltip.activation}</span>
        </div>

        <div
          className="pt-1.5 border-t border-white/[0.08] text-sky-400 text-[11px] leading-snug font-medium"
          id="tt-concept"
        >
          {tooltip.concept}
        </div>
      </div>
    </div>
  );
};
