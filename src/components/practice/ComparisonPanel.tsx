'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Shield,
  Flag,
  Target,
  Star,
  ChevronRight,
  Award,
} from 'lucide-react';

interface ComponentScore {
  score: number;
  max: number;
  correct?: boolean;
  deviation?: number;
  feedback?: string;
}

interface ScoringResult {
  overall_score: number;
  grade: string;
  is_correct: boolean;
  components: {
    setup_identification: ComponentScore;
    direction: ComponentScore;
    entry_placement: ComponentScore;
    stop_placement: ComponentScore;
    target_selection: ComponentScore;
    level_identification: ComponentScore;
  };
}

interface UserResponse {
  isValidSetup: boolean | null;
  direction: 'long' | 'short' | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1Price: number | null;
  target2Price: number | null;
  levelTypes: string[];
  confidence: number;
}

interface IdealTrade {
  isValidSetup: boolean;
  direction: 'long' | 'short';
  entryPrice: number;
  stopPrice: number;
  target1Price: number;
  target2Price?: number;
  primaryLevelType: string;
}

interface OutcomeData {
  result: 'hit_t1' | 'hit_t2' | 'stopped_out' | 'breakeven' | 'chopped';
  exitPrice: number;
  pnlPercent: number;
  maxFavorable: number;
  maxAdverse: number;
  candlesToTarget?: number;
}

interface ComparisonPanelProps {
  userResponse: UserResponse;
  idealTrade: IdealTrade;
  outcomeData: OutcomeData;
  scoringResult: ScoringResult;
  symbol: string;
  className?: string;
}

function ComparisonRow({
  label,
  userValue,
  idealValue,
  isCorrect,
  icon: Icon,
  format = 'text',
}: {
  label: string;
  userValue: string | number | null;
  idealValue: string | number | null;
  isCorrect?: boolean;
  icon?: typeof DollarSign;
  format?: 'text' | 'price' | 'percent';
}) {
  const formatValue = (val: string | number | null) => {
    if (val === null || val === undefined) return '—';
    if (format === 'price') return `$${Number(val).toFixed(2)}`;
    if (format === 'percent') return `${Number(val).toFixed(2)}%`;
    return String(val);
  };

  return (
    <div className="grid grid-cols-3 items-center py-2 border-b border-[var(--border-primary)] last:border-0">
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        {Icon && <Icon className="w-4 h-4" />}
        {label}
      </div>
      <div className="flex items-center gap-2 justify-center">
        <span className={cn(
          'text-sm font-mono',
          isCorrect === true && 'text-[var(--profit)]',
          isCorrect === false && 'text-[var(--loss)]',
          isCorrect === undefined && 'text-[var(--text-primary)]'
        )}>
          {formatValue(userValue)}
        </span>
        {isCorrect === true && <CheckCircle className="w-4 h-4 text-[var(--profit)]" />}
        {isCorrect === false && <XCircle className="w-4 h-4 text-[var(--loss)]" />}
      </div>
      <div className="text-sm font-mono text-[var(--text-secondary)] text-center">
        {formatValue(idealValue)}
      </div>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  max,
  showPercent = true,
}: {
  label: string;
  score: number;
  max: number;
  showPercent?: boolean;
}) {
  const percent = max > 0 ? (score / max) * 100 : 0;
  const color = percent >= 80 ? 'var(--profit)' : percent >= 50 ? 'var(--warning)' : 'var(--loss)';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--text-tertiary)]">{label}</span>
        <span className="font-mono" style={{ color }}>
          {score}/{max}
          {showPercent && <span className="text-[var(--text-tertiary)] ml-1">({percent.toFixed(0)}%)</span>}
        </span>
      </div>
      <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function getGradeColor(grade: string) {
  switch (grade) {
    case 'A': return 'text-[var(--profit)]';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-[var(--warning)]';
    case 'D': return 'text-orange-400';
    default: return 'text-[var(--loss)]';
  }
}

function getOutcomeConfig(result: OutcomeData['result']) {
  switch (result) {
    case 'hit_t1':
      return { label: 'Target 1 Hit', color: 'text-[var(--profit)]', bg: 'bg-[var(--profit)]/20', icon: CheckCircle };
    case 'hit_t2':
      return { label: 'Target 2 Hit', color: 'text-[var(--profit)]', bg: 'bg-[var(--profit)]/20', icon: CheckCircle };
    case 'stopped_out':
      return { label: 'Stopped Out', color: 'text-[var(--loss)]', bg: 'bg-[var(--loss)]/20', icon: XCircle };
    case 'breakeven':
      return { label: 'Breakeven', color: 'text-[var(--warning)]', bg: 'bg-[var(--warning)]/20', icon: AlertCircle };
    case 'chopped':
      return { label: 'Chopped', color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--bg-tertiary)]', icon: AlertCircle };
    default:
      return { label: 'Unknown', color: 'text-[var(--text-tertiary)]', bg: 'bg-[var(--bg-tertiary)]', icon: AlertCircle };
  }
}

export function ComparisonPanel({
  userResponse,
  idealTrade,
  outcomeData,
  scoringResult,
  symbol,
  className,
}: ComparisonPanelProps) {
  const outcomeConfig = getOutcomeConfig(outcomeData.result);
  const OutcomeIcon = outcomeConfig.icon;

  // Calculate R:R for both user and ideal
  const userRR = userResponse.entryPrice && userResponse.stopPrice && userResponse.target1Price
    ? (Math.abs(userResponse.target1Price - userResponse.entryPrice) / Math.abs(userResponse.entryPrice - userResponse.stopPrice)).toFixed(2)
    : null;

  const idealRR = idealTrade.entryPrice && idealTrade.stopPrice && idealTrade.target1Price
    ? (Math.abs(idealTrade.target1Price - idealTrade.entryPrice) / Math.abs(idealTrade.entryPrice - idealTrade.stopPrice)).toFixed(2)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Score Header */}
      <div className={cn(
        'px-4 py-4 border-b border-[var(--border-primary)]',
        scoringResult.is_correct ? 'bg-[var(--profit)]/10' : 'bg-[var(--loss)]/10'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {scoringResult.is_correct ? (
              <CheckCircle className="w-10 h-10 text-[var(--profit)]" />
            ) : (
              <XCircle className="w-10 h-10 text-[var(--loss)]" />
            )}
            <div>
              <h3 className={cn(
                'text-xl font-bold',
                scoringResult.is_correct ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
              )}>
                {scoringResult.is_correct ? 'Correct!' : 'Incorrect'}
              </h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {symbol} Analysis Complete
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="flex items-baseline gap-1">
              <span className={cn('text-4xl font-bold', getGradeColor(scoringResult.grade))}>
                {scoringResult.overall_score}
              </span>
              <span className="text-lg text-[var(--text-tertiary)]">/100</span>
            </div>
            <div className={cn('text-lg font-bold', getGradeColor(scoringResult.grade))}>
              Grade: {scoringResult.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Outcome Banner */}
      <div className={cn('px-4 py-3 flex items-center justify-between', outcomeConfig.bg)}>
        <div className="flex items-center gap-2">
          <OutcomeIcon className={cn('w-5 h-5', outcomeConfig.color)} />
          <span className={cn('font-semibold', outcomeConfig.color)}>
            OUTCOME: {outcomeConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--text-tertiary)]">
            Exit: <span className="font-mono text-[var(--text-primary)]">${outcomeData.exitPrice.toFixed(2)}</span>
          </span>
          <span className={cn(
            'font-mono font-bold',
            outcomeData.pnlPercent >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
          )}>
            {outcomeData.pnlPercent >= 0 ? '+' : ''}{outcomeData.pnlPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="p-4">
        <div className="grid grid-cols-3 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider pb-2 border-b border-[var(--border-primary)]">
          <span></span>
          <span className="text-center">Your Analysis</span>
          <span className="text-center">Ideal Trade</span>
        </div>

        <div className="divide-y divide-[var(--border-primary)]">
          <ComparisonRow
            label="Valid Setup"
            icon={Target}
            userValue={userResponse.isValidSetup ? 'Yes' : 'No'}
            idealValue={idealTrade.isValidSetup ? 'Yes' : 'No'}
            isCorrect={userResponse.isValidSetup === idealTrade.isValidSetup}
          />
          <ComparisonRow
            label="Direction"
            icon={userResponse.direction === 'long' ? TrendingUp : TrendingDown}
            userValue={userResponse.direction?.toUpperCase() || '—'}
            idealValue={idealTrade.direction.toUpperCase()}
            isCorrect={userResponse.direction === idealTrade.direction}
          />
          <ComparisonRow
            label="Entry"
            icon={DollarSign}
            userValue={userResponse.entryPrice}
            idealValue={idealTrade.entryPrice}
            format="price"
            isCorrect={
              userResponse.entryPrice
                ? Math.abs(userResponse.entryPrice - idealTrade.entryPrice) / idealTrade.entryPrice < 0.005
                : false
            }
          />
          <ComparisonRow
            label="Stop"
            icon={Shield}
            userValue={userResponse.stopPrice}
            idealValue={idealTrade.stopPrice}
            format="price"
            isCorrect={
              userResponse.stopPrice
                ? Math.abs(userResponse.stopPrice - idealTrade.stopPrice) / idealTrade.stopPrice < 0.005
                : false
            }
          />
          <ComparisonRow
            label="Target 1"
            icon={Flag}
            userValue={userResponse.target1Price}
            idealValue={idealTrade.target1Price}
            format="price"
            isCorrect={
              userResponse.target1Price
                ? Math.abs(userResponse.target1Price - idealTrade.target1Price) / idealTrade.target1Price < 0.01
                : false
            }
          />
          <ComparisonRow
            label="R:R Ratio"
            userValue={userRR ? `${userRR}:1` : null}
            idealValue={idealRR ? `${idealRR}:1` : null}
          />
        </div>

        {/* Excursion Stats */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
            <p className="text-xs text-[var(--text-tertiary)]">Max Favorable</p>
            <p className="text-lg font-bold text-[var(--profit)]">
              +${outcomeData.maxFavorable.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg text-center">
            <p className="text-xs text-[var(--text-tertiary)]">Max Adverse</p>
            <p className="text-lg font-bold text-[var(--loss)]">
              -${outcomeData.maxAdverse.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Component Scores Breakdown */}
      <div className="px-4 pb-4">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Award className="w-4 h-4 text-[var(--accent-primary)]" />
          Score Breakdown
        </h4>
        <div className="space-y-3">
          <ScoreBar
            label="Setup Identification"
            score={scoringResult.components.setup_identification.score}
            max={scoringResult.components.setup_identification.max}
          />
          <ScoreBar
            label="Direction"
            score={scoringResult.components.direction.score}
            max={scoringResult.components.direction.max}
          />
          <ScoreBar
            label="Entry Placement"
            score={scoringResult.components.entry_placement.score}
            max={scoringResult.components.entry_placement.max}
          />
          <ScoreBar
            label="Stop Placement"
            score={scoringResult.components.stop_placement.score}
            max={scoringResult.components.stop_placement.max}
          />
          <ScoreBar
            label="Target Selection"
            score={scoringResult.components.target_selection.score}
            max={scoringResult.components.target_selection.max}
          />
          <ScoreBar
            label="Level Identification"
            score={scoringResult.components.level_identification.score}
            max={scoringResult.components.level_identification.max}
          />
        </div>
      </div>
    </motion.div>
  );
}

export default ComparisonPanel;
