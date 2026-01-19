/**
 * Admin Content API - Single Module Operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/content/modules/[id]
 * Get a single module
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: module, error } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;
    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    return NextResponse.json({
      module: {
        id: module.id,
        courseId: module.course_id,
        title: module.title,
        slug: module.slug,
        description: module.description,
        moduleNumber: module.module_number,
        thumbnailUrl: module.thumbnail_url,
        sortOrder: module.sort_order,
        isPublished: module.is_published,
        isRequired: module.is_required,
        requiresQuizPass: module.requires_quiz_pass,
        minQuizScore: module.min_quiz_score,
        unlockAfterModuleId: module.unlock_after_module_id,
        unlockAfterDays: module.unlock_after_days,
        createdAt: module.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching module:', error);
    return NextResponse.json({ error: 'Failed to fetch module' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/content/modules/[id]
 * Update a module
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
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

    const updateData: Record<string, unknown> = {};
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (moduleNumber !== undefined) updateData.module_number = moduleNumber;
    if (thumbnailUrl !== undefined) updateData.thumbnail_url = thumbnailUrl;
    if (isPublished !== undefined) updateData.is_published = isPublished;
    if (isRequired !== undefined) updateData.is_required = isRequired;
    if (requiresQuizPass !== undefined) updateData.requires_quiz_pass = requiresQuizPass;
    if (minQuizScore !== undefined) updateData.min_quiz_score = minQuizScore;
    if (unlockAfterModuleId !== undefined) updateData.unlock_after_module_id = unlockAfterModuleId;
    if (unlockAfterDays !== undefined) updateData.unlock_after_days = unlockAfterDays;

    const { data: module, error } = await supabaseAdmin
      .from('course_modules')
      .update(updateData)
      .eq('id', params.id)
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
      },
    });
  } catch (error) {
    console.error('Error updating module:', error);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/content/modules/[id]
 * Delete a module
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabaseAdmin
      .from('course_modules')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting module:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
