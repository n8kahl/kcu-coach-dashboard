/**
 * Content Gating Utilities
 *
 * Helpers for checking course/module/lesson access on the server side.
 */

import { supabaseAdmin } from '@/lib/supabase';

export interface AccessCheckResult {
  hasAccess: boolean;
  reason?: string;
  accessType?: 'full' | 'preview' | 'trial' | 'public';
  enrolledAt?: string;
  expiresAt?: string | null;
  completionDeadline?: string | null;
  complianceStatus?: string;
}

/**
 * Check if a user has access to a course
 */
export async function checkCourseAccess(
  userId: string,
  courseId: string
): Promise<AccessCheckResult> {
  // Get course info
  const { data: course } = await supabaseAdmin
    .from('courses')
    .select('is_gated, is_published')
    .eq('id', courseId)
    .single();

  if (!course) {
    return { hasAccess: false, reason: 'Course not found' };
  }

  if (!course.is_published) {
    return { hasAccess: false, reason: 'Course not published' };
  }

  // If not gated, anyone can access
  if (!course.is_gated) {
    return { hasAccess: true, accessType: 'public' };
  }

  // Check user's access record
  const { data: access } = await supabaseAdmin
    .from('user_course_access')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (!access) {
    return { hasAccess: false, reason: 'Enrollment required' };
  }

  // Check if expired
  if (access.expires_at && new Date(access.expires_at) < new Date()) {
    return {
      hasAccess: false,
      reason: 'Access expired',
      accessType: 'expired' as 'full',
    };
  }

  // Check access type
  if (access.access_type === 'expired') {
    return { hasAccess: false, reason: 'Access revoked' };
  }

  return {
    hasAccess: true,
    accessType: access.access_type,
    enrolledAt: access.enrolled_at,
    expiresAt: access.expires_at,
    completionDeadline: access.completion_deadline,
    complianceStatus: access.compliance_status,
  };
}

/**
 * Check if a user can access a specific module
 */
export async function checkModuleAccess(
  userId: string,
  moduleId: string
): Promise<AccessCheckResult> {
  // Get module info
  const { data: module } = await supabaseAdmin
    .from('course_modules')
    .select(`
      *,
      course:courses(is_gated, is_published),
      unlock_module:course_modules!unlock_after_module_id(title)
    `)
    .eq('id', moduleId)
    .single();

  if (!module) {
    return { hasAccess: false, reason: 'Module not found' };
  }

  // First check course access
  const courseAccess = await checkCourseAccess(userId, module.course_id);
  if (!courseAccess.hasAccess) {
    return courseAccess;
  }

  // Module access check disabled - all modules unlocked for development
  // TODO: Re-enable when gating is properly configured with user_course_access records
  // const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
  //   p_user_id: userId,
  //   p_module_id: moduleId,
  // });
  // if (!canAccess) {
  //   let reason = 'Module locked';
  //   if (module.unlock_after_module_id) {
  //     const unlockModule = module.unlock_module as { title: string } | null;
  //     reason = `Complete "${unlockModule?.title || 'previous module'}" first`;
  //     if (module.requires_quiz_pass) {
  //       reason += ` and pass the quiz with ${module.min_quiz_score}%`;
  //     }
  //   } else if (module.unlock_after_days) {
  //     reason = `Available ${module.unlock_after_days} days after enrollment`;
  //   }
  //   return { hasAccess: false, reason };
  // }

  return {
    hasAccess: true,
    accessType: courseAccess.accessType,
  };
}

/**
 * Check if a user can access a specific lesson
 */
export async function checkLessonAccess(
  userId: string,
  lessonId: string
): Promise<AccessCheckResult> {
  // Get lesson info
  const { data: lesson } = await supabaseAdmin
    .from('course_lessons')
    .select(`
      is_preview,
      is_published,
      module_id,
      module:course_modules(course_id)
    `)
    .eq('id', lessonId)
    .single();

  if (!lesson) {
    return { hasAccess: false, reason: 'Lesson not found' };
  }

  if (!lesson.is_published) {
    return { hasAccess: false, reason: 'Lesson not published' };
  }

  // Preview lessons bypass gating
  if (lesson.is_preview) {
    return { hasAccess: true, accessType: 'preview' };
  }

  // Check module access
  return checkModuleAccess(userId, lesson.module_id);
}

/**
 * Get accessible lessons for a user in a module
 * Returns all lessons but marks which ones are accessible
 */
export async function getAccessibleLessons(
  userId: string,
  moduleId: string
): Promise<{
  canAccessModule: boolean;
  lessons: Array<{
    id: string;
    title: string;
    slug: string;
    isPreview: boolean;
    canAccess: boolean;
  }>;
}> {
  const moduleAccess = await checkModuleAccess(userId, moduleId);

  const { data: lessons } = await supabaseAdmin
    .from('course_lessons')
    .select('id, title, slug, is_preview, is_published')
    .eq('module_id', moduleId)
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  return {
    canAccessModule: moduleAccess.hasAccess,
    lessons: (lessons || []).map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      isPreview: lesson.is_preview,
      canAccess: lesson.is_preview || moduleAccess.hasAccess,
    })),
  };
}

/**
 * Check compliance deadline status
 */
export async function checkComplianceStatus(
  userId: string,
  courseId: string
): Promise<{
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue';
  deadline: string | null;
  daysRemaining: number | null;
}> {
  const { data: access } = await supabaseAdmin
    .from('user_course_access')
    .select('compliance_status, completion_deadline')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (!access) {
    return { status: 'not_started', deadline: null, daysRemaining: null };
  }

  let daysRemaining: number | null = null;
  if (access.completion_deadline) {
    const deadline = new Date(access.completion_deadline);
    const now = new Date();
    daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Update status if overdue
    if (daysRemaining < 0 && access.compliance_status !== 'completed') {
      await supabaseAdmin
        .from('user_course_access')
        .update({ compliance_status: 'overdue' })
        .eq('user_id', userId)
        .eq('course_id', courseId);

      return {
        status: 'overdue',
        deadline: access.completion_deadline,
        daysRemaining,
      };
    }
  }

  return {
    status: access.compliance_status,
    deadline: access.completion_deadline,
    daysRemaining,
  };
}
