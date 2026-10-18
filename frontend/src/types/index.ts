export interface ConceptMeta {
  key: string;
  name: string;
  side_a: string;
  side_b: string;
  binary: boolean;
  examples: string[];
}

export interface ModelInfo {
  model_name: string;
  num_layers: number;
  num_heads: number;
  mlp_dim: number;
  max_tokens: number;
  concepts: ConceptMeta[];
}

export interface TokenConcept {
  key: string;
  name: string;
  side: string;
  z: number;
}

export interface TopNeuron {
  neuron: number;
  z: number;
  label?: {
    name: string;
    side: string;
    d: number;
  };
}

export interface Prediction {
  token: string;
  p: number;
}

export interface ConceptDetection {
  z: number[];
  head: [number, number][]; // [layer, index] per token
  neuron: [number, number][]; // [layer, index] per token
}

export interface AnalysisResponse {
  analysis_id: string;
  tokens: string[];
  truncated: boolean;
  num_layers: number;
  num_heads: number;
  mlp_dim: number;
  head_z: number[][][]; // [layer][head][token]
  attention: number[][][][]; // [layer][head][token_to][token_from]
  attention_sink: number[][][]; // [layer][head][token]
  neuron_top: TopNeuron[][][]; // [layer][token][rank]
  head_labels: ({ name: string; side: string; d: number } | null)[][]; // [layer][head]
  concepts: Record<string, ConceptDetection>;
  token_concepts: TokenConcept[][]; // [token][rank]
  predictions: Prediction[][]; // [token][rank]
}

export interface CircuitUnit {
  kind: "head" | "neuron";
  layer: number;
  index: number;
  d: number;
  side: string;
  evidence: number[]; // per token
}

export interface CircuitData {
  name: string;
  binary: boolean;
  side_a: string;
  side_b: string;
  heads: CircuitUnit[];
  neurons: CircuitUnit[];
  token_scores: number[]; // per token
}

export interface UnitConceptMatch {
  key: string;
  name: string;
  side: string;
  d: number;
  score: number;
}

export interface TopWord {
  word: string;
  z: number;
}

export interface UnitDetailResponse {
  kind: "head" | "neuron";
  layer: number;
  index: number;
  sentence_z: number[]; // per token
  label: {
    key: string;
    name: string;
    side: string;
    d: number;
  } | null;
  concepts: UnitConceptMatch[];
  all_concepts: Record<string, UnitConceptMatch>;
  top_words: TopWord[];
  promotes?: string[]; // for neuron
}

export type ViewKind = "head" | "neuron";

export type WorkspaceTab = "flow" | "heads" | "predictions" | "circuits";

export type SelectionReason =
  | { type: "circuit" }
  | { type: "concept"; concept: TokenConcept }
  | { type: "max" }
  | { type: "manual" };

export interface Selection {
  t: number;
  layer: number;
  kind: ViewKind;
  index: number;
  reason?: SelectionReason;
}

export interface ActiveCircuit {
  key: string;
  custom?: { a: string[]; b: string[] } | null;
  data: CircuitData;
}
