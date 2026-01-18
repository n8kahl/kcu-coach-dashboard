# KCU Coach - Updated Proposal Summary

## Your Questions Answered

### 1. Can students view a watchlist and monitor setups along with the admin?

**YES - Here's how it works:**

| Feature | Admin | Student |
|---------|-------|---------|
| Create shared watchlist | ✅ | ❌ |
| View shared watchlist | ✅ | ✅ |
| Add personal symbols | ✅ | ✅ |
| See all detected setups | ✅ | ✅ |
| Subscribe to setup alerts | ✅ | ✅ |
| See L/T/P scores | ✅ | ✅ |
| See entry/stop/targets | ✅ | ✅ |

**Implementation:**
- Admin creates a "shared watchlist" with symbols like SPY, QQQ, NVDA, TSLA, AAPL
- This watchlist is visible to ALL students
- Students can also add their own personal symbols
- The LTP engine detects setups on ALL symbols (shared + personal)
- Everyone sees the same setups with the same scores

---

### 2. Can key levels be marked in real-time for tickers?

**YES - Comprehensive level system:**

**Levels Calculated:**
| Level Type | Source | Update Frequency |
|------------|--------|------------------|
| PDH/PDL/PDC | Previous day bars | Daily at open |
| ORB High/Low | First 15-min candle | Once per day |
| VWAP | Running calculation | Every bar |
| 9 EMA / 21 EMA | Intraday bars | Every bar |
| 200 SMA | Daily bars | Daily |
| Premarket H/L | Pre-market session | At market open |
| Weekly H/L | Weekly bars | Daily |
| Monthly H/L | Monthly bars | Daily |
| Hourly Pivots | 60-min chart | Hourly |

**Real-time Updates:**
- Levels stored in `key_levels` table
- Supabase Realtime pushes updates to all connected clients
- UI shows distance to each level (e.g., "PDH: $144.20 ▲+1.3%")
- Levels "near" current price (< 0.5%) are highlighted

---

### 3. Liquidity Zones & Options Flow for Stop Loss Guidance?

**YES - Full Options Flow Available via Massive.com:**

**Options Flow Data (from `/v3/snapshot/options`):**
- **Volume by Strike**: Identify where money is flowing
- **Open Interest**: Where positions are held
- **Volume Spikes**: 3x+ average volume = unusual activity
- **New Positions**: Volume > OI = new money entering
- **Put/Call Ratio**: Overall sentiment indicator
- **Greeks**: Delta, gamma, theta, vega per contract
- **Implied Volatility**: Market's expected move

**Flow Analysis Features:**
| Signal | Detection | Use Case |
|--------|-----------|----------|
| Volume Spike | Volume > 3x average | Smart money positioning |
| New Positions | Volume > OI | Fresh money entering |
| Large Trades | Individual tick > $50k | Institutional activity |
| P/C Ratio | < 0.7 bullish, > 1.3 bearish | Overall sentiment |
| IV Skew | Call IV vs Put IV | Directional bias |

**How This Helps Stop Loss/Targets:**
- **High OI strikes** = potential magnet/support/resistance
- **Volume clusters** = liquidity zones for targets
- **Large put OI below price** = potential support level
- **Large call OI above price** = potential resistance level

**Additional Liquidity Indicators:**
- **VWAP Bands**: ±1σ, ±2σ standard deviations
- **Volume Profile**: High volume nodes from aggregate bars
- **HOD/LOD**: Today's high/low as liquidity targets
- **Previous Day H/L**: Key liquidity zones

**Stop Loss Guidance (KCU Rule + Flow):**
- Primary: "Other side of patience candle"
- Enhanced: Check if stop is near high OI strike (may hold/fail)
- AI Coach explains placement with flow context

---

### 4. Multiple Time Frame Analysis?

**YES - Full MTF System:**

**Timeframes Analyzed:**
```
Weekly → Daily → 4H → 1H → 15m → 5m → 2m
```

**Per Timeframe Analysis:**
- Trend direction (bullish/bearish/neutral)
- Structure (higher-highs, lower-lows, range)
- EMA position (above/below 9, 21, 200)
- ORB status (above/below/inside)
- VWAP position
- Momentum strength

**MTF Alignment Score:**
- Calculates how many timeframes agree with primary trend
- Weighted by timeframe importance (weekly = 15%, daily = 20%, etc.)
- Used as factor in overall confluence score

**From KCU Framework:**
> "2-minute for first 30 minutes, 5-minute for first 60 minutes, 10-minute for rest of day"

---

### 5. 200 SMA Integration?

**YES - From KCU Curriculum:**

> "You need SMA, simple moving average, click this once... 200"

**Implementation:**
- Calculated from daily bars
- Stored in `key_levels` table
- Used in:
  - MTF trend confirmation
  - Trend score calculation (price above/below 200 SMA)
  - AI Coach context
  - Key levels panel display

---

### 6. AI for Market Context?

**YES - Context Injection:**

**Market Context Includes:**
- SPY/QQQ current trend
- VIX level and direction
- Market session (pre/regular/after)
- Sector performance
- Active setups on watchlist
- Upcoming earnings/events
- User's recent trades

**Injected into every AI response:**
```
CURRENT MARKET CONTEXT:
SPY: $452.30 (+0.45%) - Bullish, above VWAP
QQQ: $385.20 (+0.62%) - Bullish, above ORB
VIX: 14.2 (-2.1%) - Low volatility
Session: Regular hours (2:30 PM ET)

UPCOMING EVENTS:
- NVDA earnings tomorrow after close
```

---

### 7. Earnings/Economic Data Alerts?

**YES - Via Massive.com API:**

**Available:**
- Earnings calendar (date, time, expected EPS/revenue)
- Corporate events (dividends, splits, conferences)
- Post-earnings surprise data

**Alert Flow:**
1. System fetches earnings calendar daily
2. Stores in `economic_events` table
3. Users can subscribe to symbols
4. Alert sent X hours/days before event
5. Warning displayed in Companion Mode
6. AI Coach includes earnings context

**Missing (not in Massive.com):**
- Fed meeting details
- General economic calendar (CPI, NFP, etc.)
- Would need secondary data source

---

### 8. Super Admin Role Configuration?

**YES - Now Designed:**

**Role Hierarchy:**
| Role | Permissions |
|------|-------------|
| super_admin | Everything + strategy config |
| admin | Alerts, users, shared watchlist |
| coach | Educational content, trade review |
| member | Standard access |
| viewer | Read-only (trial) |

**Original Had:**
- Basic `is_admin` boolean (not granular)
- Settings page UI (but not wired to database)
- No role assignment UI

**Now Designed:**
- Full role/permission system in database
- Super Admin panel for:
  - LTP detection thresholds
  - Key levels to calculate
  - MTF timeframes to use
  - AI model/temperature settings
  - Alert templates
  - Role management

---

## Architecture Documentation Created

I've created three comprehensive documentation files:

### 1. DATABASE-SCHEMA.md
- Complete schema with all new tables
- Role & permission system
- Watchlists (shared/personal)
- Key levels & detected setups
- MTF analysis storage
- Economic events
- Strategy configurations
- Indexes and RLS policies

### 2. ARCHITECTURE.md
- High-level system diagram
- Service layer definitions
- API route specifications
- Real-time data flow
- LTP detection engine design
- MTF analysis algorithms
- Deployment architecture

### 3. UI-UX-SPECIFICATION.md
- Design system (colors, typography)
- Page layouts with ASCII wireframes
- Component specifications
- User flows
- Responsive behavior
- Accessibility requirements

---

## Updated Implementation Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1** | Port Companion to original, apply KCU branding | 2-3 days |
| **Phase 2** | Massive.com WebSocket, real-time levels | 3-4 days |
| **Phase 3** | MTF analysis engine, 200 SMA integration | 2-3 days |
| **Phase 4** | YouTube transcription, RAG knowledge base | 3-4 days |
| **Phase 5** | Super Admin panel, role system | 2-3 days |
| **Phase 6** | Earnings/events integration | 1-2 days |
| **Phase 7** | Testing, polish, Discord bot | 2-3 days |

**Total: 15-22 days**

---

## Files Created

```
kcu-coach-dashboard/docs/
├── DATABASE-SCHEMA.md      # Complete database design
├── ARCHITECTURE.md         # System architecture & APIs
├── UI-UX-SPECIFICATION.md  # UI/UX designs & flows
└── UPDATED-PROPOSAL-SUMMARY.md  # This document
```

---

## Ready to Proceed?

With your approval, I will begin implementation in this order:

1. **Set up project structure** in the original kcu-coach 2 repo
2. **Create database migrations** for new tables
3. **Implement LTP Engine** with Massive.com integration
4. **Build Companion Mode** UI with shared watchlists
5. **Add MTF analysis** and 200 SMA
6. **Build Super Admin** panel
7. **Integrate earnings** alerts
8. **YouTube transcription** and RAG system

All code will be documented for future maintenance by coding agents.
