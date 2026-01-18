/**
 * KCU Curriculum Data
 *
 * Structured learning modules based on the KCU video content.
 * This file contains the complete curriculum structure for the learning management system.
 */

import type { CurriculumModule } from '@/types';

export const CURRICULUM_MODULES: CurriculumModule[] = [
  {
    id: 'mod_fundamentals',
    slug: 'fundamentals',
    title: 'Trading Fundamentals',
    description: 'Account setup, broker configuration, and chart basics. Start here if you\'re new to trading.',
    icon: 'BookOpen',
    color: '#3B82F6',
    order: 1,
    lessons: [
      {
        id: 'lesson_cjv5384jjjkp5adbsol0',
        slug: 'margin-vs-cash-account',
        title: 'Margin Account vs Cash Account',
        description: 'Understanding the difference between margin and cash accounts, leverage, and which one you should choose.',
        video_id: 'cjv5384jjjkp5adbsol0',
        duration: 480,
        transcript: '',
        key_takeaways: [
          'Margin accounts provide leverage - buy more shares than cash available',
          'Cash accounts limit you to available cash only',
          'Margin accounts allow short selling',
          'Understand PDT rules before choosing your account type'
        ]
      },
      {
        id: 'lesson_cjv5461bb72p7oi2cspg',
        slug: 'interactive-brokers-setup',
        title: 'Setting Up Interactive Brokers',
        description: 'Step-by-step guide to setting up your Interactive Brokers paper trading account.',
        video_id: 'cjv5461bb72p7oi2cspg',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Start with a paper trading account to practice',
          'Configure your workspace for efficient trading',
          'Set up market data subscriptions',
          'Customize hotkeys for quick order entry'
        ]
      },
      {
        id: 'lesson_cjv5465gsuq2i82srh9g',
        slug: 'chart-setup-indicators',
        title: 'Chart Setup & Indicators',
        description: 'Learn how to set up your charts with the essential indicators for LTP trading.',
        video_id: 'cjv5465gsuq2i82srh9g',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Add EMA 9 and EMA 21 to your charts',
          'Set up VWAP indicator',
          'Configure Ripster clouds',
          'Clean chart layout is essential'
        ]
      },
      {
        id: 'lesson_cjv5545gsuq2i82srhag',
        slug: 'tradingview-setup',
        title: 'TradingView Setup Guide',
        description: 'Complete guide to setting up TradingView for analysis and charting.',
        video_id: 'cjv5545gsuq2i82srhag',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'Create a TradingView account',
          'Set up multiple chart layouts',
          'Configure indicator settings',
          'Save your workspace templates'
        ]
      }
    ]
  },
  {
    id: 'mod_price_action',
    slug: 'price-action',
    title: 'Price Action Mastery',
    description: 'Understanding candlesticks, market structure, and reading price movement.',
    icon: 'TrendingUp',
    color: '#10B981',
    order: 2,
    lessons: [
      {
        id: 'lesson_ckbv2o9kbr2l62hvrkpg',
        slug: 'what-is-price-action',
        title: 'What is Price Action?',
        description: 'Introduction to price action trading and why it matters.',
        video_id: 'ckbv2o9kbr2l62hvrkpg',
        duration: 420,
        transcript: '',
        key_takeaways: [
          'Price action is the movement of price over time',
          'Learn to read the story the chart tells',
          'Foundation for all trading decisions',
          'Less indicators, more price focus'
        ]
      },
      {
        id: 'lesson_ckbv2rhkbr2l62hvrkq0',
        slug: 'reading-candlesticks',
        title: 'How to Read Candlesticks',
        description: 'Understanding candlestick anatomy and what each part tells you.',
        video_id: 'ckbv2rhkbr2l62hvrkq0',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Open, high, low, close (OHLC)',
          'Body size indicates momentum',
          'Wicks show rejection',
          'Color indicates direction'
        ]
      },
      {
        id: 'lesson_ckhm4gcmp0i6449b67pg',
        slug: 'bar-by-bar-analysis',
        title: 'Bar by Bar Analysis',
        description: 'Analyzing price action one candle at a time for better entries.',
        video_id: 'ckhm4gcmp0i6449b67pg',
        duration: 780,
        transcript: '',
        key_takeaways: [
          'Read each candle in context',
          'Understand buyer vs seller control',
          'Identify momentum shifts',
          'Practice with historical charts'
        ]
      },
      {
        id: 'lesson_momentum_characteristics',
        slug: 'momentum-characteristics',
        title: 'Characteristics of Strong Momentum',
        description: 'Identifying strong momentum moves and how to trade them.',
        video_id: 'ckqvid2bskf3v52lbgag',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Big candles = strong momentum',
          'Small candles = weak momentum',
          'Watch for momentum shifts',
          'Momentum feeds more momentum'
        ]
      }
    ]
  },
  {
    id: 'mod_indicators',
    slug: 'indicators',
    title: 'Technical Indicators',
    description: 'Master EMAs, VWAP, and other essential trading indicators.',
    icon: 'Activity',
    color: '#8B5CF6',
    order: 3,
    lessons: [
      {
        id: 'lesson_ema_trading',
        slug: 'trading-with-emas',
        title: 'How to Trade Using EMAs',
        description: 'Using exponential moving averages for better entries and trend identification.',
        video_id: 'ckbv3m7j31728sr70dug',
        duration: 660,
        transcript: '',
        key_takeaways: [
          'EMA 9 for short-term trend',
          'EMA 21 for medium-term trend',
          'Price above EMAs = bullish',
          'EMA crossovers signal momentum shifts'
        ]
      },
      {
        id: 'lesson_vwap_basics',
        slug: 'what-is-vwap',
        title: 'What is VWAP?',
        description: 'Understanding Volume Weighted Average Price and how institutions use it.',
        video_id: 'ckbv11nfm97hqvagqb3g',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'VWAP = Volume Weighted Average Price',
          'Institutional benchmark level',
          'Above VWAP = bullish bias',
          'Below VWAP = bearish bias'
        ]
      },
      {
        id: 'lesson_vwap_strategies',
        slug: 'advanced-vwap-strategies',
        title: 'Advanced VWAP Strategies',
        description: 'Pro-level VWAP trading strategies for consistent profits.',
        video_id: 'ckbv161kbr2l62hvrkp0',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'VWAP bounce plays',
          'VWAP as support/resistance',
          'Combining VWAP with EMAs',
          'VWAP deviation bands'
        ]
      },
      {
        id: 'lesson_cloud_strategy',
        slug: 'cloud-strategy',
        title: 'The Cloud Strategy',
        description: 'Using Ripster clouds for after 1 PM trading setups.',
        video_id: 'ckbv359kbr2l62hvrkqg',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Works best after 1 PM',
          'Algorithms start trading afternoon',
          'Cloud color changes signal entries',
          'Combine with other confirmations'
        ]
      }
    ]
  },
  {
    id: 'mod_ltp_framework',
    slug: 'ltp-framework',
    title: 'LTP Framework',
    description: 'Levels, Trends, and Patience - the core trading methodology that brings it all together.',
    icon: 'Target',
    color: '#F59E0B',
    order: 4,
    lessons: [
      {
        id: 'lesson_ltp_intro',
        slug: 'introduction-to-ltp',
        title: 'Introduction to LTP Framework',
        description: 'Overview of the Levels, Trends, Patience framework for consistent trading.',
        video_id: 'ckqvl1a5iabuq1m1fi40',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'L = Levels (key price zones)',
          'T = Trend (direction of momentum)',
          'P = Patience (waiting for confirmation)',
          'All three must align for entry'
        ]
      },
      {
        id: 'lesson_hourly_levels',
        slug: 'trading-hourly-levels',
        title: 'How I Trade Using Hourly Levels',
        description: 'The power of 60-minute chart levels for finding high-probability setups.',
        video_id: 'ckqvmnqjknrlbftps840',
        duration: 480,
        transcript: '',
        key_takeaways: [
          '60-minute chart is the key timeframe',
          'Draw fresh levels every morning',
          'Levels become support and resistance',
          'Trade reactions at these levels'
        ]
      },
      {
        id: 'lesson_patience_candles',
        slug: 'patience-candles',
        title: 'Patience Candles Explained',
        description: 'What patience candles are and how they confirm your entries.',
        video_id: 'ckqvq7ijknrlbftps8a0',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Small consolidation candles at levels',
          'Show buyer/seller equilibrium',
          'Wait for break of patience candle',
          'Entry on break, stop other side'
        ]
      },
      {
        id: 'lesson_premarket_checklist',
        slug: 'premarket-checklist',
        title: 'Pre-Market Hourly Level Checklist',
        description: 'The exact pre-market routine for drawing your hourly levels.',
        video_id: 'ckqvuii5iabuq1m1fic0',
        duration: 660,
        transcript: '',
        key_takeaways: [
          'Draw levels fresh every day',
          'Use 60-minute chart only',
          'Mark previous day high/low',
          'Identify key hourly pivots'
        ]
      },
      {
        id: 'lesson_hourly_examples',
        slug: 'hourly-level-examples',
        title: 'Hourly Level Trading Examples',
        description: 'Real chart examples of trading hourly levels for profits.',
        video_id: 'ckqvuii5iabuq1m1ficg',
        duration: 900,
        transcript: '',
        key_takeaways: [
          'See real trade setups',
          'Entry, stop, and target placement',
          'How levels play out intraday',
          'Common patterns at levels'
        ]
      }
    ]
  },
  {
    id: 'mod_strategies',
    slug: 'strategies',
    title: 'Trading Strategies',
    description: 'Specific trading strategies including ORB, gap trading, and more.',
    icon: 'Crosshair',
    color: '#EF4444',
    order: 5,
    lessons: [
      {
        id: 'lesson_orb_strategy',
        slug: 'orb-strategy',
        title: 'Opening Range Breakout (ORB)',
        description: 'Trading the opening range breakout for momentum moves.',
        video_id: 'ckr05mibskf3v52lbgug',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'First 15-30 minutes define the range',
          'Trade breakouts from the range',
          'Direction often sets the day',
          'Use volume for confirmation'
        ]
      },
      {
        id: 'lesson_orb_bounce',
        slug: 'orb-bounce-strategy',
        title: 'ORB Bounce Strategy Checklist',
        description: 'How to trade bounces off the opening range levels.',
        video_id: 'ckr05mibskf3v52lbgv0',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Price breaks ORB then returns',
          'ORB levels become support/resistance',
          'Wait for confirmation candle',
          'Tight stops for good R:R'
        ]
      },
      {
        id: 'lesson_gap_trading',
        slug: 'gap-trading-safely',
        title: 'Trading Gap Ups and Downs Safely',
        description: 'How to trade morning gaps without getting burned.',
        video_id: 'ckr05mijknrlbftps8i0',
        duration: 660,
        transcript: '',
        key_takeaways: [
          'Gaps often fill - trade accordingly',
          'Big gaps need patience',
          'Look for fade opportunities',
          'Never chase extended gaps'
        ]
      },
      {
        id: 'lesson_sucker_strategy',
        slug: 'dont-be-a-sucker',
        title: 'How to Catch Suckers (Not Be One)',
        description: 'Identify and profit from common retail trader mistakes.',
        video_id: 'ckr05mkhvd97s52368h0',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Suckers chase extended moves',
          'Trade against retail emotion',
          'Wait for exhaustion signals',
          'Patience beats FOMO'
        ]
      }
    ]
  },
  {
    id: 'mod_entries_exits',
    slug: 'entries-exits',
    title: 'Entries & Exits',
    description: 'Master the art of entering at the right time and taking profits properly.',
    icon: 'ArrowRightLeft',
    color: '#06B6D4',
    order: 6,
    lessons: [
      {
        id: 'lesson_entry_rules',
        slug: 'entry-rules',
        title: 'Entry Rules & Confirmation',
        description: 'When to enter a trade and what confirmation to look for.',
        video_id: 'ckr05mkhvd97s52368hg',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Wait for LTP alignment',
          'Patience candle break = entry',
          'Don\'t anticipate, react',
          'If unsure, stay out'
        ]
      },
      {
        id: 'lesson_stop_losses',
        slug: 'stop-loss-placement',
        title: 'Where to Place Stop Losses',
        description: 'Strategic stop loss placement for optimal risk management.',
        video_id: 'cm59k5vpf0ic72qpttu0',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Stop on other side of patience candle',
          'Give trade room to breathe',
          'Never move stop further away',
          'Accept the loss if hit'
        ]
      },
      {
        id: 'lesson_profit_targets',
        slug: 'taking-profits',
        title: 'Where to Take Profits',
        description: 'Using hourly levels and structure for profit targets.',
        video_id: 'cm5ckv5j4pu2qr6dhi60',
        duration: 660,
        transcript: '',
        key_takeaways: [
          'Next hourly level = first target',
          'Take partials at each level',
          'Let runners ride with trail stop',
          'Don\'t be greedy - take profits'
        ]
      },
      {
        id: 'lesson_scaling',
        slug: 'scaling-in-out',
        title: 'Scaling Into and Out of Trades',
        description: 'How to add to winners and take profits incrementally.',
        video_id: 'cm5d0dvj4pu2qr6dhi8g',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'Start with smaller position',
          'Add on confirmation',
          'Take 50% at first target',
          'Trail stop on remainder'
        ]
      }
    ]
  },
  {
    id: 'mod_psychology',
    slug: 'psychology',
    title: 'Trading Psychology',
    description: 'Master your mind - the most important edge in trading.',
    icon: 'Brain',
    color: '#EC4899',
    order: 7,
    lessons: [
      {
        id: 'lesson_psychology_intro',
        slug: 'psychology-module-intro',
        title: 'Introduction to Trading Psychology',
        description: 'Why psychology is the #1 factor in trading success.',
        video_id: 'cm5d15nj4pu2qr6dhiac',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Psychology > Strategy',
          'Your mindset determines success',
          'Common mistakes to avoid',
          'Building mental discipline'
        ]
      },
      {
        id: 'lesson_trading_plan',
        slug: 'trading-plan',
        title: 'Creating Your Trading Plan',
        description: 'The most important document for any trader - your trading plan.',
        video_id: 'cm5d1ivj4pu2qr6dhib0',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'Write your rules down',
          'Define your strategy clearly',
          'Set daily/weekly goals',
          'Review and adjust regularly'
        ]
      },
      {
        id: 'lesson_fear_of_losing',
        slug: 'fear-of-losing',
        title: 'Overcoming Fear of Losing',
        description: 'How to handle the fear that causes hesitation and bad decisions.',
        video_id: 'cm5d1mvj4pu2qr6dhibg',
        duration: 660,
        transcript: '',
        key_takeaways: [
          'Losses are part of trading',
          'Risk only what you can lose',
          'Focus on process, not outcome',
          'Small losses, big wins'
        ]
      },
      {
        id: 'lesson_fomo',
        slug: 'controlling-fomo',
        title: 'How to Control FOMO',
        description: 'Stop chasing trades and learn patience.',
        video_id: 'cm5d1qnj4pu2qr6dhic0',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'FOMO = Fear Of Missing Out',
          'There\'s always another trade',
          'Chasing leads to losses',
          'Wait for YOUR setup'
        ]
      },
      {
        id: 'lesson_off_track',
        slug: 'getting-back-on-track',
        title: 'What to Do When You Go Off Track',
        description: 'How to recover from drawdowns and losing streaks.',
        video_id: 'cm5d1uvj4pu2qr6dhicg',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'Step back and breathe',
          'Review your trading plan',
          'Reduce size temporarily',
          'Focus on process, not P&L'
        ]
      }
    ]
  },
  {
    id: 'mod_trading_rules',
    slug: 'trading-rules',
    title: 'Trading Rules & Principles',
    description: 'The rules and principles that separate consistent traders from gamblers.',
    icon: 'ClipboardList',
    color: '#F97316',
    order: 8,
    lessons: [
      {
        id: 'lesson_rule_1',
        slug: 'rule-1-sunken-cost',
        title: 'Rule 1: Never Hold Your Bags',
        description: 'Understanding sunken cost fallacy and cutting losers quickly.',
        video_id: 'cm5d20nj4pu2qr6dhid0',
        duration: 480,
        transcript: '',
        key_takeaways: [
          'Sunken cost fallacy kills traders',
          'Cut losses quickly',
          'Don\'t hope for recovery',
          'Capital preservation first'
        ]
      },
      {
        id: 'lesson_rule_2',
        slug: 'rule-2-take-profits',
        title: 'Rule 2: Keep Taking Profits',
        description: 'Why consistent profit-taking beats hoping for home runs.',
        video_id: 'cm5d26nj4pu2qr6dhidg',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Leverage instead of multiply',
          'Small consistent gains compound',
          'Don\'t wait for 100% returns',
          'Lock in profits regularly'
        ]
      },
      {
        id: 'lesson_rule_3',
        slug: 'rule-3-no-sides',
        title: 'Rule 3: Don\'t Pick a Side',
        description: 'Why directional bias hurts your trading.',
        video_id: 'cm5d2anj4pu2qr6dhie0',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Be neutral every day',
          'Follow price, not bias',
          'Bulls and bears both lose',
          'React to what you see'
        ]
      },
      {
        id: 'lesson_rule_4',
        slug: 'rule-4-patience',
        title: 'Rule 4: Patience is Everything',
        description: 'The hardest skill in trading - waiting for your setup.',
        video_id: 'cm5d2gnj4pu2qr6dhieg',
        duration: 540,
        transcript: '',
        key_takeaways: [
          'Wait for A+ setups only',
          'Quality over quantity',
          'Sitting on hands is a skill',
          'Patience = Profit'
        ]
      }
    ]
  },
  {
    id: 'mod_watchlist',
    slug: 'watchlist-setup',
    title: 'Watchlist & Pre-Market',
    description: 'Building your watchlist and preparing for each trading day.',
    icon: 'ListChecks',
    color: '#84CC16',
    order: 9,
    lessons: [
      {
        id: 'lesson_personal_watchlist',
        slug: 'my-trading-watchlist',
        title: 'My Personal Trading Watchlist',
        description: 'The specific stocks I trade every day and why.',
        video_id: 'cm5d2onj4pu2qr6dhif0',
        duration: 600,
        transcript: '',
        key_takeaways: [
          'Stick to same names daily',
          'SPY, QQQ, NVDA, TSLA, AAPL, AMZN, MSFT, META, AMD',
          'Know your stocks like friends',
          'Familiarity breeds profits'
        ]
      },
      {
        id: 'lesson_premarket_routine',
        slug: 'premarket-routine',
        title: 'Complete Pre-Market Routine',
        description: 'Everything I do before market open to prepare for the day.',
        video_id: 'cm5d2tnj4pu2qr6dhifg',
        duration: 720,
        transcript: '',
        key_takeaways: [
          'Wake up early - no rushing',
          'Draw hourly levels on each stock',
          'Check pre-market gaps',
          'Note any earnings/news'
        ]
      },
      {
        id: 'lesson_checklist',
        slug: 'daily-trading-checklist',
        title: 'Daily Trading Checklist',
        description: 'The checklist I use every single trading day.',
        video_id: 'cm5d30nj4pu2qr6dhig0',
        duration: 480,
        transcript: '',
        key_takeaways: [
          'Levels drawn? Check',
          'Trading plan reviewed? Check',
          'Mental state good? Check',
          'Ready to trade? Check'
        ]
      }
    ]
  }
];

// Helper function to get module by slug
export function getModuleBySlug(slug: string): CurriculumModule | undefined {
  return CURRICULUM_MODULES.find(m => m.slug === slug);
}

// Helper function to get lesson by ID
export function getLessonById(lessonId: string): { module: CurriculumModule; lesson: CurriculumModule['lessons'][0] } | undefined {
  for (const module of CURRICULUM_MODULES) {
    const lesson = module.lessons.find(l => l.id === lessonId);
    if (lesson) {
      return { module, lesson };
    }
  }
  return undefined;
}

// Get total curriculum stats
export function getCurriculumStats() {
  const totalLessons = CURRICULUM_MODULES.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalDuration = CURRICULUM_MODULES.reduce(
    (sum, m) => sum + m.lessons.reduce((lSum, l) => lSum + l.duration, 0),
    0
  );

  return {
    totalModules: CURRICULUM_MODULES.length,
    totalLessons,
    totalDuration,
    totalHours: Math.round(totalDuration / 3600 * 10) / 10
  };
}
