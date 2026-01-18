-- ============================================
-- KCU Coach - Seed Daily Briefing
-- ============================================
-- Insert a sample morning briefing if none exists

INSERT INTO briefings (
  briefing_type,
  generated_at,
  content,
  market_context,
  key_levels,
  setups,
  economic_events,
  lesson_of_day
)
SELECT
  'morning',
  NOW(),
  '{
    "headline": "Markets Ready for New Week",
    "summary": "SPY and QQQ showing neutral bias. Focus on key levels for entries.",
    "marketBias": "neutral",
    "actionItems": [
      "Watch SPY and QQQ for trend confirmation",
      "Focus on A-grade setups only",
      "Review your trading plan before the open",
      "Check economic calendar for high-impact events"
    ],
    "warnings": []
  }'::jsonb,
  '{
    "spyPrice": 590.00,
    "spyChange": 0.15,
    "spyTrend": "range",
    "qqqPrice": 520.00,
    "qqqChange": 0.22,
    "qqqTrend": "range",
    "marketPhase": "pre_market",
    "overallSentiment": "neutral"
  }'::jsonb,
  '[
    {
      "symbol": "SPY",
      "currentPrice": 590.00,
      "levels": [
        {"price": 585.00, "type": "support", "strength": 80},
        {"price": 595.00, "type": "resistance", "strength": 75}
      ],
      "ema9": 589.50,
      "ema21": 588.00,
      "trend": "range"
    },
    {
      "symbol": "QQQ",
      "currentPrice": 520.00,
      "levels": [
        {"price": 515.00, "type": "support", "strength": 82},
        {"price": 525.00, "type": "resistance", "strength": 78}
      ],
      "ema9": 519.25,
      "ema21": 518.00,
      "trend": "range"
    }
  ]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '{
    "title": "Wait for Confirmation",
    "content": "Never enter a trade without a patience candle confirming your setup. The market rewards patience, not FOMO.",
    "module": "ltp-framework"
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM briefings WHERE briefing_type = 'morning' AND generated_at >= CURRENT_DATE
);
