import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveCircuit,
  AnalysisResponse,
  ModelInfo,
  Selection,
  ViewKind,
} from "./types";
import {
  bestSelection,
  cellInfo,
  scaleMax,
  showTok,
} from "./constants";
import {
  clearUnitCache,
  getConceptCircuit,
  getModelInfo,
  runAnalyze,
} from "./api/client";
import { Header } from "./components/Header";
import { LeftPanel } from "./components/LeftPanel";
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";

export const App: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);

  const [text, setText] = useState(
    "The king ruled the kingdom with wisdom and kindness."
  );
  const [live, setLive] = useState(true);
  const [busy, setBusy] = useState(false);

  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [view, setView] = useState<ViewKind>("head");
  const [sel, setSel] = useState<Selection | null>(null);
  const [revealed, setRevealed] = useState<number>(Infinity);
  const [circuit, setCircuit] = useState<ActiveCircuit | null>(null);

  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean }>({
    text: "Starting up…",
  });
  const [statusNodes, setStatusNodes] = useState("0 neurons visualized");

  const textRef = useRef<string>(text);
  textRef.current = text;

  const lastTextRef = useRef<string | null>(null);
  const sweepTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const analysisRef = useRef<AnalysisResponse | null>(null);
  analysisRef.current = analysis;

  const viewRef = useRef<ViewKind>(view);
  viewRef.current = view;

  const circuitRef = useRef<ActiveCircuit | null>(circuit);
  circuitRef.current = circuit;

  const selRef = useRef<Selection | null>(sel);
  selRef.current = sel;

  const setStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg({ text: msg, isError });
  }, []);

  // Most interesting token
  const getMostInterestingToken = useCallback((a: AnalysisResponse) => {
    let best = 0;
    let bestZ = -1;
    a.token_concepts.forEach((c, i) => {
      if (c.length && Math.abs(c[0].z) > bestZ) {
        bestZ = Math.abs(c[0].z);
        best = i;
      }
    });
    return best;
  }, []);

  // Cascade sweep animation
  const startCascade = useCallback(
    (a: AnalysisResponse) => {
      if (sweepTimerRef.current) {
        clearTimeout(sweepTimerRef.current);
      }
      let curRevealed = -1;
      setRevealed(curRevealed);

      const step = () => {
        curRevealed++;
        setRevealed(curRevealed);

        if (curRevealed < a.num_layers - 1) {
          setStatus(
            `Processing layer ${curRevealed + 1} / ${a.num_layers} — attention heads, then MLP neurons…`
          );
          sweepTimerRef.current = window.setTimeout(step, 90);
          return;
        }

        setRevealed(Infinity);
        const t = getMostInterestingToken(a);
        const newSel = bestSelection(a, viewRef.current, circuitRef.current, t);
        setSel(newSel);

        const found = a.token_concepts
          .map((c, i) =>
            c.length ? `“${showTok(a.tokens[i])}” → ${c[0].name}` : null
          )
          .filter(Boolean);

        if (a.truncated) {
          setStatus(
            `Only the first ${a.tokens.length} tokens were analyzed. Hover any word.`
          );
        } else if (found.length) {
          setStatus(
            `Analysis complete — concepts detected: ${found
              .slice(0, 4)
              .join(", ")}${found.length > 4 ? "…" : ""}. Hover any word.`
          );
        } else {
          setStatus(
            "Analysis complete — no strong concept detected; hover any word to see what fires."
          );
        }
      };

      step();
    },
    [getMostInterestingToken, setStatus]
  );

  // Circuit loader
  const loadCircuit = useCallback(
    async (
      key: string,
      custom: { a: string[]; b: string[] } | null = null,
      { quiet = false } = {}
    ) => {
      const a = analysisRef.current;
      if (!a) {
        setStatus("Run an analysis first.", true);
        return;
      }
      if (!quiet) {
        setStatus(`Tracing the ${key === "custom" ? "custom" : key} circuit…`);
      }

      const body = custom
        ? { analysis_id: a.analysis_id, words_a: custom.a, words_b: custom.b }
        : { analysis_id: a.analysis_id, key };

      try {
        const data = await getConceptCircuit(body);
        const newCircuit: ActiveCircuit = { key, custom, data };
        setCircuit(newCircuit);

        if (!quiet) {
          const scores = data.token_scores;
          let t = 0;
          scores.forEach((s, i) => {
            if (Math.abs(s) > Math.abs(scores[t])) t = i;
          });
          const newSel = bestSelection(a, viewRef.current, newCircuit, t);
          setSel(newSel);
          setStatus(
            `${data.name} circuit: ${data.heads.length} heads + ${data.neurons.length} neurons. Strongest on “${showTok(
              a.tokens[t]
            )}”.`
          );
        }
      } catch (err: unknown) {
        setCircuit(null);
        setStatus(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
          true
        );
      }
    },
    [setStatus]
  );

  const clearCircuit = useCallback(() => {
    setCircuit(null);
    const a = analysisRef.current;
    if (a) {
      const currentT = selRef.current ? selRef.current.t : 0;
      setSel(bestSelection(a, viewRef.current, null, currentT));
    }
  }, []);

  // Run analysis
  const executeAnalysis = useCallback(
    async ({ force = false, textOverride }: { force?: boolean; textOverride?: string } = {}) => {
      const targetText = textOverride !== undefined ? textOverride : textRef.current;
      const trimmed = targetText.trim();
      if (!trimmed || (!force && trimmed === lastTextRef.current)) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      setBusy(true);
      setStatus("Running forward pass through GPT-2…");

      try {
        const a = await runAnalyze(trimmed);
        if (textRef.current.trim() !== trimmed && !force) return;

        setAnalysis(a);
        lastTextRef.current = trimmed;
        setSel(null);
        clearUnitCache();

        if (circuitRef.current) {
          await loadCircuit(circuitRef.current.key, circuitRef.current.custom, {
            quiet: true,
          });
        }

        setStatusNodes(
          `${a.tokens.length} tokens × ${a.num_layers} layers · ${
            a.num_heads
          } heads + ${a.mlp_dim.toLocaleString()} neurons per layer`
        );
        startCascade(a);
      } catch (err: unknown) {
        setStatus(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
          true
        );
      } finally {
        setBusy(false);
      }
    },
    [loadCircuit, setStatus, startCascade]
  );

  // Initial load
  useEffect(() => {
    setStatus("Connecting to the model…");
    getModelInfo()
      .then((info) => {
        setModelInfo(info);
        // Run initial analysis
        executeAnalysis({ force: true });
      })
      .catch((err) => {
        setModelError(err.message);
        setStatus(
          `Backend not reachable (${err.message}). Is the server running?`,
          true
        );
      });
  }, []);

  // Live typing debounce
  useEffect(() => {
    if (!live) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      executeAnalysis();
    }, 650);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [text, live, executeAnalysis]);

  // Select token
  const handleSelectToken = useCallback(
    (t: number) => {
      const a = analysisRef.current;
      if (!a) return;
      const newSel = bestSelection(a, viewRef.current, circuitRef.current, t);
      setSel(newSel);
    },
    []
  );

  // View toggle
  const handleSetView = useCallback((newView: ViewKind) => {
    setView(newView);
    const a = analysisRef.current;
    if (!a) return;
    const currentT = selRef.current ? selRef.current.t : 0;
    setSel(bestSelection(a, newView, circuitRef.current, currentT));
  }, []);

  // Token navigation
  const handleNavToken = useCallback((dir: number) => {
    const a = analysisRef.current;
    if (!a) return;
    const cur = selRef.current ? selRef.current.t : -1;
    const nextT = Math.max(0, Math.min(a.tokens.length - 1, cur + dir));
    if (nextT !== cur) {
      setSel(bestSelection(a, viewRef.current, circuitRef.current, nextT));
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl?.matches("textarea, input")) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleNavToken(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNavToken(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavToken]);

  // Node selection from NetworkSvg
  const handleSelectNode = useCallback(
    (t: number, l: number) => {
      const a = analysisRef.current;
      if (!a) return;
      const c = cellInfo(a, viewRef.current, circuitRef.current, selRef.current, t, l);
      if (c.index === null) return;
      setSel({
        t,
        layer: l,
        kind: c.kind,
        index: c.index,
        reason: { type: circuitRef.current ? "circuit" : "manual" },
      });
    },
    []
  );

  // Unit selection from LeftPanel circuit list
  const handleSelectUnitFromCircuit = useCallback(
    (kind: ViewKind, layer: number, index: number) => {
      const a = analysisRef.current;
      const c = circuitRef.current;
      if (!a || !c) return;
      const u = [...c.data.heads, ...c.data.neurons].find(
        (x) => x.kind === kind && x.layer === layer && x.index === index
      );
      if (!u) return;

      let t = 0;
      u.evidence.forEach((v, i) => {
        if (v > u.evidence[t]) t = i;
      });

      setView(kind);
      setSel({
        t,
        layer,
        kind,
        index,
        reason: { type: "circuit" },
      });
    },
    []
  );

  const scaleMaxVal = scaleMax(analysis, view, circuit);
  const scaleMaxLabel = circuit
    ? "4σ+ (circuit evidence)"
    : `${scaleMaxVal.toFixed(1)}σ+`;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0d0f1a] text-[#e8eaf6]">
      <Header info={modelInfo} error={modelError} />
      <main className="grid grid-cols-[300px_minmax(0,1fr)_320px] flex-1 min-h-0 overflow-hidden max-[1100px]:flex max-[1100px]:flex-col max-[1100px]:overflow-visible">
        <LeftPanel
          text={text}
          setText={setText}
          live={live}
          setLive={setLive}
          busy={busy}
          onRun={(force, textOverride) => executeAnalysis({ force, textOverride })}
          info={modelInfo}
          circuit={circuit}
          onSelectConcept={(key) =>
            circuit?.key === key ? clearCircuit() : loadCircuit(key)
          }
          onCustomConcept={(wordsA, wordsB) =>
            loadCircuit("custom", { a: wordsA, b: wordsB })
          }
          onClearCircuit={clearCircuit}
          scaleMaxLabel={scaleMaxLabel}
          onSelectUnitFromCircuit={handleSelectUnitFromCircuit}
        />
        <CenterPanel
          analysis={analysis}
          circuit={circuit}
          view={view}
          setView={handleSetView}
          sel={sel}
          revealed={revealed}
          live={live}
          busy={busy}
          statusMsg={statusMsg}
          statusNodes={statusNodes}
          onSelectToken={handleSelectToken}
          onSelectNode={handleSelectNode}
          onNavToken={handleNavToken}
        />
        <RightPanel
          analysis={analysis}
          info={modelInfo}
          circuit={circuit}
          sel={sel}
          onSelect={(newSel) => setSel(newSel)}
        />
      </main>
    </div>
  );
};
export default App;
