/**
 * @deprecated DEPRECATED - Thinkific Integration Types
 *
 * These types are being phased out as part of the content system consolidation.
 * See migration 030_unify_content_system.sql which drops the thinkific_* tables.
 *
 * The new native schema uses:
 * - courses → Course type from '@/types/learning'
 * - course_modules → CourseModule type from '@/types/learning'
 * - course_lessons → CourseLesson type from '@/types/learning'
 *
 * Files that still import from this module need to be migrated:
 * - src/lib/thinkific-api.ts → update to sync to course_* tables
 * - src/lib/learning-progress.ts → update to use course_* tables
 * - src/app/api/thinkific/webhooks/route.ts → deprecate or update
 * - src/app/api/admin/thinkific/sync/route.ts → update sync target
 *
 * NOTE: The Thinkific API client (thinkific-api.ts) will continue to FETCH
 * from Thinkific, but now writes directly to course_* tables instead of
 * thinkific_* tables.
 *
 * TODO: Remove this file after all dependent code is migrated.
 */

// ============ API Response Types ============

export interface ThinkificPaginatedResponse<T> {
  items: T[];
  meta: {
    pagination: {
      current_page: number;
      next_page: number | null;
      prev_page: number | null;
      total_pages: number;
      total_items: number;
    };
  };
}

// ============ Course Types ============

export interface ThinkificCourse {
  id: number;
  name: string;
  slug: string;
  subtitle: string | null;
  product_id: number;
  description: string | null;
  intro_video_youtube: string | null;
  contact_information: string | null;
  keywords: string | null;
  duration: string | null;
  banner_image_url: string | null;
  course_card_image_url: string | null;
  intro_video_wistia_identifier: string | null;
  administrator_user_ids: number[];
  chapter_ids: number[];
  reviews_enabled: boolean;
  instructor_id: number | null;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface ThinkificCourseDetails extends ThinkificCourse {
  chapters: ThinkificChapter[];
}

// ============ Chapter Types ============

export interface ThinkificChapter {
  id: number;
  name: string;
  description: string | null;
  position: number;
  course_id: number;
  content_ids: number[];
  created_at: string;
  updated_at: string;
}

// ============ Content Types ============

export type ThinkificContentType =
  | 'video'
  | 'text'
  | 'quiz'
  | 'survey'
  | 'download'
  | 'presentation'
  | 'multimedia'
  | 'audio'
  | 'pdf_embed'
  | 'html'
  | 'exams'
  | 'assignment'
  | 'live_event'
  | 'brillium_exam';

export interface ThinkificContent {
  id: number;
  name: string;
  chapter_id: number;
  content_type: ThinkificContentType;
  position: number;
  free_preview: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;

  // Video-specific
  video_duration_in_seconds?: number;
  video_type?: 'youtube' | 'vimeo' | 'wistia' | 'custom';
  video_identifier?: string;

  // Quiz-specific
  passing_score?: number;
  time_limit_in_minutes?: number;

  // Download-specific
  download_url?: string;

  // Text/HTML content
  html_content?: string;
}

// ============ User Types ============

export interface ThinkificUser {
  id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  company: string | null;
  email: string;
  external_source: string | null;
  external_id: string | null;
  custom_profile_fields: Record<string, unknown>[];
  affiliate_code: string | null;
  affiliate_commission: number | null;
  affiliate_commission_type: string | null;
  affiliate_payout_email: string | null;
  roles: string[];
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// ============ Enrollment Types ============

export interface ThinkificEnrollment {
  id: number;
  user_id: number;
  user_email: string;
  user_name: string;
  course_id: number;
  course_name: string;
  percentage_completed: number;
  completed: boolean;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  created_at: string;
  expired: boolean;
  expiry_date: string | null;
  is_free_trial: boolean;
  activated_at: string | null;
}

// ============ Progress Types ============

export interface ThinkificLessonProgress {
  id: number;
  enrollment_id: number;
  content_id: number;
  content_type: ThinkificContentType;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============ Webhook Event Types ============

export interface ThinkificWebhookPayload {
  resource: string;
  action: string;
  payload: {
    id: number;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface ThinkificUserSignupPayload {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
}

export interface ThinkificEnrollmentPayload {
  id: number;
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  percentage_completed: number;
  completed: boolean;
  activated_at: string | null;
  created_at: string;
}

export interface ThinkificLessonCompletedPayload {
  id: number;
  enrollment_id: number;
  content_id: number;
  content_type: ThinkificContentType;
  user_id: number;
  user_email: string;
  course_id: number;
  course_name: string;
  completed_at: string;
}

// ============ Local Database Types ============

export interface ThinkificCourseDB {
  id: string;
  thinkific_id: number;
  name: string;
  slug: string | null;
  description: string | null;
  instructor_id: number | null;
  reviews_enabled: boolean;
  course_card_image_url: string | null;
  banner_image_url: string | null;
  intro_video_youtube: string | null;
  contact_information: string | null;
  keywords: string | null;
  duration: string | null;
  chapter_count: number;
  content_count: number;
  local_module_slug: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface ThinkificChapterDB {
  id: string;
  thinkific_id: number;
  course_id: number;
  name: string;
  description: string | null;
  position: number;
  content_count: number;
  created_at: string;
  synced_at: string;
}

export interface ThinkificContentDB {
  id: string;
  thinkific_id: number;
  chapter_id: number;
  course_id: number;
  name: string;
  content_type: ThinkificContentType;
  position: number;
  video_duration: number | null;
  video_url: string | null;
  video_provider: string | null;
  passing_score: number | null;
  time_limit: number | null;
  text_content: string | null;
  free_preview: boolean;
  description: string | null;
  created_at: string;
  synced_at: string;
}

// ============ Sync Types ============

export interface ThinkificSyncResult {
  success: boolean;
  courses_synced: number;
  chapters_synced: number;
  contents_synced: number;
  errors: string[];
  synced_at: string;
}

export interface ThinkificSyncStatus {
  last_sync: string | null;
  courses_count: number;
  chapters_count: number;
  contents_count: number;
  is_syncing: boolean;
}

// ============ Mapped Learning Types ============

export interface ThinkificModule {
  id: string;
  thinkific_id: number;
  slug: string;
  title: string;
  description: string;
  image_url: string | null;
  lesson_count: number;
  duration: string | null;
  order: number;
}

export interface ThinkificLesson {
  id: string;
  thinkific_id: number;
  module_id: number;
  title: string;
  description: string | null;
  content_type: ThinkificContentType;
  duration_seconds: number | null;
  position: number;
  free_preview: boolean;
  video_provider: string | null;
  video_identifier: string | null;
}
