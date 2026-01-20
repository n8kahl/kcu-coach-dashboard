'use client';

/**
 * usePracticeEngine Hook
 *
 * Centralized game engine for the Practice Simulator.
 * Manages replay state, trade execution, P&L calculation, and AI context integration.
 *
 * This hook consolidates all the game loop logic that was previously scattered
 * across the Practice page and child components, fixing stuttering and desync issues.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAIContext } from '@/components/ai';
import { useSomeshVoice, VoiceTrigger } from './useSomeshVoice';
import { useCandleReplay, OHLCCandle } from './useCandleReplay';
import {
  calculateLTP2Score,
  createMarketContext,
  calculateEMA,
  type LTP2Score,
  type MarketContext,
} from '@/lib/ltp-gamma-engine';

// =============================================================================
// Types
// =============================================================================

export type GamePhase = 'idle' | 'analyze' | 'commit' | 'execute' | 'review';

export type TradeStatus = 'pending' | 'active' | 'won' | 'lost' | 'breakeven' | 'stopped';

export type PracticeMode =
  | 'standard'
  | 'quick_drill'
  | 'deep_analysis'
  | 'replay'
  | 'ai_generated'
  | 'hard_mode';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface KeyLevel {
  type: string;
  price: number;
  label: string;
  strength?: number;
}

export interface GammaLevel {
  type: 'call_wall' | 'put_wall' | 'zero_gamma' | 'max_gamma';
  price: number;
  strength: number;
}

export interface ScenarioData {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  chartTimeframe: string;
  chartData: {
    candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
    volume_profile?: { high_vol_node?: number; low_vol_node?: number };
  };
  keyLevels: KeyLevel[];
  gammaLevels?: GammaLevel[];
  decisionPoint: { price: number; time: number; context: string };
  correctAction: 'long' | 'short' | 'wait';
  ltpAnalysis?: {
    level: { score: number; reason: string };
    trend: { score: number; reason: string };
    patience: { score: number; reason: string };
  };
  explanation?: string;
  relatedLessonSlug?: string;
}

export interface TradePlan {
  isValidSetup: boolean | null;
  direction: 'long' | 'short' | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1Price: number | null;
  target2Price: number | null;
  levelTypes: string[];
  confidence: number;
  reasoning: string;
}

export interface ActiveTrade {
  id: string;
  entryCandle: number;
  entryPrice: number;
  direction: 'long' | 'short';
  stopPrice?: number;
  target1Price?: number;
  target2Price?: number;
  currentPnl: number;
  maxPnl: number;
  minPnl: number;
  status: TradeStatus;
  exitCandle?: number;
  exitPrice?: number;
  exitReason?: 'stop_hit' | 'target1_hit' | 'target2_hit' | 'manual' | 'time_exit';
}

export interface GameState {
  phase: GamePhase;
  mode: PracticeMode;
  replayIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  decisionReached: boolean;
  showOutcome: boolean;
  ltp2Score: LTP2Score | null;
  gammaGhostingEnabled: boolean;
}

export interface GameControls {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  seekTo: (index: number) => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  setMode: (mode: PracticeMode) => void;
  setPhase: (phase: GamePhase) => void;
  toggleGammaGhosting: () => void;
}

export interface TradeControls {
  executeTrade: (direction: 'long' | 'short', plan?: Partial<TradePlan>) => boolean;
  submitWait: () => void;
  closeTrade: (reason?: 'manual' | 'time_exit') => void;
  updateTradePlan: (updates: Partial<TradePlan>) => void;
}

export interface SessionStats {
  attempted: number;
  correct: number;
  accuracy: number;
  currentStreak: number;
  bestStreak: number;
  totalXp: number;
  sessionXp: number;
}

export interface ChartProps {
  visibleCandles: Candle[];
  levels: KeyLevel[];
  gammaLevels: GammaLevel[];
  tradeLevels: KeyLevel[];
  currentPrice: number;
  animatingCandle: OHLCCandle | null;
  decisionPointIndex: number;
  isReplayMode: boolean;
}

export interface UsePracticeEngineOptions {
  scenario: ScenarioData | null;
  mode?: PracticeMode;
  autoStart?: boolean;
  onTradeComplete?: (trade: ActiveTrade, isCorrect: boolean) => void;
  onDecisionPoint?: () => void;
  onPhaseChange?: (phase: GamePhase) => void;
  voiceEnabled?: boolean;
}

export interface UsePracticeEngineReturn {
  gameState: GameState;
  controls: GameControls;
  trade: {
    active: ActiveTrade | null;
    plan: TradePlan;
    controls: TradeControls;
  };
  stats: SessionStats;
  chartProps: ChartProps;
  scenario: ScenarioData | null;
  isLoading: boolean;
  error: string | null;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_TRADE_PLAN: TradePlan = {
  isValidSetup: null,
  direction: null,
  entryPrice: null,
  stopPrice: null,
  target1Price: null,
  target2Price: null,
  levelTypes: [],
  confidence: 3,
  reasoning: '',
};

const DECISION_POINT_RATIO = 0.7; // 70% through the candles
const TICK_INTERVAL_BASE = 500; // Base tick interval in ms

// XP rewards by difficulty
const XP_REWARDS = {
  beginner: { correct: 10, incorrect: 3 },
  intermediate: { correct: 20, incorrect: 5 },
  advanced: { correct: 35, incorrect: 8 },
};

// =============================================================================
// Main Hook
// =============================================================================

export function usePracticeEngine(options: UsePracticeEngineOptions): UsePracticeEngineReturn {
  const {
    scenario,
    mode: initialMode = 'standard',
    autoStart = false,
    onTradeComplete,
    onDecisionPoint,
    onPhaseChange,
    voiceEnabled = true,
  } = options;

  // =============================================================================
  // AI Context Integration
  // =============================================================================

  const {
    updatePageContext,
    setSelectedScenario,
    setSelectedSymbol,
  } = useAIContext();

  // =============================================================================
  // Voice Integration
  // =============================================================================

  const someshVoice = useSomeshVoice({
    enabled: voiceEnabled && (initialMode === 'hard_mode' || initialMode === 'replay'),
    cooldownMs: 20000,
  });

  // =============================================================================
  // Candle Animation
  // =============================================================================

  const candleReplay = useCandleReplay({
    duration: 400,
    realisticPath: true,
  });

  // =============================================================================
  // Core State
  // =============================================================================

  // Game state
  const [phase, setPhaseState] = useState<GamePhase>('idle');
  const [mode, setMode] = useState<PracticeMode>(initialMode);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [decisionReached, setDecisionReached] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const [gammaGhostingEnabled, setGammaGhostingEnabled] = useState(true);

  // Trade state
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);
  const [tradePlan, setTradePlan] = useState<TradePlan>(DEFAULT_TRADE_PLAN);

  // LTP 2.0 scoring
  const [ltp2Score, setLtp2Score] = useState<LTP2Score | null>(null);

  // Session stats
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    attempted: 0,
    correct: 0,
    accuracy: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalXp: 0,
    sessionXp: 0,
  });

  // Loading/error state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for game loop
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const previousPnlRef = useRef<number>(0);
  const voiceTriggeredRef = useRef<Set<string>>(new Set());

  // =============================================================================
  // Derived Values
  // =============================================================================

  const allCandles = useMemo((): Candle[] => {
    if (!scenario?.chartData?.candles) return [];
    return scenario.chartData.candles.map((c) => ({
      time: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
    }));
  }, [scenario]);

  const totalCandles = allCandles.length;
  const decisionPointIndex = Math.floor(totalCandles * DECISION_POINT_RATIO);

  const isReplayMode = mode === 'replay' || mode === 'hard_mode';

  const visibleCandles = useMemo((): Candle[] => {
    if (!isReplayMode || showOutcome) {
      return allCandles;
    }
    return allCandles.slice(0, replayIndex + 1);
  }, [allCandles, isReplayMode, replayIndex, showOutcome]);

  const currentPrice = useMemo(() => {
    if (visibleCandles.length === 0) return 0;
    return visibleCandles[visibleCandles.length - 1].close;
  }, [visibleCandles]);

  // Convert scenario key levels
  const keyLevels = useMemo((): KeyLevel[] => {
    return scenario?.keyLevels || [];
  }, [scenario]);

  // Gamma levels (ghosted in hard mode until decision point)
  const gammaLevels = useMemo((): GammaLevel[] => {
    if (!scenario?.gammaLevels) return [];
    if (mode === 'hard_mode' && gammaGhostingEnabled && !decisionReached) {
      return [];
    }
    return scenario.gammaLevels;
  }, [scenario, mode, gammaGhostingEnabled, decisionReached]);

  // Trade-specific levels to show on chart
  const tradeLevels = useMemo((): KeyLevel[] => {
    if (!activeTrade || activeTrade.status === 'pending') return [];

    const levels: KeyLevel[] = [
      {
        type: 'entry',
        price: activeTrade.entryPrice,
        label: 'Entry',
      },
    ];

    if (activeTrade.stopPrice) {
      levels.push({
        type: 'stop',
        price: activeTrade.stopPrice,
        label: 'Stop',
      });
    }

    if (activeTrade.target1Price) {
      levels.push({
        type: 'target',
        price: activeTrade.target1Price,
        label: 'T1',
      });
    }

    if (activeTrade.target2Price) {
      levels.push({
        type: 'target',
        price: activeTrade.target2Price,
        label: 'T2',
      });
    }

    return levels;
  }, [activeTrade]);

  // =============================================================================
  // LTP 2.0 Score Calculation
  // =============================================================================

  useEffect(() => {
    if (visibleCandles.length < 21) {
      setLtp2Score(null);
      return;
    }

    const closes = visibleCandles.map((c) => c.close);
    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const prevCandle = visibleCandles.length > 1 ? visibleCandles[visibleCandles.length - 2] : lastCandle;

    // Calculate EMAs
    const ema8 = calculateEMA(closes, 8);
    const ema21 = calculateEMA(closes, 21);

    // Get VWAP from key levels if available
    const vwapLevel = keyLevels.find((l) => l.type === 'vwap');
    const vwap = vwapLevel?.price || (closes.reduce((a, b) => a + b, 0) / closes.length);

    // Get gamma levels
    const callWall = gammaLevels.find((g) => g.type === 'call_wall')?.price || lastCandle.close * 1.05;
    const putWall = gammaLevels.find((g) => g.type === 'put_wall')?.price || lastCandle.close * 0.95;
    const zeroGamma = gammaLevels.find((g) => g.type === 'zero_gamma')?.price || lastCandle.close;
    const gammaExposure = lastCandle.close > zeroGamma ? 100 : -100;

    // Create market context
    const context: MarketContext = createMarketContext(
      {
        close: lastCandle.close,
        high: lastCandle.high,
        low: lastCandle.low,
        open: lastCandle.open,
        previousClose: prevCandle.close,
        previousHigh: prevCandle.high,
        previousLow: prevCandle.low,
      },
      { ema8, ema21 },
      vwap,
      { callWall, putWall, zeroGamma, gammaExposure }
    );

    const score = calculateLTP2Score(context);
    setLtp2Score(score);

    // Voice alerts for score changes
    if (voiceEnabled && (mode === 'hard_mode' || mode === 'replay')) {
      someshVoice.checkScore(score);
    }
  }, [visibleCandles, keyLevels, gammaLevels, mode, voiceEnabled, someshVoice]);

  // =============================================================================
  // AI Context Updates
  // =============================================================================

  useEffect(() => {
    if (!scenario) return;

    // Update AI context with scenario data
    const contextData = {
      currentScenario: {
        id: scenario.id,
        title: scenario.title,
        symbol: scenario.symbol,
        difficulty: scenario.difficulty,
        scenarioType: scenario.scenarioType,
        tags: [],
        description: scenario.description,
        correct_action: scenario.correctAction,
        focus_area: scenario.scenarioType,
        ltp_analysis: scenario.ltpAnalysis,
      },
      practiceMode: mode,
      practiceAttemptCount: sessionStats.attempted,
      practiceCorrectCount: sessionStats.correct,
    };

    updatePageContext('practice', contextData);
    setSelectedSymbol(scenario.symbol);
    setSelectedScenario(contextData.currentScenario as any);

  }, [scenario, mode, sessionStats.attempted, sessionStats.correct, updatePageContext, setSelectedSymbol, setSelectedScenario]);

  // =============================================================================
  // Phase Management
  // =============================================================================

  const setPhase = useCallback((newPhase: GamePhase) => {
    setPhaseState(newPhase);
    onPhaseChange?.(newPhase);
  }, [onPhaseChange]);

  // Auto-transition phases
  useEffect(() => {
    if (!scenario) {
      setPhase('idle');
      return;
    }

    // Move to analyze when scenario loads
    if (phase === 'idle' && scenario) {
      setPhase('analyze');
    }

    // Move to commit when decision point reached
    if (phase === 'analyze' && decisionReached) {
      setPhase('commit');
      onDecisionPoint?.();
    }

    // Move to execute when trade is placed
    if (phase === 'commit' && activeTrade?.status === 'active') {
      setPhase('execute');
    }

    // Move to review when trade closes
    if (phase === 'execute' && activeTrade && ['won', 'lost', 'stopped', 'breakeven'].includes(activeTrade.status)) {
      setPhase('review');
    }
  }, [scenario, phase, decisionReached, activeTrade, setPhase, onDecisionPoint]);

  // =============================================================================
  // Game Loop - Single Source of Truth
  // =============================================================================

  useEffect(() => {
    // Clear any existing loop
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // Only run game loop in replay modes
    if (!isReplayMode || !isPlaying || totalCandles === 0) {
      return;
    }

    const tickInterval = TICK_INTERVAL_BASE / playbackSpeed;

    gameLoopRef.current = setInterval(() => {
      setReplayIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;

        // Check if we've reached the end
        if (nextIndex >= totalCandles) {
          setIsPlaying(false);
          return prevIndex;
        }

        // Check if we should pause at decision point
        if (nextIndex >= decisionPointIndex && !activeTrade && !decisionReached) {
          setIsPlaying(false);
          setDecisionReached(true);
          return nextIndex;
        }

        // Animate the new candle
        const nextCandle = allCandles[nextIndex];
        if (nextCandle) {
          candleReplay.animateCandle({
            t: nextCandle.time,
            o: nextCandle.open,
            h: nextCandle.high,
            l: nextCandle.low,
            c: nextCandle.close,
            v: nextCandle.volume,
          });
        }

        return nextIndex;
      });
    }, tickInterval);

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [isReplayMode, isPlaying, playbackSpeed, totalCandles, decisionPointIndex, activeTrade, decisionReached, allCandles, candleReplay]);

  // =============================================================================
  // Trade P&L Calculation - Every Tick
  // =============================================================================

  useEffect(() => {
    if (!activeTrade || activeTrade.status !== 'active' || visibleCandles.length === 0) {
      return;
    }

    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const entryPrice = activeTrade.entryPrice;
    const currentClose = lastCandle.close;

    // Calculate P&L
    let pnl: number;
    if (activeTrade.direction === 'long') {
      pnl = ((currentClose - entryPrice) / entryPrice) * 100;
    } else {
      pnl = ((entryPrice - currentClose) / entryPrice) * 100;
    }

    // Check for stop loss hit
    if (activeTrade.stopPrice) {
      const stopHit = activeTrade.direction === 'long'
        ? lastCandle.low <= activeTrade.stopPrice
        : lastCandle.high >= activeTrade.stopPrice;

      if (stopHit) {
        const exitPrice = activeTrade.stopPrice;
        const exitPnl = activeTrade.direction === 'long'
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

        setActiveTrade((prev) => prev ? {
          ...prev,
          status: 'stopped',
          exitCandle: replayIndex,
          exitPrice,
          exitReason: 'stop_hit',
          currentPnl: exitPnl,
        } : null);

        // Voice feedback for stop hit
        if (voiceEnabled) {
          someshVoice.speakCustom('Stop hit. Review your entry timing.');
        }

        return;
      }
    }

    // Check for target 1 hit
    if (activeTrade.target1Price) {
      const t1Hit = activeTrade.direction === 'long'
        ? lastCandle.high >= activeTrade.target1Price
        : lastCandle.low <= activeTrade.target1Price;

      if (t1Hit) {
        const exitPrice = activeTrade.target1Price;
        const exitPnl = activeTrade.direction === 'long'
          ? ((exitPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - exitPrice) / entryPrice) * 100;

        setActiveTrade((prev) => prev ? {
          ...prev,
          status: 'won',
          exitCandle: replayIndex,
          exitPrice,
          exitReason: 'target1_hit',
          currentPnl: exitPnl,
        } : null);

        // Voice feedback for win
        if (voiceEnabled) {
          someshVoice.speakCustom('Target hit. Beautiful execution.');
        }

        return;
      }
    }

    // Update current P&L and track max/min
    setActiveTrade((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentPnl: pnl,
        maxPnl: Math.max(prev.maxPnl, pnl),
        minPnl: Math.min(prev.minPnl, pnl),
      };
    });

    // Voice feedback for P&L changes
    if (voiceEnabled && phase === 'execute') {
      const prevPnl = previousPnlRef.current;

      // Moved to green
      if (prevPnl < 0 && pnl >= 0.5 && !voiceTriggeredRef.current.has('green')) {
        someshVoice.speakCustom('Moving your way. Consider moving stop to breakeven.');
        voiceTriggeredRef.current.add('green');
      }

      // Significant positive P&L
      if (pnl >= 1.0 && !voiceTriggeredRef.current.has('good_move')) {
        someshVoice.speakCustom('Great entry. Let the trade work.');
        voiceTriggeredRef.current.add('good_move');
      }

      // Going against
      if (pnl < -0.5 && prevPnl >= -0.5 && !voiceTriggeredRef.current.has('against')) {
        someshVoice.speakCustom('Trade working against you. Trust your stop.');
        voiceTriggeredRef.current.add('against');
      }

      previousPnlRef.current = pnl;
    }
  }, [activeTrade, visibleCandles, replayIndex, phase, voiceEnabled, someshVoice]);

  // =============================================================================
  // Trade Completion Handler
  // =============================================================================

  useEffect(() => {
    if (!activeTrade) return;
    if (!['won', 'lost', 'stopped', 'breakeven'].includes(activeTrade.status)) return;

    const isCorrect = activeTrade.status === 'won';
    const difficulty = scenario?.difficulty || 'intermediate';
    const xpEarned = isCorrect
      ? XP_REWARDS[difficulty].correct
      : XP_REWARDS[difficulty].incorrect;

    // Update session stats
    setSessionStats((prev) => {
      const newAttempted = prev.attempted + 1;
      const newCorrect = prev.correct + (isCorrect ? 1 : 0);
      const newStreak = isCorrect ? prev.currentStreak + 1 : 0;

      return {
        ...prev,
        attempted: newAttempted,
        correct: newCorrect,
        accuracy: (newCorrect / newAttempted) * 100,
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        sessionXp: prev.sessionXp + xpEarned,
        totalXp: prev.totalXp + xpEarned,
      };
    });

    setShowOutcome(true);
    onTradeComplete?.(activeTrade, isCorrect);
  }, [activeTrade?.status, scenario?.difficulty, onTradeComplete]);

  // =============================================================================
  // Game Controls
  // =============================================================================

  const play = useCallback(() => {
    if (!isReplayMode) return;
    setIsPlaying(true);
  }, [isReplayMode]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const stepForward = useCallback(() => {
    if (replayIndex >= totalCandles - 1) return;
    setReplayIndex((prev) => {
      const next = prev + 1;
      // Check for decision point
      if (next >= decisionPointIndex && !decisionReached) {
        setDecisionReached(true);
      }
      return next;
    });
  }, [replayIndex, totalCandles, decisionPointIndex, decisionReached]);

  const stepBackward = useCallback(() => {
    if (replayIndex <= 0) return;
    setReplayIndex((prev) => prev - 1);
  }, [replayIndex]);

  const seekTo = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, totalCandles - 1));
    setReplayIndex(clampedIndex);
    if (clampedIndex >= decisionPointIndex) {
      setDecisionReached(true);
    }
  }, [totalCandles, decisionPointIndex]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setReplayIndex(0);
    setDecisionReached(false);
    setShowOutcome(false);
    setActiveTrade(null);
    setTradePlan(DEFAULT_TRADE_PLAN);
    setPhase('analyze');
    voiceTriggeredRef.current.clear();
    previousPnlRef.current = 0;
  }, [setPhase]);

  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(Math.max(0.25, Math.min(4, speed)));
  }, []);

  const toggleGammaGhosting = useCallback(() => {
    setGammaGhostingEnabled((prev) => !prev);
  }, []);

  // =============================================================================
  // Trade Controls
  // =============================================================================

  const executeTrade = useCallback((direction: 'long' | 'short', plan?: Partial<TradePlan>): boolean => {
    if (!scenario || visibleCandles.length === 0) return false;

    // Check for early entry (no patience candle)
    if (isReplayMode && !decisionReached) {
      if (voiceEnabled) {
        someshVoice.speakCustom("Patience. Wait for the setup to confirm.");
      }
      return false;
    }

    const lastCandle = visibleCandles[visibleCandles.length - 1];
    const entryPrice = plan?.entryPrice || lastCandle.close;

    const newTrade: ActiveTrade = {
      id: `trade-${Date.now()}`,
      entryCandle: replayIndex,
      entryPrice,
      direction,
      stopPrice: plan?.stopPrice || undefined,
      target1Price: plan?.target1Price || undefined,
      target2Price: plan?.target2Price || undefined,
      currentPnl: 0,
      maxPnl: 0,
      minPnl: 0,
      status: 'active',
    };

    setActiveTrade(newTrade);

    // Update trade plan
    if (plan) {
      setTradePlan((prev) => ({
        ...prev,
        ...plan,
        direction,
        isValidSetup: true,
      }));
    }

    // Resume replay if paused
    if (isReplayMode && !isPlaying) {
      setIsPlaying(true);
    }

    // Voice feedback
    if (voiceEnabled) {
      someshVoice.speakCustom(`${direction.toUpperCase()} entered. Now let the trade work.`);
    }

    return true;
  }, [scenario, visibleCandles, isReplayMode, decisionReached, replayIndex, isPlaying, voiceEnabled, someshVoice]);

  const submitWait = useCallback(() => {
    // Record a "wait" decision
    const isCorrect = scenario?.correctAction === 'wait';
    const difficulty = scenario?.difficulty || 'intermediate';
    const xpEarned = isCorrect
      ? XP_REWARDS[difficulty].correct
      : XP_REWARDS[difficulty].incorrect;

    setSessionStats((prev) => {
      const newAttempted = prev.attempted + 1;
      const newCorrect = prev.correct + (isCorrect ? 1 : 0);
      const newStreak = isCorrect ? prev.currentStreak + 1 : 0;

      return {
        ...prev,
        attempted: newAttempted,
        correct: newCorrect,
        accuracy: (newCorrect / newAttempted) * 100,
        currentStreak: newStreak,
        bestStreak: Math.max(prev.bestStreak, newStreak),
        sessionXp: prev.sessionXp + xpEarned,
        totalXp: prev.totalXp + xpEarned,
      };
    });

    setTradePlan((prev) => ({
      ...prev,
      isValidSetup: false,
      direction: null,
    }));

    setShowOutcome(true);
    setPhase('review');
  }, [scenario, setPhase]);

  const closeTrade = useCallback((reason: 'manual' | 'time_exit' = 'manual') => {
    if (!activeTrade || activeTrade.status !== 'active') return;

    const exitPrice = currentPrice;
    const exitPnl = activeTrade.direction === 'long'
      ? ((exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice) * 100
      : ((activeTrade.entryPrice - exitPrice) / activeTrade.entryPrice) * 100;

    const newStatus: TradeStatus = exitPnl > 0.1 ? 'won' : exitPnl < -0.1 ? 'lost' : 'breakeven';

    setActiveTrade((prev) => prev ? {
      ...prev,
      status: newStatus,
      exitCandle: replayIndex,
      exitPrice,
      exitReason: reason,
      currentPnl: exitPnl,
    } : null);
  }, [activeTrade, currentPrice, replayIndex]);

  const updateTradePlan = useCallback((updates: Partial<TradePlan>) => {
    setTradePlan((prev) => ({ ...prev, ...updates }));
  }, []);

  // =============================================================================
  // Scenario Change Handler
  // =============================================================================

  useEffect(() => {
    if (scenario) {
      reset();
      setIsLoading(false);
      setError(null);

      // Auto-start in replay modes
      if (autoStart && isReplayMode) {
        setTimeout(() => {
          setIsPlaying(true);
        }, 500);
      }
    }
  }, [scenario?.id, autoStart, isReplayMode, reset]);

  // =============================================================================
  // Return Value
  // =============================================================================

  const gameState: GameState = {
    phase,
    mode,
    replayIndex,
    isPlaying,
    playbackSpeed,
    decisionReached,
    showOutcome,
    ltp2Score,
    gammaGhostingEnabled,
  };

  const controls: GameControls = {
    play,
    pause,
    togglePlayPause,
    stepForward,
    stepBackward,
    seekTo,
    reset,
    setSpeed,
    setMode,
    setPhase,
    toggleGammaGhosting,
  };

  const tradeControls: TradeControls = {
    executeTrade,
    submitWait,
    closeTrade,
    updateTradePlan,
  };

  const chartProps: ChartProps = {
    visibleCandles,
    levels: keyLevels,
    gammaLevels,
    tradeLevels,
    currentPrice,
    animatingCandle: candleReplay.getIntermediateCandle(),
    decisionPointIndex,
    isReplayMode,
  };

  return {
    gameState,
    controls,
    trade: {
      active: activeTrade,
      plan: tradePlan,
      controls: tradeControls,
    },
    stats: sessionStats,
    chartProps,
    scenario,
    isLoading,
    error,
  };
}

export default usePracticeEngine;
