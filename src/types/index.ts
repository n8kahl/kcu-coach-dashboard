// ============================================
// KCU Coach - Type Definitions
// ============================================

// ============================================
// Market Data Types (Canonical)
// ============================================
export type {
  Quote,
  Bar,
  Candle,
  LegacyBar,
  MarketSession,
  TrendDirection,
  GammaRegime,
} from './market';
export { fromLegacyBar, toLegacyBar } from './market';

// ============================================
// User & Auth Types
// ============================================

export interface User {
  id: string;
  discord_id: string;
  email?: string;
  username: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
  subscription_tier: 'free' | 'pro' | 'elite';
  subscription_expires_at?: string;
  is_admin: boolean;
}

// ============================================
// Trading Profile Types (For Proactive Coaching)
// ============================================

export type TradingWeakness =
  | 'chasing_entries'      // Entering too late, FOMO
  | 'no_stop_loss'         // Failing to set/honor stops
  | 'trend_fighting'       // Going against the trend
  | 'overtrading'          // Too many trades per day
  | 'revenge_trading'      // Trading after losses
  | 'early_profit_taking'  // Taking profits too soon
  | 'moving_stops'         // Moving stops to "give room"
  | 'size_too_big'         // Position sizing issues
  | 'averaging_down'       // Adding to losers
  | 'not_waiting'          // Not waiting for patience candle
  | 'level_ignoring'       // Not trading at levels
  | 'fomo_buying'          // Fear of missing out
  | 'fear_selling'         // Panic selling at lows
  | 'holding_losers'       // Not cutting losses
  | 'lack_of_plan';        // No entry/exit plan

export type SetupType =
  | 'breakout'
  | 'breakdown'
  | 'bounce_support'
  | 'rejection_resistance'
  | 'trend_continuation'
  | 'reversal'
  | 'gap_fill'
  | 'orb_breakout'
  | 'vwap_bounce'
  | 'ema_crossover'
  | 'fvg_fill'
  | 'structure_break';

export type RiskToleranceLevel = 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';

export type CoachingIntensity = 'light' | 'normal' | 'intense';

export interface UserTradingProfile {
  id: string;
  user_id: string;

  // Trading Weaknesses (AI will watch for these)
  weaknesses: TradingWeakness[];
  weakness_severity: Record<TradingWeakness, number>; // 1-10

  // Favorite Setups
  favorite_setups: SetupType[];
  setup_win_rates: Record<SetupType, number>; // 0-100

  // Risk Profile
  risk_tolerance: RiskToleranceLevel;
  max_daily_trades: number;
  max_daily_loss_percent: number;
  preferred_position_size_percent: number;

  // Mental Capital Score (0-100)
  mental_capital: number;
  mental_capital_updated_at: string;

  // Recent Performance Patterns
  recent_win_rate?: number;
  recent_avg_ltp_score?: number;
  consecutive_losses: number;
  consecutive_wins: number;

  // Trading Session Preferences
  preferred_market_session: string[];
  avoid_around_events: boolean;

  // Coaching Preferences
  coaching_intensity: CoachingIntensity;
  allow_blocking_warnings: boolean;
  notification_preferences: {
    breadth_warnings: boolean;
    event_warnings: boolean;
    pattern_warnings: boolean;
  };

  // Behavioral Patterns (detected by AI)
  detected_patterns: Record<string, unknown>;

  // Custom Notes/Reminders
  coach_notes: string[];
  personal_rules: string[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

// Coaching context for the AI
export interface CoachingContext {
  weaknesses: TradingWeakness[];
  mental_capital: number;
  risk_tolerance: RiskToleranceLevel;
  consecutive_losses: number;
  coaching_intensity: CoachingIntensity;
  allow_blocking: boolean;
  should_trade: boolean;
  warning_message: string;
}

// ============================================
// Learning System Types
// ============================================

export type TopicStatus = 'not_started' | 'in_progress' | 'completed' | 'mastered';

export interface TopicProgress {
  topic: string;
  status: TopicStatus;
  score?: number;
}

export interface ModuleProgress {
  module: string;
  overallProgress: number;
  topics: TopicProgress[];
}

export interface LearningModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  order_index: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number; // in minutes
  lessons_count: number;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  description: string;
  video_url?: string;
  video_id?: string; // YouTube/Vimeo ID
  duration: number; // in seconds
  transcript: string;
  order_index: number;
  key_concepts: string[];
  created_at: string;
  updated_at: string;
}

export interface LessonProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  completed: boolean;
  watch_time: number; // seconds watched
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// Quiz System Types
// ============================================

export interface Quiz {
  id: string;
  lesson_id?: string;
  module_id?: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passing_score: number; // percentage
  time_limit?: number; // in seconds
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
  correct_option_id: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  answers: QuizAnswer[];
  started_at: string;
  completed_at?: string;
  time_taken?: number; // in seconds
}

export interface QuizAnswer {
  question_id: string;
  selected_option_id: string;
  is_correct: boolean;
}

// ============================================
// Knowledge Base Types (RAG)
// ============================================

export interface KnowledgeChunk {
  id: string;
  lesson_id: string;
  content: string;
  embedding?: number[];
  metadata: {
    module: string;
    lesson: string;
    topic: string;
    timestamp?: number;
  };
  created_at: string;
}

// ============================================
// Trade Journal Types
// ============================================

export interface TradeEntry {
  id: string;
  user_id: string;
  symbol: string;
  direction: 'long' | 'short';
  entry_price: number;
  exit_price?: number;
  quantity?: number; // UI field name
  shares?: number; // DB field name (API accepts both)
  is_options?: boolean;
  contract_type?: 'stock' | 'call' | 'put';
  strike_price?: number;
  expiration_date?: string;
  entry_time: string;
  exit_time?: string;
  pnl?: number;
  pnl_percent?: number;
  setup_type?: string;
  notes?: string;
  emotions?: string | string[];
  mistakes?: string[];
  lessons?: string;
  screenshots?: string[];
  tags?: string[];
  // LTP checklist fields (sent to API)
  had_level?: boolean;
  had_trend?: boolean;
  had_patience_candle?: boolean;
  followed_rules?: boolean;
  // Legacy UI format (for backward compatibility)
  ltp_score?: {
    level: number;
    trend: number;
    patience: number;
    overall: number;
  };
  // API response format (server-computed)
  ltp_grade?: {
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    feedback: string[];
  };
  status?: 'open' | 'closed';
  created_at: string;
  updated_at: string;

  // Phase 1: Screenshot & Quick Entry fields
  chart_screenshot?: string; // Base64 or URL of chart screenshot
  ai_analysis?: ScreenshotAnalysis; // AI analysis of screenshot
  entry_mode?: 'quick' | 'full'; // How the trade was entered
  r_multiple?: number; // Risk/Reward multiple

  // Phase 2: Psychology & Emotion Tracking
  pre_trade_confidence?: number; // 1-5
  pre_trade_sleep?: number; // 1-5
  pre_trade_stress?: 'low' | 'medium' | 'high';
  during_emotions?: string[]; // Array of emotion tags
  post_satisfaction?: number; // 1-5
  would_take_again?: boolean;
  lesson_learned?: string;

  // Phase 2: AI Feedback
  ai_feedback?: TradeFeedback;
  feedback_reviewed?: boolean;
}

// Screenshot analysis result from Claude Vision
export interface ScreenshotAnalysis {
  symbol: string | null;
  timeframe: string | null;
  trend: 'bullish' | 'bearish' | 'sideways';
  levels: {
    support: number[];
    resistance: number[];
  };
  pattern: string | null;
  candlestickPatterns: string[];
  indicators: string[];
  ltpAssessment: {
    level: { compliant: boolean; reason: string };
    trend: { compliant: boolean; reason: string };
    patience: { compliant: boolean; reason: string };
  };
  setupType: string;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  analysis: string;
  confidence: number;
  suggestedDirection: 'long' | 'short' | null;
  entryPrice: number | null;
  stopLoss: number | null;
  targets: number[];
}

// AI-generated trade feedback
export interface TradeFeedback {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  entryAnalysis: {
    score: number;
    feedback: string;
  };
  exitAnalysis: {
    score: number;
    feedback: string;
  };
  ruleAdherence: {
    score: number;
    feedback: string;
  };
  keyLesson: string;
  improvement: string;
  pattern?: string;
  encouragement?: string;
}

export interface TradeStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  average_win: number;
  average_loss: number;
  profit_factor: number;
  largest_win: number;
  largest_loss: number;
  average_hold_time: number;
  best_setup: string;
  worst_setup: string;
}

// ============================================
// Achievement Types
// ============================================

export type AchievementCategory = 'learning' | 'trading' | 'consistency' | 'milestones' | 'milestone' | 'streak' | 'community' | 'competition';

export interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  requirement: {
    type: string;
    target: number;
    current?: number;
  };
  xp_reward: number;
  unlocked?: boolean;
  unlocked_at?: string;
  // Component compatibility aliases
  name?: string; // Alias for title
  emoji?: string; // Alias for icon
  type?: string; // Alias for slug
  earned_at?: string; // Alias for unlocked_at
  progress?: number; // Alias for requirement.current
  target?: number; // Alias for requirement.target
}

// ============================================
// Leaderboard Types
// ============================================

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  avatar?: string;
  score: number;
  win_rate: number;
  total_trades: number;
  streak: number;
  badges: string[];
  change: 'up' | 'down' | 'same';
  change_amount?: number;
  // Enhanced leaderboard fields
  delta?: number; // Rank change from previous period
  ltp_compliance?: number; // LTP compliance percentage
  tier?: string; // Diamond, Platinum, Gold, Silver, Bronze
}

// ============================================
// Win Card Types
// ============================================

export interface WinCardStat {
  label: string;
  value: string;
  color?: 'profit' | 'loss' | 'gold' | 'default';
  highlight?: boolean;
}

export interface WinCard {
  id: string;
  user_id: string;
  type: 'trade' | 'streak' | 'milestone' | 'achievement';
  title: string;
  subtitle?: string;
  stats: WinCardStat[];
  created_at: string;
  shared_count: number;
  // Legacy fields for database storage
  trade_id?: string;
  symbol?: string;
  direction?: 'long' | 'short';
  pnl?: number;
  pnl_percent?: number;
  entry_price?: number;
  exit_price?: number;
  setup_type?: string;
  notes?: string;
  screenshot?: string;
  shared?: boolean;
  likes?: number;
}

// ============================================
// Companion Mode Types
// ============================================

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  symbols: string[];
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface SymbolLevel {
  id: string;
  symbol: string;
  level_type: 'pdh' | 'pdl' | 'vwap' | 'orb_high' | 'orb_low' | 'ema_9' | 'ema_21' | 'sma_200' | 'weekly_high' | 'weekly_low' | 'premarket_high' | 'premarket_low';
  price: number;
  timeframe: string;
  strength: number;
  created_at: string;
  expires_at: string;
}

export interface DetectedSetup {
  id: string;
  symbol: string;
  setup_type: string;
  direction: 'long' | 'short';
  confluence_score: number;
  level_score: number;
  trend_score: number;
  patience_score: number;
  order_flow_score: number;
  market_score: number;
  orb_score: number;
  key_levels: Record<string, number>;
  analysis: {
    entry: number;
    stop_loss: number;
    targets: number[];
    risk_reward: number;
  };
  coach_notes: string;
  status: 'forming' | 'ready' | 'triggered' | 'invalidated' | 'expired';
  detected_at: string;
  triggered_at?: string;
  expires_at: string;
}

// ============================================
// Admin Alert Types
// ============================================

export type AlertType = 'loading' | 'entering' | 'adding' | 'take_profit' | 'exiting' | 'stopped_out' | 'update';

export interface AdminAlert {
  id: string;
  admin_id: string;
  symbol: string;
  direction: 'long' | 'short';
  alert_type: AlertType;
  contract?: string;
  entry_price?: number;
  stop_loss?: number;
  targets?: number[];
  message: string;
  ltp_justification?: string;
  created_at: string;
  is_active: boolean;
}

// ============================================
// AI Coach Types
// ============================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  richContent?: RichContent[];
  context?: {
    symbol?: string;
    setup?: DetectedSetup;
    trade?: TradeEntry;
  };
}

// Rich Content Types for AI Chat
export type RichContent =
  | LessonLinkContent
  | ChartWidgetContent
  | SetupVisualizationContent
  | QuizPromptContent
  | VideoTimestampContent
  | LTPAnalysisChartContent
  | CourseVideoContent;

export interface LessonLinkContent {
  type: 'lesson_link';
  moduleId: string;
  lessonId: string;
  title: string;
  duration: string;
  description?: string;
  moduleTitle?: string;
  /** If provided, enables direct canonical link instead of resolver */
  courseSlug?: string;
}

export interface ChartWidgetContent {
  type: 'chart';
  symbol: string;
  interval: '1' | '5' | '15' | '60' | 'D';
  indicators?: string[];
  annotations?: ChartAnnotation[];
}

export interface ChartAnnotation {
  type: 'horizontal_line' | 'arrow' | 'zone';
  price?: number;
  label: string;
  color: string;
}

export interface SetupVisualizationContent {
  type: 'setup';
  symbol: string;
  direction: 'long' | 'short';
  entry: number;
  stop: number;
  target: number;
  ltpScore: {
    level: number;
    trend: number;
    patience: number;
    total: number;
    grade: string;
  };
}

export interface QuizPromptContent {
  type: 'quiz';
  quizId: string;
  moduleId: string;
  title: string;
  description: string;
}

export interface VideoTimestampContent {
  type: 'video_timestamp';
  videoId: string;
  startMs: number;
  endMs: number;
  title: string;
  description?: string;
  source: 'youtube';
  thumbnailUrl?: string;
}

export interface LTPAnalysisChartContent {
  type: 'ltp_analysis_chart';
  symbol: string;
  date: string; // YYYY-MM-DD
  timeframe: '1m' | '5m' | '15m' | '1h' | 'day';
  title: string;
  summary: string;
  ltpAnalysis: {
    grade: string;
    levelScore: number;
    trendScore: number;
    patienceScore: number;
    recommendation: string;
  };
  keyLevels: Array<{
    type: string;
    price: number;
    label: string;
    strength: number;
  }>;
}

/**
 * Internal course video link with timestamp
 * Format: [[COURSE:courseSlug/moduleSlug/lessonSlug|timestampSeconds|Title]]
 * Example: [[COURSE:ltp-framework/core-concepts/patience-candles|120|Patience Candles Explained]]
 */
export interface CourseVideoContent {
  type: 'course_video';
  courseSlug: string;
  moduleSlug: string;
  lessonSlug: string;
  timestampSeconds: number;
  title: string;
  /** Formatted timestamp e.g. "2:00" or "1:30:45" */
  timestampFormatted?: string;
}

export interface CoachingSession {
  id: string;
  user_id: string;
  messages: ChatMessage[];
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================
// Curriculum Structure (KCU Content)
// ============================================

export interface CurriculumModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  lessons: CurriculumLesson[];
}

export interface CurriculumLesson {
  id: string;
  slug: string;
  title: string;
  description: string;
  video_id: string;
  duration: number;
  transcript: string;
  key_takeaways: string[];
  quiz_questions?: QuizQuestion[];
}

// ============================================
// Practice Scenario Types
// ============================================

export interface PracticeScenario {
  id: string;
  title: string;
  description: string;
  symbol: string;
  scenario_type: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  correct_action: 'long' | 'short' | 'wait';
  ltp_analysis: {
    level: { score: number; reason: string };
    trend: { score: number; reason: string };
    patience: { score: number; reason: string };
  };
  explanation: string;
  key_levels: Array<{ type: string; price: number; label: string }>;
  tags: string[];
  focus_area?: string;
  related_lesson_slug?: string;
  created_at?: string;
}
