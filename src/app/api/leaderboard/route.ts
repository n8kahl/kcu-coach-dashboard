import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUserId } from '@/lib/auth';
import type { LeaderboardEntry } from '@/types';

// Interface for database rankings
interface RankingEntry {
  userId: string;
  username: string;
  avatar?: string;
  score: number;
  winRate: number;
  totalTrades: number;
  streak: number;
  badges?: string[];
  previousRank?: number;
  isNew?: boolean;
  favoriteAsset?: string;
  bestWinStreak?: number;
}

// Extended LeaderboardEntry with additional stats
interface ExtendedLeaderboardEntry extends LeaderboardEntry {
  is_new_entry?: boolean;
  distance_to_next?: number;
  tier: 'gold' | 'silver' | 'bronze' | 'standard';
  favorite_asset?: string;
  best_win_streak?: number;
}

// Standardized error response
interface ErrorResponse {
  error: string;
  code: string;
}

/**
 * GET /api/leaderboard
 *
 * Production-ready leaderboard API with:
 * - Cursor-based pagination
 * - Cache-Control headers for CDN caching
 * - Robust delta calculation for rank changes
 * - Extended user stats for profile cards
 */
export async function GET(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'weekly';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Cap at 100
    const offset = parseInt(searchParams.get('offset') || '0');
    const cursor = searchParams.get('cursor'); // For cursor-based pagination

    // Validate period
    const validPeriods = ['weekly', 'monthly', 'all-time'];
    if (!validPeriods.includes(period)) {
      return createErrorResponse('Invalid period. Use: weekly, monthly, or all-time', 'INVALID_PERIOD', 400);
    }

    // Get the most recent leaderboard for the period
    const { data: leaderboard, error } = await supabaseAdmin
      .from('leaderboards')
      .select('*')
      .eq('period_type', period)
      .order('period_start', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Leaderboard fetch error:', error);
      return createErrorResponse('Failed to fetch leaderboard data', 'DATABASE_ERROR', 500);
    }

    // Handle empty leaderboard gracefully
    if (!leaderboard) {
      return createSuccessResponse({
        entries: [],
        userRank: null,
        period,
        periodStart: null,
        periodEnd: null,
        pagination: {
          total: 0,
          limit,
          offset: 0,
          hasMore: false,
          nextCursor: null,
        },
      });
    }

    // Transform rankings to LeaderboardEntry format
    const allRankings: RankingEntry[] = leaderboard?.rankings || [];
    const totalCount = allRankings.length;

    // Handle cursor-based pagination
    let startIndex = offset;
    if (cursor) {
      const cursorIndex = allRankings.findIndex(r => r.userId === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    // Get paginated slice
    const paginatedRankings = allRankings.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < totalCount;
    const nextCursor = hasMore && paginatedRankings.length > 0
      ? paginatedRankings[paginatedRankings.length - 1].userId
      : null;

    const entries: ExtendedLeaderboardEntry[] = paginatedRankings.map((r, index) => {
      const absoluteRank = startIndex + index + 1;
      const previousRank = r.previousRank;

      // Robust delta calculation
      let change: 'up' | 'down' | 'same' = 'same';
      let changeAmount: number | undefined;

      if (r.isNew || previousRank === null || previousRank === undefined) {
        // New entry - treat as 'same' to avoid showing huge jumps
        change = 'same';
      } else if (previousRank > absoluteRank) {
        change = 'up';
        changeAmount = previousRank - absoluteRank;
      } else if (previousRank < absoluteRank) {
        change = 'down';
        changeAmount = absoluteRank - previousRank;
      }

      // Calculate distance to next rank
      const nextRanker = absoluteRank > 1 ? allRankings[absoluteRank - 2] : null;
      const distanceToNext = nextRanker ? nextRanker.score - r.score : undefined;

      // Determine tier
      let tier: 'gold' | 'silver' | 'bronze' | 'standard' = 'standard';
      if (absoluteRank <= 3) tier = 'gold';
      else if (absoluteRank <= 10) tier = 'silver';
      else if (absoluteRank <= 50) tier = 'bronze';

      return {
        rank: absoluteRank,
        user_id: r.userId,
        username: r.username,
        avatar: r.avatar,
        score: r.score,
        win_rate: r.winRate,
        total_trades: r.totalTrades,
        streak: r.streak,
        badges: r.badges || [],
        change,
        change_amount: changeAmount,
        is_new_entry: r.isNew || previousRank === null || previousRank === undefined,
        distance_to_next: distanceToNext,
        tier,
        favorite_asset: r.favoriteAsset,
        best_win_streak: r.bestWinStreak,
      };
    });

    // Get current user's rank if authenticated (always include, even if not in paginated view)
    let userRank: ExtendedLeaderboardEntry | null = null;
    let userRankContext: { above: ExtendedLeaderboardEntry | null; below: ExtendedLeaderboardEntry | null } | null = null;

    if (userId && allRankings.length > 0) {
      const userIndex = allRankings.findIndex((r) => r.userId === userId);
      if (userIndex !== -1) {
        const r = allRankings[userIndex];
        const absoluteRank = userIndex + 1;
        const previousRank = r.previousRank;

        let change: 'up' | 'down' | 'same' = 'same';
        let changeAmount: number | undefined;

        if (r.isNew || previousRank === null || previousRank === undefined) {
          change = 'same';
        } else if (previousRank > absoluteRank) {
          change = 'up';
          changeAmount = previousRank - absoluteRank;
        } else if (previousRank < absoluteRank) {
          change = 'down';
          changeAmount = absoluteRank - previousRank;
        }

        // Calculate distance to next rank for user
        const nextRanker = userIndex > 0 ? allRankings[userIndex - 1] : null;
        const distanceToNext = nextRanker ? nextRanker.score - r.score : undefined;

        let tier: 'gold' | 'silver' | 'bronze' | 'standard' = 'standard';
        if (absoluteRank <= 3) tier = 'gold';
        else if (absoluteRank <= 10) tier = 'silver';
        else if (absoluteRank <= 50) tier = 'bronze';

        userRank = {
          rank: absoluteRank,
          user_id: r.userId,
          username: r.username,
          avatar: r.avatar,
          score: r.score,
          win_rate: r.winRate,
          total_trades: r.totalTrades,
          streak: r.streak,
          badges: r.badges || [],
          change,
          change_amount: changeAmount,
          is_new_entry: r.isNew || previousRank === null || previousRank === undefined,
          distance_to_next: distanceToNext,
          tier,
          favorite_asset: r.favoriteAsset,
          best_win_streak: r.bestWinStreak,
        };

        // Get context (user above and below)
        const above = userIndex > 0 ? allRankings[userIndex - 1] : null;
        const below = userIndex < allRankings.length - 1 ? allRankings[userIndex + 1] : null;

        if (above || below) {
          userRankContext = {
            above: above ? {
              rank: userIndex,
              user_id: above.userId,
              username: above.username,
              avatar: above.avatar,
              score: above.score,
              win_rate: above.winRate,
              total_trades: above.totalTrades,
              streak: above.streak,
              badges: above.badges || [],
              change: 'same',
              tier: userIndex <= 3 ? 'gold' : userIndex <= 10 ? 'silver' : userIndex <= 50 ? 'bronze' : 'standard',
            } : null,
            below: below ? {
              rank: userIndex + 2,
              user_id: below.userId,
              username: below.username,
              avatar: below.avatar,
              score: below.score,
              win_rate: below.winRate,
              total_trades: below.totalTrades,
              streak: below.streak,
              badges: below.badges || [],
              change: 'same',
              tier: userIndex + 2 <= 3 ? 'gold' : userIndex + 2 <= 10 ? 'silver' : userIndex + 2 <= 50 ? 'bronze' : 'standard',
            } : null,
          };
        }
      }
    }

    return createSuccessResponse({
      entries,
      userRank,
      userRankContext,
      period,
      periodStart: leaderboard?.period_start,
      periodEnd: leaderboard?.period_end,
      pagination: {
        total: totalCount,
        limit,
        offset: startIndex,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return createErrorResponse('Internal server error', 'INTERNAL_ERROR', 500);
  }
}

/**
 * Create a standardized success response with caching headers
 */
function createSuccessResponse(data: Record<string, unknown>) {
  const response = NextResponse.json(data);

  // Add cache headers for CDN caching
  // Leaderboard data is fresh for 60 seconds, stale-while-revalidate for 5 minutes
  response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  return response;
}

/**
 * Create a standardized error response
 */
function createErrorResponse(message: string, code: string, status: number) {
  const errorBody: ErrorResponse = {
    error: message,
    code,
  };

  return NextResponse.json(errorBody, { status });
}
