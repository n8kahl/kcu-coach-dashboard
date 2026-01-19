# KCU Practice Page - Complete Audit & Refactor Plan

**Document Version:** 1.0
**Date:** January 19, 2026
**Author:** Claude (AI Assistant)
**Status:** Ready for Implementation

---

## Executive Summary

The KCU Practice Simulator page has been thoroughly audited from four perspectives: Beginner Day Trader, Expert Trainer (Somesh), AI Engineer, and LTP Admin. This document outlines all identified issues, their root causes, and a comprehensive plan to transform the practice page into a professional-grade trading simulator that matches TradingView's quality.

---

## Table of Contents

1. [Critical Issues](#1-critical-issues)
2. [Feature Audit](#2-feature-audit)
3. [UX/Design Issues](#3-uxdesign-issues)
4. [Four Perspectives Analysis](#4-four-perspectives-analysis)
5. [Technical Architecture](#5-technical-architecture)
6. [Implementation Plan](#6-implementation-plan)
7. [File Reference](#7-file-reference)
8. [Success Criteria](#8-success-criteria)

---

## 1. Critical Issues

### 1.1 Only 8 Candles in Chart Data (ROOT CAUSE)

**Severity:** 🔴 CRITICAL
**Impact:** Charts appear nearly empty, users cannot identify patterns
**Location:** `/supabase/seeds/practice_scenarios.sql`

**Current State:**
```sql
-- Each scenario only has 8 candles hardcoded:
'{"candles":[
  {"t":1704898800000,"o":185.20,"h":185.45,...},
  {"t":1704899100000,...},
  ... 8 total candles
]}'
```

**Expected State:**
- Minimum 100 candles per scenario
- Pre-market context included
- Multiple timeframe data available

**Root Cause Analysis:**
The chart component (`practice-chart.tsx`) sets `initialCandleCount = 50` but the database seed data only provides 8 candles per scenario. The infrastructure supports more data, but the data source is severely limited.

---

### 1.2 "Failed to Load Challenges" Error

**Severity:** 🔴 CRITICAL
**Impact:** Challenge system completely broken
**Location:** `/supabase/migrations/024_practice_enhancements.sql`

**Current State:**
- Migration creates `practice_challenges`, `practice_challenge_progress`, `user_practice_xp` tables
- Migration has NOT been deployed to production Supabase
- Temporary mock data fallback added to `DailyChallenge.tsx`

**Fix Required:**
```bash
# Deploy migration to Supabase
supabase db push
# Or run migration manually in Supabase SQL editor
```

---

### 1.3 Non-Functional Bottom Toolbar Buttons

**Severity:** 🔴 CRITICAL
**Impact:** Core features inaccessible

| Button | Status | Issue |
|--------|--------|-------|
| Paper Trading | ❌ Broken | Panel component exists but state toggle doesn't work |
| Options Chain | ❌ Broken | `OptionsChainPanel` imported but not wired |
| Skill Exercises | ❌ Broken | `SkillExercises` component exists but panel doesn't open |

**Location:** `/src/app/(dashboard)/practice/page.tsx` (lines ~950-1000)

**Current Code:**
```typescript
// Buttons exist but onClick handlers may not update rightPanel state correctly
<button onClick={() => setRightPanel(rightPanel === 'paper-trading' ? null : 'paper-trading')}>
  Paper Trading
</button>
```

**Issue:** The `rightPanel` state management and conditional rendering may be incomplete.

---

## 2. Feature Audit

### 2.1 Practice Modes

| Mode | Expected Behavior | Current Status | Issues |
|------|-------------------|----------------|--------|
| **Standard** | Basic scenario practice | 🟡 Partial | Only 8 candles shown |
| **Quick Drill** | Rapid-fire decisions | 🔴 Broken | Mode switch doesn't change behavior |
| **Deep Analysis** | Extended analysis time | 🔴 Broken | No timer or analysis tools |
| **AI Generated** | Dynamic scenarios | 🔴 Broken | No AI generation endpoint |
| **Multi-TF** | Multiple timeframes | 🔴 Broken | Shows same data, no TF switching |
| **Live Replay** | Real-time candle reveal | 🔴 Broken | No replay animation logic |

### 2.2 Indicator System

**Location:** `/src/components/practice/practice-chart.tsx`

```typescript
interface IndicatorSettings {
  showVWAP: boolean;
  showVWAPBands: boolean;
  showEMA9: boolean;
  showEMA21: boolean;
  showEMARibbon: boolean;
  showVolumeProfile: boolean;
}
```

**Current Indicator Colors:**

| Indicator | Current Color | KCU Required Color |
|-----------|---------------|-------------------|
| EMA 9 | Blue (#3b82f6) | 🟢 **Green** (#22c55e) |
| EMA 21 | Orange (#f97316) | 🔴 **Red** (#ef4444) |
| VWAP | Purple (#8b5cf6) | ✅ Correct |
| VWAP Bands | Purple w/ opacity | Need ±1, ±2 SD bands |
| Ripster Clouds | ❌ Not implemented | Need EMA ribbon fills |

### 2.3 Timeframe System

**Current Timeframes:** 2m, 5m, 15m, 1H, 4H, D, W

**Issues:**
- Timeframe buttons change state but don't fetch new data
- No smooth transition animation
- Same 8 candles displayed regardless of timeframe
- No multi-timeframe correlation view

### 2.4 Paper Trading System

**Component:** `/src/components/practice/PaperTradingPanel.tsx` (if exists)

**Expected Features:**
- Starting balance (default $25,000)
- Position sizing calculator
- Risk management (1-2% per trade)
- P&L tracking
- Trade journal

**Current Status:** Panel exists in imports but doesn't open when button clicked.

### 2.5 Options Chain System

**Component:** `/src/components/practice/OptionsChainPanel.tsx` (if exists)

**Expected Features:**
- 0DTE option pricing
- Strike selection
- Greeks display (Delta, Gamma, Theta, Vega)
- P&L calculator for options

**Current Status:** Component imported but not functional.

### 2.6 Skill Exercises System

**Component:** `/src/components/practice/SkillExercises.tsx`

**Expected Features:**
- Level identification drills
- Trend recognition exercises
- Entry/exit timing practice
- Pattern recognition quizzes

**Current Status:** Component exists but panel doesn't open.

---

## 3. UX/Design Issues

### 3.1 No Animations or Transitions

**Issues:**
- Mode switching is instant, jarring
- Panel opening has no animation
- No loading skeletons during data fetch
- No micro-interactions on buttons
- Chart updates are abrupt

**Required:**
```css
/* Example transition classes needed */
.panel-enter { opacity: 0; transform: translateX(100%); }
.panel-enter-active { opacity: 1; transform: translateX(0); transition: all 300ms ease-out; }

.mode-switch { transition: background-color 200ms, transform 100ms; }
.mode-switch:active { transform: scale(0.98); }
```

### 3.2 Old-Looking Buttons

**Issues:**
- Basic shadcn buttons without customization
- No hover effects or active states
- Missing icons on most buttons
- No visual hierarchy

**Required:**
- Custom button variants for trading actions
- Icon + text combinations
- Color-coded action buttons (green=bullish, red=bearish)
- Pressed/active states

### 3.3 Layout Problems

**Issues:**
- Right panel is cramped
- Chart doesn't resize smoothly when panels open/close
- Poor mobile responsiveness
- Tools toolbar is cluttered
- No clear visual hierarchy

**Required Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Mode Selector | Timeframes | Settings              │
├───────────────────────────────────────┬─────────────────────┤
│                                       │                     │
│           CHART AREA                  │   CONTEXT PANEL     │
│         (70% width)                   │   (30% width)       │
│       100+ candles                    │   - Scenario Info   │
│       Proper indicators               │   - AI Coaching     │
│                                       │   - Trade Tools     │
│                                       │                     │
├───────────────────────────────────────┴─────────────────────┤
│ Action Bar: [BULLISH] [BEARISH] [WAIT] | Position Sizing   │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Not Beginner Friendly

**Issues:**
- No tooltips explaining modes
- No onboarding flow for new users
- No "what should I look for?" guidance
- Technical jargon without explanation
- No progressive disclosure of features

**Required:**
- Tooltips on all interactive elements
- First-time user tutorial
- "Hint" button for each scenario
- Difficulty progression system
- LTP Framework visual guides

---

## 4. Four Perspectives Analysis

### 4.1 👶 Beginner Day Trader Perspective

**Pain Points:**
1. "I don't understand what any of these modes mean"
2. "Why are there only 5 candles? I can't see any patterns"
3. "What am I supposed to be looking for?"
4. "Where's my paper money balance?"
5. "How do I know if my answer was right?"
6. "The indicators don't look like what Somesh showed in the videos"

**Requirements:**
- Clear mode descriptions with difficulty levels
- 100+ candles with historical context
- Visual guides showing key levels (support, resistance, VWAP)
- Paper trading balance always visible
- Immediate feedback with explanation
- Indicator colors matching course content

### 4.2 🎓 Expert Trainer (Somesh) Perspective

**Pain Points:**
1. "The EMAs are wrong colors - I teach green 9, red 21"
2. "Where are the Ripster clouds?"
3. "Students need to see at least 50-100 candles for context"
4. "The VWAP bands need to show +1 and +2 standard deviations"
5. "Opening Range Breakout levels aren't marked"
6. "No pre-market data for context"

**Requirements:**
- EMA 9 = Green (#22c55e)
- EMA 21 = Red (#ef4444)
- VWAP = Purple with ±1 SD and ±2 SD bands
- Ripster clouds (EMA ribbon fill between 8 and 21)
- ORB levels (first 5-minute or 15-minute range)
- Pre-market high/low markers
- Previous day high/low/close levels

**LTP Framework Integration:**
```
L - LEVEL: Support/Resistance identification
T - TREND: EMA relationship and cloud direction
P - PATIENCE: Wait for confirmation at levels
```

### 4.3 🤖 AI Engineer Perspective

**Pain Points:**
1. "AI Generated mode doesn't call any AI endpoint"
2. "Coaching feedback could use RAG from course transcripts"
3. "Should generate scenarios dynamically based on user weaknesses"
4. "No telemetry on which scenarios users struggle with"
5. "Feedback is generic, not personalized"

**Requirements:**
- Claude API integration for scenario generation
- RAG system using KCU course transcripts
- User performance analytics
- Personalized coaching based on mistake patterns
- Spaced repetition for challenging scenarios
- A/B testing for scenario effectiveness

**Proposed AI Architecture:**
```
User Response → Performance Analysis → Weakness Detection
                                            ↓
Course Transcripts (RAG) ← AI Coaching Engine → Personalized Feedback
                                            ↓
                              Adaptive Scenario Selection
```

### 4.4 👨‍💼 LTP Admin Perspective

**Pain Points:**
1. "Challenge system is broken - table doesn't exist"
2. "XP/leveling system exists in schema but not shown in UI"
3. "Leaderboard view exists but no page displays it"
4. "Need admin panel to add/edit scenarios"
5. "Can't track student progress across cohorts"

**Requirements:**
- Deploy migration 024 to fix challenges
- Display XP and level progression in UI
- Create leaderboard page or component
- Admin dashboard for scenario management
- Cohort-based progress tracking
- Export functionality for progress reports

**Database Tables Needed:**
```sql
-- These exist in migration 024 but not deployed:
practice_challenges
practice_challenge_progress
user_practice_xp

-- Additional tables needed:
practice_user_analytics
practice_cohort_progress
practice_scenario_effectiveness
```

---

## 5. Technical Architecture

### 5.1 Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Practice Page (page.tsx)                  │
│                         1366 lines                          │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                │
│  ├── PracticeChart (practice-chart.tsx)                    │
│  ├── DailyChallenge (DailyChallenge.tsx)                   │
│  ├── PaperTradingPanel (imported but broken)               │
│  ├── OptionsChainPanel (imported but broken)               │
│  └── SkillExercises (imported but broken)                  │
├─────────────────────────────────────────────────────────────┤
│  API Routes:                                                │
│  ├── /api/practice/scenarios (GET all)                     │
│  ├── /api/practice/scenarios/[id] (GET one)                │
│  └── /api/practice/submit (POST decision)                  │
├─────────────────────────────────────────────────────────────┤
│  Data:                                                      │
│  ├── practice_scenarios table (75+ scenarios)              │
│  ├── chart_data column (8 candles per scenario!)           │
│  └── Seeds: practice_scenarios.sql                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Practice Page (Refactored)                │
├─────────────────────────────────────────────────────────────┤
│  Layout Components:                                         │
│  ├── PracticeHeader (mode selector, timeframes)            │
│  ├── PracticeChart (enhanced, 100+ candles)                │
│  ├── PracticeContextPanel (collapsible right panel)        │
│  └── PracticeActionBar (decisions, position sizing)        │
├─────────────────────────────────────────────────────────────┤
│  Feature Components:                                        │
│  ├── PaperTradingWidget (always visible balance)           │
│  ├── OptionsChainModal (full options interface)            │
│  ├── SkillExercisesPanel (drill exercises)                 │
│  ├── AICoachingPanel (personalized feedback)               │
│  └── ProgressTracker (XP, level, streaks)                  │
├─────────────────────────────────────────────────────────────┤
│  Mode Engines:                                              │
│  ├── StandardModeEngine                                    │
│  ├── QuickDrillEngine (timed, rapid-fire)                  │
│  ├── DeepAnalysisEngine (extended analysis)                │
│  ├── AIGeneratedEngine (Claude integration)                │
│  ├── MultiTFEngine (synchronized timeframes)               │
│  └── LiveReplayEngine (candle-by-candle reveal)            │
├─────────────────────────────────────────────────────────────┤
│  Data Layer:                                                │
│  ├── MarketDataService (Polygon/Massive.com)               │
│  ├── ScenarioGenerator (AI-powered)                        │
│  └── AnalyticsService (user performance)                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Data Flow

```
1. User selects mode → Mode Engine initializes
2. Mode Engine requests scenario → ScenarioService
3. ScenarioService fetches from DB or generates via AI
4. MarketDataService augments with real historical data (100+ candles)
5. Chart renders with proper indicators
6. User makes decision → SubmissionService
7. AI analyzes response → CoachingService
8. Feedback displayed with course references (RAG)
9. Analytics updated → ProgressService
10. Next scenario selected based on performance
```

---

## 6. Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Priority:** 🔴 Must complete before any other work

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 1.1 Generate 100+ candle data for all scenarios | `practice_scenarios.sql` | 4h | - |
| 1.2 Deploy migration 024 | Supabase console | 0.5h | - |
| 1.3 Fix Paper Trading button | `page.tsx` | 1h | - |
| 1.4 Fix Options Chain button | `page.tsx` | 1h | - |
| 1.5 Fix Skill Exercises button | `page.tsx` | 1h | - |

**Deliverable:** All buttons work, charts show 100+ candles, challenges load

### Phase 2: Indicator Corrections (Week 1-2)

**Priority:** 🟠 High - Core teaching methodology

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 2.1 Change EMA 9 to green | `practice-chart.tsx` | 0.5h | - |
| 2.2 Change EMA 21 to red | `practice-chart.tsx` | 0.5h | - |
| 2.3 Add VWAP ±1 SD band | `practice-chart.tsx` | 2h | - |
| 2.4 Add VWAP ±2 SD band | `practice-chart.tsx` | 1h | - |
| 2.5 Implement Ripster clouds | `practice-chart.tsx` | 3h | - |
| 2.6 Add ORB level markers | `practice-chart.tsx` | 2h | - |
| 2.7 Add pre-market H/L markers | `practice-chart.tsx` | 2h | - |

**Deliverable:** Chart matches Somesh's teaching methodology exactly

### Phase 3: Mode Implementation (Week 2-3)

**Priority:** 🟠 High - Core functionality

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 3.1 Implement Quick Drill engine | New: `QuickDrillEngine.tsx` | 4h | - |
| 3.2 Implement Deep Analysis engine | New: `DeepAnalysisEngine.tsx` | 4h | - |
| 3.3 Implement Multi-TF engine | New: `MultiTFEngine.tsx` | 6h | - |
| 3.4 Implement Live Replay engine | New: `LiveReplayEngine.tsx` | 6h | - |
| 3.5 Integrate Claude for AI Generated mode | New: `AIGeneratedEngine.tsx`, API route | 8h | - |

**Deliverable:** All 6 modes function as intended

### Phase 4: UX Enhancements (Week 3-4)

**Priority:** 🟡 Medium - Polish and professionalism

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 4.1 Add panel animations (slide, fade) | CSS/Tailwind | 2h | - |
| 4.2 Add button hover/active states | Button components | 2h | - |
| 4.3 Add loading skeletons | New: `PracticeSkeletons.tsx` | 2h | - |
| 4.4 Improve layout responsiveness | `page.tsx`, CSS | 4h | - |
| 4.5 Add tooltips to all interactive elements | Throughout | 3h | - |
| 4.6 Create first-time user tutorial | New: `PracticeTutorial.tsx` | 6h | - |
| 4.7 Add micro-interactions | Throughout | 2h | - |

**Deliverable:** Professional, polished UI matching TradingView quality

### Phase 5: Paper Trading & Options (Week 4-5)

**Priority:** 🟡 Medium - Advanced features

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 5.1 Build Paper Trading balance tracker | `PaperTradingPanel.tsx` | 4h | - |
| 5.2 Add position sizing calculator | `PaperTradingPanel.tsx` | 3h | - |
| 5.3 Implement trade journal | New: `TradeJournal.tsx` | 4h | - |
| 5.4 Build Options Chain interface | `OptionsChainPanel.tsx` | 8h | - |
| 5.5 Add Greeks display | `OptionsChainPanel.tsx` | 4h | - |
| 5.6 Implement P&L calculator | Both panels | 3h | - |

**Deliverable:** Full paper trading and options practice capability

### Phase 6: AI & Analytics (Week 5-6)

**Priority:** 🟢 Enhancement - Differentiation features

| Task | File(s) | Effort | Assignee |
|------|---------|--------|----------|
| 6.1 Set up RAG with course transcripts | New: `RAGService.ts` | 8h | - |
| 6.2 Implement personalized coaching | `AICoachingPanel.tsx` | 6h | - |
| 6.3 Build user analytics dashboard | New: `AnalyticsDashboard.tsx` | 6h | - |
| 6.4 Add spaced repetition for scenarios | `ScenarioService.ts` | 4h | - |
| 6.5 Create admin scenario management | New: Admin routes | 8h | - |
| 6.6 Build leaderboard component | New: `Leaderboard.tsx` | 4h | - |

**Deliverable:** AI-powered personalized learning experience

---

## 7. File Reference

### Files to Modify

| File | Lines | Changes Needed |
|------|-------|----------------|
| `/src/app/(dashboard)/practice/page.tsx` | 1366 | Refactor into smaller components, fix button handlers |
| `/src/components/practice/practice-chart.tsx` | ~500 | Fix indicator colors, add Ripster clouds, add markers |
| `/supabase/seeds/practice_scenarios.sql` | 682 | Regenerate with 100+ candles per scenario |
| `/src/components/practice/DailyChallenge.tsx` | ~200 | Remove mock data after migration deployed |

### Files to Create

| File | Purpose |
|------|---------|
| `/src/components/practice/engines/QuickDrillEngine.tsx` | Quick Drill mode logic |
| `/src/components/practice/engines/DeepAnalysisEngine.tsx` | Deep Analysis mode logic |
| `/src/components/practice/engines/MultiTFEngine.tsx` | Multi-timeframe mode logic |
| `/src/components/practice/engines/LiveReplayEngine.tsx` | Live replay mode logic |
| `/src/components/practice/engines/AIGeneratedEngine.tsx` | AI scenario generation |
| `/src/components/practice/PracticeTutorial.tsx` | Onboarding flow |
| `/src/components/practice/PracticeSkeletons.tsx` | Loading states |
| `/src/components/practice/TradeJournal.tsx` | Paper trading journal |
| `/src/components/practice/Leaderboard.tsx` | XP leaderboard |
| `/src/components/practice/AnalyticsDashboard.tsx` | User performance analytics |
| `/src/lib/services/RAGService.ts` | Course transcript RAG |
| `/src/lib/services/MarketDataService.ts` | Polygon/Massive.com integration |

### Migrations to Deploy

| Migration | Tables Created |
|-----------|----------------|
| `024_practice_enhancements.sql` | practice_challenges, practice_challenge_progress, user_practice_xp |

---

## 8. Success Criteria

### Functional Criteria

- [ ] Charts display 100+ candles with historical context
- [ ] All 6 practice modes function correctly
- [ ] All toolbar buttons open their respective panels
- [ ] Indicators match KCU methodology (EMA 9 green, EMA 21 red)
- [ ] VWAP bands show ±1 and ±2 standard deviations
- [ ] Ripster clouds display correctly
- [ ] Paper trading tracks balance and positions
- [ ] Options chain displays full Greeks
- [ ] Challenge system loads without errors
- [ ] Timeframe switching fetches appropriate data

### UX Criteria

- [ ] All panel transitions are animated (300ms ease-out)
- [ ] Loading states show skeleton screens
- [ ] All interactive elements have tooltips
- [ ] First-time users see onboarding tutorial
- [ ] Mobile responsive down to 768px width
- [ ] No layout shift during panel open/close

### Performance Criteria

- [ ] Initial page load < 2 seconds
- [ ] Timeframe switch < 500ms
- [ ] Chart render with 100 candles < 100ms
- [ ] No memory leaks during extended sessions
- [ ] Lighthouse score > 90

### Learning Criteria

- [ ] Beginner can complete first scenario without confusion
- [ ] Feedback references specific course concepts
- [ ] Progress tracking visible and motivating
- [ ] Difficulty progression feels natural
- [ ] LTP Framework consistently reinforced

---

## Appendix A: Indicator Color Reference

```typescript
const KCU_INDICATOR_COLORS = {
  // EMAs (Somesh methodology)
  EMA_9: '#22c55e',      // Green
  EMA_21: '#ef4444',     // Red
  EMA_50: '#f59e0b',     // Amber (if used)
  EMA_200: '#8b5cf6',    // Purple (if used)

  // VWAP System
  VWAP: '#8b5cf6',       // Purple
  VWAP_BAND_1: 'rgba(139, 92, 246, 0.3)',  // +/- 1 SD
  VWAP_BAND_2: 'rgba(139, 92, 246, 0.15)', // +/- 2 SD

  // Ripster Clouds
  CLOUD_BULLISH: 'rgba(34, 197, 94, 0.2)',  // Green fill
  CLOUD_BEARISH: 'rgba(239, 68, 68, 0.2)',  // Red fill

  // Levels
  SUPPORT: '#22c55e',    // Green
  RESISTANCE: '#ef4444', // Red
  ORB_HIGH: '#3b82f6',   // Blue
  ORB_LOW: '#f97316',    // Orange

  // Price Action
  BULLISH_CANDLE: '#22c55e',
  BEARISH_CANDLE: '#ef4444',
  DOJI_CANDLE: '#6b7280',
};
```

---

## Appendix B: LTP Framework Reference

The LTP Framework is Somesh's core teaching methodology:

### L - LEVEL
- Identify key support and resistance levels
- Mark previous day high/low/close
- Note VWAP and its bands
- Recognize psychological levels ($100, $150, etc.)

### T - TREND
- EMA 9 above EMA 21 = Bullish trend
- EMA 9 below EMA 21 = Bearish trend
- Ripster clouds green = Bullish
- Ripster clouds red = Bearish
- Look for higher highs/lows or lower highs/lows

### P - PATIENCE
- Wait for price to reach a level
- Confirm with trend alignment
- Look for rejection candles
- Don't chase extended moves
- Let the trade come to you

---

## Appendix C: Scenario Categories

Based on current seed data and KCU curriculum:

### Beginner Scenarios
- Support bounce identification
- Resistance rejection identification
- VWAP reclaim setups
- Basic trend following

### Intermediate Scenarios
- ORB breakout trades
- VWAP deviation plays
- EMA crossover entries
- Consolidation breakouts

### Advanced Scenarios
- Multi-timeframe confluence
- Failed breakout reversals
- Gap fill strategies
- News-driven volatility

---

*End of Document*
