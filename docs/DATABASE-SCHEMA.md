# KCU Coach - Database Schema Documentation

## Overview

This document defines the complete database schema for the KCU Coach platform. The database uses **Supabase (PostgreSQL)** with the **pgvector** extension for AI embeddings.

---

## Role & Permission System

### user_roles (NEW)
Defines available roles in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Role name (unique) |
| description | text | Role description |
| permissions | jsonb | Permission flags |
| created_at | timestamptz | Creation timestamp |

**Default Roles:**
- `super_admin` - Full system access, strategy configuration
- `admin` - Alert posting, user management, content moderation
- `coach` - Can post educational content, review trades
- `member` - Standard user access
- `viewer` - Read-only access (trial users)

### user_role_assignments (NEW)
Maps users to roles.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to user_profiles |
| role_id | uuid | FK to user_roles |
| assigned_by | uuid | FK to user_profiles (who assigned) |
| assigned_at | timestamptz | Assignment timestamp |
| expires_at | timestamptz | Optional expiration |

---

## User Management

### user_profiles (ENHANCED)
Core user table.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| discord_id | text | Discord user ID (unique) |
| discord_username | text | Discord username |
| email | text | Email address (optional) |
| avatar_url | text | Profile picture URL |
| current_module | text | Current learning module |
| experience_level | enum | beginner/intermediate/advanced |
| preferred_symbols | jsonb | User's default watchlist |
| notification_preferences | jsonb | Notification settings |
| total_questions | int | Total AI questions asked |
| total_quizzes | int | Total quizzes completed |
| streak_days | int | Current streak |
| last_active | timestamptz | Last activity |
| created_at | timestamptz | Account creation |
| updated_at | timestamptz | Last update |

---

## Watchlist & Setup Detection

### watchlists (NEW)
Shared and personal watchlists.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Watchlist name |
| description | text | Description |
| owner_id | uuid | FK to user_profiles (null = admin) |
| is_shared | boolean | Visible to all users |
| is_admin_watchlist | boolean | Created by admin |
| symbols | text[] | Array of ticker symbols |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update |

### key_levels (NEW)
Real-time calculated key levels for symbols.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| symbol | text | Ticker symbol |
| level_type | text | Type of level (see below) |
| timeframe | text | Timeframe source |
| price | decimal | Level price |
| strength | int | Level strength (0-100) |
| calculated_at | timestamptz | When calculated |
| expires_at | timestamptz | When to recalculate |
| metadata | jsonb | Additional data |

**Level Types:**
- `pdh` - Previous Day High
- `pdl` - Previous Day Low
- `pdc` - Previous Day Close
- `orb_high` - Opening Range Breakout High
- `orb_low` - Opening Range Breakout Low
- `vwap` - Volume Weighted Average Price
- `ema_9` - 9 EMA
- `ema_21` - 21 EMA
- `sma_200` - 200 SMA
- `weekly_high` - Weekly High (HTF)
- `weekly_low` - Weekly Low (HTF)
- `monthly_high` - Monthly High (HTF)
- `monthly_low` - Monthly Low (HTF)
- `premarket_high` - Pre-market High
- `premarket_low` - Pre-market Low
- `hourly_pivot` - Hourly pivot level
- `liquidity_zone` - Detected liquidity zone

### detected_setups (NEW)
LTP setups detected by the engine.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| symbol | text | Ticker symbol |
| direction | text | bullish/bearish |
| setup_stage | text | forming/ready/triggered/expired |
| confluence_score | int | Overall score (0-100) |
| level_score | int | L score (0-100) |
| trend_score | int | T score (0-100) |
| patience_score | int | P score (0-100) |
| mtf_score | int | Multi-timeframe alignment (0-100) |
| primary_level_type | text | Main level type |
| primary_level_price | decimal | Level price |
| patience_candles | int | Number of patience candles |
| suggested_entry | decimal | Recommended entry |
| suggested_stop | decimal | Recommended stop loss |
| target_1 | decimal | First target |
| target_2 | decimal | Second target |
| target_3 | decimal | Third target (HTF) |
| risk_reward | decimal | R:R ratio |
| coach_note | text | AI-generated coaching note |
| detected_at | timestamptz | Detection time |
| triggered_at | timestamptz | When entry triggered |
| expired_at | timestamptz | When setup expired |
| detected_by | text | 'system' or admin user_id |

### setup_subscriptions (NEW)
Users following specific setups.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to user_profiles |
| setup_id | uuid | FK to detected_setups |
| notify_on_ready | boolean | Alert when ready |
| notify_on_trigger | boolean | Alert when triggered |
| subscribed_at | timestamptz | Subscription time |

---

## Multi-Timeframe Analysis

### mtf_analysis (NEW)
Stores MTF analysis for symbols.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| symbol | text | Ticker symbol |
| timeframe | text | 2m/5m/10m/15m/1h/4h/daily/weekly |
| trend | text | bullish/bearish/neutral |
| structure | text | uptrend/downtrend/range |
| ema_position | text | above_all/below_all/mixed |
| orb_status | text | above/below/inside |
| vwap_position | text | above/below |
| key_level_proximity | decimal | Distance to nearest level (%) |
| momentum | text | strong/moderate/weak |
| calculated_at | timestamptz | Analysis timestamp |
| metadata | jsonb | Additional indicators |

---

## Market Context & Events

### market_context (NEW)
Current market conditions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| market_status | text | pre/open/after/closed |
| spy_trend | text | bullish/bearish/neutral |
| qqq_trend | text | bullish/bearish/neutral |
| vix_level | decimal | Current VIX |
| vix_trend | text | rising/falling/stable |
| market_breadth | text | strong/weak/mixed |
| sector_leaders | jsonb | Top performing sectors |
| calculated_at | timestamptz | Timestamp |

### economic_events (NEW)
Earnings and economic calendar.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| event_type | text | earnings/fed/economic/dividend |
| symbol | text | Ticker (null for macro events) |
| event_name | text | Event name |
| event_date | date | Event date |
| event_time | time | Event time |
| importance | text | high/medium/low |
| expected_value | text | Expected (EPS, etc.) |
| actual_value | text | Actual (after release) |
| surprise | text | Beat/miss/inline |
| notes | text | Additional notes |
| fetched_at | timestamptz | When fetched from API |

### event_alerts (NEW)
User subscriptions to events.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to user_profiles |
| event_id | uuid | FK to economic_events |
| alert_before | interval | Alert X time before |
| notified | boolean | Has been notified |

---

## Strategy Configuration (Super Admin)

### strategy_configs (NEW)
Configurable strategy parameters.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Config name (unique) |
| category | text | Category (ltp/mtf/alerts/ai) |
| config | jsonb | Configuration object |
| is_active | boolean | Currently active |
| created_by | uuid | FK to user_profiles |
| created_at | timestamptz | Creation time |
| updated_at | timestamptz | Last update |

**Example Configs:**
```json
{
  "name": "ltp_detection_thresholds",
  "category": "ltp",
  "config": {
    "confluence_threshold": 70,
    "level_proximity_percent": 0.3,
    "patience_candle_max_size": 0.5,
    "trend_ema_alignment_required": true,
    "orb_break_required": true
  }
}
```

### alert_templates (NEW)
Configurable alert message templates.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Template name |
| alert_type | text | setup_ready/earnings/admin/etc |
| title_template | text | Title with {{variables}} |
| body_template | text | Body with {{variables}} |
| channels | text[] | discord/web/email |
| is_active | boolean | Template active |
| created_by | uuid | FK to user_profiles |

---

## Knowledge Base & AI

### knowledge_chunks (EXISTING - ENHANCED)
RAG knowledge base.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| content | text | Chunk content |
| embedding | vector(1536) | OpenAI embedding |
| source_type | text | transcript/video/document |
| source_id | text | YouTube video ID, etc |
| source_url | text | Link to source |
| topic | text | Topic category |
| subtopic | text | Subtopic |
| difficulty | text | beginner/intermediate/advanced |
| ltp_relevance | int | LTP relevance score (0-100) |
| timestamp_start | int | Video timestamp start (seconds) |
| timestamp_end | int | Video timestamp end (seconds) |
| created_at | timestamptz | Ingestion time |

### youtube_videos (NEW)
Index of KCU YouTube videos.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| video_id | text | YouTube video ID |
| title | text | Video title |
| description | text | Video description |
| thumbnail_url | text | Thumbnail URL |
| duration_seconds | int | Video duration |
| published_at | timestamptz | Publish date |
| topics | text[] | Topic tags |
| transcript_status | text | pending/processing/complete/failed |
| chunk_count | int | Number of chunks created |
| created_at | timestamptz | Added to system |

---

## Indexes

```sql
-- Performance indexes
CREATE INDEX idx_key_levels_symbol ON key_levels(symbol);
CREATE INDEX idx_key_levels_type ON key_levels(level_type);
CREATE INDEX idx_detected_setups_symbol ON detected_setups(symbol);
CREATE INDEX idx_detected_setups_stage ON detected_setups(setup_stage);
CREATE INDEX idx_detected_setups_score ON detected_setups(confluence_score DESC);
CREATE INDEX idx_mtf_analysis_symbol ON mtf_analysis(symbol);
CREATE INDEX idx_economic_events_date ON economic_events(event_date);
CREATE INDEX idx_economic_events_symbol ON economic_events(symbol);
CREATE INDEX idx_knowledge_chunks_topic ON knowledge_chunks(topic);

-- Vector similarity search
CREATE INDEX idx_knowledge_embedding ON knowledge_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## Row Level Security Policies

```sql
-- Users can only see their own data
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Shared watchlists visible to all, personal only to owner
CREATE POLICY "Shared watchlists visible to all" ON watchlists
  FOR SELECT USING (is_shared = true OR owner_id = auth.uid());

-- Super admins can do everything
CREATE POLICY "Super admins full access" ON strategy_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      JOIN user_roles ur ON ura.role_id = ur.id
      WHERE ura.user_id = auth.uid() AND ur.name = 'super_admin'
    )
  );

-- Detected setups visible to all authenticated users
CREATE POLICY "Setups visible to members" ON detected_setups
  FOR SELECT USING (auth.role() = 'authenticated');
```

---

## Realtime Subscriptions

Enable realtime for live updates:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE detected_setups;
ALTER PUBLICATION supabase_realtime ADD TABLE key_levels;
ALTER PUBLICATION supabase_realtime ADD TABLE market_context;
ALTER PUBLICATION supabase_realtime ADD TABLE economic_events;
```
