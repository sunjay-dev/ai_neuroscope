import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActiveCircuit,
  AnalysisResponse,
  ModelInfo,
  Selection,
  ViewKind,
  WorkspaceTab,
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
import { CenterPanel } from "./components/CenterPanel";
import { RightPanel } from "./components/RightPanel";
import { HelpModal } from "./components/HelpModal";

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

  // Studio Workspace Active Tab
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("flow");
  const [isPlaying, setIsPlaying] = useState(false);

  // Modals & Panels
  const [helpOpen, setHelpOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  const [statusMsg, setStatusMsg] = useState<{ text: string; isError?: boolean }>({
    text: "Connecting to GPT-2…",
  });
  const [statusNodes, setStatusNodes] = useState("0 units visualized");

  const textRef = useRef<string>(text);
  textRef.current = text;

  const lastTextRef = useRef<string | null>(null);
  const sweepTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const playTimerRef = useRef<number | null>(null);
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
            `Streaming forward pass: Layer ${curRevealed + 1} / ${a.num_layers}…`
          );
          sweepTimerRef.current = window.setTimeout(step, 60);
          return;
        }

        setRevealed(Infinity);
        const t = getMostInterestingToken(a);
        const newSel = bestSelection(a, viewRef.current, circuitRef.current, t);
        setSel(newSel);

        const found = a.token_concepts
          .map((c, i) =>
            c.length ? `"${showTok(a.tokens[i])}" → ${c[0].name}` : null
          )
          .filter(Boolean);

        if (a.truncated) {
          setStatus(
            `Truncated: only first ${a.tokens.length} tokens analyzed. Hover any token to inspect.`
          );
        } else if (found.length) {
          setStatus(
            `Analysis ready · concepts detected: ${found
              .slice(0, 4)
              .join(", ")}${found.length > 4 ? "…" : ""}. Hover any token or node.`
          );
        } else {
          setStatus(
            "Forward pass complete · hover any token or click a node to inspect mechanistic activations."
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
        setStatus(`Extracting ${key === "custom" ? "custom" : key} circuit subnetwork…`);
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
            `${data.name} circuit: ${data.heads.length} heads + ${data.neurons.length} neurons. Max evidence on "${showTok(
              a.tokens[t]
            )}".`
          );
        }
      } catch (err: unknown) {
        setCircuit(null);
        setStatus(
          `Circuit extraction error: ${err instanceof Error ? err.message : String(err)}`,
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
          `${a.tokens.length} tokens × ${a.num_layers}L · ${
            a.num_heads
          }H + ${a.mlp_dim.toLocaleString()} MLP/L`
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
    setStatus("Connecting to GPT-2 backend…");
    getModelInfo()
      .then((info) => {
        setModelInfo(info);
        executeAnalysis({ force: true });
      })
      .catch((err) => {
        setModelError(err.message);
        setStatus(
          `Backend connection failed (${err.message}). Verify the API server is active.`,
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
    }, 600);

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

  // Playback Step-Through
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
      return;
    }

    playTimerRef.current = window.setInterval(() => {
      const a = analysisRef.current;
      if (!a) return;
      const cur = selRef.current ? selRef.current.t : 0;
      const nextT = (cur + 1) % a.tokens.length;
      setSel(bestSelection(a, viewRef.current, circuitRef.current, nextT));
    }, 1200);

    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying]);

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
      setIsInspectorOpen(true);
    },
    []
  );

  // Select head from HeadMatrixView
  const handleSelectHead = useCallback(
    (layer: number, head: number) => {
      const currentT = selRef.current ? selRef.current.t : 0;
      setSel({
        t: currentT,
        layer,
        kind: "head",
        index: head,
        reason: { type: circuitRef.current ? "circuit" : "manual" },
      });
      setIsInspectorOpen(true);
    },
    []
  );

  // Keyboard navigation & Shortcuts
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
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "1") {
        setActiveTab("flow");
      } else if (e.key === "2") {
        setActiveTab("heads");
      } else if (e.key === "3") {
        setActiveTab("predictions");
      } else if (e.key === "4") {
        setActiveTab("circuits");
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsInspectorOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNavToken, togglePlay]);

  const scaleMaxVal = scaleMax(analysis, view, circuit);
  const scaleMaxLabel = circuit
    ? "4.0σ+ (evidence)"
    : `${scaleMaxVal.toFixed(1)}σ+`;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Studio Top Command Deck */}
      <Header 
        info={modelInfo} 
        error={modelError} 
        text={text}
        setText={setText}
        live={live}
        setLive={setLive}
        busy={busy}
        onRun={(force, textOverride) => executeAnalysis({ force, textOverride })}
        circuit={circuit}
        onClearCircuit={clearCircuit}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        onOpenHelp={() => setHelpOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Spacious Workbench */}
      <main className="flex flex-1 min-h-0 overflow-hidden max-[1100px]:flex-col max-[1100px]:overflow-visible bg-slate-100/60">
        {/* Center Panel (Hosts Flow, 144 Heads Matrix, Predictions, or Concept Studio) */}
        <CenterPanel
          activeTab={activeTab}
          info={modelInfo}
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
          scaleMaxLabel={scaleMaxLabel}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onSelectToken={handleSelectToken}
          onSelectNode={handleSelectNode}
          onSelectHead={handleSelectHead}
          onNavToken={handleNavToken}
          onClearCircuit={clearCircuit}
          onSelectConcept={(key) =>
            circuit?.key === key ? clearCircuit() : loadCircuit(key)
          }
          onCustomConcept={(wordsA, wordsB) =>
            loadCircuit("custom", { a: wordsA, b: wordsB })
          }
        />

        {/* Right Inspector: Clean collapsible drawer */}
        {isInspectorOpen && (
          <RightPanel
            analysis={analysis}
            info={modelInfo}
            circuit={circuit}
            sel={sel}
            onSelect={(newSel) => setSel(newSel)}
            onClose={() => setIsInspectorOpen(false)}
          />
        )}
      </main>

      {/* Help Modal */}
      <HelpModal 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
      />
    </div>
  );
};
export default App;
