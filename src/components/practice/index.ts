/**
 * Practice Mode Components
 *
 * Professional trading practice system with:
 * - TradingView-quality charts with timeframe switching
 * - Professional indicators (VWAP bands, EMA ribbon)
 * - Drawing tools (lines, fibonacci, rectangles)
 * - Paper trading with $25K simulated account
 * - Options chain for 0DTE practice
 * - Multi-timeframe grid view
 * - Daily challenges and XP system
 * - AI-powered feedback and analysis
 */

// Core Chart Components
export { PracticeChart } from './practice-chart';
export { ChartGrid } from './ChartGrid';
export { AdvancedPracticeChart } from './AdvancedPracticeChart';

// Drawing Tools
export { DrawingTools, useDrawingTools } from './drawing-tools';
export type {
  Drawing,
  DrawingToolType,
  Point,
  HorizontalLineData,
  TrendLineData,
  RectangleData,
  FibonacciData,
  TextData,
} from './drawing-tools';

// Decision and Analysis Components
export { DecisionPanel, type TradePlan } from './DecisionPanel';
export { ComparisonPanel } from './ComparisonPanel';
export { AICoachFeedback, type AIFeedback } from './AICoachFeedback';

// Context and Information Components
export { ContextPanel, ContextBadges, type MarketContext, type LTPAnalysis } from './ContextPanel';
export { MarketContextCard, type ScenarioContext } from './MarketContextCard';

// Paper Trading
export { PaperTradingPanel } from './paper-trading-panel';

// Options
export { OptionsChain } from './options-chain';

// Replay
export { ReplayController, useReplayState } from './replay-controller';
export type { ReplayMarker } from './replay-controller';

// Skill Exercises
export { SkillExercises } from './skill-exercises';
export type {
  SkillType,
  SkillExercise,
  ExerciseQuestion,
  ExerciseResult,
} from './skill-exercises';

// Gamification Components
export { DailyChallenges } from './DailyChallenge';
export { AchievementPopup, AchievementBadge, AchievementList, type Achievement } from './AchievementPopup';
export { Leaderboard, MiniLeaderboard } from './Leaderboard';
export { WinCard } from './win-card';

// Loading Skeletons
export * from './LoadingSkeletons';
