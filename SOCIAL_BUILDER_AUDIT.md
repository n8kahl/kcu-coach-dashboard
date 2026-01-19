# KCU Social Builder - Comprehensive Audit Report
## January 18, 2026

---

## Executive Summary

The Social Builder feature is **substantially built** with real AI integration (Claude API) for content generation, but relies heavily on **mock data fallbacks** when external API keys are not configured. Many UI elements are wired correctly, but several critical pieces need production-ready implementations.

---

## 1. Current Implementation Status

### ✅ Fully Functional (Production-Ready)

| Component | Status | Notes |
|-----------|--------|-------|
| Content Generation API | ✅ Real | Uses Claude API with comprehensive prompts |
| Tone Analysis | ✅ Real | Claude-powered analysis of influencer content |
| KCU Data Aggregation | ✅ Real | Pulls from trade_journal, user_profiles, lessons |
| Suggestion Management | ✅ Real | Full CRUD with Supabase |
| Database Schema | ✅ Real | Comprehensive schema with RLS policies |
| Settings Modal | ✅ Real | Saves to database via config table |
| Add Influencer Modal | ✅ Real | Saves to influencer_profiles table |

### ⚠️ Using Mock Data (API Keys Missing)

| Component | Issue | Required API Key |
|-----------|-------|------------------|
| Instagram Scraping | Falls back to mock data | `RAPIDAPI_KEY` |
| TikTok Scraping | Falls back to mock data | `TIKAPI_KEY` |
| YouTube Scraping | Falls back to mock data | `YOUTUBE_API_KEY` (partially configured) |
| X/Twitter Trending | Falls back to AI-generated | `X_BEARER_TOKEN` or `TWITTER_BEARER_TOKEN` |
| News Aggregation | Falls back to AI-generated | `NEWS_API_KEY` |
| Market Data | Falls back to empty | `ALPHA_VANTAGE_KEY` or `FINNHUB_API_KEY` |

### ❌ Not Wired / Missing Implementation

| Feature | Location | Issue |
|---------|----------|-------|
| Settings Save Handler | `page.tsx` | `handleSaveSettings` exists but needs API route |
| KCU Tone Profile | Database | Table exists but no seed data / admin UI to configure |
| Influencer Tone Analysis Button | `influencer-list.tsx` | Scrape triggers analysis but no dedicated "Analyze Tone" button |
| Content Preview Edit | `content-preview-modal.tsx` | Edit button exists but no edit functionality |
| Publish to Platform | Not implemented | No social media OAuth/publishing integration |
| Schedule Post | Not implemented | UI shows scheduling but no queue/worker |
| Analytics Dashboard | Not implemented | Database tables exist, no UI components |
| Content Calendar View | Not implemented | No calendar visualization |

---

## 2. Detailed Component Analysis

### 2.1 API Routes

#### `/api/admin/social/generate` - ✅ Functional
- Calls `generateContentSuggestions()` with Claude API
- Aggregates trending topics, influencer posts, and KCU platform data
- Saves suggestions to database
- **Issue**: Requires `ANTHROPIC_API_KEY` and KCU tone profile to exist

#### `/api/admin/social/suggestions` - ✅ Functional
- GET: Fetches suggestions with pagination and filtering
- POST: Approves/rejects/updates suggestions
- DELETE: Removes suggestions
- **All CRUD operations working**

#### `/api/admin/social/influencers` - ✅ Functional
- GET: Fetches influencer profiles with filters
- POST: Creates new influencer profile
- DELETE: Removes influencer
- **Working correctly**

#### `/api/admin/social/influencers/scrape` - ⚠️ Partial
- POST: Triggers scraping for single or all influencers
- GET: Returns scraping status
- **Issue**: Without `RAPIDAPI_KEY` / `TIKAPI_KEY`, returns mock data

#### `/api/admin/social/trending` - ⚠️ Partial
- GET: Fetches trending topics from database
- POST with `action: 'refresh'`: Aggregates from X, TikTok, News
- **Issue**: Without API keys, generates AI fallback topics only

#### `/api/admin/social/insights` - ✅ Functional
- GET: Returns content insights, analytics, ideas
- POST: Generates new insights
- **Calls real analysis functions**

### 2.2 UI Components

#### `SuggestionCard` / `SuggestionListItem` - ✅ Wired
- Approve button → calls `onApprove` → updates database
- Reject button → calls `onReject` → updates database
- Preview button → opens `ContentPreviewModal`
- Edit button → calls `onEdit` but **handler may be incomplete**

#### `ContentPreviewModal` - ⚠️ Partial
- Platform tabs work correctly
- Copy to clipboard works
- Approve/Reject buttons wired
- **Missing**: Actual edit functionality

#### `InfluencerList` - ✅ Mostly Wired
- Search/filter working
- Add influencer button wired
- Scrape single/all wired
- Delete wired
- External link wired
- **Missing**: View full analysis/posts button

#### `TrendingTopics` - ✅ Wired
- Filter by source/category works
- Refresh button works
- Scrape Now button → calls `aggregateFromSources()`
- Generate Content button → calls `onGenerateFromTopic()`

#### `SettingsModal` - ⚠️ Partial
- All form fields functional
- Reset button works
- Save button → calls `onSave`
- **Issue**: No dedicated API route for settings; uses config table but save handler incomplete in main page

#### `AddInfluencerModal` - ✅ Wired
- All form fields work
- Platform selection works
- Tags management works
- Submit → calls API → saves to database

---

## 3. Missing Environment Variables

The following API keys are referenced but likely not configured:

```env
# Social Media Scraping (CRITICAL for real data)
RAPIDAPI_KEY=                    # Instagram scraping
TIKAPI_KEY=                      # TikTok scraping

# Trending Topic Aggregation
X_BEARER_TOKEN=                  # or TWITTER_BEARER_TOKEN
NEWS_API_KEY=                    # Financial news

# Market Data
ALPHA_VANTAGE_KEY=               # Stock data
FINNHUB_API_KEY=                 # Alternative market data

# KayCapitals Account Handles
KAYCAPITALS_INSTAGRAM_HANDLE=    # For self-analysis
KAYCAPITALS_TIKTOK_HANDLE=       # For self-analysis
```

---

## 4. Database Tables Status

| Table | Has Data? | Notes |
|-------|-----------|-------|
| `content_suggestions` | Dynamic | Created by AI generation |
| `influencer_profiles` | Need seed | No influencers added yet |
| `influencer_posts` | Need scrape | Populated by scraping |
| `trending_topics` | Dynamic | Created by aggregation |
| `social_accounts` | Empty | No OAuth integration |
| `social_posts` | Empty | No publishing integration |
| `social_analytics` | Empty | No analytics collection |
| `kcu_tone_profile` | **MISSING DATA** | Critical for content generation |
| `social_builder_config` | Has defaults | Seeded by schema |
| `hashtag_performance` | Empty | No tracking yet |

### Critical Missing: KCU Tone Profile

The `kcu_tone_profile` table must contain the brand voice configuration. Without it, content generation fails. Required fields:

- `voice_attributes`: JSON object with confidence, educational, etc.
- `preferred_phrases`: Array of on-brand phrases
- `avoided_phrases`: Array of off-brand phrases
- `emoji_style`: 'minimal', 'moderate', 'heavy'
- `cta_patterns`: Array of call-to-action templates
- `hook_patterns`: Array of opening hook templates
- `sample_posts`: Array of example posts

---

## 5. Enhancement Plan for Production

### Phase 1: Critical Fixes (Immediate)

1. **Create KCU Tone Profile Seed Data**
   - Add INSERT statement for `kcu_tone_profile` table
   - Define KCU's brand voice attributes

2. **Add Settings API Route**
   - Create `/api/admin/social/settings/route.ts`
   - Wire up save handler in main page

3. **Add Missing Influencer Profiles**
   - Create seed data for tracked influencers (TJR, Warrior Trading, etc.)

4. **Add Error Boundaries**
   - Handle API key missing errors gracefully in UI

### Phase 2: API Integration (1-2 weeks)

1. **Configure RapidAPI for Instagram**
   - Sign up for Instagram Scraper API
   - Add `RAPIDAPI_KEY` to environment

2. **Configure TikAPI**
   - Sign up for TikAPI.io
   - Add `TIKAPI_KEY` to environment

3. **Configure X/Twitter API**
   - Apply for Twitter API access
   - Add `X_BEARER_TOKEN` to environment

4. **Configure News API**
   - Sign up for NewsAPI.org
   - Add `NEWS_API_KEY` to environment

### Phase 3: Feature Completion (2-4 weeks)

1. **Content Editor Modal**
   - Add edit functionality to ContentPreviewModal
   - Allow caption, hashtag, and hook editing

2. **Social Media OAuth Integration**
   - Instagram Graph API integration
   - TikTok for Business integration
   - YouTube Studio integration

3. **Post Scheduling System**
   - Create scheduling queue table
   - Add cron job for posting
   - Add calendar view component

4. **Analytics Dashboard**
   - Create analytics components
   - Track post performance
   - Show engagement trends

### Phase 4: Advanced Features (4-8 weeks)

1. **A/B Testing**
   - Generate multiple content variants
   - Track performance by variant

2. **Content Calendar**
   - Visual calendar component
   - Drag-and-drop scheduling

3. **Team Collaboration**
   - Review/approval workflow
   - Comment system on suggestions

4. **Auto-Posting**
   - Worker process for scheduled posts
   - Retry logic for failures

---

## 6. Files Requiring Modification

| File | Changes Needed |
|------|----------------|
| `page.tsx` | Wire up handleSaveSettings to API |
| `settings-modal.tsx` | Add loading states for save |
| `content-preview-modal.tsx` | Add edit mode functionality |
| `influencer-list.tsx` | Add "Analyze" button for tone analysis |
| `.env.local` | Add missing API keys |
| `social-builder-schema.sql` | Add KCU tone profile INSERT |

---

## 7. Recommended Priority Order

1. **Day 1**: Add KCU tone profile seed data
2. **Day 2**: Configure ANTHROPIC_API_KEY (if not already)
3. **Day 3**: Add settings API route and wire up save
4. **Week 1**: Sign up for and configure RapidAPI
5. **Week 2**: Sign up for and configure TikAPI
6. **Week 3**: Build content editing functionality
7. **Month 1**: OAuth integration for publishing

---

## 8. Cost Estimates for External APIs

| API | Monthly Cost | Notes |
|-----|--------------|-------|
| RapidAPI (Instagram) | $49-199/mo | Depends on usage tier |
| TikAPI | $49-149/mo | Depends on requests |
| Twitter API | $100/mo | Basic tier |
| NewsAPI | Free-$449/mo | Free tier has limits |
| Anthropic (Claude) | ~$20-100/mo | Based on usage |

---

## Conclusion

The Social Builder has a **solid architectural foundation** with real AI-powered content generation. The main gaps are:

1. Missing external API keys for social media scraping
2. Missing KCU tone profile seed data (critical)
3. Missing settings save API route
4. No OAuth integration for actual publishing

With the recommended enhancements, this can become a fully production-ready social media management tool.
