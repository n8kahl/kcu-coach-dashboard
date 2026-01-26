/**
 * Tests for Learning URL Utilities
 *
 * Ensures consistent URL generation across the codebase
 */

import {
  getLessonUrl,
  getLessonResolverUrl,
  getModuleUrl,
  getCourseUrl,
  getLessonUrlSafe,
  getLearnUrl,
  getModuleQuizUrl,
  parseLearningUrl,
} from '@/lib/learning/urls';

describe('Learning URL Utilities', () => {
  describe('getLessonUrl', () => {
    it('should generate canonical lesson URL with all three slugs', () => {
      expect(getLessonUrl('ltp-fundamentals', 'module-1', 'intro-lesson')).toBe(
        '/learn/ltp-fundamentals/module-1/intro-lesson'
      );
    });

    it('should handle slugs with hyphens', () => {
      expect(getLessonUrl('advanced-trading', 'risk-management', 'position-sizing')).toBe(
        '/learn/advanced-trading/risk-management/position-sizing'
      );
    });
  });

  describe('getLessonResolverUrl', () => {
    it('should generate resolver URL with module and lesson slugs', () => {
      expect(getLessonResolverUrl('module-1', 'intro-lesson')).toBe(
        '/learn/lesson/module-1/intro-lesson'
      );
    });
  });

  describe('getModuleUrl', () => {
    it('should generate module URL with course and module slugs', () => {
      expect(getModuleUrl('ltp-fundamentals', 'module-1')).toBe(
        '/learn/ltp-fundamentals/module-1'
      );
    });
  });

  describe('getCourseUrl', () => {
    it('should generate course URL', () => {
      expect(getCourseUrl('ltp-fundamentals')).toBe('/learn/ltp-fundamentals');
    });
  });

  describe('getLessonUrlSafe', () => {
    it('should return canonical URL when courseSlug is provided', () => {
      expect(getLessonUrlSafe('module-1', 'lesson-1', 'ltp-course')).toBe(
        '/learn/ltp-course/module-1/lesson-1'
      );
    });

    it('should return resolver URL when courseSlug is not provided', () => {
      expect(getLessonUrlSafe('module-1', 'lesson-1')).toBe(
        '/learn/lesson/module-1/lesson-1'
      );
    });

    it('should return resolver URL when courseSlug is undefined', () => {
      expect(getLessonUrlSafe('module-1', 'lesson-1', undefined)).toBe(
        '/learn/lesson/module-1/lesson-1'
      );
    });
  });

  describe('getLearnUrl', () => {
    it('should return the learn hub URL', () => {
      expect(getLearnUrl()).toBe('/learn');
    });
  });

  describe('getModuleQuizUrl', () => {
    it('should generate quiz URL for a module', () => {
      expect(getModuleQuizUrl('ltp-course', 'module-1')).toBe('/learn/quiz/module-1');
    });
  });

  describe('parseLearningUrl', () => {
    it('should parse hub URL', () => {
      expect(parseLearningUrl('/learn')).toEqual({ type: 'hub' });
      expect(parseLearningUrl('/learn/')).toEqual({ type: 'hub' });
    });

    it('should parse course URL', () => {
      expect(parseLearningUrl('/learn/ltp-fundamentals')).toEqual({
        type: 'course',
        courseSlug: 'ltp-fundamentals',
      });
    });

    it('should parse module URL', () => {
      expect(parseLearningUrl('/learn/ltp-fundamentals/module-1')).toEqual({
        type: 'module',
        courseSlug: 'ltp-fundamentals',
        moduleSlug: 'module-1',
      });
    });

    it('should parse lesson URL', () => {
      expect(parseLearningUrl('/learn/ltp-fundamentals/module-1/intro-lesson')).toEqual({
        type: 'lesson',
        courseSlug: 'ltp-fundamentals',
        moduleSlug: 'module-1',
        lessonSlug: 'intro-lesson',
      });
    });

    it('should parse resolver URL', () => {
      expect(parseLearningUrl('/learn/lesson/module-1/intro-lesson')).toEqual({
        type: 'resolver',
        moduleSlug: 'module-1',
        lessonSlug: 'intro-lesson',
      });
    });

    it('should return null for invalid URLs', () => {
      expect(parseLearningUrl('/invalid')).toBeNull();
      expect(parseLearningUrl('/learning/module')).toBeNull();
      expect(parseLearningUrl('')).toBeNull();
    });

    it('should handle trailing slashes', () => {
      expect(parseLearningUrl('/learn/ltp-fundamentals/')).toEqual({
        type: 'course',
        courseSlug: 'ltp-fundamentals',
      });
    });
  });
});
