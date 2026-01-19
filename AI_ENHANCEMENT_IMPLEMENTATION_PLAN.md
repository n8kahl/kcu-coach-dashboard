# KCU Coach Dashboard: AI Enhancement Implementation Plan

## Executive Summary

This document provides a comprehensive implementation, testing, and deployment plan for the AI-First Transformation Vision as documented in `AI_TRANSFORMATION_VISION.md`. The goal is to consolidate 6 fragmented AI touchpoints into a unified **AI Command Center** that serves as the central nervous system for the entire application.

---

## Current State Analysis

### Existing AI Components (6 Fragmented Touchpoints)

| # | Component | Location | API | Status |
|---|-----------|----------|-----|--------|
| 1 | Floating AI Coach | `src/components/chat/ai-coach.tsx` | `/api/chat` | Working (hidden) |
| 2 | AI Coach Page | `/coach` route | `/api/coach/chat` | Working (redundant) |
| 3 | Companion AI Chat | `/companion` page | `/api/companion/messages` | Working, context-aware |
| 4 | Practice AI Coaching | `/practice` scenarios | `/api/practice/submit` | Excellent, LTP-aware |
| 5 | Social Content AI | `/admin/social-builder` | `/api/admin/social/generate` | Admin only |
| 6 | Setup Coach Notes | Companion detected setups | Inline | Static |

### Existing Strengths to Build Upon
- ✅ Anthropic Claude API integration (claude-sonnet-4)
- ✅ RAG system with pgvector embeddings
- ✅ Rich content parsing (LESSON, CHART, SETUP, QUIZ, VIDEO, THINKIFIC markers)
- ✅ User context injection (trades, progress, streaks)
- ✅ Practice AI coaching with LTP analysis
- ✅ Curriculum context integration

### Gaps to Address
- ❌ No unified AI context across pages
- ❌ 3 separate chat APIs doing similar things
- ❌ AI Coach navigation goes to separate page, not panel
- ❌ Floating button + dedicated page = redundant
- ❌ Keyword-based search throughout
- ❌ No real-time market Q&A
- ❌ No proactive AI suggestions

---

## Implementation Plan

### Phase 1: Foundation - AI Command Center Infrastructure (2 weeks)

#### 1.1 Create AI Context System

**Files to Create:**
```
src/components/ai/
├── AIContextProvider.tsx      # Global context provider
├── hooks/
│   ├── useAIContext.ts        # Hook for reading AI context
│   └── usePageContext.ts      # Hook for page-specific data
src/lib/ai-context.ts          # Context utilities
src/types/ai.ts                # AI-specific TypeScript types
```

**AIContext Interface:**
```typescript
interface AIContext {
  // Page Awareness
  currentPage: 'overview' | 'journal' | 'learning' | 'coach' | 'companion' | 'practice' | 'achievements' | 'leaderboard' | 'admin/*';
  pageData: PageSpecificData;

  // Selection Awareness
  selectedTrade?: TradeEntry;
  selectedLesson?: Lesson;
  selectedSymbol?: string;
  selectedSetup?: DetectedSetup;
  selectedScenario?: PracticeScenario;

  // User State
  user: UserProfile;
  recentTrades: TradeEntry[];
  learningProgress: ModuleProgress[];
  achievements: Achievement[];
  practiceStats: PracticeStats;

  // Market State
  marketContext?: {
    spyPrice: number;
    spyTrend: 'bullish' | 'bearish' | 'neutral';
    keyLevelsNearby: Level[];
    marketStatus: 'pre' | 'open' | 'after' | 'closed';
  };

  // Admin Context
  adminContext?: AdminContext;
}
```

**Tasks:**
- [ ] Create `src/types/ai.ts` with all AI-related types
- [ ] Create `src/lib/ai-context.ts` with context utilities
- [ ] Create `AIContextProvider.tsx` component
- [ ] Create `useAIContext.ts` hook
- [ ] Create `usePageContext.ts` hook
- [ ] Wrap dashboard layout with AIContextProvider

#### 1.2 Build AI Command Center Panel

**Files to Create:**
```
src/components/ai/
├── AICommandCenter.tsx        # Main right-panel component
├── AIChatInterface.tsx        # Chat UI with streaming
├── AIQuickActions.tsx         # Context-aware action buttons
├── AIHeader.tsx               # Panel header with context info
└── AIMessageList.tsx          # Message history display
```

**Component Specifications:**
- **AICommandCenter**: 400px wide right panel (collapsible to 56px icon strip)
- **Layout**: Context indicator → Quick Actions → Chat → Market Intel (optional)
- **States**: collapsed (icon), expanded (full panel), focused (wider for complex tasks)

**Tasks:**
- [ ] Create AICommandCenter base component with slide-out animation
- [ ] Create AIHeader showing current page/selection context
- [ ] Create AIQuickActions with context-aware buttons
- [ ] Create AIChatInterface with message history and input
- [ ] Add keyboard shortcut (Cmd+J) to toggle panel
- [ ] Add mobile-responsive behavior (full-screen on mobile)

#### 1.3 Unified AI API Endpoint

**Files to Create:**
```
src/app/api/ai/
├── unified/route.ts           # Main unified AI endpoint
├── search/route.ts            # Semantic search endpoint
├── action/route.ts            # Quick action endpoint
└── suggestions/route.ts       # Proactive suggestions endpoint
```

**Unified API Design:**
```typescript
// POST /api/ai/unified
interface UnifiedAIRequest {
  message: string;
  mode: 'chat' | 'search' | 'action' | 'analyze';
  context: AIContext;
  conversationHistory?: Message[];
}

interface UnifiedAIResponse {
  message: string;
  richContent?: RichContent[];
  suggestions?: string[];
  sources?: RAGSource[];
  actions?: QuickAction[];
}
```

**Tasks:**
- [ ] Create `/api/ai/unified/route.ts` with consolidated logic
- [ ] Build context-aware system prompt generator
- [ ] Implement mode-specific response handling
- [ ] Add streaming support for long responses
- [ ] Create response caching layer (5min TTL)
- [ ] Add token usage tracking

#### 1.4 Navigation & Layout Updates

**Files to Modify:**
```
src/components/layout/sidebar.tsx      # Change AI Coach to panel toggle
src/app/(dashboard)/layout.tsx         # Add AICommandCenter to layout
```

**Tasks:**
- [ ] Update sidebar: "AI Coach" link becomes panel toggle button
- [ ] Remove `/coach` page navigation (redirect to panel toggle)
- [ ] Add AICommandCenter to dashboard layout (right side)
- [ ] Update layout grid to accommodate panel when open
- [ ] Add global state for panel visibility

---

### Phase 2: Semantic Search (2 weeks)

#### 2.1 Search Infrastructure

**Files to Create:**
```
src/components/ai/AISearchBar.tsx      # AI-powered search component
src/lib/semantic-search.ts             # Search utilities
src/hooks/useSemanticSearch.ts         # Search hook
src/app/api/ai/search/route.ts         # Search API
```

**Semantic Search Features:**
- Natural language query interpretation
- Multi-scope search (trades, lessons, setups, all)
- Ranked results with relevance scores
- Search suggestions and refinements

**Tasks:**
- [ ] Create search intent parser using Claude
- [ ] Build semantic search API endpoint
- [ ] Implement trade-specific search (e.g., "trades where I entered too early")
- [ ] Implement lesson search (e.g., "content about patience candles")
- [ ] Create AISearchBar UI component
- [ ] Add search result rendering with rich content

#### 2.2 Replace Keyword Search Throughout App

**Files to Modify:**
```
src/components/dashboard/trade-journal-table.tsx  # Replace search
src/components/learn/TranscriptPanel.tsx          # Replace search
src/components/social/influencer-list.tsx         # Replace search
src/components/social/trending-topics.tsx         # Replace filters
src/components/navigation/command-palette.tsx     # AI-powered version
```

**Tasks:**
- [ ] Replace Trade Journal search with semantic search
- [ ] Replace Learning Hub search with semantic search
- [ ] Replace Admin search components
- [ ] Update Command Palette to use AI-powered search
- [ ] Add "No results? Ask AI" fallback for all search

---

### Phase 3: Context-Aware Quick Actions (1 week)

#### 3.1 Quick Actions System

**Files to Create:**
```
src/components/ai/AIQuickActions.tsx
src/lib/quick-actions.ts
src/app/api/ai/action/route.ts
```

**Context-Aware Actions by Page:**

| Page | Quick Actions |
|------|---------------|
| **Overview** | Daily Briefing, Review Week, What to Study, Identify Patterns |
| **Journal** | Analyze Trade, Grade LTP, Find Similar, Watch Related Lesson |
| **Learning** | Resume Learning, Test Knowledge, Explain Concept, Show Example |
| **Practice** | Get Hint, Explain This Setup, Try Similar, Review Mistakes |
| **Companion** | Analyze Setup, Grade Level, What's the Trend?, When to Enter? |
| **Admin** | Generate Caption, Find Trending, Analyze Competitors, Best Post Time |

**Tasks:**
- [ ] Create quick action registry with page mappings
- [ ] Build AIQuickActions component with dynamic buttons
- [ ] Implement action handler API endpoint
- [ ] Add action response rendering
- [ ] Create loading states for actions
- [ ] Add action analytics tracking

---

### Phase 4: Real-Time Market Intelligence (2 weeks)

#### 4.1 Market Q&A System

**Files to Create:**
```
src/components/ai/AIMarketIntel.tsx
src/app/api/ai/market/route.ts
src/lib/market-intelligence.ts
```

**Features:**
- Real-time market questions ("What's SPY doing?")
- Key level alerts ("SPY just hit resistance at 483")
- Patience candle detection
- Multi-symbol analysis

**Tasks:**
- [ ] Create AIMarketIntel component for market status panel
- [ ] Build market Q&A API endpoint
- [ ] Integrate with Massive.com API for real-time data
- [ ] Add key level proximity alerts
- [ ] Implement patience candle detection stream
- [ ] Create market context injection for AI responses

#### 4.2 Live Market Context in Chat

**Tasks:**
- [ ] Add real-time SPY/QQQ status to AI context
- [ ] Inject nearby key levels into system prompt
- [ ] Enable "What's happening with [SYMBOL]?" queries
- [ ] Add market hours awareness to responses

---

### Phase 5: Proactive AI Suggestions (1 week)

#### 5.1 Suggestion Engine

**Files to Create:**
```
src/components/ai/AISuggestions.tsx
src/app/api/ai/suggestions/route.ts
src/lib/suggestion-triggers.ts
```

**Suggestion Triggers:**
```typescript
const suggestionTriggers = {
  afterLosingTrade: "I noticed you just logged a losing trade. Want me to analyze what happened?",
  patternDetected: "Looking at your last 10 trades, you're entering early. Want to work on patience?",
  moduleCompleted: "You finished LTP Framework! Ready for a quiz?",
  marketSetup: "SPY hit your 483 level with a patience candle forming!",
  streakRisk: "You're on a 7-day streak! Don't forget to log in tomorrow.",
  weakAreaIdentified: "Your trend analysis scores are lower than average. Want targeted practice?",
};
```

**Tasks:**
- [ ] Create suggestion trigger system
- [ ] Build AISuggestions component (dismissible cards)
- [ ] Implement suggestion API endpoint
- [ ] Add suggestion frequency limiting (max 3/session)
- [ ] Create user preference for suggestion types
- [ ] Add suggestion analytics

---

### Phase 6: Polish & Advanced Features (2 weeks)

#### 6.1 Voice Commands (Optional)

**Files to Create:**
```
src/components/ai/AIVoiceInput.tsx
src/hooks/useVoiceCommands.ts
```

**Tasks:**
- [ ] Integrate Web Speech API
- [ ] Create voice activation button
- [ ] Implement voice-to-text conversion
- [ ] Add voice command shortcuts
- [ ] Create voice feedback (optional TTS responses)

#### 6.2 Performance & Polish

**Tasks:**
- [ ] Add response streaming with typing indicator
- [ ] Implement context payload compression
- [ ] Add error boundaries for AI components
- [ ] Create graceful degradation when AI unavailable
- [ ] Add keyboard navigation throughout
- [ ] Polish animations and transitions
- [ ] Mobile responsiveness testing

#### 6.3 Cleanup & Deprecation

**Files to Remove (after migration):**
```
src/app/(dashboard)/coach/page.tsx           # Full page → panel
src/components/chat/ai-coach.tsx             # Floating button → panel
```

**Files to Redirect:**
```
src/app/(dashboard)/coach/page.tsx           # Redirect to panel toggle
```

**Tasks:**
- [ ] Add deprecation notices to old AI endpoints
- [ ] Create redirect from /coach to panel toggle
- [ ] Remove floating AI button
- [ ] Consolidate 3 chat APIs into 1
- [ ] Update all documentation

---

## Testing Strategy

### Unit Tests

**Test Coverage Requirements:**
- AI Context Provider: 90%
- Quick Actions: 85%
- Search Functions: 90%
- API Routes: 80%

**Files to Create:**
```
src/__tests__/ai/
├── AIContextProvider.test.tsx
├── AICommandCenter.test.tsx
├── AIQuickActions.test.tsx
├── AISearchBar.test.tsx
├── useAIContext.test.ts
├── useSemanticSearch.test.ts
└── api/
    ├── unified.test.ts
    ├── search.test.ts
    └── suggestions.test.ts
```

**Test Cases:**

1. **AIContextProvider Tests**
   - [ ] Context initializes with correct default values
   - [ ] Context updates when page changes
   - [ ] Context reflects selected items correctly
   - [ ] Context persists across re-renders

2. **AICommandCenter Tests**
   - [ ] Panel opens/closes correctly
   - [ ] Keyboard shortcut (Cmd+J) works
   - [ ] Panel respects collapsed/expanded state
   - [ ] Context header shows correct page info

3. **AIQuickActions Tests**
   - [ ] Actions change based on current page
   - [ ] Action buttons render correctly
   - [ ] Loading states show during action execution
   - [ ] Error states handled gracefully

4. **Search Tests**
   - [ ] Semantic search returns relevant results
   - [ ] Search handles empty queries
   - [ ] Search respects scope filters
   - [ ] Suggestions appear after search

5. **API Tests**
   - [ ] Unified API handles all modes
   - [ ] Authentication required for all endpoints
   - [ ] Rate limiting works correctly
   - [ ] Error responses are standardized

### Integration Tests

**Test Scenarios:**

1. **User Flow: Trade Analysis**
   ```
   User on Journal page → Selects trade → Opens AI panel →
   Sees "Analyze Trade" quick action → Clicks action →
   Receives LTP breakdown with lesson links
   ```

2. **User Flow: Learning Support**
   ```
   User on Learning page → Watching video → Opens AI panel →
   Asks "Explain patience candles" → Receives explanation →
   Clicks lesson link → Video jumps to timestamp
   ```

3. **User Flow: Practice Coaching**
   ```
   User on Practice page → Submits decision → AI feedback appears →
   Feedback includes related lesson → User clicks lesson →
   Progress tracked correctly
   ```

4. **User Flow: Market Question**
   ```
   User on Companion page → Opens AI panel →
   Asks "What's SPY doing?" → Receives real-time analysis →
   Chart displayed with key levels marked
   ```

### E2E Tests

**Critical Paths:**
```
src/__tests__/e2e/
├── ai-command-center.spec.ts
├── semantic-search.spec.ts
├── quick-actions.spec.ts
└── cross-feature-flow.spec.ts
```

**Test Coverage:**
- [ ] Open/close AI panel from any page
- [ ] Complete trade analysis flow
- [ ] Complete learning assistance flow
- [ ] Semantic search across all content types
- [ ] Quick actions on each page type
- [ ] Mobile responsiveness

### Performance Tests

**Metrics to Track:**
| Metric | Target | Tool |
|--------|--------|------|
| AI Panel Open Time | < 200ms | Lighthouse |
| First AI Response | < 2s | Custom timer |
| Search Results | < 500ms | Custom timer |
| Context Update | < 100ms | React Profiler |
| Memory Usage | < 50MB | Chrome DevTools |

**Load Tests:**
- [ ] Concurrent AI requests (100 users)
- [ ] Rapid context switching (10 pages/second)
- [ ] Large conversation history (100 messages)
- [ ] Search under load (50 concurrent searches)

---

## Deployment Plan

### Pre-Deployment Checklist

**Environment Setup:**
- [ ] All environment variables configured in Railway
- [ ] ANTHROPIC_API_KEY verified
- [ ] Redis connection verified
- [ ] Supabase pgvector extension enabled

**Code Quality:**
- [ ] Zero TypeScript errors (`npm run build`)
- [ ] All tests passing (`npm test`)
- [ ] ESLint clean (`npm run lint`)
- [ ] No console errors in browser

### Deployment Phases

#### Phase 1: Soft Launch (Week 1)

**Strategy:** Deploy AI Command Center alongside existing AI features

**Steps:**
1. Deploy with feature flag: `AI_COMMAND_CENTER_ENABLED=true`
2. Roll out to admin users only (50 users)
3. Monitor error rates and performance
4. Collect feedback via in-app survey

**Rollback Criteria:**
- Error rate > 5%
- Average response time > 5s
- Negative user feedback > 30%

**Monitoring:**
```typescript
// Key metrics to track
const deploymentMetrics = {
  aiPanelOpens: 'count',
  aiResponses: 'count',
  aiErrors: 'count',
  avgResponseTime: 'timing',
  userSatisfaction: 'rating',
};
```

#### Phase 2: Beta Release (Week 2-3)

**Strategy:** Enable for 50% of users, keep old AI as fallback

**Steps:**
1. Remove admin-only restriction
2. A/B test: 50% new panel, 50% old floating button
3. Compare engagement metrics
4. Iterate based on feedback

**Success Criteria:**
- AI interaction rate increases
- Questions per session increases
- No regression in Practice AI performance

#### Phase 3: Full Release (Week 4)

**Strategy:** New AI Command Center for all users, deprecate old

**Steps:**
1. Enable for 100% of users
2. Remove old floating button
3. Redirect /coach page to panel toggle
4. Archive old AI endpoints (keep for 30 days)
5. Update documentation

**Communication:**
- [ ] In-app announcement
- [ ] Email to all users
- [ ] Update help documentation
- [ ] Create video walkthrough

### Post-Deployment

**Monitoring Dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│  AI COMMAND CENTER METRICS                              │
├─────────────────────────────────────────────────────────┤
│  Daily Active AI Users:     ████████░░ 847 (82%)       │
│  Avg Questions/Session:     ████████████░░ 6.2         │
│  Quick Action Usage:        ██████░░░░ 3.1/session     │
│  Search Queries:            ████████░░ 412 today       │
│  Avg Response Time:         ████░░░░░░ 1.8s            │
│  Error Rate:                ░░░░░░░░░░ 0.3%            │
│  User Satisfaction:         ████████░░ 4.2/5           │
└─────────────────────────────────────────────────────────┘
```

**Alert Thresholds:**
| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 2% | > 5% |
| Response Time | > 3s | > 5s |
| API Failures | > 10/min | > 50/min |

---

## Success Metrics

### User Engagement
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| AI Interaction Rate | ~30% | 80%+ | 3 months |
| Questions per Session | ~1.5 | 5+ | 3 months |
| Quick Action Usage | N/A | 3+/session | 3 months |

### Learning Outcomes
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Module Completion Rate | 45% | 65% | 6 months |
| Practice Accuracy | 62% | 75% | 3 months |
| Time to First Trade Analysis | 5 min | 1 min | 1 month |

### Search Quality
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Zero-Result Searches | ~15% | < 2% | 2 months |
| Search-to-Result Time | 3s | < 1s | 1 month |
| Search Refinement Rate | 40% | < 15% | 2 months |

### Technical
| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| AI Response Time | 2.5s | < 2s | 1 month |
| API Error Rate | 1.5% | < 0.5% | 1 month |
| Context Switch Time | N/A | < 100ms | Launch |

---

## Resource Requirements

### Development Time
| Phase | Duration | Developer Days |
|-------|----------|----------------|
| Phase 1: Foundation | 2 weeks | 10 days |
| Phase 2: Semantic Search | 2 weeks | 10 days |
| Phase 3: Quick Actions | 1 week | 5 days |
| Phase 4: Market Intel | 2 weeks | 10 days |
| Phase 5: Suggestions | 1 week | 5 days |
| Phase 6: Polish | 2 weeks | 10 days |
| **Total** | **10 weeks** | **50 days** |

### API Costs (Estimated)
| Usage | Monthly Cost |
|-------|-------------|
| Claude API (1000 users × 5 queries × 30 days) | ~$150-300 |
| Massive.com API (market data) | ~$50-100 |
| Supabase (existing) | ~$25 |
| Redis (existing) | ~$10 |
| **Total** | ~$235-435/month |

---

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Claude API rate limits | Medium | High | Implement caching, queue requests |
| Context too large | Low | Medium | Compress context, send deltas only |
| Mobile performance | Medium | Medium | Lazy load, optimize renders |
| Search accuracy | Medium | High | Human review, feedback loop |

### User Experience Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Users miss floating button | Medium | Low | Prominent panel toggle, onboarding |
| Too many suggestions | Medium | Medium | Frequency limits, preferences |
| AI responses too slow | Medium | High | Streaming, progress indicators |
| Context confusion | Low | Medium | Clear context indicator in panel |

---

## Appendix: File Structure Summary

### New Files to Create (34 files)
```
src/
├── components/ai/
│   ├── AICommandCenter.tsx
│   ├── AIContextProvider.tsx
│   ├── AIChatInterface.tsx
│   ├── AIQuickActions.tsx
│   ├── AIMarketIntel.tsx
│   ├── AISearchBar.tsx
│   ├── AISuggestions.tsx
│   ├── AIHeader.tsx
│   ├── AIMessageList.tsx
│   ├── AIVoiceInput.tsx (Phase 6)
│   └── hooks/
│       ├── useAIContext.ts
│       ├── usePageContext.ts
│       └── useSemanticSearch.ts
├── app/api/ai/
│   ├── unified/route.ts
│   ├── search/route.ts
│   ├── action/route.ts
│   ├── market/route.ts
│   └── suggestions/route.ts
├── lib/
│   ├── ai-context.ts
│   ├── semantic-search.ts
│   ├── quick-actions.ts
│   ├── suggestion-triggers.ts
│   └── market-intelligence.ts
├── types/
│   └── ai.ts
└── __tests__/ai/
    ├── AIContextProvider.test.tsx
    ├── AICommandCenter.test.tsx
    ├── AIQuickActions.test.tsx
    ├── AISearchBar.test.tsx
    ├── useAIContext.test.ts
    ├── useSemanticSearch.test.ts
    └── api/
        ├── unified.test.ts
        ├── search.test.ts
        └── suggestions.test.ts
```

### Files to Modify (10 files)
```
src/components/layout/sidebar.tsx
src/app/(dashboard)/layout.tsx
src/app/api/chat/route.ts
src/components/dashboard/trade-journal-table.tsx
src/components/learn/TranscriptPanel.tsx
src/components/social/influencer-list.tsx
src/components/social/trending-topics.tsx
src/components/navigation/command-palette.tsx
```

### Files to Remove (after migration)
```
src/app/(dashboard)/coach/page.tsx
src/components/chat/ai-coach.tsx
```

---

## Next Steps

1. **Review this plan** and provide feedback on priorities
2. **Confirm Phase 1 scope** - validate AI Command Center approach
3. **Begin implementation** with Phase 1 foundation components
4. **Set up testing infrastructure** for AI components
5. **Create deployment pipeline** with feature flags

---

*Document Version: 1.0*
*Created: January 19, 2026*
*Last Updated: January 19, 2026*
