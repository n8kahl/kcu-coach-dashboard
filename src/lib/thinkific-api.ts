/**
 * Thinkific REST API Client
 *
 * Fetches courses, chapters, and content from Thinkific LMS.
 * Used to sync Thinkific content to local database for Learning section.
 *
 * API Documentation: https://developers.thinkific.com/api/api-documentation/
 */

import { env } from './env';
import { supabaseAdmin } from './supabase';
import type {
  ThinkificCourse,
  ThinkificChapter,
  ThinkificContent,
  ThinkificEnrollment,
  ThinkificPaginatedResponse,
  ThinkificSyncResult,
  ThinkificSyncStatus,
} from '@/types/thinkific';

// ============================================
// Configuration
// ============================================

const THINKIFIC_API_BASE = 'https://api.thinkific.com/api/public/v1';
const THINKIFIC_SUBDOMAIN = env.THINKIFIC_SUBDOMAIN || 'kaycapitals';
const THINKIFIC_API_KEY = env.THINKIFIC_API_KEY;

// ============================================
// API Client Class
// ============================================

export class ThinkificAPI {
  private subdomain: string;
  private apiKey: string;

  constructor(subdomain?: string, apiKey?: string) {
    this.subdomain = subdomain || THINKIFIC_SUBDOMAIN;
    this.apiKey = apiKey || THINKIFIC_API_KEY || '';

    if (!this.apiKey) {
      console.warn('ThinkificAPI: No API key provided. API calls will fail.');
    }
  }

  // ============================================
  // HTTP Request Helper
  // ============================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Thinkific API key is not configured');
    }

    const url = `${THINKIFIC_API_BASE}${endpoint}`;

    // Detect if API key is a JWT token (starts with eyJ) or legacy API key
    const isJwtToken = this.apiKey.startsWith('eyJ');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (isJwtToken) {
      // Use Bearer authentication for JWT tokens
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else {
      // Use legacy X-Auth headers for simple API keys
      headers['X-Auth-API-Key'] = this.apiKey;
      headers['X-Auth-Subdomain'] = this.subdomain;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Thinkific API error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  }

  // ============================================
  // Paginated Request Helper
  // ============================================

  private async requestPaginated<T>(
    endpoint: string,
    limit: number = 25
  ): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const paginatedEndpoint = `${endpoint}${separator}page=${page}&limit=${limit}`;

      // Thinkific API can return { items: [] } or just an array
      const rawResponse = await this.request<unknown>(paginatedEndpoint);

      let items: T[] = [];
      let nextPage: number | null = null;

      // Handle different response formats
      if (Array.isArray(rawResponse)) {
        // Direct array response
        items = rawResponse as T[];
        hasMore = false;
      } else if (rawResponse && typeof rawResponse === 'object') {
        const response = rawResponse as Record<string, unknown>;

        // Try 'items' key first (standard paginated response)
        if (Array.isArray(response.items)) {
          items = response.items as T[];
          const meta = response.meta as { pagination?: { next_page?: number | null } } | undefined;
          nextPage = meta?.pagination?.next_page ?? null;
        }
        // Fallback: look for array values in response
        else {
          const arrayKey = Object.keys(response).find(key => Array.isArray(response[key]));
          if (arrayKey) {
            items = response[arrayKey] as T[];
            const meta = response.meta as { pagination?: { next_page?: number | null } } | undefined;
            nextPage = meta?.pagination?.next_page ?? null;
          }
        }
      }

      allItems.push(...items);

      if (nextPage === null || items.length < limit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allItems;
  }

  // ============================================
  // Course Endpoints
  // ============================================

  /**
   * Get all courses from Thinkific
   */
  async getCourses(): Promise<ThinkificCourse[]> {
    return this.requestPaginated<ThinkificCourse>('/courses');
  }

  /**
   * Get a single course by ID
   */
  async getCourse(courseId: number): Promise<ThinkificCourse> {
    return this.request<ThinkificCourse>(`/courses/${courseId}`);
  }

  // ============================================
  // Chapter Endpoints
  // ============================================

  /**
   * Get all chapters for a course
   */
  async getChapters(courseId: number): Promise<ThinkificChapter[]> {
    return this.requestPaginated<ThinkificChapter>(
      `/courses/${courseId}/chapters`
    );
  }

  /**
   * Get a single chapter by ID
   */
  async getChapter(chapterId: number): Promise<ThinkificChapter> {
    return this.request<ThinkificChapter>(`/chapters/${chapterId}`);
  }

  // ============================================
  // Content Endpoints
  // ============================================

  /**
   * Get all contents for a chapter
   */
  async getContents(chapterId: number): Promise<ThinkificContent[]> {
    return this.requestPaginated<ThinkificContent>(
      `/chapters/${chapterId}/contents`
    );
  }

  /**
   * Get a single content item by ID
   */
  async getContent(contentId: number): Promise<ThinkificContent> {
    return this.request<ThinkificContent>(`/contents/${contentId}`);
  }

  // ============================================
  // Enrollment Endpoints
  // ============================================

  /**
   * Get all enrollments for a user
   */
  async getUserEnrollments(userId: number): Promise<ThinkificEnrollment[]> {
    return this.requestPaginated<ThinkificEnrollment>(
      `/users/${userId}/enrollments`
    );
  }

  /**
   * Get all enrollments (admin)
   */
  async getAllEnrollments(): Promise<ThinkificEnrollment[]> {
    return this.requestPaginated<ThinkificEnrollment>('/enrollments');
  }

  /**
   * Get a single enrollment by ID
   */
  async getEnrollment(enrollmentId: number): Promise<ThinkificEnrollment> {
    return this.request<ThinkificEnrollment>(`/enrollments/${enrollmentId}`);
  }

  // ============================================
  // Full Sync - Courses, Chapters, Contents
  // ============================================

  /**
   * Sync all courses, chapters, and contents to local database
   */
  async syncAllCourses(): Promise<ThinkificSyncResult> {
    const errors: string[] = [];
    let coursesSynced = 0;
    let chaptersSynced = 0;
    let contentsSynced = 0;

    try {
      // 1. Fetch all courses
      console.log('[ThinkificSync] Fetching courses...');
      console.log(`[ThinkificSync] Using subdomain: ${this.subdomain}`);
      console.log(`[ThinkificSync] API key configured: ${!!this.apiKey}`);

      const courses = await this.getCourses();
      console.log(`[ThinkificSync] Found ${courses.length} courses`);

      if (courses.length > 0) {
        console.log('[ThinkificSync] First course sample:', JSON.stringify(courses[0], null, 2));
      }

      for (const course of courses) {
        try {
          // 2. Upsert course to database
          await this.upsertCourse(course);
          coursesSynced++;

          // 3. Fetch chapters for this course
          console.log(
            `[ThinkificSync] Fetching chapters for course ${course.id}: ${course.name}`
          );
          const chapters = await this.getChapters(course.id);

          for (const chapter of chapters) {
            try {
              // 4. Upsert chapter
              await this.upsertChapter(chapter, course.id);
              chaptersSynced++;

              // 5. Fetch contents for this chapter
              const contents = await this.getContents(chapter.id);

              for (const content of contents) {
                try {
                  // 6. Upsert content
                  await this.upsertContent(content, chapter.id, course.id);
                  contentsSynced++;
                } catch (contentError) {
                  const msg = `Failed to sync content ${content.id}: ${contentError}`;
                  console.error(`[ThinkificSync] ${msg}`);
                  errors.push(msg);
                }
              }
            } catch (chapterError) {
              const msg = `Failed to sync chapter ${chapter.id}: ${chapterError}`;
              console.error(`[ThinkificSync] ${msg}`);
              errors.push(msg);
            }
          }

          // Update course with counts
          await this.updateCourseCounts(course.id);
        } catch (courseError) {
          const msg = `Failed to sync course ${course.id}: ${courseError}`;
          console.error(`[ThinkificSync] ${msg}`);
          errors.push(msg);
        }
      }

      console.log(
        `[ThinkificSync] Complete: ${coursesSynced} courses, ${chaptersSynced} chapters, ${contentsSynced} contents`
      );

      return {
        success: errors.length === 0,
        courses_synced: coursesSynced,
        chapters_synced: chaptersSynced,
        contents_synced: contentsSynced,
        errors,
        synced_at: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[ThinkificSync] Fatal error:', error);
      return {
        success: false,
        courses_synced: coursesSynced,
        chapters_synced: chaptersSynced,
        contents_synced: contentsSynced,
        errors: [
          ...errors,
          `Fatal sync error: ${error instanceof Error ? error.message : String(error)}`,
        ],
        synced_at: new Date().toISOString(),
      };
    }
  }

  // ============================================
  // Database Upsert Helpers
  // ============================================

  private async upsertCourse(course: ThinkificCourse): Promise<void> {
    console.log(`[ThinkificSync] Upserting course ${course.id}: ${course.name}`);
    const { error } = await supabaseAdmin.from('thinkific_courses').upsert(
      {
        thinkific_id: course.id,
        name: course.name,
        slug: course.slug,
        description: course.description,
        instructor_id: course.instructor_id,
        reviews_enabled: course.reviews_enabled ?? false,
        course_card_image_url: course.course_card_image_url,
        banner_image_url: course.banner_image_url,
        intro_video_youtube: course.intro_video_youtube,
        contact_information: course.contact_information,
        keywords: course.keywords,
        duration: course.duration,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'thinkific_id' }
    );

    if (error) {
      console.error(`[ThinkificSync] Course upsert error:`, error);
      throw new Error(`Course upsert failed: ${error.message} (${error.code})`);
    }
  }

  private async upsertChapter(
    chapter: ThinkificChapter,
    courseId: number
  ): Promise<void> {
    console.log(`[ThinkificSync] Upserting chapter ${chapter.id}: ${chapter.name}`);
    const { error } = await supabaseAdmin.from('thinkific_chapters').upsert(
      {
        thinkific_id: chapter.id,
        course_id: courseId,
        name: chapter.name,
        description: chapter.description,
        position: chapter.position ?? 0,
        content_count: chapter.content_ids?.length || 0,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'thinkific_id' }
    );

    if (error) {
      console.error(`[ThinkificSync] Chapter upsert error:`, error);
      throw new Error(`Chapter upsert failed: ${error.message} (${error.code})`);
    }
  }

  private async upsertContent(
    content: ThinkificContent,
    chapterId: number,
    courseId: number
  ): Promise<void> {
    // Default content_type to 'unknown' if not provided by API
    const contentType = content.content_type || 'unknown';
    console.log(`[ThinkificSync] Upserting content ${content.id}: ${content.name} (${contentType})`);
    const { error } = await supabaseAdmin.from('thinkific_contents').upsert(
      {
        thinkific_id: content.id,
        chapter_id: chapterId,
        course_id: courseId,
        name: content.name,
        content_type: contentType,
        position: content.position ?? 0,
        video_duration: content.video_duration_in_seconds || null,
        video_url: content.video_identifier || null,
        video_provider: content.video_type || null,
        passing_score: content.passing_score || null,
        time_limit: content.time_limit_in_minutes || null,
        text_content: content.html_content || null,
        free_preview: content.free_preview ?? false,
        description: content.description,
        synced_at: new Date().toISOString(),
      },
      { onConflict: 'thinkific_id' }
    );

    if (error) {
      console.error(`[ThinkificSync] Content upsert error:`, error);
      throw new Error(`Content upsert failed: ${error.message} (${error.code})`);
    }
  }

  private async updateCourseCounts(courseId: number): Promise<void> {
    // Count chapters
    const { count: chapterCount } = await supabaseAdmin
      .from('thinkific_chapters')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // Count contents
    const { count: contentCount } = await supabaseAdmin
      .from('thinkific_contents')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId);

    // Update course
    await supabaseAdmin
      .from('thinkific_courses')
      .update({
        chapter_count: chapterCount || 0,
        content_count: contentCount || 0,
      })
      .eq('thinkific_id', courseId);
  }

  // ============================================
  // Sync Status
  // ============================================

  /**
   * Get current sync status from database
   */
  async getSyncStatus(): Promise<ThinkificSyncStatus> {
    // Get latest synced course timestamp
    const { data: latestCourse } = await supabaseAdmin
      .from('thinkific_courses')
      .select('synced_at')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    // Get counts
    const { count: coursesCount } = await supabaseAdmin
      .from('thinkific_courses')
      .select('*', { count: 'exact', head: true });

    const { count: chaptersCount } = await supabaseAdmin
      .from('thinkific_chapters')
      .select('*', { count: 'exact', head: true });

    const { count: contentsCount } = await supabaseAdmin
      .from('thinkific_contents')
      .select('*', { count: 'exact', head: true });

    return {
      last_sync: latestCourse?.synced_at || null,
      courses_count: coursesCount || 0,
      chapters_count: chaptersCount || 0,
      contents_count: contentsCount || 0,
      is_syncing: false, // Would need to track this in a separate table/cache
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let thinkificAPIInstance: ThinkificAPI | null = null;

export function getThinkificAPI(): ThinkificAPI {
  if (!thinkificAPIInstance) {
    thinkificAPIInstance = new ThinkificAPI();
  }
  return thinkificAPIInstance;
}

// ============================================
// Convenience Functions
// ============================================

/**
 * Check if Thinkific API is configured
 */
export function isThinkificConfigured(): boolean {
  return !!(THINKIFIC_API_KEY && THINKIFIC_SUBDOMAIN);
}

/**
 * Sync all Thinkific courses to local database
 */
export async function syncThinkificCourses(): Promise<ThinkificSyncResult> {
  const api = getThinkificAPI();
  return api.syncAllCourses();
}

/**
 * Get Thinkific sync status
 */
export async function getThinkificSyncStatus(): Promise<ThinkificSyncStatus> {
  const api = getThinkificAPI();
  return api.getSyncStatus();
}

// ============================================
// Learning Section Helpers
// ============================================

/**
 * Get all courses formatted for Learning page
 */
export async function getThinkificCoursesForLearning() {
  const { data: courses, error } = await supabaseAdmin
    .from('thinkific_courses')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  return courses.map((course) => ({
    id: course.id,
    thinkific_id: course.thinkific_id,
    slug: course.slug || `course-${course.thinkific_id}`,
    title: course.name,
    description: course.description || '',
    image_url: course.course_card_image_url || course.banner_image_url,
    lesson_count: course.content_count || 0,
    chapter_count: course.chapter_count || 0,
    duration: course.duration,
  }));
}

/**
 * Get chapters and contents for a specific course
 */
export async function getThinkificCourseDetails(courseId: number) {
  // Get course
  const { data: course, error: courseError } = await supabaseAdmin
    .from('thinkific_courses')
    .select('*')
    .eq('thinkific_id', courseId)
    .single();

  if (courseError) throw courseError;

  // Get chapters
  const { data: chapters, error: chaptersError } = await supabaseAdmin
    .from('thinkific_chapters')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (chaptersError) throw chaptersError;

  // Get contents grouped by chapter
  const { data: contents, error: contentsError } = await supabaseAdmin
    .from('thinkific_contents')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (contentsError) throw contentsError;

  // Group contents by chapter
  const contentsByChapter = contents.reduce(
    (acc, content) => {
      const chapterId = content.chapter_id;
      if (!acc[chapterId]) acc[chapterId] = [];
      acc[chapterId].push(content);
      return acc;
    },
    {} as Record<number, typeof contents>
  );

  return {
    course,
    chapters: chapters.map((chapter) => ({
      ...chapter,
      contents: contentsByChapter[chapter.thinkific_id] || [],
    })),
  };
}

/**
 * Get a single lesson/content by ID
 */
export async function getThinkificContent(contentId: number) {
  const { data, error } = await supabaseAdmin
    .from('thinkific_contents')
    .select(
      `
      *,
      chapter:thinkific_chapters!chapter_id(
        name,
        course_id,
        course:thinkific_courses!course_id(name, slug)
      )
    `
    )
    .eq('thinkific_id', contentId)
    .single();

  if (error) throw error;
  return data;
}
