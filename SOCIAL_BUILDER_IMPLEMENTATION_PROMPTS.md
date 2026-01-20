# KCU Social Builder - Complete Implementation Prompts

These prompts are designed to be given to Claude Code in sequence. Each prompt builds on the previous work and can be executed independently.

---

## Phase 1: Foundation & Data Setup

### Prompt 1.1: KCU Tone Profile Setup
```
I need you to create the KCU brand voice profile for the Social Builder. This is critical for AI content generation.

Create a database seed file at `src/lib/social/seed-tone-profile.ts` that:

1. Defines KCU's brand voice with these attributes:
   - Confident but humble (never arrogant)
   - Educational without being condescending
   - Celebrates discipline and process over quick wins
   - Uses the LTP (Level, Trend, Patience) framework as core teaching
   - Authentic and relatable - acknowledges losses happen
   - Community-focused - celebrates member wins

2. Include arrays for:
   - preferred_phrases: ["Trust the process", "Discipline over emotion", "LTP setup", "The market will be there tomorrow", etc.]
   - avoided_phrases: ["Get rich quick", "Easy money", "Guaranteed profits", "100% win rate", etc.]
   - emoji_style: "minimal" (professional, not spammy)
   - hook_patterns: Array of 20+ proven hook templates
   - cta_patterns: Array of 10+ call-to-action templates
   - sample_posts: 10 example posts that embody the KCU voice

3. Create an API route at `/api/admin/social/tone-profile/route.ts` with:
   - GET: Fetch the current tone profile
   - PUT: Update tone profile settings
   - POST with action 'seed': Initialize/reset to defaults

4. Update the Settings Modal to include a "Brand Voice" tab that allows editing key tone parameters.

Make sure to run the seed on first load if the tone profile doesn't exist.
```

### Prompt 1.2: Settings API Route
```
The Social Builder settings modal saves settings but there's no dedicated API route. Fix this:

1. Create `/api/admin/social/settings/route.ts` with:
   - GET: Fetch all settings from social_builder_config table
   - PUT: Update settings (validate against allowed keys)
   - POST: Batch update multiple settings

2. Settings should include:
   - content_generation: { default_platforms, default_count, include_trending, include_influencer_posts, include_kcu_data }
   - scraping: { frequency_hours, posts_per_scrape, max_influencers }
   - publishing: { require_approval, auto_schedule, default_schedule_time }
   - notifications: { notify_on_generation, notify_on_publish, email_recipients }

3. Update the SettingsModal component to:
   - Fetch settings on open
   - Save via the new API route
   - Show loading/success/error states
   - Add validation for numeric fields

4. Add a "Test Connection" button for each platform that verifies API keys are configured.
```

### Prompt 1.3: Environment Variable Validation
```
Create a utility to validate and report on required environment variables for the Social Builder.

1. Create `src/lib/social/env-validator.ts` with:
   - Function to check all required API keys
   - Return status for each: configured, missing, or invalid
   - Categories: required (Anthropic), recommended (RapidAPI, TikAPI), optional (NewsAPI)

2. Create `/api/admin/social/status/route.ts` that returns:
   - API key status (without exposing actual keys)
   - Database connection status
   - Last successful operations (scrape, generate, publish)
   - Any errors from recent operations

3. Add a "System Status" card to the Social Builder overview tab showing:
   - Green/yellow/red indicators for each integration
   - "Configure" links that open the appropriate settings
   - Last sync times for each data source

4. If critical APIs are missing, show a setup wizard banner at the top of the page.
```

---

## Phase 2: Influencer Intelligence

### Prompt 2.1: Seed Influencer Profiles
```
Create seed data for tracking day trading influencers across platforms.

1. Create `src/lib/social/seed-influencers.ts` with profiles for:

   Instagram:
   - @warrior_trading (Ross Cameron) - Large account, educational focus
   - @humbledtrader (Shay) - Relatable, psychology-focused
   - @stockmarketz - Chart analysis, technical setups
   - @daytradingzach - Beginner-friendly content
   - @traderstewie - Swing trading, market commentary

   TikTok:
   - @stocktok (various creators) - Viral trading content
   - @tradertoks - Educational shorts
   - @optionsmillionaire - Options-focused

   YouTube (channel IDs):
   - Warrior Trading
   - Humbled Trader
   - ZipTrader

2. For each influencer, include:
   - platform, handle, display_name
   - categories: ["education", "psychology", "technical", "entertainment"]
   - priority: 1-5 (how closely to monitor)
   - scrape_frequency_hours: 12-48 based on posting frequency
   - tags for content themes

3. Create a management UI component `src/components/social/influencer-manager.tsx`:
   - Grid view of all influencers with avatars
   - Quick stats: followers, engagement rate, last scraped
   - Bulk actions: scrape selected, change priority, deactivate
   - Import/export influencer list as JSON

4. Add the seed function to run via API: POST /api/admin/social/influencers with action: 'seed'
```

### Prompt 2.2: Enhanced Influencer Scraping
```
Improve the influencer scraping system to be more robust and informative.

1. Update `src/lib/social/influencer-scraper.ts`:
   - Add retry logic with exponential backoff (3 attempts)
   - Add rate limiting to respect API quotas
   - Cache responses to avoid redundant API calls
   - Extract more metadata: post type, music/audio used, collaboration tags

2. Create `src/lib/social/post-analyzer.ts`:
   - Analyze scraped posts for content patterns
   - Extract: hook style, caption length, hashtag count, emoji usage
   - Identify: question posts, carousel posts, before/after, tutorials
   - Calculate: estimated production value (simple vs edited)

3. Add a "Post Analysis" view for each influencer showing:
   - Content mix breakdown (reels vs posts vs stories)
   - Best performing content types
   - Posting schedule heatmap (day/time)
   - Hashtag frequency analysis
   - Hook pattern extraction

4. Create a scraping queue system:
   - Use a simple database queue table
   - Process influencers based on priority and last_scraped
   - Run via cron job every hour
   - Log all scrape attempts with success/failure status
```

### Prompt 2.3: Competitive Analysis Dashboard
```
Build a competitive analysis feature that compares KCU's social performance to influencers.

1. Create `src/components/social/competitive-analysis.tsx`:
   - Side-by-side comparison cards
   - Metrics: followers, engagement rate, posting frequency, avg likes/comments
   - Trend indicators (up/down arrows with percentages)
   - "Content to Emulate" section showing their top posts

2. Create `/api/admin/social/competitive/route.ts`:
   - GET: Fetch comparison data for specified influencers
   - POST: Generate AI analysis of competitive gaps
   - Returns: gaps[], opportunities[], recommendations[]

3. Add an "Insights" panel that shows:
   - "Competitor X gets 3x more comments by asking questions in captions"
   - "Top performers post 2x more reels than static images"
   - "These hashtags work well for competitors but KCU doesn't use them"

4. Create a "Copy Strategy" button that:
   - Takes a competitor's top post
   - Generates a KCU-voiced version of similar content
   - Adds to suggestions queue for review
```

---

## Phase 3: Content Generation Engine

### Prompt 3.1: Enhanced Content Generator
```
Upgrade the content generation system to be more intelligent and varied.

1. Update `src/lib/social/content-generator.ts` to:
   - Generate 3 variants of each piece of content (A/B/C testing)
   - Include different hook styles: question, statistic, controversy, story
   - Vary caption lengths: short (< 100 chars), medium, long
   - Generate platform-specific versions automatically

2. Add content templates system:
   - Create `src/lib/social/content-templates.ts`
   - Templates for: win celebrations, market commentary, educational tips, psychology posts, community highlights
   - Each template has: structure, required data points, example output
   - AI fills in templates with real data

3. Enhance the generation prompt to include:
   - Current market conditions (from Massive API if available)
   - Recent community wins (from trade_journal)
   - Trending topics (from trending_topics table)
   - Time-aware content (pre-market, market hours, after hours)

4. Add a "Content Mix" setting:
   - User defines desired ratio: 40% educational, 30% community, 20% market commentary, 10% promotional
   - Generator maintains this mix across suggestions
   - Track actual mix and show variance from target
```

### Prompt 3.2: Community Win Integration
```
Build the system that automatically harvests community wins for social content.

1. Create `src/lib/social/community-harvester.ts`:
   - Query trade_journal for notable wins (P&L > threshold, win streaks, milestones)
   - Query user_profiles for achievements (badges, streaks, XP milestones)
   - Query learning progress for completions (courses, quizzes, certifications)
   - Respect user privacy settings (opt-in for public sharing)

2. Create database additions:
   - Add `social_sharing_consent` column to user_profiles
   - Add `featured_in_content` table to track which wins have been used
   - Add `content_cooldown` to prevent featuring same user too often

3. Create `src/components/social/community-wins.tsx`:
   - List of eligible wins for featuring
   - Preview of auto-generated content for each
   - One-click "Generate Post" button
   - "Notify User" option to ask for personalization

4. Auto-generation triggers:
   - 10-day win streak: Auto-generate celebration post
   - $1000+ single trade: Generate "Big Win" post (if opted-in)
   - Course completion: Generate "Graduate" post
   - 100 trades milestone: Generate journey post

5. Add to the main page a "Community Highlights" section showing recent wins eligible for content.
```

### Prompt 3.3: Market-Aware Content
```
Integrate real-time market data to generate timely, relevant content.

1. Create `src/lib/social/market-content-triggers.ts`:
   - Monitor SPY/QQQ for significant moves (> 1% day)
   - Track VIX for volatility spikes
   - Check economic calendar for upcoming events
   - Detect unusual options flow patterns

2. Define content triggers:
   - Market gap > 0.5%: Generate "gap analysis" content
   - VIX spike > 20: Generate "volatility" educational content
   - FOMC day: Generate "Fed day" preparation content
   - Major earnings: Generate relevant sector content

3. Create `/api/admin/social/market-triggers/route.ts`:
   - GET: Fetch current trigger status
   - POST: Manually trigger content generation for an event
   - Returns active triggers with suggested content types

4. Build a "Market Events" panel showing:
   - Upcoming events from economic calendar
   - Current market status indicators
   - "Generate Content" button for each event
   - Auto-generation toggle per event type

5. If Massive API is configured, pull real gamma exposure and options flow data into content.
```

---

## Phase 4: Learning & Optimization

### Prompt 4.1: Engagement Tracking System
```
Build comprehensive engagement tracking to enable the learning feedback loop.

1. Create database tables:
   ```sql
   CREATE TABLE content_performance (
     id UUID PRIMARY KEY,
     suggestion_id UUID REFERENCES content_suggestions(id),
     platform TEXT NOT NULL,
     post_id TEXT, -- platform's post ID after publishing
     posted_at TIMESTAMPTZ,
     impressions INTEGER DEFAULT 0,
     reach INTEGER DEFAULT 0,
     likes INTEGER DEFAULT 0,
     comments INTEGER DEFAULT 0,
     shares INTEGER DEFAULT 0,
     saves INTEGER DEFAULT 0,
     engagement_rate DECIMAL(5,2),
     tracked_at TIMESTAMPTZ DEFAULT NOW(),
     raw_metrics JSONB
   );

   CREATE TABLE content_experiments (
     id UUID PRIMARY KEY,
     experiment_name TEXT,
     variant_a_id UUID REFERENCES content_suggestions(id),
     variant_b_id UUID REFERENCES content_suggestions(id),
     winner_id UUID,
     metric_compared TEXT, -- 'engagement_rate', 'saves', etc.
     started_at TIMESTAMPTZ,
     ended_at TIMESTAMPTZ,
     results JSONB
   );
   ```

2. Create `src/lib/social/performance-tracker.ts`:
   - Fetch metrics from platform APIs (when OAuth connected)
   - Update content_performance table
   - Calculate engagement rates
   - Identify top/bottom performers

3. Create `/api/admin/social/performance/route.ts`:
   - GET: Fetch performance data with filters
   - POST: Manually input metrics (for non-connected platforms)
   - GET with aggregate=true: Return summary statistics

4. Build `src/components/social/performance-dashboard.tsx`:
   - Charts: engagement over time, by platform, by content type
   - Leaderboard: top performing posts
   - Insights: AI-generated observations about patterns
   - Export: CSV download of all metrics
```

### Prompt 4.2: Self-Learning Voice Model
```
Implement the feedback loop that improves content generation over time.

1. Create `src/lib/social/voice-learner.ts`:
   - Analyze approved content: extract patterns that work
   - Analyze rejected content: identify patterns to avoid
   - Weight recent feedback higher than old
   - Update tone profile based on engagement data

2. Create learning signals:
   - Approval = positive signal (weight: 1.0)
   - Rejection = negative signal (weight: 1.0)
   - High engagement (top 20%) = strong positive (weight: 2.0)
   - Low engagement (bottom 20%) = weak negative (weight: 0.5)
   - User edit before approval = learning opportunity

3. Track pattern effectiveness:
   - Hook patterns: which opening styles get engagement
   - Hashtag sets: which combinations perform best
   - Caption length: optimal length by platform
   - Posting time: best times for engagement

4. Create `/api/admin/social/learning/route.ts`:
   - GET: Fetch current learning state and confidence scores
   - POST: Manually train on specific content
   - GET /insights: AI analysis of what's working

5. Add a "Learning Insights" panel showing:
   - "Hook style 'Question' outperforms 'Statement' by 34%"
   - "Posts with 8-12 hashtags get 2x more reach"
   - "Tuesday 7 AM is your best posting time"
   - Confidence level for each insight
```

### Prompt 4.3: A/B Testing Framework
```
Build automated A/B testing for content optimization.

1. Create `src/lib/social/ab-testing.ts`:
   - Generate variant content (same message, different execution)
   - Variants can differ in: hook, hashtags, emoji usage, CTA, length
   - Track which variant performs better
   - Automatically apply learnings

2. Implement experiment types:
   - Hook test: Same content, 3 different hooks
   - Hashtag test: Same content, different hashtag sets
   - Time test: Same content, different posting times
   - Format test: Same message as image vs video vs carousel

3. Create `src/components/social/ab-testing-manager.tsx`:
   - Create new experiment wizard
   - View active experiments
   - Results dashboard with statistical significance
   - "Apply Winner" button to use winning pattern

4. Add to content generation:
   - Option to "Create as A/B Test" when generating
   - Auto-generate 2-3 variants with one click
   - Scheduling ensures variants post at same time on different days

5. Create experiment reporting:
   - Weekly email digest of experiment results
   - Dashboard showing cumulative learnings
   - Pattern library of proven winners
```

---

## Phase 5: Automation & Publishing

### Prompt 5.1: Content Queue & Scheduling
```
Build the content scheduling and queue management system.

1. Create database table:
   ```sql
   CREATE TABLE content_queue (
     id UUID PRIMARY KEY,
     suggestion_id UUID REFERENCES content_suggestions(id),
     platform TEXT NOT NULL,
     scheduled_for TIMESTAMPTZ NOT NULL,
     status TEXT DEFAULT 'scheduled', -- scheduled, publishing, published, failed
     published_at TIMESTAMPTZ,
     platform_post_id TEXT,
     error_message TEXT,
     retry_count INTEGER DEFAULT 0,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. Create `src/lib/social/content-scheduler.ts`:
   - Add content to queue with scheduled time
   - Optimal time suggestions based on historical data
   - Conflict detection (don't over-post)
   - Queue management (reorder, reschedule, cancel)

3. Create `/api/admin/social/queue/route.ts`:
   - GET: Fetch queue with filters (platform, date range, status)
   - POST: Add to queue
   - PUT: Update scheduled time or status
   - DELETE: Remove from queue

4. Build `src/components/social/content-calendar.tsx`:
   - Calendar view (week/month)
   - Drag-and-drop rescheduling
   - Color-coded by platform
   - Click to preview content
   - "Optimal times" overlay showing best slots

5. Add queue status indicators to main dashboard:
   - Upcoming posts count
   - Next scheduled post
   - Failed posts requiring attention
```

### Prompt 5.2: Publishing Integration Prep
```
Prepare the system for direct publishing (OAuth integration will be separate).

1. Create `src/lib/social/publishers/base-publisher.ts`:
   - Abstract class defining publish interface
   - Methods: publish(), getStatus(), deletePost()
   - Error handling and retry logic
   - Audit logging

2. Create platform-specific publishers (stub implementations):
   - `instagram-publisher.ts` - Instagram Graph API
   - `tiktok-publisher.ts` - TikTok for Business API
   - `twitter-publisher.ts` - Twitter API v2
   - `youtube-publisher.ts` - YouTube Data API

3. Create `/api/admin/social/publish/route.ts`:
   - POST: Publish content to specified platform
   - GET: Check publish status
   - For now, return "OAuth not configured" with setup instructions

4. Add "Manual Post" workflow:
   - "Copy to Clipboard" button that copies formatted content
   - Platform-specific formatting (IG caption limits, TT hashtag style)
   - "Mark as Posted" button to track manually published content
   - Input field to paste the platform's post URL/ID

5. Create publishing checklist component:
   - Shows content preview
   - Platform-specific warnings (character limits, hashtag counts)
   - Compliance check (disclaimers present)
   - Final approval checkbox
```

### Prompt 5.3: Cron Jobs & Background Processing
```
Set up the automated background jobs for the Social Builder.

1. Create cron job endpoints in `/api/cron/social/`:
   - `scrape-influencers/route.ts` - Runs hourly, scrapes due influencers
   - `aggregate-trending/route.ts` - Runs every 4 hours, refreshes trends
   - `process-queue/route.ts` - Runs every 15 minutes, publishes scheduled content
   - `update-metrics/route.ts` - Runs daily, fetches engagement metrics
   - `cleanup/route.ts` - Runs weekly, archives old data

2. Each cron endpoint should:
   - Verify CRON_SECRET authorization
   - Log start/end with duration
   - Handle errors gracefully
   - Send alerts on repeated failures

3. Create `src/lib/social/job-runner.ts`:
   - Centralized job execution logic
   - Progress tracking
   - Concurrent execution limits
   - Dead letter queue for failed jobs

4. Add to vercel.json or railway.json:
   ```json
   {
     "crons": [
       { "path": "/api/cron/social/scrape-influencers", "schedule": "0 * * * *" },
       { "path": "/api/cron/social/aggregate-trending", "schedule": "0 */4 * * *" },
       { "path": "/api/cron/social/process-queue", "schedule": "*/15 * * * *" }
     ]
   }
   ```

5. Create admin view for job monitoring:
   - Job history with status
   - Manual trigger buttons
   - Error logs
   - Next scheduled run times
```

---

## Phase 6: Advanced Features

### Prompt 6.1: AI Content Editor
```
Build an AI-powered content editor for refining generated suggestions.

1. Create `src/components/social/ai-content-editor.tsx`:
   - Full-screen editor modal
   - Side-by-side: original AI suggestion | edited version
   - Real-time character count per platform
   - Preview mode showing how it will look on each platform

2. Add AI editing actions:
   - "Make it shorter" - Condense while keeping message
   - "Make it punchier" - More energy, stronger hook
   - "Add a question" - End with engagement prompt
   - "Change the hook" - Generate 3 alternative hooks
   - "Suggest hashtags" - AI-recommended hashtags based on content

3. Create `/api/admin/social/edit/route.ts`:
   - POST: Send content + instruction, get edited version
   - Maintains KCU tone profile
   - Returns multiple options when applicable

4. Add version history:
   - Track all edits to a suggestion
   - "Revert to original" button
   - "Revert to version X" for any saved version
   - Show diff between versions

5. Include compliance checker:
   - Scan for potential SEC/FINRA issues
   - Flag missing disclaimers
   - Warn about promises of returns
   - Auto-suggest compliant alternatives
```

### Prompt 6.2: Content Repurposing
```
Build a system to repurpose successful content across formats and platforms.

1. Create `src/lib/social/content-repurposer.ts`:
   - Take existing content and adapt for different platforms
   - Convert long-form to short-form and vice versa
   - Extract key points for carousel posts
   - Generate thread versions for Twitter/X

2. Repurposing transformations:
   - Instagram post → TikTok script
   - Long caption → Thread (5-10 tweets)
   - Video transcript → Blog outline
   - Carousel → Individual posts
   - Top comment → Follow-up content

3. Create `/api/admin/social/repurpose/route.ts`:
   - POST: Source content ID + target format
   - Returns repurposed content for review
   - Tracks lineage (this came from that)

4. Build `src/components/social/repurpose-wizard.tsx`:
   - Select source content
   - Choose target platforms/formats
   - Preview all generated versions
   - Bulk approve/edit/reject

5. Add "Repurpose This" button to:
   - High-performing posts
   - Approved suggestions
   - Influencer posts (as inspiration, not copying)
```

### Prompt 6.3: Trend Prediction & Alerts
```
Build predictive trend detection with automated alerts.

1. Enhance `src/lib/social/trending-aggregator.ts`:
   - Track trend velocity (acceleration, not just current value)
   - Identify emerging trends before they peak
   - Categorize trends by relevance to KCU
   - Score trending topics by content potential

2. Create alert system:
   - Database table for alert subscriptions
   - Alert types: trend spike, competitor post, market event, community milestone
   - Delivery: in-app notification, email, webhook

3. Create `src/components/social/trend-alerts.tsx`:
   - Configure alert thresholds
   - View alert history
   - One-click "Create Content" from alert
   - Snooze/dismiss options

4. Build trend prediction:
   - Analyze historical trend patterns
   - Identify seasonal trends (FOMC cycles, earnings seasons)
   - Predict upcoming trending topics
   - Suggest content to prepare in advance

5. Create "Trend Radar" visualization:
   - Bubble chart of current trends
   - Size = current volume, Color = velocity
   - Click to see AI analysis and content suggestions
   - Filter by category/relevance
```

---

## Phase 7: Reporting & Analytics

### Prompt 7.1: Analytics Dashboard
```
Build a comprehensive analytics dashboard for the Social Builder.

1. Create `src/components/social/analytics-dashboard.tsx`:
   - Date range selector
   - Platform filter
   - Key metrics cards: total impressions, total engagement, follower growth
   - Comparison to previous period

2. Add charts:
   - Engagement over time (line chart)
   - Content type performance (bar chart)
   - Posting frequency vs engagement (scatter)
   - Best performing days/times (heatmap)
   - Hashtag performance (horizontal bars)

3. Create `/api/admin/social/analytics/route.ts`:
   - GET with various aggregation options
   - Support for date ranges, platform filters
   - Comparison queries (this period vs last)
   - Export as CSV

4. Add AI-powered insights section:
   - "Your engagement is up 23% this week, driven by..."
   - "Consider posting more carousel content based on..."
   - "Competitor X is gaining followers faster because..."

5. Create printable/shareable report:
   - Weekly summary template
   - Export as PDF
   - Scheduled email delivery option
```

### Prompt 7.2: ROI Tracking
```
Build ROI tracking to measure social media impact on business metrics.

1. Create attribution tracking:
   - Track clicks from social posts to KCU website
   - UTM parameter generation for all links
   - Landing page performance by source

2. Create database tables:
   ```sql
   CREATE TABLE social_conversions (
     id UUID PRIMARY KEY,
     content_id UUID,
     platform TEXT,
     event_type TEXT, -- click, signup, trial, purchase
     user_id UUID,
     value DECIMAL(10,2),
     attributed_at TIMESTAMPTZ
   );
   ```

3. Build conversion funnel visualization:
   - Impressions → Clicks → Signups → Conversions
   - By platform, content type, campaign

4. Create `/api/admin/social/roi/route.ts`:
   - GET: Fetch ROI metrics
   - Calculate: cost per acquisition, lifetime value, ROI percentage

5. Add ROI section to analytics dashboard:
   - Revenue attributed to social
   - Cost breakdown (API costs, time invested)
   - Net ROI calculation
   - Recommendations for improving ROI
```

---

## Quick Reference: Execution Order

For fastest path to a working system, execute prompts in this order:

1. **Day 1-2**: 1.1 (Tone Profile) → 1.2 (Settings API) → 1.3 (Env Validation)
2. **Day 3-4**: 2.1 (Seed Influencers) → 3.1 (Enhanced Generator)
3. **Day 5-6**: 3.2 (Community Wins) → 3.3 (Market-Aware Content)
4. **Week 2**: 4.1 (Engagement Tracking) → 4.2 (Voice Learning) → 5.1 (Queue/Scheduling)
5. **Week 3**: 5.3 (Cron Jobs) → 6.1 (AI Editor) → 2.2 (Enhanced Scraping)
6. **Week 4**: 7.1 (Analytics Dashboard) → 4.3 (A/B Testing) → 6.2 (Repurposing)

---

## Notes for Claude Code

When executing these prompts:

1. **Always check existing code first** - The Social Builder already has substantial implementation. Build on what exists.

2. **Maintain type safety** - Update `src/types/social.ts` with any new types.

3. **Follow existing patterns** - Match the code style in existing social components.

4. **Test incrementally** - After each prompt, verify the feature works before moving on.

5. **Database migrations** - Use Supabase migrations for schema changes.

6. **Environment variables** - Document any new required env vars in `.env.example`.
