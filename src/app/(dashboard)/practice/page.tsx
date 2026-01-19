'use client';

// Force dynamic rendering to prevent prerender errors with useSearchParams
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import { ProgressBar } from '@/components/ui/progress';
import { KCUChart, Candle, Level, GammaLevel } from '@/components/charts/KCUChart';
import { useBatchCandleReplay, OHLCCandle } from '@/hooks/useCandleReplay';
import { DailyChallenges } from '@/components/practice/DailyChallenge';
import { AchievementPopup, Achievement } from '@/components/practice/AchievementPopup';
import { Leaderboard, MiniLeaderboard } from '@/components/practice/Leaderboard';
import { DecisionPanel, TradePlan } from '@/components/practice/DecisionPanel';
import { ComparisonPanel } from '@/components/practice/ComparisonPanel';
import { AICoachFeedback, AIFeedback } from '@/components/practice/AICoachFeedback';
import { InstructionsPanel, DecisionGuide, KeyboardShortcuts } from '@/components/practice/InstructionsPanel';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/components/ai';
import { Tooltip } from '@/components/ui/tooltip';
import {
  PracticePageSkeleton,
  ScenarioChartSkeleton,
} from '@/components/practice/PracticeSkeletons';
import {
  Target,
  TrendingUp,
  TrendingDown,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  Trophy,
  ChevronRight,
  Loader2,
  BarChart3,
  RefreshCw,
  Zap,
  Brain,
  Play,
  Flame,
  Award,
  BookOpen,
  Share2,
  Sparkles,
  Timer,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Wand2,
  LayoutGrid,
  Eye,
  EyeOff,
  Volume2,
  SkipForward,
  FastForward,
  Rewind,
  Square,
  AlertTriangle,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface Scenario {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenario_type: string;
  difficulty: string;
  tags: string[];
  focus_area: string;
  category: string;
  community_attempts: number;
  community_accuracy: number;
  userAttempts: number;
  userCorrect: number;
}

interface ScenarioDetail {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenarioType: string;
  difficulty: string;
  chartTimeframe: string;
  chartData: {
    candles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
    volume_profile?: { high_vol_node?: number; low_vol_node?: number };
  };
  keyLevels: Array<{ type: string; price: number; strength: number; label: string }>;
  decisionPoint: { price: number; time: number; context: string };
  hasAttempted: boolean;
  correctAction?: string;
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
  relatedLessonSlug?: string;
  lastAttempt?: {
    decision: string;
    isCorrect: boolean;
    feedback: string;
  };
}

interface UserStats {
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  uniqueScenarios: number;
  avgTimeSeconds: number;
  currentStreak: number;
  bestStreak: number;
  daysPracticed: number;
}

interface CoachingFeedback {
  isCorrect: boolean;
  summary: string;
  detailedFeedback: string;
  ltpBreakdown: {
    level: string;
    trend: string;
    patience: string;
  };
  whatYouMissed?: string;
  encouragement: string;
  richContent?: string;
  nextSteps: string[];
  personalizedTip?: string;
}

interface TradeExecution {
  entryCandle: number;
  entryPrice: number;
  direction: 'long' | 'short';
  stopPrice?: number;
  target1Price?: number;
  target2Price?: number;
  currentPnl: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'breakeven';
  exitCandle?: number;
  exitPrice?: number;
}

type PracticeMode = 'standard' | 'quick_drill' | 'deep_analysis' | 'replay' | 'ai_generated' | 'hard_mode';

// =============================================================================
// Somesh Early Entry Feedback
// =============================================================================

const EARLY_ENTRY_QUOTES = [
  "Yo! You jumping the gun. Where's the patience candle?",
  "WAIT. Did the candle even CLOSE yet? Patience ain't just a virtue - it's a requirement.",
  "Bro. What are you doing? You're entering BEFORE confirmation. That's gambling, not trading.",
  "The candle hasn't closed. You're ANTICIPATING instead of REACTING. Bad habit.",
  "Hold up! No patience candle = no entry. It's that simple. Chill.",
  "You see that candle forming? FORMING. Not CLOSED. There's a difference.",
  "This is how accounts blow up - entering before the setup confirms. Slow down.",
  "Whoa whoa whoa. The patience candle ain't confirmed yet. What's the rush?",
  "Remember the P in LTP? PATIENCE. Wait for the close. Always.",
  "You're jumping in early like a rookie. Wait for the candle to CLOSE first.",
];

const getEarlyEntryFeedback = (): string => {
  return EARLY_ENTRY_QUOTES[Math.floor(Math.random() * EARLY_ENTRY_QUOTES.length)];
};

// =============================================================================
// Practice Mode Definitions
// =============================================================================

const PRACTICE_MODES = [
  {
    id: 'standard' as PracticeMode,
    name: 'Standard',
    description: 'Full scenario with detailed feedback',
    icon: Target,
    color: 'accent',
  },
  {
    id: 'quick_drill' as PracticeMode,
    name: 'Quick Drill',
    description: '30-second decisions, rapid fire',
    icon: Zap,
    color: 'warning',
  },
  {
    id: 'deep_analysis' as PracticeMode,
    name: 'Deep Analysis',
    description: 'Full AI coaching with LTP checklist',
    icon: Brain,
    color: 'success',
  },
  {
    id: 'hard_mode' as PracticeMode,
    name: 'Hard Mode',
    description: 'Chart hides future - real-time feel',
    icon: EyeOff,
    color: 'error',
  },
  {
    id: 'ai_generated' as PracticeMode,
    name: 'AI Scenarios',
    description: 'Unlimited AI-generated practice',
    icon: Wand2,
    color: 'info',
  },
  {
    id: 'replay' as PracticeMode,
    name: 'Live Replay',
    description: 'Watch candles unfold candle-by-candle',
    icon: Play,
    color: 'info',
  },
];

// =============================================================================
// LTP Score HUD Component (Same as Companion)
// =============================================================================

interface LTPScoreHUDProps {
  ltpAnalysis?: {
    level: { score: number; reason: string };
    trend: { score: number; reason: string };
    patience: { score: number; reason: string };
  };
  grade?: string;
  className?: string;
}

function LTPScoreHUD({ ltpAnalysis, grade, className }: LTPScoreHUDProps) {
  if (!ltpAnalysis) return null;

  const getGradeColor = (g: string) => {
    if (g === 'A+' || g === 'A') return 'text-[var(--success)] bg-[var(--success)]/20';
    if (g === 'B+' || g === 'B') return 'text-[var(--warning)] bg-[var(--warning)]/20';
    if (g === 'C+' || g === 'C') return 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]';
    return 'text-[var(--error)] bg-[var(--error)]/20';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-[var(--success)]';
    if (score >= 60) return 'bg-[var(--warning)]';
    return 'bg-[var(--error)]';
  };

  return (
    <div className={cn(
      'absolute top-4 left-4 z-20 bg-[var(--bg-secondary)]/95 backdrop-blur-sm border border-[var(--border-primary)] p-3',
      className
    )}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase">LTP Score</span>
        {grade && (
          <span className={cn('px-2 py-0.5 text-sm font-bold', getGradeColor(grade))}>
            {grade}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {/* Level */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-primary)] w-4">L</span>
          <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className={cn('h-full transition-all duration-500', getScoreColor(ltpAnalysis.level.score))}
              style={{ width: `${ltpAnalysis.level.score}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6">{ltpAnalysis.level.score}%</span>
        </div>

        {/* Trend */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-primary)] w-4">T</span>
          <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className={cn('h-full transition-all duration-500', getScoreColor(ltpAnalysis.trend.score))}
              style={{ width: `${ltpAnalysis.trend.score}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6">{ltpAnalysis.trend.score}%</span>
        </div>

        {/* Patience */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[var(--accent-primary)] w-4">P</span>
          <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] overflow-hidden">
            <div
              className={cn('h-full transition-all duration-500', getScoreColor(ltpAnalysis.patience.score))}
              style={{ width: `${ltpAnalysis.patience.score}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[var(--text-secondary)] w-6">{ltpAnalysis.patience.score}%</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Coach Feedback Box (Floating Terminal Style)
// =============================================================================

interface CoachFeedbackBoxProps {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  show: boolean;
  onDismiss?: () => void;
}

function CoachFeedbackBox({ message, type, show, onDismiss }: CoachFeedbackBoxProps) {
  if (!show) return null;

  const typeStyles = {
    info: 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10',
    warning: 'border-[var(--warning)] bg-[var(--warning)]/10',
    error: 'border-[var(--error)] bg-[var(--error)]/10',
    success: 'border-[var(--success)] bg-[var(--success)]/10',
  };

  const iconStyles = {
    info: 'text-[var(--accent-primary)]',
    warning: 'text-[var(--warning)]',
    error: 'text-[var(--error)]',
    success: 'text-[var(--success)]',
  };

  return (
    <div className={cn(
      'absolute bottom-4 right-4 z-20 max-w-sm p-4 border animate-in slide-in-from-bottom-4 duration-300',
      typeStyles[type]
    )}>
      <div className="flex items-start gap-3">
        {type === 'warning' && <AlertTriangle className={cn('w-5 h-5 shrink-0', iconStyles[type])} />}
        {type === 'error' && <XCircle className={cn('w-5 h-5 shrink-0', iconStyles[type])} />}
        {type === 'success' && <CheckCircle className={cn('w-5 h-5 shrink-0', iconStyles[type])} />}
        {type === 'info' && <MessageSquare className={cn('w-5 h-5 shrink-0', iconStyles[type])} />}

        <div className="flex-1">
          <p className="text-sm text-[var(--text-primary)] font-medium">{message}</p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Trade Execution Overlay
// =============================================================================

interface TradeOverlayProps {
  trade: TradeExecution | null;
  currentPrice: number;
  className?: string;
}

function TradeOverlay({ trade, currentPrice, className }: TradeOverlayProps) {
  if (!trade || trade.status === 'pending') return null;

  const pnlColor = trade.currentPnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]';
  const statusBadge = {
    active: { text: 'ACTIVE', color: 'bg-[var(--accent-primary)]' },
    won: { text: 'WIN', color: 'bg-[var(--success)]' },
    lost: { text: 'STOPPED', color: 'bg-[var(--error)]' },
    breakeven: { text: 'B/E', color: 'bg-[var(--warning)]' },
    pending: { text: 'PENDING', color: 'bg-[var(--text-tertiary)]' },
  };

  return (
    <div className={cn(
      'absolute top-4 right-4 z-20 bg-[var(--bg-secondary)]/95 backdrop-blur-sm border border-[var(--border-primary)] p-3 min-w-[180px]',
      className
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase">Trade</span>
        <span className={cn('px-2 py-0.5 text-[10px] font-bold text-white', statusBadge[trade.status].color)}>
          {statusBadge[trade.status].text}
        </span>
      </div>

      <div className="space-y-1.5 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-[var(--text-tertiary)]">Direction</span>
          <span className={trade.direction === 'long' ? 'text-[var(--success)]' : 'text-[var(--error)]'}>
            {trade.direction.toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--text-tertiary)]">Entry</span>
          <span className="text-[var(--text-primary)]">${trade.entryPrice.toFixed(2)}</span>
        </div>
        {trade.stopPrice && (
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">Stop</span>
            <span className="text-[var(--error)]">${trade.stopPrice.toFixed(2)}</span>
          </div>
        )}
        {trade.target1Price && (
          <div className="flex justify-between">
            <span className="text-[var(--text-tertiary)]">T1</span>
            <span className="text-[var(--success)]">${trade.target1Price.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-[var(--border-primary)] pt-1.5 mt-1.5">
          <span className="text-[var(--text-tertiary)]">P&L</span>
          <span className={cn('font-bold', pnlColor)}>
            {trade.currentPnl >= 0 ? '+' : ''}{trade.currentPnl.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Replay Controls
// =============================================================================

interface ReplayControlsProps {
  isPlaying: boolean;
  currentIndex: number;
  totalCandles: number;
  playbackSpeed: number;
  onPlayPause: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (index: number) => void;
  className?: string;
}

function ReplayControls({
  isPlaying,
  currentIndex,
  totalCandles,
  playbackSpeed,
  onPlayPause,
  onStepForward,
  onReset,
  onSpeedChange,
  onSeek,
  className,
}: ReplayControlsProps) {
  return (
    <div className={cn(
      'flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-3',
      className
    )}>
      {/* Play/Pause */}
      <button
        onClick={onPlayPause}
        className={cn(
          'p-2 transition-colors',
          isPlaying
            ? 'bg-[var(--warning)] text-black'
            : 'bg-[var(--accent-primary)] text-black'
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      {/* Step Forward */}
      <button
        onClick={onStepForward}
        disabled={currentIndex >= totalCandles - 1}
        className="p-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-primary)] transition-colors disabled:opacity-50"
      >
        <SkipForward className="w-4 h-4" />
      </button>

      {/* Reset */}
      <button
        onClick={onReset}
        className="p-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--border-primary)] transition-colors"
      >
        <Rewind className="w-4 h-4" />
      </button>

      {/* Progress Bar */}
      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] relative cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          onSeek(Math.floor(percent * totalCandles));
        }}
      >
        <div
          className="h-full bg-[var(--accent-primary)] transition-all duration-100"
          style={{ width: `${(currentIndex / (totalCandles - 1)) * 100}%` }}
        />
      </div>

      {/* Current / Total */}
      <span className="text-xs font-mono text-[var(--text-secondary)] min-w-[60px] text-right">
        {currentIndex + 1} / {totalCandles}
      </span>

      {/* Speed Control */}
      <div className="flex items-center gap-1">
        {[0.5, 1, 2, 4].map((speed) => (
          <button
            key={speed}
            onClick={() => onSpeedChange(speed)}
            className={cn(
              'px-2 py-1 text-xs font-mono transition-colors',
              playbackSpeed === speed
                ? 'bg-[var(--accent-primary)] text-black'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]'
            )}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Practice Page Component
// =============================================================================

export default function PracticePage() {
  // AI Context
  usePageContext();

  // Core state
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDetail | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Practice mode state
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('standard');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStats, setSessionStats] = useState({ attempted: 0, correct: 0 });

  // Result and feedback state
  const [result, setResult] = useState<{
    isCorrect: boolean;
    feedback: CoachingFeedback | string;
    correctAction: string;
  } | null>(null);

  // Timer state for quick drill
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // LTP Checklist state for deep analysis
  const [ltpChecklist, setLtpChecklist] = useState({
    levelScore: 50,
    trendScore: 50,
    patienceScore: 50,
    notes: '',
  });

  // UI state
  const [showOutcome, setShowOutcome] = useState(false);
  const [showFeedbackDetails, setShowFeedbackDetails] = useState(false);
  const [decisionReached, setDecisionReached] = useState(false);

  // Replay state
  const [replayIndex, setReplayIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Trade execution state
  const [activeTrade, setActiveTrade] = useState<TradeExecution | null>(null);

  // Coach feedback state
  const [coachFeedback, setCoachFeedback] = useState<{ message: string; type: 'info' | 'warning' | 'error' | 'success' } | null>(null);

  // Scoring/feedback state
  const [scoringResult, setScoringResult] = useState<{
    overall_score: number;
    grade: string;
    is_correct: boolean;
    components: {
      setup_identification: { score: number; max: number };
      direction: { score: number; max: number };
      entry_placement: { score: number; max: number };
      stop_placement: { score: number; max: number };
      target_selection: { score: number; max: number };
      level_identification: { score: number; max: number };
    };
  } | null>(null);

  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);
  const [idealTrade, setIdealTrade] = useState<{
    isValidSetup: boolean;
    direction: 'long' | 'short';
    entryPrice: number;
    stopPrice: number;
    target1Price: number;
    target2Price?: number;
    primaryLevelType: string;
  } | null>(null);

  const [outcomeData, setOutcomeData] = useState<{
    result: 'hit_t1' | 'hit_t2' | 'stopped_out' | 'breakeven' | 'chopped';
    exitPrice: number;
    pnlPercent: number;
    maxFavorable: number;
    maxAdverse: number;
  } | null>(null);

  // Trade Plan state
  const [tradePlan, setTradePlan] = useState<TradePlan>({
    isValidSetup: null,
    direction: null,
    entryPrice: null,
    stopPrice: null,
    target1Price: null,
    target2Price: null,
    levelTypes: [],
    confidence: 3,
    reasoning: '',
  });

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [focusFilter, setFocusFilter] = useState<string>('');

  // AI generation
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiScenarioParams, setAiScenarioParams] = useState({
    symbol: 'SPY',
    difficulty: 'intermediate',
    focusArea: 'all',
  });

  // =============================================================================
  // Convert scenario candles to KCUChart format
  // =============================================================================

  const chartCandles = useMemo((): Candle[] => {
    if (!selectedScenario?.chartData?.candles) return [];

    const candles = selectedScenario.chartData.candles;

    // In replay/hard mode, only show candles up to current index
    const isReplayOrHardMode = practiceMode === 'replay' || practiceMode === 'hard_mode';
    const visibleCandles = isReplayOrHardMode && !showOutcome
      ? candles.slice(0, replayIndex + 1)
      : candles;

    return visibleCandles.map((c) => ({
      time: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v,
    }));
  }, [selectedScenario, practiceMode, replayIndex, showOutcome]);

  // Convert key levels to KCUChart format
  const chartLevels = useMemo((): Level[] => {
    if (!selectedScenario?.keyLevels) return [];

    return selectedScenario.keyLevels.map((level) => ({
      price: level.price,
      label: level.label,
      type: level.type === 'support' || level.type === 'resistance' ? level.type :
            level.type === 'vwap' ? 'vwap' :
            level.type.includes('ema') ? 'ema' :
            level.type.includes('pivot') ? 'pivot' : 'custom',
    }));
  }, [selectedScenario]);

  // Add trade levels when active
  const tradeLevels = useMemo((): Level[] => {
    if (!activeTrade || activeTrade.status === 'pending') return [];

    const levels: Level[] = [
      {
        price: activeTrade.entryPrice,
        label: 'Entry',
        type: 'custom',
        color: '#fbbf24',
        lineStyle: 'solid',
      },
    ];

    if (activeTrade.stopPrice) {
      levels.push({
        price: activeTrade.stopPrice,
        label: 'Stop',
        type: 'custom',
        color: '#ef4444',
        lineStyle: 'dashed',
      });
    }

    if (activeTrade.target1Price) {
      levels.push({
        price: activeTrade.target1Price,
        label: 'T1',
        type: 'custom',
        color: '#22c55e',
        lineStyle: 'dashed',
      });
    }

    return levels;
  }, [activeTrade]);

  // Get current price
  const currentPrice = useMemo(() => {
    if (chartCandles.length === 0) return 0;
    return chartCandles[chartCandles.length - 1].close;
  }, [chartCandles]);

  // =============================================================================
  // Replay Controls
  // =============================================================================

  const totalCandles = selectedScenario?.chartData?.candles?.length || 0;
  const decisionPointIndex = Math.floor(totalCandles * 0.7);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying && (practiceMode === 'replay' || practiceMode === 'hard_mode')) {
      const intervalMs = 500 / playbackSpeed;

      replayIntervalRef.current = setInterval(() => {
        setReplayIndex((prev) => {
          // Check if we should stop at decision point or end
          if (prev >= totalCandles - 1) {
            setIsPlaying(false);
            return prev;
          }

          // Pause at decision point if not yet decided
          if (prev >= decisionPointIndex && !activeTrade && !result) {
            setIsPlaying(false);
            setDecisionReached(true);
            return prev;
          }

          return prev + 1;
        });
      }, intervalMs);

      return () => {
        if (replayIntervalRef.current) {
          clearInterval(replayIntervalRef.current);
        }
      };
    }
  }, [isPlaying, practiceMode, playbackSpeed, totalCandles, decisionPointIndex, activeTrade, result]);

  // Update trade P&L as replay progresses
  useEffect(() => {
    if (activeTrade && activeTrade.status === 'active' && chartCandles.length > 0) {
      const lastCandle = chartCandles[chartCandles.length - 1];
      const entryPrice = activeTrade.entryPrice;
      const currentClose = lastCandle.close;

      const pnl = activeTrade.direction === 'long'
        ? ((currentClose - entryPrice) / entryPrice) * 100
        : ((entryPrice - currentClose) / entryPrice) * 100;

      // Check for stop hit
      if (activeTrade.stopPrice) {
        const stopHit = activeTrade.direction === 'long'
          ? lastCandle.low <= activeTrade.stopPrice
          : lastCandle.high >= activeTrade.stopPrice;

        if (stopHit) {
          setActiveTrade((prev) => prev ? {
            ...prev,
            status: 'lost',
            exitPrice: activeTrade.stopPrice,
            exitCandle: replayIndex,
            currentPnl: activeTrade.direction === 'long'
              ? ((activeTrade.stopPrice! - entryPrice) / entryPrice) * 100
              : ((entryPrice - activeTrade.stopPrice!) / entryPrice) * 100,
          } : null);
          return;
        }
      }

      // Check for T1 hit
      if (activeTrade.target1Price) {
        const t1Hit = activeTrade.direction === 'long'
          ? lastCandle.high >= activeTrade.target1Price
          : lastCandle.low <= activeTrade.target1Price;

        if (t1Hit) {
          setActiveTrade((prev) => prev ? {
            ...prev,
            status: 'won',
            exitPrice: activeTrade.target1Price,
            exitCandle: replayIndex,
            currentPnl: activeTrade.direction === 'long'
              ? ((activeTrade.target1Price! - entryPrice) / entryPrice) * 100
              : ((entryPrice - activeTrade.target1Price!) / entryPrice) * 100,
          } : null);
          return;
        }
      }

      // Update current P&L
      setActiveTrade((prev) => prev ? { ...prev, currentPnl: pnl } : null);
    }
  }, [chartCandles, activeTrade, replayIndex]);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchScenarios = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (focusFilter) params.append('focus', focusFilter);
      params.append('limit', '50');

      const res = await fetch(`/api/practice/scenarios?${params}`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
  }, [difficultyFilter, focusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/practice/stats');
      if (res.ok) {
        const data = await res.json();
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchScenarios(), fetchStats()]);
      setLoading(false);
    }
    init();
  }, [fetchScenarios, fetchStats]);

  // =============================================================================
  // Session Management
  // =============================================================================

  const startSession = async () => {
    try {
      const res = await fetch('/api/practice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: practiceMode }),
      });
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.sessionId);
        setSessionStats({ attempted: 0, correct: 0 });
      }
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  // =============================================================================
  // Scenario Selection
  // =============================================================================

  const resetTradePlan = () => {
    setTradePlan({
      isValidSetup: null,
      direction: null,
      entryPrice: null,
      stopPrice: null,
      target1Price: null,
      target2Price: null,
      levelTypes: [],
      confidence: 3,
      reasoning: '',
    });
    setScoringResult(null);
    setAiFeedback(null);
    setIdealTrade(null);
    setOutcomeData(null);
  };

  const selectScenario = async (id: string) => {
    setScenarioLoading(true);
    setResult(null);
    setShowOutcome(false);
    setDecisionReached(false);
    setShowFeedbackDetails(false);
    setActiveTrade(null);
    setCoachFeedback(null);
    setReplayIndex(0);
    setIsPlaying(false);
    setLtpChecklist({ levelScore: 50, trendScore: 50, patienceScore: 50, notes: '' });
    resetTradePlan();

    try {
      const res = await fetch(`/api/practice/scenarios/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedScenario(data);
        setStartTime(Date.now());

        // Auto-start replay in replay/hard mode
        if (practiceMode === 'replay' || practiceMode === 'hard_mode') {
          setReplayIndex(0);
          setTimeout(() => setIsPlaying(true), 500);
        }

        // Start timer for quick drill
        if (practiceMode === 'quick_drill') {
          setTimeRemaining(30);
          startTimer();
        }

        if (!sessionId) {
          startSession();
        }
      }
    } catch (error) {
      console.error('Error fetching scenario:', error);
    } finally {
      setScenarioLoading(false);
    }
  };

  // =============================================================================
  // AI Scenario Generation
  // =============================================================================

  const generateAIScenario = async () => {
    setGeneratingAI(true);
    setResult(null);
    setShowOutcome(false);
    setDecisionReached(false);
    setShowFeedbackDetails(false);
    setActiveTrade(null);
    setCoachFeedback(null);
    setReplayIndex(0);
    setLtpChecklist({ levelScore: 50, trendScore: 50, patienceScore: 50, notes: '' });
    resetTradePlan();

    try {
      const res = await fetch('/api/practice/ai-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: aiScenarioParams.symbol,
          difficulty: aiScenarioParams.difficulty,
          focusArea: aiScenarioParams.focusArea,
          adaptive: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const scenario = data.scenario;

        const scenarioDetail: ScenarioDetail = {
          id: scenario.id || `ai-${Date.now()}`,
          title: scenario.title,
          description: scenario.description,
          symbol: scenario.symbol,
          scenarioType: scenario.scenarioType,
          difficulty: scenario.difficulty,
          chartTimeframe: '5m',
          chartData: { candles: scenario.chartData || [] },
          keyLevels: scenario.keyLevels || [],
          decisionPoint: scenario.decisionPoint,
          hasAttempted: false,
          correctAction: scenario.correctAction,
          ltpAnalysis: scenario.ltpAnalysis,
          explanation: scenario.explanation,
        };
        setSelectedScenario(scenarioDetail);
        setStartTime(Date.now());

        if (!sessionId) {
          startSession();
        }
      }
    } catch (error) {
      console.error('Error generating AI scenario:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  // =============================================================================
  // Timer for Quick Drill
  // =============================================================================

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          submitDecision('wait');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // =============================================================================
  // Early Entry Check
  // =============================================================================

  const checkEarlyEntry = (): boolean => {
    // In replay/hard mode, check if patience candle is confirmed
    if ((practiceMode === 'replay' || practiceMode === 'hard_mode') && !showOutcome) {
      const patienceScore = selectedScenario?.ltpAnalysis?.patience?.score || 0;

      // If patience score is low, it means no patience candle confirmed
      if (patienceScore < 60) {
        setCoachFeedback({
          message: getEarlyEntryFeedback(),
          type: 'warning',
        });

        // Play warning sound
        playWarningSound();

        // Clear feedback after 4 seconds
        setTimeout(() => setCoachFeedback(null), 4000);

        return true; // Entry is early
      }
    }
    return false;
  };

  const playWarningSound = () => {
    if (typeof window === 'undefined') return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 440;
      oscillator.type = 'sawtooth';
      gainNode.gain.value = 0.1;

      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioContext.close();
      }, 300);
    } catch (e) {
      console.warn('Audio not available');
    }
  };

  // =============================================================================
  // Trade Execution
  // =============================================================================

  const executeTrade = (direction: 'long' | 'short', plan?: TradePlan) => {
    if (!selectedScenario || !chartCandles.length) return;

    // Check for early entry
    if (checkEarlyEntry()) {
      return; // Don't execute if early
    }

    const lastCandle = chartCandles[chartCandles.length - 1];
    const entryPrice = plan?.entryPrice || lastCandle.close;
    const stopPrice = plan?.stopPrice ?? undefined;
    const target1Price = plan?.target1Price ?? undefined;

    const trade: TradeExecution = {
      entryCandle: replayIndex,
      entryPrice,
      direction,
      stopPrice,
      target1Price,
      currentPnl: 0,
      status: 'active',
    };

    setActiveTrade(trade);

    // Show entry feedback
    setCoachFeedback({
      message: `${direction.toUpperCase()} entered at $${entryPrice.toFixed(2)}. Now let the trade work.`,
      type: 'info',
    });
    setTimeout(() => setCoachFeedback(null), 3000);

    // Continue replay to show trade execution
    if ((practiceMode === 'replay' || practiceMode === 'hard_mode') && !isPlaying) {
      setIsPlaying(true);
    }
  };

  // =============================================================================
  // Decision Submission
  // =============================================================================

  const submitDecision = async (decision: 'long' | 'short' | 'wait') => {
    if (!selectedScenario) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Check for early entry (for long/short)
    if (decision !== 'wait' && checkEarlyEntry()) {
      return;
    }

    // Execute trade if direction chosen
    if (decision !== 'wait' && !activeTrade) {
      executeTrade(decision);
      return;
    }

    setSubmitting(true);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;

    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          decision,
          reasoning: ltpChecklist.notes || undefined,
          ltpChecklist: practiceMode === 'deep_analysis' ? ltpChecklist : undefined,
          timeTakenSeconds: timeTaken,
          sessionId,
          mode: practiceMode,
          useAICoaching: practiceMode === 'deep_analysis' || practiceMode === 'standard',
        }),
      });

      if (res.ok) {
        const data = await res.json();

        setResult({
          isCorrect: data.attempt.isCorrect,
          feedback: data.attempt.aiCoaching || data.attempt.feedback,
          correctAction: data.correctAction,
        });

        setSessionStats((prev) => ({
          attempted: prev.attempted + 1,
          correct: prev.correct + (data.attempt.isCorrect ? 1 : 0),
        }));

        setSelectedScenario((prev) => prev ? {
          ...prev,
          correctAction: data.correctAction,
          outcomeData: data.outcomeData,
          ltpAnalysis: data.ltpAnalysis,
          explanation: data.explanation,
          hasAttempted: true,
        } : null);

        setShowOutcome(true);
        fetchStats();
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
    } finally {
      setSubmitting(false);
      setTimeRemaining(null);
    }
  };

  const submitTradePlan = async (plan: TradePlan) => {
    if (!selectedScenario) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const decision = plan.isValidSetup === false ? 'wait' : plan.direction || 'wait';

    // Check for early entry
    if (decision !== 'wait' && checkEarlyEntry()) {
      return;
    }

    // Execute trade in replay/hard mode
    if ((practiceMode === 'replay' || practiceMode === 'hard_mode') && decision !== 'wait') {
      executeTrade(decision as 'long' | 'short', plan);
      setTradePlan(plan);
      return;
    }

    setSubmitting(true);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;

    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          decision,
          tradePlan: plan,
          reasoning: plan.reasoning || ltpChecklist.notes || undefined,
          ltpChecklist: practiceMode === 'deep_analysis' ? ltpChecklist : undefined,
          timeTakenSeconds: timeTaken,
          sessionId,
          mode: practiceMode,
          useAICoaching: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        setResult({
          isCorrect: data.attempt.isCorrect,
          feedback: data.attempt.aiCoaching || data.attempt.feedback,
          correctAction: data.correctAction,
        });

        // Generate mock scoring
        const scoring = data.scoring || {
          overall_score: data.attempt.isCorrect ? 78 : 52,
          grade: data.attempt.isCorrect ? 'B' : 'C',
          is_correct: data.attempt.isCorrect,
          components: {
            setup_identification: { score: data.attempt.isCorrect ? 18 : 10, max: 20 },
            direction: { score: decision === data.correctAction ? 20 : 5, max: 20 },
            entry_placement: { score: plan.entryPrice ? 12 : 5, max: 15 },
            stop_placement: { score: plan.stopPrice ? 12 : 5, max: 15 },
            target_selection: { score: plan.target1Price ? 12 : 5, max: 15 },
            level_identification: { score: plan.levelTypes.length > 0 ? 12 : 5, max: 15 },
          },
        };
        setScoringResult(scoring);

        // Generate AI feedback
        const feedback: AIFeedback = data.aiFeedback || {
          positive: data.attempt.isCorrect
            ? `Solid ${plan.direction} identification. You correctly read the LTP alignment.`
            : 'Good effort analyzing the setup.',
          improvement: data.attempt.isCorrect
            ? 'Consider tightening your stop for better R:R.'
            : `The correct play was ${data.correctAction}. Check the EMA alignment next time.`,
          specificTip: 'Watch for the patience candle CLOSE before entering.',
          ltpConcept: 'Level + Trend + Patience = A+ Setup. All three must align.',
          grade: scoring.grade,
          score: scoring.overall_score,
        };
        setAiFeedback(feedback);

        // Set ideal trade
        setIdealTrade(data.idealTrade || {
          isValidSetup: data.correctAction !== 'wait',
          direction: data.correctAction === 'short' ? 'short' : 'long',
          entryPrice: selectedScenario.decisionPoint?.price || 100,
          stopPrice: 98,
          target1Price: 104,
          primaryLevelType: 'PDH',
        });

        setSessionStats((prev) => ({
          attempted: prev.attempted + 1,
          correct: prev.correct + (data.attempt.isCorrect ? 1 : 0),
        }));

        setSelectedScenario((prev) => prev ? {
          ...prev,
          correctAction: data.correctAction,
          outcomeData: data.outcomeData,
          ltpAnalysis: data.ltpAnalysis,
          explanation: data.explanation,
          hasAttempted: true,
        } : null);

        setShowOutcome(true);
        fetchStats();
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error submitting trade plan:', error);
    } finally {
      setSubmitting(false);
      setTimeRemaining(null);
    }
  };

  // =============================================================================
  // Get Next Scenario
  // =============================================================================

  const getNextScenario = () => {
    const currentIndex = scenarios.findIndex((s) => s.id === selectedScenario?.id);
    const nextScenario = scenarios[currentIndex + 1] || scenarios[0];
    if (nextScenario) {
      selectScenario(nextScenario.id);
    }
  };

  // =============================================================================
  // Helper Functions
  // =============================================================================

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      default: return 'default';
    }
  };

  const getFocusIcon = (focus: string) => {
    switch (focus) {
      case 'level': return <Target className="w-4 h-4" />;
      case 'trend': return <TrendingUp className="w-4 h-4" />;
      case 'patience': return <Clock className="w-4 h-4" />;
      default: return <BarChart3 className="w-4 h-4" />;
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  if (loading) {
    return (
      <>
        <Header
          title="Practice Simulator"
          subtitle="Master the LTP framework through interactive scenarios"
          breadcrumbs={[{ label: 'Practice' }]}
        />
        <PageShell>
          <PageSection>
            <PracticePageSkeleton />
          </PageSection>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Practice Simulator"
        subtitle="Master the LTP framework through interactive scenarios"
        breadcrumbs={[{ label: 'Practice' }]}
      />

      <PageShell>
        {/* Stats Row */}
        <PageSection>
          <StatGrid columns={6}>
            <Card padding="sm">
              <Stat
                label="Attempts"
                value={userStats?.totalAttempts || 0}
                icon={<Target className="w-4 h-4" />}
              />
            </Card>
            <Card padding="sm">
              <Stat
                label="Correct"
                value={userStats?.correctAttempts || 0}
                icon={<CheckCircle className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="sm">
              <Stat
                label="Accuracy"
                value={`${userStats?.accuracyPercent?.toFixed(1) || 0}%`}
                icon={<Trophy className="w-4 h-4" />}
              />
            </Card>
            <Card padding="sm">
              <Stat
                label="Current Streak"
                value={userStats?.currentStreak || 0}
                icon={<Flame className="w-4 h-4" />}
                valueColor={userStats?.currentStreak && userStats.currentStreak >= 5 ? 'profit' : undefined}
              />
            </Card>
            <Card padding="sm">
              <Stat
                label="Best Streak"
                value={userStats?.bestStreak || 0}
                icon={<Award className="w-4 h-4" />}
              />
            </Card>
            <Card padding="sm">
              <Stat
                label="Days Practiced"
                value={userStats?.daysPracticed || 0}
                icon={<BarChart3 className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Practice Mode Selector */}
        <PageSection>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {PRACTICE_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = practiceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setPracticeMode(mode.id);
                    setSelectedScenario(null);
                    setResult(null);
                    setActiveTrade(null);
                    setReplayIndex(0);
                    setIsPlaying(false);
                  }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 border transition-all min-w-[200px]',
                    isActive
                      ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
                  )}
                >
                  <Icon className={cn('w-5 h-5', isActive ? 'text-[var(--accent-primary)]' : '')} />
                  <div className="text-left">
                    <div className={cn('font-semibold', isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]')}>
                      {mode.name}
                    </div>
                    <div className="text-xs opacity-70">{mode.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </PageSection>

        {/* Instructions */}
        <PageSection>
          <InstructionsPanel
            mode={practiceMode === 'hard_mode' ? 'replay' : practiceMode}
            hasScenarioSelected={!!selectedScenario}
            isFirstVisit={!userStats?.totalAttempts || userStats.totalAttempts < 3}
          />
        </PageSection>

        {/* Session Stats */}
        {sessionId && sessionStats.attempted > 0 && (
          <PageSection>
            <div className="flex items-center gap-4 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
              <span className="text-sm text-[var(--text-tertiary)]">Session:</span>
              <span className="text-sm font-mono text-[var(--text-primary)]">
                {sessionStats.correct}/{sessionStats.attempted}
              </span>
              <span className="text-sm text-[var(--text-tertiary)]">
                ({((sessionStats.correct / sessionStats.attempted) * 100).toFixed(0)}%)
              </span>
              {sessionStats.correct >= 5 && (
                <Badge variant="success" size="sm">
                  <Flame className="w-3 h-3 mr-1" />
                  On Fire!
                </Badge>
              )}
            </div>
          </PageSection>
        )}

        {/* Daily Challenges */}
        <PageSection>
          <DailyChallenges
            onStartChallenge={(challengeId, type) => {
              if (type === 'accuracy_target') {
                setPracticeMode('standard');
              } else if (type === 'level_focus') {
                setFocusFilter('level');
              }
            }}
          />
        </PageSection>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Scenario List / AI Generation */}
          <PageSection className="lg:col-span-1">
            {practiceMode === 'ai_generated' ? (
              <Card>
                <CardHeader
                  title="AI Scenario Generator"
                  icon={<Wand2 className="w-5 h-5 text-[var(--accent-primary)]" />}
                />
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Symbol</label>
                    <select
                      className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2"
                      value={aiScenarioParams.symbol}
                      onChange={(e) => setAiScenarioParams((prev) => ({ ...prev, symbol: e.target.value }))}
                    >
                      <option value="SPY">SPY</option>
                      <option value="QQQ">QQQ</option>
                      <option value="AAPL">AAPL</option>
                      <option value="NVDA">NVDA</option>
                      <option value="TSLA">TSLA</option>
                      <option value="META">META</option>
                      <option value="MSFT">MSFT</option>
                      <option value="AMZN">AMZN</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Difficulty</label>
                    <select
                      className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2"
                      value={aiScenarioParams.difficulty}
                      onChange={(e) => setAiScenarioParams((prev) => ({ ...prev, difficulty: e.target.value }))}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Focus Area</label>
                    <select
                      className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2"
                      value={aiScenarioParams.focusArea}
                      onChange={(e) => setAiScenarioParams((prev) => ({ ...prev, focusArea: e.target.value }))}
                    >
                      <option value="all">All Areas</option>
                      <option value="level">Level</option>
                      <option value="trend">Trend</option>
                      <option value="patience">Patience</option>
                    </select>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={generateAIScenario}
                    disabled={generatingAI}
                  >
                    {generatingAI ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Scenario
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader
                  title="Scenarios"
                  action={
                    <div className="flex flex-col gap-2">
                      <select
                        className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-2 py-1"
                        value={difficultyFilter}
                        onChange={(e) => setDifficultyFilter(e.target.value)}
                      >
                        <option value="">All Levels</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                      <select
                        className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-2 py-1"
                        value={focusFilter}
                        onChange={(e) => setFocusFilter(e.target.value)}
                      >
                        <option value="">All Focus Areas</option>
                        <option value="level">Level</option>
                        <option value="trend">Trend</option>
                        <option value="patience">Patience</option>
                      </select>
                    </div>
                  }
                />
                <CardContent className="p-0">
                  <div className="divide-y divide-[var(--border-primary)] max-h-[600px] overflow-y-auto">
                    {scenarios.length === 0 ? (
                      <div className="p-6 text-center text-[var(--text-tertiary)]">
                        No scenarios available yet.
                      </div>
                    ) : (
                      scenarios.map((scenario) => (
                        <button
                          key={scenario.id}
                          className={cn(
                            'w-full p-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors',
                            selectedScenario?.id === scenario.id && 'bg-[var(--bg-tertiary)] border-l-2 border-l-[var(--accent-primary)]'
                          )}
                          onClick={() => selectScenario(scenario.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getFocusIcon(scenario.focus_area)}
                                <span className="font-medium text-[var(--text-primary)]">
                                  {scenario.symbol}
                                </span>
                                <Badge variant={getDifficultyColor(scenario.difficulty)} size="sm">
                                  {scenario.difficulty}
                                </Badge>
                              </div>
                              <p className="text-sm text-[var(--text-secondary)] line-clamp-1">
                                {scenario.title}
                              </p>
                            </div>
                            {scenario.userAttempts > 0 && (
                              <div className="text-right">
                                <span className={cn(
                                  'text-xs font-mono',
                                  scenario.userCorrect > 0 ? 'text-[var(--profit)]' : 'text-[var(--text-tertiary)]'
                                )}>
                                  {scenario.userCorrect}/{scenario.userAttempts}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </PageSection>

          {/* Main Practice Area */}
          <PageSection className="lg:col-span-3">
            <Card>
              {scenarioLoading ? (
                <CardContent className="p-6">
                  <ScenarioChartSkeleton />
                </CardContent>
              ) : selectedScenario ? (
                <>
                  <CardHeader
                    title={selectedScenario.title}
                    subtitle={selectedScenario.description}
                    action={
                      <div className="flex items-center gap-2">
                        {(practiceMode === 'hard_mode' || practiceMode === 'replay') && (
                          <Badge variant="info" size="sm">
                            <EyeOff className="w-3 h-3 mr-1" />
                            {practiceMode === 'hard_mode' ? 'HARD MODE' : 'REPLAY'}
                          </Badge>
                        )}
                        {timeRemaining !== null && (
                          <div className={cn(
                            'flex items-center gap-2 px-3 py-1 font-mono text-lg',
                            timeRemaining <= 10 ? 'bg-[var(--error)]/20 text-[var(--error)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                          )}>
                            <Timer className="w-5 h-5" />
                            {timeRemaining}s
                          </div>
                        )}
                      </div>
                    }
                  />
                  <CardContent className="p-0">
                    {/* Chart Area */}
                    <div className="relative">
                      {chartCandles.length > 0 ? (
                        <>
                          <KCUChart
                            mode={practiceMode === 'replay' || practiceMode === 'hard_mode' ? 'replay' : 'live'}
                            data={chartCandles}
                            levels={[...chartLevels, ...tradeLevels]}
                            symbol={selectedScenario.symbol}
                            height={500}
                            showVolume={true}
                            showIndicators={true}
                            showPatienceCandles={true}
                            replayIndex={(practiceMode === 'replay' || practiceMode === 'hard_mode') && !showOutcome ? replayIndex : undefined}
                          />

                          {/* LTP Score HUD */}
                          {selectedScenario.ltpAnalysis && (
                            <LTPScoreHUD
                              ltpAnalysis={selectedScenario.ltpAnalysis}
                              grade={scoringResult?.grade}
                            />
                          )}

                          {/* Trade Overlay */}
                          <TradeOverlay
                            trade={activeTrade}
                            currentPrice={currentPrice}
                          />

                          {/* Coach Feedback Box */}
                          <CoachFeedbackBox
                            message={coachFeedback?.message || ''}
                            type={coachFeedback?.type || 'info'}
                            show={!!coachFeedback}
                            onDismiss={() => setCoachFeedback(null)}
                          />
                        </>
                      ) : (
                        <div className="bg-[var(--bg-tertiary)] p-6">
                          <div className="aspect-video bg-[var(--bg-primary)] border border-[var(--border-primary)] flex items-center justify-center">
                            <div className="text-center text-[var(--text-tertiary)]">
                              <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p>Chart data loading...</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Replay Controls */}
                    {(practiceMode === 'replay' || practiceMode === 'hard_mode') && totalCandles > 0 && (
                      <ReplayControls
                        isPlaying={isPlaying}
                        currentIndex={replayIndex}
                        totalCandles={totalCandles}
                        playbackSpeed={playbackSpeed}
                        onPlayPause={() => setIsPlaying(!isPlaying)}
                        onStepForward={() => setReplayIndex((prev) => Math.min(prev + 1, totalCandles - 1))}
                        onReset={() => {
                          setReplayIndex(0);
                          setIsPlaying(false);
                          setActiveTrade(null);
                          setDecisionReached(false);
                        }}
                        onSpeedChange={setPlaybackSpeed}
                        onSeek={setReplayIndex}
                        className="border-t border-[var(--border-primary)]"
                      />
                    )}

                    {/* Decision Area */}
                    <div className="p-6">
                      {result ? (
                        <div className="space-y-6">
                          {/* Comparison Panel */}
                          {scoringResult && idealTrade && outcomeData && (
                            <ComparisonPanel
                              userResponse={tradePlan}
                              idealTrade={idealTrade}
                              outcomeData={outcomeData}
                              scoringResult={scoringResult}
                              symbol={selectedScenario.symbol}
                            />
                          )}

                          {/* AI Coach Feedback */}
                          {aiFeedback && (
                            <AICoachFeedback
                              feedback={aiFeedback}
                              relatedLessonSlug={selectedScenario.relatedLessonSlug}
                              onReviewSetup={() => setShowOutcome(true)}
                              onPracticeAnother={() => {
                                setSelectedScenario(null);
                                setResult(null);
                                resetTradePlan();
                                setActiveTrade(null);
                              }}
                            />
                          )}

                          {/* Fallback Result Display */}
                          {!scoringResult && (
                            <div className={cn(
                              'p-6 rounded-lg',
                              result.isCorrect
                                ? 'bg-[var(--profit)]/10 border border-[var(--profit)]'
                                : 'bg-[var(--loss)]/10 border border-[var(--loss)]'
                            )}>
                              <div className="flex items-center gap-3 mb-4">
                                {result.isCorrect ? (
                                  <CheckCircle className="w-8 h-8 text-[var(--profit)]" />
                                ) : (
                                  <XCircle className="w-8 h-8 text-[var(--loss)]" />
                                )}
                                <div>
                                  <h3 className={cn(
                                    'text-lg font-bold',
                                    result.isCorrect ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                                  )}>
                                    {result.isCorrect ? 'Correct!' : 'Incorrect'}
                                  </h3>
                                  <p className="text-sm text-[var(--text-secondary)]">
                                    Correct action: <span className="font-semibold uppercase">{result.correctAction}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex gap-3 mt-6">
                                {practiceMode === 'quick_drill' ? (
                                  <Button variant="primary" onClick={getNextScenario} icon={<ChevronRight className="w-4 h-4" />}>
                                    Next Scenario
                                  </Button>
                                ) : (
                                  <>
                                    <Button
                                      variant="secondary"
                                      onClick={() => {
                                        setSelectedScenario(null);
                                        setResult(null);
                                        resetTradePlan();
                                        setActiveTrade(null);
                                      }}
                                    >
                                      Try Another
                                    </Button>
                                    {selectedScenario.relatedLessonSlug && (
                                      <Button variant="ghost" icon={<BookOpen className="w-4 h-4" />}>
                                        Related Lesson
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Context for replay/hard mode */}
                          {(practiceMode === 'replay' || practiceMode === 'hard_mode') && selectedScenario.decisionPoint && decisionReached && !activeTrade && (
                            <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
                              <MessageSquare className="w-4 h-4 inline mr-2 text-[var(--accent-primary)]" />
                              {selectedScenario.decisionPoint.context}
                            </div>
                          )}

                          {/* Full Decision Panel for standard and deep analysis modes */}
                          {(practiceMode === 'standard' || practiceMode === 'deep_analysis' || practiceMode === 'ai_generated') ? (
                            <DecisionPanel
                              currentPrice={currentPrice}
                              symbol={selectedScenario.symbol}
                              onSubmit={(plan) => {
                                setTradePlan(plan);
                                submitTradePlan(plan);
                              }}
                              isSubmitting={submitting}
                              disabled={submitting}
                            />
                          ) : (
                            /* Quick buttons for quick_drill, replay, and hard_mode */
                            <>
                              <DecisionGuide className="mb-4" />

                              <div className="grid grid-cols-3 gap-4">
                                <Button
                                  variant="secondary"
                                  size="lg"
                                  className="flex-col py-6 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)] group"
                                  onClick={() => submitDecision('long')}
                                  disabled={submitting || ((practiceMode === 'replay' || practiceMode === 'hard_mode') && !decisionReached) || !!activeTrade}
                                >
                                  <TrendingUp className="w-8 h-8 mb-2 text-[var(--profit)] group-hover:scale-110 transition-transform" />
                                  <span className="text-lg font-bold">LONG</span>
                                  <span className="text-xs text-[var(--text-tertiary)] mt-1">Buy / Bullish</span>
                                </Button>

                                <Button
                                  variant="secondary"
                                  size="lg"
                                  className="flex-col py-6 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)] group"
                                  onClick={() => submitDecision('wait')}
                                  disabled={submitting || ((practiceMode === 'replay' || practiceMode === 'hard_mode') && !decisionReached) || !!activeTrade}
                                >
                                  <Pause className="w-8 h-8 mb-2 text-[var(--warning)] group-hover:scale-110 transition-transform" />
                                  <span className="text-lg font-bold">WAIT</span>
                                  <span className="text-xs text-[var(--text-tertiary)] mt-1">No Trade</span>
                                </Button>

                                <Button
                                  variant="secondary"
                                  size="lg"
                                  className="flex-col py-6 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)] group"
                                  onClick={() => submitDecision('short')}
                                  disabled={submitting || ((practiceMode === 'replay' || practiceMode === 'hard_mode') && !decisionReached) || !!activeTrade}
                                >
                                  <TrendingDown className="w-8 h-8 mb-2 text-[var(--loss)] group-hover:scale-110 transition-transform" />
                                  <span className="text-lg font-bold">SHORT</span>
                                  <span className="text-xs text-[var(--text-tertiary)] mt-1">Sell / Bearish</span>
                                </Button>
                              </div>

                              {(practiceMode === 'replay' || practiceMode === 'hard_mode') && (
                                <KeyboardShortcuts mode="replay" className="mt-4" />
                              )}
                            </>
                          )}

                          {submitting && (
                            <div className="text-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
                              <p className="text-sm text-[var(--text-tertiary)] mt-2">Analyzing your decision...</p>
                            </div>
                          )}

                          {(practiceMode === 'replay' || practiceMode === 'hard_mode') && !decisionReached && !activeTrade && (
                            <p className="text-center text-sm text-[var(--text-tertiary)]">
                              Wait for the chart to reach the decision point...
                            </p>
                          )}

                          {activeTrade && activeTrade.status === 'active' && (
                            <p className="text-center text-sm text-[var(--accent-primary)]">
                              Trade active. Watch it play out on the chart...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="py-20 text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-50" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Select a Scenario
                  </h3>
                  <p className="text-[var(--text-tertiary)] mb-4">
                    Choose a practice scenario from the list to test your LTP skills.
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    Current mode: <span className="text-[var(--accent-primary)] font-semibold">{PRACTICE_MODES.find((m) => m.id === practiceMode)?.name}</span>
                  </p>
                </CardContent>
              )}
            </Card>
          </PageSection>
        </div>
      </PageShell>
    </>
  );
}
