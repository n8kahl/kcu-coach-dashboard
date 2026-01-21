/**
 * Tests for Content Validation API
 *
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getSession: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

import { POST } from '@/app/api/admin/content/validate/route';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

describe('POST /api/admin/content/validate', () => {
  const mockGetSession = getSession as jest.Mock;
  const mockSupabase = supabaseAdmin as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthorized users', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
      method: 'POST',
      body: JSON.stringify({ type: 'lesson', id: 'test-id' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 401 for non-admin users', async () => {
    mockGetSession.mockResolvedValue({ userId: 'user-1', isAdmin: false });

    const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
      method: 'POST',
      body: JSON.stringify({ type: 'lesson', id: 'test-id' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing type or id', async () => {
    mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

    const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
      method: 'POST',
      body: JSON.stringify({ type: 'lesson' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid type', async () => {
    mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

    const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
      method: 'POST',
      body: JSON.stringify({ type: 'invalid', id: 'test-id' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  describe('lesson validation', () => {
    it('should validate a complete lesson successfully', async () => {
      mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        video_url: 'https://example.com/video.mp4',
        video_uid: null,
        video_status: 'ready',
        description: 'A test lesson',
        transcript_text: 'This is the transcript',
        lesson_number: '1',
        thumbnail_url: 'https://example.com/thumb.jpg',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockLesson, error: null }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
        method: 'POST',
        body: JSON.stringify({ type: 'lesson', id: 'lesson-1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(true);
      expect(data.canPublish).toBe(true);
      expect(data.summary.errors).toBe(0);
    });

    it('should return error for lesson without video', async () => {
      mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

      const mockLesson = {
        id: 'lesson-1',
        title: 'Test Lesson',
        slug: 'test-lesson',
        video_url: null,
        video_uid: null,
        video_status: 'pending',
        description: 'A test lesson',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockLesson, error: null }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/content/validate', {
        method: 'POST',
        body: JSON.stringify({ type: 'lesson', id: 'lesson-1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.canPublish).toBe(false);
      expect(data.issues.some((i: any) => i.field === 'video')).toBe(true);
    });
  });
});
