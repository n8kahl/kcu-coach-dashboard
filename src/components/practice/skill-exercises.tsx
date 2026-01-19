'use client';

import { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Target,
  TrendingUp,
  Clock,
  Crosshair,
  Shield,
  Zap,
  CheckCircle,
  XCircle,
  ChevronRight,
  BarChart3,
  Activity,
  Eye,
} from 'lucide-react';

// Exercise types aligned with LTP framework
export type SkillType =
  | 'level_identification'
  | 'trend_analysis'
  | 'patience_recognition'
  | 'entry_timing'
  | 'risk_management'
  | 'multi_timeframe';

export interface SkillExercise {
  id: string;
  type: SkillType;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // in minutes
  xpReward: number;
  questions: ExerciseQuestion[];
}

export interface ExerciseQuestion {
  id: string;
  type: 'multiple_choice' | 'click_on_chart' | 'draw_level' | 'identify_candle' | 'order_sequence';
  prompt: string;
  hint?: string;
  imageUrl?: string;
  chartData?: unknown; // Chart data for interactive questions
  options?: { id: string; text: string; isCorrect: boolean }[];
  correctAnswer?: string | string[];
  explanation: string;
}

export interface ExerciseResult {
  exerciseId: string;
  correctAnswers: number;
  totalQuestions: number;
  accuracy: number;
  timeSpent: number;
  xpEarned: number;
  completedAt: number;
}

// Skill definitions with icons and colors
const SKILL_CONFIG: Record<SkillType, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  title: string;
  description: string;
}> = {
  level_identification: {
    icon: <Target className="w-5 h-5" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    title: 'Level Identification',
    description: 'Identify key support, resistance, and psychological levels',
  },
  trend_analysis: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    title: 'Trend Analysis',
    description: 'Recognize trend direction and strength across timeframes',
  },
  patience_recognition: {
    icon: <Clock className="w-5 h-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    title: 'Patience Candles',
    description: 'Identify patience candles that signal entry opportunities',
  },
  entry_timing: {
    icon: <Crosshair className="w-5 h-5" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    title: 'Entry Timing',
    description: 'Master the timing of entries for optimal risk/reward',
  },
  risk_management: {
    icon: <Shield className="w-5 h-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    title: 'Risk Management',
    description: 'Learn position sizing and stop loss placement',
  },
  multi_timeframe: {
    icon: <BarChart3 className="w-5 h-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    title: 'Multi-Timeframe',
    description: 'Align analysis across multiple timeframes',
  },
};

// Sample exercises data
const SAMPLE_EXERCISES: SkillExercise[] = [
  {
    id: 'level-1',
    type: 'level_identification',
    title: 'Support & Resistance Basics',
    description: 'Learn to identify key support and resistance levels from price action',
    difficulty: 'beginner',
    estimatedTime: 5,
    xpReward: 50,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What makes a strong support level?',
        options: [
          { id: 'a', text: 'A single touch with a quick bounce', isCorrect: false },
          { id: 'b', text: 'Multiple touches over time with price respecting the level', isCorrect: true },
          { id: 'c', text: 'A level that has never been touched', isCorrect: false },
          { id: 'd', text: 'Any round number on the chart', isCorrect: false },
        ],
        explanation: 'Strong support levels are characterized by multiple price reactions over time, showing that buyers consistently step in at that price.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'When does resistance become support?',
        options: [
          { id: 'a', text: 'When price touches it twice', isCorrect: false },
          { id: 'b', text: 'When price breaks above it and retests from above', isCorrect: true },
          { id: 'c', text: 'When the market is bearish', isCorrect: false },
          { id: 'd', text: 'Resistance never becomes support', isCorrect: false },
        ],
        explanation: 'This is called "polarity flip" - once price convincingly breaks through a resistance level and retests it, that level often acts as new support.',
      },
    ],
  },
  {
    id: 'level-2',
    type: 'level_identification',
    title: 'PDH/PDL & ORB Levels',
    description: 'Master identifying Previous Day High/Low and Opening Range Breakout levels',
    difficulty: 'intermediate',
    estimatedTime: 8,
    xpReward: 100,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Why is the Previous Day High (PDH) an important level?',
        options: [
          { id: 'a', text: 'It represents the highest price in market history', isCorrect: false },
          { id: 'b', text: 'Institutional traders often have orders around this level', isCorrect: true },
          { id: 'c', text: "It's only relevant for swing trading", isCorrect: false },
          { id: 'd', text: 'It has no significance in day trading', isCorrect: false },
        ],
        explanation: 'PDH and PDL are critical levels because many institutional algorithms and traders place orders around these prices. Breaking above PDH or below PDL often triggers momentum.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'What is the typical Opening Range Breakout (ORB) time period?',
        options: [
          { id: 'a', text: 'First 5 minutes of trading', isCorrect: false },
          { id: 'b', text: 'First 15-30 minutes of trading', isCorrect: true },
          { id: 'c', text: 'First 2 hours of trading', isCorrect: false },
          { id: 'd', text: 'The entire first trading day', isCorrect: false },
        ],
        explanation: 'The ORB is typically the first 15-30 minutes of trading. This period establishes the initial range as institutions position themselves.',
      },
    ],
  },
  {
    id: 'trend-1',
    type: 'trend_analysis',
    title: 'EMA Crossovers',
    description: 'Learn to read trend direction using EMA relationships',
    difficulty: 'beginner',
    estimatedTime: 5,
    xpReward: 50,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What does it mean when the 9 EMA is above the 21 EMA?',
        options: [
          { id: 'a', text: 'The market is in a downtrend', isCorrect: false },
          { id: 'b', text: 'The market is in an uptrend or bullish momentum', isCorrect: true },
          { id: 'c', text: 'The market is about to crash', isCorrect: false },
          { id: 'd', text: 'There is no trend', isCorrect: false },
        ],
        explanation: 'When the faster EMA (9) is above the slower EMA (21), it indicates bullish momentum. The opposite (9 below 21) indicates bearish momentum.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'What does "price above VWAP" suggest?',
        options: [
          { id: 'a', text: 'Buyers are in control and price is trading at a premium', isCorrect: true },
          { id: 'b', text: 'The market is bearish', isCorrect: false },
          { id: 'c', text: 'Volume is very low', isCorrect: false },
          { id: 'd', text: 'A reversal is imminent', isCorrect: false },
        ],
        explanation: 'VWAP (Volume Weighted Average Price) is the "fair value" benchmark. Price above VWAP means traders are willing to pay a premium, indicating bullish control.',
      },
    ],
  },
  {
    id: 'patience-1',
    type: 'patience_recognition',
    title: 'Doji & Indecision Candles',
    description: 'Identify patience candles that signal potential reversals',
    difficulty: 'beginner',
    estimatedTime: 6,
    xpReward: 75,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What characterizes a doji candle?',
        options: [
          { id: 'a', text: 'A very large body with no wicks', isCorrect: false },
          { id: 'b', text: 'Open and close are nearly the same price, creating a small body', isCorrect: true },
          { id: 'c', text: 'The candle is always green/bullish', isCorrect: false },
          { id: 'd', text: 'It must appear at market open', isCorrect: false },
        ],
        explanation: 'A doji forms when open and close are nearly equal, showing indecision between buyers and sellers. This can signal a potential reversal when appearing at key levels.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'What is a "hammer" candle pattern?',
        options: [
          { id: 'a', text: 'A candle with a large body and no lower wick', isCorrect: false },
          { id: 'b', text: 'A candle with a small body at the top and long lower wick', isCorrect: true },
          { id: 'c', text: 'Any red bearish candle', isCorrect: false },
          { id: 'd', text: 'A candle with equal wicks on both sides', isCorrect: false },
        ],
        explanation: 'A hammer has a small body at the top with a long lower wick (at least 2x the body). It appears after a downtrend and suggests buyers rejected lower prices.',
      },
    ],
  },
  {
    id: 'entry-1',
    type: 'entry_timing',
    title: 'Confirmation Entries',
    description: 'Learn when to enter after receiving proper confirmation',
    difficulty: 'intermediate',
    estimatedTime: 8,
    xpReward: 100,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What is "confirmation" in the LTP framework?',
        options: [
          { id: 'a', text: 'Waiting for news to confirm your bias', isCorrect: false },
          { id: 'b', text: 'A patience candle at a key level with supporting trend', isCorrect: true },
          { id: 'c', text: 'Getting a second opinion from another trader', isCorrect: false },
          { id: 'd', text: 'Checking multiple brokers for the same price', isCorrect: false },
        ],
        explanation: 'Confirmation in LTP means having all three elements aligned: price at a key Level, supporting Trend direction, and a Patience candle showing indecision/rejection.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'Where should you enter a long trade after a hammer candle at support?',
        options: [
          { id: 'a', text: 'Immediately when the hammer forms', isCorrect: false },
          { id: 'b', text: 'Wait for the next candle to break above the hammer high', isCorrect: true },
          { id: 'c', text: 'Wait for 5 more candles to form', isCorrect: false },
          { id: 'd', text: 'Enter at the low of the hammer', isCorrect: false },
        ],
        explanation: 'Best practice is to wait for confirmation - enter when price breaks above the high of the patience candle. This confirms buyers have taken control.',
      },
    ],
  },
  {
    id: 'risk-1',
    type: 'risk_management',
    title: 'Position Sizing Basics',
    description: 'Learn the 1% rule and proper position sizing',
    difficulty: 'beginner',
    estimatedTime: 5,
    xpReward: 50,
    questions: [
      {
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'What is the "1% Rule" in risk management?',
        options: [
          { id: 'a', text: 'Only trade 1% of the time', isCorrect: false },
          { id: 'b', text: 'Never risk more than 1% of your account on a single trade', isCorrect: true },
          { id: 'c', text: 'Only take trades with 1% profit potential', isCorrect: false },
          { id: 'd', text: 'Keep 1% of your account in cash', isCorrect: false },
        ],
        explanation: 'The 1% rule means you should never risk more than 1% of your total account on any single trade. This protects you from a series of losses wiping out your account.',
      },
      {
        id: 'q2',
        type: 'multiple_choice',
        prompt: 'If you have a $25,000 account and want to risk 1%, what is your maximum risk?',
        options: [
          { id: 'a', text: '$2,500', isCorrect: false },
          { id: 'b', text: '$250', isCorrect: true },
          { id: 'c', text: '$25', isCorrect: false },
          { id: 'd', text: '$1,000', isCorrect: false },
        ],
        explanation: '$25,000 × 1% = $250 maximum risk per trade. This means if your stop loss is hit, you should lose no more than $250.',
      },
    ],
  },
];

interface SkillExercisesProps {
  onExerciseStart?: (exercise: SkillExercise) => void;
  onExerciseComplete?: (result: ExerciseResult) => void;
  completedExercises?: string[];
  className?: string;
}

export function SkillExercises({
  onExerciseStart,
  onExerciseComplete,
  completedExercises = [],
  className,
}: SkillExercisesProps) {
  const [selectedSkill, setSelectedSkill] = useState<SkillType | null>(null);
  const [activeExercise, setActiveExercise] = useState<SkillExercise | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  // Filter exercises by skill
  const exercisesBySkill = useMemo(() => {
    const grouped: Record<SkillType, SkillExercise[]> = {
      level_identification: [],
      trend_analysis: [],
      patience_recognition: [],
      entry_timing: [],
      risk_management: [],
      multi_timeframe: [],
    };

    SAMPLE_EXERCISES.forEach((ex) => {
      grouped[ex.type].push(ex);
    });

    return grouped;
  }, []);

  // Start an exercise
  const handleStartExercise = useCallback(
    (exercise: SkillExercise) => {
      setActiveExercise(exercise);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setShowResult(false);
      setStartTime(Date.now());
      onExerciseStart?.(exercise);
    },
    [onExerciseStart]
  );

  // Submit an answer
  const handleAnswer = useCallback(
    (questionId: string, answerId: string) => {
      setAnswers((prev) => ({ ...prev, [questionId]: answerId }));

      if (activeExercise && currentQuestionIndex < activeExercise.questions.length - 1) {
        // Move to next question after a short delay
        setTimeout(() => {
          setCurrentQuestionIndex((prev) => prev + 1);
        }, 500);
      } else {
        // Show results
        setShowResult(true);
      }
    },
    [activeExercise, currentQuestionIndex]
  );

  // Calculate result
  const result = useMemo(() => {
    if (!activeExercise || !showResult) return null;

    let correct = 0;
    activeExercise.questions.forEach((q) => {
      const answer = answers[q.id];
      const correctOption = q.options?.find((o) => o.isCorrect);
      if (correctOption && answer === correctOption.id) {
        correct++;
      }
    });

    const accuracy = (correct / activeExercise.questions.length) * 100;
    const timeSpent = Math.round((Date.now() - startTime) / 1000);
    const xpEarned = Math.round((accuracy / 100) * activeExercise.xpReward);

    return {
      exerciseId: activeExercise.id,
      correctAnswers: correct,
      totalQuestions: activeExercise.questions.length,
      accuracy,
      timeSpent,
      xpEarned,
      completedAt: Date.now(),
    };
  }, [activeExercise, showResult, answers, startTime]);

  // Complete exercise
  const handleComplete = useCallback(() => {
    if (result) {
      onExerciseComplete?.(result);
    }
    setActiveExercise(null);
    setShowResult(false);
  }, [result, onExerciseComplete]);

  // Render exercise view
  if (activeExercise) {
    const currentQuestion = activeExercise.questions[currentQuestionIndex];
    const selectedAnswer = answers[currentQuestion.id];
    const correctOption = currentQuestion.options?.find((o) => o.isCorrect);

    return (
      <div className={cn('bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg', className)}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border-primary)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded', SKILL_CONFIG[activeExercise.type].bgColor)}>
              <span className={SKILL_CONFIG[activeExercise.type].color}>
                {SKILL_CONFIG[activeExercise.type].icon}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {activeExercise.title}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)]">
                Question {currentQuestionIndex + 1} of {activeExercise.questions.length}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveExercise(null)}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            Exit
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[var(--bg-tertiary)]">
          <div
            className="h-full bg-[var(--accent-primary)] transition-all"
            style={{ width: `${((currentQuestionIndex + 1) / activeExercise.questions.length) * 100}%` }}
          />
        </div>

        {showResult ? (
          // Results View
          <div className="p-6 text-center">
            <div className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
              result && result.accuracy >= 70 ? 'bg-green-500/20' : 'bg-amber-500/20'
            )}>
              {result && result.accuracy >= 70 ? (
                <CheckCircle className="w-8 h-8 text-green-400" />
              ) : (
                <Activity className="w-8 h-8 text-amber-400" />
              )}
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">
              {result && result.accuracy >= 70 ? 'Great Job!' : 'Keep Practicing!'}
            </h3>
            <p className="text-[var(--text-secondary)] mb-4">
              You scored {result?.correctAnswers}/{result?.totalQuestions} ({result?.accuracy.toFixed(0)}%)
            </p>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                <div className="text-lg font-bold text-[var(--text-primary)]">{result?.accuracy.toFixed(0)}%</div>
                <div className="text-xs text-[var(--text-tertiary)]">Accuracy</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                <div className="text-lg font-bold text-[var(--accent-primary)]">+{result?.xpEarned} XP</div>
                <div className="text-xs text-[var(--text-tertiary)]">Earned</div>
              </div>
              <div className="p-3 bg-[var(--bg-tertiary)] rounded">
                <div className="text-lg font-bold text-[var(--text-primary)]">{result?.timeSpent}s</div>
                <div className="text-xs text-[var(--text-tertiary)]">Time</div>
              </div>
            </div>

            <button
              onClick={handleComplete}
              className="px-6 py-2 bg-[var(--accent-primary)] text-white rounded-lg font-medium hover:bg-[var(--accent-primary)]/80 transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          // Question View
          <div className="p-4">
            <p className="text-base font-medium text-[var(--text-primary)] mb-4">
              {currentQuestion.prompt}
            </p>

            <div className="space-y-2">
              {currentQuestion.options?.map((option) => {
                const isSelected = selectedAnswer === option.id;
                const isCorrect = option.isCorrect;
                const showFeedback = selectedAnswer !== undefined;

                return (
                  <button
                    key={option.id}
                    onClick={() => !selectedAnswer && handleAnswer(currentQuestion.id, option.id)}
                    disabled={!!selectedAnswer}
                    className={cn(
                      'w-full p-3 text-left rounded-lg border transition-all',
                      !showFeedback && 'hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]',
                      !showFeedback && 'bg-[var(--bg-tertiary)] border-[var(--border-primary)]',
                      showFeedback && isSelected && isCorrect && 'bg-green-500/10 border-green-500',
                      showFeedback && isSelected && !isCorrect && 'bg-red-500/10 border-red-500',
                      showFeedback && !isSelected && isCorrect && 'bg-green-500/10 border-green-500',
                      showFeedback && !isSelected && !isCorrect && 'opacity-50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-primary)]">{option.text}</span>
                      {showFeedback && isCorrect && (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      )}
                      {showFeedback && isSelected && !isCorrect && (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {selectedAnswer && (
              <div className="mt-4 p-3 bg-[var(--bg-tertiary)] rounded-lg">
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--text-primary)]">Explanation: </span>
                  {currentQuestion.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Skill selection view
  return (
    <div className={cn('space-y-6', className)}>
      {/* Skill Categories */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(SKILL_CONFIG) as SkillType[]).map((skill) => {
          const config = SKILL_CONFIG[skill];
          const exercises = exercisesBySkill[skill];
          const completedCount = exercises.filter((e) => completedExercises.includes(e.id)).length;

          return (
            <button
              key={skill}
              onClick={() => setSelectedSkill(selectedSkill === skill ? null : skill)}
              className={cn(
                'p-4 rounded-lg border transition-all text-left',
                selectedSkill === skill
                  ? `${config.bgColor} border-current ${config.color}`
                  : 'bg-[var(--bg-secondary)] border-[var(--border-primary)] hover:border-[var(--accent-primary)]'
              )}
            >
              <div className={cn('p-2 rounded-lg w-fit mb-2', config.bgColor)}>
                <span className={config.color}>{config.icon}</span>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                {config.title}
              </h3>
              <p className="text-xs text-[var(--text-tertiary)] mb-2 line-clamp-2">
                {config.description}
              </p>
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span>{exercises.length} exercises</span>
                {completedCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-green-400">{completedCount} completed</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Exercises List */}
      {selectedSkill && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-primary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              {SKILL_CONFIG[selectedSkill].title} Exercises
            </h3>
          </div>
          <div className="divide-y divide-[var(--border-primary)]">
            {exercisesBySkill[selectedSkill].map((exercise) => {
              const isCompleted = completedExercises.includes(exercise.id);

              return (
                <button
                  key={exercise.id}
                  onClick={() => handleStartExercise(exercise)}
                  className="w-full p-4 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">
                          {exercise.title}
                        </h4>
                        {isCompleted && (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        )}
                        <span
                          className={cn(
                            'px-1.5 py-0.5 text-[10px] font-medium rounded',
                            exercise.difficulty === 'beginner' && 'bg-green-500/10 text-green-400',
                            exercise.difficulty === 'intermediate' && 'bg-amber-500/10 text-amber-400',
                            exercise.difficulty === 'advanced' && 'bg-red-500/10 text-red-400'
                          )}
                        >
                          {exercise.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {exercise.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {exercise.estimatedTime} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          {exercise.xpReward} XP
                        </span>
                        <span>{exercise.questions.length} questions</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)]" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default SkillExercises;
