/**
 * Admin Content API - Reorder Lessons
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/content/lessons/reorder
 * Update sort order for lessons within a module
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { moduleId, lessonIds } = body;

    if (!moduleId || !lessonIds || !Array.isArray(lessonIds)) {
      return NextResponse.json({ error: 'moduleId and lessonIds array are required' }, { status: 400 });
    }

    // Update sort order for each lesson
    const updates = lessonIds.map((id: string, index: number) =>
      supabaseAdmin
        .from('course_lessons')
        .update({ sort_order: index + 1 })
        .eq('id', id)
        .eq('module_id', moduleId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering lessons:', error);
    return NextResponse.json({ error: 'Failed to reorder lessons' }, { status: 500 });
  }
}
