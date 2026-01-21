/**
 * Tests for Bulk Publish API
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
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  },
}));

import { POST } from '@/app/api/admin/content/bulk-publish/route';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

describe('POST /api/admin/content/bulk-publish', () => {
  const mockGetSession = getSession as jest.Mock;
  const mockSupabase = supabaseAdmin as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthorized users', async () => {
    mockGetSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish', type: 'course', id: 'course-1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for missing parameters', async () => {
    mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

    const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
      method: 'POST',
      body: JSON.stringify({ action: 'publish' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 for invalid action', async () => {
    mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

    const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
      method: 'POST',
      body: JSON.stringify({ action: 'invalid', type: 'course', id: 'course-1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  describe('publish course', () => {
    it('should publish course without cascade', async () => {
      mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish',
          type: 'course',
          id: 'course-1',
          cascade: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.affected.courses).toBe(1);
    });

    it('should publish course with cascade', async () => {
      mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

      const mockModules = [{ id: 'module-1' }, { id: 'module-2' }];
      const mockLessons = [{ id: 'lesson-1' }, { id: 'lesson-2' }];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'courses') {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'course_modules') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockModules, error: null }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'course_lessons') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: mockLessons, error: null }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return mockSupabase;
      });

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
        method: 'POST',
        body: JSON.stringify({
          action: 'publish',
          type: 'course',
          id: 'course-1',
          cascade: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('unpublish', () => {
    it('should unpublish lesson', async () => {
      mockGetSession.mockResolvedValue({ userId: 'admin-1', isAdmin: true });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/admin/content/bulk-publish', {
        method: 'POST',
        body: JSON.stringify({
          action: 'unpublish',
          type: 'lesson',
          id: 'lesson-1',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.affected.lessons).toBe(1);
    });
  });
});
