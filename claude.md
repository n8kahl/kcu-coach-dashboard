# KCU Coach Dashboard

A Next.js trading education platform for the KCU (Kevin's Charting University) community, featuring trade journaling, AI coaching, real-time alerts, and gamified learning.

## Quick Reference

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript (strict mode)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Discord OAuth with JWT sessions
- **Styling**: Tailwind CSS
- **AI**: Anthropic Claude API
- **Real-time**: SSE with Redis pub/sub

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/        # Protected dashboard routes
│   ├── (admin)/            # Admin-only routes
│   ├── api/                # API routes
│   └── login/              # Auth pages
├── components/
│   ├── dashboard/          # Dashboard-specific components
│   ├── ui/                 # Reusable UI components
│   └── layout/             # Layout components
├── lib/                    # Core utilities
│   ├── auth.ts             # Session & Discord OAuth
│   ├── jwt.ts              # JWT token handling (jose)
│   ├── supabase.ts         # Database client
│   ├── redis.ts            # Redis client (ioredis)
│   ├── broadcast.ts        # SSE/real-time broadcasts
│   ├── validation.ts       # Zod schemas
│   ├── ltp-engine.ts       # LTP scoring system
│   └── api-errors.ts       # Standardized error handling
├── types/                  # TypeScript definitions
└── services/               # Business logic services
```

## Key Concepts

### LTP Scoring System
The core trading methodology uses Level-Trend-Patience (LTP) scoring:
- **Level**: Trade at key support/resistance
- **Trend**: Trade with the trend
- **Patience**: Wait for confirmation candles

Scores are calculated in `src/lib/ltp-engine.ts` with grades A-F.

### Authentication Flow
1. User initiates Discord OAuth via `/api/auth/login`
2. Discord callback at `/api/auth/callback` exchanges code for tokens
3. JWT session stored in `kcu_session` cookie (7-day expiry)
4. Middleware validates tokens and redirects unauthenticated users

### Real-time Updates
- SSE endpoints in `/api/admin/alerts` and `/api/setups`
- Redis pub/sub for multi-server broadcasting
- Graceful fallback to in-memory when Redis unavailable

### AI Coach with Rich Content
The AI Coach (`/api/chat`) supports embedding rich content in responses:

- **Lesson Links**: `[[LESSON:module-slug/lesson-slug|Title|Duration]]`
- **Charts**: `[[CHART:SYMBOL|interval|indicators]]`
- **Setup Visualizations**: `[[SETUP:SYMBOL|direction|entry|stop|target|level%|trend%|patience%]]`
- **Quiz Prompts**: `[[QUIZ:module-slug|Quiz Title]]`

Key files:
- `src/lib/curriculum-context.ts` - Provides curriculum data to AI
- `src/lib/rich-content-parser.ts` - Parses markers from AI responses
- `src/components/chat/rich-content.tsx` - Renders rich content components

## Common Tasks

### Adding a New API Route
```typescript
// src/app/api/example/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { withErrorHandler, ApiError } from '@/lib/api-errors';

export const GET = withErrorHandler(async (request: Request) => {
  const session = await requireAuth(); // Throws if not authenticated

  // Your logic here
  return NextResponse.json({ data: 'example' });
});
```

### Adding Input Validation
```typescript
import { z } from 'zod';

const MySchema = z.object({
  symbol: z.string().min(1).max(10),
  price: z.number().positive(),
});

// In route handler:
const body = MySchema.parse(await request.json());
```

### Creating a Dashboard Page
```typescript
// src/app/(dashboard)/my-page/page.tsx
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function MyPage() {
  const session = await getSession();
  if (!session.user) redirect('/login');

  return <div>...</div>;
}
```

## Environment Variables

Required for development (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `DISCORD_CLIENT_ID` - Discord OAuth app ID
- `DISCORD_CLIENT_SECRET` - Discord OAuth secret
- `SESSION_SECRET` - JWT signing secret (32+ chars)
- `ANTHROPIC_API_KEY` - Claude API key (for AI features)

Optional:
- `REDIS_URL` - Redis connection for production scaling
- `MASSIVE_API_KEY` - Market data for Companion Mode

## Code Conventions

### TypeScript
- Strict mode enabled, no `@ts-ignore` or `@ts-nocheck`
- Types defined in `src/types/index.ts`
- Use type inference where possible, explicit types for function signatures

### API Routes
- Use `requireAuth()` or `requireAdmin()` from `@/lib/auth`
- Wrap handlers with `withErrorHandler` for consistent error responses
- Validate all inputs with Zod schemas from `@/lib/validation.ts`

### Components
- Prefer server components; use `'use client'` only when needed
- Keep client components small and focused
- Use `@/components/ui/` for base components

### Error Handling
- Use `ApiError` class for expected errors (4xx)
- Unexpected errors automatically return 500 with logged details
- Client components should have loading and error states

## Testing

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Tests use Jest with React Testing Library. Test files go in `src/__tests__/`.

## Database Schema

Key tables (see `supabase-schema-v3.sql`):
- `user_profiles` - User accounts linked to Discord
- `trade_journal` - Trade entries with LTP scoring
- `learning_progress` - Module/lesson completion
- `achievements` - Gamification badges
- `admin_alerts` - Coach alerts for setups

## Security

### Secret Management - CRITICAL

**NEVER commit secrets or local settings to git.** The following are automatically ignored:

- `.env`, `.env.local`, `.env.*.local` - Environment files
- `.claude/` - Claude Code local settings
- `*.local.json` - Local configuration files
- `credentials.json`, `secrets.json` - Credential files
- `*.pem`, `*.key` - Private keys

**CI enforces this**: The GitHub Actions workflow runs [gitleaks](https://github.com/gitleaks/gitleaks) on every push/PR and will **fail the build** if secrets are detected.

### If You Accidentally Commit a Secret

1. **Immediately rotate the exposed credential** (see Key Rotation below)
2. Remove the file from git: `git rm --cached <file>`
3. Add to `.gitignore` if not already present
4. Force push to remove from history: `git filter-branch` or use BFG Repo Cleaner
5. Consider the secret compromised - always rotate

### Key Rotation Instructions

**Supabase Service Role Key:**
1. Go to Supabase Dashboard → Settings → API
2. Click "Generate new key" under Service Role Key
3. Update `SUPABASE_SERVICE_ROLE_KEY` in Railway/production
4. Update local `.env.local`

**Discord OAuth Secret:**
1. Go to Discord Developer Portal → Your App → OAuth2
2. Click "Reset Secret"
3. Update `DISCORD_CLIENT_SECRET` in Railway/production
4. Update local `.env.local`

**Anthropic API Key:**
1. Go to console.anthropic.com → API Keys
2. Create new key, delete old one
3. Update `ANTHROPIC_API_KEY` in Railway/production
4. Update local `.env.local`

**OpenAI API Key:**
1. Go to platform.openai.com → API Keys
2. Create new key, revoke old one
3. Update `OPENAI_API_KEY` in Railway/production
4. Update local `.env.local`

**SESSION_SECRET:**
1. Generate new: `openssl rand -base64 32`
2. Update in Railway/production
3. Note: All existing sessions will be invalidated

## Deployment

Configured for Railway (`railway.json`). Ensure all required env vars are set:
1. Generate `SESSION_SECRET`: `openssl rand -base64 32`
2. Set up Discord OAuth with production redirect URL
3. Configure Supabase with production keys
4. Optional: Set up Redis for horizontal scaling
