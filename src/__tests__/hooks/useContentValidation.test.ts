/**
 * Tests for useContentValidation hook
 *
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useContentValidation, validateLessonLocally, validateModuleLocally, validateCourseLocally } from '@/hooks/useContentValidation';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useContentValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate', () => {
    it('should return validation result on success', async () => {
      const mockResult = {
        valid: true,
        canPublish: true,
        issues: [],
        summary: { errors: 0, warnings: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      });

      const { result } = renderHook(() => useContentValidation());

      let validationResult: typeof mockResult | undefined;
      await act(async () => {
        validationResult = await result.current.validate('lesson', 'lesson-123');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/admin/content/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'lesson', id: 'lesson-123' }),
      });

      expect(validationResult).toEqual(mockResult);
      expect(result.current.lastResult).toEqual(mockResult);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      });

      const { result } = renderHook(() => useContentValidation());

      let validationResult: { valid: boolean; canPublish: boolean } | undefined;
      await act(async () => {
        validationResult = await result.current.validate('lesson', 'invalid-id');
      });

      expect(validationResult?.valid).toBe(false);
      expect(validationResult?.canPublish).toBe(false);
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useContentValidation());

      let validationResult: { valid: boolean; issues: { message: string }[] } | undefined;
      await act(async () => {
        validationResult = await result.current.validate('course', 'course-123');
      });

      expect(validationResult?.valid).toBe(false);
      expect(validationResult?.issues[0].message).toContain('Failed to connect');
    });

    it('should set isValidating during validation', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useContentValidation());

      expect(result.current.isValidating).toBe(false);

      let validatePromise: Promise<unknown>;
      act(() => {
        validatePromise = result.current.validate('module', 'module-123');
      });

      expect(result.current.isValidating).toBe(true);

      await act(async () => {
        resolvePromise!({
          ok: true,
          json: async () => ({ valid: true, canPublish: true, issues: [], summary: { errors: 0, warnings: 0 } }),
        });
        await validatePromise;
      });

      expect(result.current.isValidating).toBe(false);
    });
  });

  describe('clearResult', () => {
    it('should clear the last result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ valid: true, canPublish: true, issues: [], summary: { errors: 0, warnings: 0 } }),
      });

      const { result } = renderHook(() => useContentValidation());

      await act(async () => {
        await result.current.validate('lesson', 'lesson-123');
      });

      expect(result.current.lastResult).not.toBeNull();

      act(() => {
        result.current.clearResult();
      });

      expect(result.current.lastResult).toBeNull();
    });
  });
});

describe('validateLessonLocally', () => {
  it('should return error for missing title', () => {
    const issues = validateLessonLocally({
      title: '',
      slug: 'test',
      videoUrl: 'https://example.com/video',
    });

    expect(issues.some(i => i.type === 'error' && i.field === 'title')).toBe(true);
  });

  it('should return error for missing video', () => {
    const issues = validateLessonLocally({
      title: 'Test Lesson',
      slug: 'test',
      videoUrl: null,
      videoUid: null,
    });

    expect(issues.some(i => i.type === 'error' && i.field === 'video')).toBe(true);
  });

  it('should return error for non-ready video status', () => {
    const issues = validateLessonLocally({
      title: 'Test Lesson',
      slug: 'test',
      videoUid: 'abc123',
      videoStatus: 'processing',
    });

    expect(issues.some(i => i.type === 'error' && i.field === 'videoStatus')).toBe(true);
  });

  it('should return warning for missing description', () => {
    const issues = validateLessonLocally({
      title: 'Test Lesson',
      slug: 'test',
      videoUrl: 'https://example.com/video',
      description: null,
    });

    expect(issues.some(i => i.type === 'warning' && i.field === 'description')).toBe(true);
  });

  it('should return no errors for complete lesson', () => {
    const issues = validateLessonLocally({
      title: 'Test Lesson',
      slug: 'test',
      videoUrl: 'https://example.com/video',
      description: 'A test lesson',
      transcriptText: 'This is the transcript',
    });

    const errors = issues.filter(i => i.type === 'error');
    expect(errors).toHaveLength(0);
  });
});

describe('validateModuleLocally', () => {
  it('should return error for missing lessons', () => {
    const issues = validateModuleLocally({
      title: 'Test Module',
      slug: 'test',
      lessons: [],
    });

    expect(issues.some(i => i.type === 'error' && i.field === 'lessons')).toBe(true);
  });

  it('should return no errors for complete module', () => {
    const issues = validateModuleLocally({
      title: 'Test Module',
      slug: 'test',
      moduleNumber: '1',
      description: 'A test module',
      lessons: [{}],
    });

    const errors = issues.filter(i => i.type === 'error');
    expect(errors).toHaveLength(0);
  });
});

describe('validateCourseLocally', () => {
  it('should return error for missing modules', () => {
    const issues = validateCourseLocally({
      title: 'Test Course',
      slug: 'test',
      modules: [],
    });

    expect(issues.some(i => i.type === 'error' && i.field === 'modules')).toBe(true);
  });

  it('should return warning for missing thumbnail', () => {
    const issues = validateCourseLocally({
      title: 'Test Course',
      slug: 'test',
      modules: [{}],
      thumbnailUrl: null,
    });

    expect(issues.some(i => i.type === 'warning' && i.field === 'thumbnail')).toBe(true);
  });
});
