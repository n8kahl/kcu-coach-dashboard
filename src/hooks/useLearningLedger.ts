'use client';

/**
 * Learning Ledger Hook
 *
 * Auto-posts learning events to the compliance audit trail API.
 * Use this hook to track video pauses, quiz completions, and other learning actions.
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  LearningAuditLogInput,
  AuditAction,
  AuditResourceType,
  UserTranscript,
  TranscriptSummary,
} from '@/types/learning';

// ============================================
// TYPES
// ============================================

interface LearningContext {
  lessonId?: string;
  lessonTitle?: string;
  moduleId?: string;
  moduleTitle?: string;
  courseId?: string;
  courseTitle?: string;
}

interface VideoContext extends LearningContext {
  videoDuration: number;
}

interface QuizContext extends LearningContext {
  quizId: string;
}

interface UseLearningLedgerOptions {
  /** Context for the current learning resource */
  context?: LearningContext;
  /** Whether to auto-generate session IDs */
  autoSession?: boolean;
}

interface LogEventOptions {
  /** Override the session ID */
  sessionId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Duration in seconds */
  durationSeconds?: number;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useLearningLedger(options: UseLearningLedgerOptions = {}) {
  const { context, autoSession = true } = options;

  // Session management
  const sessionId = useRef<string | null>(null);
  const [isLogging, setIsLogging] = useState(false);

  // Video tracking state
  const videoStartTime = useRef<number>(0);
  const lastPlaybackSpeed = useRef<number>(1);
  const isVideoPlaying = useRef<boolean>(false);
  const watchedSegments = useRef<Array<{ start: number; end: number }>>([]);

  // Generate session ID on mount if autoSession is enabled
  useEffect(() => {
    if (autoSession && !sessionId.current) {
      sessionId.current = uuidv4();
    }

    return () => {
      // Cleanup: end any active video tracking
      if (isVideoPlaying.current) {
        // Fire and forget
        logEvent('video_paused', 'video', {
          durationSeconds: 0,
          metadata: { reason: 'unmount' },
        }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSession]);

  // ============================================
  // CORE LOGGING FUNCTION
  // ============================================

  const logEvent = useCallback(
    async (
      action: AuditAction,
      resourceType: AuditResourceType,
      eventOptions: LogEventOptions = {}
    ): Promise<boolean> => {
      setIsLogging(true);

      const input: LearningAuditLogInput = {
        resource_type: resourceType,
        action,
        duration_seconds: eventOptions.durationSeconds || 0,
        metadata: eventOptions.metadata || {},
        session_id: eventOptions.sessionId || sessionId.current || undefined,
        // Apply context
        resource_id: context?.lessonId,
        resource_title: context?.lessonTitle,
        module_id: context?.moduleId,
        module_title: context?.moduleTitle,
        course_id: context?.courseId,
        course_title: context?.courseTitle,
      };

      try {
        const response = await fetch('/api/user/transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        setIsLogging(false);
        return response.ok;
      } catch (error) {
        console.error('Failed to log learning event:', error);
        setIsLogging(false);
        return false;
      }
    },
    [context]
  );

  // ============================================
  // VIDEO TRACKING FUNCTIONS
  // ============================================

  /**
   * Call when video starts playing
   */
  const onVideoPlay = useCallback(
    (currentTime: number, playbackSpeed: number = 1) => {
      videoStartTime.current = currentTime;
      lastPlaybackSpeed.current = playbackSpeed;
      isVideoPlaying.current = true;

      logEvent('started', 'video', {
        metadata: {
          start_time: currentTime,
          playback_speed: playbackSpeed,
        },
      });
    },
    [logEvent]
  );

  /**
   * Call when video is paused
   */
  const onVideoPause = useCallback(
    (currentTime: number) => {
      if (!isVideoPlaying.current) return;

      isVideoPlaying.current = false;
      const watchDuration = Math.max(0, currentTime - videoStartTime.current);

      // Track watched segment
      watchedSegments.current.push({
        start: videoStartTime.current,
        end: currentTime,
      });

      logEvent('video_paused', 'video', {
        durationSeconds: Math.floor(watchDuration),
        metadata: {
          start_time: videoStartTime.current,
          end_time: currentTime,
          playback_speed: lastPlaybackSpeed.current,
        },
      });

      // Also log the segment
      logEvent('video_segment_watched', 'video', {
        durationSeconds: Math.floor(watchDuration),
        metadata: {
          start_time: videoStartTime.current,
          end_time: currentTime,
          playback_speed: lastPlaybackSpeed.current,
        },
      });
    },
    [logEvent]
  );

  /**
   * Call when video playback is resumed
   */
  const onVideoResume = useCallback(
    (currentTime: number, playbackSpeed: number = 1) => {
      videoStartTime.current = currentTime;
      lastPlaybackSpeed.current = playbackSpeed;
      isVideoPlaying.current = true;

      logEvent('video_resumed', 'video', {
        metadata: {
          resume_time: currentTime,
          playback_speed: playbackSpeed,
        },
      });
    },
    [logEvent]
  );

  /**
   * Call when user seeks in the video
   */
  const onVideoSeek = useCallback(
    (fromTime: number, toTime: number) => {
      // If playing, save the segment before the seek
      if (isVideoPlaying.current) {
        const watchDuration = Math.max(0, fromTime - videoStartTime.current);
        if (watchDuration > 0) {
          watchedSegments.current.push({
            start: videoStartTime.current,
            end: fromTime,
          });

          logEvent('video_segment_watched', 'video', {
            durationSeconds: Math.floor(watchDuration),
            metadata: {
              start_time: videoStartTime.current,
              end_time: fromTime,
              playback_speed: lastPlaybackSpeed.current,
            },
          });
        }
      }

      // Log the seek
      logEvent('video_seeked', 'video', {
        metadata: {
          from_time: fromTime,
          to_time: toTime,
          direction: toTime > fromTime ? 'forward' : 'backward',
        },
      });

      // Reset start time to seek position
      videoStartTime.current = toTime;
    },
    [logEvent]
  );

  /**
   * Call when playback speed changes
   */
  const onVideoSpeedChange = useCallback(
    (oldSpeed: number, newSpeed: number) => {
      lastPlaybackSpeed.current = newSpeed;

      logEvent('video_speed_changed', 'video', {
        metadata: {
          old_speed: oldSpeed,
          new_speed: newSpeed,
        },
      });
    },
    [logEvent]
  );

  /**
   * Call when video completes
   */
  const onVideoComplete = useCallback(
    (videoDuration: number) => {
      // Log final segment if playing
      if (isVideoPlaying.current) {
        const watchDuration = Math.max(0, videoDuration - videoStartTime.current);
        if (watchDuration > 0) {
          watchedSegments.current.push({
            start: videoStartTime.current,
            end: videoDuration,
          });

          logEvent('video_segment_watched', 'video', {
            durationSeconds: Math.floor(watchDuration),
            metadata: {
              start_time: videoStartTime.current,
              end_time: videoDuration,
              playback_speed: lastPlaybackSpeed.current,
            },
          });
        }
      }

      isVideoPlaying.current = false;

      // Calculate total unique watch time
      const totalWatchTime = watchedSegments.current.reduce(
        (acc, seg) => acc + (seg.end - seg.start),
        0
      );

      logEvent('completed', 'lesson', {
        durationSeconds: Math.floor(totalWatchTime),
        metadata: {
          video_duration: videoDuration,
          total_watch_time: totalWatchTime,
          segments_watched: watchedSegments.current.length,
          playback_speed_final: lastPlaybackSpeed.current,
        },
      });

      // Reset segments for potential replay
      watchedSegments.current = [];
    },
    [logEvent]
  );

  // ============================================
  // QUIZ TRACKING FUNCTIONS
  // ============================================

  /**
   * Call when a quiz is started
   */
  const onQuizStart = useCallback(
    (quizId: string, quizTitle?: string) => {
      logEvent('started', 'quiz', {
        metadata: {
          quiz_id: quizId,
          quiz_title: quizTitle,
        },
      });
    },
    [logEvent]
  );

  /**
   * Call when a quiz is completed
   */
  const onQuizComplete = useCallback(
    (result: {
      quizId: string;
      score: number;
      passed: boolean;
      attemptNumber: number;
      questionsCorrect: number;
      questionsTotal: number;
      timeSpentSeconds: number;
    }) => {
      const action: AuditAction = result.passed ? 'quiz_passed' : 'quiz_failed';

      // Log the attempt
      logEvent('quiz_attempt', 'quiz', {
        durationSeconds: result.timeSpentSeconds,
        metadata: {
          quiz_id: result.quizId,
          score: result.score,
          passed: result.passed,
          attempt_number: result.attemptNumber,
          questions_correct: result.questionsCorrect,
          questions_total: result.questionsTotal,
        },
      });

      // Also log pass/fail specifically
      logEvent(action, 'quiz', {
        durationSeconds: result.timeSpentSeconds,
        metadata: {
          quiz_id: result.quizId,
          score: result.score,
          attempt_number: result.attemptNumber,
        },
      });
    },
    [logEvent]
  );

  // ============================================
  // GENERAL TRACKING FUNCTIONS
  // ============================================

  /**
   * Log when a lesson is started
   */
  const onLessonStart = useCallback(
    (lessonId: string, lessonTitle?: string) => {
      logEvent('started', 'lesson', {
        metadata: {
          lesson_id: lessonId,
          lesson_title: lessonTitle,
        },
      });
    },
    [logEvent]
  );

  /**
   * Log when a module is completed
   */
  const onModuleComplete = useCallback(
    (moduleId: string, moduleTitle?: string) => {
      logEvent('completed', 'module', {
        metadata: {
          module_id: moduleId,
          module_title: moduleTitle,
        },
      });
    },
    [logEvent]
  );

  /**
   * Log when a bookmark is created
   */
  const onBookmarkCreate = useCallback(
    (timestampSeconds: number, title?: string, note?: string) => {
      logEvent('bookmark_created', 'lesson', {
        metadata: {
          timestamp_seconds: timestampSeconds,
          title,
          note,
        },
      });
    },
    [logEvent]
  );

  /**
   * Log when a note is added
   */
  const onNoteAdd = useCallback(
    (content: string, context?: string) => {
      logEvent('note_added', 'lesson', {
        metadata: {
          content_length: content.length,
          context,
        },
      });
    },
    [logEvent]
  );

  // ============================================
  // TRANSCRIPT FETCHING
  // ============================================

  /**
   * Fetch the user's learning transcript
   */
  const fetchTranscript = useCallback(
    async (options?: {
      filter?: 'all' | 'quizzes' | 'videos';
      limit?: number;
      offset?: number;
    }): Promise<UserTranscript | null> => {
      try {
        const params = new URLSearchParams();
        if (options?.filter) params.set('filter', options.filter);
        if (options?.limit) params.set('limit', options.limit.toString());
        if (options?.offset) params.set('offset', options.offset.toString());

        const url = `/api/user/transcript${params.toString() ? `?${params}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error('Failed to fetch transcript');
        }

        const data = await response.json();
        return data.data;
      } catch (error) {
        console.error('Failed to fetch transcript:', error);
        return null;
      }
    },
    []
  );

  /**
   * Fetch just the summary stats
   */
  const fetchSummary = useCallback(async (): Promise<TranscriptSummary | null> => {
    const transcript = await fetchTranscript({ limit: 0 });
    return transcript?.summary || null;
  }, [fetchTranscript]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    sessionId: sessionId.current,
    isLogging,

    // Core logging
    logEvent,

    // Video tracking
    onVideoPlay,
    onVideoPause,
    onVideoResume,
    onVideoSeek,
    onVideoSpeedChange,
    onVideoComplete,

    // Quiz tracking
    onQuizStart,
    onQuizComplete,

    // General tracking
    onLessonStart,
    onModuleComplete,
    onBookmarkCreate,
    onNoteAdd,

    // Transcript fetching
    fetchTranscript,
    fetchSummary,

    // Utilities
    newSession: () => {
      sessionId.current = uuidv4();
      return sessionId.current;
    },
    endSession: () => {
      sessionId.current = null;
    },
  };
}

// ============================================
// CONVENIENCE HOOKS
// ============================================

/**
 * Hook for video-specific ledger tracking
 */
export function useVideoLedger(videoContext: VideoContext) {
  return useLearningLedger({
    context: videoContext,
    autoSession: true,
  });
}

/**
 * Hook for quiz-specific ledger tracking
 */
export function useQuizLedger(quizContext: QuizContext) {
  return useLearningLedger({
    context: quizContext,
    autoSession: true,
  });
}

// ============================================
// TYPES EXPORT
// ============================================

export type { LearningContext, VideoContext, QuizContext, UseLearningLedgerOptions };
