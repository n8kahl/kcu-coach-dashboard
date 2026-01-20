'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PracticeChart } from '../practice-chart';
import { Button } from '@/components/ui/button';
import {
  Timer,
  TrendingUp,
  TrendingDown,
  Pause,
  ChevronRight,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Flame,
} from 'lucide-react';
import type { EngineProps, SessionStats } from './types';

interface QuickDrillEngineProps extends EngineProps {
  timeLimit?: number; // seconds, default 30
  sessionStats: SessionStats;
  onTimeout?: () => void;
}

export function QuickDrillEngine({
  scenario,
  onDecisionSubmit,
  isSubmitting,
  result,
  onNextScenario,
  timeLimit = 30,
  sessionStats,
  onTimeout,
}: QuickDrillEngineProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(timeLimit);
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Start timer when scenario loads
  useEffect(() => {
    if (scenario && !result) {
      setTimeRemaining(timeLimit);
      setIsActive(true);
      startTimeRef.current = Date.now();
    } else {
      setIsActive(false);
    }
  }, [scenario?.id, result, timeLimit]);

  // Timer countdown
  useEffect(() => {
    if (isActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Auto-submit "wait" on timeout
            onDecisionSubmit('wait');
            onTimeout?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, onDecisionSubmit, onTimeout]);

  // Stop timer on result
  useEffect(() => {
    if (result) {
      setIsActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }, [result]);

  const handleDecision = useCallback(
    async (decision: 'long' | 'short' | 'wait') => {
      setIsActive(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      await onDecisionSubmit(decision);
    },
    [onDecisionSubmit]
  );

  if (!scenario) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Zap className="w-16 h-16 text-[var(--warning)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Quick Drill Mode
        </h3>
        <p className="text-[var(--text-tertiary)] text-center max-w-md">
          Make rapid trading decisions in {timeLimit} seconds or less. Train your
          instincts and pattern recognition.
        </p>
      </div>
    );
  }

  // Calculate timer color based on remaining time
  const getTimerColor = () => {
    if (timeRemaining <= 5) return 'text-[var(--error)] bg-[var(--error)]/20';
    if (timeRemaining <= 10) return 'text-[var(--warning)] bg-[var(--warning)]/20';
    return 'text-[var(--text-primary)] bg-[var(--bg-tertiary)]';
  };

  // Timer progress percentage
  const timerProgress = (timeRemaining / timeLimit) * 100;

  return (
    <div className="space-y-4">
      {/* Timer Bar */}
      <div className="relative">
        <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear',
              timeRemaining <= 5
                ? 'bg-[var(--error)]'
                : timeRemaining <= 10
                  ? 'bg-[var(--warning)]'
                  : 'bg-[var(--accent-primary)]'
            )}
            style={{ width: `${timerProgress}%` }}
          />
        </div>

        {/* Timer Display */}
        <div className="absolute -top-1 right-0 transform translate-y-[-100%]">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded font-mono text-lg font-bold',
              getTimerColor()
            )}
          >
            <Timer className="w-5 h-5" />
            <span>{timeRemaining}s</span>
          </div>
        </div>
      </div>

      {/* Session Stats Mini Bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-[var(--bg-tertiary)] rounded text-sm">
        <span className="text-[var(--text-tertiary)]">Session:</span>
        <span className="font-mono text-[var(--text-primary)]">
          {sessionStats.correct}/{sessionStats.attempted}
        </span>
        {sessionStats.currentStreak >= 3 && (
          <span className="flex items-center gap-1 text-[var(--warning)]">
            <Flame className="w-4 h-4" />
            {sessionStats.currentStreak} streak
          </span>
        )}
      </div>

      {/* Chart - Compact view for quick decisions */}
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
          symbol={scenario.symbol}
          timeframe={scenario.chartTimeframe || '5m'}
          showOutcome={!!result}
          isReplayMode={false}
          className="h-[350px]"
        />
      )}

      {/* Scenario Context - Brief */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg-tertiary)] rounded">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--text-primary)]">
            {scenario.symbol}
          </span>
          <span className="text-[var(--text-tertiary)]">-</span>
          <span className="text-[var(--text-secondary)]">{scenario.scenarioType}</span>
        </div>
        {timeRemaining <= 10 && !result && (
          <span className="flex items-center gap-1 text-[var(--warning)] text-sm animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            Time running out!
          </span>
        )}
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
                  {result.isCorrect ? 'Correct!' : 'Wrong'}
                </span>
                <p className="text-sm text-[var(--text-secondary)]">
                  Answer: <span className="uppercase font-semibold">{result.correctAction}</span>
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={onNextScenario}
              icon={<ChevronRight className="w-5 h-5" />}
            >
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-col py-4 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)] transition-all"
            onClick={() => handleDecision('long')}
            disabled={isSubmitting}
          >
            <TrendingUp className="w-6 h-6 mb-1 text-[var(--profit)]" />
            <span className="text-base font-bold">LONG</span>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="flex-col py-4 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)] transition-all"
            onClick={() => handleDecision('wait')}
            disabled={isSubmitting}
          >
            <Pause className="w-6 h-6 mb-1 text-[var(--warning)]" />
            <span className="text-base font-bold">WAIT</span>
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="flex-col py-4 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)] transition-all"
            onClick={() => handleDecision('short')}
            disabled={isSubmitting}
          >
            <TrendingDown className="w-6 h-6 mb-1 text-[var(--loss)]" />
            <span className="text-base font-bold">SHORT</span>
          </Button>
        </div>
      )}

      {/* Quick drill tips */}
      {!result && (
        <p className="text-center text-xs text-[var(--text-tertiary)]">
          Trust your instincts. Quick pattern recognition is key to day trading success.
        </p>
      )}
    </div>
  );
}

export default QuickDrillEngine;
