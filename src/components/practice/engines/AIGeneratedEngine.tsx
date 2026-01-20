'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PracticeChart } from '../practice-chart';
import { Button } from '@/components/ui/button';
import {
  Wand2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Pause,
  CheckCircle,
  XCircle,
  Loader2,
  Target,
  Zap,
  Brain,
  RefreshCw,
} from 'lucide-react';
import type { EngineProps, ScenarioData } from './types';

interface AIGeneratedEngineProps extends EngineProps {
  onGenerateScenario: (params: GenerationParams) => Promise<void>;
  isGenerating: boolean;
  userWeaknesses?: string[]; // e.g., ['patience', 'trend_identification']
}

interface GenerationParams {
  symbol: string;
  difficulty: string;
  focusArea: string;
  adaptive: boolean;
}

const SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'META', 'MSFT', 'AMZN', 'AMD', 'GOOGL'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];
const FOCUS_AREAS = ['all', 'level', 'trend', 'patience', 'entry_timing', 'risk_management'];

export function AIGeneratedEngine({
  scenario,
  onDecisionSubmit,
  isSubmitting,
  result,
  onNextScenario,
  onBack,
  onGenerateScenario,
  isGenerating,
  userWeaknesses = [],
}: AIGeneratedEngineProps) {
  const [params, setParams] = useState<GenerationParams>({
    symbol: 'SPY',
    difficulty: 'intermediate',
    focusArea: userWeaknesses[0] || 'all',
    adaptive: true,
  });

  const handleGenerate = useCallback(() => {
    onGenerateScenario(params);
  }, [onGenerateScenario, params]);

  // Show generation form if no scenario
  if (!scenario && !isGenerating) {
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--accent-primary)]/10 mb-4">
            <Wand2 className="w-8 h-8 text-[var(--accent-primary)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            AI Scenario Generator
          </h2>
          <p className="text-[var(--text-secondary)]">
            Generate unlimited practice scenarios tailored to your skill level and areas for improvement.
          </p>
        </div>

        {/* User Weaknesses Banner */}
        {userWeaknesses.length > 0 && (
          <div className="p-4 bg-[var(--warning)]/10 border border-[var(--warning)]/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-[var(--warning)]" />
              <span className="text-sm font-semibold text-[var(--warning)]">
                Based on your performance
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              We recommend focusing on:{' '}
              <span className="font-semibold capitalize">
                {userWeaknesses.join(', ').replace(/_/g, ' ')}
              </span>
            </p>
          </div>
        )}

        {/* Generation Form */}
        <div className="space-y-4 p-6 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg">
          {/* Symbol */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">
              Symbol
            </label>
            <select
              className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2 rounded text-[var(--text-primary)]"
              value={params.symbol}
              onChange={(e) => setParams((prev) => ({ ...prev, symbol: e.target.value }))}
            >
              {SYMBOLS.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Choose a ticker for your practice scenario
            </p>
          </div>

          {/* Difficulty */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">
              Difficulty
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff}
                  onClick={() => setParams((prev) => ({ ...prev, difficulty: diff }))}
                  className={cn(
                    'px-3 py-2 text-sm rounded border transition-colors capitalize',
                    params.difficulty === diff
                      ? diff === 'beginner'
                        ? 'bg-[var(--success)]/20 border-[var(--success)] text-[var(--success)]'
                        : diff === 'intermediate'
                          ? 'bg-[var(--warning)]/20 border-[var(--warning)] text-[var(--warning)]'
                          : 'bg-[var(--error)]/20 border-[var(--error)] text-[var(--error)]'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
                  )}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>

          {/* Focus Area */}
          <div>
            <label className="text-xs text-[var(--text-tertiary)] mb-1.5 block">
              Focus Area
            </label>
            <select
              className="w-full text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] px-3 py-2 rounded text-[var(--text-primary)]"
              value={params.focusArea}
              onChange={(e) => setParams((prev) => ({ ...prev, focusArea: e.target.value }))}
            >
              {FOCUS_AREAS.map((area) => (
                <option key={area} value={area}>
                  {area === 'all' ? 'All Areas' : area.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Focus on specific aspects of the LTP framework
            </p>
          </div>

          {/* Adaptive Toggle */}
          <div className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] rounded">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-sm text-[var(--text-primary)]">Adaptive Learning</span>
            </div>
            <button
              onClick={() => setParams((prev) => ({ ...prev, adaptive: !prev.adaptive }))}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                params.adaptive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--bg-primary)]'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                  params.adaptive ? 'left-5' : 'left-1'
                )}
              />
            </button>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            When enabled, AI will adjust scenarios based on your performance patterns
          </p>

          {/* Generate Button */}
          <Button
            variant="primary"
            size="lg"
            className="w-full mt-4"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            Generate Scenario
          </Button>
        </div>

        {/* Quick Generate Options */}
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-tertiary)] text-center">Quick Generate</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => {
                setParams({ symbol: 'SPY', difficulty: 'beginner', focusArea: 'level', adaptive: true });
                onGenerateScenario({ symbol: 'SPY', difficulty: 'beginner', focusArea: 'level', adaptive: true });
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded hover:border-[var(--accent-primary)]/50 text-[var(--text-secondary)]"
            >
              <Target className="w-3 h-3" /> Level Focus
            </button>
            <button
              onClick={() => {
                setParams({ symbol: 'NVDA', difficulty: 'intermediate', focusArea: 'trend', adaptive: true });
                onGenerateScenario({ symbol: 'NVDA', difficulty: 'intermediate', focusArea: 'trend', adaptive: true });
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded hover:border-[var(--accent-primary)]/50 text-[var(--text-secondary)]"
            >
              <TrendingUp className="w-3 h-3" /> Trend Analysis
            </button>
            <button
              onClick={() => {
                setParams({ symbol: 'TSLA', difficulty: 'advanced', focusArea: 'patience', adaptive: true });
                onGenerateScenario({ symbol: 'TSLA', difficulty: 'advanced', focusArea: 'patience', adaptive: true });
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded hover:border-[var(--accent-primary)]/50 text-[var(--text-secondary)]"
            >
              <Zap className="w-3 h-3" /> Patience Challenge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="relative">
          <Wand2 className="w-16 h-16 text-[var(--accent-primary)]" />
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-6 h-6 text-[var(--warning)] animate-pulse" />
          </div>
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)] mt-4" />
        <p className="text-[var(--text-primary)] font-semibold mt-4">
          Generating Custom Scenario...
        </p>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">
          AI is crafting a unique trading scenario for you
        </p>
      </div>
    );
  }

  // Scenario display
  if (!scenario) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Scenario Header */}
      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[var(--accent-primary)]/10 rounded">
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <span className="text-xs text-[var(--accent-primary)]">AI Generated</span>
            <h3 className="font-semibold text-[var(--text-primary)]">{scenario.title}</h3>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={isGenerating}
          icon={<RefreshCw className="w-4 h-4" />}
        >
          New Scenario
        </Button>
      </div>

      {/* Scenario Description */}
      <p className="text-sm text-[var(--text-secondary)] px-1">{scenario.description}</p>

      {/* Chart */}
      {scenario.chartData?.candles?.length > 0 && (
        <PracticeChart
          visibleCandles={scenario.chartData.candles.map(c => ({
            time: c.t,
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
            volume: c.v,
          }))}
          levels={scenario.keyLevels || []}
          decisionPointIndex={undefined}
          outcomeData={result ? scenario.outcomeData : undefined}
          symbol={scenario.symbol}
          timeframe={scenario.chartTimeframe || '5m'}
          showOutcome={!!result}
          isReplayMode={false}
          className="h-[400px]"
        />
      )}

      {/* LTP Analysis Preview (if available) */}
      {scenario.ltpAnalysis && !result && (
        <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--bg-tertiary)] rounded">
          <div className="text-center">
            <Target className="w-5 h-5 mx-auto text-[var(--accent-primary)] mb-1" />
            <span className="text-xs text-[var(--text-tertiary)]">Level</span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {scenario.ltpAnalysis.level.score}%
            </p>
          </div>
          <div className="text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-[var(--accent-primary)] mb-1" />
            <span className="text-xs text-[var(--text-tertiary)]">Trend</span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {scenario.ltpAnalysis.trend.score}%
            </p>
          </div>
          <div className="text-center">
            <Zap className="w-5 h-5 mx-auto text-[var(--accent-primary)] mb-1" />
            <span className="text-xs text-[var(--text-tertiary)]">Patience</span>
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {scenario.ltpAnalysis.patience.score}%
            </p>
          </div>
        </div>
      )}

      {/* Decision Buttons or Result */}
      {result ? (
        <div
          className={cn(
            'p-4 rounded-lg',
            result.isCorrect
              ? 'bg-[var(--profit)]/10 border border-[var(--profit)]'
              : 'bg-[var(--loss)]/10 border border-[var(--loss)]'
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {result.isCorrect ? (
                <CheckCircle className="w-8 h-8 text-[var(--profit)]" />
              ) : (
                <XCircle className="w-8 h-8 text-[var(--loss)]" />
              )}
              <div>
                <span
                  className={cn(
                    'text-lg font-bold',
                    result.isCorrect ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                  )}
                >
                  {result.isCorrect ? 'Excellent!' : 'Good Try!'}
                </span>
                <p className="text-sm text-[var(--text-secondary)]">
                  Correct action:{' '}
                  <span className="uppercase font-semibold">{result.correctAction}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={isGenerating}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Generate New
              </Button>
            </div>
          </div>

          {/* Explanation */}
          {scenario.explanation && (
            <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded">
              <p className="text-sm text-[var(--text-secondary)]">{scenario.explanation}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {scenario.decisionPoint?.context && (
            <div className="p-3 bg-[var(--bg-tertiary)] rounded">
              <p className="text-sm text-[var(--text-secondary)]">
                <Brain className="w-4 h-4 inline mr-2 text-[var(--accent-primary)]" />
                {scenario.decisionPoint.context}
              </p>
            </div>
          )}

          <p className="text-center text-[var(--text-secondary)]">
            Based on the LTP framework, what is the best action?
          </p>

          <div className="grid grid-cols-3 gap-4">
            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-6 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)]"
              onClick={() => onDecisionSubmit('long')}
              disabled={isSubmitting}
            >
              <TrendingUp className="w-8 h-8 mb-2 text-[var(--profit)]" />
              <span className="text-lg font-bold">LONG</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-6 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)]"
              onClick={() => onDecisionSubmit('wait')}
              disabled={isSubmitting}
            >
              <Pause className="w-8 h-8 mb-2 text-[var(--warning)]" />
              <span className="text-lg font-bold">WAIT</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-6 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)]"
              onClick={() => onDecisionSubmit('short')}
              disabled={isSubmitting}
            >
              <TrendingDown className="w-8 h-8 mb-2 text-[var(--loss)]" />
              <span className="text-lg font-bold">SHORT</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIGeneratedEngine;
