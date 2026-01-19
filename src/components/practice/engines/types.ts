/**
 * Practice Mode Engine Types
 *
 * Shared types for all practice mode engines
 */

export interface ChartCandle {
  t: number; // timestamp in ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export interface KeyLevel {
  type: string;
  price: number;
  strength: number;
  label: string;
}

export interface DecisionPoint {
  price: number;
  time: number;
  context: string;
}

export interface ScenarioData {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: string;
  chartTimeframe: string;
  chartData: {
    candles: ChartCandle[];
    volume_profile?: { high_vol_node?: number; low_vol_node?: number };
    premarket?: { high: number; low: number };
    orb?: { high: number; low: number };
  };
  keyLevels: KeyLevel[];
  decisionPoint: DecisionPoint;
  correctAction?: 'long' | 'short' | 'wait';
  outcomeData?: {
    result: string;
    exit_price?: number;
    pnl_percent?: number;
    candles_to_target?: number;
  };
  ltpAnalysis?: {
    level: { score: number; reason: string };
    trend: { score: number; reason: string };
    patience: { score: number; reason: string };
  };
  explanation?: string;
}

export interface EngineProps {
  scenario: ScenarioData | null;
  onDecisionSubmit: (decision: 'long' | 'short' | 'wait') => Promise<void>;
  isSubmitting: boolean;
  result: {
    isCorrect: boolean;
    feedback: string | object;
    correctAction: string;
  } | null;
  onNextScenario?: () => void;
  onBack?: () => void;
}

export interface LTPChecklist {
  levelScore: number;
  trendScore: number;
  patienceScore: number;
  notes: string;
}

export interface SessionStats {
  attempted: number;
  correct: number;
  startTime: number;
  bestStreak: number;
  currentStreak: number;
}
