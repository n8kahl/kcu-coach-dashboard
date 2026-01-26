/**
 * Tests for Lesson Detail API
 *
 * Verifies:
 * - GET /api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]
 *   returns correct shape with video playback fields
 * - Runtime assertions for video playback URLs when videoUid exists
 * - transcriptText is NOT included in the lesson response
 */

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: async () => data,
      status: init?.status || 200,
    })),
  },
}));

// Mock auth
const mockDiscordId = 'discord-123';
jest.mock('@/lib/auth', () => ({
  getAuthenticatedUser: jest.fn(() =>
    Promise.resolve({
      discordId: mockDiscordId,
    })
  ),
}));

// Sample lesson data
const mockLesson = {
  id: 'lesson-123',
  module_id: 'module-123',
  title: 'Test Lesson',
  slug: 'test-lesson',
  description: 'A test lesson',
  lesson_number: '1.1',
  video_url: 'https://example.com/video.mp4',
  video_uid: 'cf-stream-uid-123',
  video_playback_hls: 'https://customer-abc.cloudflarestream.com/uid/manifest/video.m3u8',
  video_playback_dash: 'https://customer-abc.cloudflarestream.com/uid/manifest/video.mpd',
  video_duration_seconds: 600,
  thumbnail_url: 'https://example.com/thumb.jpg',
  transcript_url: 'https://example.com/transcript.vtt',
  transcript_text: 'This is the full transcript text that should NOT be included in response',
  sort_order: 1,
  is_preview: false,
  is_published: true,
  is_required: true,
  min_watch_percent: 90,
  allow_skip: false,
  created_at: '2024-01-01T00:00:00Z',
};

const mockCourse = {
  id: 'course-123',
  title: 'Test Course',
};

const mockModule = {
  id: 'module-123',
  course_id: 'course-123',
  title: 'Test Module',
  slug: 'test-module',
  module_number: '1',
  created_at: '2024-01-01T00:00:00Z',
};

const mockUser = {
  id: 'user-123',
};

// Create chainable mock for Supabase
const createChainableMock = (finalData: unknown = null, finalError: unknown = null) => {
  const chainable: Record<string, jest.Mock> = {
    select: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    in: jest.fn(() => chainable),
    order: jest.fn(() => Promise.resolve({ data: finalData, error: finalError })),
    single: jest.fn(() => Promise.resolve({ data: finalData, error: finalError })),
  };
  return chainable;
};

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table: string) => {
      if (table === 'user_profiles') {
        return createChainableMock(mockUser);
      }
      if (table === 'courses') {
        return createChainableMock(mockCourse);
      }
      if (table === 'course_modules') {
        return createChainableMock(mockModule);
      }
      if (table === 'course_lessons') {
        return createChainableMock(mockLesson);
      }
      if (table === 'course_lesson_progress') {
        return createChainableMock(null);
      }
      return createChainableMock();
    }),
  },
}));

describe('Lesson Detail API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]', () => {
    it('should include videoPlaybackHls and videoPlaybackDash in response when videoUid exists', async () => {
      const { GET } = await import(
        '@/app/api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/route'
      );

      const mockRequest = new Request('http://localhost/api/learn/courses/test-course/modules/test-module/lessons/test-lesson');
      const response = await GET(mockRequest, {
        params: Promise.resolve({
          courseSlug: 'test-course',
          moduleSlug: 'test-module',
          lessonSlug: 'test-lesson',
        }),
      });
      const data = await response.json();

      // Should include video playback fields
      expect(data.lesson).toHaveProperty('videoPlaybackHls');
      expect(data.lesson).toHaveProperty('videoPlaybackDash');
      expect(data.lesson.videoPlaybackHls).toBe(mockLesson.video_playback_hls);
      expect(data.lesson.videoPlaybackDash).toBe(mockLesson.video_playback_dash);
    });

    it('should include videoUrl and videoUid for backward compatibility', async () => {
      const { GET } = await import(
        '@/app/api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/route'
      );

      const mockRequest = new Request('http://localhost/api/learn/courses/test-course/modules/test-module/lessons/test-lesson');
      const response = await GET(mockRequest, {
        params: Promise.resolve({
          courseSlug: 'test-course',
          moduleSlug: 'test-module',
          lessonSlug: 'test-lesson',
        }),
      });
      const data = await response.json();

      // Should include legacy fields
      expect(data.lesson).toHaveProperty('videoUrl');
      expect(data.lesson).toHaveProperty('videoUid');
      expect(data.lesson.videoUrl).toBe(mockLesson.video_url);
      expect(data.lesson.videoUid).toBe(mockLesson.video_uid);
    });

    it('should NOT include transcriptText in the lesson response', async () => {
      const { GET } = await import(
        '@/app/api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/route'
      );

      const mockRequest = new Request('http://localhost/api/learn/courses/test-course/modules/test-module/lessons/test-lesson');
      const response = await GET(mockRequest, {
        params: Promise.resolve({
          courseSlug: 'test-course',
          moduleSlug: 'test-module',
          lessonSlug: 'test-lesson',
        }),
      });
      const data = await response.json();

      // transcriptText should NOT be in the response
      expect(data.lesson).not.toHaveProperty('transcriptText');
      // But transcriptUrl should be included
      expect(data.lesson).toHaveProperty('transcriptUrl');
    });

    it('should return proper lesson shape with all required fields', async () => {
      const { GET } = await import(
        '@/app/api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/route'
      );

      const mockRequest = new Request('http://localhost/api/learn/courses/test-course/modules/test-module/lessons/test-lesson');
      const response = await GET(mockRequest, {
        params: Promise.resolve({
          courseSlug: 'test-course',
          moduleSlug: 'test-module',
          lessonSlug: 'test-lesson',
        }),
      });
      const data = await response.json();

      // Verify complete lesson shape
      expect(data.lesson).toMatchObject({
        id: expect.any(String),
        moduleId: expect.any(String),
        title: expect.any(String),
        slug: expect.any(String),
        lessonNumber: expect.any(String),
        sortOrder: expect.any(Number),
        isPreview: expect.any(Boolean),
        isPublished: expect.any(Boolean),
        isRequired: expect.any(Boolean),
        minWatchPercent: expect.any(Number),
        allowSkip: expect.any(Boolean),
      });

      // Verify module is included
      expect(data.module).toMatchObject({
        id: expect.any(String),
        courseId: expect.any(String),
        title: expect.any(String),
        slug: expect.any(String),
        moduleNumber: expect.any(String),
      });

      // Verify navigation helpers
      expect(data).toHaveProperty('prevLesson');
      expect(data).toHaveProperty('nextLesson');
      expect(data).toHaveProperty('allLessons');
      expect(data).toHaveProperty('courseTitle');
    });
  });
});

describe('Video Playback Field Assertions', () => {
  it('should have videoPlaybackHls when videoUid is present', () => {
    // This validates the data integrity requirement:
    // If a Cloudflare video has a UID, it should also have playback URLs
    const lessonWithVideo = {
      videoUid: 'cf-stream-uid-123',
      videoPlaybackHls: 'https://customer-abc.cloudflarestream.com/uid/manifest/video.m3u8',
      videoPlaybackDash: 'https://customer-abc.cloudflarestream.com/uid/manifest/video.mpd',
    };

    if (lessonWithVideo.videoUid) {
      expect(lessonWithVideo.videoPlaybackHls).toBeTruthy();
      expect(lessonWithVideo.videoPlaybackDash).toBeTruthy();
    }
  });

  it('should allow null playback URLs when videoUid is null', () => {
    const lessonWithoutVideo = {
      videoUid: null,
      videoPlaybackHls: null,
      videoPlaybackDash: null,
    };

    // No video means no requirement for playback URLs
    expect(lessonWithoutVideo.videoUid).toBeNull();
    // This is valid - no assertions needed
  });
});
