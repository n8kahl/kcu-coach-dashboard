/**
 * Supabase Admin Utilities for Bulk Import
 *
 * Direct database operations for course/module/lesson management.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabase = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return supabase;
}

// ============================================
// Types
// ============================================

export interface Course {
  id: string;
  title: string;
  slug: string;
  description?: string;
  thumbnail_url?: string;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  description?: string;
  module_number?: string;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

export interface CourseLesson {
  id: string;
  module_id: string;
  title: string;
  slug: string;
  description?: string;
  lesson_number?: string;
  sort_order: number;
  video_uid?: string;
  video_url?: string;
  video_duration_seconds?: number;
  video_status: string;
  transcript_text?: string;
  is_published: boolean;
  created_at: string;
}

// ============================================
// Course Operations
// ============================================

export async function findCourseBySlug(slug: string): Promise<Course | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Error finding course: ${error.message}`);
  }

  return data;
}

export async function createCourse(course: {
  title: string;
  slug: string;
  description?: string;
}): Promise<Course> {
  // Get max sort order
  const { data: existing } = await getSupabaseAdmin()
    .from('courses')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await getSupabaseAdmin()
    .from('courses')
    .insert({
      title: course.title,
      slug: course.slug,
      description: course.description,
      is_published: false,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating course: ${error.message}`);
  }

  return data;
}

export async function getOrCreateCourse(
  title: string,
  slug: string,
  description?: string
): Promise<Course> {
  const existing = await findCourseBySlug(slug);
  if (existing) {
    return existing;
  }
  return createCourse({ title, slug, description });
}

// ============================================
// Module Operations
// ============================================

export async function findModuleBySlug(
  courseId: string,
  slug: string
): Promise<CourseModule | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('course_modules')
    .select('*')
    .eq('course_id', courseId)
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Error finding module: ${error.message}`);
  }

  return data;
}

export async function createModule(module: {
  courseId: string;
  title: string;
  slug: string;
  moduleNumber?: string;
  sortOrder: number;
  description?: string;
}): Promise<CourseModule> {
  const { data, error } = await getSupabaseAdmin()
    .from('course_modules')
    .insert({
      course_id: module.courseId,
      title: module.title,
      slug: module.slug,
      module_number: module.moduleNumber,
      sort_order: module.sortOrder,
      description: module.description,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating module: ${error.message}`);
  }

  return data;
}

export async function getOrCreateModule(
  courseId: string,
  title: string,
  slug: string,
  moduleNumber: string,
  sortOrder: number,
  description?: string
): Promise<CourseModule> {
  const existing = await findModuleBySlug(courseId, slug);
  if (existing) {
    return existing;
  }
  return createModule({
    courseId,
    title,
    slug,
    moduleNumber,
    sortOrder,
    description,
  });
}

// ============================================
// Lesson Operations
// ============================================

export async function findLessonBySlug(
  moduleId: string,
  slug: string
): Promise<CourseLesson | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('course_lessons')
    .select('*')
    .eq('module_id', moduleId)
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Error finding lesson: ${error.message}`);
  }

  return data;
}

export async function createLesson(lesson: {
  moduleId: string;
  title: string;
  slug: string;
  lessonNumber?: string;
  sortOrder: number;
  description?: string;
}): Promise<CourseLesson> {
  const { data, error } = await getSupabaseAdmin()
    .from('course_lessons')
    .insert({
      module_id: lesson.moduleId,
      title: lesson.title,
      slug: lesson.slug,
      lesson_number: lesson.lessonNumber,
      sort_order: lesson.sortOrder,
      description: lesson.description,
      video_status: 'pending',
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error creating lesson: ${error.message}`);
  }

  return data;
}

export async function updateLesson(
  lessonId: string,
  updates: {
    video_uid?: string;
    video_url?: string;
    video_duration_seconds?: number;
    video_status?: string;
    video_playback_hls?: string;
    transcript_text?: string;
  }
): Promise<CourseLesson> {
  const { data, error } = await getSupabaseAdmin()
    .from('course_lessons')
    .update(updates)
    .eq('id', lessonId)
    .select()
    .single();

  if (error) {
    throw new Error(`Error updating lesson: ${error.message}`);
  }

  return data;
}

export async function getOrCreateLesson(
  moduleId: string,
  title: string,
  slug: string,
  lessonNumber: string,
  sortOrder: number,
  description?: string
): Promise<{ lesson: CourseLesson; created: boolean }> {
  const existing = await findLessonBySlug(moduleId, slug);
  if (existing) {
    return { lesson: existing, created: false };
  }
  const lesson = await createLesson({
    moduleId,
    title,
    slug,
    lessonNumber,
    sortOrder,
    description,
  });
  return { lesson, created: true };
}

// ============================================
// Utility Functions
// ============================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}
