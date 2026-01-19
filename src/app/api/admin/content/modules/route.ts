/**
 * Admin Content API - Modules
 *
 * CRUD operations for course modules.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/content/modules
 * Create a new module
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      courseId,
      title,
      slug,
      description,
      moduleNumber,
      isPublished,
      isRequired,
      requiresQuizPass,
      minQuizScore,
      unlockAfterModuleId,
      unlockAfterDays,
      thumbnailUrl,
    } = body;

    if (!courseId || !title) {
      return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
    }

    // Get max sort order for this course
    const { data: maxOrder } = await supabaseAdmin
      .from('course_modules')
      .select('sort_order')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data: module, error } = await supabaseAdmin
      .from('course_modules')
      .insert({
        course_id: courseId,
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, '-'),
        description: description || null,
        module_number: moduleNumber || `${sortOrder}`,
        thumbnail_url: thumbnailUrl || null,
        sort_order: sortOrder,
        is_published: isPublished ?? true,
        is_required: isRequired ?? true,
        requires_quiz_pass: requiresQuizPass ?? false,
        min_quiz_score: minQuizScore ?? 70,
        unlock_after_module_id: unlockAfterModuleId || null,
        unlock_after_days: unlockAfterDays || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      module: {
        id: module.id,
        courseId: module.course_id,
        title: module.title,
        slug: module.slug,
        description: module.description,
        moduleNumber: module.module_number,
        sortOrder: module.sort_order,
        isPublished: module.is_published,
        isRequired: module.is_required,
        requiresQuizPass: module.requires_quiz_pass,
        minQuizScore: module.min_quiz_score,
        createdAt: module.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating module:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}
