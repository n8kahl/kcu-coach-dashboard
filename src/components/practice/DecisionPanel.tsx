'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Target,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  DollarSign,
  Shield,
  Flag,
  Star,
  ChevronDown,
  ChevronUp,
  Calculator,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// Level types for selection
const LEVEL_TYPES = [
  { id: 'pdh_pdl', label: 'PDH/PDL', description: 'Previous Day High/Low' },
  { id: 'orb', label: 'ORB', description: 'Opening Range Breakout' },
  { id: 'vwap', label: 'VWAP', description: 'Volume Weighted Avg Price' },
  { id: 'ema', label: 'EMA', description: 'EMA 9/21 Support/Resistance' },
  { id: 'weekly', label: 'Weekly', description: 'Weekly High/Low' },
  { id: 'round', label: 'Round #', description: 'Round Number Level' },
];

export interface TradePlan {
  isValidSetup: boolean | null;
  direction: 'long' | 'short' | null;
  entryPrice: number | null;
  stopPrice: number | null;
  target1Price: number | null;
  target2Price: number | null;
  levelTypes: string[];
  confidence: number;
  reasoning: string;
}

interface DecisionPanelProps {
  currentPrice: number;
  symbol: string;
  onSubmit: (plan: TradePlan) => void;
  isSubmitting?: boolean;
  disabled?: boolean;
  // For click-to-place from chart
  chartEntry?: number | null;
  chartStop?: number | null;
  chartTarget1?: number | null;
  chartTarget2?: number | null;
  className?: string;
}

function PriceInput({
  label,
  value,
  onChange,
  placeholder,
  icon: Icon,
  color,
  currentPrice,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (val: number | null) => void;
  placeholder: string;
  icon: typeof DollarSign;
  color: string;
  currentPrice: number;
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  useEffect(() => {
    if (value !== null) {
      setInputValue(value.toFixed(2));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const num = parseFloat(val);
    onChange(isNaN(num) ? null : num);
  };

  const distancePercent = value
    ? (((value - currentPrice) / currentPrice) * 100).toFixed(2)
    : null;

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <Icon className={cn('w-3.5 h-3.5', color)} />
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">$</span>
        <input
          type="number"
          step="0.01"
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-7 pr-16 py-2 text-sm font-mono rounded-lg',
            'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
            'text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
            'focus:outline-none focus:border-[var(--accent-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        {distancePercent && (
          <span
            className={cn(
              'absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono',
              parseFloat(distancePercent) >= 0 ? 'text-[var(--profit)]' : 'text-[var(--loss)]'
            )}
          >
            {parseFloat(distancePercent) >= 0 ? '+' : ''}{distancePercent}%
          </span>
        )}
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)]">
        Click on chart or enter price
      </p>
    </div>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className={cn(
            'p-0.5 transition-all',
            disabled ? 'cursor-not-allowed' : 'hover:scale-110'
          )}
        >
          <Star
            className={cn(
              'w-5 h-5 transition-colors',
              star <= value
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-[var(--text-tertiary)]'
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-xs text-[var(--text-tertiary)]">
        ({value}/5)
      </span>
    </div>
  );
}

export function DecisionPanel({
  currentPrice,
  symbol,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  chartEntry,
  chartStop,
  chartTarget1,
  chartTarget2,
  className,
}: DecisionPanelProps) {
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

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update from chart clicks
  useEffect(() => {
    if (chartEntry !== undefined) setTradePlan(p => ({ ...p, entryPrice: chartEntry }));
  }, [chartEntry]);
  useEffect(() => {
    if (chartStop !== undefined) setTradePlan(p => ({ ...p, stopPrice: chartStop }));
  }, [chartStop]);
  useEffect(() => {
    if (chartTarget1 !== undefined) setTradePlan(p => ({ ...p, target1Price: chartTarget1 }));
  }, [chartTarget1]);
  useEffect(() => {
    if (chartTarget2 !== undefined) setTradePlan(p => ({ ...p, target2Price: chartTarget2 }));
  }, [chartTarget2]);

  // Calculate R:R ratio
  const calculateRR = () => {
    const { entryPrice, stopPrice, target1Price, direction } = tradePlan;
    if (!entryPrice || !stopPrice || !target1Price) return null;

    const risk = Math.abs(entryPrice - stopPrice);
    const reward = Math.abs(target1Price - entryPrice);

    if (risk === 0) return null;
    return (reward / risk).toFixed(2);
  };

  const rrRatio = calculateRR();

  const toggleLevelType = (typeId: string) => {
    setTradePlan(p => ({
      ...p,
      levelTypes: p.levelTypes.includes(typeId)
        ? p.levelTypes.filter(t => t !== typeId)
        : [...p.levelTypes, typeId],
    }));
  };

  const canSubmit =
    tradePlan.isValidSetup !== null &&
    (tradePlan.isValidSetup === false ||
      (tradePlan.direction !== null &&
        tradePlan.entryPrice !== null &&
        tradePlan.stopPrice !== null &&
        tradePlan.target1Price !== null));

  const handleSubmit = () => {
    if (canSubmit && !isSubmitting && !disabled) {
      onSubmit(tradePlan);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
        <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Target className="w-5 h-5 text-[var(--accent-primary)]" />
          Trade Decision
        </h3>
        <p className="text-xs text-[var(--text-tertiary)] mt-1">
          Analyze the setup and submit your trade plan
        </p>
      </div>

      <div className="p-4 space-y-6">
        {/* Step 1: Is this a valid setup? */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-[var(--text-primary)]">
            Is this a valid LTP setup?
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTradePlan(p => ({ ...p, isValidSetup: true }))}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-lg border transition-all',
                tradePlan.isValidSetup === true
                  ? 'bg-[var(--profit)]/20 border-[var(--profit)] text-[var(--profit)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--profit)]/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <TrendingUp className="w-4 h-4" />
              Yes, Trade
            </button>
            <button
              type="button"
              onClick={() => setTradePlan(p => ({ ...p, isValidSetup: false }))}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-lg border transition-all',
                tradePlan.isValidSetup === false
                  ? 'bg-[var(--warning)]/20 border-[var(--warning)] text-[var(--warning)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--warning)]/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <TrendingDown className="w-4 h-4" />
              No, Pass
            </button>
            <button
              type="button"
              onClick={() => setTradePlan(p => ({ ...p, isValidSetup: null }))}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-lg border transition-all',
                tradePlan.isValidSetup === null
                  ? 'bg-[var(--bg-tertiary)] border-[var(--text-tertiary)] text-[var(--text-secondary)]'
                  : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-tertiary)] hover:border-[var(--text-tertiary)]/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <HelpCircle className="w-4 h-4" />
              Not Sure
            </button>
          </div>
        </div>

        {/* Step 2: Trade Plan (only if valid) */}
        <AnimatePresence>
          {tradePlan.isValidSetup === true && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-6 overflow-hidden"
            >
              {/* Direction */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Direction
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTradePlan(p => ({ ...p, direction: 'long' }))}
                    disabled={disabled}
                    className={cn(
                      'flex items-center justify-center gap-2 py-4 rounded-lg border transition-all',
                      tradePlan.direction === 'long'
                        ? 'bg-[var(--profit)]/20 border-[var(--profit)] text-[var(--profit)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--profit)]/50',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <TrendingUp className="w-6 h-6" />
                    <span className="text-lg font-bold">LONG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTradePlan(p => ({ ...p, direction: 'short' }))}
                    disabled={disabled}
                    className={cn(
                      'flex items-center justify-center gap-2 py-4 rounded-lg border transition-all',
                      tradePlan.direction === 'short'
                        ? 'bg-[var(--loss)]/20 border-[var(--loss)] text-[var(--loss)]'
                        : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--loss)]/50',
                      disabled && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <TrendingDown className="w-6 h-6" />
                    <span className="text-lg font-bold">SHORT</span>
                  </button>
                </div>
              </div>

              {/* Price Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <PriceInput
                  label="Entry Price"
                  value={tradePlan.entryPrice}
                  onChange={(val) => setTradePlan(p => ({ ...p, entryPrice: val }))}
                  placeholder="450.00"
                  icon={DollarSign}
                  color="text-[var(--accent-primary)]"
                  currentPrice={currentPrice}
                  disabled={disabled}
                />
                <PriceInput
                  label="Stop Loss"
                  value={tradePlan.stopPrice}
                  onChange={(val) => setTradePlan(p => ({ ...p, stopPrice: val }))}
                  placeholder="449.50"
                  icon={Shield}
                  color="text-[var(--loss)]"
                  currentPrice={currentPrice}
                  disabled={disabled}
                />
                <PriceInput
                  label="Target 1"
                  value={tradePlan.target1Price}
                  onChange={(val) => setTradePlan(p => ({ ...p, target1Price: val }))}
                  placeholder="451.50"
                  icon={Flag}
                  color="text-[var(--profit)]"
                  currentPrice={currentPrice}
                  disabled={disabled}
                />
                <PriceInput
                  label="Target 2 (optional)"
                  value={tradePlan.target2Price}
                  onChange={(val) => setTradePlan(p => ({ ...p, target2Price: val }))}
                  placeholder="452.50"
                  icon={Flag}
                  color="text-[var(--profit)]"
                  currentPrice={currentPrice}
                  disabled={disabled}
                />
              </div>

              {/* R:R Ratio */}
              {rrRatio && (
                <div className="flex items-center justify-center gap-2 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                  <Calculator className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span className="text-sm text-[var(--text-secondary)]">Risk/Reward:</span>
                  <span
                    className={cn(
                      'text-lg font-bold',
                      parseFloat(rrRatio) >= 2
                        ? 'text-[var(--profit)]'
                        : parseFloat(rrRatio) >= 1.5
                          ? 'text-[var(--warning)]'
                          : 'text-[var(--loss)]'
                    )}
                  >
                    {rrRatio}:1
                  </span>
                  {parseFloat(rrRatio) >= 2 && (
                    <span className="text-xs text-[var(--profit)]">Good!</span>
                  )}
                </div>
              )}

              {/* Level Type Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-[var(--text-primary)]">
                  Level Type (select all that apply)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVEL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => toggleLevelType(type.id)}
                      disabled={disabled}
                      className={cn(
                        'flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center',
                        tradePlan.levelTypes.includes(type.id)
                          ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className="text-xs font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Options Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>

              {/* Advanced Options */}
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Confidence Rating */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Confidence Level
                      </label>
                      <StarRating
                        value={tradePlan.confidence}
                        onChange={(val) => setTradePlan(p => ({ ...p, confidence: val }))}
                        disabled={disabled}
                      />
                    </div>

                    {/* Reasoning */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-[var(--text-primary)]">
                        Your Reasoning (optional)
                      </label>
                      <textarea
                        value={tradePlan.reasoning}
                        onChange={(e) => setTradePlan(p => ({ ...p, reasoning: e.target.value }))}
                        placeholder="Why is this a good setup? What levels are you watching?"
                        disabled={disabled}
                        className={cn(
                          'w-full p-3 text-sm rounded-lg resize-none',
                          'bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
                          'text-[var(--text-primary)] placeholder-[var(--text-tertiary)]',
                          'focus:outline-none focus:border-[var(--accent-primary)]',
                          'disabled:opacity-50 disabled:cursor-not-allowed'
                        )}
                        rows={3}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit Button */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting || disabled}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Target className="w-5 h-5 mr-2" />
              Submit Analysis
            </>
          )}
        </Button>

        {/* Helper text */}
        {!canSubmit && tradePlan.isValidSetup === true && (
          <p className="text-xs text-center text-[var(--warning)]">
            <Info className="w-3 h-3 inline mr-1" />
            Please fill in direction, entry, stop, and target to submit
          </p>
        )}
      </div>
    </motion.div>
  );
}

export default DecisionPanel;
