/**
 * Unified Learning Progress API Route
 *
 * Returns combined progress data from Thinkific and local KCU Coach.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const include = searchParams.get('include')?.split(',') || ['stats', 'courses', 'modules', 'activity'];
    const activityLimit = parseInt(searchParams.get('activityLimit') || '10', 10);

    const result: Record<string, unknown> = {};

    // Fetch requested data in parallel
    const promises: Promise<void>[] = [];

    if (include.includes('stats')) {
      promises.push(
        getUserLearningStats(user.id).then(stats => {
          result.stats = stats;
        })
      );
    }

    if (include.includes('courses')) {
      promises.push(
        getUserCourseProgress(user.id).then(courses => {
          result.courses = courses;
        })
      );
    }

    if (include.includes('modules')) {
      promises.push(
        getModuleProgressWithThinkific(user.id).then(modules => {
          result.modules = modules;
        })
      );
    }

    if (include.includes('activity')) {
      promises.push(
        getRecentLearningActivity(user.id, activityLimit).then(activity => {
          result.recentActivity = activity;
        })
      );
    }

    await Promise.all(promises);

    return NextResponse.json({
      success: true,
      userId: user.id,
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's Thinkific ID
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('thinkific_user_id')
      .eq('id', user.id)
      .single();

    if (!profile?.thinkific_user_id) {
      return NextResponse.json({
        success: false,
        message: 'No Thinkific account linked',
      });
    }

    // Import and call sync function
    const { syncThinkificToLocal } = await import('@/lib/learning-progress');
    await syncThinkificToLocal(user.id, profile.thinkific_user_id);

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
