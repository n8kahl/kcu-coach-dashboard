'use client';

/**
 * Practice Game Loop - Step-by-Step Wizard Overlay
 *
 * Guides users through the trading practice flow:
 * 1. ANALYZE - Draw lines, check LTP Score
 * 2. COMMIT - Select Long/Short/Wait
 * 3. EXECUTE - Watch trade fill animation
 * 4. REVIEW - See KCU Grade immediately
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Target,
  Play,
  Eye,
  CheckCircle,
  Pause,
  Loader2,
} from 'lucide-react';

export type GameLoopPhase = 'analyze' | 'commit' | 'execute' | 'review';

interface PracticeGameLoopProps {
  phase: GameLoopPhase;
  onPhaseChange?: (phase: GameLoopPhase) => void;

  // Analyze phase
  ltpScore?: { level: number; trend: number; patience: number };
  onAnalyzeComplete?: () => void;

  // Commit phase
  onCommitLong?: () => void;
  onCommitShort?: () => void;
  onCommitWait?: () => void;
  isCommitting?: boolean;
  selectedDirection?: 'long' | 'short' | 'wait' | null;

  // Execute phase
  tradeStatus?: 'pending' | 'active' | 'won' | 'lost' | 'breakeven';
  currentPnl?: number;
  isPlaying?: boolean;
  onPauseResume?: () => void;

  // Review phase
  grade?: string;
  score?: number;
  isCorrect?: boolean;
  onNextScenario?: () => void;
  onReviewDetails?: () => void;

  className?: string;
}

const PHASE_CONFIG = {
  analyze: {
    number: 1,
    label: 'ANALYZE',
    description: 'Check LTP confluence',
    icon: Eye,
    color: 'var(--accent-primary)',
  },
  commit: {
    number: 2,
    label: 'COMMIT',
    description: 'Make your call',
    icon: Target,
    color: 'var(--warning)',
  },
  execute: {
    number: 3,
    label: 'EXECUTE',
    description: 'Watch it play out',
    icon: Play,
    color: 'var(--success)',
  },
  review: {
    number: 4,
    label: 'REVIEW',
    description: 'Learn from the result',
    icon: CheckCircle,
    color: 'var(--info)',
  },
};

export function PracticeGameLoop({
  phase,
  onPhaseChange,
  ltpScore,
  onAnalyzeComplete,
  onCommitLong,
  onCommitShort,
  onCommitWait,
  isCommitting,
  selectedDirection,
  tradeStatus,
  currentPnl,
  isPlaying,
  onPauseResume,
  grade,
  score,
  isCorrect,
  onNextScenario,
  onReviewDetails,
  className,
}: PracticeGameLoopProps) {
  const phases: GameLoopPhase[] = ['analyze', 'commit', 'execute', 'review'];
  const currentPhaseIndex = phases.indexOf(phase);

  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d]/95 backdrop-blur border-t border-[var(--border-primary)]',
      className
    )}>
      {/* Phase Progress Bar */}
      <div className="flex items-center justify-center gap-1 py-2 px-4 border-b border-[var(--border-primary)]">
        {phases.map((p, index) => {
          const config = PHASE_CONFIG[p];
          const isActive = p === phase;
          const isComplete = index < currentPhaseIndex;

          return (
            <div key={p} className="flex items-center">
              {/* Step Indicator */}
              <div
                className={cn(
                  'flex items-center gap-2 px-3 py-1 rounded transition-all',
                  isActive && 'bg-[var(--bg-tertiary)]',
                )}
              >
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                    isComplete && 'bg-[var(--success)] text-black',
                    isActive && 'ring-2 ring-offset-1 ring-offset-[#0d0d0d]',
                  )}
                  style={{
                    backgroundColor: isActive ? config.color : isComplete ? undefined : 'var(--bg-tertiary)',
                    color: isActive ? 'black' : isComplete ? undefined : 'var(--text-tertiary)',
                    // Ring color applied via inline CSS custom property
                    ['--tw-ring-color' as string]: isActive ? config.color : undefined,
                  }}
                >
                  {isComplete ? <CheckCircle className="w-3 h-3" /> : config.number}
                </div>
                <div className="text-left">
                  <div
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'
                    )}
                    style={{ color: isActive ? config.color : undefined }}
                  >
                    {config.label}
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < phases.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    index < currentPhaseIndex ? 'bg-[var(--success)]' : 'bg-[var(--border-primary)]'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase Content */}
      <div className="p-4">
        {/* ANALYZE Phase */}
        {phase === 'analyze' && (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Check the chart for Level, Trend, and Patience confluence before committing.
              </p>
              {ltpScore && (
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-[var(--accent-primary)]">L: {ltpScore.level}%</span>
                  <span className="text-[var(--success)]">T: {ltpScore.trend}%</span>
                  <span className="text-[var(--warning)]">P: {ltpScore.patience}%</span>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              onClick={onAnalyzeComplete}
              className="animate-pulse"
            >
              Ready to Commit
              <Target className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* COMMIT Phase */}
        {phase === 'commit' && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="lg"
              onClick={onCommitLong}
              disabled={isCommitting}
              className={cn(
                'flex-col py-4 px-8 min-w-[120px] transition-all',
                'hover:bg-[var(--success)]/20 hover:border-[var(--success)]',
                selectedDirection === 'long' && 'bg-[var(--success)]/20 border-[var(--success)]',
                !selectedDirection && 'animate-pulse'
              )}
            >
              <TrendingUp className={cn(
                'w-6 h-6 mb-1',
                selectedDirection === 'long' ? 'text-[var(--success)]' : 'text-[var(--success)]'
              )} />
              <span className="font-bold">LONG</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={onCommitWait}
              disabled={isCommitting}
              className={cn(
                'flex-col py-4 px-8 min-w-[120px] transition-all',
                'hover:bg-[var(--warning)]/20 hover:border-[var(--warning)]',
                selectedDirection === 'wait' && 'bg-[var(--warning)]/20 border-[var(--warning)]'
              )}
            >
              <Pause className={cn(
                'w-6 h-6 mb-1',
                selectedDirection === 'wait' ? 'text-[var(--warning)]' : 'text-[var(--warning)]'
              )} />
              <span className="font-bold">WAIT</span>
            </Button>

            <Button
              variant="secondary"
              size="lg"
              onClick={onCommitShort}
              disabled={isCommitting}
              className={cn(
                'flex-col py-4 px-8 min-w-[120px] transition-all',
                'hover:bg-[var(--error)]/20 hover:border-[var(--error)]',
                selectedDirection === 'short' && 'bg-[var(--error)]/20 border-[var(--error)]',
                !selectedDirection && 'animate-pulse'
              )}
            >
              <TrendingDown className={cn(
                'w-6 h-6 mb-1',
                selectedDirection === 'short' ? 'text-[var(--error)]' : 'text-[var(--error)]'
              )} />
              <span className="font-bold">SHORT</span>
            </Button>

            {isCommitting && (
              <div className="absolute inset-0 bg-[#0d0d0d]/80 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
              </div>
            )}
          </div>
        )}

        {/* EXECUTE Phase */}
        {phase === 'execute' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-tertiary)]">Status:</span>
                <span className={cn(
                  'px-2 py-0.5 text-xs font-bold uppercase rounded',
                  tradeStatus === 'active' && 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
                  tradeStatus === 'won' && 'bg-[var(--success)]/20 text-[var(--success)]',
                  tradeStatus === 'lost' && 'bg-[var(--error)]/20 text-[var(--error)]',
                  tradeStatus === 'breakeven' && 'bg-[var(--warning)]/20 text-[var(--warning)]',
                )}>
                  {tradeStatus || 'PENDING'}
                </span>
              </div>
              {currentPnl !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">P&L:</span>
                  <span className={cn(
                    'font-mono font-bold',
                    currentPnl >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'
                  )}>
                    {currentPnl >= 0 ? '+' : ''}{currentPnl.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {tradeStatus === 'active' && onPauseResume && (
                <Button variant="secondary" size="sm" onClick={onPauseResume}>
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isPlaying ? 'Pause' : 'Resume'}
                </Button>
              )}
              <span className="text-xs text-[var(--text-tertiary)]">
                Watching trade unfold...
              </span>
            </div>
          </div>
        )}

        {/* REVIEW Phase */}
        {phase === 'review' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Grade Display */}
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center font-black text-xl',
                  isCorrect
                    ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/50'
                    : 'bg-[var(--error)]/20 text-[var(--error)] border border-[var(--error)]/50'
                )}>
                  {grade || (isCorrect ? 'W' : 'L')}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </div>
                  {score !== undefined && (
                    <div className="text-xs text-[var(--text-secondary)]">
                      Score: {score}/100
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onReviewDetails}>
                See Details
              </Button>
              <Button variant="primary" onClick={onNextScenario}>
                Next Scenario
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PracticeGameLoop;
