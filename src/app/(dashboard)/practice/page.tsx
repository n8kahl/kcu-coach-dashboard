'use client';

/**
 * Practice Simulator Page
 *
 * Refactored to use usePracticeEngine hook for centralized game state management.
 * Mobile-first layout with proper flex structure.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { usePracticeEngine, type ScenarioData, type PracticeMode } from '@/hooks/usePracticeEngine';
import { usePageContext, useAIContext } from '@/components/ai';
import {
  Target,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Trophy,
  Flame,
  Award,
  BarChart3,
  Clock,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ChevronRight,
  Zap,
  Brain,
  Timer,
  EyeOff,
  Wand2,
  Sparkles,
  Menu,
  X,
  Loader2,
  BookOpen,
} from 'lucide-react';

// UI Components
import { Header, PageShell, PageSection } from '@/components/layout';
import { Card, CardHeader, CardContent, Stat, StatGrid, Button, Badge } from '@/components/ui';

// Practice Components
import { PracticeChart } from '@/components/practice/practice-chart';
import { DecisionPanel, TradePlan } from '@/components/practice/DecisionPanel';
import { ComparisonPanel } from '@/components/practice/ComparisonPanel';
import { AICoachFeedback } from '@/components/practice/AICoachFeedback';
import { PracticeWinCard } from '@/components/practice/PracticeWinCard';
import { DailyChallenges } from '@/components/practice/DailyChallenge';

// =============================================================================
// Types
// =============================================================================

interface ScenarioListItem {
  id: string;
  title: string;
  symbol: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  focus_area: string;
  userAttempts: number;
  userCorrect: number;
}

interface UserStats {
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercent: number;
  currentStreak: number;
  bestStreak: number;
  daysPracticed: number;
}

// =============================================================================
// Constants
// =============================================================================

const PRACTICE_MODES: Array<{
  id: PracticeMode;
  name: string;
  description: string;
  icon: typeof Target;
}> = [
  { id: 'standard', name: 'Standard', description: 'Full scenario with feedback', icon: Target },
  { id: 'quick_drill', name: 'Quick Drill', description: '30s decisions', icon: Zap },
  { id: 'deep_analysis', name: 'Deep Analysis', description: 'Full LTP checklist', icon: Brain },
  { id: 'replay', name: 'Replay', description: 'Candle-by-candle', icon: Play },
  { id: 'hard_mode', name: 'Hard Mode', description: 'Gamma ghosted', icon: EyeOff },
  { id: 'ai_generated', name: 'AI Generated', description: 'Unlimited scenarios', icon: Wand2 },
];

// =============================================================================
// Replay Controls Component
// =============================================================================

function ReplayControls({
  isPlaying,
  currentIndex,
  totalCandles,
  playbackSpeed,
  onPlayPause,
  onStepForward,
  onReset,
  onSpeedChange,
}: {
  isPlaying: boolean;
  currentIndex: number;
  totalCandles: number;
  playbackSpeed: number;
  onPlayPause: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-primary)]">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          icon={<RotateCcw className="w-4 h-4" />}
        />
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
          size="sm"
          onClick={onPlayPause}
          icon={isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onStepForward}
          disabled={currentIndex >= totalCandles - 1}
          icon={<SkipForward className="w-4 h-4" />}
        />
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-[var(--text-tertiary)]">
          {currentIndex + 1} / {totalCandles}
        </span>
        <div className="flex items-center gap-1">
          {[0.5, 1, 2, 4].map((speed) => (
            <button
              key={speed}
              onClick={() => onSpeedChange(speed)}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                playbackSpeed === speed
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Decision Buttons Component
// =============================================================================

function QuickDecisionButtons({
  onLong,
  onShort,
  onWait,
  disabled,
  isSubmitting,
}: {
  onLong: () => void;
  onShort: () => void;
  onWait: () => void;
  disabled: boolean;
  isSubmitting: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-4 p-4">
      <Button
        variant="secondary"
        size="lg"
        className="flex-col py-6 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)] group"
        onClick={onLong}
        disabled={disabled || isSubmitting}
      >
        <TrendingUp className="w-8 h-8 mb-2 text-[var(--profit)] group-hover:scale-110 transition-transform" />
        <span className="text-lg font-bold">LONG</span>
        <span className="text-xs text-[var(--text-tertiary)] mt-1">Buy / Bullish</span>
      </Button>

      <Button
        variant="secondary"
        size="lg"
        className="flex-col py-6 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)] group"
        onClick={onWait}
        disabled={disabled || isSubmitting}
      >
        <Clock className="w-8 h-8 mb-2 text-[var(--warning)] group-hover:scale-110 transition-transform" />
        <span className="text-lg font-bold">WAIT</span>
        <span className="text-xs text-[var(--text-tertiary)] mt-1">No Trade</span>
      </Button>

      <Button
        variant="secondary"
        size="lg"
        className="flex-col py-6 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)] group"
        onClick={onShort}
        disabled={disabled || isSubmitting}
      >
        <TrendingDown className="w-8 h-8 mb-2 text-[var(--loss)] group-hover:scale-110 transition-transform" />
        <span className="text-lg font-bold">SHORT</span>
        <span className="text-xs text-[var(--text-tertiary)] mt-1">Sell / Bearish</span>
      </Button>
    </div>
  );
}

// =============================================================================
// Scenario List Sidebar Component
// =============================================================================

function ScenarioListSidebar({
  scenarios,
  selectedId,
  onSelect,
  loading,
  difficultyFilter,
  focusFilter,
  onDifficultyChange,
  onFocusChange,
}: {
  scenarios: ScenarioListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  difficultyFilter: string;
  focusFilter: string;
  onDifficultyChange: (val: string) => void;
  onFocusChange: (val: string) => void;
}) {
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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Scenarios"
        action={
          <div className="flex flex-col gap-2">
            <select
              className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-2 py-1 rounded"
              value={difficultyFilter}
              onChange={(e) => onDifficultyChange(e.target.value)}
            >
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select
              className="text-xs bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-2 py-1 rounded"
              value={focusFilter}
              onChange={(e) => onFocusChange(e.target.value)}
            >
              <option value="">All Focus Areas</option>
              <option value="level">Level</option>
              <option value="trend">Trend</option>
              <option value="patience">Patience</option>
            </select>
          </div>
        }
      />
      <CardContent className="p-0 flex-1 overflow-hidden">
        <div className="divide-y divide-[var(--border-primary)] max-h-full overflow-y-auto">
          {loading ? (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
            </div>
          ) : scenarios.length === 0 ? (
            <div className="p-6 text-center text-[var(--text-tertiary)]">
              No scenarios available.
            </div>
          ) : (
            scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={cn(
                  'w-full p-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors',
                  selectedId === scenario.id && 'bg-[var(--bg-tertiary)] border-l-2 border-l-[var(--accent-primary)]'
                )}
                onClick={() => onSelect(scenario.id)}
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
  );
}

// =============================================================================
// Main Practice Page Component
// =============================================================================

export default function PracticePage() {
  const router = useRouter();

  // Page context for AI
  usePageContext();

  // =============================================================================
  // State
  // =============================================================================

  // Mode and UI state
  const [practiceMode, setPracticeMode] = useState<PracticeMode>('standard');
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showWinCard, setShowWinCard] = useState(false);

  // Scenario data
  const [scenarios, setScenarios] = useState<ScenarioListItem[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioDetail, setScenarioDetail] = useState<ScenarioData | null>(null);
  const [scenarioLoading, setScenariosLoading] = useState(true);
  const [scenarioDetailLoading, setScenarioDetailLoading] = useState(false);

  // User stats
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  // Filters
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [focusFilter, setFocusFilter] = useState('');

  // AI generation state
  const [aiScenarioParams, setAiScenarioParams] = useState({
    symbol: 'SPY',
    difficulty: 'intermediate',
    focusArea: 'all',
  });
  const [generatingAI, setGeneratingAI] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ isCorrect: boolean; correctAction: string } | null>(null);
  const [aiFeedback, setAiFeedback] = useState<any>(null);

  // =============================================================================
  // Practice Engine Hook - Centralized Game State
  // =============================================================================

  const {
    gameState,
    controls,
    trade,
    stats: sessionStats,
    chartProps,
  } = usePracticeEngine({
    scenario: scenarioDetail,
    mode: practiceMode,
    voiceEnabled: practiceMode === 'hard_mode' || practiceMode === 'replay',
    onTradeComplete: (activeTrade, isCorrect) => {
      setResult({
        isCorrect,
        correctAction: scenarioDetail?.correctAction || 'wait',
      });
      if (isCorrect) {
        setShowWinCard(true);
      }
    },
    onDecisionPoint: () => {
      // Could trigger sound or notification
    },
  });

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // Fetch scenarios list
  const fetchScenarios = useCallback(async () => {
    try {
      setScenariosLoading(true);
      const params = new URLSearchParams();
      if (difficultyFilter) params.append('difficulty', difficultyFilter);
      if (focusFilter) params.append('focus', focusFilter);

      const response = await fetch(`/api/practice/scenarios?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      }
    } catch (error) {
      console.error('Error fetching scenarios:', error);
    } finally {
      setScenariosLoading(false);
    }
  }, [difficultyFilter, focusFilter]);

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/practice/stats');
      if (response.ok) {
        const data = await response.json();
        setUserStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Fetch scenario detail
  const selectScenario = useCallback(async (id: string) => {
    setSelectedScenarioId(id);
    setScenarioDetailLoading(true);
    setResult(null);
    setAiFeedback(null);
    controls.reset();

    try {
      const response = await fetch(`/api/practice/scenarios/${id}`);
      if (response.ok) {
        const data = await response.json();
        setScenarioDetail(data);
      }
    } catch (error) {
      console.error('Error fetching scenario detail:', error);
    } finally {
      setScenarioDetailLoading(false);
      setShowMobileSidebar(false);
    }
  }, [controls]);

  // Generate AI scenario
  const generateAIScenario = useCallback(async () => {
    setGeneratingAI(true);
    try {
      const response = await fetch('/api/practice/ai-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiScenarioParams),
      });
      if (response.ok) {
        const data = await response.json();
        setScenarioDetail(data);
        setSelectedScenarioId(data.id);
        setResult(null);
        setAiFeedback(null);
        controls.reset();
      }
    } catch (error) {
      console.error('Error generating AI scenario:', error);
    } finally {
      setGeneratingAI(false);
    }
  }, [aiScenarioParams, controls]);

  // Initial fetch
  useEffect(() => {
    fetchScenarios();
    fetchStats();
  }, [fetchScenarios, fetchStats]);

  // =============================================================================
  // Trade Submission
  // =============================================================================

  const submitDecision = useCallback(async (direction: 'long' | 'short' | 'wait') => {
    if (!scenarioDetail || isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (direction === 'wait') {
        trade.controls.submitWait();
      } else {
        const success = trade.controls.executeTrade(direction, {
          entryPrice: chartProps.currentPrice,
          // For quick decisions, auto-set stop/target
          stopPrice: direction === 'long'
            ? chartProps.currentPrice * 0.99
            : chartProps.currentPrice * 1.01,
          target1Price: direction === 'long'
            ? chartProps.currentPrice * 1.02
            : chartProps.currentPrice * 0.98,
        });

        if (!success) {
          setIsSubmitting(false);
          return;
        }
      }

      // Submit to API for tracking
      const response = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenarioDetail.id,
          decision: direction,
          tradePlan: trade.plan,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          isCorrect: data.attempt.isCorrect,
          correctAction: data.correctAction,
        });
        setAiFeedback(data.aiFeedback);

        if (data.attempt.isCorrect) {
          setShowWinCard(true);
        }

        fetchStats();
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error submitting decision:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [scenarioDetail, isSubmitting, trade, chartProps.currentPrice, fetchStats, fetchScenarios]);

  const submitTradePlan = useCallback(async (plan: TradePlan) => {
    if (!scenarioDetail || isSubmitting || !plan.direction) return;

    setIsSubmitting(true);

    try {
      const success = trade.controls.executeTrade(plan.direction, plan);

      if (!success) {
        setIsSubmitting(false);
        return;
      }

      // Submit to API
      const response = await fetch('/api/practice/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioId: scenarioDetail.id,
          decision: plan.direction,
          tradePlan: plan,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({
          isCorrect: data.attempt.isCorrect,
          correctAction: data.correctAction,
        });
        setAiFeedback(data.aiFeedback);

        if (data.attempt.isCorrect) {
          setShowWinCard(true);
        }

        fetchStats();
        fetchScenarios();
      }
    } catch (error) {
      console.error('Error submitting trade plan:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [scenarioDetail, isSubmitting, trade, fetchStats, fetchScenarios]);

  // =============================================================================
  // Helpers
  // =============================================================================

  const isReplayMode = practiceMode === 'replay' || practiceMode === 'hard_mode';
  const showDecisionButtons = practiceMode === 'quick_drill' || isReplayMode;
  const canMakeDecision = !isReplayMode || gameState.decisionReached;

  const getNextScenario = useCallback(() => {
    const currentIndex = scenarios.findIndex((s) => s.id === selectedScenarioId);
    const nextScenario = scenarios[currentIndex + 1] || scenarios[0];
    if (nextScenario) {
      selectScenario(nextScenario.id);
    }
  }, [scenarios, selectedScenarioId, selectScenario]);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <>
      <Header
        title="Practice Simulator"
        subtitle="Master the LTP framework through interactive scenarios"
        breadcrumbs={[{ label: 'Practice' }]}
      />

      {/* Mobile-first layout */}
      <div className="flex flex-col h-[calc(100dvh-4rem)]">
        {/* Stats Row - Flex-none */}
        <div className="flex-none px-4 py-3 bg-[var(--bg-primary)] border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-4 min-w-0">
              {/* Optimistic session stats - updates immediately */}
              <Stat
                label="Attempts"
                value={(userStats?.totalAttempts || 0) + sessionStats.attempted}
                icon={<Target className="w-4 h-4" />}
                variant="compact"
              />
              <Stat
                label="Correct"
                value={(userStats?.correctAttempts || 0) + sessionStats.correct}
                icon={<CheckCircle className="w-4 h-4" />}
                valueColor="profit"
                variant="compact"
              />
              <Stat
                label="Accuracy"
                value={`${sessionStats.attempted > 0
                  ? sessionStats.accuracy.toFixed(0)
                  : (userStats?.accuracyPercent?.toFixed(0) || 0)}%`}
                icon={<Trophy className="w-4 h-4" />}
                variant="compact"
              />
              {/* Optimistic streak display - shows session streak immediately */}
              <Stat
                label="Streak"
                value={sessionStats.currentStreak > 0
                  ? sessionStats.currentStreak
                  : (userStats?.currentStreak || 0)}
                icon={<Flame className={cn(
                  'w-4 h-4',
                  sessionStats.currentStreak >= 10 && 'animate-pulse text-orange-400'
                )} />}
                valueColor={(sessionStats.currentStreak >= 5 || (userStats?.currentStreak && userStats.currentStreak >= 5)) ? 'profit' : undefined}
                variant="compact"
              />
              {/* Session XP indicator */}
              {sessionStats.sessionXp > 0 && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded-full border border-amber-500/30">
                  <Award className="w-3 h-3 text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">+{sessionStats.sessionXp} XP</span>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="lg:hidden p-2 hover:bg-[var(--bg-tertiary)] rounded"
              onClick={() => setShowMobileSidebar(true)}
            >
              <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Mode Selector - Flex-none */}
        <div className="flex-none px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {PRACTICE_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = practiceMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setPracticeMode(mode.id);
                    setResult(null);
                    setAiFeedback(null);
                    controls.reset();
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-[var(--accent-primary)]' : '')} />
                  <span className="text-sm font-medium">{mode.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content - Flex-1 with min-h-0 */}
        <div className="flex-1 min-h-0 flex">
          {/* Scenario Sidebar - Hidden on mobile */}
          <div className="hidden lg:block w-80 flex-none border-r border-[var(--border-primary)] overflow-hidden">
            {practiceMode === 'ai_generated' ? (
              <Card className="m-4">
                <CardHeader
                  title="AI Scenario Generator"
                  icon={<Wand2 className="w-5 h-5 text-[var(--accent-primary)]" />}
                />
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Symbol</label>
                    <select
                      className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2 rounded"
                      value={aiScenarioParams.symbol}
                      onChange={(e) => setAiScenarioParams((prev) => ({ ...prev, symbol: e.target.value }))}
                    >
                      {['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Difficulty</label>
                    <select
                      className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2 rounded"
                      value={aiScenarioParams.difficulty}
                      onChange={(e) => setAiScenarioParams((prev) => ({ ...prev, difficulty: e.target.value }))}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
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
              <ScenarioListSidebar
                scenarios={scenarios}
                selectedId={selectedScenarioId}
                onSelect={selectScenario}
                loading={scenarioLoading}
                difficultyFilter={difficultyFilter}
                focusFilter={focusFilter}
                onDifficultyChange={setDifficultyFilter}
                onFocusChange={setFocusFilter}
              />
            )}
          </div>

          {/* Chart and Controls Area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {scenarioDetailLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
              </div>
            ) : scenarioDetail ? (
              <>
                {/* Scenario Header */}
                <div className="flex-none px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-primary)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                        {scenarioDetail.title}
                      </h2>
                      <p className="text-sm text-[var(--text-tertiary)]">
                        {scenarioDetail.description}
                      </p>
                    </div>
                    {isReplayMode && (
                      <Badge variant="info" size="sm">
                        <EyeOff className="w-3 h-3 mr-1" />
                        {practiceMode === 'hard_mode' ? 'HARD MODE' : 'REPLAY'}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Chart Area - Flex-1 with min-h-0 */}
                <div className="flex-1 min-h-0 p-4">
                  <PracticeChart
                    visibleCandles={chartProps.visibleCandles}
                    currentIndex={gameState.replayIndex}
                    animatingCandle={chartProps.animatingCandle}
                    levels={chartProps.levels}
                    gammaLevels={chartProps.gammaLevels}
                    tradeLevels={chartProps.tradeLevels}
                    symbol={scenarioDetail.symbol}
                    timeframe={scenarioDetail.chartTimeframe}
                    isReplayMode={isReplayMode}
                    decisionReached={gameState.decisionReached}
                    decisionPointIndex={chartProps.decisionPointIndex}
                    showOutcome={gameState.showOutcome}
                    className="h-full"
                  />
                </div>

                {/* Replay Controls */}
                {isReplayMode && !result && (
                  <div className="flex-none">
                    <ReplayControls
                      isPlaying={gameState.isPlaying}
                      currentIndex={gameState.replayIndex}
                      totalCandles={chartProps.visibleCandles.length}
                      playbackSpeed={gameState.playbackSpeed}
                      onPlayPause={controls.togglePlayPause}
                      onStepForward={controls.stepForward}
                      onReset={controls.reset}
                      onSpeedChange={controls.setSpeed}
                    />
                  </div>
                )}

                {/* Decision/Result Area - Flex-none */}
                <div className="flex-none border-t border-[var(--border-primary)]">
                  {result ? (
                    <div className="p-4 space-y-4">
                      {/* Result Banner */}
                      <div className={cn(
                        'p-4 rounded-lg flex items-center gap-3',
                        result.isCorrect
                          ? 'bg-[var(--profit)]/10 border border-[var(--profit)]'
                          : 'bg-[var(--loss)]/10 border border-[var(--loss)]'
                      )}>
                        {result.isCorrect ? (
                          <CheckCircle className="w-6 h-6 text-[var(--profit)]" />
                        ) : (
                          <XCircle className="w-6 h-6 text-[var(--loss)]" />
                        )}
                        <div>
                          <h3 className={cn(
                            'font-bold',
                            result.isCorrect ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                          )}>
                            {result.isCorrect ? 'Correct!' : 'Incorrect'}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)]">
                            Correct action: <span className="font-semibold uppercase">{result.correctAction}</span>
                          </p>
                        </div>
                      </div>

                      {/* AI Feedback */}
                      {aiFeedback && (
                        <AICoachFeedback
                          feedback={aiFeedback}
                          relatedLessonSlug={scenarioDetail.relatedLessonSlug}
                        />
                      )}

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          variant="primary"
                          onClick={getNextScenario}
                          icon={<ChevronRight className="w-4 h-4" />}
                        >
                          Next Scenario
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setResult(null);
                            setAiFeedback(null);
                            controls.reset();
                          }}
                        >
                          Try Again
                        </Button>
                        {scenarioDetail.relatedLessonSlug && (
                          <Button
                            variant="ghost"
                            icon={<BookOpen className="w-4 h-4" />}
                            onClick={() => router.push(`/learning/${scenarioDetail.relatedLessonSlug}`)}
                          >
                            Related Lesson
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : showDecisionButtons ? (
                    <QuickDecisionButtons
                      onLong={() => submitDecision('long')}
                      onShort={() => submitDecision('short')}
                      onWait={() => submitDecision('wait')}
                      disabled={!canMakeDecision}
                      isSubmitting={isSubmitting}
                    />
                  ) : (
                    <div className="p-4">
                      <DecisionPanel
                        currentPrice={chartProps.currentPrice}
                        symbol={scenarioDetail.symbol}
                        onSubmit={submitTradePlan}
                        isSubmitting={isSubmitting}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}

                  {isSubmitting && (
                    <div className="text-center py-4">
                      <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)] mx-auto" />
                      <p className="text-sm text-[var(--text-tertiary)] mt-2">Analyzing your decision...</p>
                    </div>
                  )}

                  {isReplayMode && !gameState.decisionReached && !result && (
                    <p className="text-center text-sm text-[var(--text-tertiary)] py-2">
                      Wait for the chart to reach the decision point...
                    </p>
                  )}
                </div>
              </>
            ) : (
              /* No scenario selected */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Target className="w-16 h-16 mx-auto mb-4 text-[var(--text-tertiary)] opacity-50" />
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    Select a Scenario
                  </h3>
                  <p className="text-[var(--text-tertiary)] mb-4">
                    Choose a practice scenario to test your LTP skills.
                  </p>
                  <Button
                    variant="primary"
                    className="lg:hidden"
                    onClick={() => setShowMobileSidebar(true)}
                  >
                    Browse Scenarios
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileSidebar(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 bg-[var(--bg-primary)] shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
              <h2 className="font-semibold text-[var(--text-primary)]">Scenarios</h2>
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-2 hover:bg-[var(--bg-tertiary)] rounded"
              >
                <X className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
            <div className="h-[calc(100%-60px)] overflow-hidden">
              <ScenarioListSidebar
                scenarios={scenarios}
                selectedId={selectedScenarioId}
                onSelect={selectScenario}
                loading={scenarioLoading}
                difficultyFilter={difficultyFilter}
                focusFilter={focusFilter}
                onDifficultyChange={setDifficultyFilter}
                onFocusChange={setFocusFilter}
              />
            </div>
          </div>
        </div>
      )}

      {/* Win Card Modal */}
      <PracticeWinCard
        isOpen={showWinCard}
        onClose={() => setShowWinCard(false)}
        onNextScenario={() => {
          setShowWinCard(false);
          getNextScenario();
        }}
        onViewDetails={() => {
          setShowWinCard(false);
        }}
        symbol={scenarioDetail?.symbol || ''}
        direction={trade.active?.direction || 'wait'}
        isCorrect={result?.isCorrect || false}
        pnlPercent={trade.active?.currentPnl}
        tradeStatus={trade.active?.status === 'won' ? 'won' : trade.active?.status === 'lost' ? 'lost' : undefined}
        ltp2Score={gameState.ltp2Score || undefined}
        grade={gameState.ltp2Score?.grade}
        score={gameState.ltp2Score?.score}
        xpEarned={sessionStats.sessionXp}
        difficulty={scenarioDetail?.difficulty || 'intermediate'}
        currentStreak={sessionStats.currentStreak}
        isNewBestStreak={sessionStats.currentStreak > sessionStats.bestStreak && sessionStats.currentStreak > 0}
        accuracy={sessionStats.accuracy}
      />
    </>
  );
}
