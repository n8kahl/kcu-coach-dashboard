// ============================================
// KCU Social Builder - Trending Topic Aggregator
// ============================================
// Aggregates trending topics from X/Twitter, TikTok,
// news sources, and economic calendars for content generation
// Includes "Market Pulse" - Insta-Reaction generator using
// Somesh's voice profile from @kaycapitals

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { TrendingTopic, TrendingCategory, ContentAngle } from '@/types/social';
import { getHybridVoiceProfile, HybridVoiceProfile } from './tone-analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic();

// ============================================
// Somesh's Trigger Topics (Priority News Filters)
// ============================================

const TRIGGER_TOPICS = [
  'Trump',
  'Powell',
  'SPY',
  '0DTE',
  'Gamma Levels',
  'FOMC',
  'Fed',
  'Interest Rate',
  'CPI',
  'Jobs Report',
  'VIX',
  'Market Crash',
  'Rally',
  'Gap Up',
  'Gap Down',
  'Tariff',
  'Recession',
  'Inflation',
];

// ============================================
// Configuration
// ============================================

const TRADING_KEYWORDS = [
  // Options Trading
  'options', 'calls', 'puts', '0DTE', 'SPY', 'SPX', 'QQQ', 'NVDA', 'TSLA', 'AAPL',
  'options flow', 'unusual options', 'gamma squeeze', 'delta hedging',

  // Day Trading
  'day trading', 'scalping', 'swing trade', 'momentum', 'breakout', 'breakdown',
  'support resistance', 'technical analysis', 'chart patterns',

  // Market Events
  'FOMC', 'Fed', 'interest rates', 'CPI', 'inflation', 'jobs report', 'NFP',
  'earnings', 'GDP', 'retail sales', 'consumer sentiment',

  // Political/Economic
  'Trump', 'Biden', 'tariffs', 'trade war', 'sanctions', 'election',
  'Treasury', 'debt ceiling', 'stimulus', 'recession',

  // Crypto/Fintech
  'Bitcoin', 'BTC', 'crypto', 'blockchain', 'DeFi',

  // General Market
  'stock market', 'Wall Street', 'S&P 500', 'Nasdaq', 'Dow Jones',
  'bull market', 'bear market', 'volatility', 'VIX',
];

const CATEGORY_KEYWORDS: Record<TrendingCategory, string[]> = {
  economic_data: ['CPI', 'inflation', 'GDP', 'jobs report', 'NFP', 'retail sales', 'PMI', 'Fed', 'FOMC', 'interest rates'],
  earnings: ['earnings', 'EPS', 'revenue', 'guidance', 'beat', 'miss', 'quarterly report'],
  futures: ['futures', 'pre-market', 'after hours', 'ES', 'NQ', 'overnight'],
  political: ['Trump', 'Biden', 'election', 'tariffs', 'sanctions', 'policy', 'Congress', 'White House'],
  market_sentiment: ['fear', 'greed', 'VIX', 'volatility', 'sentiment', 'bull', 'bear', 'rally', 'selloff'],
  technical: ['breakout', 'breakdown', 'support', 'resistance', 'chart', 'pattern', 'trend', 'momentum'],
  psychology: ['discipline', 'patience', 'revenge trading', 'FOMO', 'greed', 'fear', 'mindset'],
  news: ['breaking', 'just in', 'announced', 'reports', 'sources say'],
  viral: ['viral', 'trending', 'everyone', 'blowing up'],
};

// ============================================
// X/Twitter Trending Scraper
// ============================================

interface XTrend {
  name: string;
  tweet_volume: number | null;
  url: string;
}

interface XSearchResult {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
  };
}

/**
 * Search X/Twitter for trading-related trending topics
 */
export async function scrapeXTrending(): Promise<Partial<TrendingTopic>[]> {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN;

  if (!bearerToken) {
    console.warn('X_BEARER_TOKEN not configured, using AI-generated trends');
    return generateAITrendingTopics('twitter');
  }

  const topics: Partial<TrendingTopic>[] = [];

  try {
    // Search for recent high-engagement tweets with trading keywords
    for (const keyword of TRADING_KEYWORDS.slice(0, 10)) { // Limit to avoid rate limits
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(keyword)}%20-is:retweet%20lang:en&max_results=10&tweet.fields=public_metrics,created_at`,
        {
          headers: {
            'Authorization': `Bearer ${bearerToken}`,
          },
        }
      );

      if (!response.ok) {
        console.error(`X API error for ${keyword}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const tweets: XSearchResult[] = data.data || [];

      // Aggregate engagement for this keyword
      if (tweets.length > 0) {
        const totalEngagement = tweets.reduce((sum, t) =>
          sum + t.public_metrics.like_count + t.public_metrics.retweet_count * 2 + t.public_metrics.reply_count, 0
        );

        const avgEngagement = totalEngagement / tweets.length;

        if (avgEngagement > 100) { // Only include if significant engagement
          const category = categorizeKeyword(keyword);
          const topTweet = tweets.reduce((best, t) =>
            (t.public_metrics.like_count > best.public_metrics.like_count) ? t : best
          );

          topics.push({
            topic: keyword,
            category,
            source: 'x_twitter',
            source_url: `https://twitter.com/search?q=${encodeURIComponent(keyword)}`,
            source_data: {
              tweet_count: tweets.length,
              sample_tweet: topTweet.text,
              avg_engagement: avgEngagement,
            },
            trend_score: Math.min(100, Math.round(avgEngagement / 10)),
            mention_count: tweets.length * 100, // Estimate
            velocity: avgEngagement > 500 ? 'rising' : 'stable',
            relevant_hashtags: extractHashtagsFromTweets(tweets),
            is_active: true,
          });
        }
      }

      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return topics;
  } catch (error) {
    console.error('Error scraping X trending:', error);
    return generateAITrendingTopics('twitter');
  }
}

function extractHashtagsFromTweets(tweets: XSearchResult[]): string[] {
  const hashtags = new Set<string>();
  tweets.forEach(t => {
    const matches = t.text.match(/#[\w]+/g) || [];
    matches.forEach(h => hashtags.add(h.toLowerCase()));
  });
  return Array.from(hashtags).slice(0, 10);
}

// ============================================
// TikTok Trending Scraper
// ============================================

interface TikTokTrend {
  hashtag: string;
  view_count: number;
  video_count: number;
}

/**
 * Scrape TikTok for trading-related trending hashtags and content
 */
export async function scrapeTikTokTrending(): Promise<Partial<TrendingTopic>[]> {
  const apiKey = process.env.TIKAPI_KEY;

  if (!apiKey) {
    console.warn('TIKAPI_KEY not configured, using AI-generated trends');
    return generateAITrendingTopics('tiktok');
  }

  const topics: Partial<TrendingTopic>[] = [];
  const tradingHashtags = [
    'daytrading', 'stockmarket', 'optionstrading', 'tradertok', 'stocktok',
    'investing', 'forex', 'scalping', 'swingtrade', 'tradingpsychology',
    'financetok', 'moneytok', 'wallstreet', 'stocktips', 'tradingsetup',
  ];

  try {
    for (const hashtag of tradingHashtags) {
      const response = await fetch(
        `https://api.tikapi.io/public/hashtag?name=${hashtag}`,
        {
          headers: { 'X-API-KEY': apiKey },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const hashtagInfo = data.challengeInfo?.challenge;

      if (hashtagInfo && hashtagInfo.stats?.videoCount > 1000) {
        topics.push({
          topic: `#${hashtag}`,
          category: categorizeKeyword(hashtag),
          source: 'tiktok',
          source_url: `https://tiktok.com/tag/${hashtag}`,
          source_data: {
            view_count: hashtagInfo.stats?.viewCount || 0,
            video_count: hashtagInfo.stats?.videoCount || 0,
          },
          trend_score: Math.min(100, Math.round((hashtagInfo.stats?.viewCount || 0) / 1000000)),
          mention_count: hashtagInfo.stats?.videoCount || 0,
          velocity: 'stable',
          relevant_hashtags: [`#${hashtag}`],
          is_active: true,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return topics;
  } catch (error) {
    console.error('Error scraping TikTok trending:', error);
    return generateAITrendingTopics('tiktok');
  }
}

// ============================================
// News Aggregator
// ============================================

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  category?: string;
}

/**
 * Aggregate financial and trading news from multiple sources
 */
export async function aggregateNews(): Promise<Partial<TrendingTopic>[]> {
  const topics: Partial<TrendingTopic>[] = [];

  // Try multiple news sources
  const newsPromises = [
    fetchFinancialNews(),
    fetchEconomicCalendar(),
    fetchMarketNews(),
  ];

  const results = await Promise.allSettled(newsPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      topics.push(...result.value);
    }
  }

  // If no news fetched, use AI to generate current market topics
  if (topics.length === 0) {
    return generateAITrendingTopics('news');
  }

  return topics;
}

/**
 * Fetch financial news from NewsAPI or similar
 */
async function fetchFinancialNews(): Promise<Partial<TrendingTopic>[]> {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return [];
  }

  try {
    const queries = ['stock market', 'Federal Reserve', 'options trading', 'Wall Street'];
    const topics: Partial<TrendingTopic>[] = [];

    for (const query of queries) {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`
      );

      if (!response.ok) continue;

      const data = await response.json();
      const articles: NewsArticle[] = data.articles || [];

      for (const article of articles) {
        const category = categorizeNews(article.title + ' ' + article.description);

        topics.push({
          topic: article.title,
          category,
          source: 'news_api',
          source_url: article.url,
          source_data: {
            description: article.description,
            source_name: article.source,
            published_at: article.publishedAt,
          },
          trend_score: 70, // News gets high base score
          velocity: 'rising',
          is_active: true,
          relevant_hashtags: generateHashtagsFromText(article.title),
        });
      }
    }

    return topics;
  } catch (error) {
    console.error('Error fetching financial news:', error);
    return [];
  }
}

/**
 * Fetch economic calendar events
 */
async function fetchEconomicCalendar(): Promise<Partial<TrendingTopic>[]> {
  // Use a simple approach - generate known upcoming events
  const topics: Partial<TrendingTopic>[] = [];

  // Get current date info
  const now = new Date();
  const dayOfWeek = now.getDay();
  const dayOfMonth = now.getDate();

  // Common economic events
  const events = [
    { name: 'FOMC Meeting', days: [2, 3], category: 'economic_data' as TrendingCategory },
    { name: 'Jobs Report (NFP)', day: 5, weekNum: 1, category: 'economic_data' as TrendingCategory },
    { name: 'CPI Data Release', day: 2, weekNum: 2, category: 'economic_data' as TrendingCategory },
    { name: 'Retail Sales', day: 2, weekNum: 3, category: 'economic_data' as TrendingCategory },
  ];

  // Add market open/close topics
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    const hour = now.getHours();

    if (hour >= 6 && hour <= 9) {
      topics.push({
        topic: 'Pre-Market Analysis',
        category: 'futures',
        source: 'economic_calendar',
        trend_score: 85,
        velocity: 'rising',
        is_active: true,
        suggested_hooks: [
          'Pre-market is looking interesting today. Here\'s what I\'m watching...',
          'Futures are signaling a [bullish/bearish] open. Key levels to watch:',
        ],
        relevant_hashtags: ['#premarket', '#futures', '#daytrading', '#stockmarket'],
      });
    }

    if (hour >= 9 && hour <= 10) {
      topics.push({
        topic: 'Market Open Strategy',
        category: 'technical',
        source: 'economic_calendar',
        trend_score: 90,
        velocity: 'rising',
        is_active: true,
        suggested_hooks: [
          'First 30 minutes are CRUCIAL. Here\'s my game plan...',
          'Opening range breakout setup looking clean on $SPY',
        ],
        relevant_hashtags: ['#marketopen', '#daytrading', '#SPY', '#tradingstrategy'],
      });
    }
  }

  return topics;
}

/**
 * Fetch market movers and news
 */
async function fetchMarketNews(): Promise<Partial<TrendingTopic>[]> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY || process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return [];
  }

  // This would connect to Alpha Vantage or Finnhub for market data
  // For now, return empty and rely on AI generation
  return [];
}

// ============================================
// AI-Powered Trend Generation
// ============================================

/**
 * Use Claude to generate relevant trending topics based on current market context
 */
export async function generateAITrendingTopics(
  source: 'twitter' | 'tiktok' | 'news' | 'all' = 'all'
): Promise<Partial<TrendingTopic>[]> {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    console.warn('ANTHROPIC_API_KEY not configured, using fallback trends');
    return getFallbackTrends();
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const prompt = `You are a social media content strategist for a day trading education community.

Today is ${currentDate}.

Generate 8-10 trending topics that would be relevant for creating engaging social media content about:
- Options trading and day trading
- Current market conditions and economic events
- Trading psychology and education
- Political/economic news affecting markets (including Trump administration policies if relevant)
- Viral trading content trends on ${source === 'all' ? 'X/Twitter and TikTok' : source}

For each topic, provide:
1. topic: A concise topic name (2-6 words)
2. category: One of: economic_data, earnings, futures, political, market_sentiment, technical, psychology, news, viral
3. trend_score: 60-100 (how trending/relevant it is)
4. velocity: rising, stable, or falling
5. suggested_hooks: 2-3 engaging hook sentences for social posts
6. relevant_hashtags: 4-6 relevant hashtags

Return as a JSON array. Focus on topics that would resonate with retail traders and trading students.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return getFallbackTrends();

    // Extract JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return getFallbackTrends();

    const topics = JSON.parse(jsonMatch[0]);

    return topics.map((t: any) => ({
      topic: t.topic,
      category: t.category as TrendingCategory,
      source: `ai_${source}`,
      source_data: { ai_generated: true, generated_at: new Date().toISOString() },
      trend_score: t.trend_score || 70,
      velocity: t.velocity || 'stable',
      suggested_hooks: t.suggested_hooks || [],
      relevant_hashtags: t.relevant_hashtags || [],
      is_active: true,
      processed_for_suggestions: false,
    }));
  } catch (error) {
    console.error('Error generating AI trends:', error);
    return getFallbackTrends();
  }
}

/**
 * Fallback trends when no API keys available
 */
function getFallbackTrends(): Partial<TrendingTopic>[] {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  const trends: Partial<TrendingTopic>[] = [
    {
      topic: 'Options Flow Analysis',
      category: 'technical',
      source: 'fallback',
      trend_score: 85,
      velocity: 'stable',
      suggested_hooks: [
        'Unusual options activity is lighting up today. Here\'s what smart money is doing...',
        'The options flow doesn\'t lie. Look at this setup...',
      ],
      relevant_hashtags: ['#optionsflow', '#unusualoptions', '#daytrading', '#SPY', '#optionstrading'],
      is_active: true,
    },
    {
      topic: 'Trading Psychology Tips',
      category: 'psychology',
      source: 'fallback',
      trend_score: 80,
      velocity: 'stable',
      suggested_hooks: [
        'The #1 reason traders blow up their accounts (it\'s not what you think)',
        'Discipline is your edge. Here\'s how to build it...',
      ],
      relevant_hashtags: ['#tradingpsychology', '#tradingmindset', '#daytrader', '#discipline'],
      is_active: true,
    },
    {
      topic: 'LTP Framework Wins',
      category: 'technical',
      source: 'fallback',
      trend_score: 90,
      velocity: 'rising',
      suggested_hooks: [
        'Level ✅ Trend ✅ Patience ✅ Another beautiful LTP setup today',
        'The framework works. Trust the process.',
      ],
      relevant_hashtags: ['#LTPframework', '#daytrading', '#tradingwins', '#stockmarket'],
      is_active: true,
    },
    {
      topic: 'Market Structure Analysis',
      category: 'technical',
      source: 'fallback',
      trend_score: 75,
      velocity: 'stable',
      suggested_hooks: [
        'Understanding market structure changed my trading. Here\'s why...',
        'Higher highs, higher lows. The trend is your friend until it ends.',
      ],
      relevant_hashtags: ['#marketstructure', '#technicalanalysis', '#priceaction', '#trading'],
      is_active: true,
    },
  ];

  // Add time-sensitive trends
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    if (hour >= 4 && hour < 9) {
      trends.push({
        topic: 'Pre-Market Movers',
        category: 'futures',
        source: 'fallback',
        trend_score: 95,
        velocity: 'rising',
        suggested_hooks: [
          'Pre-market is showing some interesting setups. Here\'s my watchlist...',
          'Futures pointing to a [gap up/gap down]. Here\'s how I\'m preparing...',
        ],
        relevant_hashtags: ['#premarket', '#futures', '#watchlist', '#daytrading'],
        is_active: true,
      });
    }
  }

  return trends;
}

// ============================================
// Main Aggregation Function
// ============================================

/**
 * Aggregate all trending topics from all sources
 */
export async function aggregateAllTrending(): Promise<TrendingTopic[]> {
  console.log('Starting trending topic aggregation...');

  const allTopics: Partial<TrendingTopic>[] = [];

  // Fetch from all sources in parallel
  const [xTopics, tiktokTopics, newsTopics] = await Promise.all([
    scrapeXTrending().catch(err => {
      console.error('X scraping failed:', err);
      return [];
    }),
    scrapeTikTokTrending().catch(err => {
      console.error('TikTok scraping failed:', err);
      return [];
    }),
    aggregateNews().catch(err => {
      console.error('News aggregation failed:', err);
      return [];
    }),
  ]);

  allTopics.push(...xTopics, ...tiktokTopics, ...newsTopics);

  // If we got very few topics, supplement with AI-generated ones
  if (allTopics.length < 5) {
    const aiTopics = await generateAITrendingTopics('all');
    allTopics.push(...aiTopics);
  }

  // Deduplicate by topic name
  const uniqueTopics = new Map<string, Partial<TrendingTopic>>();
  for (const topic of allTopics) {
    const key = topic.topic?.toLowerCase().trim();
    if (key && !uniqueTopics.has(key)) {
      uniqueTopics.set(key, topic);
    }
  }

  // Convert to full TrendingTopic objects and save to database
  const finalTopics: TrendingTopic[] = [];

  for (const [, topic] of Array.from(uniqueTopics.entries())) {
    const fullTopic: TrendingTopic = {
      id: crypto.randomUUID(),
      topic: topic.topic || 'Unknown Topic',
      category: topic.category || 'news',
      source: topic.source || 'aggregator',
      source_id: topic.source_id,
      source_url: topic.source_url,
      source_data: topic.source_data || {},
      trend_score: topic.trend_score || 50,
      mention_count: topic.mention_count || 0,
      velocity: topic.velocity || 'stable',
      content_angles: topic.content_angles || [],
      suggested_hooks: topic.suggested_hooks || [],
      relevant_hashtags: topic.relevant_hashtags || [],
      is_active: true,
      processed_for_suggestions: false,
      started_trending_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    finalTopics.push(fullTopic);
  }

  // Sort by trend score
  finalTopics.sort((a, b) => b.trend_score - a.trend_score);

  // Save to database (upsert)
  await saveTrendingTopics(finalTopics);

  console.log(`Aggregated ${finalTopics.length} trending topics`);
  return finalTopics;
}

/**
 * Save trending topics to database
 */
async function saveTrendingTopics(topics: TrendingTopic[]): Promise<void> {
  try {
    // Mark old topics as inactive
    await supabase
      .from('trending_topics')
      .update({ is_active: false })
      .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Upsert new topics
    for (const topic of topics) {
      await supabase
        .from('trending_topics')
        .upsert(
          {
            topic: topic.topic,
            category: topic.category,
            source: topic.source,
            source_url: topic.source_url,
            source_data: topic.source_data,
            trend_score: topic.trend_score,
            mention_count: topic.mention_count,
            velocity: topic.velocity,
            content_angles: topic.content_angles,
            suggested_hooks: topic.suggested_hooks,
            relevant_hashtags: topic.relevant_hashtags,
            is_active: topic.is_active,
            processed_for_suggestions: topic.processed_for_suggestions,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'topic' }
        );
    }
  } catch (error) {
    console.error('Error saving trending topics:', error);
  }
}

/**
 * Get active trending topics from database
 */
export async function getActiveTrendingTopics(
  limit: number = 20,
  category?: TrendingCategory
): Promise<TrendingTopic[]> {
  let query = supabase
    .from('trending_topics')
    .select('*')
    .eq('is_active', true)
    .order('trend_score', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching trending topics:', error);
    return [];
  }

  return data || [];
}

// ============================================
// Helper Functions
// ============================================

function categorizeKeyword(keyword: string): TrendingCategory {
  const lower = keyword.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) {
      return category as TrendingCategory;
    }
  }

  return 'news';
}

function categorizeNews(text: string): TrendingCategory {
  const lower = text.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) {
      return category as TrendingCategory;
    }
  }

  return 'news';
}

function generateHashtagsFromText(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const hashtags: string[] = [];

  // Check for trading keywords
  for (const word of words) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    if (TRADING_KEYWORDS.some(k => k.toLowerCase().includes(cleanWord) || cleanWord.includes(k.toLowerCase()))) {
      hashtags.push(`#${cleanWord}`);
    }
  }

  // Add common hashtags
  hashtags.push('#trading', '#stockmarket');

  return Array.from(new Set(hashtags)).slice(0, 8);
}

// ============================================
// Market Pulse - Real-Time News Reaction Engine
// ============================================

export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  source: string;
  sourceUrl?: string;
  publishedAt: string;
  category: TrendingCategory;
  triggerTopics: string[];
  urgency: 'breaking' | 'high' | 'medium' | 'low';
  sentiment?: 'bullish' | 'bearish' | 'neutral';
}

export interface ReactionContent {
  id: string;
  newsItem: NewsItem;
  instagramCaption: string;
  twitterPost: string;
  hook: string;
  emojis: string[];
  hashtags: string[];
  cta: string;
  tradingInsight?: string;
  generatedAt: string;
}

/**
 * Fetch real-time market news filtered by Somesh's trigger topics
 */
export async function fetchTriggerNews(): Promise<NewsItem[]> {
  const newsApiKey = process.env.NEWS_API_KEY;
  const twitterBearerToken = process.env.TWITTER_BEARER_TOKEN || process.env.X_BEARER_TOKEN;

  const newsItems: NewsItem[] = [];

  // Fetch from News API
  if (newsApiKey) {
    try {
      // Build query with trigger topics
      const triggerQuery = TRIGGER_TOPICS.slice(0, 5).join(' OR ');

      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(triggerQuery)}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${newsApiKey}`
      );

      if (response.ok) {
        const data = await response.json();
        const articles = data.articles || [];

        for (const article of articles) {
          const matchedTopics = TRIGGER_TOPICS.filter(topic =>
            (article.title?.toLowerCase().includes(topic.toLowerCase()) ||
             article.description?.toLowerCase().includes(topic.toLowerCase()))
          );

          if (matchedTopics.length > 0) {
            const urgency = determineUrgency(article.title, article.publishedAt);
            const sentiment = determineSentiment(article.title + ' ' + (article.description || ''));

            newsItems.push({
              id: `news-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: article.title,
              description: article.description,
              source: article.source?.name || 'News',
              sourceUrl: article.url,
              publishedAt: article.publishedAt,
              category: categorizeNews(article.title + ' ' + (article.description || '')),
              triggerTopics: matchedTopics,
              urgency,
              sentiment,
            });
          }
        }
      }
    } catch (error) {
      console.error('[MarketPulse] News API error:', error);
    }
  }

  // Fetch from Twitter/X for real-time pulse
  if (twitterBearerToken) {
    try {
      for (const topic of TRIGGER_TOPICS.slice(0, 3)) {
        const response = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(topic)}%20(stocks%20OR%20market%20OR%20trading)%20-is:retweet%20lang:en&max_results=10&tweet.fields=created_at,public_metrics`,
          {
            headers: { 'Authorization': `Bearer ${twitterBearerToken}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const tweets = data.data || [];

          // Find high-engagement tweets that might indicate breaking news
          const viralTweets = tweets.filter((t: any) =>
            t.public_metrics?.like_count > 500 || t.public_metrics?.retweet_count > 100
          );

          for (const tweet of viralTweets.slice(0, 2)) {
            newsItems.push({
              id: `twitter-${tweet.id}`,
              title: tweet.text.substring(0, 100) + (tweet.text.length > 100 ? '...' : ''),
              description: tweet.text,
              source: 'Twitter/X',
              sourceUrl: `https://twitter.com/i/status/${tweet.id}`,
              publishedAt: tweet.created_at,
              category: 'news',
              triggerTopics: [topic],
              urgency: 'high',
              sentiment: determineSentiment(tweet.text),
            });
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('[MarketPulse] Twitter API error:', error);
    }
  }

  // If no API keys, generate mock breaking news for demo
  if (newsItems.length === 0) {
    newsItems.push(...getMockBreakingNews());
  }

  // Sort by urgency and recency
  newsItems.sort((a, b) => {
    const urgencyOrder = { breaking: 0, high: 1, medium: 2, low: 3 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return newsItems.slice(0, 10);
}

/**
 * Generate Instagram-style reaction content using Somesh's voice profile
 */
export async function generateReactionContent(newsItem: NewsItem): Promise<ReactionContent> {
  // Get the hybrid voice profile
  let voiceProfile = await getHybridVoiceProfile();

  // Use defaults if no profile exists
  if (!voiceProfile) {
    voiceProfile = getDefaultVoiceProfile();
  }

  // Build the reaction prompt
  const prompt = buildReactionPrompt(newsItem, voiceProfile);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse the JSON response
    let cleanedText = content.text.trim();
    if (cleanedText.startsWith('```json')) cleanedText = cleanedText.slice(7);
    if (cleanedText.startsWith('```')) cleanedText = cleanedText.slice(3);
    if (cleanedText.endsWith('```')) cleanedText = cleanedText.slice(0, -3);

    const result = JSON.parse(cleanedText.trim());

    return {
      id: `reaction-${Date.now()}`,
      newsItem,
      instagramCaption: result.instagramCaption || '',
      twitterPost: result.twitterPost || '',
      hook: result.hook || '',
      emojis: result.emojis || [],
      hashtags: result.hashtags || [],
      cta: result.cta || '',
      tradingInsight: result.tradingInsight || '',
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[MarketPulse] Reaction generation error:', error);
    return getDefaultReaction(newsItem, voiceProfile);
  }
}

/**
 * Build the reaction prompt using voice profile data
 */
function buildReactionPrompt(newsItem: NewsItem, profile: HybridVoiceProfile): string {
  const emojiStyle = profile.combinedInsights.platformSpecificAdjustments.instagram.emojiStyle.join(' ');
  const signaturePhrases = profile.combinedInsights.signaturePhrases.slice(0, 5).join('", "');
  const hookPatterns = profile.instagramLayer.captionStructures.hookPatterns.slice(0, 3).join('", "');
  const ctaPatterns = profile.instagramLayer.captionStructures.ctaPatterns.slice(0, 3).join('", "');
  const hashtagClusters = profile.instagramLayer.hashtagClusters.flatMap(c => c.hashtags).slice(0, 10).join(', ');

  return `You are ghostwriting a social media reaction post for Somesh from KCU Trading (@kaycapitals on Instagram).

NEWS TO REACT TO:
Title: ${newsItem.title}
${newsItem.description ? `Description: ${newsItem.description}` : ''}
Source: ${newsItem.source}
Trigger Topics: ${newsItem.triggerTopics.join(', ')}
Urgency: ${newsItem.urgency}
Sentiment: ${newsItem.sentiment || 'neutral'}

SOMESH'S VOICE PROFILE:
- Signature phrases: "${signaturePhrases}"
- Hook patterns: "${hookPatterns}"
- CTA patterns: "${ctaPatterns}"
- Emoji style: ${emojiStyle}
- Key hashtags: ${hashtagClusters}
- Tone: Educational but casual, uses "fam" and "y'all", confident but humble
- Philosophy: LTP Framework (Level, Trend, Patience), price action is king

CONTENT REQUIREMENTS:
1. Start with a VISUAL HOOK using urgency (e.g., "⚠️ MARKET ALERT", "🚨 BREAKING", "DON'T PANIC FAM")
2. React to the news in Somesh's authentic voice
3. Provide a TRADING INSIGHT (how this affects SPY, options, day traders)
4. End with an engaging CTA in his style
5. Use his signature emoji patterns naturally
6. Keep Instagram caption under 2200 characters
7. Twitter post should be under 280 characters

Generate a reaction post that sounds EXACTLY like what Somesh would post 5 minutes after this news breaks.

Return JSON:
{
  "hook": "The opening visual hook line",
  "instagramCaption": "Full Instagram caption with line breaks, emojis, and hashtags",
  "twitterPost": "Concise Twitter version under 280 chars",
  "emojis": ["🚨", "📈", "etc"],
  "hashtags": ["#daytrading", "#SPY", "etc"],
  "cta": "The call to action used",
  "tradingInsight": "Brief explanation of market impact"
}

Return ONLY valid JSON.`;
}

/**
 * Default voice profile when database is empty
 */
function getDefaultVoiceProfile(): HybridVoiceProfile {
  return {
    id: 'default',
    handle: 'kaycapitals',
    displayName: 'Somesh (KCU Trading)',
    instagramLayer: {
      highFrequencyEmojis: [
        { emoji: '🎯', count: 10, percentage: 15 },
        { emoji: '📈', count: 8, percentage: 12 },
        { emoji: '🔥', count: 7, percentage: 10 },
        { emoji: '💰', count: 6, percentage: 9 },
        { emoji: '⚠️', count: 5, percentage: 8 },
      ],
      hashtagClusters: [
        { cluster: 'Trading', hashtags: ['#daytrading', '#stockmarket', '#trading'], frequency: 80 },
        { cluster: 'Options', hashtags: ['#optionstrading', '#SPY', '#0DTE'], frequency: 70 },
        { cluster: 'Education', hashtags: ['#tradinglife', '#learntorade', '#tradertips'], frequency: 60 },
      ],
      captionStructures: {
        avgLength: 300,
        hookPatterns: [
          '⚠️ MARKET ALERT',
          '🚨 BREAKING',
          'LISTEN FAM',
          "DON'T PANIC",
          'THE MARKET IS SPEAKING',
        ],
        ctaPatterns: [
          'Drop a 🔥 if you agree',
          'Save this for later',
          'Tag a trader who needs this',
          'Comment your take below',
        ],
        lineBreakStyle: 'double',
      },
      topPerformingCaptions: [],
      signaturePhrases: ['Listen fam', 'Trust the process', 'LTP', 'The holy grail', 'Patience pays'],
      postingStyle: {
        avgHashtagsPerPost: 8,
        emojiDensity: 2.5,
        questionFrequency: 30,
        mentionFrequency: 5,
      },
    },
    youtubeLayer: {
      educationalTone: {
        teachingPhrases: ['Let me break this down', "Here's the key"],
        explanationPatterns: ['The reason for this is', 'What this means is'],
        conceptIntroductions: ['So what does this mean for us?'],
      },
      deepDivePhrases: ["Let's really dig into this"],
      vocabularyProfile: {
        technicalTerms: ['support', 'resistance', 'VWAP', 'price action', 'gamma'],
        casualExpressions: ['Fam', "Y'all", 'Sweet', 'Beautiful'],
        tradingJargon: ['LTP', 'patience candle', 'key level', '0DTE'],
        motivationalPhrases: ['Trust the process', 'Patience pays'],
      },
      narrativeStyle: {
        storyOpenings: ['Here is what just happened'],
        transitionPhrases: ["Now here's where it gets interesting"],
        conclusionPatterns: ['And that is the beauty of patience'],
      },
      speakingCadence: {
        avgSentenceLength: 12,
        repetitionPatterns: [],
        emphasisPhrases: ['This is CRUCIAL', 'Write this down'],
      },
    },
    combinedInsights: {
      coreVocabulary: ['LTP', 'patience', 'level', 'trend', 'fam'],
      signaturePhrases: ['Listen fam', 'Trust the process', 'The holy grail', 'Patience pays'],
      brandKeywords: ['LTP Framework', 'price action', 'patience candle', 'KCU'],
      avoidedLanguage: ['get rich quick', 'guaranteed profits', 'easy money'],
      toneAttributes: {
        confident: 85,
        humble: 65,
        educational: 90,
        motivational: 80,
        casual: 75,
      },
      platformSpecificAdjustments: {
        instagram: {
          emojiStyle: ['🎯', '📈', '💰', '🔥', '⚠️', '🚨'],
          hashtagStrategy: ['Mix popular + niche hashtags'],
          captionLength: 'medium',
        },
        youtube: {
          openingStyle: 'Hook with problem/question',
          closingCTA: 'Like, subscribe, join the fam',
          segmentTransitions: ["Now let's look at"],
        },
        twitter: {
          threadStyle: true,
          hashtagLimit: 3,
          mentionStyle: 'Minimal',
        },
      },
    },
    lastUpdated: new Date().toISOString(),
    dataSourcesUsed: { instagramPosts: 0, youtubeTranscripts: 0 },
  };
}

/**
 * Default reaction when AI generation fails
 */
function getDefaultReaction(newsItem: NewsItem, profile: HybridVoiceProfile): ReactionContent {
  const urgencyEmoji = newsItem.urgency === 'breaking' ? '🚨' : newsItem.urgency === 'high' ? '⚠️' : '📊';
  const sentimentEmoji = newsItem.sentiment === 'bullish' ? '📈' : newsItem.sentiment === 'bearish' ? '📉' : '👀';

  const hook = `${urgencyEmoji} MARKET UPDATE`;
  const caption = `${hook}

${newsItem.title}

Fam, here's what this means for us traders:

${newsItem.sentiment === 'bullish' ? 'This could set up some nice long opportunities. But remember - wait for confirmation!' :
  newsItem.sentiment === 'bearish' ? 'Stay cautious here. This might create some volatility. Protect your capital!' :
  'The market is processing this news. Watch for the reaction at key levels!'}

Level ✅ Trend ✅ Patience ✅

Drop a ${sentimentEmoji} if you're watching this!

#daytrading #stockmarket #${newsItem.triggerTopics[0]?.replace(/\s+/g, '').toLowerCase() || 'trading'}`;

  return {
    id: `reaction-default-${Date.now()}`,
    newsItem,
    instagramCaption: caption,
    twitterPost: `${urgencyEmoji} ${newsItem.title.substring(0, 200)}... What's your take? #trading #stockmarket`,
    hook,
    emojis: [urgencyEmoji, sentimentEmoji, '✅', '🎯'],
    hashtags: ['#daytrading', '#stockmarket', '#trading'],
    cta: `Drop a ${sentimentEmoji} if you're watching this!`,
    tradingInsight: 'Watch for price action at key support/resistance levels.',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Determine news urgency based on title and recency
 */
function determineUrgency(title: string, publishedAt: string): 'breaking' | 'high' | 'medium' | 'low' {
  const titleLower = title.toLowerCase();
  const minutesAgo = (Date.now() - new Date(publishedAt).getTime()) / 60000;

  // Breaking keywords
  if (titleLower.includes('breaking') || titleLower.includes('just in') || titleLower.includes('alert')) {
    return 'breaking';
  }

  // High urgency for recent Fed/economic news
  if (minutesAgo < 30 && (titleLower.includes('fed') || titleLower.includes('powell') || titleLower.includes('rate'))) {
    return 'breaking';
  }

  if (minutesAgo < 60) {
    return 'high';
  }

  if (minutesAgo < 180) {
    return 'medium';
  }

  return 'low';
}

/**
 * Determine sentiment from text
 */
function determineSentiment(text: string): 'bullish' | 'bearish' | 'neutral' {
  const lower = text.toLowerCase();

  const bullishWords = ['rally', 'surge', 'jump', 'soar', 'gain', 'rise', 'bull', 'optimistic', 'up', 'high', 'record', 'strong'];
  const bearishWords = ['crash', 'plunge', 'drop', 'fall', 'sink', 'decline', 'bear', 'fear', 'down', 'low', 'weak', 'sell-off'];

  const bullishScore = bullishWords.filter(w => lower.includes(w)).length;
  const bearishScore = bearishWords.filter(w => lower.includes(w)).length;

  if (bullishScore > bearishScore + 1) return 'bullish';
  if (bearishScore > bullishScore + 1) return 'bearish';
  return 'neutral';
}

/**
 * Mock breaking news for demo/development
 */
function getMockBreakingNews(): NewsItem[] {
  const now = new Date();

  return [
    {
      id: 'mock-1',
      title: 'Fed Chair Powell signals potential rate pause in upcoming meeting',
      description: 'Federal Reserve Chair Jerome Powell hinted that the central bank may hold rates steady as inflation data shows signs of cooling.',
      source: 'Financial Times',
      publishedAt: new Date(now.getTime() - 15 * 60000).toISOString(),
      category: 'economic_data',
      triggerTopics: ['Powell', 'Fed', 'Interest Rate'],
      urgency: 'breaking',
      sentiment: 'bullish',
    },
    {
      id: 'mock-2',
      title: 'SPY breaks key resistance level amid strong volume',
      description: 'S&P 500 ETF surpasses $500 mark for the first time with institutional buying pressure.',
      source: 'Bloomberg',
      publishedAt: new Date(now.getTime() - 45 * 60000).toISOString(),
      category: 'market_sentiment',
      triggerTopics: ['SPY', 'Rally'],
      urgency: 'high',
      sentiment: 'bullish',
    },
    {
      id: 'mock-3',
      title: 'Trump announces new tariff plans targeting tech imports',
      description: 'Former President Trump outlines potential trade policy changes if elected, affecting semiconductor and tech sectors.',
      source: 'Reuters',
      publishedAt: new Date(now.getTime() - 2 * 60 * 60000).toISOString(),
      category: 'political',
      triggerTopics: ['Trump', 'Tariff'],
      urgency: 'medium',
      sentiment: 'bearish',
    },
    {
      id: 'mock-4',
      title: 'Gamma squeeze potential building in 0DTE options market',
      description: 'Unusual options activity suggests potential volatility spike as dealers hedge short-dated contracts.',
      source: 'ZeroHedge',
      publishedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      category: 'technical',
      triggerTopics: ['0DTE', 'Gamma Levels', 'SPY'],
      urgency: 'high',
      sentiment: 'neutral',
    },
  ];
}

/**
 * Get all trigger topics for the Market Pulse
 */
export function getTriggerTopics(): string[] {
  return [...TRIGGER_TOPICS];
}

/**
 * Batch generate reactions for multiple news items
 */
export async function generateBatchReactions(newsItems: NewsItem[]): Promise<ReactionContent[]> {
  const reactions: ReactionContent[] = [];

  for (const item of newsItems.slice(0, 5)) {
    try {
      const reaction = await generateReactionContent(item);
      reactions.push(reaction);
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[MarketPulse] Failed to generate reaction for ${item.id}:`, error);
    }
  }

  return reactions;
}
