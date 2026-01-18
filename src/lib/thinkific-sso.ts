/**
 * Thinkific SSO Integration
 *
 * Handles Single Sign-On (SSO) with Thinkific using JWT tokens.
 * Enables seamless deep-linking to courses, lessons, and specific timestamps.
 *
 * Documentation: https://support.thinkific.dev/hc/en-us/articles/4423909018135-Custom-SSO-Using-JWT
 */

import * as jose from 'jose';
import { env } from './env';

// ============================================
// Types
// ============================================

export interface ThinkificUser {
  email: string;
  firstName: string;
  lastName: string;
  externalId: string; // KCU Coach user ID
  timezone?: string;
}

export interface ThinkificSSOOptions {
  /** Path to redirect to after SSO (e.g., /courses/ltp-framework/lessons/patience-candles) */
  returnTo?: string;
  /** URL to redirect to if SSO fails */
  errorUrl?: string;
  /** Video timestamp in seconds to jump to */
  timestampSeconds?: number;
}

export interface ThinkificLesson {
  courseSlug: string;
  chapterSlug?: string;
  lessonSlug: string;
}

export interface ThinkificCourseLink {
  type: 'course' | 'lesson' | 'chapter';
  url: string;
  ssoUrl: string;
}

// ============================================
// Configuration
// ============================================

const THINKIFIC_SUBDOMAIN = env.THINKIFIC_SUBDOMAIN || 'kaycapitals';
const THINKIFIC_BASE_URL = `https://${THINKIFIC_SUBDOMAIN}.thinkific.com`;
const THINKIFIC_SSO_ENDPOINT = `${THINKIFIC_BASE_URL}/api/sso/v2/sso/jwt`;

// JWT expires in 5 minutes (Thinkific recommendation)
const JWT_EXPIRY_SECONDS = 300;

// ============================================
// JWT Generation
// ============================================

/**
 * Generate a signed JWT token for Thinkific SSO
 *
 * Note: The Thinkific API key is used as the secret to sign the JWT.
 * Per Thinkific docs: "Do not base 64 encode your API key when signing your JWT token."
 * @see https://support.thinkific.dev/hc/en-us/articles/4423909018135-Custom-SSO-Using-JWT
 */
export async function generateSSOToken(user: ThinkificUser): Promise<string> {
  // Use API key as the JWT signing secret (per Thinkific documentation)
  const secret = env.THINKIFIC_API_KEY;

  if (!secret) {
    throw new Error('THINKIFIC_API_KEY environment variable is not set. Your Thinkific API key is used to sign SSO JWT tokens.');
  }

  const secretKey = new TextEncoder().encode(secret);
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    external_id: user.externalId,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
    // Optional: timezone for user
    ...(user.timezone && { timezone: user.timezone }),
  };

  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_SECONDS}s`)
    .sign(secretKey);

  return token;
}

// ============================================
// URL Generation
// ============================================

/**
 * Build Thinkific course/lesson path
 */
export function buildThinkificPath(
  courseSlug: string,
  lessonSlug?: string,
  timestampSeconds?: number
): string {
  let path = `/courses/${courseSlug}`;

  if (lessonSlug) {
    path += `/lessons/${lessonSlug}`;
  }

  // Add timestamp parameter if provided
  if (timestampSeconds && timestampSeconds > 0) {
    path += `?t=${timestampSeconds}`;
  }

  return path;
}

/**
 * Generate a full Thinkific SSO URL
 */
export async function generateSSOUrl(
  user: ThinkificUser,
  options: ThinkificSSOOptions = {}
): Promise<string> {
  const token = await generateSSOToken(user);

  const params = new URLSearchParams({
    jwt: token,
  });

  // Add return_to parameter for deep linking
  if (options.returnTo) {
    let returnTo = options.returnTo;

    // Add timestamp to return URL if provided
    if (options.timestampSeconds && !returnTo.includes('?')) {
      returnTo += `?t=${options.timestampSeconds}`;
    } else if (options.timestampSeconds && returnTo.includes('?')) {
      returnTo += `&t=${options.timestampSeconds}`;
    }

    params.append('return_to', returnTo);
  }

  // Add error URL for failed SSO attempts
  if (options.errorUrl) {
    params.append('error_url', options.errorUrl);
  }

  return `${THINKIFIC_SSO_ENDPOINT}?${params.toString()}`;
}

/**
 * Generate SSO URL for a specific lesson with optional timestamp
 */
export async function generateLessonSSOUrl(
  user: ThinkificUser,
  lesson: ThinkificLesson,
  timestampSeconds?: number
): Promise<string> {
  const returnTo = buildThinkificPath(
    lesson.courseSlug,
    lesson.lessonSlug,
    timestampSeconds
  );

  return generateSSOUrl(user, {
    returnTo,
    errorUrl: `${env.NEXT_PUBLIC_APP_URL || ''}/learning?error=sso_failed`,
  });
}

/**
 * Generate SSO URL for a course landing page
 */
export async function generateCourseSSOUrl(
  user: ThinkificUser,
  courseSlug: string
): Promise<string> {
  const returnTo = `/courses/${courseSlug}`;

  return generateSSOUrl(user, {
    returnTo,
    errorUrl: `${env.NEXT_PUBLIC_APP_URL || ''}/learning?error=sso_failed`,
  });
}

/**
 * Generate SSO URL for the student dashboard
 */
export async function generateDashboardSSOUrl(
  user: ThinkificUser
): Promise<string> {
  return generateSSOUrl(user, {
    returnTo: '/enrollments',
    errorUrl: `${env.NEXT_PUBLIC_APP_URL || ''}/learning?error=sso_failed`,
  });
}

// ============================================
// Course/Lesson Mapping
// ============================================

/**
 * Mapping between KCU Coach module slugs and Thinkific course slugs
 * Update this based on your actual Thinkific course structure
 */
export const MODULE_TO_THINKIFIC_COURSE: Record<string, string> = {
  'fundamentals': 'trading-fundamentals',
  'price-action': 'price-action-mastery',
  'indicators': 'technical-indicators',
  'ltp-framework': 'ltp-framework',
  'strategies': 'trading-strategies',
  'entries-exits': 'entries-and-exits',
  'psychology': 'trading-psychology',
  'trading-rules': 'trading-rules-principles',
  'watchlist-setup': 'watchlist-premarket',
};

/**
 * Get Thinkific course slug from KCU Coach module slug
 */
export function getThinkificCourseSlug(kcuModuleSlug: string): string {
  return MODULE_TO_THINKIFIC_COURSE[kcuModuleSlug] || kcuModuleSlug;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Create a Thinkific link object with both direct and SSO URLs
 */
export async function createThinkificLink(
  user: ThinkificUser,
  type: 'course' | 'lesson',
  courseSlug: string,
  lessonSlug?: string,
  timestampSeconds?: number
): Promise<ThinkificCourseLink> {
  const thinkificCourseSlug = getThinkificCourseSlug(courseSlug);

  let directUrl = `${THINKIFIC_BASE_URL}/courses/${thinkificCourseSlug}`;
  if (lessonSlug) {
    directUrl += `/lessons/${lessonSlug}`;
  }
  if (timestampSeconds) {
    directUrl += `?t=${timestampSeconds}`;
  }

  const ssoUrl = lessonSlug
    ? await generateLessonSSOUrl(
        user,
        { courseSlug: thinkificCourseSlug, lessonSlug },
        timestampSeconds
      )
    : await generateCourseSSOUrl(user, thinkificCourseSlug);

  return {
    type: lessonSlug ? 'lesson' : 'course',
    url: directUrl,
    ssoUrl,
  };
}

/**
 * Generate a video timestamp link for AI coach responses
 * Returns the SSO URL that will deep-link to the video at the specified time
 */
export async function generateVideoTimestampLink(
  user: ThinkificUser,
  courseSlug: string,
  lessonSlug: string,
  startSeconds: number,
  endSeconds?: number
): Promise<{
  ssoUrl: string;
  displayTime: string;
  duration?: number;
}> {
  const ssoUrl = await generateLessonSSOUrl(
    user,
    { courseSlug: getThinkificCourseSlug(courseSlug), lessonSlug },
    startSeconds
  );

  // Format display time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  let displayTime = formatTime(startSeconds);
  let duration: number | undefined;

  if (endSeconds) {
    displayTime += ` - ${formatTime(endSeconds)}`;
    duration = endSeconds - startSeconds;
  }

  return {
    ssoUrl,
    displayTime,
    duration,
  };
}

// ============================================
// Validation & Utilities
// ============================================

/**
 * Verify that SSO is properly configured
 */
export function isSSoConfigured(): boolean {
  return !!(env.THINKIFIC_API_KEY && env.THINKIFIC_SUBDOMAIN);
}

/**
 * Get Thinkific base URL
 */
export function getThinkificBaseUrl(): string {
  return THINKIFIC_BASE_URL;
}

/**
 * Parse a Thinkific URL to extract course/lesson info
 */
export function parseThinkificUrl(url: string): {
  courseSlug?: string;
  lessonSlug?: string;
  timestamp?: number;
} | null {
  try {
    const urlObj = new URL(url);

    // Match /courses/{courseSlug}/lessons/{lessonSlug}
    const pathMatch = urlObj.pathname.match(
      /\/courses\/([^/]+)(?:\/lessons\/([^/]+))?/
    );

    if (!pathMatch) return null;

    const timestamp = urlObj.searchParams.get('t');

    return {
      courseSlug: pathMatch[1],
      lessonSlug: pathMatch[2],
      timestamp: timestamp ? parseInt(timestamp, 10) : undefined,
    };
  } catch {
    return null;
  }
}
