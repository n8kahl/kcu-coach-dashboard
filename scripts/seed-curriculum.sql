-- ============================================
-- KCU Curriculum Seed Script
-- ============================================
-- This script populates the Supabase database with curriculum content
-- from the static curriculum.ts file.
--
-- Run this via Claude Code with Supabase MCP or directly in Supabase SQL Editor.
-- ============================================

-- First, ensure we have the course
INSERT INTO courses (id, slug, title, description, is_published, created_at, updated_at)
VALUES (
  'course_kcu_trading_mastery',
  'kcu-trading-mastery',
  'KCU Trading Mastery',
  'Complete trading education covering fundamentals, price action, indicators, the LTP Framework, strategies, entries/exits, psychology, and more.',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_published = true,
  updated_at = NOW();

-- Get the course ID for foreign key references
DO $$
DECLARE
  v_course_id UUID;
  v_module_id UUID;
BEGIN
  -- Get course ID
  SELECT id INTO v_course_id FROM courses WHERE slug = 'kcu-trading-mastery';

  -- ============================================
  -- Module 1: Trading Fundamentals
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'fundamentals',
    'Trading Fundamentals',
    'Account setup, broker configuration, and chart basics. Start here if you''re new to trading.',
    1,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'fundamentals';

  -- Lessons for Fundamentals
  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'margin-vs-cash-account', 'Margin Account vs Cash Account', 'Understanding the difference between margin and cash accounts, leverage, and which one you should choose.', 'cjv5384jjjkp5adbsol0', 480, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'interactive-brokers-setup', 'Setting Up Interactive Brokers', 'Step-by-step guide to setting up your Interactive Brokers paper trading account.', 'cjv5461bb72p7oi2cspg', 600, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'chart-setup-indicators', 'Chart Setup & Indicators', 'Learn how to set up your charts with the essential indicators for LTP trading.', 'cjv5465gsuq2i82srh9g', 540, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'tradingview-setup', 'TradingView Setup Guide', 'Complete guide to setting up TradingView for analysis and charting.', 'cjv5545gsuq2i82srhag', 720, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 2: Price Action Mastery
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'price-action',
    'Price Action Mastery',
    'Understanding candlesticks, market structure, and reading price movement.',
    2,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'price-action';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'what-is-price-action', 'What is Price Action?', 'Introduction to price action trading and why it matters.', 'ckbv2o9kbr2l62hvrkpg', 420, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'reading-candlesticks', 'How to Read Candlesticks', 'Understanding candlestick anatomy and what each part tells you.', 'ckbv2rhkbr2l62hvrkq0', 540, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'bar-by-bar-analysis', 'Bar by Bar Analysis', 'Analyzing price action one candle at a time for better entries.', 'ckhm4gcmp0i6449b67pg', 780, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'momentum-characteristics', 'Characteristics of Strong Momentum', 'Identifying strong momentum moves and how to trade them.', 'ckqvid2bskf3v52lbgag', 600, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 3: Technical Indicators
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'indicators',
    'Technical Indicators',
    'Master EMAs, VWAP, and other essential trading indicators.',
    3,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'indicators';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'trading-with-emas', 'How to Trade Using EMAs', 'Using exponential moving averages for better entries and trend identification.', 'ckbv3m7j31728sr70dug', 660, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'what-is-vwap', 'What is VWAP?', 'Understanding Volume Weighted Average Price and how institutions use it.', 'ckbv11nfm97hqvagqb3g', 540, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'advanced-vwap-strategies', 'Advanced VWAP Strategies', 'Pro-level VWAP trading strategies for consistent profits.', 'ckbv161kbr2l62hvrkp0', 720, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'cloud-strategy', 'The Cloud Strategy', 'Using Ripster clouds for after 1 PM trading setups.', 'ckbv359kbr2l62hvrkqg', 600, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 4: LTP Framework
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'ltp-framework',
    'LTP Framework',
    'Levels, Trends, and Patience - the core trading methodology that brings it all together.',
    4,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'ltp-framework';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'introduction-to-ltp', 'Introduction to LTP Framework', 'Overview of the Levels, Trends, Patience framework for consistent trading.', 'ckqvl1a5iabuq1m1fi40', 600, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'trading-hourly-levels', 'How I Trade Using Hourly Levels', 'The power of 60-minute chart levels for finding high-probability setups.', 'ckqvmnqjknrlbftps840', 480, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'patience-candles', 'Patience Candles Explained', 'What patience candles are and how they confirm your entries.', 'ckqvq7ijknrlbftps8a0', 540, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'premarket-checklist', 'Pre-Market Hourly Level Checklist', 'The exact pre-market routine for drawing your hourly levels.', 'ckqvuii5iabuq1m1fic0', 660, 4, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'hourly-level-examples', 'Hourly Level Trading Examples', 'Real chart examples of trading hourly levels for profits.', 'ckqvuii5iabuq1m1ficg', 900, 5, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 5: Trading Strategies
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'strategies',
    'Trading Strategies',
    'Specific trading strategies including ORB, gap trading, and more.',
    5,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'strategies';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'orb-strategy', 'Opening Range Breakout (ORB)', 'Trading the opening range breakout for momentum moves.', 'ckr05mibskf3v52lbgug', 720, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'orb-bounce-strategy', 'ORB Bounce Strategy Checklist', 'How to trade bounces off the opening range levels.', 'ckr05mibskf3v52lbgv0', 600, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'gap-trading-safely', 'Trading Gap Ups and Downs Safely', 'How to trade morning gaps without getting burned.', 'ckr05mijknrlbftps8i0', 660, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'dont-be-a-sucker', 'How to Catch Suckers (Not Be One)', 'Identify and profit from common retail trader mistakes.', 'ckr05mkhvd97s52368h0', 540, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 6: Entries & Exits
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'entries-exits',
    'Entries & Exits',
    'Master the art of entering at the right time and taking profits properly.',
    6,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'entries-exits';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'entry-rules', 'Entry Rules & Confirmation', 'When to enter a trade and what confirmation to look for.', 'ckr05mkhvd97s52368hg', 600, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'stop-loss-placement', 'Where to Place Stop Losses', 'Strategic stop loss placement for optimal risk management.', 'cm59k5vpf0ic72qpttu0', 540, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'taking-profits', 'Where to Take Profits', 'Using hourly levels and structure for profit targets.', 'cm5ckv5j4pu2qr6dhi60', 660, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'scaling-in-out', 'Scaling Into and Out of Trades', 'How to add to winners and take profits incrementally.', 'cm5d0dvj4pu2qr6dhi8g', 720, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 7: Trading Psychology
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'psychology',
    'Trading Psychology',
    'Master your mind - the most important edge in trading.',
    7,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'psychology';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'psychology-module-intro', 'Introduction to Trading Psychology', 'Why psychology is the #1 factor in trading success.', 'cm5d15nj4pu2qr6dhiac', 540, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'trading-plan', 'Creating Your Trading Plan', 'The most important document for any trader - your trading plan.', 'cm5d1ivj4pu2qr6dhib0', 720, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'fear-of-losing', 'Overcoming Fear of Losing', 'How to handle the fear that causes hesitation and bad decisions.', 'cm5d1mvj4pu2qr6dhibg', 660, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'controlling-fomo', 'How to Control FOMO', 'Stop chasing trades and learn patience.', 'cm5d1qnj4pu2qr6dhic0', 600, 4, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'getting-back-on-track', 'What to Do When You Go Off Track', 'How to recover from drawdowns and losing streaks.', 'cm5d1uvj4pu2qr6dhicg', 720, 5, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 8: Trading Rules & Principles
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'trading-rules',
    'Trading Rules & Principles',
    'The rules and principles that separate consistent traders from gamblers.',
    8,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'trading-rules';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'rule-1-sunken-cost', 'Rule 1: Never Hold Your Bags', 'Understanding sunken cost fallacy and cutting losers quickly.', 'cm5d20nj4pu2qr6dhid0', 480, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'rule-2-take-profits', 'Rule 2: Keep Taking Profits', 'Why consistent profit-taking beats hoping for home runs.', 'cm5d26nj4pu2qr6dhidg', 540, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'rule-3-no-sides', 'Rule 3: Don''t Pick a Side', 'Why directional bias hurts your trading.', 'cm5d2anj4pu2qr6dhie0', 600, 3, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'rule-4-patience', 'Rule 4: Patience is Everything', 'The hardest skill in trading - waiting for your setup.', 'cm5d2gnj4pu2qr6dhieg', 540, 4, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  -- ============================================
  -- Module 9: Watchlist & Pre-Market
  -- ============================================
  INSERT INTO course_modules (id, course_id, slug, title, description, sort_order, is_published, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    v_course_id,
    'watchlist-setup',
    'Watchlist & Pre-Market',
    'Building your watchlist and preparing for each trading day.',
    9,
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (course_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  SELECT id INTO v_module_id FROM course_modules WHERE course_id = v_course_id AND slug = 'watchlist-setup';

  INSERT INTO course_lessons (id, module_id, slug, title, description, video_playback_id, duration_seconds, sort_order, is_published, is_required, created_at, updated_at)
  VALUES
    (gen_random_uuid(), v_module_id, 'my-trading-watchlist', 'My Personal Trading Watchlist', 'The specific stocks I trade every day and why.', 'cm5d2onj4pu2qr6dhif0', 600, 1, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'premarket-routine', 'Complete Pre-Market Routine', 'Everything I do before market open to prepare for the day.', 'cm5d2tnj4pu2qr6dhifg', 720, 2, true, true, NOW(), NOW()),
    (gen_random_uuid(), v_module_id, 'daily-trading-checklist', 'Daily Trading Checklist', 'The checklist I use every single trading day.', 'cm5d30nj4pu2qr6dhig0', 480, 3, true, true, NOW(), NOW())
  ON CONFLICT (module_id, slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    video_playback_id = EXCLUDED.video_playback_id,
    duration_seconds = EXCLUDED.duration_seconds,
    sort_order = EXCLUDED.sort_order,
    is_published = true,
    updated_at = NOW();

  RAISE NOTICE 'Curriculum seeded successfully!';
  RAISE NOTICE 'Course: kcu-trading-mastery';
  RAISE NOTICE 'Modules: 9';
  RAISE NOTICE 'Lessons: 37';
END $$;

-- Verify the seed
SELECT
  'Course' as type,
  slug,
  title
FROM courses
WHERE slug = 'kcu-trading-mastery'

UNION ALL

SELECT
  'Module' as type,
  cm.slug,
  cm.title
FROM course_modules cm
JOIN courses c ON cm.course_id = c.id
WHERE c.slug = 'kcu-trading-mastery'
ORDER BY type, slug;
