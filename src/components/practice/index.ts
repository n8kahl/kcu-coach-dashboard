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
 */

// Chart Components
export { PracticeChart } from './practice-chart';
export { ChartGrid } from './ChartGrid';

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

// Gamification
export { DailyChallenges } from './DailyChallenge';
export { WinCard } from './win-card';
