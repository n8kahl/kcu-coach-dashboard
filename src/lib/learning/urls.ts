/**
 * Learning URL Utilities
 *
 * Centralized URL generation for learning content to prevent drift
 * between different parts of the codebase.
 *
 * Canonical URL patterns:
 * - Course: /learn/[courseSlug]
 * - Module: /learn/[courseSlug]/[moduleSlug]
 * - Lesson: /learn/[courseSlug]/[moduleSlug]/[lessonSlug]
 * - Resolver: /learn/lesson/[moduleSlug]/[lessonSlug] (when course unknown)
 */

/**
 * Generate a canonical lesson URL with full path
 * Use when you have all three slugs (course, module, lesson)
 */
export function getLessonUrl(courseSlug: string, moduleSlug: string, lessonSlug: string): string {
  return `/learn/${courseSlug}/${moduleSlug}/${lessonSlug}`;
}

/**
 * Generate a lesson resolver URL
 * Use when course slug is unknown - the resolver will look it up
 */
export function getLessonResolverUrl(moduleSlug: string, lessonSlug: string): string {
  return `/learn/lesson/${moduleSlug}/${lessonSlug}`;
}

/**
 * Generate a module URL (course page with module context)
 */
export function getModuleUrl(courseSlug: string, moduleSlug: string): string {
  return `/learn/${courseSlug}/${moduleSlug}`;
}

/**
 * Generate a course URL
 */
export function getCourseUrl(courseSlug: string): string {
  return `/learn/${courseSlug}`;
}

/**
 * Generate a lesson URL with optional course context
 * If courseSlug is provided, returns canonical URL
 * Otherwise, returns resolver URL
 */
export function getLessonUrlSafe(
  moduleSlug: string,
  lessonSlug: string,
  courseSlug?: string
): string {
  if (courseSlug) {
    return getLessonUrl(courseSlug, moduleSlug, lessonSlug);
  }
  return getLessonResolverUrl(moduleSlug, lessonSlug);
}

/**
 * Generate the learning hub URL
 */
export function getLearnUrl(): string {
  return '/learn';
}

/**
 * Generate a quiz URL for a module
 */
export function getModuleQuizUrl(courseSlug: string, moduleSlug: string): string {
  return `/learn/quiz/${moduleSlug}`;
}

/**
 * Parse a learning URL to extract slugs
 * Returns null if URL doesn't match expected patterns
 */
export function parseLearningUrl(url: string): {
  type: 'course' | 'module' | 'lesson' | 'resolver' | 'hub';
  courseSlug?: string;
  moduleSlug?: string;
  lessonSlug?: string;
} | null {
  // Hub
  if (url === '/learn' || url === '/learn/') {
    return { type: 'hub' };
  }

  // Resolver pattern: /learn/lesson/[moduleSlug]/[lessonSlug]
  const resolverMatch = url.match(/^\/learn\/lesson\/([^/]+)\/([^/]+)\/?$/);
  if (resolverMatch) {
    return {
      type: 'resolver',
      moduleSlug: resolverMatch[1],
      lessonSlug: resolverMatch[2],
    };
  }

  // Full lesson: /learn/[courseSlug]/[moduleSlug]/[lessonSlug]
  const lessonMatch = url.match(/^\/learn\/([^/]+)\/([^/]+)\/([^/]+)\/?$/);
  if (lessonMatch) {
    return {
      type: 'lesson',
      courseSlug: lessonMatch[1],
      moduleSlug: lessonMatch[2],
      lessonSlug: lessonMatch[3],
    };
  }

  // Module: /learn/[courseSlug]/[moduleSlug]
  const moduleMatch = url.match(/^\/learn\/([^/]+)\/([^/]+)\/?$/);
  if (moduleMatch) {
    return {
      type: 'module',
      courseSlug: moduleMatch[1],
      moduleSlug: moduleMatch[2],
    };
  }

  // Course: /learn/[courseSlug]
  const courseMatch = url.match(/^\/learn\/([^/]+)\/?$/);
  if (courseMatch) {
    return {
      type: 'course',
      courseSlug: courseMatch[1],
    };
  }

  return null;
}
