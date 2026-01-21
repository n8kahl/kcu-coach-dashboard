/**
 * Admin Content Validation API
 *
 * Validates content completeness before publishing.
 * Returns warnings and errors for incomplete content.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  canPublish: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

/**
 * POST /api/admin/content/validate
 * Validate content before publishing
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json({ error: 'type and id are required' }, { status: 400 });
    }

    let result: ValidationResult;

    switch (type) {
      case 'course':
        result = await validateCourse(id);
        break;
      case 'module':
        result = await validateModule(id);
        break;
      case 'lesson':
        result = await validateLesson(id);
        break;
      default:
        return NextResponse.json({ error: 'Invalid type. Must be course, module, or lesson' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating content:', error);
    return NextResponse.json({ error: 'Failed to validate content' }, { status: 500 });
  }
}

async function validateCourse(courseId: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Fetch course with modules and lessons
  const { data: course, error } = await supabaseAdmin
    .from('courses')
    .select(`
      *,
      modules:course_modules(
        *,
        lessons:course_lessons(*)
      )
    `)
    .eq('id', courseId)
    .single();

  if (error || !course) {
    return {
      valid: false,
      canPublish: false,
      issues: [{ type: 'error', field: 'course', message: 'Course not found' }],
      summary: { errors: 1, warnings: 0 },
    };
  }

  // Course-level validation
  if (!course.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Course title is required' });
  }

  if (!course.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Course slug is required' });
  }

  if (!course.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Course description is recommended' });
  }

  if (!course.thumbnail_url) {
    issues.push({ type: 'warning', field: 'thumbnailUrl', message: 'Course thumbnail is recommended' });
  }

  // Check for modules
  const modules = course.modules || [];
  if (modules.length === 0) {
    issues.push({ type: 'error', field: 'modules', message: 'Course must have at least one module' });
  }

  // Check for published modules
  const publishedModules = modules.filter((m: { is_published: boolean }) => m.is_published);
  if (modules.length > 0 && publishedModules.length === 0) {
    issues.push({ type: 'error', field: 'modules', message: 'At least one module must be published' });
  }

  // Check each module
  for (const module of modules) {
    const lessons = module.lessons || [];
    if (lessons.length === 0 && module.is_published) {
      issues.push({
        type: 'warning',
        field: `module:${module.id}`,
        message: `Module "${module.title}" has no lessons`,
      });
    }

    // Check for lessons without video in published modules
    const lessonsWithoutVideo = lessons.filter(
      (l: { video_url: string | null; video_uid: string | null; is_published: boolean }) =>
        l.is_published && !l.video_url && !l.video_uid
    );
    if (lessonsWithoutVideo.length > 0) {
      issues.push({
        type: 'warning',
        field: `module:${module.id}:lessons`,
        message: `Module "${module.title}" has ${lessonsWithoutVideo.length} published lesson(s) without video`,
      });
    }
  }

  const errors = issues.filter(i => i.type === 'error').length;
  const warnings = issues.filter(i => i.type === 'warning').length;

  return {
    valid: errors === 0,
    canPublish: errors === 0,
    issues,
    summary: { errors, warnings },
  };
}

async function validateModule(moduleId: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Fetch module with lessons
  const { data: module, error } = await supabaseAdmin
    .from('course_modules')
    .select(`
      *,
      lessons:course_lessons(*)
    `)
    .eq('id', moduleId)
    .single();

  if (error || !module) {
    return {
      valid: false,
      canPublish: false,
      issues: [{ type: 'error', field: 'module', message: 'Module not found' }],
      summary: { errors: 1, warnings: 0 },
    };
  }

  // Module-level validation
  if (!module.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Module title is required' });
  }

  if (!module.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Module slug is required' });
  }

  if (!module.module_number?.trim()) {
    issues.push({ type: 'warning', field: 'moduleNumber', message: 'Module number is recommended' });
  }

  if (!module.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Module description is recommended' });
  }

  // Check for lessons
  const lessons = module.lessons || [];
  if (lessons.length === 0) {
    issues.push({ type: 'error', field: 'lessons', message: 'Module must have at least one lesson' });
  }

  // Check for published lessons
  const publishedLessons = lessons.filter((l: { is_published: boolean }) => l.is_published);
  if (lessons.length > 0 && publishedLessons.length === 0) {
    issues.push({ type: 'error', field: 'lessons', message: 'At least one lesson must be published' });
  }

  // Check each lesson for video
  for (const lesson of lessons) {
    if (lesson.is_published && !lesson.video_url && !lesson.video_uid) {
      issues.push({
        type: 'warning',
        field: `lesson:${lesson.id}`,
        message: `Lesson "${lesson.title}" has no video content`,
      });
    }
  }

  // Check quiz configuration
  if (module.requires_quiz_pass) {
    const { data: quizQuestions } = await supabaseAdmin
      .from('course_quiz_questions')
      .select('id')
      .eq('module_id', moduleId);

    if (!quizQuestions || quizQuestions.length === 0) {
      issues.push({
        type: 'error',
        field: 'quiz',
        message: 'Module requires quiz pass but has no quiz questions',
      });
    }
  }

  const errors = issues.filter(i => i.type === 'error').length;
  const warnings = issues.filter(i => i.type === 'warning').length;

  return {
    valid: errors === 0,
    canPublish: errors === 0,
    issues,
    summary: { errors, warnings },
  };
}

async function validateLesson(lessonId: string): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  // Fetch lesson
  const { data: lesson, error } = await supabaseAdmin
    .from('course_lessons')
    .select('*')
    .eq('id', lessonId)
    .single();

  if (error || !lesson) {
    return {
      valid: false,
      canPublish: false,
      issues: [{ type: 'error', field: 'lesson', message: 'Lesson not found' }],
      summary: { errors: 1, warnings: 0 },
    };
  }

  // Lesson-level validation
  if (!lesson.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Lesson title is required' });
  }

  if (!lesson.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Lesson slug is required' });
  }

  // Video validation - critical for publishing
  const hasVideo = lesson.video_url || lesson.video_uid;
  if (!hasVideo) {
    issues.push({ type: 'error', field: 'video', message: 'Lesson must have a video' });
  } else {
    // Check video status
    if (lesson.video_uid && lesson.video_status !== 'ready') {
      issues.push({
        type: 'error',
        field: 'videoStatus',
        message: `Video is not ready (status: ${lesson.video_status})`,
      });
    }
  }

  // Duration validation
  if (hasVideo && !lesson.video_duration_seconds) {
    issues.push({ type: 'warning', field: 'duration', message: 'Video duration is not set' });
  }

  // Description is recommended
  if (!lesson.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Lesson description is recommended' });
  }

  // Lesson number is recommended
  if (!lesson.lesson_number?.trim()) {
    issues.push({ type: 'warning', field: 'lessonNumber', message: 'Lesson number is recommended' });
  }

  // Transcript is recommended
  if (!lesson.transcript_text?.trim()) {
    issues.push({ type: 'warning', field: 'transcript', message: 'Transcript is recommended for searchability' });
  }

  // Thumbnail is recommended
  if (!lesson.thumbnail_url) {
    issues.push({ type: 'warning', field: 'thumbnail', message: 'Thumbnail is recommended' });
  }

  const errors = issues.filter(i => i.type === 'error').length;
  const warnings = issues.filter(i => i.type === 'warning').length;

  return {
    valid: errors === 0,
    canPublish: errors === 0,
    issues,
    summary: { errors, warnings },
  };
}
