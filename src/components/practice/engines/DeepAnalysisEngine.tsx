'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { PracticeChart } from '../practice-chart';
import { ContextPanel } from '../ContextPanel';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Pause,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import type { EngineProps, LTPChecklist } from './types';

interface DeepAnalysisEngineProps extends EngineProps {
  onLTPChecklistChange?: (checklist: LTPChecklist) => void;
}

export function DeepAnalysisEngine({
  scenario,
  onDecisionSubmit,
  isSubmitting,
  result,
  onNextScenario,
  onBack,
  onLTPChecklistChange,
}: DeepAnalysisEngineProps) {
  const [ltpChecklist, setLtpChecklist] = useState<LTPChecklist>({
    levelScore: 50,
    trendScore: 50,
    patienceScore: 50,
    notes: '',
  });
  const [showFeedbackDetails, setShowFeedbackDetails] = useState(false);
  const [showContext, setShowContext] = useState(true);

  // Notify parent of checklist changes
  useEffect(() => {
    onLTPChecklistChange?.(ltpChecklist);
  }, [ltpChecklist, onLTPChecklistChange]);

  // Reset checklist on new scenario
  useEffect(() => {
    if (scenario && !result) {
      setLtpChecklist({
        levelScore: 50,
        trendScore: 50,
        patienceScore: 50,
        notes: '',
      });
      setShowFeedbackDetails(false);
    }
  }, [scenario?.id, result]);

  if (!scenario) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Brain className="w-16 h-16 text-[var(--success)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Deep Analysis Mode
        </h3>
        <p className="text-[var(--text-tertiary)] text-center max-w-md">
          Take your time to thoroughly analyze each scenario. Use the LTP checklist
          to structure your thinking and get detailed AI coaching feedback.
        </p>
      </div>
    );
  }

  // Calculate overall confluence score
  const confluenceScore = Math.round(
    (ltpChecklist.levelScore * 0.35) +
    (ltpChecklist.trendScore * 0.40) +
    (ltpChecklist.patienceScore * 0.25)
  );

  // Get grade based on score
  const getGrade = (score: number) => {
    if (score >= 90) return { grade: 'A+', color: 'text-[var(--profit)]' };
    if (score >= 80) return { grade: 'A', color: 'text-[var(--profit)]' };
    if (score >= 70) return { grade: 'B', color: 'text-[var(--success)]' };
    if (score >= 60) return { grade: 'C', color: 'text-[var(--warning)]' };
    if (score >= 50) return { grade: 'D', color: 'text-[var(--warning)]' };
    return { grade: 'F', color: 'text-[var(--error)]' };
  };

  const gradeInfo = getGrade(confluenceScore);

  // Render feedback if available
  const renderFeedback = () => {
    if (!result) return null;

    const feedback = result.feedback;
    if (typeof feedback === 'string') {
      return <p className="text-sm text-[var(--text-secondary)]">{feedback}</p>;
    }

    // Handle structured feedback
    const f = feedback as {
      summary?: string;
      detailedFeedback?: string;
      whatYouMissed?: string;
      ltpBreakdown?: { level?: string; trend?: string; patience?: string };
      encouragement?: string;
      nextSteps?: string[];
      personalizedTip?: string;
    };

    return (
      <div className="space-y-4">
        {f.summary && (
          <p className="text-[var(--text-primary)] font-medium">{f.summary}</p>
        )}

        {f.detailedFeedback && (
          <p className="text-sm text-[var(--text-secondary)]">{f.detailedFeedback}</p>
        )}

        {f.whatYouMissed && (
          <div className="p-3 bg-[var(--error)]/10 border border-[var(--error)]/30 rounded">
            <p className="text-sm text-[var(--error)]">
              <strong>What you missed:</strong> {f.whatYouMissed}
            </p>
          </div>
        )}

        {f.ltpBreakdown && (
          <>
            <button
              className="flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:underline"
              onClick={() => setShowFeedbackDetails(!showFeedbackDetails)}
            >
              {showFeedbackDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              {showFeedbackDetails ? 'Hide' : 'Show'} LTP Breakdown
            </button>

            {showFeedbackDetails && (
              <div className="grid grid-cols-1 gap-3 p-4 bg-[var(--bg-tertiary)] rounded">
                {f.ltpBreakdown.level && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                        Level
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {f.ltpBreakdown.level}
                    </p>
                  </div>
                )}
                {f.ltpBreakdown.trend && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                        Trend
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {f.ltpBreakdown.trend}
                    </p>
                  </div>
                )}
                {f.ltpBreakdown.patience && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                      <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                        Patience
                      </span>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {f.ltpBreakdown.patience}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {f.encouragement && (
          <p className="text-sm text-[var(--accent-primary)] italic">
            {f.encouragement}
          </p>
        )}

        {f.nextSteps && f.nextSteps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-2">
              Next Steps
            </p>
            <ul className="space-y-1">
              {f.nextSteps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"
                >
                  <ArrowRight className="w-3 h-3 text-[var(--accent-primary)]" />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {f.personalizedTip && (
          <div className="p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-xs font-semibold text-[var(--accent-primary)] uppercase">
                Personalized Tip
              </span>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              {f.personalizedTip}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Chart Area */}
      <div className="lg:col-span-2 space-y-4">
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
            className="h-[450px]"
          />
        )}

        {/* Decision Buttons or Result */}
        {result ? (
          <div
            className={cn(
              'p-6 rounded-lg',
              result.isCorrect
                ? 'bg-[var(--profit)]/10 border border-[var(--profit)]'
                : 'bg-[var(--loss)]/10 border border-[var(--loss)]'
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              {result.isCorrect ? (
                <CheckCircle className="w-8 h-8 text-[var(--profit)]" />
              ) : (
                <XCircle className="w-8 h-8 text-[var(--loss)]" />
              )}
              <div>
                <h3
                  className={cn(
                    'text-lg font-bold',
                    result.isCorrect ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
                  )}
                >
                  {result.isCorrect ? 'Excellent Analysis!' : 'Learning Opportunity'}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Correct action:{' '}
                  <span className="font-semibold uppercase">{result.correctAction}</span>
                </p>
              </div>
            </div>

            {/* Detailed Feedback */}
            <div className="mb-4">{renderFeedback()}</div>

            {/* Scenario LTP Analysis (if available) */}
            {scenario.ltpAnalysis && (
              <div className="mt-4 grid grid-cols-3 gap-4 p-4 bg-[var(--bg-tertiary)] rounded">
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Level Score</p>
                  <ProgressBar
                    value={scenario.ltpAnalysis.level.score}
                    max={100}
                    size="sm"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {scenario.ltpAnalysis.level.score}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">Trend Score</p>
                  <ProgressBar
                    value={scenario.ltpAnalysis.trend.score}
                    max={100}
                    size="sm"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {scenario.ltpAnalysis.trend.score}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-tertiary)] mb-1">
                    Patience Score
                  </p>
                  <ProgressBar
                    value={scenario.ltpAnalysis.patience.score}
                    max={100}
                    size="sm"
                  />
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    {scenario.ltpAnalysis.patience.score}%
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={onBack}>
                Try Another
              </Button>
              <Button variant="primary" onClick={onNextScenario}>
                Next Scenario
              </Button>
              <Button variant="ghost" icon={<BookOpen className="w-4 h-4" />}>
                Related Lesson
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-center text-[var(--text-secondary)]">
              Based on your LTP analysis, what is the best action?
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

      {/* Right Panel - LTP Checklist & Context */}
      <div className="space-y-4">
        {/* LTP Assessment Checklist */}
        {!result && (
          <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Brain className="w-4 h-4 text-[var(--success)]" />
              Your LTP Assessment
            </h4>

            {/* Level Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  <Target className="w-3 h-3" /> Level Score
                </label>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {ltpChecklist.levelScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={ltpChecklist.levelScore}
                onChange={(e) =>
                  setLtpChecklist((prev) => ({
                    ...prev,
                    levelScore: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Is price at a key level (S/R, VWAP, EMA)?
              </p>
            </div>

            {/* Trend Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Trend Score
                </label>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {ltpChecklist.trendScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={ltpChecklist.trendScore}
                onChange={(e) =>
                  setLtpChecklist((prev) => ({
                    ...prev,
                    trendScore: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Are timeframes aligned (MTF analysis)?
              </p>
            </div>

            {/* Patience Score */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Patience Score
                </label>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {ltpChecklist.patienceScore}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={ltpChecklist.patienceScore}
                onChange={(e) =>
                  setLtpChecklist((prev) => ({
                    ...prev,
                    patienceScore: parseInt(e.target.value),
                  }))
                }
                className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer"
              />
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                Is there a patience candle forming/confirmed?
              </p>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="text-xs text-[var(--text-tertiary)] mb-1 block">
                Your Analysis Notes
              </label>
              <textarea
                placeholder="What do you see? What's your reasoning?"
                value={ltpChecklist.notes}
                onChange={(e) =>
                  setLtpChecklist((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] rounded"
                rows={3}
              />
            </div>

            {/* Confluence Score */}
            <div className="pt-4 border-t border-[var(--border-primary)]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">
                  Confluence Score
                </span>
                <span className={cn('text-2xl font-bold', gradeInfo.color)}>
                  {gradeInfo.grade}
                </span>
              </div>
              <ProgressBar value={confluenceScore} max={100} size="md" />
              <p className="text-xs text-[var(--text-tertiary)] mt-2">
                {confluenceScore >= 80
                  ? 'Strong setup - consider taking the trade'
                  : confluenceScore >= 60
                    ? 'Moderate setup - proceed with caution'
                    : 'Weak setup - consider waiting'}
              </p>
            </div>
          </div>
        )}

        {/* Scenario Context */}
        <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
          <button
            className="w-full flex items-center justify-between text-sm font-semibold text-[var(--text-primary)] mb-2"
            onClick={() => setShowContext(!showContext)}
          >
            <span>Scenario Context</span>
            {showContext ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showContext && (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-[var(--text-tertiary)]">Symbol:</span>
                <span className="ml-2 text-[var(--text-primary)] font-semibold">
                  {scenario.symbol}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Setup:</span>
                <span className="ml-2 text-[var(--text-primary)]">
                  {scenario.scenarioType}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Difficulty:</span>
                <span
                  className={cn(
                    'ml-2 capitalize',
                    scenario.difficulty === 'beginner'
                      ? 'text-[var(--success)]'
                      : scenario.difficulty === 'intermediate'
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--error)]'
                  )}
                >
                  {scenario.difficulty}
                </span>
              </div>
              {scenario.decisionPoint?.context && (
                <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                  <p className="text-[var(--text-secondary)]">
                    {scenario.decisionPoint.context}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Key Levels (if available) */}
        {scenario.keyLevels && scenario.keyLevels.length > 0 && (
          <div className="p-4 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              Key Levels
            </h4>
            <div className="space-y-2">
              {scenario.keyLevels.slice(0, 6).map((level, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[var(--text-tertiary)] capitalize">
                    {level.type.replace(/_/g, ' ')}
                  </span>
                  <span className="font-mono text-[var(--text-primary)]">
                    ${level.price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DeepAnalysisEngine;
