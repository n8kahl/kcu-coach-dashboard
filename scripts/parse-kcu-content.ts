/**
 * KCU Content Parser
 *
 * Parses the raw KCU video transcripts and organizes them into
 * structured modules and lessons for the learning management system.
 */

import * as fs from 'fs';
import * as path from 'path';

// Module definitions based on content analysis
const MODULE_DEFINITIONS = [
  {
    id: 'mod_fundamentals',
    slug: 'fundamentals',
    title: 'Trading Fundamentals',
    description: 'Account setup, broker configuration, and chart basics',
    icon: 'BookOpen',
    color: '#3B82F6', // blue
    order: 1,
    difficulty: 'beginner' as const,
    keywords: ['margin account', 'cash account', 'interactive brokers', 'paper trading', 'set up', 'tradingview', 'chart setup', 'indicators']
  },
  {
    id: 'mod_price_action',
    slug: 'price-action',
    title: 'Price Action Mastery',
    description: 'Understanding candlesticks, support/resistance, and market structure',
    icon: 'TrendingUp',
    color: '#10B981', // green
    order: 2,
    difficulty: 'beginner' as const,
    keywords: ['price action', 'candlestick', 'candle', 'support', 'resistance', 'momentum', 'bar by bar']
  },
  {
    id: 'mod_indicators',
    slug: 'indicators',
    title: 'Technical Indicators',
    description: 'EMAs, VWAP, and other essential trading indicators',
    icon: 'Activity',
    color: '#8B5CF6', // purple
    order: 3,
    difficulty: 'intermediate' as const,
    keywords: ['EMA', 'VWAP', 'moving average', 'exponential', 'indicator', 'cloud', 'ripster']
  },
  {
    id: 'mod_ltp_framework',
    slug: 'ltp-framework',
    title: 'LTP Framework',
    description: 'Levels, Trends, and Patience - the core trading methodology',
    icon: 'Target',
    color: '#F59E0B', // gold
    order: 4,
    difficulty: 'intermediate' as const,
    keywords: ['LTP', 'levels', 'trends', 'patience', 'patience candle', 'hourly levels', 'hourly chart', '60 minute']
  },
  {
    id: 'mod_strategies',
    slug: 'strategies',
    title: 'Trading Strategies',
    description: 'ORB, gap trading, and specific setup strategies',
    icon: 'Crosshair',
    color: '#EF4444', // red
    order: 5,
    difficulty: 'intermediate' as const,
    keywords: ['ORB', 'opening range', 'gap up', 'gap down', 'strategy', 'bounce', 'reject', 'breakout']
  },
  {
    id: 'mod_entries_exits',
    slug: 'entries-exits',
    title: 'Entries & Exits',
    description: 'When to enter, where to set stops, and how to take profits',
    icon: 'ArrowRightLeft',
    color: '#06B6D4', // cyan
    order: 6,
    difficulty: 'intermediate' as const,
    keywords: ['entry', 'exit', 'stop loss', 'stop', 'target', 'profit', 'take profit', 'where to take']
  },
  {
    id: 'mod_risk_management',
    slug: 'risk-management',
    title: 'Risk Management',
    description: 'Position sizing, account management, and protecting capital',
    icon: 'Shield',
    color: '#14B8A6', // teal
    order: 7,
    difficulty: 'intermediate' as const,
    keywords: ['risk', 'position size', 'account', 'leverage', 'protect', 'capital', 'drawdown']
  },
  {
    id: 'mod_psychology',
    slug: 'psychology',
    title: 'Trading Psychology',
    description: 'Mindset, discipline, handling losses, and emotional control',
    icon: 'Brain',
    color: '#EC4899', // pink
    order: 8,
    difficulty: 'advanced' as const,
    keywords: ['psychology', 'mindset', 'fear', 'FOMO', 'emotion', 'discipline', 'scared', 'mistake', 'lose', 'win', 'off track']
  },
  {
    id: 'mod_trading_rules',
    slug: 'trading-rules',
    title: 'Trading Rules & Principles',
    description: 'Core principles and rules for consistent trading',
    icon: 'ClipboardList',
    color: '#F97316', // orange
    order: 9,
    difficulty: 'advanced' as const,
    keywords: ['rule', 'principle', 'never', 'always', 'don\'t', 'should', 'must']
  },
  {
    id: 'mod_watchlist',
    slug: 'watchlist-setup',
    title: 'Watchlist & Pre-Market',
    description: 'Building your watchlist and pre-market preparation',
    icon: 'ListChecks',
    color: '#84CC16', // lime
    order: 10,
    difficulty: 'beginner' as const,
    keywords: ['watchlist', 'pre-market', 'premarket', 'morning', 'checklist', 'trade these names']
  }
];

interface RawVideo {
  id: string;
  transcript: string;
  wordCount: number;
}

interface CategorizedLesson {
  id: string;
  videoId: string;
  moduleId: string;
  title: string;
  description: string;
  transcript: string;
  wordCount: number;
  estimatedDuration: number; // in seconds
  keyTakeaways: string[];
  order: number;
}

interface ParsedModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  order: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lessons: CategorizedLesson[];
  estimatedDuration: number;
}

function parseRawContent(filePath: string): RawVideo[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const videos: RawVideo[] = [];

  // Split by video IDs (20 character alphanumeric strings at start of lines)
  const videoPattern = /([a-z0-9]{20})/g;
  const parts = content.split(videoPattern);

  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i];
    const transcript = parts[i + 1]?.trim() || '';
    if (transcript.length > 50) { // Filter out very short/empty entries
      videos.push({
        id,
        transcript,
        wordCount: transcript.split(/\s+/).length
      });
    }
  }

  return videos;
}

function extractTitle(transcript: string): string {
  // Try to extract topic from common patterns
  const patterns = [
    /(?:in this video|this video).*?(?:talk about|go over|discuss|cover)\s+(.+?)(?:\.|,|all right|okay|now)/i,
    /(?:welcome to|this is).*?(?:module|video about|video on)\s+(.+?)(?:\.|,|all right|okay|now)/i,
    /(?:we're gonna|we are going to)\s+(.+?)(?:\.|,|all right|okay)/i,
    /(?:how to|what is)\s+(.+?)(?:\.|,|all right|okay|\?)/i,
  ];

  for (const pattern of patterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      let title = match[1].trim();
      // Clean up and capitalize
      title = title.replace(/\s+/g, ' ').substring(0, 80);
      return title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  // Fallback: use first meaningful sentence
  const sentences = transcript.split(/[.!?]/);
  for (const sentence of sentences) {
    const cleaned = sentence.trim();
    if (cleaned.length > 20 && cleaned.length < 100) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return 'Trading Lesson';
}

function extractKeyTakeaways(transcript: string): string[] {
  const takeaways: string[] = [];

  // Look for bullet-point style content
  const patterns = [
    /(?:first|1st|number one)[,:]?\s+(.+?)(?:\.|second|2nd|number two)/gi,
    /(?:key point|important|remember)[,:]?\s+(.+?)(?:\.|okay|all right)/gi,
    /(?:rule|principle)[,:]?\s+(.+?)(?:\.|okay|all right)/gi,
  ];

  for (const pattern of patterns) {
    const matches = transcript.matchAll(pattern);
    for (const match of matches) {
      if (match[1] && match[1].length > 10 && match[1].length < 200) {
        takeaways.push(match[1].trim());
      }
    }
  }

  // Limit to 5 takeaways
  return takeaways.slice(0, 5);
}

function categorizeVideo(video: RawVideo): string {
  const transcriptLower = video.transcript.toLowerCase();

  // Score each module based on keyword matches
  let bestModule = MODULE_DEFINITIONS[0];
  let bestScore = 0;

  for (const module of MODULE_DEFINITIONS) {
    let score = 0;
    for (const keyword of module.keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'gi');
      const matches = transcriptLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestModule = module;
    }
  }

  return bestModule.id;
}

function generateDescription(transcript: string): string {
  // Extract first few meaningful sentences
  const sentences = transcript.split(/[.!?]/).filter(s => s.trim().length > 30);
  if (sentences.length > 0) {
    let desc = sentences[0].trim();
    if (desc.length > 200) {
      desc = desc.substring(0, 197) + '...';
    }
    return desc;
  }
  return 'Learn key trading concepts in this lesson.';
}

function parseAndOrganize(inputPath: string, outputPath: string): void {
  console.log('Parsing KCU content...');

  const videos = parseRawContent(inputPath);
  console.log(`Found ${videos.length} videos`);

  // Initialize modules
  const modules: Map<string, ParsedModule> = new Map();
  for (const def of MODULE_DEFINITIONS) {
    modules.set(def.id, {
      ...def,
      lessons: [],
      estimatedDuration: 0
    });
  }

  // Categorize each video
  for (const video of videos) {
    const moduleId = categorizeVideo(video);
    const module = modules.get(moduleId)!;

    // Estimate duration (average speaking rate is ~150 words per minute)
    const estimatedDuration = Math.round((video.wordCount / 150) * 60);

    const lesson: CategorizedLesson = {
      id: `lesson_${video.id}`,
      videoId: video.id,
      moduleId,
      title: extractTitle(video.transcript),
      description: generateDescription(video.transcript),
      transcript: video.transcript,
      wordCount: video.wordCount,
      estimatedDuration,
      keyTakeaways: extractKeyTakeaways(video.transcript),
      order: module.lessons.length + 1
    };

    module.lessons.push(lesson);
    module.estimatedDuration += estimatedDuration;
  }

  // Convert to array and sort
  const result = Array.from(modules.values())
    .filter(m => m.lessons.length > 0)
    .sort((a, b) => a.order - b.order);

  // Output summary
  console.log('\n=== MODULE SUMMARY ===\n');
  for (const module of result) {
    const hours = Math.floor(module.estimatedDuration / 3600);
    const minutes = Math.floor((module.estimatedDuration % 3600) / 60);
    console.log(`${module.title}: ${module.lessons.length} lessons (~${hours}h ${minutes}m)`);
  }

  // Write output
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`\nOutput written to: ${outputPath}`);

  // Also generate a summary JSON without full transcripts (for quick loading)
  const summary = result.map(module => ({
    ...module,
    lessons: module.lessons.map(lesson => ({
      id: lesson.id,
      videoId: lesson.videoId,
      title: lesson.title,
      description: lesson.description,
      estimatedDuration: lesson.estimatedDuration,
      keyTakeaways: lesson.keyTakeaways,
      order: lesson.order
    }))
  }));

  const summaryPath = outputPath.replace('.json', '-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Summary written to: ${summaryPath}`);
}

// Run the parser
const inputPath = process.argv[2] || '../uploads/KCU Raw-4c32f417.txt';
const outputPath = process.argv[3] || './data/curriculum.json';

// Ensure output directory exists
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

parseAndOrganize(inputPath, outputPath);
