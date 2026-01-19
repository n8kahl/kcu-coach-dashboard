'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import { ProgressBar } from '@/components/ui/progress';
import { PracticeChart } from '@/components/practice/practice-chart';
import { ChartGrid } from '@/components/practice/ChartGrid';
import { DailyChallenges } from '@/components/practice/DailyChallenge';
import { AdvancedPracticeChart } from '@/components/practice/AdvancedPracticeChart';
import { AchievementPopup, Achievement } from '@/components/practice/AchievementPopup';
import { ContextPanel, ContextBadges, MarketContext, LTPAnalysis } from '@/components/practice/ContextPanel';
import { Leaderboard, MiniLeaderboard } from '@/components/practice/Leaderboard';
import { ChartSkeleton, DailyChallengeSkeleton, LeaderboardSkeleton, PracticePageSkeleton } from '@/components/practice/LoadingSkeletons';
import { DecisionPanel, TradePlan } from '@/components/practice/DecisionPanel';
import { ComparisonPanel } from '@/components/practice/ComparisonPanel';
import { AICoachFeedback, AIFeedback } from '@/components/practice/AICoachFeedback';
import { MarketContextCard, ScenarioContext } from '@/components/practice/MarketContextCard';
import { InstructionsPanel, DecisionGuide, KeyboardShortcuts } from '@/components/practice/InstructionsPanel';
import { PaperTradingPanel } from '@/components/practice/paper-trading-panel';
import { OptionsChain } from '@/components/practice/options-chain';
import { ReplayController, useReplayState } from '@/components/practice/replay-controller';
import { SkillExercises } from '@/components/practice/skill-exercises';
import { cn } from '@/lib/utils';
import { usePageContext } from '@/components/ai';
import { Tooltip } from '@/components/ui/tooltip';
import {
  PracticePageSkeleton,
  ScenarioChartSkeleton,
  ScenarioListSkeleton,
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
  Wallet,
  Layers,
  GraduationCap,
} from 'lucide-react';

// Types
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

type PracticeMode = 'standard' | 'quick_drill' | 'deep_analysis' | 'replay' | 'ai_generated' | 'multi_timeframe';

// Practice Mode Definitions
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
    id: 'ai_generated' as PracticeMode,
    name: 'AI Scenarios',
    description: 'Unlimited AI-generated practice',
    icon: Wand2,
    color: 'info',
  },
  {
    id: 'multi_timeframe' as PracticeMode,
    name: 'Multi-TF',
    description: '5-chart grid analysis',
    icon: LayoutGrid,
    color: 'default',
  },
  {
    id: 'replay' as PracticeMode,
    name: 'Live Replay',
    description: 'Watch candles unfold in real-time',
    icon: Play,
    color: 'info',
  },
];

export default function PracticePage() {
  // AI Context - update page context
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

  // AI Scenario state
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiScenarioParams, setAiScenarioParams] = useState({
    symbol: 'SPY',
    difficulty: 'intermediate',
    focusArea: 'all',
  });
  const [showMTFChart, setShowMTFChart] = useState(false);

  // Right panel state for tools
  type RightPanelTab = 'none' | 'paper_trading' | 'options' | 'exercises';
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('none');

  // Replay state (for enhanced replay mode)
  const replayState = useReplayState(
    selectedScenario?.chartData?.candles?.length || 0,
    0
  );

  // Trade Plan state (for full trade analysis)
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

  // Scoring state
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

  // AI Feedback state
  const [aiFeedback, setAiFeedback] = useState<AIFeedback | null>(null);

  // Ideal trade for comparison
  const [idealTrade, setIdealTrade] = useState<{
    isValidSetup: boolean;
    direction: 'long' | 'short';
    entryPrice: number;
    stopPrice: number;
    target1Price: number;
    target2Price?: number;
    primaryLevelType: string;
  } | null>(null);

  // Outcome data for comparison
  const [outcomeData, setOutcomeData] = useState<{
    result: 'hit_t1' | 'hit_t2' | 'stopped_out' | 'breakeven' | 'chopped';
    exitPrice: number;
    pnlPercent: number;
    maxFavorable: number;
    maxAdverse: number;
  } | null>(null);

  // Scenario context for MarketContextCard
  const [scenarioContext, setScenarioContext] = useState<ScenarioContext | null>(null);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [focusFilter, setFocusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Fetch scenarios
  const fetchScenarios = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (focusFilter) params.append('focus', focusFilter);
      if (typeFilter) params.append('type', typeFilter);
      params.append('limit', '50');

      const res = await fetch(`/api/practice/scenarios?${params}`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    }
  }, [difficultyFilter, focusFilter, typeFilter]);

  // Fetch user stats
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

  // Initialize
  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchScenarios(), fetchStats()]);
      setLoading(false);
    }
    init();
  }, [fetchScenarios, fetchStats]);

  // Start a new practice session
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

  // Reset trade plan to initial state
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
    setScenarioContext(null);
  };

  // Generate scenario context from scenario data
  const generateScenarioContext = (scenario: ScenarioDetail): ScenarioContext => {
    const candles = scenario.chartData?.candles || [];
    const lastCandle = candles[candles.length - 1];
    const firstCandle = candles[0];

    // Calculate change percent
    const changePercent = lastCandle && firstCandle
      ? ((lastCandle.c - firstCandle.o) / firstCandle.o) * 100
      : 0;

    // Calculate total volume and average
    const totalVolume = candles.reduce((sum, c) => sum + (c.v || 0), 0);
    const avgVolume = candles.length > 0 ? totalVolume / candles.length : 0;

    // Find ORB (first 5 candles for 5m chart = first 25 minutes)
    const orbCandles = candles.slice(0, 5);
    const orbHigh = Math.max(...orbCandles.map(c => c.h), 0);
    const orbLow = Math.min(...orbCandles.map(c => c.l), Infinity);

    // Find premarket high/low from key levels if available
    const preHigh = scenario.keyLevels?.find(l => l.type === 'premarket_high')?.price || (lastCandle?.h || 0) * 1.01;
    const preLow = scenario.keyLevels?.find(l => l.type === 'premarket_low')?.price || (lastCandle?.l || 0) * 0.99;

    return {
      symbol: scenario.symbol,
      date: new Date(lastCandle?.t * 1000 || Date.now()).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }),
      freezeTime: scenario.decisionPoint?.time
        ? new Date(scenario.decisionPoint.time * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '09:45',
      currentPrice: lastCandle?.c || 0,
      changePercent,
      volume: lastCandle?.v || totalVolume,
      avgVolume,
      premarket: {
        high: preHigh,
        low: preLow,
        change: ((preHigh - preLow) / preLow) * 100,
      },
      orb: {
        high: orbHigh || lastCandle?.h || 0,
        low: orbLow !== Infinity ? orbLow : lastCandle?.l || 0,
        range: orbHigh && orbLow !== Infinity ? orbHigh - orbLow : 0,
      },
      spyTrend: 'neutral', // TODO: Add market context integration
      sector: 'Technology',
      sectorPerformance: changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`,
    };
  };

  // Select a scenario
  const selectScenario = async (id: string) => {
    setScenarioLoading(true);
    setResult(null);
    setShowOutcome(false);
    setDecisionReached(false);
    setShowFeedbackDetails(false);
    setLtpChecklist({ levelScore: 50, trendScore: 50, patienceScore: 50, notes: '' });
    resetTradePlan();

    try {
      const res = await fetch(`/api/practice/scenarios/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedScenario(data);
        setStartTime(Date.now());

        // Generate scenario context
        setScenarioContext(generateScenarioContext(data));

        // Start timer for quick drill mode
        if (practiceMode === 'quick_drill') {
          setTimeRemaining(30);
          startTimer();
        }

        // Start session if not already started
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

  // Generate AI Scenario
  const generateAIScenario = async () => {
    setGeneratingAI(true);
    setResult(null);
    setShowOutcome(false);
    setDecisionReached(false);
    setShowFeedbackDetails(false);
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

        // Transform to ScenarioDetail format
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
          outcomeData: scenario.outcomeData ? {
            result: scenario.correctAction === 'long' ? 'win' : scenario.correctAction === 'short' ? 'win' : 'neutral',
            pnl_percent: scenario.correctAction !== 'wait' ? 1.5 : 0,
          } : undefined,
          ltpAnalysis: scenario.ltpAnalysis,
          explanation: scenario.explanation,
        };
        setSelectedScenario(scenarioDetail);

        // Generate scenario context
        setScenarioContext(generateScenarioContext(scenarioDetail));

        setStartTime(Date.now());

        // Start session if not already started
        if (!sessionId) {
          startSession();
        }
      } else {
        console.error('Failed to generate AI scenario');
      }
    } catch (error) {
      console.error('Error generating AI scenario:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  // Timer for quick drill
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-submit "wait" on timeout
          submitDecision('wait');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Submit full trade plan (for deep analysis and standard modes with full decision panel)
  const submitTradePlan = async (plan: TradePlan) => {
    if (!selectedScenario) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setSubmitting(true);
    const timeTaken = startTime ? Math.round((Date.now() - startTime) / 1000) : undefined;

    try {
      const res = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: selectedScenario.id,
          decision: plan.isValidSetup === false ? 'wait' : plan.direction || 'wait',
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

        // Set result
        setResult({
          isCorrect: data.attempt.isCorrect,
          feedback: data.attempt.aiCoaching || data.attempt.feedback,
          correctAction: data.correctAction,
        });

        // Generate scoring result
        const scoring = data.scoring || generateMockScoring(plan, selectedScenario, data.attempt.isCorrect);
        setScoringResult(scoring);

        // Generate AI feedback
        const feedback = data.aiFeedback || generateMockAIFeedback(plan, selectedScenario, data.attempt.isCorrect);
        setAiFeedback(feedback);

        // Set ideal trade
        const ideal = data.idealTrade || {
          isValidSetup: selectedScenario.correctAction !== 'wait',
          direction: (selectedScenario.correctAction === 'long' || selectedScenario.correctAction === 'short')
            ? selectedScenario.correctAction
            : 'long',
          entryPrice: selectedScenario.decisionPoint?.price || plan.entryPrice || 100,
          stopPrice: selectedScenario.keyLevels?.find(l => l.type === 'support')?.price || (plan.stopPrice || 98),
          target1Price: selectedScenario.keyLevels?.find(l => l.type === 'resistance')?.price || (plan.target1Price || 103),
          primaryLevelType: selectedScenario.keyLevels?.[0]?.type || 'PDH',
        };
        setIdealTrade(ideal);

        // Set outcome data
        const outcome = data.outcomeData || generateMockOutcome(selectedScenario, ideal);
        setOutcomeData(outcome);

        // Update session stats
        setSessionStats(prev => ({
          attempted: prev.attempted + 1,
          correct: prev.correct + (data.attempt.isCorrect ? 1 : 0),
        }));

        // Update the scenario
        setSelectedScenario(prev => prev ? {
          ...prev,
          correctAction: data.correctAction,
          outcomeData: data.outcomeData,
          ltpAnalysis: data.ltpAnalysis,
          explanation: data.explanation,
          hasAttempted: true,
        } : null);

        // Show outcome for replay mode
        if (practiceMode === 'replay') {
          setShowOutcome(true);
        }

        // Update stats
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

  // Generate mock scoring for display
  const generateMockScoring = (plan: TradePlan, scenario: ScenarioDetail, isCorrect: boolean) => {
    const baseScore = isCorrect ? 75 : 45;
    return {
      overall_score: baseScore + Math.floor(Math.random() * 15),
      grade: isCorrect ? (baseScore >= 80 ? 'A' : 'B') : (baseScore >= 50 ? 'C' : 'D'),
      is_correct: isCorrect,
      components: {
        setup_identification: { score: isCorrect ? 20 : 10, max: 20 },
        direction: { score: plan.direction === scenario.correctAction ? 20 : 5, max: 20 },
        entry_placement: { score: plan.entryPrice ? (isCorrect ? 15 : 10) : 5, max: 15 },
        stop_placement: { score: plan.stopPrice ? (isCorrect ? 15 : 8) : 5, max: 15 },
        target_selection: { score: plan.target1Price ? (isCorrect ? 15 : 8) : 5, max: 15 },
        level_identification: { score: plan.levelTypes.length > 0 ? (isCorrect ? 15 : 10) : 5, max: 15 },
      },
    };
  };

  // Generate mock AI feedback for display
  const generateMockAIFeedback = (plan: TradePlan, scenario: ScenarioDetail, isCorrect: boolean): AIFeedback => {
    if (isCorrect) {
      return {
        positive: `Great job identifying the ${plan.direction} setup! Your entry placement near $${plan.entryPrice?.toFixed(2)} shows good understanding of key levels.`,
        improvement: 'Consider waiting for stronger volume confirmation before entry for even higher probability trades.',
        specificTip: 'Watch for the 5-second candle close above the level to confirm the breakout before entering.',
        ltpConcept: `This setup demonstrates proper ${plan.levelTypes[0] || 'level'} identification with trend alignment. The LTP framework helped you spot this opportunity.`,
        grade: 'B',
        score: 78,
      };
    } else {
      return {
        positive: 'You took the time to analyze the setup rather than rushing into a decision.',
        improvement: `The ${scenario.correctAction?.toUpperCase()} was the better play here. The EMA alignment and level rejection pointed to this direction.`,
        specificTip: 'Before entering, always check: 1) Is price respecting the level? 2) Are EMAs aligned? 3) Is there volume confirmation?',
        ltpConcept: 'Remember: Level first, then Trend, then Patience. This setup required waiting for the level rejection before acting.',
        grade: 'C',
        score: 58,
      };
    }
  };

  // Generate mock outcome data
  const generateMockOutcome = (scenario: ScenarioDetail, ideal: typeof idealTrade): {
    result: 'hit_t1' | 'hit_t2' | 'stopped_out' | 'breakeven' | 'chopped';
    exitPrice: number;
    pnlPercent: number;
    maxFavorable: number;
    maxAdverse: number;
  } => {
    if (!ideal) {
      return {
        result: 'chopped',
        exitPrice: 100,
        pnlPercent: 0,
        maxFavorable: 0.5,
        maxAdverse: 0.3,
      };
    }

    const isWin = scenario.correctAction !== 'wait';
    if (isWin) {
      return {
        result: 'hit_t1',
        exitPrice: ideal.target1Price,
        pnlPercent: ((ideal.target1Price - ideal.entryPrice) / ideal.entryPrice) * 100,
        maxFavorable: Math.abs(ideal.target1Price - ideal.entryPrice) * 1.2,
        maxAdverse: Math.abs(ideal.entryPrice - ideal.stopPrice) * 0.3,
      };
    } else {
      return {
        result: 'chopped',
        exitPrice: ideal.entryPrice,
        pnlPercent: 0,
        maxFavorable: 0.5,
        maxAdverse: 0.8,
      };
    }
  };

  // Submit decision (simplified for quick modes)
  const submitDecision = async (decision: 'long' | 'short' | 'wait') => {
    if (!selectedScenario) return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
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

        // Update session stats
        setSessionStats(prev => ({
          attempted: prev.attempted + 1,
          correct: prev.correct + (data.attempt.isCorrect ? 1 : 0),
        }));

        // Update the scenario with outcome data
        setSelectedScenario(prev => prev ? {
          ...prev,
          correctAction: data.correctAction,
          outcomeData: data.outcomeData,
          ltpAnalysis: data.ltpAnalysis,
          explanation: data.explanation,
          hasAttempted: true,
        } : null);

        // Show outcome for replay mode
        if (practiceMode === 'replay') {
          setShowOutcome(true);
        }

        // Update stats
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

  // Get next scenario (for quick drill)
  const getNextScenario = () => {
    const currentIndex = scenarios.findIndex(s => s.id === selectedScenario?.id);
    const nextScenario = scenarios[currentIndex + 1] || scenarios[0];
    if (nextScenario) {
      selectScenario(nextScenario.id);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Helper functions
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

  // Render feedback content
  const renderFeedback = (feedback: CoachingFeedback | string) => {
    if (typeof feedback === 'string') {
      return <p className="text-sm text-[var(--text-secondary)]">{feedback}</p>;
    }

    return (
      <div className="space-y-4">
        {/* Summary */}
        <p className="text-[var(--text-primary)] font-medium">{feedback.summary}</p>

        {/* Detailed Feedback */}
        <p className="text-sm text-[var(--text-secondary)]">{feedback.detailedFeedback}</p>

        {/* What You Missed */}
        {feedback.whatYouMissed && (
          <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded">
            <p className="text-sm text-[var(--error)]">
              <strong>What you missed:</strong> {feedback.whatYouMissed}
            </p>
          </div>
        )}

        {/* LTP Breakdown (expandable) */}
        <button
          className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
          onClick={() => setShowFeedbackDetails(!showFeedbackDetails)}
        >
          {showFeedbackDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showFeedbackDetails ? 'Hide' : 'Show'} LTP Breakdown
        </button>

        {showFeedbackDetails && (
          <div className="grid grid-cols-1 gap-3 p-4 bg-[var(--bg-tertiary)] rounded">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Level</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{feedback.ltpBreakdown.level}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Trend</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{feedback.ltpBreakdown.trend}</p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Patience</span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{feedback.ltpBreakdown.patience}</p>
            </div>
          </div>
        )}

        {/* Encouragement */}
        <p className="text-sm text-[var(--accent-primary)] italic">{feedback.encouragement}</p>

        {/* Next Steps */}
        {feedback.nextSteps && feedback.nextSteps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-2">Next Steps</p>
            <ul className="space-y-1">
              {feedback.nextSteps.map((step, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <ArrowRight className="w-3 h-3 text-[var(--accent-primary)]" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Personalized Tip */}
        {feedback.personalizedTip && (
          <div className="p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-semibold text-[var(--accent-primary)] uppercase">Personalized Tip</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{feedback.personalizedTip}</p>
          </div>
        )}
      </div>
    );
  };

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

        {/* Instructions Panel - Mode-specific guidance */}
        <PageSection>
          <InstructionsPanel
            mode={practiceMode}
            hasScenarioSelected={!!selectedScenario}
            isFirstVisit={!userStats?.totalAttempts || userStats.totalAttempts < 3}
          />
        </PageSection>

        {/* Session Stats (if in session) */}
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

        {/* Daily Challenges Row */}
        <PageSection>
          <DailyChallenges
            onStartChallenge={(challengeId, type) => {
              // Focus the scenario list or start appropriate mode
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
                      onChange={(e) => setAiScenarioParams(prev => ({ ...prev, symbol: e.target.value }))}
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
                      onChange={(e) => setAiScenarioParams(prev => ({ ...prev, difficulty: e.target.value }))}
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
                      onChange={(e) => setAiScenarioParams(prev => ({ ...prev, focusArea: e.target.value }))}
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
                  <p className="text-xs text-[var(--text-tertiary)] text-center">
                    AI generates unique practice scenarios tailored to your skill level
                  </p>
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
                            {scenario.community_attempts > 0 && (
                              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                Community: {scenario.community_accuracy?.toFixed(0)}% accuracy
                              </p>
                            )}
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

          {/* Scenario Detail / Practice Area */}
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
                      timeRemaining !== null && (
                        <div className={cn(
                          'flex items-center gap-2 px-3 py-1 font-mono text-lg',
                          timeRemaining <= 10 ? 'bg-[var(--error)]/20 text-[var(--error)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                        )}>
                          <Timer className="w-5 h-5" />
                          {timeRemaining}s
                        </div>
                      )
                    }
                  />
                  <CardContent>
                    {/* Chart Toggle for Multi-TF */}
                    {practiceMode === 'multi_timeframe' && (
                      <div className="mb-4 flex items-center gap-2">
                        <button
                          onClick={() => setShowMTFChart(false)}
                          className={cn(
                            'px-3 py-1.5 text-sm border transition-colors',
                            !showMTFChart
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
                          )}
                        >
                          Single Chart
                        </button>
                        <button
                          onClick={() => setShowMTFChart(true)}
                          className={cn(
                            'px-3 py-1.5 text-sm border transition-colors flex items-center gap-1',
                            showMTFChart
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
                          )}
                        >
                          <LayoutGrid className="w-4 h-4" />
                          5-Chart Grid
                        </button>
                      </div>
                    )}

                    {/* Chart */}
                    <div className="mb-6">
                      {practiceMode === 'multi_timeframe' && showMTFChart ? (
                        <ChartGrid
                          symbol={selectedScenario.symbol}
                          dailyBars={selectedScenario.chartData?.candles?.slice(0, 20) || []}
                          hourlyBars={selectedScenario.chartData?.candles?.slice(0, 40) || []}
                          fifteenMinBars={selectedScenario.chartData?.candles?.slice(0, 60) || []}
                          fiveMinBars={selectedScenario.chartData?.candles || []}
                          twoMinBars={selectedScenario.chartData?.candles || []}
                          keyLevels={selectedScenario.keyLevels || []}
                          decisionPoint={selectedScenario.decisionPoint}
                          showOutcome={showOutcome}
                        />
                      ) : selectedScenario.chartData?.candles?.length > 0 ? (
                        <PracticeChart
                          chartData={selectedScenario.chartData}
                          keyLevels={selectedScenario.keyLevels || []}
                          decisionPoint={selectedScenario.decisionPoint}
                          outcomeData={selectedScenario.outcomeData}
                          symbol={selectedScenario.symbol}
                          timeframe={selectedScenario.chartTimeframe || '5m'}
                          showOutcome={showOutcome}
                          replayMode={practiceMode === 'replay'}
                          onDecisionPointReached={() => setDecisionReached(true)}
                          className="h-[400px]"
                        />
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

                    {/* Replay Controller (Replay Mode) */}
                    {practiceMode === 'replay' && selectedScenario?.chartData?.candles?.length > 0 && (
                      <div className="mb-4">
                        <ReplayController
                          totalCandles={selectedScenario.chartData.candles.length}
                          currentIndex={replayState.currentIndex}
                          onIndexChange={replayState.setCurrentIndex}
                          isPlaying={replayState.isPlaying}
                          onPlayPause={replayState.togglePlayPause}
                          playbackSpeed={replayState.playbackSpeed}
                          onSpeedChange={replayState.setPlaybackSpeed}
                          decisionPointIndex={selectedScenario.decisionPoint ? Math.floor(selectedScenario.chartData.candles.length * 0.7) : undefined}
                          onShowOutcome={() => setShowOutcome(true)}
                        />
                      </div>
                    )}

                    {/* Tools Toolbar */}
                    <div className="flex items-center gap-2 mb-4 pb-4 border-b border-[var(--border-primary)]">
                      <span className="text-xs text-[var(--text-tertiary)] mr-2">Tools:</span>
                      <Tooltip content="Practice with simulated $25,000 account" side="bottom">
                        <button
                          onClick={() => setRightPanelTab(rightPanelTab === 'paper_trading' ? 'none' : 'paper_trading')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all duration-200 rounded',
                            rightPanelTab === 'paper_trading'
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          Paper Trading
                        </button>
                      </Tooltip>
                      <Tooltip content="View options chain with Greeks (0DTE supported)" side="bottom">
                        <button
                          onClick={() => setRightPanelTab(rightPanelTab === 'options' ? 'none' : 'options')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all duration-200 rounded',
                            rightPanelTab === 'options'
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          Options Chain
                        </button>
                      </Tooltip>
                      <Tooltip content="Targeted exercises to improve specific skills" side="bottom">
                        <button
                          onClick={() => setRightPanelTab(rightPanelTab === 'exercises' ? 'none' : 'exercises')}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs border transition-all duration-200 rounded',
                            rightPanelTab === 'exercises'
                              ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                              : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:bg-[var(--bg-tertiary)]'
                          )}
                        >
                          <GraduationCap className="w-3.5 h-3.5" />
                          Skill Exercises
                        </button>
                      </Tooltip>
                    </div>

                    {/* Right Panel Content (Collapsible with animation) */}
                    {rightPanelTab !== 'none' && (
                      <div className="mb-6 border border-[var(--border-primary)] rounded bg-[var(--bg-secondary)] animate-in slide-in-from-top-2 duration-300 ease-out">
                        {rightPanelTab === 'paper_trading' && (
                          <PaperTradingPanel
                            symbol={selectedScenario?.symbol || 'SPY'}
                            currentPrice={
                              selectedScenario?.chartData?.candles?.length
                                ? selectedScenario.chartData.candles[selectedScenario.chartData.candles.length - 1].c
                                : 0
                            }
                            userId="demo-user"
                          />
                        )}
                        {rightPanelTab === 'options' && (
                          <OptionsChain
                            symbol={selectedScenario?.symbol || 'SPY'}
                            currentPrice={
                              selectedScenario?.chartData?.candles?.length
                                ? selectedScenario.chartData.candles[selectedScenario.chartData.candles.length - 1].c
                                : 450
                            }
                            onOptionSelect={(option) => {
                              console.log('Selected option:', option);
                            }}
                          />
                        )}
                        {rightPanelTab === 'exercises' && (
                          <SkillExercises
                            onExerciseComplete={(result) => {
                              console.log('Exercise completed:', result);
                              fetchStats();
                            }}
                            className="border-0"
                          />
                        )}
                      </div>
                    )}

                    {/* LTP Checklist (Deep Analysis Mode) */}
                    {practiceMode === 'deep_analysis' && !result && (
                      <div className="mb-6 p-4 bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-[var(--accent-primary)]" />
                          Your LTP Assessment
                        </h4>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <div>
                            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                              Level Score: {ltpChecklist.levelScore}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={ltpChecklist.levelScore}
                              onChange={(e) => setLtpChecklist(prev => ({ ...prev, levelScore: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                              Trend Score: {ltpChecklist.trendScore}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={ltpChecklist.trendScore}
                              onChange={(e) => setLtpChecklist(prev => ({ ...prev, trendScore: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                              Patience Score: {ltpChecklist.patienceScore}%
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={ltpChecklist.patienceScore}
                              onChange={(e) => setLtpChecklist(prev => ({ ...prev, patienceScore: parseInt(e.target.value) }))}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <textarea
                          placeholder="Your analysis notes (optional)..."
                          value={ltpChecklist.notes}
                          onChange={(e) => setLtpChecklist(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)]"
                          rows={2}
                        />
                      </div>
                    )}

                    {/* Decision Buttons or Result */}
                    {result ? (
                      <div className="space-y-6">
                        {/* Comparison Panel - Full trade comparison */}
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
                            }}
                          />
                        )}

                        {/* Fallback for quick modes without full scoring */}
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
                              {userStats?.currentStreak && userStats.currentStreak >= 3 && result.isCorrect && (
                                <Badge variant="warning" className="ml-auto">
                                  <Flame className="w-3 h-3 mr-1" />
                                  {userStats.currentStreak} Streak!
                                </Badge>
                              )}
                            </div>

                            {/* Feedback */}
                            <div className="mb-4">
                              {renderFeedback(result.feedback)}
                            </div>

                            {/* LTP Analysis */}
                            {selectedScenario.ltpAnalysis && (
                              <div className="mt-4 grid grid-cols-3 gap-4">
                                <div>
                                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Level Score</p>
                                  <ProgressBar
                                    value={selectedScenario.ltpAnalysis.level.score}
                                    max={100}
                                    size="sm"
                                  />
                                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                    {selectedScenario.ltpAnalysis.level.score}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Trend Score</p>
                                  <ProgressBar
                                    value={selectedScenario.ltpAnalysis.trend.score}
                                    max={100}
                                    size="sm"
                                  />
                                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                    {selectedScenario.ltpAnalysis.trend.score}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Patience Score</p>
                                  <ProgressBar
                                    value={selectedScenario.ltpAnalysis.patience.score}
                                    max={100}
                                    size="sm"
                                  />
                                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                                    {selectedScenario.ltpAnalysis.patience.score}%
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 mt-6">
                              {practiceMode === 'quick_drill' ? (
                                <Button
                                  variant="primary"
                                  onClick={getNextScenario}
                                  icon={<ChevronRight className="w-4 h-4" />}
                                >
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
                                    }}
                                  >
                                    Try Another
                                  </Button>
                                  {selectedScenario.relatedLessonSlug && (
                                    <Button
                                      variant="ghost"
                                      icon={<BookOpen className="w-4 h-4" />}
                                    >
                                      Related Lesson
                                    </Button>
                                  )}
                                  {result.isCorrect && userStats?.currentStreak && userStats.currentStreak >= 5 && (
                                    <Button
                                      variant="ghost"
                                      icon={<Share2 className="w-4 h-4" />}
                                    >
                                      Share Win
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
                        {/* Context for replay mode */}
                        {practiceMode === 'replay' && selectedScenario.decisionPoint && (
                          <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-secondary)]">
                            <MessageSquare className="w-4 h-4 inline mr-2 text-[var(--accent-primary)]" />
                            {selectedScenario.decisionPoint.context}
                          </div>
                        )}

                        {/* Market Context Card - shown alongside decision panel */}
                        {scenarioContext && (practiceMode === 'standard' || practiceMode === 'deep_analysis') && (
                          <MarketContextCard context={scenarioContext} className="mb-4" />
                        )}

                        {/* Full Decision Panel for standard and deep analysis modes */}
                        {(practiceMode === 'standard' || practiceMode === 'deep_analysis' || practiceMode === 'ai_generated') ? (
                          <DecisionPanel
                            currentPrice={selectedScenario.chartData?.candles?.[selectedScenario.chartData.candles.length - 1]?.c || 100}
                            symbol={selectedScenario.symbol}
                            onSubmit={(plan) => {
                              setTradePlan(plan);
                              submitTradePlan(plan);
                            }}
                            isSubmitting={submitting}
                            disabled={submitting}
                          />
                        ) : (
                          /* Quick buttons for quick_drill, replay, and multi_timeframe modes */
                          <>
                            {/* Decision Guide - Quick reference for LTP framework */}
                            <DecisionGuide className="mb-4" />

                            <div className="grid grid-cols-3 gap-4">
                              <Button
                                variant="secondary"
                                size="lg"
                                className="flex-col py-6 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)] group"
                                onClick={() => submitDecision('long')}
                                disabled={submitting || (practiceMode === 'replay' && !decisionReached)}
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
                                disabled={submitting || (practiceMode === 'replay' && !decisionReached)}
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
                                disabled={submitting || (practiceMode === 'replay' && !decisionReached)}
                              >
                                <TrendingDown className="w-8 h-8 mb-2 text-[var(--loss)] group-hover:scale-110 transition-transform" />
                                <span className="text-lg font-bold">SHORT</span>
                                <span className="text-xs text-[var(--text-tertiary)] mt-1">Sell / Bearish</span>
                              </Button>
                            </div>

                            {/* Keyboard shortcuts for replay mode */}
                            {practiceMode === 'replay' && (
                              <KeyboardShortcuts mode={practiceMode} className="mt-4" />
                            )}
                          </>
                        )}

                        {submitting && (
                          <div className="text-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
                            <p className="text-sm text-[var(--text-tertiary)] mt-2">Analyzing your decision...</p>
                          </div>
                        )}

                        {practiceMode === 'replay' && !decisionReached && (
                          <p className="text-center text-sm text-[var(--text-tertiary)]">
                            Wait for the chart to reach the decision point...
                          </p>
                        )}
                      </div>
                    )}
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
                    Current mode: <span className="text-[var(--accent-primary)] font-semibold">{PRACTICE_MODES.find(m => m.id === practiceMode)?.name}</span>
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
