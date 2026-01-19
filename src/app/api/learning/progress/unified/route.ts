/**
 * @deprecated Use /api/learning/v2/progress instead
 *
 * Unified Learning Progress API Route (Thinkific-focused)
 * This route is maintained for backward compatibility only.
 * Returns combined progress data from Thinkific and local KCU Coach.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getUserCourseProgress,
  getUserLearningStats,
  getRecentLearningActivity,
  getModuleProgressWithThinkific,
} from '@/lib/learning-progress';

// ============================================
// GET /api/learning/progress/unified
// Get unified learning progress for authenticated user
// ============================================

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;
    const searchParams = request.nextUrl.searchParams;
    const include = searchParams.get('include')?.split(',') || ['stats', 'courses', 'modules', 'activity'];
    const activityLimit = parseInt(searchParams.get('activityLimit') || '10', 10);

    const result: Record<string, unknown> = {};

    // Fetch requested data in parallel
    const promises: Promise<void>[] = [];

    if (include.includes('stats')) {
      promises.push(
        getUserLearningStats(userId).then(stats => {
          result.stats = stats;
        })
      );
    }

    if (include.includes('courses')) {
      promises.push(
        getUserCourseProgress(userId).then(courses => {
          result.courses = courses;
        })
      );
    }

    if (include.includes('modules')) {
      promises.push(
        getModuleProgressWithThinkific(userId).then(modules => {
          result.modules = modules;
        })
      );
    }

    if (include.includes('activity')) {
      promises.push(
        getRecentLearningActivity(userId, activityLimit).then(activity => {
          result.recentActivity = activity;
        })
      );
    }

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      userId,
      ...result,
    });

  } catch (error) {
    console.error('Unified progress error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch learning progress' },
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/learning/progress/unified
// Trigger sync between Thinkific and local progress
// ============================================

export async function POST() {
  try {
    const session = await getSession();

    if (!session.user || !session.userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.userId;

    // Get user's Thinkific ID
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('thinkific_user_id')
      .eq('id', userId)
      .single();

    if (!profile?.thinkific_user_id) {
      return NextResponse.json({
        success: false,
        message: 'No Thinkific account linked',
      });
    }

    // Import and call sync function
    const { syncThinkificToLocal } = await import('@/lib/learning-progress');
    await syncThinkificToLocal(userId, profile.thinkific_user_id);

    return NextResponse.json({
      success: true,
      message: 'Progress synced successfully',
    });

  } catch (error) {
    console.error('Progress sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync progress' },
      { status: 500 }
    );
  }
}
