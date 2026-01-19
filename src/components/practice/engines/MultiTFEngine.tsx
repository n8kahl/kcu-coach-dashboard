'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChartGrid } from '../ChartGrid';
import { PracticeChart } from '../practice-chart';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid,
  Maximize2,
  Minimize2,
  TrendingUp,
  TrendingDown,
  Pause,
  CheckCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { EngineProps } from './types';

interface MultiTFEngineProps extends EngineProps {
  showSingleChart?: boolean;
}

export function MultiTFEngine({
  scenario,
  onDecisionSubmit,
  isSubmitting,
  result,
  onNextScenario,
  onBack,
}: MultiTFEngineProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [activeTimeframe, setActiveTimeframe] = useState<string>('5m');
  const [expandedChart, setExpandedChart] = useState<string | null>(null);

  if (!scenario) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <LayoutGrid className="w-16 h-16 text-[var(--text-tertiary)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Multi-Timeframe Mode
        </h3>
        <p className="text-[var(--text-tertiary)] text-center max-w-md">
          Analyze scenarios across multiple timeframes simultaneously. See the
          daily, hourly, 15m, 5m, and 2m charts together.
        </p>
      </div>
    );
  }

  // Aggregate candles to different timeframes
  const candles = scenario.chartData?.candles || [];

  // For demo/prototype, we'll show the same data but could be expanded
  // In production, you'd want multi-timeframe data from the API
  const aggregateToTimeframe = (bars: typeof candles, targetMinutes: number) => {
    if (bars.length === 0) return [];
    const targetMs = targetMinutes * 60 * 1000;
    const aggregated: typeof candles = [];
    let currentBar: (typeof candles)[0] | null = null;
    let currentPeriodStart = 0;

    for (const bar of bars) {
      const periodStart = Math.floor(bar.t / targetMs) * targetMs;

      if (currentBar === null || periodStart > currentPeriodStart) {
        if (currentBar) aggregated.push(currentBar);
        currentBar = { ...bar, t: periodStart };
        currentPeriodStart = periodStart;
      } else if (currentBar) {
        currentBar = {
          t: currentBar.t,
          o: currentBar.o,
          h: Math.max(currentBar.h, bar.h),
          l: Math.min(currentBar.l, bar.l),
          c: bar.c,
          v: currentBar.v + bar.v,
        };
      }
    }
    if (currentBar) aggregated.push(currentBar);
    return aggregated;
  };

  // Create multi-timeframe data
  const twoMinBars = candles;
  const fiveMinBars = aggregateToTimeframe(candles, 5);
  const fifteenMinBars = aggregateToTimeframe(candles, 15);
  const hourlyBars = aggregateToTimeframe(candles, 60);
  const dailyBars = aggregateToTimeframe(candles, 1440);

  // Timeframe labels
  const timeframes = [
    { id: 'daily', label: 'Daily', bars: dailyBars },
    { id: 'hourly', label: '1H', bars: hourlyBars },
    { id: '15m', label: '15m', bars: fifteenMinBars },
    { id: '5m', label: '5m', bars: fiveMinBars },
    { id: '2m', label: '2m', bars: twoMinBars },
  ];

  const activeData = timeframes.find((tf) => tf.id === activeTimeframe)?.bars || fiveMinBars;

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border transition-colors rounded',
              viewMode === 'grid'
                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
            )}
          >
            <LayoutGrid className="w-4 h-4" />
            5-Chart Grid
          </button>
          <button
            onClick={() => setViewMode('single')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm border transition-colors rounded',
              viewMode === 'single'
                ? 'bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'bg-transparent border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
            )}
          >
            <Maximize2 className="w-4 h-4" />
            Single Chart
          </button>
        </div>

        {viewMode === 'single' && (
          <div className="flex items-center gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf.id}
                onClick={() => setActiveTimeframe(tf.id)}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  activeTimeframe === tf.id
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts */}
      {viewMode === 'grid' ? (
        <ChartGrid
          symbol={scenario.symbol}
          dailyBars={dailyBars}
          hourlyBars={hourlyBars}
          fifteenMinBars={fifteenMinBars}
          fiveMinBars={fiveMinBars}
          twoMinBars={twoMinBars}
          keyLevels={scenario.keyLevels || []}
          decisionPoint={scenario.decisionPoint}
          showOutcome={!!result}
        />
      ) : (
        <PracticeChart
          chartData={{ ...scenario.chartData, candles: activeData }}
          keyLevels={scenario.keyLevels || []}
          decisionPoint={scenario.decisionPoint}
          outcomeData={result ? scenario.outcomeData : undefined}
          symbol={scenario.symbol}
          timeframe={activeTimeframe}
          showOutcome={!!result}
          replayMode={false}
          className="h-[450px]"
        />
      )}

      {/* MTF Analysis Summary */}
      <div className="grid grid-cols-5 gap-2 p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
        {timeframes.map((tf) => {
          // Simple trend detection based on EMA approximation
          const bars = tf.bars;
          if (bars.length < 2) {
            return (
              <div key={tf.id} className="text-center">
                <span className="text-xs text-[var(--text-tertiary)]">{tf.label}</span>
                <p className="text-sm text-[var(--text-secondary)]">-</p>
              </div>
            );
          }

          const recent = bars.slice(-10);
          const avgClose = recent.reduce((s, b) => s + b.c, 0) / recent.length;
          const lastClose = bars[bars.length - 1].c;
          const trend =
            lastClose > avgClose * 1.002
              ? 'bullish'
              : lastClose < avgClose * 0.998
                ? 'bearish'
                : 'neutral';

          return (
            <div key={tf.id} className="text-center">
              <span className="text-xs text-[var(--text-tertiary)]">{tf.label}</span>
              <p
                className={cn(
                  'text-sm font-semibold capitalize',
                  trend === 'bullish'
                    ? 'text-[var(--profit)]'
                    : trend === 'bearish'
                      ? 'text-[var(--loss)]'
                      : 'text-[var(--text-secondary)]'
                )}
              >
                {trend === 'bullish' ? (
                  <TrendingUp className="w-4 h-4 inline" />
                ) : trend === 'bearish' ? (
                  <TrendingDown className="w-4 h-4 inline" />
                ) : (
                  '-'
                )}
              </p>
            </div>
          );
        })}
      </div>

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
                  {result.isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
                <p className="text-sm text-[var(--text-secondary)]">
                  Correct action:{' '}
                  <span className="uppercase font-semibold">{result.correctAction}</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onBack}>
                Try Another
              </Button>
              <Button
                variant="primary"
                onClick={onNextScenario}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>

          {typeof result.feedback === 'string' && (
            <p className="mt-3 text-sm text-[var(--text-secondary)]">{result.feedback}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-[var(--text-secondary)]">
            Analyze all timeframes. Are they aligned? What's your decision?
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
              <span className="text-xs text-[var(--text-tertiary)]">Bullish alignment</span>
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
              <span className="text-xs text-[var(--text-tertiary)]">Mixed signals</span>
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
              <span className="text-xs text-[var(--text-tertiary)]">Bearish alignment</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiTFEngine;
