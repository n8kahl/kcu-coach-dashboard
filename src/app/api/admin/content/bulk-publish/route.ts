/**
 * Admin Bulk Publish API
 *
 * Allows bulk publishing/unpublishing of courses, modules, and lessons.
 * Supports cascading operations (e.g., publish course and all children).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface BulkPublishRequest {
  action: 'publish' | 'unpublish';
  type: 'course' | 'module' | 'lesson';
  id: string;
  cascade?: boolean; // Also publish/unpublish children
}

interface BulkPublishResult {
  success: boolean;
  affected: {
    courses: number;
    modules: number;
    lessons: number;
  };
  errors: string[];
}

/**
 * POST /api/admin/content/bulk-publish
 * Bulk publish or unpublish content
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: BulkPublishRequest = await request.json();
    const { action, type, id, cascade = false } = body;

    if (!action || !type || !id) {
      return NextResponse.json({ error: 'action, type, and id are required' }, { status: 400 });
    }

    if (!['publish', 'unpublish'].includes(action)) {
      return NextResponse.json({ error: 'action must be publish or unpublish' }, { status: 400 });
    }

    if (!['course', 'module', 'lesson'].includes(type)) {
      return NextResponse.json({ error: 'type must be course, module, or lesson' }, { status: 400 });
    }

    const isPublished = action === 'publish';
    const result: BulkPublishResult = {
      success: true,
      affected: { courses: 0, modules: 0, lessons: 0 },
      errors: [],
    };

    switch (type) {
      case 'course':
        await publishCourse(id, isPublished, cascade, result);
        break;
      case 'module':
        await publishModule(id, isPublished, cascade, result);
        break;
      case 'lesson':
        await publishLesson(id, isPublished, result);
        break;
    }

    result.success = result.errors.length === 0;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in bulk publish:', error);
    return NextResponse.json({ error: 'Failed to bulk publish' }, { status: 500 });
  }
}

async function publishCourse(
  courseId: string,
  isPublished: boolean,
  cascade: boolean,
  result: BulkPublishResult
) {
  // Update course
  const { error: courseError } = await supabaseAdmin
    .from('courses')
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq('id', courseId);

  if (courseError) {
    result.errors.push(`Failed to update course: ${courseError.message}`);
    return;
  }
  result.affected.courses = 1;

  // Cascade to modules if requested
  if (cascade) {
    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select('id')
      .eq('course_id', courseId);

    if (modulesError) {
      result.errors.push(`Failed to fetch modules: ${modulesError.message}`);
      return;
    }

    for (const module of modules || []) {
      await publishModule(module.id, isPublished, true, result);
    }
  }
}

async function publishModule(
  moduleId: string,
  isPublished: boolean,
  cascade: boolean,
  result: BulkPublishResult
) {
  // Update module
  const { error: moduleError } = await supabaseAdmin
    .from('course_modules')
    .update({ is_published: isPublished })
    .eq('id', moduleId);

  if (moduleError) {
    result.errors.push(`Failed to update module: ${moduleError.message}`);
    return;
  }
  result.affected.modules++;

  // Cascade to lessons if requested
  if (cascade) {
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from('course_lessons')
      .select('id')
      .eq('module_id', moduleId);

    if (lessonsError) {
      result.errors.push(`Failed to fetch lessons: ${lessonsError.message}`);
      return;
    }

    for (const lesson of lessons || []) {
      await publishLesson(lesson.id, isPublished, result);
    }
  }
}

async function publishLesson(
  lessonId: string,
  isPublished: boolean,
  result: BulkPublishResult
) {
  const { error: lessonError } = await supabaseAdmin
    .from('course_lessons')
    .update({ is_published: isPublished })
    .eq('id', lessonId);

  if (lessonError) {
    result.errors.push(`Failed to update lesson: ${lessonError.message}`);
    return;
  }
  result.affected.lessons++;
}
