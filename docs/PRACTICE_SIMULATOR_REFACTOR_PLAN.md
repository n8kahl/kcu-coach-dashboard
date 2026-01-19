# Practice Simulator UX Refactor: Production Implementation & Testing Plan

**Version:** 1.0
**Date:** January 19, 2026
**Status:** Ready for Implementation
**Estimated Duration:** 8-10 weeks

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Implementation Architecture](#3-implementation-architecture)
4. [Phase 1: Foundation & Onboarding](#4-phase-1-foundation--onboarding)
5. [Phase 2: Scenario Enhancement](#5-phase-2-scenario-enhancement)
6. [Phase 3: Tool Integration](#6-phase-3-tool-integration)
7. [Phase 4: Gamification & Analytics](#7-phase-4-gamification--analytics)
8. [Database Schema Changes](#8-database-schema-changes)
9. [API Specifications](#9-api-specifications)
10. [Component Architecture](#10-component-architecture)
11. [Testing Strategy](#11-testing-strategy)
12. [Deployment Plan](#12-deployment-plan)
13. [Success Metrics & KPIs](#13-success-metrics--kpis)
14. [Risk Mitigation](#14-risk-mitigation)
15. [Appendix](#15-appendix)

---

## 1. Executive Summary

### 1.1 Problem Statement

The current Practice Simulator suffers from critical UX deficiencies:

- **No onboarding or context** - Users are dropped into scenarios without understanding what LTP framework means
- **Unclear success criteria** - No visible goals, no feedback on correctness, ambiguous completion metrics
- **Disconnected tools** - Paper Trading, Options Chain, and Skill Exercises exist without integration
- **Information overload** - Key levels, indicators, and timeframes shown without explanation
- **No progressive disclosure** - Beginner and Advanced scenarios are visually identical

### 1.2 Solution Overview

Transform the Practice Simulator from a "figure it out" experience into a guided learning system that:

1. **Guides users** through each scenario with clear objectives and structured prompts
2. **Provides context** with pre-scenario briefings and concept introductions
3. **Integrates tools** meaningfully into the learning flow
4. **Tracks progress** with visible metrics and adaptive difficulty
5. **Motivates learners** through gamification and achievement systems

### 1.3 Key Deliverables

| Deliverable | Description | Priority |
|-------------|-------------|----------|
| Onboarding Flow | First-time user tutorial and concept introduction | P0 |
| Scenario Briefing System | Pre-scenario context cards with learning objectives | P0 |
| Guided Decision Framework | Structured choices replacing open-ended questions | P0 |
| Enhanced Feedback System | AI-powered coaching with visual LTP breakdown | P0 |
| Learning Path Architecture | Module-based progression with prerequisites | P1 |
| Tool Integration Layer | Contextual activation of Paper Trading, Options, Skills | P1 |
| Gamification System | Achievements, streaks, skill trees, leaderboards | P2 |
| Analytics Dashboard | Personal progress tracking and weak area identification | P2 |

---

## 2. Current State Analysis

### 2.1 Existing Component Inventory

```
src/components/practice/
├── practice-chart.tsx          # Main chart component (Lightweight Charts)
├── ChartGrid.tsx               # Multi-timeframe 5-chart layout
├── paper-trading-panel.tsx     # Paper trading interface ($25k account)
├── options-chain.tsx           # Options chain display
├── skill-exercises.tsx         # Skill drill exercises
├── replay-controller.tsx       # Candle-by-candle playback
├── DailyChallenge.tsx          # Daily challenge cards
├── Leaderboard.tsx             # User rankings
├── AchievementPopup.tsx        # Achievement notifications
├── AdvancedPracticeChart.tsx   # Extended chart features
├── LoadingSkeletons.tsx        # Loading states
└── engines/
    ├── QuickDrillEngine.tsx    # 30-second rapid fire mode
    ├── AIGeneratedEngine.tsx   # Claude-generated scenarios
    ├── LiveReplayEngine.tsx    # Real-time replay mode
    ├── DeepAnalysisEngine.tsx  # Full AI coaching mode
    └── MultiTFEngine.tsx       # Multi-timeframe analysis mode
```

### 2.2 Current Data Flow

```
User → PracticePage → fetchScenarios() → API → Supabase
                    → selectScenario() → API → ScenarioDetail
                    → submitDecision() → API → Claude (coaching) → Result
```

### 2.3 Identified Technical Debt

| Issue | Impact | Remediation |
|-------|--------|-------------|
| Single monolithic page component (1368 lines) | Hard to maintain, test | Split into feature components |
| No state management library | Props drilling, duplicated state | Implement Zustand store |
| Missing TypeScript strictness | Runtime errors | Enable strict mode |
| No component tests | Regression risk | Add comprehensive tests |
| Hardcoded scenario data in some modes | Inconsistent behavior | Centralize data fetching |

---

## 3. Implementation Architecture

### 3.1 New Component Architecture

```
src/
├── stores/
│   └── practice-store.ts           # Zustand store for practice state
├── components/practice/
│   ├── core/
│   │   ├── PracticeProvider.tsx    # Context provider
│   │   ├── PracticeLayout.tsx      # Main layout wrapper
│   │   └── PracticeRouter.tsx      # Mode-based routing
│   ├── onboarding/
│   │   ├── OnboardingFlow.tsx      # First-time user flow
│   │   ├── ConceptCard.tsx         # LTP concept introduction
│   │   └── InteractiveDemo.tsx     # Guided demo scenario
│   ├── scenario/
│   │   ├── ScenarioBriefing.tsx    # Pre-scenario context card
│   │   ├── ScenarioObjectives.tsx  # Learning objectives display
│   │   ├── ScenarioList.tsx        # Scenario selection sidebar
│   │   ├── ScenarioCard.tsx        # Individual scenario item
│   │   └── ScenarioFilters.tsx     # Difficulty/focus filters
│   ├── analysis/
│   │   ├── GuidedAnalysis.tsx      # Step-by-step analysis prompts
│   │   ├── LevelIdentifier.tsx     # Support/resistance marking tool
│   │   ├── TrendAnalyzer.tsx       # Trend assessment interface
│   │   └── PatienceTimer.tsx       # Entry timing guidance
│   ├── decision/
│   │   ├── DecisionFramework.tsx   # Structured decision UI
│   │   ├── DecisionOption.tsx      # Individual choice component
│   │   ├── ConfidenceRating.tsx    # User confidence slider
│   │   └── ReasoningInput.tsx      # Optional reasoning capture
│   ├── feedback/
│   │   ├── FeedbackPanel.tsx       # Result and coaching display
│   │   ├── LTPBreakdown.tsx        # Visual L-T-P score breakdown
│   │   ├── OutcomeVisualization.tsx # Chart outcome animation
│   │   └── NextStepsCard.tsx       # Recommended next actions
│   ├── tools/
│   │   ├── ToolProvider.tsx        # Tool context and state
│   │   ├── ContextualToolbar.tsx   # Dynamic tool suggestions
│   │   ├── IntegratedPaperTrading.tsx # Enhanced paper trading
│   │   └── IntegratedOptions.tsx   # Scenario-aware options
│   ├── progress/
│   │   ├── LearningPath.tsx        # Module progression view
│   │   ├── SkillTree.tsx           # Visual skill progression
│   │   ├── WeakAreaCard.tsx        # Improvement suggestions
│   │   └── ProgressStats.tsx       # Comprehensive stats
│   └── gamification/
│       ├── AchievementSystem.tsx   # Achievement tracking
│       ├── StreakTracker.tsx       # Streak visualization
│       ├── DailyMissions.tsx       # Redesigned daily challenges
│       └── Celebrations.tsx        # Success animations
```

### 3.2 State Management (Zustand)

```typescript
// src/stores/practice-store.ts
interface PracticeState {
  // Session
  sessionId: string | null;
  practiceMode: PracticeMode;

  // Scenario
  currentScenario: ScenarioDetail | null;
  scenarioPhase: 'briefing' | 'analysis' | 'decision' | 'feedback';

  // User Progress
  userStats: UserStats;
  learningPath: LearningModule[];
  completedModules: string[];

  // Analysis State
  userAnalysis: {
    identifiedLevels: Level[];
    trendAssessment: TrendAssessment | null;
    confidenceRating: number;
    reasoning: string;
  };

  // Timing
  startTime: number | null;
  timeRemaining: number | null;

  // Tools
  activeTools: ToolType[];
  paperTradingState: PaperTradingState;

  // Actions
  startScenario: (id: string) => Promise<void>;
  advancePhase: () => void;
  submitDecision: (decision: Decision) => Promise<FeedbackResult>;
  updateAnalysis: (update: Partial<UserAnalysis>) => void;
  activateTool: (tool: ToolType) => void;
}
```

### 3.3 API Enhancements

```typescript
// New endpoints required
POST /api/practice/onboarding/complete    // Mark onboarding done
GET  /api/practice/learning-path          // Get user's learning path
POST /api/practice/module/start           // Start a learning module
GET  /api/practice/scenario/:id/briefing  // Get scenario briefing
POST /api/practice/analysis/validate      // Validate user's level identification
GET  /api/practice/recommendations        // Get personalized recommendations
POST /api/practice/achievement/check      // Check for new achievements
GET  /api/practice/weak-areas             // Get identified weak areas
```

---

## 4. Phase 1: Foundation & Onboarding

**Duration:** 2 weeks
**Priority:** P0 - Critical

### 4.1 Onboarding Flow Implementation

#### 4.1.1 First-Time User Detection

```typescript
// src/hooks/useOnboarding.ts
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('practice_onboarding_complete');
    if (!hasCompletedOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  return { showOnboarding, onboardingStep, setOnboardingStep, completeOnboarding };
}
```

#### 4.1.2 Onboarding Steps

| Step | Content | Interaction |
|------|---------|-------------|
| 1 | Welcome + LTP Framework Introduction | Video/Animation |
| 2 | "Level" Concept Explanation | Interactive example |
| 3 | "Trend" Concept Explanation | Interactive example |
| 4 | "Patience" Concept Explanation | Interactive example |
| 5 | Practice Mode Overview | Mode selection tour |
| 6 | Guided Demo Scenario | Complete one scenario with hints |

#### 4.1.3 Acceptance Criteria

- [ ] First-time users see onboarding flow before accessing practice
- [ ] Onboarding can be skipped with warning
- [ ] Onboarding completion persists across sessions
- [ ] Re-access onboarding from settings
- [ ] Each LTP concept has interactive demonstration
- [ ] Demo scenario provides step-by-step guidance

### 4.2 Scenario Briefing System

#### 4.2.1 Briefing Card Structure

```typescript
interface ScenarioBriefing {
  id: string;
  scenarioId: string;

  // What user will learn
  learningObjectives: string[];

  // Concepts involved
  concepts: {
    name: string;
    description: string;
    relevance: string;
  }[];

  // Success criteria
  successCriteria: {
    metric: string;
    target: string;
  }[];

  // Optional concept review
  conceptReview?: {
    videoUrl?: string;
    textContent: string;
    exampleImage?: string;
    duration: string;
  };

  // Difficulty context
  difficultyExplanation: string;
  estimatedTime: string;
}
```

#### 4.2.2 Briefing UI Components

```
┌─────────────────────────────────────────────────────────────┐
│  📚 SCENARIO BRIEFING                           [Skip →]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🎯 LEARNING OBJECTIVES                                      │
│  ├─ Identify support levels using prior price action        │
│  ├─ Recognize signs of a failed breakdown                   │
│  └─ Determine optimal entry timing after reversal           │
│                                                              │
│  📖 KEY CONCEPTS                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Failed Breakdown                                      │   │
│  │ When price breaks below support but quickly reverses, │   │
│  │ often trapping short sellers and creating buying      │   │
│  │ pressure.                                             │   │
│  │                                        [Review →]     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ✓ SUCCESS CRITERIA                                          │
│  • Correctly identify the decision point                     │
│  • Choose the appropriate action (Long/Short/Wait)          │
│  • Complete within 3 minutes                                │
│                                                              │
│  ⏱️ Estimated: 3-5 minutes  |  📊 Difficulty: Beginner       │
│                                                              │
│  [← Back to List]              [Start Scenario →]           │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Acceptance Criteria

- [ ] All scenarios have briefing cards
- [ ] Briefing displays before chart loads
- [ ] Skip option available (recorded in analytics)
- [ ] Concept review links to related learning content
- [ ] Estimated time is based on historical data
- [ ] Success criteria are measurable and clear

### 4.3 Database Migrations

```sql
-- 001_add_onboarding_tracking.sql
CREATE TABLE practice_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 6,
  demo_scenario_completed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id)
);

-- 002_add_scenario_briefings.sql
CREATE TABLE scenario_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES practice_scenarios(id) ON DELETE CASCADE,
  learning_objectives JSONB NOT NULL DEFAULT '[]',
  concepts JSONB NOT NULL DEFAULT '[]',
  success_criteria JSONB NOT NULL DEFAULT '[]',
  concept_review JSONB,
  difficulty_explanation TEXT,
  estimated_time_minutes INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario_id)
);

-- 003_add_onboarding_progress.sql
CREATE TABLE onboarding_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  interaction_type VARCHAR(50) NOT NULL,
  interaction_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_onboarding_user ON onboarding_interactions(user_id);
```

### 4.4 Testing Requirements - Phase 1

#### Unit Tests

```typescript
// __tests__/components/onboarding/OnboardingFlow.test.tsx
describe('OnboardingFlow', () => {
  it('renders welcome step initially', () => {});
  it('advances to next step on continue', () => {});
  it('allows skipping with confirmation', () => {});
  it('marks completion in localStorage', () => {});
  it('calls API on completion', () => {});
});

// __tests__/components/scenario/ScenarioBriefing.test.tsx
describe('ScenarioBriefing', () => {
  it('displays all learning objectives', () => {});
  it('shows concepts with descriptions', () => {});
  it('displays success criteria', () => {});
  it('shows concept review link when available', () => {});
  it('calls onStart when Start Scenario clicked', () => {});
  it('records skip in analytics', () => {});
});
```

#### Integration Tests

```typescript
// __tests__/integration/onboarding-flow.test.tsx
describe('Onboarding Integration', () => {
  it('shows onboarding for new users', async () => {});
  it('skips onboarding for returning users', async () => {});
  it('persists progress across page refresh', async () => {});
  it('completes demo scenario with guidance', async () => {});
});
```

---

## 5. Phase 2: Scenario Enhancement

**Duration:** 3 weeks
**Priority:** P0 - Critical

### 5.1 Guided Analysis System

#### 5.1.1 Analysis Phase Structure

```
User Flow:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   BRIEFING  │ ──► │  ANALYZE    │ ──► │   DECIDE    │ ──► │  FEEDBACK   │
│             │     │  (Guided)   │     │  (Timed)    │     │  (AI Coach) │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ├── Step 1: Identify Key Level
                           ├── Step 2: Assess Trend
                           ├── Step 3: Evaluate Patience
                           └── Step 4: Make Decision
```

#### 5.1.2 Guided Analysis Component

```typescript
interface GuidedAnalysisProps {
  scenario: ScenarioDetail;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  onComplete: (analysis: UserAnalysis) => void;
}

interface AnalysisStep {
  id: string;
  title: string;
  instruction: string;
  hint?: string;
  interactionType: 'click_chart' | 'select_option' | 'slider' | 'text_input';
  validation?: (input: any) => ValidationResult;
  feedbackOnError?: string;
}

const BEGINNER_ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'identify_level',
    title: 'Identify the Key Level',
    instruction: 'Click on the chart where you see the most significant support or resistance level.',
    hint: 'Look for areas where price has bounced multiple times.',
    interactionType: 'click_chart',
    validation: (clickedPrice) => validateLevelProximity(clickedPrice, scenario.keyLevels),
    feedbackOnError: 'That level doesn\'t show strong historical significance. Look for areas with multiple touches.'
  },
  // ... more steps
];
```

#### 5.1.3 Difficulty-Based Scaffolding

| Difficulty | Scaffolding Level |
|------------|-------------------|
| Beginner | Full guidance: Highlighted areas, step-by-step prompts, hints available |
| Intermediate | Partial guidance: Steps shown, no highlights, hints on request |
| Advanced | Minimal guidance: Open analysis, no prompts, full autonomy |

### 5.2 Decision Framework

#### 5.2.1 Structured Decision UI

Replace open-ended "What is the best action?" with:

```typescript
interface DecisionOption {
  action: 'long' | 'short' | 'wait';
  label: string;
  reasoning: string[];
  confidence?: number;
}

// Example for a Failed Breakdown scenario
const decisionOptions: DecisionOption[] = [
  {
    action: 'long',
    label: 'Enter Long Position',
    reasoning: [
      'Breakdown has failed - price reclaimed support',
      'Short sellers are trapped and will need to cover',
      'Volume confirms reversal'
    ]
  },
  {
    action: 'wait',
    label: 'Wait for Confirmation',
    reasoning: [
      'Need more price action to confirm reversal',
      'Risk of false signal if breakdown resumes',
      'Better entries may come later'
    ]
  },
  {
    action: 'short',
    label: 'Enter Short Position',
    reasoning: [
      'Breakdown is still valid',
      'Support has become resistance',
      'Trend remains bearish'
    ]
  }
];
```

#### 5.2.2 Decision UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 MAKE YOUR DECISION                                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Based on your analysis, what is the best action?           │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📈 ENTER LONG                                       │    │
│  │ ──────────────────────────────────────────────────  │    │
│  │ • Breakdown has failed - price reclaimed support    │    │
│  │ • Short sellers trapped, will cover                 │    │
│  │ • Volume confirms reversal                          │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ⏸️ WAIT FOR CONFIRMATION                            │    │
│  │ ──────────────────────────────────────────────────  │    │
│  │ • Need more price action to confirm                 │    │
│  │ • Risk of false signal                              │    │
│  │ • Better entries may come                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📉 ENTER SHORT                                      │    │
│  │ ──────────────────────────────────────────────────  │    │
│  │ • Breakdown still valid                             │    │
│  │ • Support now resistance                            │    │
│  │ • Trend remains bearish                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  💡 Confidence Level: [═══════════●═══] 70%                  │
│                                                              │
│  📝 Optional: Add your reasoning                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Enhanced Feedback System

#### 5.3.1 Feedback Structure

```typescript
interface EnhancedFeedback {
  // Basic result
  isCorrect: boolean;
  correctAction: 'long' | 'short' | 'wait';

  // LTP Breakdown
  ltpBreakdown: {
    level: {
      score: number;  // 0-100
      assessment: string;
      keyInsight: string;
      userPerformance?: string;  // If user identified level
    };
    trend: {
      score: number;
      assessment: string;
      keyInsight: string;
      userPerformance?: string;
    };
    patience: {
      score: number;
      assessment: string;
      keyInsight: string;
      userPerformance?: string;
    };
  };

  // AI Coaching
  coaching: {
    summary: string;
    whatYouDidWell?: string[];
    whatYouMissed?: string[];
    improvement: string;
    personalizedTip?: string;
  };

  // Outcome visualization
  outcome: {
    priceMovement: number;  // Percentage
    timeToTarget: number;   // Candles
    maxDrawdown: number;    // If entered
    riskReward: number;
  };

  // Next steps
  recommendations: {
    relatedLesson?: string;
    similarScenarios?: string[];
    skillExercise?: string;
  };
}
```

#### 5.3.2 Visual LTP Breakdown Component

```
┌─────────────────────────────────────────────────────────────┐
│  📊 LTP ANALYSIS BREAKDOWN                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  LEVEL                                              85/100   │
│  [████████████████████████████████░░░░░░░░]                 │
│  ✓ Price at key support from Jan 15 swing low               │
│  ✓ Multiple prior bounces (4 touches)                       │
│  ✓ Confluence with daily 200 SMA                            │
│                                                              │
│  TREND                                              70/100   │
│  [████████████████████████████░░░░░░░░░░░░]                 │
│  ✓ Higher timeframe trend is bullish                        │
│  ⚠ 5-min showing lower highs (counter-trend)                │
│  ✓ 15-min EMA ribbon stacked bullish                        │
│                                                              │
│  PATIENCE                                           90/100   │
│  [████████████████████████████████████░░░░]                 │
│  ✓ Waited for failed breakdown confirmation                 │
│  ✓ Volume spike on reversal candle                          │
│  ✓ Clear invalidation level defined                         │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  OVERALL LTP SCORE: 82/100 - Strong Setup                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 Scenario-Specific Enhancements

#### 5.4.1 AMD - Failed Breakdown Recovery

```typescript
const AMD_SCENARIO_CONFIG = {
  briefing: {
    learningObjectives: [
      'Identify when a breakdown has failed',
      'Recognize short seller trapping mechanics',
      'Determine optimal entry after reversal confirmation'
    ],
    concepts: [{
      name: 'Failed Breakdown',
      description: 'When price breaks below support but quickly reverses, trapping short sellers',
      relevance: 'Creates high-probability long opportunities due to short covering'
    }],
    successCriteria: [
      { metric: 'Decision', target: 'Identify long entry opportunity' },
      { metric: 'Timing', target: 'Complete within 3 minutes' }
    ]
  },

  guidedAnalysis: {
    steps: [
      {
        title: 'Identify the Broken Support',
        instruction: 'Click on the support level that was broken',
        validation: (price) => isWithin(price, scenario.breakdownLevel, 0.5)
      },
      {
        title: 'Find the Reversal Point',
        instruction: 'Click where the breakdown failed and price reversed',
        validation: (price) => isWithin(price, scenario.reversalPoint, 0.5)
      },
      {
        title: 'Assess Short Seller Trap',
        instruction: 'How many candles below support before reversal?',
        options: ['1-2 candles', '3-5 candles', '6+ candles']
      }
    ]
  },

  decisionFramework: {
    options: [
      { action: 'long', label: 'Enter Long - Breakdown Failed' },
      { action: 'wait', label: 'Wait - Need More Confirmation' },
      { action: 'short', label: 'Enter Short - Breakdown Valid' }
    ]
  }
};
```

### 5.5 Database Migrations - Phase 2

```sql
-- 004_add_scenario_configurations.sql
CREATE TABLE scenario_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES practice_scenarios(id) ON DELETE CASCADE,
  guided_analysis_steps JSONB NOT NULL DEFAULT '[]',
  decision_options JSONB NOT NULL DEFAULT '[]',
  visual_annotations JSONB DEFAULT '[]',
  difficulty_modifiers JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario_id)
);

-- 005_add_user_analysis_tracking.sql
CREATE TABLE practice_user_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES practice_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  identified_levels JSONB DEFAULT '[]',
  trend_assessment JSONB,
  patience_evaluation JSONB,
  confidence_rating INTEGER CHECK (confidence_rating >= 0 AND confidence_rating <= 100),
  reasoning TEXT,
  analysis_time_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_analysis_attempt ON practice_user_analysis(attempt_id);
CREATE INDEX idx_user_analysis_user ON practice_user_analysis(user_id);

-- 006_add_enhanced_feedback.sql
ALTER TABLE practice_attempts
ADD COLUMN ltp_breakdown JSONB,
ADD COLUMN coaching_data JSONB,
ADD COLUMN outcome_data JSONB,
ADD COLUMN recommendations JSONB;
```

### 5.6 Testing Requirements - Phase 2

#### Unit Tests

```typescript
// __tests__/components/analysis/GuidedAnalysis.test.tsx
describe('GuidedAnalysis', () => {
  it('renders first step initially', () => {});
  it('validates level identification within tolerance', () => {});
  it('shows error feedback on incorrect level', () => {});
  it('advances to next step on valid input', () => {});
  it('calls onComplete with full analysis data', () => {});
  it('handles difficulty-based scaffolding', () => {});
});

// __tests__/components/decision/DecisionFramework.test.tsx
describe('DecisionFramework', () => {
  it('renders all decision options', () => {});
  it('highlights selected option', () => {});
  it('captures confidence rating', () => {});
  it('submits decision with metadata', () => {});
  it('disables during submission', () => {});
});

// __tests__/components/feedback/LTPBreakdown.test.tsx
describe('LTPBreakdown', () => {
  it('displays all three LTP components', () => {});
  it('shows correct score percentages', () => {});
  it('renders insights for each component', () => {});
  it('indicates overall score', () => {});
});
```

#### Integration Tests

```typescript
// __tests__/integration/scenario-flow.test.tsx
describe('Scenario Flow Integration', () => {
  it('completes full briefing → analysis → decision → feedback flow', async () => {});
  it('persists analysis data through decision phase', async () => {});
  it('generates AI coaching based on user analysis', async () => {});
  it('shows correct outcome visualization', async () => {});
});
```

---

## 6. Phase 3: Tool Integration

**Duration:** 2 weeks
**Priority:** P1 - High

### 6.1 Contextual Tool Activation

#### 6.1.1 Tool Activation Rules

```typescript
interface ToolActivationRule {
  tool: 'paper_trading' | 'options_chain' | 'skill_exercises';
  activateWhen: ActivationCondition;
  contextMessage: string;
  tutorialStep?: string;
}

const TOOL_ACTIVATION_RULES: ToolActivationRule[] = [
  {
    tool: 'paper_trading',
    activateWhen: {
      phase: 'feedback',
      condition: 'user_correct',
      scenarioType: ['breakout', 'reversal', 'continuation']
    },
    contextMessage: 'Great analysis! Now practice executing this trade with simulated capital.',
    tutorialStep: 'paper_trading_intro'
  },
  {
    tool: 'options_chain',
    activateWhen: {
      phase: 'feedback',
      condition: 'user_correct',
      minimumAttempts: 10,
      scenarioType: ['volatility', 'earnings', 'range_bound']
    },
    contextMessage: 'Ready to level up? See how options could optimize this trade.',
    tutorialStep: 'options_intro'
  },
  {
    tool: 'skill_exercises',
    activateWhen: {
      phase: 'feedback',
      condition: 'user_incorrect',
      weakAreaIdentified: true
    },
    contextMessage: 'Let\'s strengthen your {weakArea} recognition with targeted drills.',
    tutorialStep: 'skill_drill_intro'
  }
];
```

#### 6.1.2 Contextual Toolbar Component

```typescript
interface ContextualToolbarProps {
  currentPhase: ScenarioPhase;
  userResult?: DecisionResult;
  scenario: ScenarioDetail;
  userStats: UserStats;
}

const ContextualToolbar: React.FC<ContextualToolbarProps> = ({
  currentPhase,
  userResult,
  scenario,
  userStats
}) => {
  const activatedTools = useMemo(() => {
    return TOOL_ACTIVATION_RULES.filter(rule =>
      evaluateActivation(rule, currentPhase, userResult, scenario, userStats)
    );
  }, [currentPhase, userResult, scenario, userStats]);

  return (
    <div className="contextual-toolbar">
      {activatedTools.map(tool => (
        <ToolSuggestionCard
          key={tool.tool}
          tool={tool}
          onActivate={() => handleToolActivation(tool)}
        />
      ))}
    </div>
  );
};
```

### 6.2 Integrated Paper Trading

#### 6.2.1 Scenario-Aware Paper Trading

```typescript
interface IntegratedPaperTradingProps {
  scenario: ScenarioDetail;
  userDecision: 'long' | 'short' | 'wait';
  correctAction: 'long' | 'short' | 'wait';
  keyLevels: KeyLevel[];
}

const IntegratedPaperTrading: React.FC<IntegratedPaperTradingProps> = ({
  scenario,
  userDecision,
  correctAction,
  keyLevels
}) => {
  // Pre-populate based on scenario
  const suggestedEntry = useMemo(() =>
    calculateOptimalEntry(scenario, correctAction, keyLevels),
    [scenario, correctAction, keyLevels]
  );

  const suggestedStop = useMemo(() =>
    calculateStopLoss(scenario, correctAction, keyLevels),
    [scenario, correctAction, keyLevels]
  );

  const suggestedTarget = useMemo(() =>
    calculateTarget(scenario, correctAction, keyLevels),
    [scenario, correctAction, keyLevels]
  );

  return (
    <PaperTradingPanel
      symbol={scenario.symbol}
      currentPrice={scenario.chartData.candles[scenario.chartData.candles.length - 1].c}
      suggestedEntry={suggestedEntry}
      suggestedStop={suggestedStop}
      suggestedTarget={suggestedTarget}
      showGuidance={true}
      guidanceSteps={[
        `Entry near ${suggestedEntry.toFixed(2)} based on LTP analysis`,
        `Stop loss at ${suggestedStop.toFixed(2)} below key level`,
        `Target at ${suggestedTarget.toFixed(2)} for ${calculateRR(suggestedEntry, suggestedStop, suggestedTarget).toFixed(1)}R`
      ]}
    />
  );
};
```

### 6.3 Skill Exercise Integration

#### 6.3.1 Weak Area Detection

```typescript
interface WeakAreaAnalysis {
  userId: string;
  analyzedAttempts: number;
  weakAreas: {
    area: 'level_identification' | 'trend_assessment' | 'patience_timing' | 'decision_making';
    score: number;  // 0-100
    recentTrend: 'improving' | 'declining' | 'stable';
    suggestedExercises: string[];
    sampleScenarios: string[];
  }[];
  strengths: string[];
  overallAssessment: string;
}

// API endpoint
// GET /api/practice/weak-areas
async function getWeakAreas(userId: string): Promise<WeakAreaAnalysis> {
  const attempts = await db.practiceAttempts
    .where({ userId })
    .orderBy('createdAt', 'desc')
    .limit(50);

  return analyzeWeakAreas(attempts);
}
```

#### 6.3.2 Targeted Exercise Flow

```
User fails Level identification
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  💡 SKILL IMPROVEMENT SUGGESTION                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Your Level identification accuracy is 45%                   │
│  (below 70% target)                                          │
│                                                              │
│  🎯 Recommended Exercise: Level Identification Drill         │
│     • 10 quick charts                                        │
│     • Click to identify key levels                           │
│     • Instant feedback                                       │
│     • ~5 minutes                                             │
│                                                              │
│  [Start Drill]  [Skip for Now]  [Remind Me Later]           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 Testing Requirements - Phase 3

#### Unit Tests

```typescript
// __tests__/components/tools/ContextualToolbar.test.tsx
describe('ContextualToolbar', () => {
  it('shows paper trading after correct decision', () => {});
  it('shows skill exercises after incorrect decision', () => {});
  it('shows options chain for advanced users', () => {});
  it('respects minimum attempts for options', () => {});
});

// __tests__/hooks/useWeakAreaDetection.test.tsx
describe('useWeakAreaDetection', () => {
  it('identifies level identification as weak area', () => {});
  it('calculates trend from recent attempts', () => {});
  it('suggests appropriate exercises', () => {});
});
```

---

## 7. Phase 4: Gamification & Analytics

**Duration:** 2 weeks
**Priority:** P2 - Medium

### 7.1 Achievement System

#### 7.1.1 Achievement Definitions

```typescript
const PRACTICE_ACHIEVEMENTS: Achievement[] = [
  // Quantity achievements
  {
    id: 'first_attempt',
    name: 'First Steps',
    description: 'Complete your first practice scenario',
    icon: 'baby_steps',
    criteria: { attempts: 1 },
    xpReward: 10
  },
  {
    id: 'century',
    name: 'Century Club',
    description: 'Complete 100 practice scenarios',
    icon: 'trophy_gold',
    criteria: { attempts: 100 },
    xpReward: 500
  },

  // Accuracy achievements
  {
    id: 'perfect_10',
    name: 'Perfect Ten',
    description: 'Get 10 correct decisions in a row',
    icon: 'fire',
    criteria: { streak: 10 },
    xpReward: 100
  },
  {
    id: 'sharpshooter',
    name: 'Sharpshooter',
    description: 'Maintain 80%+ accuracy over 50 attempts',
    icon: 'target',
    criteria: { accuracy: 80, minAttempts: 50 },
    xpReward: 250
  },

  // Focus area achievements
  {
    id: 'level_master',
    name: 'Level Master',
    description: 'Score 90%+ on Level component in 20 scenarios',
    icon: 'chart_levels',
    criteria: { ltpComponent: 'level', score: 90, count: 20 },
    xpReward: 200
  },

  // Time-based achievements
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    description: 'Make a correct decision in under 30 seconds',
    icon: 'lightning',
    criteria: { correctInSeconds: 30 },
    xpReward: 50
  },
  {
    id: 'dedicated',
    name: 'Dedicated Learner',
    description: 'Practice for 7 consecutive days',
    icon: 'calendar',
    criteria: { consecutiveDays: 7 },
    xpReward: 150
  }
];
```

### 7.2 Learning Path Visualization

#### 7.2.1 Module Structure

```typescript
interface LearningModule {
  id: string;
  name: string;
  description: string;
  category: 'fundamentals' | 'intermediate' | 'advanced' | 'specialization';
  prerequisites: string[];
  scenarios: string[];
  skillDrills: string[];
  estimatedTime: string;
  completionCriteria: {
    scenariosCompleted: number;
    minAccuracy: number;
    skillDrillsCompleted?: number;
  };
}

const LEARNING_MODULES: LearningModule[] = [
  // Fundamentals
  {
    id: 'support_resistance',
    name: 'Support & Resistance Mastery',
    description: 'Learn to identify key price levels',
    category: 'fundamentals',
    prerequisites: [],
    scenarios: ['aapl_support_bounce', 'spy_resistance_rejection'],
    skillDrills: ['level_identification_basic'],
    estimatedTime: '45 mins',
    completionCriteria: { scenariosCompleted: 5, minAccuracy: 70 }
  },
  {
    id: 'failed_patterns',
    name: 'Failed Pattern Recognition',
    description: 'Identify breakdowns and breakouts that fail',
    category: 'fundamentals',
    prerequisites: ['support_resistance'],
    scenarios: ['amd_failed_breakdown', 'nvda_failed_breakout'],
    skillDrills: ['pattern_failure_detection'],
    estimatedTime: '60 mins',
    completionCriteria: { scenariosCompleted: 6, minAccuracy: 65 }
  },
  // ... more modules
];
```

#### 7.2.2 Skill Tree Component

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🌳 YOUR LEARNING PATH                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FUNDAMENTALS                                                            │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐                   │
│  │ Support &  │────►│ Failed     │────►│ Trend      │                   │
│  │ Resistance │     │ Patterns   │     │ Analysis   │                   │
│  │ ✓ 100%     │     │ ◐ 60%      │     │ 🔒 Locked  │                   │
│  └────────────┘     └────────────┘     └────────────┘                   │
│                            │                                             │
│                            ▼                                             │
│  INTERMEDIATE                                                            │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐                   │
│  │ Multi-TF   │────►│ Confluence │────►│ Entry      │                   │
│  │ Analysis   │     │ Trading    │     │ Timing     │                   │
│  │ 🔒 Locked  │     │ 🔒 Locked  │     │ 🔒 Locked  │                   │
│  └────────────┘     └────────────┘     └────────────┘                   │
│                                                                          │
│  ADVANCED                    SPECIALIZATIONS                             │
│  ┌────────────┐             ┌────────────┐  ┌────────────┐              │
│  │ Liquidity  │             │ Options    │  │ Scalping   │              │
│  │ Concepts   │             │ Focus      │  │ Focus      │              │
│  │ 🔒 Locked  │             │ 🔒 Locked  │  │ 🔒 Locked  │              │
│  └────────────┘             └────────────┘  └────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Daily Challenges Redesign

#### 7.3.1 Compact Challenge Display

```typescript
interface DailyChallenge {
  id: string;
  type: 'accuracy' | 'quantity' | 'focus' | 'streak' | 'speed';
  title: string;
  description: string;
  target: number;
  current: number;
  reward: {
    xp: number;
    achievement?: string;
    unlock?: string;
  };
  expiresAt: Date;
}

// Compact banner implementation
const DailyChallengesBanner: React.FC = () => {
  const challenges = useDailyChallenges();

  return (
    <div className="daily-challenges-banner">
      <div className="banner-header">
        <span>Today's Challenges</span>
        <span className="time-remaining">{formatTimeRemaining(challenges.expiresAt)}</span>
      </div>
      <div className="challenges-row">
        {challenges.active.map(challenge => (
          <ChallengeChip
            key={challenge.id}
            challenge={challenge}
            onClick={() => focusChallenge(challenge)}
          />
        ))}
      </div>
    </div>
  );
};
```

### 7.4 Personal Analytics Dashboard

#### 7.4.1 Analytics Components

```typescript
interface PersonalAnalytics {
  overview: {
    totalAttempts: number;
    accuracy: number;
    accuracyTrend: number[];  // Last 30 days
    avgTimePerScenario: number;
    totalPracticeTime: number;
  };

  ltpBreakdown: {
    level: { avgScore: number; trend: 'up' | 'down' | 'stable' };
    trend: { avgScore: number; trend: 'up' | 'down' | 'stable' };
    patience: { avgScore: number; trend: 'up' | 'down' | 'stable' };
  };

  scenarioPerformance: {
    byDifficulty: Record<string, { attempts: number; accuracy: number }>;
    byType: Record<string, { attempts: number; accuracy: number }>;
    bySymbol: Record<string, { attempts: number; accuracy: number }>;
  };

  learningVelocity: {
    modulesCompleted: number;
    currentStreak: number;
    weeklyProgress: number;
  };

  recommendations: string[];
}
```

### 7.5 Database Migrations - Phase 4

```sql
-- 007_add_achievements.sql
CREATE TABLE achievements (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(100),
  criteria JSONB NOT NULL,
  xp_reward INTEGER DEFAULT 0,
  category VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(100) NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress JSONB,
  UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- 008_add_learning_path.sql
CREATE TABLE learning_modules (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  prerequisites JSONB DEFAULT '[]',
  scenarios JSONB DEFAULT '[]',
  skill_drills JSONB DEFAULT '[]',
  estimated_time VARCHAR(50),
  completion_criteria JSONB NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_module_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id VARCHAR(100) NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  progress_data JSONB DEFAULT '{}',
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_module_progress_user ON user_module_progress(user_id);

-- 009_add_daily_challenges.sql
CREATE TABLE daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL,
  challenge_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  target INTEGER NOT NULL,
  reward JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(challenge_date, challenge_type)
);

CREATE TABLE user_daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES daily_challenges(id) ON DELETE CASCADE,
  current_progress INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX idx_user_daily_user ON user_daily_challenges(user_id);
```

### 7.6 Testing Requirements - Phase 4

#### Unit Tests

```typescript
// __tests__/components/gamification/AchievementSystem.test.tsx
describe('AchievementSystem', () => {
  it('detects first attempt achievement', () => {});
  it('tracks streak achievements correctly', () => {});
  it('calculates accuracy achievements', () => {});
  it('shows celebration on new achievement', () => {});
});

// __tests__/components/progress/LearningPath.test.tsx
describe('LearningPath', () => {
  it('shows completed modules as checked', () => {});
  it('locks modules with unmet prerequisites', () => {});
  it('calculates module progress correctly', () => {});
  it('highlights current module', () => {});
});

// __tests__/hooks/usePersonalAnalytics.test.tsx
describe('usePersonalAnalytics', () => {
  it('calculates LTP breakdown averages', () => {});
  it('identifies accuracy trends', () => {});
  it('generates relevant recommendations', () => {});
});
```

---

## 8. Database Schema Changes

### 8.1 Complete Migration Summary

| Migration | Description | Phase |
|-----------|-------------|-------|
| 001 | Onboarding tracking | 1 |
| 002 | Scenario briefings | 1 |
| 003 | Onboarding interactions | 1 |
| 004 | Scenario configurations | 2 |
| 005 | User analysis tracking | 2 |
| 006 | Enhanced feedback | 2 |
| 007 | Achievements | 4 |
| 008 | Learning path | 4 |
| 009 | Daily challenges | 4 |

### 8.2 Data Migration Scripts

```sql
-- Migrate existing scenarios to new briefing format
INSERT INTO scenario_briefings (scenario_id, learning_objectives, concepts, success_criteria)
SELECT
  id,
  jsonb_build_array(
    'Identify key price level',
    'Assess trend alignment',
    'Determine optimal action'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'name', scenario_type,
      'description', description,
      'relevance', 'Core LTP concept'
    )
  ),
  jsonb_build_array(
    jsonb_build_object('metric', 'Decision', 'target', 'Correct action')
  )
FROM practice_scenarios
WHERE NOT EXISTS (
  SELECT 1 FROM scenario_briefings WHERE scenario_id = practice_scenarios.id
);
```

### 8.3 Indexes and Performance

```sql
-- Performance indexes
CREATE INDEX CONCURRENTLY idx_attempts_user_created
  ON practice_attempts(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_attempts_scenario_correct
  ON practice_attempts(scenario_id, is_correct);

CREATE INDEX CONCURRENTLY idx_user_analysis_created
  ON practice_user_analysis(user_id, created_at DESC);

-- Materialized view for analytics
CREATE MATERIALIZED VIEW user_practice_stats AS
SELECT
  user_id,
  COUNT(*) as total_attempts,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_attempts,
  AVG(CASE WHEN is_correct THEN 1.0 ELSE 0.0 END) * 100 as accuracy_percent,
  AVG(time_taken_seconds) as avg_time_seconds,
  COUNT(DISTINCT DATE(created_at)) as days_practiced,
  MAX(created_at) as last_practice
FROM practice_attempts
GROUP BY user_id;

CREATE UNIQUE INDEX idx_user_practice_stats ON user_practice_stats(user_id);

-- Refresh materialized view (run periodically)
REFRESH MATERIALIZED VIEW CONCURRENTLY user_practice_stats;
```

---

## 9. API Specifications

### 9.1 New Endpoints

#### GET /api/practice/onboarding/status

```typescript
// Response
interface OnboardingStatusResponse {
  hasStarted: boolean;
  hasCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  demoScenarioCompleted: boolean;
}
```

#### POST /api/practice/onboarding/complete

```typescript
// Request
interface CompleteOnboardingRequest {
  skipped?: boolean;
  completedSteps: number[];
  demoScenarioId?: string;
}

// Response
interface CompleteOnboardingResponse {
  success: boolean;
  unlockedModules: string[];
  firstTimeBonus?: number;
}
```

#### GET /api/practice/scenario/:id/briefing

```typescript
// Response
interface ScenarioBriefingResponse {
  scenarioId: string;
  learningObjectives: string[];
  concepts: {
    name: string;
    description: string;
    relevance: string;
  }[];
  successCriteria: {
    metric: string;
    target: string;
  }[];
  conceptReview?: {
    videoUrl?: string;
    textContent: string;
    exampleImage?: string;
    duration: string;
  };
  difficultyExplanation: string;
  estimatedTime: string;
  guidedAnalysisConfig?: {
    steps: AnalysisStep[];
    difficulty: string;
  };
  decisionOptions: DecisionOption[];
}
```

#### POST /api/practice/analysis/validate

```typescript
// Request
interface ValidateAnalysisRequest {
  scenarioId: string;
  stepId: string;
  input: {
    type: 'price_click' | 'option_select' | 'slider' | 'text';
    value: any;
  };
}

// Response
interface ValidateAnalysisResponse {
  isValid: boolean;
  feedback?: string;
  hint?: string;
  correctAnswer?: any;
  nextStep?: string;
}
```

#### GET /api/practice/learning-path

```typescript
// Response
interface LearningPathResponse {
  modules: {
    id: string;
    name: string;
    description: string;
    category: string;
    status: 'locked' | 'available' | 'in_progress' | 'completed';
    progress: {
      scenariosCompleted: number;
      scenariosRequired: number;
      accuracy: number;
      requiredAccuracy: number;
    };
    prerequisites: {
      moduleId: string;
      moduleName: string;
      met: boolean;
    }[];
  }[];
  currentModule?: string;
  completedCount: number;
  totalModules: number;
}
```

#### GET /api/practice/weak-areas

```typescript
// Response
interface WeakAreasResponse {
  weakAreas: {
    area: string;
    score: number;
    trend: 'improving' | 'declining' | 'stable';
    suggestedExercises: {
      id: string;
      name: string;
      estimatedTime: string;
    }[];
    sampleScenarios: {
      id: string;
      title: string;
    }[];
  }[];
  strengths: string[];
  overallAssessment: string;
  analyzedAttempts: number;
}
```

#### GET /api/practice/analytics/personal

```typescript
// Response
interface PersonalAnalyticsResponse {
  overview: {
    totalAttempts: number;
    accuracy: number;
    accuracyTrend: { date: string; value: number }[];
    avgTimePerScenario: number;
    totalPracticeTimeMinutes: number;
  };
  ltpBreakdown: {
    level: { avgScore: number; trend: string };
    trend: { avgScore: number; trend: string };
    patience: { avgScore: number; trend: string };
  };
  scenarioPerformance: {
    byDifficulty: Record<string, { attempts: number; accuracy: number }>;
    byType: Record<string, { attempts: number; accuracy: number }>;
    bySymbol: Record<string, { attempts: number; accuracy: number }>;
  };
  achievements: {
    earned: number;
    total: number;
    recent: { id: string; name: string; earnedAt: string }[];
  };
  recommendations: string[];
}
```

### 9.2 API Rate Limits

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| GET /api/practice/scenarios | 100 | 1 min |
| POST /api/practice/submit | 30 | 1 min |
| POST /api/practice/ai-scenario | 10 | 1 min |
| GET /api/practice/analytics/* | 30 | 1 min |

---

## 10. Component Architecture

### 10.1 Component Dependency Graph

```
PracticeProvider
├── PracticeLayout
│   ├── PracticeHeader
│   │   ├── SessionStats
│   │   └── ModeSelector
│   ├── DailyChallengesBanner
│   └── PracticeRouter
│       ├── ScenarioListView
│       │   ├── ScenarioFilters
│       │   └── ScenarioCard[]
│       └── ScenarioDetailView
│           ├── ScenarioBriefing
│           │   ├── ObjectivesList
│           │   ├── ConceptCards
│           │   └── SuccessCriteria
│           ├── ChartArea
│           │   ├── PracticeChart / ChartGrid
│           │   ├── ReplayController
│           │   └── ChartAnnotations
│           ├── GuidedAnalysis
│           │   ├── AnalysisStep[]
│           │   ├── LevelIdentifier
│           │   └── TrendAnalyzer
│           ├── DecisionFramework
│           │   ├── DecisionOption[]
│           │   ├── ConfidenceRating
│           │   └── ReasoningInput
│           ├── FeedbackPanel
│           │   ├── ResultHeader
│           │   ├── LTPBreakdown
│           │   ├── CoachingFeedback
│           │   └── NextStepsCard
│           └── ContextualToolbar
│               ├── IntegratedPaperTrading
│               ├── IntegratedOptions
│               └── SkillExercises
├── LearningPathSidebar
│   ├── ModuleList
│   └── SkillTree
└── ProgressFooter
    ├── AchievementNotifications
    └── StreakTracker
```

### 10.2 Shared Component Library

```typescript
// src/components/practice/shared/index.ts
export { LTPScoreBar } from './LTPScoreBar';
export { DifficultyBadge } from './DifficultyBadge';
export { FocusAreaIcon } from './FocusAreaIcon';
export { ScenarioTypeBadge } from './ScenarioTypeBadge';
export { TimerDisplay } from './TimerDisplay';
export { ProgressRing } from './ProgressRing';
export { CelebrationAnimation } from './CelebrationAnimation';
export { HintButton } from './HintButton';
export { SkipButton } from './SkipButton';
```

---

## 11. Testing Strategy

### 11.1 Testing Pyramid

```
                    ┌───────────────┐
                    │     E2E       │  5%
                    │   (Cypress)   │
                    └───────────────┘
               ┌─────────────────────────┐
               │     Integration         │  20%
               │   (React Testing Lib)   │
               └─────────────────────────┘
          ┌───────────────────────────────────┐
          │           Unit Tests              │  75%
          │    (Jest + React Testing Lib)     │
          └───────────────────────────────────┘
```

### 11.2 Unit Test Coverage Requirements

| Category | Target Coverage | Critical Paths |
|----------|-----------------|----------------|
| Components | 80% | All user-facing components |
| Hooks | 90% | All custom hooks |
| Utils | 95% | All utility functions |
| Stores | 90% | All Zustand actions |
| API Routes | 85% | All endpoint handlers |

### 11.3 Test File Structure

```
__tests__/
├── components/
│   ├── onboarding/
│   │   ├── OnboardingFlow.test.tsx
│   │   ├── ConceptCard.test.tsx
│   │   └── InteractiveDemo.test.tsx
│   ├── scenario/
│   │   ├── ScenarioBriefing.test.tsx
│   │   ├── ScenarioList.test.tsx
│   │   └── ScenarioCard.test.tsx
│   ├── analysis/
│   │   ├── GuidedAnalysis.test.tsx
│   │   └── LevelIdentifier.test.tsx
│   ├── decision/
│   │   ├── DecisionFramework.test.tsx
│   │   └── ConfidenceRating.test.tsx
│   ├── feedback/
│   │   ├── FeedbackPanel.test.tsx
│   │   └── LTPBreakdown.test.tsx
│   ├── tools/
│   │   └── ContextualToolbar.test.tsx
│   └── gamification/
│       ├── AchievementSystem.test.tsx
│       └── LearningPath.test.tsx
├── hooks/
│   ├── useOnboarding.test.tsx
│   ├── usePracticeStore.test.tsx
│   ├── useWeakAreaDetection.test.tsx
│   └── useAchievements.test.tsx
├── stores/
│   └── practice-store.test.tsx
├── api/
│   ├── onboarding.test.ts
│   ├── scenarios.test.ts
│   ├── submit.test.ts
│   └── analytics.test.ts
├── integration/
│   ├── onboarding-flow.test.tsx
│   ├── scenario-flow.test.tsx
│   ├── tool-integration.test.tsx
│   └── gamification.test.tsx
└── e2e/
    ├── new-user-journey.cy.ts
    ├── scenario-completion.cy.ts
    ├── learning-path.cy.ts
    └── achievement-unlock.cy.ts
```

### 11.4 Critical E2E Test Scenarios

```typescript
// e2e/new-user-journey.cy.ts
describe('New User Journey', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.login('new-test-user@example.com');
  });

  it('shows onboarding for first-time user', () => {
    cy.visit('/practice');
    cy.get('[data-testid="onboarding-flow"]').should('be.visible');
    cy.get('[data-testid="onboarding-welcome"]').should('be.visible');
  });

  it('completes onboarding flow', () => {
    cy.visit('/practice');

    // Step through onboarding
    cy.get('[data-testid="onboarding-continue"]').click();
    cy.get('[data-testid="concept-level"]').should('be.visible');

    cy.get('[data-testid="onboarding-continue"]').click();
    cy.get('[data-testid="concept-trend"]').should('be.visible');

    cy.get('[data-testid="onboarding-continue"]').click();
    cy.get('[data-testid="concept-patience"]').should('be.visible');

    cy.get('[data-testid="onboarding-continue"]').click();
    cy.get('[data-testid="demo-scenario"]').should('be.visible');

    // Complete demo scenario
    cy.get('[data-testid="start-demo"]').click();
    cy.get('[data-testid="demo-hint"]').should('be.visible');
    cy.get('[data-testid="decision-long"]').click();
    cy.get('[data-testid="demo-complete"]').should('be.visible');

    // Verify onboarding complete
    cy.get('[data-testid="onboarding-flow"]').should('not.exist');
    cy.get('[data-testid="scenario-list"]').should('be.visible');
  });

  it('persists onboarding completion across sessions', () => {
    // Complete onboarding in first session
    cy.visit('/practice');
    cy.completeOnboarding(); // Custom command

    // Verify in new session
    cy.reload();
    cy.get('[data-testid="onboarding-flow"]').should('not.exist');
  });
});

// e2e/scenario-completion.cy.ts
describe('Scenario Completion Flow', () => {
  beforeEach(() => {
    cy.login('existing-user@example.com');
    cy.visit('/practice');
  });

  it('completes scenario with briefing', () => {
    // Select scenario
    cy.get('[data-testid="scenario-amd"]').click();

    // Verify briefing shows
    cy.get('[data-testid="scenario-briefing"]').should('be.visible');
    cy.get('[data-testid="learning-objectives"]').should('be.visible');
    cy.get('[data-testid="concepts"]').should('be.visible');

    // Start scenario
    cy.get('[data-testid="start-scenario"]').click();
    cy.get('[data-testid="practice-chart"]').should('be.visible');

    // Make decision
    cy.get('[data-testid="decision-long"]').click();
    cy.get('[data-testid="submit-decision"]').click();

    // Verify feedback
    cy.get('[data-testid="feedback-panel"]').should('be.visible');
    cy.get('[data-testid="ltp-breakdown"]').should('be.visible');
  });

  it('shows guided analysis for beginners', () => {
    cy.selectMode('standard');
    cy.selectScenario('beginner-level');
    cy.get('[data-testid="start-scenario"]').click();

    // Verify guided analysis shows
    cy.get('[data-testid="guided-analysis"]').should('be.visible');
    cy.get('[data-testid="analysis-step-1"]').should('be.visible');

    // Complete guided analysis
    cy.get('[data-testid="practice-chart"]').click(300, 200);
    cy.get('[data-testid="step-validation-success"]').should('be.visible');
  });
});
```

### 11.5 Test Data Fixtures

```typescript
// __tests__/fixtures/scenarios.ts
export const MOCK_SCENARIO: ScenarioDetail = {
  id: 'test-scenario-1',
  title: 'AMD Failed Breakdown Recovery',
  description: 'Price broke support then quickly reversed',
  symbol: 'AMD',
  scenarioType: 'failed_breakdown',
  difficulty: 'beginner',
  chartTimeframe: '5m',
  chartData: {
    candles: generateMockCandles(100),
    volume_profile: { high_vol_node: 145, low_vol_node: 140 }
  },
  keyLevels: [
    { type: 'support', price: 142.50, strength: 85, label: 'Prior swing low' },
    { type: 'resistance', price: 148.00, strength: 70, label: 'Recent high' }
  ],
  decisionPoint: { price: 143.20, time: 1705500000, context: 'Price attempting to reclaim support' },
  hasAttempted: false,
  correctAction: 'long',
  outcomeData: {
    result: 'win',
    exit_price: 147.50,
    pnl_percent: 3.0,
    candles_to_target: 15
  },
  ltpAnalysis: {
    level: { score: 85, reason: 'Strong support with multiple prior touches' },
    trend: { score: 70, reason: 'Higher timeframe bullish, short-term consolidation' },
    patience: { score: 90, reason: 'Waited for failed breakdown confirmation' }
  },
  explanation: 'Classic failed breakdown pattern with short squeeze potential'
};

export const MOCK_BRIEFING: ScenarioBriefing = {
  id: 'briefing-1',
  scenarioId: 'test-scenario-1',
  learningObjectives: [
    'Identify when a breakdown has failed',
    'Recognize short seller trapping mechanics',
    'Determine optimal entry after reversal'
  ],
  concepts: [{
    name: 'Failed Breakdown',
    description: 'When price breaks below support but quickly reverses',
    relevance: 'Creates long opportunities due to short covering'
  }],
  successCriteria: [
    { metric: 'Decision', target: 'Identify long entry' },
    { metric: 'Time', target: 'Under 3 minutes' }
  ],
  difficultyExplanation: 'Clear pattern with obvious levels',
  estimatedTime: '3 minutes'
};
```

### 11.6 Performance Testing

```typescript
// __tests__/performance/chart-rendering.perf.ts
import { performance } from 'perf_hooks';

describe('Chart Rendering Performance', () => {
  it('renders 500 candles under 100ms', async () => {
    const candles = generateMockCandles(500);
    const start = performance.now();

    render(<PracticeChart chartData={{ candles }} />);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('handles rapid candle updates smoothly', async () => {
    const { rerender } = render(<PracticeChart chartData={{ candles: [] }} />);
    const timings: number[] = [];

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      rerender(<PracticeChart chartData={{ candles: generateMockCandles(i + 1) }} />);
      timings.push(performance.now() - start);
    }

    const avgTime = timings.reduce((a, b) => a + b, 0) / timings.length;
    expect(avgTime).toBeLessThan(16); // 60fps target
  });
});
```

### 11.7 Accessibility Testing

```typescript
// __tests__/accessibility/practice-a11y.test.tsx
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Practice Accessibility', () => {
  it('has no accessibility violations on briefing screen', async () => {
    const { container } = render(<ScenarioBriefing briefing={MOCK_BRIEFING} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations on decision screen', async () => {
    const { container } = render(<DecisionFramework options={MOCK_OPTIONS} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation through decisions', () => {
    render(<DecisionFramework options={MOCK_OPTIONS} />);

    userEvent.tab();
    expect(screen.getByTestId('decision-long')).toHaveFocus();

    userEvent.tab();
    expect(screen.getByTestId('decision-wait')).toHaveFocus();

    userEvent.keyboard('{Enter}');
    expect(screen.getByTestId('decision-wait')).toHaveAttribute('aria-selected', 'true');
  });
});
```

---

## 12. Deployment Plan

### 12.1 Deployment Strategy

```
Feature Flag Rollout:
┌─────────────────────────────────────────────────────────────┐
│  Week 1-2: Internal Testing (flag: practice_v2_internal)    │
│  ├─ Development team only                                   │
│  └─ Full feature set enabled                                │
├─────────────────────────────────────────────────────────────┤
│  Week 3: Beta Users (flag: practice_v2_beta)                │
│  ├─ 5% of users (opted-in beta testers)                     │
│  └─ Feedback collection enabled                             │
├─────────────────────────────────────────────────────────────┤
│  Week 4-5: Gradual Rollout                                  │
│  ├─ 25% → 50% → 75% → 100%                                  │
│  └─ Monitor key metrics at each stage                       │
├─────────────────────────────────────────────────────────────┤
│  Week 6: Full Release                                       │
│  ├─ Remove feature flags                                    │
│  └─ Deprecate v1 code                                       │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Feature Flags Configuration

```typescript
// src/lib/feature-flags.ts
export const PRACTICE_V2_FLAGS = {
  // Phase 1
  ONBOARDING_FLOW: 'practice_v2_onboarding',
  SCENARIO_BRIEFING: 'practice_v2_briefing',

  // Phase 2
  GUIDED_ANALYSIS: 'practice_v2_guided_analysis',
  DECISION_FRAMEWORK: 'practice_v2_decision',
  ENHANCED_FEEDBACK: 'practice_v2_feedback',

  // Phase 3
  CONTEXTUAL_TOOLS: 'practice_v2_tools',
  INTEGRATED_PAPER: 'practice_v2_paper',
  WEAK_AREA_DETECTION: 'practice_v2_weak_areas',

  // Phase 4
  ACHIEVEMENT_SYSTEM: 'practice_v2_achievements',
  LEARNING_PATH: 'practice_v2_learning_path',
  ANALYTICS_DASHBOARD: 'practice_v2_analytics',

  // Master flag
  FULL_V2: 'practice_v2_full'
};

export function isPracticeV2Enabled(flag: string, userId?: string): boolean {
  // Implementation using your feature flag service
}
```

### 12.3 Rollback Plan

```
Rollback Triggers:
├─ Error rate > 1% (vs baseline)
├─ Scenario completion rate drops > 10%
├─ User-reported critical bugs
└─ Performance degradation > 20%

Rollback Steps:
1. Disable feature flags for affected component
2. Alert on-call engineer
3. Collect error logs and user reports
4. Root cause analysis
5. Fix and re-deploy

Rollback SLA: < 15 minutes for flag toggle
```

### 12.4 Database Migration Strategy

```bash
# Pre-deployment
npm run db:migrate:check    # Verify migrations are safe
npm run db:backup:create    # Create backup before migration

# Deployment
npm run db:migrate          # Run migrations
npm run db:migrate:verify   # Verify migration success

# Post-deployment (if issues)
npm run db:migrate:rollback # Rollback last migration
npm run db:backup:restore   # Restore from backup if needed
```

---

## 13. Success Metrics & KPIs

### 13.1 Primary Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Scenario Completion Rate | ~40% | 80% | Completed / Started |
| Return User Rate (7-day) | ~25% | 60% | Users returning within 7 days |
| Average Scenarios/Session | 1.5 | 3+ | Scenarios per session |
| User Satisfaction (NPS) | Unknown | 40+ | Post-session survey |

### 13.2 Learning Effectiveness Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Accuracy Improvement | +15% over 20 attempts | Compare first 10 vs next 10 |
| Concept Retention | 70% at 7-day retest | Spaced repetition drill accuracy |
| Weak Area Remediation | 50% improve within 2 weeks | Score change after targeted practice |
| Module Completion | 60% complete first module | Users starting → completing Module 1 |

### 13.3 Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users | +50% | DAU on practice page |
| Session Duration | +100% | Time spent in practice mode |
| Tool Usage Rate | 30% | Users activating Paper Trading/Options |
| Achievement Unlock Rate | 40% earn first achievement | Users with at least one achievement |
| Streak Retention | 20% maintain 7-day streak | Users with consecutive day practice |

### 13.4 Monitoring Dashboard

```typescript
// Key metrics to display on admin dashboard
interface PracticeMetricsDashboard {
  realTime: {
    activeUsers: number;
    scenariosInProgress: number;
    submissionsPerMinute: number;
    errorRate: number;
  };

  daily: {
    uniqueUsers: number;
    totalAttempts: number;
    completionRate: number;
    averageAccuracy: number;
    newUsersOnboarded: number;
  };

  trends: {
    userGrowth: TimeSeriesData[];
    accuracyTrend: TimeSeriesData[];
    engagementTrend: TimeSeriesData[];
    moduleProgress: ModuleMetrics[];
  };

  alerts: {
    lowCompletionRate: boolean;
    highErrorRate: boolean;
    performanceDegradation: boolean;
  };
}
```

---

## 14. Risk Mitigation

### 14.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Chart library performance issues | Medium | High | Pre-load chart data, virtualize large datasets |
| AI coaching latency | High | Medium | Cache common feedback, show loading state gracefully |
| Database migration failures | Low | Critical | Thorough testing, backup before migration |
| Feature flag conflicts | Medium | Medium | Clear documentation, integration tests |

### 14.2 User Experience Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Onboarding too long | Medium | High | Make skippable, track drop-off points |
| Guided analysis frustrating | Medium | High | Offer difficulty settings, allow skip |
| Information overload | High | Medium | Progressive disclosure, minimize initial UI |
| Gamification feels gimmicky | Medium | Low | Make optional, focus on learning value |

### 14.3 Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low adoption of new features | Medium | High | Beta testing, user feedback loops |
| Increased AI costs | High | Medium | Caching, rate limiting, cost monitoring |
| Extended timeline | Medium | Medium | Phased delivery, MVP first |

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|------------|
| LTP | Level, Trend, Patience - the core trading framework |
| Scenario | A practice exercise with chart data and correct answer |
| Briefing | Pre-scenario context card explaining objectives |
| Guided Analysis | Step-by-step prompts helping users analyze scenarios |
| Decision Framework | Structured options replacing open-ended questions |
| Weak Area | Identified skill gap based on user performance |

### 15.2 Related Documents

- [PRACTICE_MODE_IMPLEMENTATION.md](./PRACTICE_MODE_IMPLEMENTATION.md) - Original implementation plan
- [UI-UX-SPECIFICATION.md](./UI-UX-SPECIFICATION.md) - UI/UX design guidelines
- [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md) - Database schema documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview

### 15.3 Team Responsibilities

| Role | Responsibilities |
|------|------------------|
| Frontend Lead | Component architecture, UI implementation |
| Backend Lead | API endpoints, database migrations |
| UX Designer | Wireframes, user flows, usability testing |
| QA Engineer | Test strategy, E2E tests, regression testing |
| Product Owner | Requirements, prioritization, acceptance |

### 15.4 Timeline Summary

```
Week 1-2:   Phase 1 - Foundation & Onboarding
Week 3-5:   Phase 2 - Scenario Enhancement
Week 6-7:   Phase 3 - Tool Integration
Week 8-9:   Phase 4 - Gamification & Analytics
Week 10:    Final QA, Bug Fixes, Launch Prep
```

### 15.5 Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | | | |
| Engineering Lead | | | |
| UX Lead | | | |
| QA Lead | | | |

---

*Document Version: 1.0*
*Last Updated: January 19, 2026*
*Status: Ready for Review*
