# Social Builder Quick Prompts

Copy and paste these directly to Claude Code. Execute in order.

---

## 🚀 PHASE 1: FOUNDATION (Start Here)

### Prompt 1: Tone Profile
```
Create the KCU brand voice profile for Social Builder content generation:

1. Create `src/lib/social/seed-tone-profile.ts` with:
   - Voice attributes (confident but humble, educational, discipline-focused, LTP framework)
   - preferred_phrases array (20+ on-brand phrases like "Trust the process")
   - avoided_phrases array (things to never say like "guaranteed profits")
   - hook_patterns (20+ proven hooks)
   - cta_patterns (10+ call-to-actions)
   - sample_posts (10 example posts in KCU voice)

2. Create `/api/admin/social/tone-profile/route.ts` with GET, PUT, and POST (seed action)

3. Auto-seed on first load if kcu_tone_profile table is empty

4. Add "Brand Voice" tab to the existing Settings Modal
```

### Prompt 2: Settings API
```
Fix the Settings Modal - it has no backend:

1. Create `/api/admin/social/settings/route.ts`:
   - GET: Fetch from social_builder_config
   - PUT: Update settings with validation

2. Settings categories: content_generation, scraping, publishing, notifications

3. Update SettingsModal component to use the API with loading/success/error states

4. Add a "Test Connection" button that verifies API keys are configured
```

### Prompt 3: System Status
```
Create environment validation and status dashboard:

1. Create `src/lib/social/env-validator.ts` - checks all API keys

2. Create `/api/admin/social/status/route.ts` - returns:
   - API key status (configured/missing)
   - Database connection status
   - Last operation timestamps

3. Add "System Status" card to Overview tab with:
   - Green/red indicators for each integration
   - Setup wizard banner if critical APIs missing
```

---

## 👥 PHASE 2: INFLUENCERS

### Prompt 4: Seed Influencers
```
Create seed data for tracking day trading influencers:

1. Create `src/lib/social/seed-influencers.ts` with 10-15 influencers:
   - Instagram: warrior_trading, humbledtrader, stockmarketz, traderstewie
   - TikTok: stocktok creators, tradertoks
   - YouTube: Warrior Trading, Humbled Trader channel IDs

2. Each profile needs: platform, handle, display_name, categories, priority, scrape_frequency_hours

3. Create API endpoint: POST /api/admin/social/influencers with action:'seed'

4. Create `src/components/social/influencer-manager.tsx`:
   - Grid view with quick stats
   - Bulk actions: scrape selected, change priority
```

### Prompt 5: Enhanced Scraping
```
Improve influencer scraping:

1. Update `src/lib/social/influencer-scraper.ts`:
   - Add retry logic (3 attempts with backoff)
   - Add rate limiting
   - Cache responses

2. Create `src/lib/social/post-analyzer.ts`:
   - Analyze posts for patterns
   - Extract: hook style, caption length, hashtag count
   - Identify: question posts, carousels, tutorials

3. Add "Post Analysis" view showing:
   - Content mix breakdown
   - Posting schedule heatmap
   - Best hashtags
```

---

## 📝 PHASE 3: CONTENT ENGINE

### Prompt 6: Enhanced Generator
```
Upgrade content generation:

1. Update `src/lib/social/content-generator.ts`:
   - Generate 3 variants (A/B/C) per piece
   - Include different hook styles
   - Vary caption lengths
   - Auto-generate platform-specific versions

2. Create `src/lib/social/content-templates.ts`:
   - Templates for: win celebrations, market commentary, educational tips, psychology, community highlights
   - Each template has structure and required data points

3. Add "Content Mix" setting:
   - Define ratio: 40% educational, 30% community, 20% market, 10% promo
   - Track actual mix vs target
```

### Prompt 7: Community Wins
```
Build community win harvester:

1. Create `src/lib/social/community-harvester.ts`:
   - Query trade_journal for wins (P&L > threshold, streaks)
   - Query user_profiles for achievements
   - Respect privacy (opt-in only)

2. Add to user_profiles:
   - social_sharing_consent column
   - featured_in_content tracking table

3. Create `src/components/social/community-wins.tsx`:
   - List eligible wins
   - Preview auto-generated content
   - One-click generate

4. Auto-triggers:
   - 10-day streak → celebration post
   - $1000+ trade → big win post
   - Course completion → graduate post
```

### Prompt 8: Market-Aware Content
```
Integrate market data for timely content:

1. Create `src/lib/social/market-content-triggers.ts`:
   - Monitor SPY/QQQ for moves > 1%
   - Track VIX spikes
   - Check economic calendar

2. Content triggers:
   - Gap > 0.5% → gap analysis content
   - VIX > 20 → volatility education
   - FOMC day → Fed prep content

3. Create "Market Events" panel:
   - Upcoming events
   - Current status indicators
   - "Generate Content" per event
```

---

## 📊 PHASE 4: LEARNING SYSTEM

### Prompt 9: Engagement Tracking
```
Build engagement tracking for feedback loop:

1. Create tables:
   - content_performance (impressions, likes, comments, engagement_rate)
   - content_experiments (A/B test tracking)

2. Create `src/lib/social/performance-tracker.ts`:
   - Fetch metrics from platforms
   - Calculate engagement rates
   - Identify top/bottom performers

3. Create `/api/admin/social/performance/route.ts`

4. Build `src/components/social/performance-dashboard.tsx`:
   - Charts: engagement over time, by platform
   - Leaderboard of top posts
   - AI insights about patterns
```

### Prompt 10: Voice Learning
```
Implement self-improving voice model:

1. Create `src/lib/social/voice-learner.ts`:
   - Analyze approved content (positive signal)
   - Analyze rejected content (negative signal)
   - Weight high engagement as strong positive
   - Update tone profile based on learnings

2. Track pattern effectiveness:
   - Hook patterns: which styles get engagement
   - Hashtag sets: which combinations work
   - Caption length: optimal by platform
   - Posting time: best times

3. Add "Learning Insights" panel:
   - "Question hooks outperform statements by 34%"
   - "8-12 hashtags get 2x reach"
   - Confidence scores for each insight
```

---

## 📅 PHASE 5: SCHEDULING

### Prompt 11: Content Queue
```
Build scheduling system:

1. Create table:
   - content_queue (suggestion_id, platform, scheduled_for, status, published_at)

2. Create `src/lib/social/content-scheduler.ts`:
   - Add to queue with scheduled time
   - Optimal time suggestions
   - Conflict detection

3. Create `/api/admin/social/queue/route.ts`

4. Build `src/components/social/content-calendar.tsx`:
   - Calendar view (week/month)
   - Drag-and-drop rescheduling
   - Color by platform
   - "Optimal times" overlay
```

### Prompt 12: Cron Jobs
```
Set up background jobs:

1. Create cron endpoints in /api/cron/social/:
   - scrape-influencers (hourly)
   - aggregate-trending (every 4 hours)
   - process-queue (every 15 min)
   - update-metrics (daily)

2. Each endpoint:
   - Verifies CRON_SECRET
   - Logs start/end
   - Handles errors gracefully

3. Add admin job monitoring:
   - Job history
   - Manual trigger buttons
   - Error logs
```

---

## ✨ PHASE 6: ADVANCED

### Prompt 13: AI Editor
```
Build AI content editor:

1. Create `src/components/social/ai-content-editor.tsx`:
   - Full-screen modal
   - Original vs edited side-by-side
   - Character count per platform

2. AI actions:
   - "Make shorter"
   - "Make punchier"
   - "Add question"
   - "Change hook" (3 alternatives)
   - "Suggest hashtags"

3. Create `/api/admin/social/edit/route.ts`

4. Add version history with revert
```

### Prompt 14: Analytics Dashboard
```
Build analytics:

1. Create `src/components/social/analytics-dashboard.tsx`:
   - Date range selector
   - Key metrics cards
   - Comparison to previous period

2. Charts:
   - Engagement over time
   - Content type performance
   - Best days/times heatmap
   - Hashtag performance

3. AI insights section:
   - "Engagement up 23% due to..."
   - "Post more carousels based on..."
```

---

## ⚡ FASTEST PATH

Execute in this exact order for quickest working system:

| Day | Prompts | Result |
|-----|---------|--------|
| 1 | 1, 2 | Settings + tone working |
| 2 | 3, 4 | Status + influencers seeded |
| 3 | 6, 7 | Enhanced generation + community wins |
| 4 | 9, 11 | Tracking + scheduling |
| 5 | 12, 13 | Automation + editor |

---

## Tips

- Run each prompt fully before moving to next
- Check existing code - lots is already built
- Update types in `src/types/social.ts`
- Add new env vars to `.env.example`
- Test after each prompt
