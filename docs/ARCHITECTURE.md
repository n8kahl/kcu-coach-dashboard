# KCU Coach - System Architecture

## Overview

KCU Coach is a real-time trading intelligence platform built on the LTP (Level, Trend, Patience) Framework from Kay Capitals University.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │   Web Dashboard │  │   Discord Bot   │  │   Mobile (Future)           │ │
│  │   (Next.js 16)  │  │   (Discord.js)  │  │   (React Native)            │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘ │
└───────────┼────────────────────┼─────────────────────────┼──────────────────┘
            │                    │                         │
            ▼                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Next.js API Routes                               │   │
│  │  /api/auth/*     /api/companion/*    /api/coach/*    /api/admin/*   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     WebSocket Server (SSE)                           │   │
│  │  Real-time setups, key levels, market status, alerts                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SERVICE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  LTP Engine    │  │  AI Coach      │  │  Alert System  │                │
│  │  - Detection   │  │  - RAG Search  │  │  - Broadcasts  │                │
│  │  - Scoring     │  │  - Claude API  │  │  - Push/Web    │                │
│  │  - MTF Anal.   │  │  - Context     │  │  - Discord     │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │  Market Data   │  │  Knowledge     │  │  Gamification  │                │
│  │  - Massive WS  │  │  - Embeddings  │  │  - Leaderboard │                │
│  │  - Levels Calc │  │  - YouTube     │  │  - Achievements│                │
│  │  - Events      │  │  - Transcripts │  │  - Win Cards   │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                │
│  │   Supabase     │  │   Redis        │  │   Massive.com  │                │
│  │   PostgreSQL   │  │   (Cache)      │  │   (Market Data)│                │
│  │   + pgvector   │  │                │  │                │                │
│  └────────────────┘  └────────────────┘  └────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Services

### 1. LTP Detection Engine

The heart of the platform. Analyzes market data to detect LTP-compliant setups.

```typescript
interface LTPEngine {
  // Core detection
  analyzeSymbol(symbol: string): Promise<SetupAnalysis>;
  detectPatienceCandle(bars: Bar[]): PatienceCandleResult;
  calculateConfluence(analysis: SetupAnalysis): number;

  // Level calculation
  calculateKeyLevels(symbol: string): Promise<KeyLevel[]>;
  calculateHTFLevels(symbol: string): Promise<KeyLevel[]>;
  detectLiquidityZones(symbol: string, bars: Bar[]): LiquidityZone[];

  // MTF Analysis
  analyzeMTF(symbol: string): Promise<MTFAnalysis>;
  getTimeframeAlignment(analyses: MTFAnalysis[]): AlignmentScore;

  // Scoring
  scoreLevelProximity(price: number, levels: KeyLevel[]): number;
  scoreTrendAlignment(mtf: MTFAnalysis): number;
  scorePatienceQuality(candle: PatienceCandleResult): number;
}
```

**Detection Flow:**
1. Receive real-time bar data from Massive.com WebSocket
2. Calculate key levels (PDH, PDL, VWAP, ORB, EMAs, HTF)
3. Analyze trend via ORB status, EMA alignment, MTF
4. Detect patience candle formation at confluence zones
5. Score L/T/P individually, calculate overall confluence
6. If threshold met, emit setup to subscribers

### 2. Market Data Service

Manages all connections to Massive.com API.

```typescript
interface MarketDataService {
  // WebSocket connections
  connectStocksWS(): void;
  connectOptionsWS(): void;
  subscribeSymbol(symbol: string): void;

  // REST endpoints
  getQuote(symbol: string): Promise<Quote>;
  getAggregates(symbol: string, timeframe: string): Promise<Bar[]>;
  getOptionsChain(symbol: string, expiry?: string): Promise<OptionsChain>;

  // Calculated data
  calculateVWAP(bars: Bar[]): number;
  calculateEMA(closes: number[], period: number): number;
  calculateORB(bars: Bar[]): ORBLevels;

  // Events
  getEarningsCalendar(symbols: string[]): Promise<EarningsEvent[]>;
  getEconomicCalendar(): Promise<EconomicEvent[]>;
}
```

### 3. AI Coach Service

RAG-powered coaching with real-time market context.

```typescript
interface AICoachService {
  // Chat
  chat(message: string, context: ChatContext): Promise<CoachResponse>;

  // Knowledge retrieval
  searchKnowledge(query: string, limit?: number): Promise<KnowledgeChunk[]>;
  findRelevantVideos(topic: string): Promise<YouTubeVideo[]>;

  // Context building
  buildMarketContext(symbols: string[]): MarketContext;
  buildTradeContext(trade: Trade): TradeContext;

  // Grounding
  groundResponse(response: string, sources: KnowledgeChunk[]): GroundedResponse;
}
```

**AI Context Injection:**
```typescript
const systemPrompt = `
You are the KCU Coach, trained on Kay Capitals University methodology.
You follow the LTP Framework: Level, Trend, Patience.

CURRENT MARKET CONTEXT:
${marketContext}

USER'S WATCHLIST:
${watchlistContext}

ACTIVE SETUPS:
${setupsContext}

When answering:
1. Reference specific KCU concepts
2. Link to relevant YouTube videos when helpful
3. Use current market data to illustrate points
4. Be encouraging but disciplined (like Kay)
`;
```

### 4. Alert & Broadcast System

Multi-channel notification system.

```typescript
interface AlertService {
  // Admin broadcasts
  broadcastAlert(alert: AdminAlert): Promise<void>;
  scheduleAlert(alert: AdminAlert, time: Date): Promise<void>;

  // Setup alerts
  notifySetupReady(setup: DetectedSetup): Promise<void>;
  notifySetupTriggered(setup: DetectedSetup): Promise<void>;

  // Event alerts
  notifyEarnings(event: EarningsEvent): Promise<void>;
  notifyEconomic(event: EconomicEvent): Promise<void>;

  // User preferences
  getUserChannels(userId: string): NotificationChannel[];
  sendToChannels(notification: Notification, channels: Channel[]): Promise<void>;
}
```

---

## API Routes

### Authentication
| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/discord` | GET | Discord OAuth initiate |
| `/api/auth/callback` | GET | OAuth callback |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/me` | GET | Get current user |

### Companion Mode
| Route | Method | Description |
|-------|--------|-------------|
| `/api/companion/watchlist` | GET | Get user's watchlist |
| `/api/companion/watchlist` | POST | Add symbol to watchlist |
| `/api/companion/watchlist` | DELETE | Remove symbol |
| `/api/companion/setups` | GET | Get detected setups |
| `/api/companion/setups/[id]/subscribe` | POST | Subscribe to setup |
| `/api/companion/levels/[symbol]` | GET | Get key levels |
| `/api/companion/mtf/[symbol]` | GET | Get MTF analysis |
| `/api/companion/stream` | GET | SSE stream for real-time |

### AI Coach
| Route | Method | Description |
|-------|--------|-------------|
| `/api/coach/chat` | POST | Send message to coach |
| `/api/coach/context` | GET | Get current market context |
| `/api/coach/videos` | GET | Search YouTube videos |

### Admin
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/alerts` | GET/POST | Manage alerts |
| `/api/admin/watchlist` | GET/POST | Manage shared watchlist |
| `/api/admin/users` | GET | List users |
| `/api/admin/users/[id]/role` | PUT | Update user role |

### Super Admin
| Route | Method | Description |
|-------|--------|-------------|
| `/api/superadmin/config` | GET/PUT | Strategy configs |
| `/api/superadmin/templates` | GET/POST | Alert templates |
| `/api/superadmin/roles` | GET/POST | Role management |
| `/api/superadmin/knowledge/ingest` | POST | Ingest YouTube |

### Journal
| Route | Method | Description |
|-------|--------|-------------|
| `/api/journal/trades` | GET/POST | Trade entries |
| `/api/journal/trades/[id]` | GET/PUT/DELETE | Single trade |
| `/api/journal/stats` | GET | Trading statistics |
| `/api/journal/grade` | POST | AI grade a trade |

---

## Real-Time Data Flow

```
Massive.com WebSocket
        │
        ▼
┌───────────────────┐
│  Market Data Svc  │──────────────────────────────────┐
└─────────┬─────────┘                                  │
          │                                            │
          ▼                                            ▼
┌───────────────────┐                        ┌─────────────────┐
│   LTP Engine      │                        │  Redis Cache    │
│   - Calc Levels   │                        │  - Quotes       │
│   - Detect Setup  │                        │  - Levels       │
│   - Score L/T/P   │                        │  - Setups       │
└─────────┬─────────┘                        └─────────────────┘
          │                                            │
          ▼                                            │
┌───────────────────┐                                  │
│  Supabase         │◄─────────────────────────────────┘
│  - detected_setups│
│  - key_levels     │
│  - Realtime pub   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  SSE Server       │
│  /api/.../stream  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Web Dashboard    │
│  - Live updates   │
│  - Setup cards    │
│  - Level markers  │
└───────────────────┘
```

---

## Key Level Calculation

### Intraday Levels (Recalculated every bar)
- **VWAP**: Running calculation from day's bars
- **ORB High/Low**: First 15-minute candle
- **9 EMA**: 9-period exponential moving average
- **21 EMA**: 21-period exponential moving average
- **HOD/LOD**: Today's high/low

### Daily Levels (Calculated at market open)
- **PDH**: Previous day high
- **PDL**: Previous day low
- **PDC**: Previous day close
- **Pre-market H/L**: Pre-market session high/low

### HTF Levels (Calculated on schedule)
- **Weekly H/L**: Current week high/low
- **Monthly H/L**: Current month high/low
- **200 SMA**: 200-day simple moving average
- **Hourly Pivots**: Hourly chart key levels

### Liquidity Zones (Calculated from volume)
- **High Volume Nodes**: Price levels with significant volume
- **Low Volume Nodes**: Potential breakout zones
- **VWAP Bands**: ±1, ±2 standard deviations

---

## Multi-Timeframe Analysis

### Timeframe Hierarchy
```
Weekly  → Daily  → 4H  → 1H  → 15m  → 5m  → 2m
  ↓         ↓       ↓     ↓      ↓      ↓     ↓
Bias    Structure  HTF   MTF   Entry  Timing Scalp
```

### Analysis per Timeframe
```typescript
interface TimeframeAnalysis {
  timeframe: '2m' | '5m' | '15m' | '1h' | '4h' | 'daily' | 'weekly';
  trend: 'bullish' | 'bearish' | 'neutral';
  structure: 'higher-highs' | 'lower-lows' | 'range';
  emaPosition: {
    above9: boolean;
    above21: boolean;
    above200: boolean;
  };
  orbStatus: 'above' | 'below' | 'inside';
  vwapPosition: 'above' | 'below';
  momentum: 'strong' | 'moderate' | 'weak';
}
```

### Alignment Score
```typescript
function calculateMTFAlignment(analyses: TimeframeAnalysis[]): number {
  let score = 0;
  const weights = {
    weekly: 0.15,
    daily: 0.20,
    '4h': 0.15,
    '1h': 0.20,
    '15m': 0.15,
    '5m': 0.10,
    '2m': 0.05
  };

  const primaryTrend = analyses.find(a => a.timeframe === 'daily')?.trend;

  for (const analysis of analyses) {
    if (analysis.trend === primaryTrend) {
      score += weights[analysis.timeframe] * 100;
    }
  }

  return Math.round(score);
}
```

---

## Environment Variables

```env
# Database
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_ANON_KEY=

# Auth
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Market Data
MASSIVE_API_KEY=
MASSIVE_WS_URL=wss://socket.massive.com

# AI
ANTHROPIC_API_KEY=
OPENAI_API_KEY=  # For embeddings

# Discord Bot
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=

# Cache
REDIS_URL=

# Feature Flags
ENABLE_OPTIONS_ANALYSIS=true
ENABLE_MTF_ANALYSIS=true
ENABLE_EARNINGS_ALERTS=true
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Next.js Application                     │   │
│  │  - Dashboard Pages                                   │   │
│  │  - API Routes                                        │   │
│  │  - SSE Endpoints                                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Supabase    │    │  Railway/Fly  │    │   Upstash     │
│   - Database  │    │  - Discord    │    │   - Redis     │
│   - Auth      │    │    Bot        │    │   - Cache     │
│   - Realtime  │    │  - WS Worker  │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Numeric Invariants

Trading applications require bulletproof numeric handling. The following invariants are enforced:

### Core Rules

1. **No API endpoint returns `NaN` or `Infinity`** in JSON responses
2. **Division by zero** returns a safe fallback (0 or null) with a reason flag
3. **Percent change calculations** handle zero denominators gracefully
4. **All numeric outputs** are finite numbers or explicit null

### Safe Utilities (`src/lib/number.ts`)

All division operations should use these utilities:

```typescript
import {
  safeDivide,        // Returns { value, reason? }
  safeDivideValue,   // Returns just the number
  safePercentChange, // Safe percent calculation
  safeWinRate,       // wins/total * 100
  safeProfitFactor,  // profit/loss (0 if no losses, not Infinity)
  safeAverage,       // sum/count
  safeRiskReward,    // reward/risk
  clamp,             // Constrain to range
  isFiniteNumber,    // Type guard
  isPositiveFinite,  // Type guard for positive numbers
} from '@/lib/number';
```

### Examples

```typescript
// BAD - can produce NaN or Infinity
const winRate = (wins / total) * 100;
const profitFactor = totalWins / totalLosses;

// GOOD - always produces finite numbers
const winRate = safeWinRate(wins, total);
const profitFactor = safeProfitFactor(totalWins, totalLosses);
```

### Reason Flags

Safe functions return a reason when they fall back:

```typescript
const result = safeDivide(10, 0);
// { value: 0, reason: 'zero_denominator' }

const pctChange = safePercentChange(100, 0);
// { value: 0, reason: 'zero_base' }
```

Possible reasons:
- `zero_denominator` - Division by zero attempted
- `zero_base` - Percent change with zero base value
- `invalid_input` - NaN or Infinity in inputs
- `infinity_result` - Calculation would produce Infinity

### Testing

Run `npm test -- number` to verify numeric safety. The test suite includes:
- Unit tests for all safe math functions
- JSON serialization safety assertions
- API response structure validation

---

## Trustworthy AI Coaching

The AI coaching system is designed with a "trust by design" architecture that prevents the AI from hallucinating scores or being manipulated by prompt injection.

### Core Principle: Separation of Concerns

```
┌─────────────────────────────────────────────────────────────────┐
│                    DETERMINISTIC LAYER                           │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   LTP Engine        │    │   LTP Gamma Engine              │ │
│  │   - calculateLTP()  │    │   - calculateLTP2Score()        │ │
│  │   - generateScore   │    │   - generateLTP2Score           │ │
│  │     Explanation()   │    │     Explanation()               │ │
│  └──────────┬──────────┘    └──────────────┬──────────────────┘ │
└─────────────┼──────────────────────────────┼────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SCORE EXPLANATION                             │
│  Pre-computed, deterministic breakdown:                          │
│  - Component scores (Level, Trend, Patience)                     │
│  - Human-readable reasons                                        │
│  - Input references (audit trail)                                │
└─────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI COACH LAYER                                │
│  Claude API (mode: 'coach')                                      │
│                                                                  │
│  ALLOWED: Explain scores, coach user, suggest actions            │
│  FORBIDDEN: Compute, modify, or override scores                  │
│                                                                  │
│  System prompt explicitly forbids score computation              │
└──────────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VALIDATION LAYER                              │
│  Zod schema validation of AI output:                             │
│  - message (required, 1-4000 chars)                              │
│  - confidence (low | medium | high)                              │
│  - actions (typed, max 3)                                        │
│  - disclaimers (array)                                           │
│  - references (what inputs were used)                            │
│                                                                  │
│  Invalid output → Safe fallback response                         │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ltp-engine.ts` | `ScoreExplanation` type and `generateScoreExplanation()` |
| `src/lib/ltp-gamma-engine.ts` | `LTP2ScoreExplanation` type and `generateLTP2ScoreExplanation()` |
| `src/lib/ai-output-schema.ts` | Zod schemas, `parseAICoachResponse()`, fallback response |
| `src/lib/ai-context.ts` | `STRUCTURED_OUTPUT_PROMPT`, system prompt generation |
| `src/app/api/ai/unified/route.ts` | `handleCoachMode()` - structured coaching endpoint |

### Usage

```typescript
// 1. Compute score deterministically (BEFORE calling AI)
const scoreExplanation = generateScoreExplanation(
  symbol,
  direction,
  currentPrice,
  levelResult,
  trendScore,
  patienceResult,
  mtfAnalyses
);

// 2. Call AI with pre-computed explanation
const response = await fetch('/api/ai/unified', {
  method: 'POST',
  body: JSON.stringify({
    message: 'Explain my trade',
    mode: 'coach', // Uses structured output mode
    scoreExplanation, // Pre-computed, AI cannot modify
  }),
});

// 3. Response is always validated
const data = await response.json();
// data.coachResponse is guaranteed to match CoachResponseSchema
```

### Security Guarantees

1. **No hallucinated scores**: AI receives `ScoreExplanation`, cannot compute its own
2. **Prompt injection resistance**: Output is validated against strict Zod schema
3. **Audit trail**: `references` array tracks what inputs influenced the response
4. **Safe fallback**: Invalid AI output returns `SAFE_FALLBACK_RESPONSE`, never errors

### Testing

Run `npm test -- ai-output-schema` to verify:
- Schema validation for all field types
- Fallback behavior for invalid JSON
- Prompt injection prevention
- Reference type validation

---

## Evidence Trail & Data Retention

### Trace Tables

Every coaching interaction and alert is logged for debugging and audit purposes:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `coaching_traces` | AI coaching interactions | input_snapshot, score_explanation, ai_response |
| `alert_traces` | Alert generation | input_snapshot, alert_content, delivery_status |

### Retention Policy

**Default retention: 30 days**

Traces older than 30 days are automatically deleted via scheduled cleanup. This balances:
- Debugging needs (issues typically surface within days)
- Storage costs
- Privacy compliance (GDPR)

Configure via environment variable:
```
TRACE_RETENTION_DAYS=30  # Default
```

### Privacy & GDPR

When a user requests data deletion:
1. `coaching_traces.user_id` is set to NULL (not cascade deleted)
2. User message content in `input_snapshot` is redacted to `[REDACTED]`
3. Trace remains for audit purposes but is anonymized

Call the anonymization function:
```sql
SELECT anonymize_user_traces('user-uuid-here');
```

### Admin Access

Traces are admin-only accessible at `/admin/traces`:
- Filter by symbol, date, user, trace type
- View full trace details
- Export as JSON for debugging
- Monitor fallback rate (AI validation failures)

### Key Files

| File | Purpose |
|------|---------|
| `supabase-schema-v4.sql` | Table definitions, indexes, cleanup functions |
| `src/lib/trace-service.ts` | Logging and retrieval functions |
| `src/app/api/admin/traces/route.ts` | Admin API for trace access |
| `src/app/(admin)/admin/traces/page.tsx` | Admin UI |

---

## Mock Data Safety

Mock data is available for development and testing but is **strictly forbidden in production**. Multiple layers of protection ensure mock data paths cannot be accidentally enabled.

### Feature Flag

```typescript
// src/lib/feature-flags.ts
export const USE_MOCK_DATA: boolean =
  process.env.USE_MOCK_DATA === 'true' && process.env.NODE_ENV !== 'production';
```

The `USE_MOCK_DATA` flag requires BOTH conditions:
1. `USE_MOCK_DATA=true` in environment
2. `NODE_ENV` is NOT `production`

### Protection Layers

| Layer | Protection | Location |
|-------|-----------|----------|
| **Flag** | `USE_MOCK_DATA` always false in production | `src/lib/feature-flags.ts` |
| **Assertion** | `assertMockAllowed()` throws in production | `src/lib/feature-flags.ts` |
| **Middleware** | `/companion/mock` route blocked in production | `src/middleware.ts` |
| **Hooks** | Client hooks call `assertMockAllowed()` | `src/hooks/useMockCompanionData.ts` |

### Usage

```typescript
import { USE_MOCK_DATA, assertMockAllowed, isMockEnabled } from '@/lib/feature-flags';

// Check if mock data is enabled (safe, returns boolean)
if (isMockEnabled()) {
  // Use mock data
}

// Assert mock is allowed (throws if not)
assertMockAllowed(); // Throws in production, even if USE_MOCK_DATA=true

// Direct flag access (use isMockEnabled() instead)
if (USE_MOCK_DATA) {
  // ...
}
```

### Canonical Market Types

All market data types are defined in one location to prevent drift:

```typescript
// src/types/market.ts
export interface Quote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  // ... complete definition
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
}

export type Candle = Bar; // Alias for compatibility
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/feature-flags.ts` | Feature flag definitions and assertions |
| `src/types/market.ts` | Canonical Quote, Bar, Candle types |
| `src/middleware.ts` | Route protection for mock paths |
| `src/lib/mock/mock-scenarios.ts` | Mock data generators |
| `src/__tests__/lib/mock-safety.test.ts` | Production safety tests |

### Testing

Run `npm test -- mock-safety` to verify:
- `USE_MOCK_DATA` is always false in production
- `assertMockAllowed()` throws in production
- `isMockEnabled()` returns false in production
- Mock routes are blocked in production
- Cannot enable mock data via any env var combination in production
