// Practice Mode Components
// Core chart components
export { PracticeChart } from './practice-chart';
export { ChartGrid } from './ChartGrid';
export { AdvancedPracticeChart } from './AdvancedPracticeChart';

// Decision and analysis components
export { DecisionPanel, type TradePlan } from './DecisionPanel';
export { ComparisonPanel } from './ComparisonPanel';
export { AICoachFeedback, type AIFeedback } from './AICoachFeedback';

// Context and information components
export { ContextPanel, ContextBadges, type MarketContext, type LTPAnalysis } from './ContextPanel';
export { MarketContextCard, type ScenarioContext } from './MarketContextCard';

// Gamification components
export { DailyChallenges } from './DailyChallenge';
export { AchievementPopup, AchievementBadge, AchievementList, type Achievement } from './AchievementPopup';
export { Leaderboard, MiniLeaderboard } from './Leaderboard';

// Utility components
export { WinCard } from './win-card';
export * from './LoadingSkeletons';
