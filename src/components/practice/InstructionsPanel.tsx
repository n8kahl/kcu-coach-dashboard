'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Target,
  Zap,
  Brain,
  Play,
  Wand2,
  LayoutGrid,
  ChevronRight,
  CheckCircle,
  Info,
  X,
  Lightbulb,
  MousePointer,
  Clock,
  TrendingUp,
  TrendingDown,
  Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type PracticeMode = 'standard' | 'quick_drill' | 'deep_analysis' | 'replay' | 'ai_generated' | 'multi_timeframe';

interface InstructionsPanelProps {
  mode: PracticeMode;
  hasScenarioSelected: boolean;
  isFirstVisit?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const MODE_INSTRUCTIONS = {
  standard: {
    title: 'Standard Practice',
    icon: Target,
    color: 'text-[var(--accent-primary)]',
    bgColor: 'bg-[var(--accent-primary)]/10',
    borderColor: 'border-[var(--accent-primary)]/30',
    description: 'Full trade analysis with detailed feedback. Take your time to analyze the setup.',
    beforeScenario: [
      'Select a scenario from the list on the left',
      'Each scenario presents a real trading situation',
      'Difficulty badges show: Beginner → Intermediate → Advanced',
    ],
    withScenario: [
      'Study the chart - look for key levels (PDH/PDL, VWAP, EMAs)',
      'Identify the trend direction using EMA 9/21 alignment',
      'Fill in your trade plan: Entry, Stop, Target prices',
      'Select the level types you\'re using for this trade',
      'Rate your confidence and submit your analysis',
    ],
    tips: [
      'Click on the chart to place entry/stop/target levels',
      'Check the Market Context card for pre-market data and ORB',
      'Your R:R ratio is calculated automatically',
    ],
  },
  quick_drill: {
    title: 'Quick Drill',
    icon: Zap,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    description: '30-second rapid decisions. Train your pattern recognition speed.',
    beforeScenario: [
      'Select any scenario to start the drill',
      'You\'ll have 30 seconds per decision',
      'Focus on quick pattern recognition, not detailed analysis',
    ],
    withScenario: [
      'QUICKLY assess: Is this a valid setup? (Level + Trend + Patience)',
      'Make your decision: LONG, SHORT, or WAIT',
      'Timer runs out = automatic WAIT submission',
      'Move fast - this trains intuition!',
    ],
    tips: [
      'Look for obvious level confluence first',
      'Check EMA alignment in 2 seconds',
      'When in doubt, WAIT is often correct',
    ],
  },
  deep_analysis: {
    title: 'Deep Analysis',
    icon: Brain,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30',
    description: 'Complete LTP framework analysis with AI coaching feedback.',
    beforeScenario: [
      'Select a scenario for comprehensive analysis',
      'This mode provides the most detailed feedback',
      'Best for learning and improving weak areas',
    ],
    withScenario: [
      'Rate each LTP component (Level, Trend, Patience) 0-100%',
      'Fill in complete trade plan with reasoning',
      'Specify exact entry, stop loss, and target prices',
      'Identify which key levels support your trade thesis',
      'Add notes explaining your thought process',
    ],
    tips: [
      'Be specific in your reasoning - AI feedback improves with detail',
      'Compare your LTP scores with the ideal after submission',
      'Review the AI coaching to identify patterns in your mistakes',
    ],
  },
  replay: {
    title: 'Live Replay',
    icon: Play,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    description: 'Watch candles unfold in real-time. Make your decision at the key moment.',
    beforeScenario: [
      'Select a scenario to start the replay',
      'Chart will play forward candle-by-candle',
      'You\'ll be prompted when to make a decision',
    ],
    withScenario: [
      'Watch the price action unfold naturally',
      'Use playback controls: ⏪ Rewind | ⏸️ Pause | ⏩ Fast Forward',
      'Speed options: 0.25x (slow) to 8x (fast)',
      'WAIT for the "Decision" marker on the timeline',
      'Make your call when the chart pauses at the decision point',
    ],
    tips: [
      'Press SPACE to play/pause',
      'Press D to jump to decision point',
      'Press O to see the outcome after deciding',
      'Use slow speed (0.25x) to study candle formation',
    ],
  },
  ai_generated: {
    title: 'AI Scenarios',
    icon: Wand2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    description: 'Unlimited AI-generated practice scenarios tailored to your level.',
    beforeScenario: [
      'Configure your scenario preferences:',
      '• Symbol: SPY, QQQ, AAPL, etc.',
      '• Difficulty: Beginner → Intermediate → Advanced',
      '• Focus: All, Level, Trend, or Patience',
      'Click "Generate Scenario" to create a unique setup',
    ],
    withScenario: [
      'Analyze the AI-generated chart setup',
      'Apply the same LTP framework analysis',
      'Submit your trade plan as in Standard mode',
      'AI adapts future scenarios based on your performance',
    ],
    tips: [
      'AI scenarios target your weak areas over time',
      'No two generated scenarios are exactly alike',
      'Great for unlimited practice without repeating setups',
    ],
  },
  multi_timeframe: {
    title: 'Multi-Timeframe',
    icon: LayoutGrid,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    borderColor: 'border-gray-400/30',
    description: 'Analyze 5 timeframes simultaneously. Master top-down analysis.',
    beforeScenario: [
      'Select a scenario to view in multi-timeframe mode',
      'You\'ll see: Daily, 1H, 15m, 5m, and 2m charts',
      'Practice identifying alignment across timeframes',
    ],
    withScenario: [
      'Start with Daily chart - identify major levels and trend',
      'Move to 1H - confirm intermediate trend',
      '15m/5m - find entry timing and local levels',
      '2m - fine-tune entry if needed',
      'All timeframes should ALIGN before taking a trade',
    ],
    tips: [
      'Higher timeframe levels are more significant',
      'Look for "stacked" EMAs across multiple timeframes',
      'Entry timeframe should show clear level respect',
    ],
  },
};

export function InstructionsPanel({
  mode,
  hasScenarioSelected,
  isFirstVisit = false,
  onDismiss,
  className,
}: InstructionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(isFirstVisit);
  const instructions = MODE_INSTRUCTIONS[mode];
  const Icon = instructions.icon;

  const steps = hasScenarioSelected ? instructions.withScenario : instructions.beforeScenario;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-lg border',
        instructions.bgColor,
        instructions.borderColor,
        className
      )}
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', instructions.bgColor)}>
            <Icon className={cn('w-5 h-5', instructions.color)} />
          </div>
          <div>
            <h3 className={cn('font-semibold', instructions.color)}>
              {instructions.title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {instructions.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span className="text-xs text-[var(--text-tertiary)]">
              Click to see instructions
            </span>
          )}
          <ChevronRight
            className={cn(
              'w-5 h-5 text-[var(--text-tertiary)] transition-transform',
              isExpanded && 'rotate-90'
            )}
          />
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Steps */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" />
                  {hasScenarioSelected ? 'What to do now' : 'Getting started'}
                </h4>
                <ol className="space-y-2">
                  {steps.map((step, index) => (
                    <li key={index} className="flex items-start gap-3 text-sm">
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold',
                        instructions.bgColor,
                        instructions.color
                      )}>
                        {index + 1}
                      </span>
                      <span className="text-[var(--text-secondary)]">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Tips */}
              <div className="pt-3 border-t border-[var(--border-primary)]">
                <h4 className="text-xs font-semibold text-[var(--text-tertiary)] uppercase mb-2 flex items-center gap-2">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Pro tips
                </h4>
                <ul className="space-y-1">
                  {instructions.tips.map((tip, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs text-[var(--text-tertiary)]">
                      <CheckCircle className="w-3.5 h-3.5 text-[var(--profit)] flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dismiss button for first visit */}
              {isFirstVisit && onDismiss && (
                <div className="pt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismiss();
                      setIsExpanded(false);
                    }}
                  >
                    Got it, don't show again
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Quick reference card for decision making
export function DecisionGuide({ className }: { className?: string }) {
  return (
    <div className={cn(
      'p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
      className
    )}>
      <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
        <Target className="w-4 h-4 text-[var(--accent-primary)]" />
        LTP Decision Framework
      </h4>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded">
          <div className="text-xs font-semibold text-[var(--accent-primary)] mb-1">LEVEL</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            Is price at a key level?<br/>
            PDH/PDL, VWAP, ORB?
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded">
          <div className="text-xs font-semibold text-[var(--accent-primary)] mb-1">TREND</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            EMA 9/21 aligned?<br/>
            Trading with trend?
          </div>
        </div>
        <div className="text-center p-2 bg-[var(--bg-secondary)] rounded">
          <div className="text-xs font-semibold text-[var(--accent-primary)] mb-1">PATIENCE</div>
          <div className="text-[10px] text-[var(--text-tertiary)]">
            Confirmation candle?<br/>
            Volume present?
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--profit)]/20 text-[var(--profit)]">
            <TrendingUp className="w-4 h-4" />
            <span className="font-semibold">LONG</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">
            Level support + Bullish trend + Confirmation
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--loss)]/20 text-[var(--loss)]">
            <TrendingDown className="w-4 h-4" />
            <span className="font-semibold">SHORT</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">
            Level resistance + Bearish trend + Confirmation
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--warning)]/20 text-[var(--warning)]">
            <Pause className="w-4 h-4" />
            <span className="font-semibold">WAIT</span>
          </div>
          <span className="text-xs text-[var(--text-tertiary)]">
            Missing any LTP component = No trade
          </span>
        </div>
      </div>
    </div>
  );
}

// Keyboard shortcuts reference
export function KeyboardShortcuts({ mode, className }: { mode: PracticeMode; className?: string }) {
  const shortcuts = mode === 'replay' ? [
    { key: 'Space', action: 'Play / Pause' },
    { key: '←/→', action: 'Step backward/forward' },
    { key: 'Shift+←/→', action: 'Jump 10 candles' },
    { key: 'D', action: 'Jump to decision point' },
    { key: 'O', action: 'Show outcome' },
  ] : [
    { key: '1', action: 'Select LONG' },
    { key: '2', action: 'Select WAIT' },
    { key: '3', action: 'Select SHORT' },
    { key: 'Enter', action: 'Submit decision' },
    { key: 'N', action: 'Next scenario' },
  ];

  return (
    <div className={cn(
      'p-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]',
      className
    )}>
      <h5 className="text-xs font-semibold text-[var(--text-tertiary)] mb-2">Keyboard Shortcuts</h5>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {shortcuts.map(({ key, action }) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono">
              {key}
            </kbd>
            <span className="text-[var(--text-tertiary)]">{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
