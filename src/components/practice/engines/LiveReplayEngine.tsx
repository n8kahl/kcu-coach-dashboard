'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PracticeChart } from '../practice-chart';
import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  FastForward,
  Rewind,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Target,
} from 'lucide-react';
import type { EngineProps } from './types';

interface LiveReplayEngineProps extends EngineProps {
  playbackSpeed?: number;
}

export function LiveReplayEngine({
  scenario,
  onDecisionSubmit,
  isSubmitting,
  result,
  onNextScenario,
  onBack,
}: LiveReplayEngineProps) {
  // Replay state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showDecisionPoint, setShowDecisionPoint] = useState(false);
  const [decisionReached, setDecisionReached] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate decision point index (typically 70-80% through the data)
  const totalCandles = scenario?.chartData?.candles?.length || 0;
  const decisionPointIndex = Math.floor(totalCandles * 0.75);
  const outcomeStartIndex = decisionPointIndex;

  // Reset on scenario change
  useEffect(() => {
    if (scenario && !result) {
      setCurrentIndex(0);
      setIsPlaying(false);
      setDecisionReached(false);
      setShowOutcome(false);
      setShowDecisionPoint(false);
    }
  }, [scenario?.id, result]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && currentIndex < totalCandles - 1) {
      const baseInterval = 500; // 500ms per candle at 1x speed
      const interval = baseInterval / playbackSpeed;

      playIntervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;

          // Check if we reached decision point
          if (next >= decisionPointIndex && !decisionReached) {
            setDecisionReached(true);
            setIsPlaying(false);
            setShowDecisionPoint(true);
            return decisionPointIndex;
          }

          // Stop at end
          if (next >= totalCandles - 1) {
            setIsPlaying(false);
            return totalCandles - 1;
          }

          return next;
        });
      }, interval);
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, currentIndex, totalCandles, playbackSpeed, decisionReached, decisionPointIndex]);

  // Control functions
  const togglePlayPause = useCallback(() => {
    if (decisionReached && !result && !showOutcome) {
      // Don't allow resuming until decision is made
      return;
    }
    setIsPlaying((prev) => !prev);
  }, [decisionReached, result, showOutcome]);

  const stepForward = useCallback(() => {
    if (currentIndex < totalCandles - 1) {
      const next = currentIndex + 1;
      if (next >= decisionPointIndex && !decisionReached) {
        setDecisionReached(true);
        setShowDecisionPoint(true);
        setCurrentIndex(decisionPointIndex);
      } else {
        setCurrentIndex(next);
      }
    }
  }, [currentIndex, totalCandles, decisionPointIndex, decisionReached]);

  const stepBackward = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const jumpToStart = useCallback(() => {
    setCurrentIndex(0);
    setDecisionReached(false);
    setShowDecisionPoint(false);
    setShowOutcome(false);
    setIsPlaying(false);
  }, []);

  const jumpToDecision = useCallback(() => {
    setCurrentIndex(decisionPointIndex);
    setDecisionReached(true);
    setShowDecisionPoint(true);
    setIsPlaying(false);
  }, [decisionPointIndex]);

  const handleShowOutcome = useCallback(() => {
    setShowOutcome(true);
    setShowDecisionPoint(false);
    setCurrentIndex(totalCandles - 1);
  }, [totalCandles]);

  const handleDecision = useCallback(
    async (decision: 'long' | 'short' | 'wait') => {
      await onDecisionSubmit(decision);
    },
    [onDecisionSubmit]
  );

  // Speed options
  const speedOptions = [0.5, 1, 2, 4];

  if (!scenario) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Play className="w-16 h-16 text-[var(--info)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Live Replay Mode
        </h3>
        <p className="text-[var(--text-tertiary)] text-center max-w-md">
          Watch price action unfold candle by candle, just like you would in real
          trading. Make your decision at the critical moment.
        </p>
      </div>
    );
  }

  // Get visible candles (up to current index)
  const visibleCandles = scenario.chartData?.candles?.slice(0, currentIndex + 1) || [];
  const progress = totalCandles > 0 ? ((currentIndex + 1) / totalCandles) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Replay Controls */}
      <div className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
        <div className="flex items-center gap-2">
          {/* Main controls */}
          <Button
            variant="ghost"
            size="sm"
            onClick={jumpToStart}
            disabled={currentIndex === 0}
          >
            <Rewind className="w-4 h-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={stepBackward} disabled={currentIndex === 0}>
            <SkipBack className="w-4 h-4" />
          </Button>

          <Button
            variant={isPlaying ? 'secondary' : 'primary'}
            size="sm"
            onClick={togglePlayPause}
            disabled={decisionReached && !result && !showOutcome}
            className="w-24"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 mr-1" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-1" /> Play
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={stepForward}
            disabled={currentIndex >= totalCandles - 1 || (decisionReached && !result && !showOutcome)}
          >
            <SkipForward className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={jumpToDecision}
            disabled={decisionReached}
          >
            <Target className="w-4 h-4" />
          </Button>
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">Speed:</span>
          {speedOptions.map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaybackSpeed(speed)}
              className={cn(
                'px-2 py-1 text-xs rounded',
                playbackSpeed === speed
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              )}
            >
              {speed}x
            </button>
          ))}
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className="text-xs text-[var(--text-tertiary)]">
            {currentIndex + 1}/{totalCandles}
          </span>
          <div className="flex-1 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all',
                decisionReached ? 'bg-[var(--warning)]' : 'bg-[var(--accent-primary)]'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Chart with visible candles */}
      {visibleCandles.length > 0 && (
        <PracticeChart
          chartData={{
            ...scenario.chartData,
            candles: showOutcome ? scenario.chartData.candles : visibleCandles,
          }}
          keyLevels={scenario.keyLevels || []}
          decisionPoint={decisionReached ? scenario.decisionPoint : undefined}
          outcomeData={showOutcome ? scenario.outcomeData : undefined}
          symbol={scenario.symbol}
          timeframe={scenario.chartTimeframe || '5m'}
          showOutcome={showOutcome}
          replayMode={true}
          initialCandleCount={currentIndex + 1}
          className="h-[400px]"
        />
      )}

      {/* Decision Point Alert */}
      {showDecisionPoint && !result && (
        <div className="p-4 bg-[var(--warning)]/10 border border-[var(--warning)] rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-[var(--warning)]/20 rounded-full">
              <Target className="w-6 h-6 text-[var(--warning)]" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)]">Decision Point Reached</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {scenario.decisionPoint?.context || 'What action would you take here?'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-4 hover:bg-[var(--profit)]/20 hover:border-[var(--profit)]"
              onClick={() => handleDecision('long')}
              disabled={isSubmitting}
            >
              <TrendingUp className="w-6 h-6 mb-1 text-[var(--profit)]" />
              <span className="font-bold">LONG</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-4 hover:bg-[var(--warning)]/20 hover:border-[var(--warning)]"
              onClick={() => handleDecision('wait')}
              disabled={isSubmitting}
            >
              <Pause className="w-6 h-6 mb-1 text-[var(--warning)]" />
              <span className="font-bold">WAIT</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="flex-col py-4 hover:bg-[var(--loss)]/20 hover:border-[var(--loss)]"
              onClick={() => handleDecision('short')}
              disabled={isSubmitting}
            >
              <TrendingDown className="w-6 h-6 mb-1 text-[var(--loss)]" />
              <span className="font-bold">SHORT</span>
            </Button>
          </div>
        </div>
      )}

      {/* Result Display */}
      {result && (
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
              {!showOutcome && (
                <Button
                  variant="secondary"
                  onClick={handleShowOutcome}
                  icon={<Eye className="w-4 h-4" />}
                >
                  See Outcome
                </Button>
              )}
              <Button variant="primary" onClick={onNextScenario}>
                Next Scenario
              </Button>
            </div>
          </div>

          {/* Show feedback */}
          {typeof result.feedback === 'string' && (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">{result.feedback}</p>
          )}
        </div>
      )}

      {/* Instructions */}
      {!decisionReached && !result && (
        <div className="text-center">
          <p className="text-sm text-[var(--text-tertiary)]">
            Watch the price action unfold. Press play to start the replay.
          </p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">
            You'll be asked to make a decision at a critical point.
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveReplayEngine;
