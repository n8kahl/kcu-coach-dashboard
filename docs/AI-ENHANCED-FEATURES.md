# AI-Enhanced Features: Training Links & Visual Charts

This document describes the enhanced AI Coach features that link to training content and display visual charts/setups.

## Implementation Status: ✅ COMPLETE

The following features have been implemented:

| Feature | Status | Files |
|---------|--------|-------|
| Rich content types | ✅ Done | `src/types/index.ts` |
| Curriculum context for AI | ✅ Done | `src/lib/curriculum-context.ts` |
| Rich content parser | ✅ Done | `src/lib/rich-content-parser.ts` |
| LessonCard component | ✅ Done | `src/components/chat/rich-content.tsx` |
| InlineChart component | ✅ Done | `src/components/chat/rich-content.tsx` |
| SetupCard component | ✅ Done | `src/components/chat/rich-content.tsx` |
| QuizCard component | ✅ Done | `src/components/chat/rich-content.tsx` |
| Enhanced chat API | ✅ Done | `src/app/api/chat/route.ts` |
| AI Coach with rich content | ✅ Done | `src/components/chat/ai-coach.tsx` |

## How It Works

The AI Coach now:
- Links to relevant training lessons when explaining concepts
- Shows TradingView charts inline when discussing symbols
- Displays LTP setup visualizations with score bars
- Suggests quizzes for self-testing

## Enhanced Feature Overview

### 1. Training Content Linking

When users ask questions, the AI should:
- Reference specific lessons and modules
- Embed clickable links to relevant content
- Show "Learn More" cards for deep dives

**Example Interaction:**

```
User: "How do I identify a patience candle?"

AI: Great question! A patience candle confirms that price has
respected a level and the trend is continuing.

Look for these characteristics:
- Forms after price touches a key level
- Closes in the direction of your trade
- Has a wick rejection on the level side

📚 **Related Lessons:**
┌────────────────────────────────────────────┐
│ 🎓 Patience Candle Recognition             │
│    Module 3: LTP Framework • 12 min        │
│    [Watch Lesson →]                        │
├────────────────────────────────────────────┤
│ 🎓 Entry Confirmation Patterns             │
│    Module 6: Entry Rules • 8 min           │
│    [Watch Lesson →]                        │
└────────────────────────────────────────────┘
```

### 2. Visual Chart Widgets

When discussing setups or symbols, the AI should:
- Display TradingView mini charts inline
- Show LTP score visualizations
- Render setup diagrams with marked levels

**Example Interaction:**

```
User: "Show me a good LTP setup"

AI: Here's an A-grade LTP setup on AAPL from yesterday:

┌─────────────────────────────────────────────────────────┐
│  📈 AAPL - LTP Setup Example                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │          ╭────╮                                   │  │
│  │      ╭───╯    ╰──╮   ← Resistance @ 185.50       │  │
│  │  ╭───╯           ╰──╮                            │  │
│  │──╯  Patience        ╰─→ Entry @ 184.20          │  │
│  │     Candle ⬆                                     │  │
│  │  ─────────────────── Support @ 183.80           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  LTP Score: 92/100 (Grade A)                           │
│  ├── Level:    ████████████████░░░░ 95%               │
│  ├── Trend:    ███████████████░░░░░ 88%               │
│  └── Patience: █████████████████░░░ 92%               │
│                                                         │
│  [Open in TradingView] [Save to Journal]               │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Architecture

### Message Content Types

Extend the chat message format to support rich content:

```typescript
// src/types/chat.ts

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  richContent?: RichContent[];
}

type RichContent =
  | LessonLink
  | ChartWidget
  | SetupVisualization
  | QuizPrompt;

interface LessonLink {
  type: 'lesson_link';
  moduleId: string;
  lessonId: string;
  title: string;
  duration: string;
  description?: string;
}

interface ChartWidget {
  type: 'chart';
  symbol: string;
  interval: '1' | '5' | '15' | '60' | 'D';
  indicators?: string[];
  annotations?: ChartAnnotation[];
}

interface ChartAnnotation {
  type: 'horizontal_line' | 'arrow' | 'zone';
  price?: number;
  label: string;
  color: string;
}

interface SetupVisualization {
  type: 'setup';
  symbol: string;
  setupData: {
    direction: 'long' | 'short';
    entry: number;
    stop: number;
    target: number;
    ltpScore: {
      level: number;
      trend: number;
      patience: number;
      total: number;
      grade: string;
    };
    levels: {
      support: number[];
      resistance: number[];
    };
  };
}

interface QuizPrompt {
  type: 'quiz';
  quizId: string;
  title: string;
  description: string;
}
```

### Enhanced API Response

The chat API should return structured content:

```typescript
// src/app/api/chat/route.ts

// Add to system prompt:
const ENHANCED_SYSTEM_PROMPT = `
${SYSTEM_PROMPT}

CONTENT EMBEDDING INSTRUCTIONS:
When your response would benefit from visual or linked content, include
special markers that the frontend will render as rich components:

1. To link to a lesson, use:
   [[LESSON:module_id/lesson_id|Title|duration]]

2. To show a chart, use:
   [[CHART:SYMBOL|interval|indicators]]

3. To show a setup visualization, use:
   [[SETUP:SYMBOL|direction|entry|stop|target|level_score|trend_score|patience_score]]

4. To suggest a quiz, use:
   [[QUIZ:quiz_id|title]]

The curriculum structure is:
${JSON.stringify(CURRICULUM_SUMMARY, null, 2)}

Always link to relevant lessons when explaining concepts.
When discussing specific setups or trades, include visual representations.
`;

// Response includes both text and parsed rich content
return NextResponse.json({
  message: assistantMessage,
  richContent: parseRichContent(assistantMessage),
  conversationId: response.id,
});
```

### Frontend Rich Content Renderer

```typescript
// src/components/chat/rich-content.tsx

'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TradingViewWidget } from '@/components/charts/trading-view-widget';
import { LTPScoreBar } from '@/components/dashboard/ltp-score-bar';
import { BookOpen, TrendingUp, Target, Brain } from 'lucide-react';

interface RichContentRendererProps {
  content: RichContent[];
}

export function RichContentRenderer({ content }: RichContentRendererProps) {
  return (
    <div className="space-y-3 mt-3">
      {content.map((item, index) => {
        switch (item.type) {
          case 'lesson_link':
            return <LessonCard key={index} lesson={item} />;
          case 'chart':
            return <InlineChart key={index} chart={item} />;
          case 'setup':
            return <SetupCard key={index} setup={item} />;
          case 'quiz':
            return <QuizCard key={index} quiz={item} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: LessonLink }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-secondary)] border border-[var(--border-primary)]
                 hover:border-[var(--accent-primary-muted)] transition-colors"
    >
      <Link href={`/learning/${lesson.moduleId}/${lesson.lessonId}`}>
        <div className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--accent-primary-glow)]
                          flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-primary)] truncate">
              {lesson.title}
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              {lesson.duration}
            </p>
          </div>
          <span className="text-[var(--accent-primary)] text-sm">
            Watch →
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

function SetupCard({ setup }: { setup: SetupVisualization }) {
  const { symbol, setupData } = setup;
  const { ltpScore, entry, stop, target, direction } = setupData;

  const riskReward = Math.abs(target - entry) / Math.abs(entry - stop);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className={cn(
            "w-5 h-5",
            direction === 'long' ? 'text-green-400' : 'text-red-400'
          )} />
          <span className="font-bold text-[var(--text-primary)]">{symbol}</span>
          <span className={cn(
            "text-xs px-2 py-0.5",
            direction === 'long'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400'
          )}>
            {direction.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-[var(--accent-primary)]">
            {ltpScore.grade}
          </span>
          <span className="text-sm text-[var(--text-tertiary)]">
            {ltpScore.total}/100
          </span>
        </div>
      </div>

      {/* Mini TradingView Chart */}
      <div className="h-32 mb-3 bg-[var(--bg-primary)] border border-[var(--border-secondary)]">
        <TradingViewWidget
          symbol={symbol}
          interval="15"
          hideVolume
          compact
        />
      </div>

      {/* LTP Score Bars */}
      <div className="space-y-2 mb-3">
        <ScoreRow label="Level" score={ltpScore.level} />
        <ScoreRow label="Trend" score={ltpScore.trend} />
        <ScoreRow label="Patience" score={ltpScore.patience} />
      </div>

      {/* Trade Levels */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="bg-[var(--bg-primary)] p-2">
          <p className="text-[var(--text-tertiary)] text-xs">Entry</p>
          <p className="font-mono text-[var(--text-primary)]">${entry}</p>
        </div>
        <div className="bg-[var(--bg-primary)] p-2">
          <p className="text-[var(--text-tertiary)] text-xs">Stop</p>
          <p className="font-mono text-red-400">${stop}</p>
        </div>
        <div className="bg-[var(--bg-primary)] p-2">
          <p className="text-[var(--text-tertiary)] text-xs">Target</p>
          <p className="font-mono text-green-400">${target}</p>
        </div>
      </div>

      {/* R:R Badge */}
      <div className="mt-3 flex justify-between items-center">
        <span className="text-xs text-[var(--text-tertiary)]">
          Risk/Reward: {riskReward.toFixed(1)}R
        </span>
        <button className="text-xs text-[var(--accent-primary)] hover:underline">
          Open Full Chart →
        </button>
      </div>
    </motion.div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-tertiary)] w-16">{label}</span>
      <div className="flex-1 h-2 bg-[var(--bg-primary)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5 }}
          className={cn(
            "h-full",
            score >= 80 ? 'bg-green-500' :
            score >= 60 ? 'bg-yellow-500' :
            'bg-red-500'
          )}
        />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-8 text-right">
        {score}%
      </span>
    </div>
  );
}
```

---

## Curriculum Integration

### Add Curriculum Context to Chat API

```typescript
// src/lib/curriculum-context.ts

import { curriculum } from '@/data/curriculum';

export function getCurriculumSummary(): string {
  return curriculum.modules.map(mod => (
    `Module ${mod.order}: ${mod.title}\n` +
    mod.lessons.map(l => `  - ${l.title} (${l.duration})`).join('\n')
  )).join('\n\n');
}

export function findRelevantLessons(query: string): LessonReference[] {
  const keywords = query.toLowerCase().split(/\s+/);
  const matches: LessonReference[] = [];

  for (const module of curriculum.modules) {
    for (const lesson of module.lessons) {
      const searchText = `${lesson.title} ${lesson.keyTakeaways?.join(' ')}`.toLowerCase();
      const relevance = keywords.filter(k => searchText.includes(k)).length;

      if (relevance > 0) {
        matches.push({
          moduleId: module.id,
          lessonId: lesson.id,
          title: lesson.title,
          duration: lesson.duration,
          relevance,
        });
      }
    }
  }

  return matches.sort((a, b) => b.relevance - a.relevance).slice(0, 3);
}
```

### Enhanced System Prompt

```typescript
const SYSTEM_PROMPT = `You are the KCU Coach, an expert AI trading mentor...

AVAILABLE TRAINING CONTENT:
${getCurriculumSummary()}

LINKING INSTRUCTIONS:
When explaining concepts, ALWAYS include relevant lesson links using this format:
[[LESSON:module-id/lesson-id|Lesson Title|Duration]]

Examples:
- When discussing patience candles: [[LESSON:ltp-framework/patience-candles|Patience Candle Recognition|12 min]]
- When discussing entries: [[LESSON:entry-rules/confirmation-patterns|Entry Confirmation Patterns|8 min]]

CHART DISPLAY INSTRUCTIONS:
When the user asks to see a setup or analyze a symbol, include a chart:
[[CHART:AAPL|15|MA,VWAP]]

When showing a complete LTP setup, use:
[[SETUP:AAPL|long|185.50|184.20|188.00|95|88|92]]
Format: symbol|direction|entry|stop|target|level%|trend%|patience%

Always enhance your responses with visual content when it aids understanding.
`;
```

---

## User Flow Examples

### Flow 1: Learning Question with Lesson Link

```
User: "What's the difference between a patience candle and a confirmation candle?"

AI Response:
├── Text explanation of the concepts
├── [[LESSON:ltp-framework/patience-candles|Patience Candle Recognition|12 min]]
├── [[LESSON:ltp-framework/confirmation-types|Types of Confirmation|8 min]]
└── Suggested follow-up question
```

### Flow 2: Setup Request with Visual

```
User: "Show me what a good LTP setup looks like on SPY"

AI Response:
├── Brief explanation of what makes it good
├── [[CHART:SPY|15|MA,VWAP]]
├── [[SETUP:SPY|long|445.20|443.80|448.50|90|85|88]]
├── Key observations about the setup
└── [[LESSON:entry-rules/a-grade-setups|Identifying A-Grade Setups|15 min]]
```

### Flow 3: Trade Review with Chart

```
User: "Review my last trade on NVDA"

AI Response:
├── Fetches user's last NVDA trade from journal
├── [[CHART:NVDA|5|MA,VWAP]] with entry/exit annotations
├── LTP score breakdown analysis
├── What was done well
├── Areas for improvement
└── [[LESSON:psychology/trade-review-process|How to Review Your Trades|10 min]]
```

---

## Implementation Phases

### Phase 1: Curriculum Linking (2-3 days)
- [ ] Add curriculum context to chat API
- [ ] Create `[[LESSON:...]]` parser
- [ ] Build `LessonCard` component
- [ ] Update chat message renderer

### Phase 2: Basic Chart Integration (2-3 days)
- [ ] Create `[[CHART:...]]` parser
- [ ] Build `InlineChart` component (wrapper around TradingView widget)
- [ ] Add compact chart mode to existing widget
- [ ] Handle chart annotations

### Phase 3: Setup Visualization (3-4 days)
- [ ] Create `[[SETUP:...]]` parser
- [ ] Build `SetupCard` component with LTP score bars
- [ ] Connect to companion mode data when available
- [ ] Add "Save to Journal" functionality

### Phase 4: Interactive Features (2-3 days)
- [ ] Add quiz suggestions `[[QUIZ:...]]`
- [ ] Enable "practice this concept" from lessons
- [ ] Create companion mode deep links
- [ ] Add "Show me more examples" flow

---

## Technical Considerations

### Performance
- Lazy load TradingView widgets (only render when in viewport)
- Cache curriculum lookups
- Limit to 2-3 rich content items per message

### Mobile Responsiveness
- Chart widgets collapse to icon + "View Chart" button on mobile
- Lesson cards stack vertically
- Setup cards use accordion pattern on small screens

### Accessibility
- All charts have text descriptions
- Lesson links are keyboard navigable
- Score bars have aria-labels

### Error States
- Graceful fallback if TradingView fails to load
- Show "Lesson not found" if curriculum reference is invalid
- Display cached chart image if real-time data unavailable
