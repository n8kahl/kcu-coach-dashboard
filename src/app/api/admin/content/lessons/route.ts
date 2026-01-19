/**
 * Admin Content API - Lessons
 *
 * CRUD operations for course lessons.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/content/lessons
 * Create a new lesson
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      moduleId,
      title,
      slug,
      description,
      lessonNumber,
      isPublished,
      isRequired,
      isPreview,
      allowSkip,
      minWatchPercent,
    } = body;

    if (!moduleId || !title) {
      return NextResponse.json({ error: 'moduleId and title are required' }, { status: 400 });
    }

    // Get max sort order for this module
    const { data: maxOrder } = await supabaseAdmin
      .from('course_lessons')
      .select('sort_order')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data: lesson, error } = await supabaseAdmin
      .from('course_lessons')
      .insert({
        module_id: moduleId,
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, '-'),
        description: description || null,
        lesson_number: lessonNumber || `${sortOrder}`,
        sort_order: sortOrder,
        is_published: isPublished ?? false,
        is_required: isRequired ?? true,
        is_preview: isPreview ?? false,
        allow_skip: allowSkip ?? false,
        min_watch_percent: minWatchPercent ?? 80,
        video_status: 'pending',
        resources: [],
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      lesson: {
        id: lesson.id,
        moduleId: lesson.module_id,
        title: lesson.title,
        slug: lesson.slug,
        description: lesson.description,
        lessonNumber: lesson.lesson_number,
        sortOrder: lesson.sort_order,
        isPublished: lesson.is_published,
        isRequired: lesson.is_required,
        isPreview: lesson.is_preview,
        videoStatus: lesson.video_status,
        createdAt: lesson.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating lesson:', error);
    return NextResponse.json({ error: 'Failed to create lesson' }, { status: 500 });
  }
}
