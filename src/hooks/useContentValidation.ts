/**
 * useContentValidation Hook
 *
 * Validates content before publishing and provides feedback.
 */

import { useState, useCallback } from 'react';

interface ValidationIssue {
  type: 'error' | 'warning';
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  canPublish: boolean;
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

interface UseContentValidationReturn {
  /** Validate content before publishing */
  validate: (type: 'course' | 'module' | 'lesson', id: string) => Promise<ValidationResult>;
  /** Whether validation is in progress */
  isValidating: boolean;
  /** Last validation result */
  lastResult: ValidationResult | null;
  /** Clear validation result */
  clearResult: () => void;
  /** Get errors only */
  errors: ValidationIssue[];
  /** Get warnings only */
  warnings: ValidationIssue[];
}

export function useContentValidation(): UseContentValidationReturn {
  const [isValidating, setIsValidating] = useState(false);
  const [lastResult, setLastResult] = useState<ValidationResult | null>(null);

  const validate = useCallback(async (
    type: 'course' | 'module' | 'lesson',
    id: string
  ): Promise<ValidationResult> => {
    setIsValidating(true);

    try {
      const response = await fetch('/api/admin/content/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const result: ValidationResult = {
          valid: false,
          canPublish: false,
          issues: [{ type: 'error', field: 'api', message: errorData.error || 'Validation failed' }],
          summary: { errors: 1, warnings: 0 },
        };
        setLastResult(result);
        return result;
      }

      const result: ValidationResult = await response.json();
      setLastResult(result);
      return result;
    } catch (error) {
      const result: ValidationResult = {
        valid: false,
        canPublish: false,
        issues: [{ type: 'error', field: 'network', message: 'Failed to connect to server' }],
        summary: { errors: 1, warnings: 0 },
      };
      setLastResult(result);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  const errors = lastResult?.issues.filter(i => i.type === 'error') || [];
  const warnings = lastResult?.issues.filter(i => i.type === 'warning') || [];

  return {
    validate,
    isValidating,
    lastResult,
    clearResult,
    errors,
    warnings,
  };
}

/**
 * Quick validation helpers for common checks
 */

export function validateLessonLocally(lesson: {
  title?: string;
  slug?: string;
  videoUrl?: string | null;
  videoUid?: string | null;
  videoStatus?: string;
  description?: string | null;
  transcriptText?: string | null;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!lesson.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Title is required' });
  }

  if (!lesson.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Slug is required' });
  }

  const hasVideo = lesson.videoUrl || lesson.videoUid;
  if (!hasVideo) {
    issues.push({ type: 'error', field: 'video', message: 'Video is required' });
  } else if (lesson.videoUid && lesson.videoStatus !== 'ready') {
    issues.push({ type: 'error', field: 'videoStatus', message: `Video is not ready (${lesson.videoStatus})` });
  }

  if (!lesson.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Description is recommended' });
  }

  if (!lesson.transcriptText?.trim()) {
    issues.push({ type: 'warning', field: 'transcript', message: 'Transcript is recommended' });
  }

  return issues;
}

export function validateModuleLocally(module: {
  title?: string;
  slug?: string;
  moduleNumber?: string;
  description?: string | null;
  lessons?: unknown[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!module.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Title is required' });
  }

  if (!module.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Slug is required' });
  }

  if (!module.moduleNumber?.trim()) {
    issues.push({ type: 'warning', field: 'moduleNumber', message: 'Module number is recommended' });
  }

  if (!module.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Description is recommended' });
  }

  if (!module.lessons || module.lessons.length === 0) {
    issues.push({ type: 'error', field: 'lessons', message: 'Module must have at least one lesson' });
  }

  return issues;
}

export function validateCourseLocally(course: {
  title?: string;
  slug?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  modules?: unknown[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!course.title?.trim()) {
    issues.push({ type: 'error', field: 'title', message: 'Title is required' });
  }

  if (!course.slug?.trim()) {
    issues.push({ type: 'error', field: 'slug', message: 'Slug is required' });
  }

  if (!course.description?.trim()) {
    issues.push({ type: 'warning', field: 'description', message: 'Description is recommended' });
  }

  if (!course.thumbnailUrl) {
    issues.push({ type: 'warning', field: 'thumbnail', message: 'Thumbnail is recommended' });
  }

  if (!course.modules || course.modules.length === 0) {
    issues.push({ type: 'error', field: 'modules', message: 'Course must have at least one module' });
  }

  return issues;
}
