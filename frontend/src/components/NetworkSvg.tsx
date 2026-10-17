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
  token: string;
  activation: string;
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
    token: "",
    activation: "",
    concept: "",
  });

  const a = analysis;
  const L = a ? a.num_layers : 12;
  const n = a ? a.tokens.length : 0;
  const W = X0 + (L - 1) * COL_W + 40;
  const H = TOP + Math.max(n, 1) * ROW_H;

  const xOf = (l: number) => (l < 0 ? LABEL_X + 10 : X0 + l * COL_W);
  const yOf = (t: number) => TOP + t * ROW_H;

  const vmax = scaleMax(a, view, circuit);

  const handleMouseEnterNode = (e: React.MouseEvent, t: number, l: number) => {
    if (!a || l > revealed) return;
    const info = cellInfo(a, view, circuit, sel, t, l);
    if (info.index === null) return;

    const title = unitName(info.kind, l, info.index);
    const tokStr = `“${showTok(a.tokens[t])}”`;
    const activation = info.circuit
      ? `${info.value !== null ? info.value.toFixed(2) : "0.00"}σ circuit evidence`
      : `${info.value === null ? "—" : info.value.toFixed(2) + "σ"} above typical`;

    let concept = "Top concept: — (no clear concept; likely syntactic)";
    const label =
      info.kind === "head"
        ? a.head_labels[l]?.[info.index]
        : a.neuron_top[l]?.[t]?.find((x) => x.neuron === info.index)?.label;
    const found = a.token_concepts[t]?.[0];
    const witness = found && a.concepts[found.key]?.[info.kind]?.[t];

    if (info.circuit && info.unit) {
      concept = `Part of the ${circuit?.data.name} circuit (prefers ${info.unit.side})`;
    } else if (witness && witness[0] === l && witness[1] === info.index) {
      concept = `Top concept: ${found.name} → ${found.side} (${found.z}σ)`;
    } else if (label) {
      concept = `Top concept: ${label.name} → ${label.side} (d=${label.d})`;
    }

    updateTooltipPos(e, {
      visible: true,
      title,
      token: tokStr,
      activation,
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
    const top = e.clientY - rect.top + containerRef.current.scrollTop - 30;
    if (left + 270 > containerRef.current.clientWidth + containerRef.current.scrollLeft) {
      left -= 290;
    }
    setTooltip((prev) => ({
      ...prev,
      ...baseData,
      x: Math.max(4, left),
      y: Math.max(4, top),
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
      className="flex-1 relative overflow-auto min-h-0 network-container"
    >
      <svg
        id="network-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMin meet"
        className="w-full h-auto block select-none"
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-hot">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Layer labels */}
        <g id="layer-labels">
          <text
            x={LABEL_X}
            y={26}
            textAnchor="end"
            fill="#4a5568"
            fontSize={11}
            fontFamily="Inter, sans-serif"
          >
            token ↓ layer →
          </text>
          {Array.from({ length: L }).map((_, l) => {
            const x = X0 + l * COL_W;
            const lit = a && l <= revealed;
            const units = circuit && a ? circuitUnitsAt(circuit, view, l).length : null;
            const sub =
              units !== null
                ? units
                  ? `${units} in circuit`
                  : ""
                : view === "head"
                ? "attn"
                : "MLP";

            return (
              <React.Fragment key={`lbl-${l}`}>
                <text
                  x={x}
                  y={26}
                  textAnchor="middle"
                  fill={lit ? "#8892b0" : "#4a5568"}
                  fontSize={12}
                  fontFamily="Inter, sans-serif"
                >
                  L{l}
                </text>
                <text
                  x={x}
                  y={40}
                  textAnchor="middle"
                  fill="#3a4060"
                  fontSize={9}
                  fontFamily="Inter, sans-serif"
                >
                  {sub}
                </text>
              </React.Fragment>
            );
          })}
        </g>

        {/* Token labels */}
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
                  fill={isSel ? "#e8eaf6" : "#8892b0"}
                  fontSize={12}
                  fontWeight={isSel ? 600 : 400}
                  fontFamily="'JetBrains Mono', monospace"
                  className="cursor-pointer"
                  onMouseEnter={() => onSelectToken(t)}
                >
                  {showTok(a.tokens[t]).slice(0, 12)}
                </text>
              );
            })}
        </g>

        {/* Wires layer */}
        <g id="wires-layer">
          {a &&
            Array.from({ length: n }).map((_, t) => (
              <line
                key={`wire-${t}`}
                x1={LABEL_X + 10}
                y1={yOf(t)}
                x2={xOf(L - 1)}
                y2={yOf(t)}
                stroke="#1e2235"
                strokeWidth={1}
              />
            ))}
        </g>

        {/* Active path */}
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
                  if (w < 0.04) return null;
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
                      stroke={focus ? "#c47af0" : "#7c6af0"}
                      strokeWidth={(focus ? 1 : 0.5) + w * (focus ? 4 : 2.5)}
                      opacity={(focus ? 0.35 : 0.12) + w * (focus ? 0.65 : 0.45)}
                      strokeDasharray={focus ? "4 2" : undefined}
                      className={focus ? "wire-flow" : undefined}
                      filter={focus ? "url(#glow)" : undefined}
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
              stroke="#7c6af0"
              strokeWidth={2}
              strokeDasharray="4 2"
              className="wire-flow"
              opacity={0.8}
              filter="url(#glow)"
            />
          )}
        </g>

        {/* Nodes layer */}
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

                let fill = "#1a1f35";
                let stroke = "#2d3555";
                let strokeWidth = 1;
                let r = 7;
                let opacity = 0.55;

                if (info && info.value !== null) {
                  fill = f > 0.08 ? rampColor(f) : "#1a1f35";
                  stroke = f > 0.5 ? "#c47af0" : "#2d3555";
                  r = 6 + Math.min(f, 1) * 4;
                  opacity = 0.45 + Math.min(f, 1) * 0.55;
                }

                if (circuit && info && !info.circuit) {
                  opacity = 0.18;
                }

                if (circuit && info?.circuit && info.unit) {
                  const side = circuit.data.binary && info.unit.d < 0 ? 1 : 0;
                  stroke = conceptColor(circuit.key, side);
                  strokeWidth = 1.5;
                }

                let filter: string | undefined;
                if (f >= 0.85) filter = "url(#glow)";

                return (
                  <React.Fragment key={`node-${t}-${l}`}>
                    {/* Visual node circle */}
                    {!isSel ? (
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
                      <>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={12}
                          fill="#7c6af0"
                          stroke="#c47af0"
                          strokeWidth={2}
                          opacity={1}
                          filter="url(#glow-hot)"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={4}
                          fill="#fff"
                          opacity={0.85}
                        />
                      </>
                    )}

                    {/* Hit target circle */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={15}
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

      {/* Neuron tooltip */}
      <div
        id="neuron-tooltip"
        className={`absolute bg-[#131627] border border-[#7c6af0] rounded-[8px] p-2.5 px-3.5 text-[12px] pointer-events-none transition-opacity duration-150 z-10 min-w-[190px] max-w-[260px] shadow-[0_0_20px_rgba(124,106,240,0.35)] ${
          tooltip.visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
      >
        <div
          className="font-semibold text-[13px] mb-1 text-[#c47af0]"
          id="tt-title"
        >
          {tooltip.title}
        </div>
        <div className="text-[#8892b0] mt-0.5" id="tt-token">
          Token: <span className="text-[#e8eaf6]">{tooltip.token}</span>
        </div>
        <div className="text-[#8892b0] mt-0.5" id="tt-activation">
          Activation:{" "}
          <span className="text-[#e8eaf6]">{tooltip.activation}</span>
        </div>
        <div
          className="mt-1.5 pt-1.5 border-t border-[#1e2235] text-[#50d8ff] font-medium"
          id="tt-concept"
        >
          {tooltip.concept}
        </div>
      </div>
    </div>
  );
};
