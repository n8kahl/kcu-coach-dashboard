# Practice Mode Implementation Plan

## "The Setup Lab" - LTP Trading Practice System

A comprehensive training environment that replicates Somesh's exact TradingView setup, allowing users to practice recognizing and executing LTP setups through historical scenarios and AI-generated challenges.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Technical Architecture](#2-technical-architecture)
3. [Chart System Design](#3-chart-system-design)
4. [Historical Scenarios (Mode 1)](#4-historical-scenarios-mode-1)
5. [AI-Generated Scenarios (Mode 2)](#5-ai-generated-scenarios-mode-2)
6. [User Interface Design](#6-user-interface-design)
7. [Database Schema](#7-database-schema)
8. [API Endpoints](#8-api-endpoints)
9. [Scoring & Feedback System](#9-scoring--feedback-system)
10. [Gamification & Progression](#10-gamification--progression)
11. [Implementation Phases](#11-implementation-phases)
12. [File Structure](#12-file-structure)

---

## 1. Overview

### 1.1 Core Concept

Practice Mode provides a realistic trading simulation where users:
- View multi-timeframe charts frozen at decision points
- Analyze setups using the LTP framework (Level, Trend, Patience)
- Make entry/exit decisions under time pressure
- Watch the outcome unfold
- Receive AI-powered coaching feedback

### 1.2 Two Practice Modes

| Mode | Description | Data Source | Best For |
|------|-------------|-------------|----------|
| **Historical Replay** | Real market scenarios from past trading days | Massive.com API | Realistic practice, pattern recognition |
| **AI Scenarios** | Claude-generated realistic but fictional setups | Claude API | Unlimited practice, adaptive difficulty |

### 1.3 Key Differentiators

- **Full TradingView Replication**: 4-pane layout with exact KCU indicators
- **Multi-Timeframe Analysis**: Daily, 60-min, 15-min, 5-min, 2-min charts (exact KCU setup)
- **Real Indicators**: EMA 9, EMA 21, SMA 200, VWAP, EMA Ribbons (Ripster approximation)
- **Interactive Charts**: Click to place entry/stop/target directly on chart
- **AI Coaching**: Personalized feedback on every attempt
- **Adaptive Learning**: System identifies weak areas and focuses practice there

---

## 2. Technical Architecture

### 2.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 14 (App Router)                                        │
│  └── Lightweight Charts (TradingView open-source)               │
│  └── React Components                                           │
│  └── Tailwind CSS                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
├─────────────────────────────────────────────────────────────────┤
│  Next.js API Routes                                             │
│  └── /api/practice/*                                            │
│  └── Indicator calculations (EMA, VWAP, etc.)                   │
│  └── Scoring engine                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
├─────────────────────────────────────────────────────────────────┤
│  Massive.com API ──► Historical OHLCV data                      │
│  Claude API ──► Scenario generation + Coaching feedback         │
│  Supabase ──► User progress, scenarios, attempts                │
│  Redis ──► Caching historical data                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
User Starts Practice
        │
        ▼
┌───────────────────┐
│ Load Scenario     │
│ (Historical/AI)   │
└───────────────────┘
        │
        ├──► Historical: Fetch from Massive.com (cached)
        │    └── Get bars for all 4 timeframes
        │    └── Calculate indicators server-side
        │    └── Freeze at decision point
        │
        └──► AI: Request from Claude
             └── Generate scenario JSON
             └── Create synthetic price data
             └── Calculate indicators
        │
        ▼
┌───────────────────┐
│ Render Charts     │
│ (Frozen State)    │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ User Analysis     │
│ (Timed)           │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Submit Decision   │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Reveal Outcome    │
│ (Chart Playback)  │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ AI Coach Debrief  │
│ (Claude Analysis) │
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ Update Stats      │
│ (Supabase)        │
└───────────────────┘
```

---

## 3. Chart System Design

### 3.1 Charting Library: Lightweight Charts

**Why Lightweight Charts:**
- Open-source from TradingView (free, no API key)
- Native candlestick support
- Multiple series (indicators) on same chart
- Time-based navigation
- Crosshair with price/time readout
- Responsive and performant
- TypeScript support

**Installation:**
```bash
npm install lightweight-charts
```

### 3.2 Five-Pane Layout (KCU Multi-Timeframe Setup)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    HEADER                                         │
│  Practice Mode: SPY #47  |  ⏱️ 0:45  |  📊 Intermediate  |  🎯 ORB Focus         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐   │
│  │                      │  │                      │  │                      │   │
│  │    DAILY CHART       │  │    60-MINUTE CHART   │  │    15-MINUTE CHART   │   │
│  │    (Structure)       │  │    (Context)         │  │    (Setup)           │   │
│  │                      │  │                      │  │                      │   │
│  │  Height: 200px       │  │  Height: 200px       │  │  Height: 200px       │   │
│  │                      │  │                      │  │                      │   │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────────┘   │
│                                                                                   │
│  ┌──────────────────────────────────────┐  ┌────────────────────────────────┐   │
│  │                                      │  │                                │   │
│  │          5-MINUTE CHART              │  │        2-MINUTE CHART          │   │
│  │          (Confirmation)              │  │        (Entry Timing)          │   │
│  │                                      │  │                                │   │
│  │  Height: 280px                       │  │  Height: 280px                 │   │
│  │  + Volume subplot                    │  │  + Patience candle highlights  │   │
│  │                                      │  │                                │   │
│  └──────────────────────────────────────┘  └────────────────────────────────┘   │
│                                                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              CONTEXT PANEL                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              DECISION PANEL                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Layout Rationale:**
- **Top Row (3 charts)**: Higher timeframes for context - Daily shows structure, 60m shows trend, 15m shows setup
- **Bottom Row (2 charts, larger)**: Lower timeframes for execution - 5m for confirmation, 2m for precise entry
- The 2-minute chart is critical for KCU strategy: this is where patience candles are identified and entries timed

### 3.3 Indicators Per Timeframe

| Timeframe | Candlesticks | Indicators | Levels | Special |
|-----------|--------------|------------|--------|---------|
| **Daily** | Yes | EMA 9 (blue), EMA 21 (orange), SMA 200 (white) | Weekly H/L, Monthly H/L | Structure labels |
| **60-min** | Yes | EMA 9, EMA 21, VWAP (purple) | PDH, PDL, Hourly pivots | Key decision TF |
| **15-min** | Yes | EMA 9, EMA 21, VWAP, EMA Ribbon (8-21) | ORB H/L, VWAP | Cloud approximation |
| **5-min** | Yes | EMA 9, EMA 21, VWAP | ORB, Current levels | Volume bars |
| **2-min** | Yes | EMA 9, EMA 21, VWAP | Current levels | Entry timing, Patience highlights |

> **Note**: The 2-minute chart is critical for the KCU strategy as it provides:
> - Precise entry timing after patience candle confirmation
> - More granular view of price action at key levels
> - Better stop placement with tighter risk
> - Clear visualization of momentum shifts

### 3.4 EMA Ribbon (Ripster Clouds Approximation)

Since Ripster Clouds is proprietary, we'll approximate with an EMA Ribbon:

```typescript
// EMA Ribbon configuration (approximates cloud behavior)
const EMA_RIBBON_PERIODS = [8, 10, 12, 14, 16, 18, 20, 21];

// Visual representation:
// - All EMAs stacked bullish (8 > 10 > 12 > ... > 21) = Green cloud
// - All EMAs stacked bearish (8 < 10 < 12 < ... < 21) = Red cloud
// - Mixed = Gray/transitioning

interface RibbonState {
  color: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100 based on EMA separation
  expanding: boolean; // EMAs spreading apart
  contracting: boolean; // EMAs coming together
}
```

### 3.5 Level Drawing System

```typescript
interface ChartLevel {
  price: number;
  label: string;
  type: 'pdh' | 'pdl' | 'orb_high' | 'orb_low' | 'vwap' | 'ema' | 'weekly' | 'monthly';
  style: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
  };
  timeframe: 'daily' | 'hourly' | 'intraday';
}

// Level colors (matching TradingView conventions)
const LEVEL_STYLES = {
  pdh: { color: '#FFD700', lineWidth: 2, lineStyle: 'solid' },      // Gold
  pdl: { color: '#FFD700', lineWidth: 2, lineStyle: 'solid' },      // Gold
  orb_high: { color: '#00FF00', lineWidth: 2, lineStyle: 'dashed' }, // Green
  orb_low: { color: '#FF0000', lineWidth: 2, lineStyle: 'dashed' },  // Red
  vwap: { color: '#9C27B0', lineWidth: 2, lineStyle: 'solid' },      // Purple
  weekly_high: { color: '#2196F3', lineWidth: 1, lineStyle: 'dotted' }, // Blue
  weekly_low: { color: '#2196F3', lineWidth: 1, lineStyle: 'dotted' },
  sma_200: { color: '#FFFFFF', lineWidth: 1, lineStyle: 'solid' },   // White
};
```

### 3.6 Patience Candle Highlighting

```typescript
// Highlight patience candles on 5-min chart
interface PatienceHighlight {
  barIndex: number;
  timestamp: number;
  type: 'doji' | 'spinning_top' | 'small_body';
  nearLevel: string; // Which level it's near
}

// Visual: Yellow/orange glow behind candle, or marker above/below
```

### 3.7 Interactive Entry Tools

```typescript
// User can click on chart to place:
interface UserPlacements {
  entry: { price: number; chartClicked: '5m' | '15m' } | null;
  stopLoss: { price: number } | null;
  target1: { price: number } | null;
  target2: { price: number } | null;
}

// Visual feedback:
// - Entry: Green horizontal line with "ENTRY" label
// - Stop: Red horizontal line with "STOP" label
// - Targets: Blue horizontal lines with "T1", "T2" labels
// - Risk/Reward ratio auto-calculated and displayed
```

---

## 4. Historical Scenarios (Mode 1)

### 4.1 Scenario Curation Process

**Phase 1: Manual Curation (Initial 50-100 scenarios)**
1. Admin identifies memorable trading days (big moves, clean setups, traps)
2. For each scenario, record:
   - Symbol, date, freeze time
   - Setup type and quality
   - Ideal entry/stop/targets
   - Actual outcome
   - Teaching notes
3. Tag by difficulty, setup type, outcome

**Phase 2: AI-Assisted Curation (Scale to 500+)**
1. Feed Claude historical data for a date range
2. AI identifies potential teaching moments
3. Human reviews and approves
4. System auto-calculates answer keys

### 4.2 Scenario Categories

```typescript
type SetupType =
  | 'orb_breakout'      // Opening range breakout
  | 'orb_bounce'        // Bounce off ORB level
  | 'vwap_bounce'       // VWAP support/resistance
  | 'ema_pullback'      // Pullback to EMA 9/21
  | 'level_breakout'    // PDH/PDL breakout
  | 'level_rejection'   // Failed breakout / reversal
  | 'continuation'      // Trend continuation
  | 'reversal'          // Trend reversal
  | 'trap'              // Looks good but fails (educational)
  | 'chop'              // No clear setup (pass scenarios)

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

type Outcome =
  | 'hit_t1'            // Hit first target
  | 'hit_t2'            // Hit second target
  | 'hit_t3'            // Runner to third target
  | 'stopped_out'       // Hit stop loss
  | 'breakeven'         // Moved stop to breakeven, scratched
  | 'chopped'           // Indecisive, no clear outcome
```

### 4.3 Data Fetching from Massive.com

```typescript
// src/lib/practice/historical-data.ts

import { massiveApi } from '@/lib/market-data';

interface ScenarioData {
  daily: Bar[];
  hourly: Bar[];
  fifteenMin: Bar[];
  fiveMin: Bar[];
  twoMin: Bar[];  // Critical for KCU entry timing
  indicators: CalculatedIndicators;
  levels: ChartLevel[];
}

export async function loadHistoricalScenario(
  scenario: PracticeScenario
): Promise<ScenarioData> {
  const freezeTime = new Date(`${scenario.date}T${scenario.freeze_time}Z`);
  const marketOpen = new Date(`${scenario.date}T14:30:00Z`); // 9:30 AM ET in UTC

  // Fetch all timeframes in parallel (including 2-min for KCU strategy)
  const [dailyBars, hourlyBars, fifteenBars, fiveBars, twoBars] = await Promise.all([
    // Daily: Last 60 trading days for context
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'day',
      limit: 60,
      to: scenario.date
    }),

    // 60-minute: Last 5 trading days
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'hour',
      from: subDays(freezeTime, 5).toISOString(),
      to: freezeTime.toISOString()
    }),

    // 15-minute: Current day + previous day
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'minute',
      multiplier: 15,
      from: subDays(freezeTime, 1).toISOString(),
      to: freezeTime.toISOString()
    }),

    // 5-minute: Current day only (up to freeze point)
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'minute',
      multiplier: 5,
      from: marketOpen.toISOString(),
      to: freezeTime.toISOString()
    }),

    // 2-minute: Current day only - critical for KCU entry timing
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'minute',
      multiplier: 2,
      from: marketOpen.toISOString(),
      to: freezeTime.toISOString()
    })
  ]);

  // Calculate indicators for all timeframes
  const indicators = calculateAllIndicators({
    daily: dailyBars,
    hourly: hourlyBars,
    fifteenMin: fifteenBars,
    fiveMin: fiveBars,
    twoMin: twoBars
  });

  // Calculate levels
  const levels = calculateLevels({
    daily: dailyBars,
    fiveMin: fiveBars,
    twoMin: twoBars,
    currentPrice: twoBars[twoBars.length - 1]?.c
  });

  return {
    daily: dailyBars,
    hourly: hourlyBars,
    fifteenMin: fifteenBars,
    fiveMin: fiveBars,
    twoMin: twoBars,
    indicators,
    levels
  };
}

// For reveal phase - get what happened AFTER freeze point
// Uses 2-minute bars for precise playback matching KCU entry timeframe
export async function loadOutcomeData(
  scenario: PracticeScenario,
  durationMinutes: number = 60
): Promise<{ twoMin: Bar[]; fiveMin: Bar[] }> {
  const freezeTime = new Date(`${scenario.date}T${scenario.freeze_time}Z`);
  const endTime = addMinutes(freezeTime, durationMinutes);

  const [twoBars, fiveBars] = await Promise.all([
    // 2-minute for detailed playback
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'minute',
      multiplier: 2,
      from: freezeTime.toISOString(),
      to: endTime.toISOString()
    }),
    // 5-minute for reference
    massiveApi.getBars({
      symbol: scenario.symbol,
      timespan: 'minute',
      multiplier: 5,
      from: freezeTime.toISOString(),
      to: endTime.toISOString()
    })
  ]);

  return { twoMin: twoBars, fiveMin: fiveBars };
}
```

### 4.4 Indicator Calculations

```typescript
// src/lib/practice/indicators.ts

export interface CalculatedIndicators {
  daily: {
    ema9: number[];
    ema21: number[];
    sma200: number[];
  };
  hourly: {
    ema9: number[];
    ema21: number[];
    vwap: number;
  };
  fifteenMin: {
    ema9: number[];
    ema21: number[];
    vwap: number;
    emaRibbon: RibbonData;
  };
  fiveMin: {
    ema9: number[];
    ema21: number[];
    vwap: number;
    volume: number[];
    patienceCandles: PatienceHighlight[];
  };
}

// EMA calculation
export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first value
  let sum = 0;
  for (let i = 0; i < period && i < prices.length; i++) {
    sum += prices[i];
    ema.push(sum / (i + 1)); // Running average until we have enough data
  }

  // Calculate EMA for remaining values
  for (let i = period; i < prices.length; i++) {
    const value = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    ema.push(value);
  }

  return ema;
}

// VWAP calculation (intraday only)
export function calculateVWAP(bars: Bar[]): number[] {
  const vwap: number[] = [];
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;

  for (const bar of bars) {
    const typicalPrice = (bar.h + bar.l + bar.c) / 3;
    cumulativeTPV += typicalPrice * bar.v;
    cumulativeVolume += bar.v;
    vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }

  return vwap;
}

// EMA Ribbon for cloud approximation
export function calculateEMARibbon(prices: number[]): RibbonData {
  const periods = [8, 10, 12, 14, 16, 18, 20, 21];
  const emas = periods.map(p => calculateEMA(prices, p));

  // For each bar, determine ribbon state
  const ribbonStates: RibbonState[] = [];

  for (let i = 0; i < prices.length; i++) {
    const values = emas.map(ema => ema[i] || 0);

    // Check if bullish stacking (shorter EMAs above longer)
    let bullishCount = 0;
    let bearishCount = 0;

    for (let j = 0; j < values.length - 1; j++) {
      if (values[j] > values[j + 1]) bullishCount++;
      else if (values[j] < values[j + 1]) bearishCount++;
    }

    const totalComparisons = values.length - 1;

    let color: 'bullish' | 'bearish' | 'neutral';
    if (bullishCount >= totalComparisons * 0.7) color = 'bullish';
    else if (bearishCount >= totalComparisons * 0.7) color = 'bearish';
    else color = 'neutral';

    // Calculate strength based on EMA separation
    const maxEMA = Math.max(...values);
    const minEMA = Math.min(...values);
    const separation = ((maxEMA - minEMA) / prices[i]) * 100;

    ribbonStates.push({
      color,
      strength: Math.min(100, separation * 20),
      topEMA: Math.max(...values),
      bottomEMA: Math.min(...values)
    });
  }

  return { emas, states: ribbonStates };
}

// Detect patience candles
export function detectPatienceCandles(
  bars: Bar[],
  levels: ChartLevel[],
  config = { maxBodyPercent: 0.5, proximityPercent: 0.3 }
): PatienceHighlight[] {
  const patience: PatienceHighlight[] = [];

  // Look at last 10 bars
  const recentBars = bars.slice(-10);
  const startIndex = bars.length - 10;

  for (let i = 0; i < recentBars.length; i++) {
    const bar = recentBars[i];
    const barIndex = startIndex + i;

    // Calculate candle metrics
    const bodySize = Math.abs(bar.c - bar.o);
    const totalRange = bar.h - bar.l;
    const bodyPercent = totalRange > 0 ? (bodySize / totalRange) * 100 : 0;

    // Is it a small body candle?
    if (bodyPercent > config.maxBodyPercent * 100) continue;

    // Is it near a level?
    const midPrice = (bar.h + bar.l) / 2;
    for (const level of levels) {
      const distance = Math.abs(midPrice - level.price) / level.price * 100;

      if (distance <= config.proximityPercent) {
        patience.push({
          barIndex,
          timestamp: bar.t,
          type: bodyPercent < 10 ? 'doji' : 'small_body',
          nearLevel: level.label
        });
        break;
      }
    }
  }

  return patience;
}
```

### 4.5 Level Calculations

```typescript
// src/lib/practice/levels.ts

export function calculateLevels(data: {
  daily: Bar[];
  fiveMin: Bar[];
  currentPrice: number;
}): ChartLevel[] {
  const levels: ChartLevel[] = [];
  const { daily, fiveMin, currentPrice } = data;

  // Previous Day High/Low (from daily bars)
  if (daily.length >= 2) {
    const yesterday = daily[daily.length - 2];
    levels.push({
      price: yesterday.h,
      label: 'PDH',
      type: 'pdh',
      style: LEVEL_STYLES.pdh,
      timeframe: 'daily'
    });
    levels.push({
      price: yesterday.l,
      label: 'PDL',
      type: 'pdl',
      style: LEVEL_STYLES.pdl,
      timeframe: 'daily'
    });
  }

  // ORB High/Low (first 3 bars of 5-min = 15 minutes)
  if (fiveMin.length >= 3) {
    const orbBars = fiveMin.slice(0, 3);
    const orbHigh = Math.max(...orbBars.map(b => b.h));
    const orbLow = Math.min(...orbBars.map(b => b.l));

    levels.push({
      price: orbHigh,
      label: 'ORB High',
      type: 'orb_high',
      style: LEVEL_STYLES.orb_high,
      timeframe: 'intraday'
    });
    levels.push({
      price: orbLow,
      label: 'ORB Low',
      type: 'orb_low',
      style: LEVEL_STYLES.orb_low,
      timeframe: 'intraday'
    });
  }

  // Weekly High/Low (from daily bars)
  if (daily.length >= 5) {
    const weekBars = daily.slice(-5);
    const weekHigh = Math.max(...weekBars.map(b => b.h));
    const weekLow = Math.min(...weekBars.map(b => b.l));

    levels.push({
      price: weekHigh,
      label: 'Week High',
      type: 'weekly_high',
      style: LEVEL_STYLES.weekly_high,
      timeframe: 'daily'
    });
    levels.push({
      price: weekLow,
      label: 'Week Low',
      type: 'weekly_low',
      style: LEVEL_STYLES.weekly_low,
      timeframe: 'daily'
    });
  }

  // SMA 200 (from daily bars)
  if (daily.length >= 200) {
    const sma200 = daily.slice(-200).reduce((sum, b) => sum + b.c, 0) / 200;
    levels.push({
      price: sma200,
      label: 'SMA 200',
      type: 'sma_200',
      style: LEVEL_STYLES.sma_200,
      timeframe: 'daily'
    });
  }

  // Current VWAP (calculated from 5-min bars)
  const vwap = calculateVWAP(fiveMin);
  if (vwap.length > 0) {
    levels.push({
      price: vwap[vwap.length - 1],
      label: 'VWAP',
      type: 'vwap',
      style: LEVEL_STYLES.vwap,
      timeframe: 'intraday'
    });
  }

  return levels;
}
```

---

## 5. AI-Generated Scenarios (Mode 2)

### 5.1 Scenario Generation Prompt

```typescript
// src/lib/practice/ai-scenario.ts

const SCENARIO_GENERATION_PROMPT = `You are an expert LTP (Level, Trend, Patience) trading coach creating practice scenarios for students.

Generate a realistic but fictional market scenario that tests the student's ability to identify valid trading setups.

PARAMETERS:
- Difficulty: {difficulty}
- Focus Area: {focusArea}
- Setup Quality: {setupQuality} (valid_setup | trap | obvious_pass)
- Symbol: {symbol}

REQUIREMENTS:
Generate a complete scenario with all the data needed to render realistic charts.

OUTPUT FORMAT (JSON):
{
  "scenario_id": "ai_generated_uuid",
  "symbol": "SPY",
  "date": "2024-01-18",
  "time": "10:15:00",
  "market_context": {
    "premarket_high": 452.30,
    "premarket_low": 449.80,
    "overnight_change_percent": 0.85,
    "news_catalyst": "None significant" | "Earnings" | "Fed speech" | etc,
    "sector_performance": "Tech +0.5%, Market flat"
  },

  "daily_context": {
    "trend": "bullish" | "bearish" | "neutral",
    "price_vs_ema9": "above" | "below" | "at",
    "price_vs_ema21": "above" | "below" | "at",
    "price_vs_sma200": "above" | "below",
    "recent_structure": "higher_highs_higher_lows" | "lower_highs_lower_lows" | "range",
    "key_daily_levels": [
      {"type": "pdh", "price": 451.20},
      {"type": "pdl", "price": 448.50},
      {"type": "weekly_high", "price": 453.00}
    ]
  },

  "hourly_context": {
    "trend": "bullish" | "bearish" | "neutral",
    "ema_alignment": "bullish_stack" | "bearish_stack" | "mixed",
    "vwap_position": "above" | "below" | "at",
    "structure_description": "Price making higher lows, holding above rising EMA 21"
  },

  "fifteen_min_context": {
    "trend": "bullish" | "bearish" | "neutral",
    "momentum": "strong" | "moderate" | "weak",
    "ribbon_state": "bullish_expanding" | "bullish_contracting" | "bearish_expanding" | "bearish_contracting" | "neutral",
    "structure_description": "Pulled back to VWAP, testing for support"
  },

  "five_min_state": {
    "current_price": 450.75,
    "orb_high": 451.50,
    "orb_low": 449.20,
    "ema9": 450.60,
    "ema21": 450.40,
    "vwap": 450.30,
    "price_vs_ema9": "above",
    "price_vs_vwap": "above",
    "volume_description": "Average volume, declining on pullback",
    "patience_candles": {
      "detected": true,
      "count": 3,
      "description": "Three small-bodied candles with wicks testing EMA 9 support",
      "near_level": "EMA 9"
    },
    "last_5_bars_description": "Price pulled back from 451.50 high, formed 3 doji candles at 450.60-450.80 range"
  },

  "synthetic_bars": {
    "daily": [...],  // Last 20 daily bars as OHLCV
    "hourly": [...], // Last 24 hourly bars
    "fifteen_min": [...], // Last 20 15-min bars
    "five_min": [...]  // Current day 5-min bars up to freeze point
  },

  "answer_key": {
    "is_valid_setup": true,
    "direction": "long",
    "setup_type": "ema_pullback",
    "primary_level": "EMA 9 support",
    "ideal_entry": 450.85,
    "ideal_stop": 450.20,
    "ideal_target_1": 451.50,
    "ideal_target_2": 452.30,
    "risk_reward": 2.5,
    "outcome": "hit_t1",
    "outcome_description": "Price bounced from EMA 9, broke above ORB high, reached 451.60 before pulling back",
    "max_favorable_excursion": 1.25,
    "max_adverse_excursion": 0.15
  },

  "teaching_notes": "Classic EMA 9 pullback in an uptrend. All timeframes aligned bullish. Patience candles formed at the 9 EMA with declining volume (sign of healthy pullback, not distribution). Entry on break of patience candle high with stop below EMA 21 for safety margin."
}

IMPORTANT:
- Make the synthetic_bars data realistic and consistent with the descriptions
- Ensure indicators can be calculated correctly from the bar data
- For "trap" scenarios, make it look like a valid setup but include a subtle flaw
- For "obvious_pass" scenarios, make it clear why this is NOT a setup
- Keep prices realistic for the symbol (SPY ~$450, NVDA ~$500, AAPL ~$180, etc.)
`;
```

### 5.2 AI Coaching Feedback Prompt

```typescript
const COACHING_FEEDBACK_PROMPT = `You are an expert LTP trading coach reviewing a student's practice attempt.

SCENARIO DETAILS:
{scenarioJSON}

CORRECT ANSWER:
- Valid Setup: {isValidSetup}
- Direction: {correctDirection}
- Ideal Entry: {idealEntry}
- Ideal Stop: {idealStop}
- Ideal Target 1: {idealTarget1}
- Primary Level Type: {levelType}
- What Actually Happened: {outcome}

STUDENT'S RESPONSE:
- Said Valid: {userSaidValid}
- Direction: {userDirection}
- Entry Price: {userEntry}
- Stop Price: {userStop}
- Target 1: {userTarget1}
- Level Type Selected: {userLevelType}
- Confidence: {userConfidence}/5
- Time Taken: {timeTaken} seconds

PROVIDE FEEDBACK:
1. Start with what they got RIGHT (positive reinforcement)
2. Explain what they missed and WHY it matters
3. Give ONE specific thing to focus on for improvement
4. Keep tone encouraging but honest
5. Reference specific LTP framework concepts

FORMAT:
{
  "overall_grade": "A" | "B" | "C" | "D" | "F",
  "score": 0-100,
  "component_scores": {
    "setup_identification": 0-100,
    "direction": 0-100,
    "entry_placement": 0-100,
    "stop_placement": 0-100,
    "target_selection": 0-100,
    "level_identification": 0-100
  },
  "feedback_positive": "What you did well...",
  "feedback_improvement": "What to work on...",
  "specific_tip": "One actionable tip...",
  "ltp_concept_reference": "This relates to the L/T/P framework because..."
}
`;
```

### 5.3 Adaptive Difficulty

```typescript
// src/lib/practice/adaptive.ts

export async function selectNextScenario(
  userId: string,
  mode: 'historical' | 'ai'
): Promise<ScenarioSelection> {
  // Get user's practice stats
  const stats = await getPracticeStats(userId);

  // Identify weak areas
  const weakAreas = identifyWeakAreas(stats);

  // Determine appropriate difficulty
  const difficulty = determineDifficulty(stats);

  // Select focus area (prioritize weakest)
  const focusArea = weakAreas[0] || 'general';

  // Determine setup quality mix
  // 60% valid setups, 25% traps, 15% obvious passes
  const setupQuality = weightedRandom([
    { value: 'valid_setup', weight: 60 },
    { value: 'trap', weight: 25 },
    { value: 'obvious_pass', weight: 15 }
  ]);

  return {
    difficulty,
    focusArea,
    setupQuality,
    symbol: selectSymbol(stats) // Rotate through watchlist
  };
}

function identifyWeakAreas(stats: PracticeStats): string[] {
  const areas = [
    { name: 'level_identification', accuracy: stats.level_accuracy },
    { name: 'trend_reading', accuracy: stats.trend_accuracy },
    { name: 'patience_recognition', accuracy: stats.patience_accuracy },
    { name: 'stop_placement', accuracy: stats.stop_accuracy },
    { name: 'target_selection', accuracy: stats.target_accuracy },
    { name: 'orb_setups', accuracy: stats.orb_accuracy },
    { name: 'reversal_setups', accuracy: stats.reversal_accuracy }
  ];

  // Sort by accuracy (lowest first)
  return areas
    .filter(a => a.accuracy !== null && a.accuracy < 0.8)
    .sort((a, b) => (a.accuracy || 0) - (b.accuracy || 0))
    .map(a => a.name);
}

function determineDifficulty(stats: PracticeStats): Difficulty {
  const overallAccuracy = stats.total_correct / stats.total_completed;
  const totalAttempts = stats.total_completed;

  // Need at least 20 attempts before advancing
  if (totalAttempts < 20) return 'beginner';

  // Need 75%+ accuracy to advance
  if (overallAccuracy >= 0.75 && totalAttempts >= 50) {
    if (stats.advanced_unlocked) return 'advanced';
    return 'intermediate';
  }

  if (overallAccuracy >= 0.70 && totalAttempts >= 20) {
    return 'intermediate';
  }

  return 'beginner';
}
```

---

## 6. User Interface Design

### 6.1 Practice Hub Page

```
/practice (Practice Hub)
├── Header: "The Setup Lab"
├── Stats Overview
│   ├── Total Scenarios: 247
│   ├── Accuracy: 72%
│   ├── Current Streak: 5 🔥
│   └── Best Streak: 23
├── Skill Breakdown (visual bars)
│   ├── Level ID: ████████░░ 85%
│   ├── Trend Reading: ██████░░░░ 68% ← "Focus here"
│   ├── Patience: ███████░░░ 79%
│   ├── Stop Placement: ███████░░░ 71%
│   └── Targets: ██████░░░░ 65%
├── Mode Selection
│   ├── [Historical Scenarios] - "Practice with real market data"
│   └── [AI Scenarios] - "Unlimited adaptive practice"
├── Daily Challenge
│   └── "Identify 5 valid ORB setups" [Start Challenge]
└── Recent Attempts (last 5)
```

### 6.2 Scenario View Page

```
/practice/scenario/[id]

┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Practice: SPY #47  │  ⏱️ 0:45  │  📊 Intermediate  │  🎯 ORB Focus  ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CHART GRID (2x2)                                                       │
│  ┌──────────────────────────┐  ┌──────────────────────────┐            │
│  │                          │  │                          │            │
│  │     DAILY CHART          │  │     60-MIN CHART         │            │
│  │     [Lightweight Chart]  │  │     [Lightweight Chart]  │            │
│  │                          │  │                          │            │
│  │  Legend: EMA9 EMA21 200  │  │  Legend: EMA9 EMA21 VWAP │            │
│  └──────────────────────────┘  └──────────────────────────┘            │
│                                                                         │
│  ┌──────────────────────────┐  ┌──────────────────────────┐            │
│  │                          │  │                          │            │
│  │     15-MIN CHART         │  │     5-MIN CHART          │            │
│  │     [Lightweight Chart]  │  │     [Lightweight Chart]  │            │
│  │     + EMA Ribbon fill    │  │     + Volume bars        │            │
│  │                          │  │     + Patience markers   │            │
│  └──────────────────────────┘  └──────────────────────────┘            │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  CONTEXT PANEL                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Symbol: SPY    Date: Jan 15, 2024    Time: 10:45 AM EST             ││
│  │ Current: $451.25    Change: +0.85%    Vol: 45M (avg 52M)            ││
│  │ Pre-market: H $451.50 / L $449.80    News: None significant         ││
│  │ ORB: $449.20 - $451.50 (range: $2.30)                               ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  DECISION PANEL                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  Is this a valid LTP setup?                                         ││
│  │  ○ Yes, I would take this trade                                     ││
│  │  ○ No, I would pass on this                                         ││
│  │  ○ Not sure / Need more information                                 ││
│  │                                                                     ││
│  │  ─────────────────────────────────────────────────────────────────  ││
│  │                                                                     ││
│  │  If YES, fill in your trade plan:                                   ││
│  │                                                                     ││
│  │  Direction:     ○ Long    ○ Short                                   ││
│  │                                                                     ││
│  │  Entry:   $[________] (or click on 5-min chart)                     ││
│  │  Stop:    $[________] (or click on 5-min chart)                     ││
│  │  Target1: $[________] (or click on 5-min chart)                     ││
│  │  Target2: $[________] (optional)                                    ││
│  │                                                                     ││
│  │  R:R Ratio: 2.5:1 (auto-calculated)                                 ││
│  │                                                                     ││
│  │  What level type? (select all that apply)                           ││
│  │  □ PDH/PDL  □ ORB  □ VWAP  □ EMA  □ Weekly  □ Other                ││
│  │                                                                     ││
│  │  Confidence:  ★ ★ ★ ★ ☆  (4/5)                                      ││
│  │                                                                     ││
│  │                    [ Submit Analysis ]                              ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Reveal & Feedback View

```
/practice/scenario/[id]/result

┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Result: SPY #47  │  Score: 87/100 (A-)  │  ✓ Correct Direction      ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CHART (5-min with outcome revealed)                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  [Full-width 5-min chart showing what happened]                     ││
│  │                                                                     ││
│  │  - Green zone: Your entry → Target 1                                ││
│  │  - Markers: "You entered here" / "Price reached here"               ││
│  │  - Playback controls: [◀ Rewind] [▶ Play] [⏸ Pause] [Speed: 1x]    ││
│  │                                                                     ││
│  │  Height: 350px                                                      ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  COMPARISON PANEL                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                                                                     ││
│  │  YOUR ANALYSIS          vs          IDEAL TRADE                     ││
│  │  ──────────────────────────────────────────────────────────────     ││
│  │  Valid: Yes ✓                       Valid: Yes ✓                    ││
│  │  Direction: Long ✓                  Direction: Long ✓               ││
│  │  Entry: $451.25                     Entry: $451.30 (within $0.05)   ││
│  │  Stop: $450.50 ⚠️                   Stop: $450.30 (tighter ok)      ││
│  │  Target: $452.30 ✓                  Target: $452.50                 ││
│  │  R:R: 2.1:1                         R:R: 2.5:1                       ││
│  │                                                                     ││
│  │  OUTCOME: Price hit $452.45 ✅ (Target 1 achieved)                  ││
│  │  Max Favorable: +$1.20    Max Adverse: -$0.35                       ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  AI COACH FEEDBACK                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │  🎯 Score: 87/100 (A-)                                              ││
│  │                                                                     ││
│  │  ✅ WHAT YOU DID WELL:                                              ││
│  │  Great job identifying the ORB high bounce setup! Your entry was    ││
│  │  solid—right at the patience candle break. You correctly read the   ││
│  │  bullish trend alignment across all timeframes.                     ││
│  │                                                                     ││
│  │  📈 AREA FOR IMPROVEMENT:                                           ││
│  │  Your stop at $450.50 was a bit tight. The patience candles had     ││
│  │  wicks down to $450.35, so placing your stop at $450.30 would give  ││
│  │  more room without adding much risk. Remember: stop goes on the     ││
│  │  OTHER side of the patience candles.                                ││
│  │                                                                     ││
│  │  💡 TIP FOR NEXT TIME:                                              ││
│  │  When placing stops, look at the full wick range of your patience   ││
│  │  candles and add a small buffer (usually 5-10 cents on SPY).        ││
│  │                                                                     ││
│  │  📚 LTP CONCEPT:                                                    ││
│  │  This relates to the "P" in LTP - Patience. The patience candles    ││
│  │  define your risk zone. Your stop protects against the setup        ││
│  │  failing, not against normal market noise.                          ││
│  │                                                                     ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │      [ Practice Another ]      [ Review This Setup ]      [ Home ]  ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Component Scores Breakdown

```typescript
// Visual component showing detailed scoring
interface ScoreBreakdown {
  overall: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  components: {
    setup_identification: { score: number; max: 25; feedback: string };
    direction: { score: number; max: 15; feedback: string };
    entry_placement: { score: number; max: 20; feedback: string };
    stop_placement: { score: number; max: 20; feedback: string };
    target_selection: { score: number; max: 15; feedback: string };
    level_identification: { score: number; max: 5; feedback: string };
  };
}
```

---

## 7. Database Schema

### 7.1 New Tables

```sql
-- ============================================
-- Practice Mode Tables
-- ============================================

-- Curated historical scenarios
CREATE TABLE practice_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  symbol TEXT NOT NULL,
  scenario_date DATE NOT NULL,
  freeze_time TIME NOT NULL,

  -- Classification
  setup_type TEXT NOT NULL, -- orb_breakout, ema_pullback, etc.
  difficulty TEXT NOT NULL DEFAULT 'intermediate', -- beginner, intermediate, advanced
  category TEXT, -- Additional grouping

  -- The "answer key"
  is_valid_setup BOOLEAN NOT NULL,
  direction TEXT, -- long, short (null if not valid)
  primary_level_type TEXT, -- pdh, orb_high, vwap, etc.

  -- Ideal trade parameters
  ideal_entry DECIMAL(10,2),
  ideal_stop DECIMAL(10,2),
  ideal_target_1 DECIMAL(10,2),
  ideal_target_2 DECIMAL(10,2),
  ideal_target_3 DECIMAL(10,2),

  -- Outcome data
  actual_outcome TEXT, -- hit_t1, hit_t2, stopped_out, etc.
  max_favorable_excursion DECIMAL(10,2),
  max_adverse_excursion DECIMAL(10,2),
  outcome_duration_minutes INTEGER,

  -- Teaching content
  teaching_notes TEXT,
  key_observations TEXT[], -- Array of bullet points
  common_mistakes TEXT[], -- What students often get wrong here

  -- Metadata
  created_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  times_practiced INTEGER DEFAULT 0,
  avg_score DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  CONSTRAINT valid_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  CONSTRAINT valid_outcome CHECK (actual_outcome IN ('hit_t1', 'hit_t2', 'hit_t3', 'stopped_out', 'breakeven', 'chopped'))
);

CREATE INDEX idx_scenarios_difficulty ON practice_scenarios(difficulty);
CREATE INDEX idx_scenarios_setup_type ON practice_scenarios(setup_type);
CREATE INDEX idx_scenarios_symbol ON practice_scenarios(symbol);
CREATE INDEX idx_scenarios_active ON practice_scenarios(is_active) WHERE is_active = true;

-- User practice attempts
CREATE TABLE practice_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Scenario reference (null for AI-generated)
  scenario_id UUID REFERENCES practice_scenarios(id),
  scenario_type TEXT NOT NULL, -- 'historical' or 'ai_generated'

  -- AI scenario data (stored if AI-generated)
  ai_scenario_data JSONB, -- Full AI response for record

  -- User's response
  user_said_valid BOOLEAN NOT NULL,
  user_direction TEXT, -- long, short, null
  user_entry DECIMAL(10,2),
  user_stop DECIMAL(10,2),
  user_target_1 DECIMAL(10,2),
  user_target_2 DECIMAL(10,2),
  user_level_types TEXT[], -- Array of level types selected
  user_confidence INTEGER CHECK (user_confidence BETWEEN 1 AND 5),
  time_taken_seconds INTEGER,

  -- Grading results
  is_correct BOOLEAN NOT NULL,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  grade TEXT CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),

  -- Component scores
  setup_id_score INTEGER,
  direction_score INTEGER,
  entry_score INTEGER,
  stop_score INTEGER,
  target_score INTEGER,
  level_id_score INTEGER,

  -- AI feedback
  ai_feedback_positive TEXT,
  ai_feedback_improvement TEXT,
  ai_specific_tip TEXT,

  -- Metadata
  difficulty TEXT,
  focus_area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_scenario_type CHECK (scenario_type IN ('historical', 'ai_generated'))
);

CREATE INDEX idx_attempts_user ON practice_attempts(user_id);
CREATE INDEX idx_attempts_scenario ON practice_attempts(scenario_id);
CREATE INDEX idx_attempts_created ON practice_attempts(created_at DESC);
CREATE INDEX idx_attempts_user_date ON practice_attempts(user_id, created_at DESC);

-- Aggregated user practice statistics
CREATE TABLE practice_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Overall stats
  total_completed INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  total_historical INTEGER DEFAULT 0,
  total_ai INTEGER DEFAULT 0,

  -- Component accuracy (0.00 to 1.00)
  setup_id_accuracy DECIMAL(5,4),
  direction_accuracy DECIMAL(5,4),
  entry_accuracy DECIMAL(5,4),
  stop_accuracy DECIMAL(5,4),
  target_accuracy DECIMAL(5,4),
  level_id_accuracy DECIMAL(5,4),

  -- Setup type accuracy
  orb_accuracy DECIMAL(5,4),
  ema_pullback_accuracy DECIMAL(5,4),
  vwap_bounce_accuracy DECIMAL(5,4),
  reversal_accuracy DECIMAL(5,4),
  continuation_accuracy DECIMAL(5,4),
  trap_detection_accuracy DECIMAL(5,4),

  -- Streaks
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,

  -- Progression
  beginner_completed INTEGER DEFAULT 0,
  intermediate_completed INTEGER DEFAULT 0,
  advanced_completed INTEGER DEFAULT 0,
  intermediate_unlocked BOOLEAN DEFAULT false,
  advanced_unlocked BOOLEAN DEFAULT false,

  -- Time tracking
  total_practice_time_seconds INTEGER DEFAULT 0,
  avg_response_time_seconds INTEGER,

  -- Last activity
  last_practice_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily challenges
CREATE TABLE practice_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Challenge definition
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  challenge_type TEXT NOT NULL, -- 'identify_valid', 'spot_traps', 'perfect_stops', etc.

  -- Requirements
  required_count INTEGER NOT NULL,
  required_accuracy DECIMAL(3,2), -- e.g., 0.80 for 80%
  setup_type_filter TEXT, -- null for any, or specific type
  difficulty_filter TEXT, -- null for any

  -- Rewards
  xp_reward INTEGER DEFAULT 50,
  streak_bonus BOOLEAN DEFAULT false,

  -- Scheduling
  is_daily BOOLEAN DEFAULT true,
  active_date DATE, -- For daily challenges

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User challenge progress
CREATE TABLE user_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES practice_challenges(id),

  -- Progress
  attempts_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- For daily challenges
  challenge_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, challenge_id, challenge_date)
);

CREATE INDEX idx_challenge_progress_user ON user_challenge_progress(user_id);
CREATE INDEX idx_challenge_progress_date ON user_challenge_progress(challenge_date);

-- Cached historical data (to avoid repeated API calls)
CREATE TABLE practice_historical_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Key
  symbol TEXT NOT NULL,
  scenario_date DATE NOT NULL,
  timeframe TEXT NOT NULL, -- 'daily', 'hourly', '15m', '5m'

  -- Cached data
  bars_data JSONB NOT NULL, -- Array of OHLCV bars
  indicators_data JSONB, -- Pre-calculated indicators

  -- Cache management
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days',

  UNIQUE(symbol, scenario_date, timeframe)
);

CREATE INDEX idx_cache_lookup ON practice_historical_cache(symbol, scenario_date, timeframe);
CREATE INDEX idx_cache_expiry ON practice_historical_cache(expires_at);
```

### 7.2 Sample Data Insert

```sql
-- Sample curated scenarios
INSERT INTO practice_scenarios (
  symbol, scenario_date, freeze_time,
  setup_type, difficulty,
  is_valid_setup, direction, primary_level_type,
  ideal_entry, ideal_stop, ideal_target_1, ideal_target_2,
  actual_outcome, max_favorable_excursion, max_adverse_excursion,
  teaching_notes, key_observations
) VALUES
(
  'SPY', '2024-01-15', '10:45:00',
  'orb_breakout', 'beginner',
  true, 'long', 'orb_high',
  451.55, 450.80, 452.50, 453.25,
  'hit_t2', 2.15, 0.25,
  'Classic ORB breakout with clean patience candles at the high. All timeframes aligned bullish. Perfect example of waiting for the break rather than anticipating.',
  ARRAY['3 patience candles at ORB high', 'Volume declining during consolidation', 'EMA 9 providing support', 'Daily trend strongly bullish']
),
(
  'NVDA', '2024-01-16', '11:15:00',
  'trap', 'intermediate',
  false, null, 'pdh',
  null, null, null, null,
  'stopped_out', 0.50, 1.80,
  'Looked like a PDH breakout but 15-min trend was actually bearish. This is a classic trap - the level was valid but trend was against. Always check MTF alignment!',
  ARRAY['Daily bullish but 15-min making lower highs', 'Volume spike on breakout attempt (distribution)', 'No patience candles formed', 'Rejected immediately after break']
),
(
  'AAPL', '2024-01-17', '10:30:00',
  'ema_pullback', 'beginner',
  true, 'long', 'ema_9',
  182.40, 181.90, 183.20, 184.00,
  'hit_t1', 1.05, 0.20,
  'Textbook EMA 9 pullback in an uptrend. Price pulled back on low volume, formed 2 doji candles right at the 9 EMA, then bounced. Entry on break of doji high.',
  ARRAY['Clean pullback on declining volume', 'Doji candles = indecision = patience', 'EMA 9 acted as support', 'Immediate bounce confirms level']
);
```

---

## 8. API Endpoints

### 8.1 Endpoint Overview

```
GET  /api/practice/scenarios           - List available historical scenarios
GET  /api/practice/scenarios/:id       - Get specific scenario with chart data
POST /api/practice/scenarios/:id/start - Start a scenario attempt (records start time)
POST /api/practice/attempt             - Submit attempt and get feedback
GET  /api/practice/attempt/:id/reveal  - Get outcome data for playback
GET  /api/practice/stats               - Get user's practice statistics
POST /api/practice/ai-scenario         - Generate new AI scenario
GET  /api/practice/challenges          - Get available daily challenges
POST /api/practice/challenges/:id/progress - Update challenge progress
```

### 8.2 Detailed Endpoint Specs

```typescript
// GET /api/practice/scenarios
// List available scenarios with filtering

interface ListScenariosRequest {
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  setup_type?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}

interface ListScenariosResponse {
  scenarios: {
    id: string;
    symbol: string;
    date: string;
    setup_type: string;
    difficulty: string;
    times_practiced: number;
    avg_score: number | null;
    user_attempted: boolean; // Has this user done this one?
    user_best_score: number | null;
  }[];
  total: number;
  has_more: boolean;
}

// GET /api/practice/scenarios/:id
// Get full scenario data for rendering charts

interface GetScenarioResponse {
  scenario: {
    id: string;
    symbol: string;
    date: string;
    freeze_time: string;
    setup_type: string;
    difficulty: string;
  };
  chart_data: {
    daily: Bar[];
    hourly: Bar[];
    fifteen_min: Bar[];
    five_min: Bar[];
  };
  indicators: {
    daily: { ema9: number[]; ema21: number[]; sma200: number[] };
    hourly: { ema9: number[]; ema21: number[]; vwap: number[] };
    fifteen_min: { ema9: number[]; ema21: number[]; vwap: number[]; ribbon: RibbonData };
    five_min: { ema9: number[]; ema21: number[]; vwap: number[]; volume: number[] };
  };
  levels: ChartLevel[];
  patience_candles: PatienceHighlight[];
  context: {
    current_price: number;
    change_percent: number;
    volume: number;
    avg_volume: number;
    premarket_high: number;
    premarket_low: number;
    orb_high: number;
    orb_low: number;
    news: string | null;
  };
}

// POST /api/practice/attempt
// Submit user's analysis

interface SubmitAttemptRequest {
  scenario_id: string | null; // null for AI scenarios
  scenario_type: 'historical' | 'ai_generated';
  ai_scenario_data?: object; // Include if AI-generated

  user_said_valid: boolean;
  user_direction?: 'long' | 'short';
  user_entry?: number;
  user_stop?: number;
  user_target_1?: number;
  user_target_2?: number;
  user_level_types?: string[];
  user_confidence: number;
  time_taken_seconds: number;
}

interface SubmitAttemptResponse {
  attempt_id: string;

  // Grading
  is_correct: boolean;
  overall_score: number;
  grade: string;

  component_scores: {
    setup_identification: { score: number; max: number; correct: boolean };
    direction: { score: number; max: number; correct: boolean };
    entry_placement: { score: number; max: number; deviation: number };
    stop_placement: { score: number; max: number; deviation: number };
    target_selection: { score: number; max: number; deviation: number };
    level_identification: { score: number; max: number; correct: boolean };
  };

  // Correct answers
  correct_answers: {
    is_valid_setup: boolean;
    direction: string | null;
    ideal_entry: number | null;
    ideal_stop: number | null;
    ideal_target_1: number | null;
    primary_level_type: string | null;
  };

  // AI Feedback
  ai_feedback: {
    positive: string;
    improvement: string;
    specific_tip: string;
    ltp_concept: string;
  };

  // Stats update
  stats_update: {
    new_accuracy: number;
    streak: number;
    rank_change: number;
  };
}

// GET /api/practice/attempt/:id/reveal
// Get outcome data for chart playback

interface RevealOutcomeResponse {
  outcome_bars: Bar[]; // 5-min bars after freeze point
  outcome_summary: {
    result: 'hit_t1' | 'hit_t2' | 'stopped_out' | etc;
    max_favorable: number;
    max_adverse: number;
    duration_to_result_minutes: number;
  };
  annotations: {
    entry_bar_index: number;
    target_hit_bar_index: number | null;
    stop_hit_bar_index: number | null;
  };
}

// POST /api/practice/ai-scenario
// Generate new AI scenario

interface GenerateAIScenarioRequest {
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  focus_area?: string;
  symbol?: string; // Optional, system picks if not provided
}

interface GenerateAIScenarioResponse {
  scenario_data: AIGeneratedScenario; // Full scenario JSON from Claude
  chart_data: {
    daily: Bar[];
    hourly: Bar[];
    fifteen_min: Bar[];
    five_min: Bar[];
  };
  indicators: CalculatedIndicators;
  levels: ChartLevel[];
  context: ScenarioContext;
}
```

### 8.3 Implementation Examples

```typescript
// src/app/api/practice/scenarios/[id]/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { loadHistoricalScenario } from '@/lib/practice/historical-data';
import { redisClient } from '@/lib/redis';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scenarioId = params.id;

    // Get scenario metadata
    const { data: scenario, error } = await supabaseAdmin
      .from('practice_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .eq('is_active', true)
      .single();

    if (error || !scenario) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    // Check cache first
    const cacheKey = `practice:scenario:${scenarioId}`;
    const cached = await redisClient?.get(cacheKey);

    if (cached) {
      return NextResponse.json(JSON.parse(cached));
    }

    // Load historical data from Massive.com
    const chartData = await loadHistoricalScenario({
      symbol: scenario.symbol,
      date: scenario.scenario_date,
      freeze_time: scenario.freeze_time
    });

    const response = {
      scenario: {
        id: scenario.id,
        symbol: scenario.symbol,
        date: scenario.scenario_date,
        freeze_time: scenario.freeze_time,
        setup_type: scenario.setup_type,
        difficulty: scenario.difficulty
      },
      chart_data: chartData.bars,
      indicators: chartData.indicators,
      levels: chartData.levels,
      patience_candles: chartData.patienceCandles,
      context: chartData.context
    };

    // Cache for 24 hours (historical data doesn't change)
    await redisClient?.setex(cacheKey, 86400, JSON.stringify(response));

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error loading scenario:', error);
    return NextResponse.json(
      { error: 'Failed to load scenario' },
      { status: 500 }
    );
  }
}
```

---

## 9. Scoring & Feedback System

### 9.1 Scoring Algorithm

```typescript
// src/lib/practice/scoring.ts

interface ScoringInput {
  scenario: PracticeScenario;
  userResponse: UserAttemptResponse;
}

interface ScoringResult {
  overall_score: number;
  grade: string;
  is_correct: boolean;
  components: ComponentScores;
}

export function calculateScore(input: ScoringInput): ScoringResult {
  const { scenario, userResponse } = input;
  const components: ComponentScores = {
    setup_identification: { score: 0, max: 25 },
    direction: { score: 0, max: 15 },
    entry_placement: { score: 0, max: 20 },
    stop_placement: { score: 0, max: 20 },
    target_selection: { score: 0, max: 15 },
    level_identification: { score: 0, max: 5 }
  };

  // 1. Setup Identification (25 points)
  // Did they correctly identify if this was a valid setup?
  const correctlyIdentified = userResponse.user_said_valid === scenario.is_valid_setup;
  components.setup_identification.score = correctlyIdentified ? 25 : 0;
  components.setup_identification.correct = correctlyIdentified;

  // If they said "not valid" and were correct, they get full marks
  // If the setup was not valid, skip the rest of the scoring
  if (!scenario.is_valid_setup) {
    if (correctlyIdentified) {
      return {
        overall_score: 100,
        grade: 'A',
        is_correct: true,
        components
      };
    } else {
      return {
        overall_score: 0,
        grade: 'F',
        is_correct: false,
        components
      };
    }
  }

  // Setup was valid - continue scoring trade plan
  if (!userResponse.user_said_valid) {
    // They passed on a valid setup
    return {
      overall_score: 0,
      grade: 'F',
      is_correct: false,
      components
    };
  }

  // 2. Direction (15 points)
  const correctDirection = userResponse.user_direction === scenario.direction;
  components.direction.score = correctDirection ? 15 : 0;
  components.direction.correct = correctDirection;

  // If direction is wrong, significant penalty to other scores
  const directionMultiplier = correctDirection ? 1 : 0.3;

  // 3. Entry Placement (20 points)
  if (userResponse.user_entry && scenario.ideal_entry) {
    const entryDeviation = Math.abs(userResponse.user_entry - scenario.ideal_entry);
    const entryDeviationPercent = (entryDeviation / scenario.ideal_entry) * 100;

    // Full points if within 0.1%, scaling down to 0 at 1%
    if (entryDeviationPercent <= 0.1) {
      components.entry_placement.score = 20 * directionMultiplier;
    } else if (entryDeviationPercent <= 0.5) {
      components.entry_placement.score = 15 * directionMultiplier;
    } else if (entryDeviationPercent <= 1) {
      components.entry_placement.score = 10 * directionMultiplier;
    } else {
      components.entry_placement.score = 5 * directionMultiplier;
    }
    components.entry_placement.deviation = entryDeviationPercent;
  }

  // 4. Stop Placement (20 points)
  if (userResponse.user_stop && scenario.ideal_stop) {
    const stopDeviation = Math.abs(userResponse.user_stop - scenario.ideal_stop);
    const stopDeviationPercent = (stopDeviation / scenario.ideal_stop) * 100;

    // Check if stop is on correct side
    const stopOnCorrectSide = scenario.direction === 'long'
      ? userResponse.user_stop < userResponse.user_entry!
      : userResponse.user_stop > userResponse.user_entry!;

    if (!stopOnCorrectSide) {
      components.stop_placement.score = 0;
    } else if (stopDeviationPercent <= 0.2) {
      components.stop_placement.score = 20 * directionMultiplier;
    } else if (stopDeviationPercent <= 0.5) {
      components.stop_placement.score = 15 * directionMultiplier;
    } else if (stopDeviationPercent <= 1) {
      components.stop_placement.score = 10 * directionMultiplier;
    } else {
      components.stop_placement.score = 5 * directionMultiplier;
    }
    components.stop_placement.deviation = stopDeviationPercent;
  }

  // 5. Target Selection (15 points)
  if (userResponse.user_target_1 && scenario.ideal_target_1) {
    const targetDeviation = Math.abs(userResponse.user_target_1 - scenario.ideal_target_1);
    const targetDeviationPercent = (targetDeviation / scenario.ideal_target_1) * 100;

    if (targetDeviationPercent <= 0.3) {
      components.target_selection.score = 15 * directionMultiplier;
    } else if (targetDeviationPercent <= 0.7) {
      components.target_selection.score = 10 * directionMultiplier;
    } else if (targetDeviationPercent <= 1.5) {
      components.target_selection.score = 5 * directionMultiplier;
    }
    components.target_selection.deviation = targetDeviationPercent;
  }

  // 6. Level Identification (5 points)
  if (userResponse.user_level_types && scenario.primary_level_type) {
    const correctLevel = userResponse.user_level_types.includes(scenario.primary_level_type);
    components.level_identification.score = correctLevel ? 5 : 0;
    components.level_identification.correct = correctLevel;
  }

  // Calculate overall score
  const totalScore = Object.values(components).reduce((sum, c) => sum + c.score, 0);
  const maxScore = Object.values(components).reduce((sum, c) => sum + c.max, 0);
  const overallScore = Math.round((totalScore / maxScore) * 100);

  // Determine grade
  let grade: string;
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';
  else grade = 'F';

  // Is correct if they got the setup right and scored at least 60%
  const isCorrect = correctlyIdentified && correctDirection && overallScore >= 60;

  return {
    overall_score: overallScore,
    grade,
    is_correct: isCorrect,
    components
  };
}
```

### 9.2 AI Feedback Generation

```typescript
// src/lib/practice/ai-feedback.ts

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function generateFeedback(
  scenario: PracticeScenario,
  userResponse: UserAttemptResponse,
  scoringResult: ScoringResult
): Promise<AIFeedback> {
  const prompt = buildFeedbackPrompt(scenario, userResponse, scoringResult);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }]
  });

  // Parse Claude's response
  const content = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  try {
    return JSON.parse(content);
  } catch {
    // Fallback if JSON parsing fails
    return {
      positive: 'Good attempt! Keep practicing.',
      improvement: content,
      specific_tip: 'Review the LTP framework concepts.',
      ltp_concept: 'Remember: Level, Trend, Patience must all align.'
    };
  }
}

function buildFeedbackPrompt(
  scenario: PracticeScenario,
  userResponse: UserAttemptResponse,
  scoringResult: ScoringResult
): string {
  return `You are an expert LTP trading coach providing feedback on a practice attempt.

SCENARIO:
Symbol: ${scenario.symbol}
Date: ${scenario.scenario_date}
Setup Type: ${scenario.setup_type}
Was Valid: ${scenario.is_valid_setup}
${scenario.is_valid_setup ? `
Direction: ${scenario.direction}
Ideal Entry: $${scenario.ideal_entry}
Ideal Stop: $${scenario.ideal_stop}
Ideal Target: $${scenario.ideal_target_1}
Level Type: ${scenario.primary_level_type}
Outcome: ${scenario.actual_outcome}
` : ''}
Teaching Notes: ${scenario.teaching_notes}

STUDENT'S RESPONSE:
Said Valid: ${userResponse.user_said_valid}
${userResponse.user_said_valid ? `
Direction: ${userResponse.user_direction}
Entry: $${userResponse.user_entry}
Stop: $${userResponse.user_stop}
Target: $${userResponse.user_target_1}
Level Types: ${userResponse.user_level_types?.join(', ')}
` : ''}
Confidence: ${userResponse.user_confidence}/5
Time: ${userResponse.time_taken_seconds}s

SCORING RESULT:
Overall Score: ${scoringResult.overall_score}/100 (${scoringResult.grade})
${Object.entries(scoringResult.components).map(([key, val]) =>
  `${key}: ${val.score}/${val.max}`
).join('\n')}

Provide personalized feedback in JSON format:
{
  "positive": "1-2 sentences on what they did well (be specific)",
  "improvement": "1-2 sentences on what to improve (be specific and actionable)",
  "specific_tip": "One concrete tip for next time",
  "ltp_concept": "How this relates to L, T, or P in the framework"
}

Be encouraging but honest. Reference specific prices and levels from the scenario.`;
}
```

---

## 10. Gamification & Progression

### 10.1 Achievement Definitions

```typescript
// src/lib/practice/achievements.ts

export const PRACTICE_ACHIEVEMENTS = [
  // Milestone achievements
  {
    id: 'first_practice',
    name: 'First Steps',
    description: 'Complete your first practice scenario',
    icon: '👶',
    requirement: { type: 'total_completed', value: 1 },
    xp: 10
  },
  {
    id: 'practice_10',
    name: 'Getting Warmed Up',
    description: 'Complete 10 practice scenarios',
    icon: '🏃',
    requirement: { type: 'total_completed', value: 10 },
    xp: 25
  },
  {
    id: 'practice_50',
    name: 'Dedicated Student',
    description: 'Complete 50 practice scenarios',
    icon: '📚',
    requirement: { type: 'total_completed', value: 50 },
    xp: 100
  },
  {
    id: 'practice_100',
    name: 'Century Club',
    description: 'Complete 100 practice scenarios',
    icon: '💯',
    requirement: { type: 'total_completed', value: 100 },
    xp: 250
  },
  {
    id: 'practice_500',
    name: 'Practice Pro',
    description: 'Complete 500 practice scenarios',
    icon: '🏆',
    requirement: { type: 'total_completed', value: 500 },
    xp: 1000
  },

  // Accuracy achievements
  {
    id: 'sharp_eye',
    name: 'Sharp Eye',
    description: 'Achieve 80% accuracy over 25 scenarios',
    icon: '👁️',
    requirement: { type: 'accuracy_threshold', value: 0.80, min_attempts: 25 },
    xp: 150
  },
  {
    id: 'sniper',
    name: 'Setup Sniper',
    description: 'Achieve 90% accuracy over 50 scenarios',
    icon: '🎯',
    requirement: { type: 'accuracy_threshold', value: 0.90, min_attempts: 50 },
    xp: 500
  },

  // Streak achievements
  {
    id: 'streak_5',
    name: 'Hot Streak',
    description: 'Get 5 correct in a row',
    icon: '🔥',
    requirement: { type: 'streak', value: 5 },
    xp: 50
  },
  {
    id: 'streak_10',
    name: 'On Fire',
    description: 'Get 10 correct in a row',
    icon: '🔥🔥',
    requirement: { type: 'streak', value: 10 },
    xp: 150
  },
  {
    id: 'streak_25',
    name: 'Unstoppable',
    description: 'Get 25 correct in a row',
    icon: '🔥🔥🔥',
    requirement: { type: 'streak', value: 25 },
    xp: 500
  },

  // Skill-specific achievements
  {
    id: 'orb_master',
    name: 'ORB Master',
    description: '90% accuracy on ORB setups (min 20)',
    icon: '🌅',
    requirement: { type: 'setup_accuracy', setup_type: 'orb', value: 0.90, min_attempts: 20 },
    xp: 200
  },
  {
    id: 'trap_detector',
    name: 'Trap Detector',
    description: 'Correctly identify 20 trap setups',
    icon: '🪤',
    requirement: { type: 'trap_detection', value: 20 },
    xp: 200
  },
  {
    id: 'level_expert',
    name: 'Level Expert',
    description: '95% accuracy on level identification',
    icon: '📏',
    requirement: { type: 'component_accuracy', component: 'level_id', value: 0.95, min_attempts: 30 },
    xp: 200
  },
  {
    id: 'stop_master',
    name: 'Risk Manager',
    description: 'Stop placement within 0.2% of ideal 25 times',
    icon: '🛡️',
    requirement: { type: 'precision_stops', value: 25 },
    xp: 200
  },

  // Progression achievements
  {
    id: 'intermediate_unlocked',
    name: 'Rising Trader',
    description: 'Unlock intermediate difficulty',
    icon: '📈',
    requirement: { type: 'unlock_difficulty', value: 'intermediate' },
    xp: 100
  },
  {
    id: 'advanced_unlocked',
    name: 'Advanced Trader',
    description: 'Unlock advanced difficulty',
    icon: '🚀',
    requirement: { type: 'unlock_difficulty', value: 'advanced' },
    xp: 300
  }
];
```

### 10.2 Daily Challenges

```typescript
// Sample daily challenges
export const DAILY_CHALLENGE_TEMPLATES = [
  {
    title: 'ORB Spotter',
    description: 'Correctly identify 5 ORB setups',
    challenge_type: 'identify_valid',
    required_count: 5,
    required_accuracy: 0.6,
    setup_type_filter: 'orb_breakout',
    xp_reward: 50
  },
  {
    title: 'Trap Avoider',
    description: 'Correctly pass on 3 trap setups',
    challenge_type: 'spot_traps',
    required_count: 3,
    required_accuracy: 1.0,
    setup_type_filter: 'trap',
    xp_reward: 75
  },
  {
    title: 'Perfect Entries',
    description: 'Get entry within 0.1% of ideal 3 times',
    challenge_type: 'precision_entry',
    required_count: 3,
    xp_reward: 60
  },
  {
    title: 'Quick Draw',
    description: 'Complete 5 scenarios in under 30 seconds each',
    challenge_type: 'speed_run',
    required_count: 5,
    required_accuracy: 0.6,
    xp_reward: 40
  },
  {
    title: 'Full Analysis',
    description: 'Score 85%+ on 3 scenarios',
    challenge_type: 'high_score',
    required_count: 3,
    required_accuracy: 0.85,
    xp_reward: 100
  }
];
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal: Basic infrastructure and single-chart practice**

- [ ] Install Lightweight Charts library
- [ ] Create basic chart component with candlesticks
- [ ] Implement indicator calculations (EMA, VWAP)
- [ ] Create practice_scenarios table and seed 10 scenarios
- [ ] Build basic Practice Hub page
- [ ] Build Scenario View with single 5-min chart
- [ ] Implement basic scoring (valid/invalid only)
- [ ] Create practice_attempts table
- [ ] Basic stats tracking

**Deliverable:** Users can practice with 5-min chart, get scored on setup identification

### Phase 2: Full Chart Experience (Week 3-4)
**Goal: Multi-pane TradingView-style layout**

- [ ] Implement 4-pane chart grid layout
- [ ] Add all timeframe charts (daily, hourly, 15m, 5m)
- [ ] Implement EMA Ribbon visualization
- [ ] Add level drawing on charts
- [ ] Add patience candle highlighting
- [ ] Implement click-to-place entry/stop/target
- [ ] Add volume bars to 5-min chart
- [ ] Context panel with market info

**Deliverable:** Full TradingView-like experience with all indicators

### Phase 3: Scoring & Feedback (Week 5)
**Goal: Complete scoring system with AI coaching**

- [ ] Implement full component scoring algorithm
- [ ] Integrate Claude for feedback generation
- [ ] Build result/reveal page with chart playback
- [ ] Add comparison panel (user vs ideal)
- [ ] Implement outcome animation on chart

**Deliverable:** Users get detailed scores and AI coaching after each attempt

### Phase 4: Historical Data Pipeline (Week 6)
**Goal: Robust data fetching and caching**

- [ ] Implement Massive.com data fetching for all timeframes
- [ ] Build indicator calculation pipeline
- [ ] Implement Redis caching for historical data
- [ ] Create admin tool for scenario curation
- [ ] Curate 50 initial scenarios across difficulties
- [ ] Build scenario seeding scripts

**Deliverable:** 50 curated historical scenarios ready for practice

### Phase 5: AI Scenario Generation (Week 7-8)
**Goal: Unlimited AI-generated practice**

- [ ] Design and test AI scenario generation prompt
- [ ] Implement synthetic bar generation
- [ ] Build AI scenario API endpoint
- [ ] Integrate AI scenarios into practice flow
- [ ] Implement adaptive difficulty selection
- [ ] Add focus area detection from user stats

**Deliverable:** Users can practice with unlimited AI scenarios

### Phase 6: Gamification (Week 9)
**Goal: Achievements, challenges, progression**

- [ ] Implement achievement system
- [ ] Build daily challenge system
- [ ] Add XP and leveling
- [ ] Implement difficulty unlocking
- [ ] Add streak tracking
- [ ] Build leaderboard for practice accuracy

**Deliverable:** Full gamification with achievements and daily challenges

### Phase 7: Polish & Testing (Week 10)
**Goal: Production-ready release**

- [ ] Performance optimization
- [ ] Mobile responsive design
- [ ] Error handling and edge cases
- [ ] User testing and feedback
- [ ] Bug fixes
- [ ] Documentation

**Deliverable:** Production-ready Practice Mode

---

## 12. File Structure

```
src/
├── app/
│   └── (dashboard)/
│       └── practice/
│           ├── page.tsx                    # Practice Hub
│           ├── layout.tsx                  # Practice layout
│           ├── historical/
│           │   └── page.tsx                # Historical scenario list
│           ├── ai/
│           │   └── page.tsx                # AI scenario generator
│           ├── scenario/
│           │   └── [id]/
│           │       ├── page.tsx            # Scenario view (charts + decision)
│           │       └── result/
│           │           └── page.tsx        # Result/feedback view
│           ├── stats/
│           │   └── page.tsx                # Detailed stats view
│           └── challenges/
│               └── page.tsx                # Daily challenges
│
├── app/api/practice/
│   ├── scenarios/
│   │   ├── route.ts                        # GET list, POST create
│   │   └── [id]/
│   │       ├── route.ts                    # GET single scenario
│   │       └── start/
│   │           └── route.ts                # POST start attempt
│   ├── attempt/
│   │   ├── route.ts                        # POST submit attempt
│   │   └── [id]/
│   │       └── reveal/
│   │           └── route.ts                # GET outcome data
│   ├── ai-scenario/
│   │   └── route.ts                        # POST generate AI scenario
│   ├── stats/
│   │   └── route.ts                        # GET user stats
│   └── challenges/
│       ├── route.ts                        # GET challenges
│       └── [id]/
│           └── progress/
│               └── route.ts                # POST update progress
│
├── components/
│   └── practice/
│       ├── PracticeHub.tsx                 # Main hub component
│       ├── ChartGrid.tsx                   # 4-pane chart layout
│       ├── PracticeChart.tsx               # Single chart with indicators
│       ├── IndicatorLegend.tsx             # Chart legend component
│       ├── LevelLines.tsx                  # Horizontal level lines
│       ├── PatienceMarkers.tsx             # Patience candle highlights
│       ├── EMARibbon.tsx                   # Ribbon/cloud visualization
│       ├── VolumePane.tsx                  # Volume subplot
│       ├── ContextPanel.tsx                # Market context info
│       ├── DecisionPanel.tsx               # User input form
│       ├── ResultPanel.tsx                 # Score breakdown
│       ├── AIFeedback.tsx                  # Coach feedback display
│       ├── ChartPlayback.tsx               # Outcome animation
│       ├── StatsOverview.tsx               # Stats summary
│       ├── SkillBreakdown.tsx              # Component accuracy bars
│       ├── DailyChallenge.tsx              # Challenge card
│       ├── AchievementPopup.tsx            # Achievement notification
│       └── ScenarioCard.tsx                # Scenario list item
│
├── lib/
│   └── practice/
│       ├── historical-data.ts              # Massive.com data fetching
│       ├── indicators.ts                   # EMA, VWAP, ribbon calculations
│       ├── levels.ts                       # Level calculation
│       ├── patience-detection.ts           # Patience candle detection
│       ├── scoring.ts                      # Scoring algorithm
│       ├── ai-feedback.ts                  # Claude feedback integration
│       ├── ai-scenario.ts                  # AI scenario generation
│       ├── adaptive.ts                     # Adaptive difficulty
│       ├── achievements.ts                 # Achievement definitions & checks
│       ├── challenges.ts                   # Challenge logic
│       └── stats.ts                        # Stats calculations
│
├── types/
│   └── practice.ts                         # Practice mode types
│
└── hooks/
    └── practice/
        ├── useScenario.ts                  # Scenario loading hook
        ├── useChart.ts                     # Chart management hook
        ├── usePracticeStats.ts             # Stats hook
        └── useTimer.ts                     # Countdown timer hook
```

---

## Appendix A: Lightweight Charts Setup

```typescript
// src/components/practice/PracticeChart.tsx

import { createChart, IChartApi, ISeriesApi, CandlestickData } from 'lightweight-charts';
import { useRef, useEffect } from 'react';

interface PracticeChartProps {
  bars: Bar[];
  indicators: {
    ema9: number[];
    ema21: number[];
    vwap?: number[];
    sma200?: number[];
  };
  levels: ChartLevel[];
  patienceCandles?: PatienceHighlight[];
  ribbon?: RibbonData;
  showVolume?: boolean;
  height?: number;
  onPriceClick?: (price: number) => void;
}

export function PracticeChart({
  bars,
  indicators,
  levels,
  patienceCandles,
  ribbon,
  showVolume = false,
  height = 300,
  onPriceClick
}: PracticeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create chart
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1a1a2e' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#2d2d44' },
        horzLines: { color: '#2d2d44' },
      },
      crosshair: {
        mode: 1, // Magnet mode
      },
      timeScale: {
        borderColor: '#2d2d44',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#2d2d44',
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Convert bars to chart format
    const candleData: CandlestickData[] = bars.map(bar => ({
      time: bar.t as any, // Unix timestamp
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
    }));
    candleSeries.setData(candleData);

    // Add EMA 9 (blue)
    const ema9Series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      title: 'EMA 9',
    });
    ema9Series.setData(
      indicators.ema9.map((value, i) => ({
        time: bars[i]?.t as any,
        value,
      })).filter(d => d.value)
    );

    // Add EMA 21 (orange)
    const ema21Series = chart.addLineSeries({
      color: '#f97316',
      lineWidth: 2,
      title: 'EMA 21',
    });
    ema21Series.setData(
      indicators.ema21.map((value, i) => ({
        time: bars[i]?.t as any,
        value,
      })).filter(d => d.value)
    );

    // Add VWAP if provided (purple)
    if (indicators.vwap) {
      const vwapSeries = chart.addLineSeries({
        color: '#9333ea',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        title: 'VWAP',
      });
      vwapSeries.setData(
        indicators.vwap.map((value, i) => ({
          time: bars[i]?.t as any,
          value,
        })).filter(d => d.value)
      );
    }

    // Add SMA 200 if provided (white)
    if (indicators.sma200) {
      const sma200Series = chart.addLineSeries({
        color: '#ffffff',
        lineWidth: 1,
        title: 'SMA 200',
      });
      sma200Series.setData(
        indicators.sma200.map((value, i) => ({
          time: bars[i]?.t as any,
          value,
        })).filter(d => d.value)
      );
    }

    // Add level lines
    levels.forEach(level => {
      const levelLine = candleSeries.createPriceLine({
        price: level.price,
        color: level.style.color,
        lineWidth: level.style.lineWidth,
        lineStyle: level.style.lineStyle === 'dashed' ? 1 : 0,
        axisLabelVisible: true,
        title: level.label,
      });
    });

    // Handle click for entry/stop/target placement
    if (onPriceClick) {
      chart.subscribeClick((param) => {
        if (param.point && param.seriesData.size > 0) {
          const price = candleSeries.coordinateToPrice(param.point.y);
          if (price) onPriceClick(price);
        }
      });
    }

    // Handle resize
    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [bars, indicators, levels, height, onPriceClick]);

  // Highlight patience candles
  useEffect(() => {
    if (!candleSeriesRef.current || !patienceCandles) return;

    patienceCandles.forEach(pc => {
      candleSeriesRef.current?.setMarkers([
        ...candleSeriesRef.current.markers(),
        {
          time: bars[pc.barIndex]?.t as any,
          position: 'belowBar',
          color: '#fbbf24',
          shape: 'circle',
          text: 'P',
        },
      ]);
    });
  }, [patienceCandles, bars]);

  return <div ref={containerRef} className="w-full" />;
}
```

---

## Appendix B: Environment Variables

```env
# Practice Mode Configuration
MASSIVE_API_KEY=your_massive_api_key
ANTHROPIC_API_KEY=your_anthropic_key

# Practice Settings
PRACTICE_TIMER_BEGINNER=60
PRACTICE_TIMER_INTERMEDIATE=45
PRACTICE_TIMER_ADVANCED=30
PRACTICE_MAX_DAILY_AI_SCENARIOS=50
```

---

## Appendix C: Migration Script

```sql
-- Run this migration to add Practice Mode tables
-- Migration: 010_practice_mode.sql

BEGIN;

-- Create all practice mode tables (see Section 7)
-- ... (full SQL from Section 7.1)

-- Seed initial challenges
INSERT INTO practice_challenges (title, description, challenge_type, required_count, required_accuracy, xp_reward, is_daily)
VALUES
  ('ORB Spotter', 'Correctly identify 5 ORB setups', 'identify_valid', 5, 0.6, 50, true),
  ('Trap Avoider', 'Correctly pass on 3 trap setups', 'spot_traps', 3, 1.0, 75, true),
  ('Quick Draw', 'Complete 5 scenarios under 30s each', 'speed_run', 5, 0.6, 40, true);

COMMIT;
```

---

## Summary

This implementation plan provides a comprehensive roadmap for building "The Setup Lab" - a full-featured practice mode that:

1. **Replicates TradingView** - 4-pane layout with all KCU indicators
2. **Uses Real Data** - Historical scenarios from Massive.com
3. **Provides Unlimited Practice** - AI-generated scenarios via Claude
4. **Coaches Effectively** - AI feedback on every attempt
5. **Gamifies Learning** - Achievements, challenges, progression

**Estimated Timeline:** 10 weeks for full implementation
**Priority Order:** Foundation → Charts → Scoring → Data → AI → Gamification → Polish

Ready to begin implementation when you give the go-ahead!
