/**
 * Learning System Types - Unified Native Schema
 *
 * This file defines types for the consolidated course_* database schema.
 * All content is now stored in: courses, course_modules, course_lessons
 *
 * Database Tables (see migration 023_video_learning_system.sql):
 * - courses: Top-level containers for educational content
 * - course_modules: Chapters/sections within courses
 * - course_lessons: Individual video lessons with resources
 * - course_lesson_progress: User watch progress & compliance tracking
 * - lesson_watch_sessions: Detailed session audit trail
 * - course_quiz_*: Quiz system tables
 *
 * MIGRATION NOTE (030_unify_content_system.sql):
 * The legacy thinkific_* and learning_modules tables have been deprecated
 * and dropped. All content now uses the native course_* schema.
 */

// ============================================
// RESOURCE TYPES
// ============================================

export type ResourceType = 'pdf' | 'link' | 'image' | 'download';

export interface Resource {
  type: ResourceType;
  title: string;
  url: string;
  description?: string;
  /** File size in bytes (for downloads) */
  size?: number;
  /** MIME type for proper handling */
  mimeType?: string;
}

// ============================================
// VIDEO STATUS
// ============================================

export type VideoStatus = 'pending' | 'processing' | 'ready' | 'error';

// ============================================
// COURSE STRUCTURE
// ============================================

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  isPublished: boolean;
  isGated: boolean;
  sortOrder: number;
  version: string;
  complianceRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  description: string | null;
  moduleNumber: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  unlockAfterModuleId: string | null;
  unlockAfterDays: number | null;
  requiresQuizPass: boolean;
  minQuizScore: number;
  isRequired: boolean;
  createdAt: string;
}

export interface CourseLesson {
  id: string;
  moduleId: string;
  title: string;
  slug: string;
  description: string | null;
  lessonNumber: string;
  videoUrl: string | null;
  videoUid: string | null;
  videoDurationSeconds: number | null;
  videoStatus: VideoStatus;
  videoPlaybackHls: string | null;
  videoPlaybackDash: string | null;
  videoThumbnailAnimated: string | null;
  thumbnailUrl: string | null;
  transcriptUrl: string | null;
  transcriptText: string | null;
  resources: Resource[];
  requireSignedUrls: boolean;
  sortOrder: number;
  isPreview: boolean;
  isPublished: boolean;
  isRequired: boolean;
  minWatchPercent: number;
  allowSkip: boolean;
  createdAt: string;
  // Computed fields
  chapters?: LessonChapter[];
}

export interface LessonProgress {
  id: string;
  lessonId: string;
  progressSeconds: number;
  progressPercent: number;
  completed: boolean;
  completedAt: string | null;
  totalWatchTimeSeconds: number;
  uniqueWatchTimeSeconds: number;
  watchCount: number;
  pauseCount: number;
  seekCount: number;
  playbackSpeedChanges: number;
  lastPlaybackSpeed: number;
  firstWatchedAt: string | null;
  lastWatchedAt: string;
}

export interface WatchSession {
  id: string;
  lessonId: string;
  startedAt: string;
  endedAt: string | null;
  startPositionSeconds: number;
  endPositionSeconds: number;
  watchDurationSeconds: number;
  playbackSpeed: number;
  wasCompleted: boolean;
  deviceType: string | null;
  browser: string | null;
}

export interface QuizQuestion {
  id: string;
  moduleId: string;
  lessonId: string | null;
  questionType: 'single' | 'multiple' | 'true_false';
  questionText: string;
  explanation: string | null;
  remediationVideoId: string | null;
  remediationTimestampSeconds: number | null;
  sortOrder: number;
  choices: QuizChoice[];
}

export interface QuizChoice {
  id: string;
  questionId: string;
  choiceText: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuizAttempt {
  id: string;
  moduleId: string;
  questionsTotal: number;
  questionsCorrect: number;
  scorePercent: number;
  passed: boolean;
  answers: QuizAnswer[];
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  attemptNumber: number;
}

export interface QuizAnswer {
  questionId: string;
  selectedChoices: string[];
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface LearningStreak {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  streakStartDate: string | null;
}

export interface DailyActivity {
  activityDate: string;
  lessonsStarted: number;
  lessonsCompleted: number;
  watchTimeSeconds: number;
  quizzesTaken: number;
  quizzesPassed: number;
  engagementScore: number;
}

export interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  icon: string;
  criteria: AchievementCriteria;
  sortOrder: number;
  isSecret: boolean;
  earnedAt?: string;
}

export type AchievementCriteria =
  | { type: 'lessons_completed'; count: number }
  | { type: 'modules_completed'; count: number }
  | { type: 'streak_days'; count: number }
  | { type: 'daily_lessons'; count: number }
  | { type: 'daily_watch_hours'; hours: number }
  | { type: 'perfect_quiz'; count: number }
  | { type: 'all_quizzes_passed' }
  | { type: 'watch_time_hours'; hours: number }
  | { type: 'course_percent'; value: number };

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  totalModules: number;
  completedModules: number;
  totalWatchTimeSeconds: number;
  totalQuizAttempts: number;
  bestQuizScores: { moduleId: string; bestScore: number }[];
  completionPercent: number;
}

export interface ModuleProgress {
  moduleId: string;
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  isLocked: boolean;
  unlockReason?: string;
  bestQuizScore: number | null;
  quizPassed: boolean;
}

export interface UserCourseAccess {
  id: string;
  courseId: string;
  accessType: 'full' | 'preview' | 'trial' | 'expired';
  grantedAt: string;
  expiresAt: string | null;
  enrolledAt: string;
  completionDeadline: string | null;
  complianceStatus: 'not_started' | 'in_progress' | 'completed' | 'overdue';
}

// API Response types
export interface ProgressOverviewResponse {
  courseProgress: CourseProgress;
  streak: LearningStreak;
  recentActivity: DailyActivity[];
  resumeLesson: {
    lesson: CourseLesson;
    module: CourseModule;
    progress: LessonProgress;
  } | null;
}

export interface ModuleDetailResponse {
  module: CourseModule;
  lessons: (CourseLesson & { progress?: LessonProgress })[];
  quiz: {
    questionsCount: number;
    passingScore: number;
    bestAttempt: QuizAttempt | null;
    attemptsCount: number;
  } | null;
  isLocked: boolean;
  unlockReason?: string;
}

// Compliance Report types
export interface ComplianceUserReport {
  userId: string;
  userName: string;
  courseId: string;
  courseName: string;
  totalLessons: number;
  completedLessons: number;
  completionPercent: number;
  totalWatchTimeSeconds: number;
  lessonsDetail: {
    lessonId: string;
    lessonTitle: string;
    videoDurationSeconds: number;
    totalWatchTimeSeconds: number;
    uniqueWatchTimeSeconds: number;
    watchCount: number;
    completed: boolean;
    completedAt: string | null;
  }[];
  quizAttempts: {
    moduleId: string;
    moduleName: string;
    attemptNumber: number;
    scorePercent: number;
    passed: boolean;
    completedAt: string;
  }[];
}

// ============================================
// LESSON CHAPTERS (Timeline Markers)
// ============================================

export interface LessonChapter {
  id: string;
  lessonId: string;
  title: string;
  timestampSeconds: number;
  description: string | null;
  conceptTag: string | null;
  sortOrder: number;
  createdAt: string;
}

// ============================================
// LEARNING PATHS
// ============================================

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all';

export interface PathModule {
  moduleId: string;
  order: number;
  isOptional: boolean;
}

export interface LearningPath {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnailUrl: string | null;
  skillLevel: SkillLevel;
  estimatedHours: number | null;
  pathModules: PathModule[];
  sortOrder: number;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  modules?: CourseModule[];
}

export interface UserLearningPath {
  id: string;
  userId: string;
  pathId: string;
  startedAt: string;
  completedAt: string | null;
  currentModuleId: string | null;
  modulesCompleted: number;
  totalModules: number;
  progressPercent: number;
  createdAt: string;
  // Computed
  path?: LearningPath;
}

// ============================================
// BOOKMARKS & NOTES
// ============================================

export interface LessonBookmark {
  id: string;
  userId: string;
  lessonId: string;
  timestampSeconds: number;
  title: string | null;
  note: string | null;
  color: string;
  createdAt: string;
  // Computed
  lesson?: CourseLesson;
}

// ============================================
// CLOUDFLARE STREAM TYPES
// ============================================

export interface CloudflareStreamVideo {
  uid: string;
  thumbnail: string;
  thumbnailTimestampPct: number;
  readyToStream: boolean;
  status: {
    state: 'pendingupload' | 'downloading' | 'queued' | 'inprogress' | 'ready' | 'error';
    pctComplete?: string;
    errorReasonCode?: string;
    errorReasonText?: string;
  };
  meta: {
    name: string;
  };
  created: string;
  modified: string;
  duration: number;
  input: {
    width: number;
    height: number;
  };
  playback: {
    hls: string;
    dash: string;
  };
  preview: string;
  allowedOrigins?: string[];
  requireSignedURLs: boolean;
  uploaded?: string;
  size?: number;
}

export interface CloudflareUploadResponse {
  result: CloudflareStreamVideo;
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

export interface CloudflareSignedUrlResponse {
  result: {
    token: string;
  };
  success: boolean;
  errors: unknown[];
  messages: unknown[];
}

// ============================================
// HELPER TYPES
// ============================================

/** Lesson with all related data */
export interface LessonWithDetails extends CourseLesson {
  chapters: LessonChapter[];
  module: CourseModule;
  course: Course;
  nextLesson?: {
    id: string;
    title: string;
    slug: string;
  };
  prevLesson?: {
    id: string;
    title: string;
    slug: string;
  };
}

/** Module with completion stats */
export interface ModuleWithProgress extends CourseModule {
  lessonsCompleted: number;
  totalLessons: number;
  quizBestScore: number | null;
  quizPassed: boolean;
  isLocked: boolean;
  unlockReason?: string;
}

/** Course with user's access and progress */
export interface CourseWithAccess extends Course {
  access: UserCourseAccess | null;
  progress: CourseProgress | null;
  modulesWithProgress?: ModuleWithProgress[];
}

// ============================================
// LEARNING LEDGER (Compliance Audit Trail)
// ============================================

/** Resource types that can be tracked */
export type AuditResourceType = 'lesson' | 'quiz' | 'module' | 'course' | 'video' | 'practice';

/** Actions that can be logged */
export type AuditAction =
  | 'started'
  | 'completed'
  | 'quiz_attempt'
  | 'quiz_passed'
  | 'quiz_failed'
  | 'video_segment_watched'
  | 'video_paused'
  | 'video_resumed'
  | 'video_seeked'
  | 'video_speed_changed'
  | 'module_unlocked'
  | 'certificate_earned'
  | 'bookmark_created'
  | 'note_added';

/** Metadata for quiz attempt actions */
export interface QuizAttemptMetadata {
  score: number;
  passed: boolean;
  attempt_number: number;
  questions_correct: number;
  questions_total: number;
  time_spent_seconds?: number;
}

/** Metadata for video segment watched actions */
export interface VideoSegmentMetadata {
  start_time: number;
  end_time: number;
  playback_speed: number;
}

/** Metadata for video seek actions */
export interface VideoSeekMetadata {
  from_time: number;
  to_time: number;
  direction: 'forward' | 'backward';
}

/** Metadata for video speed change actions */
export interface VideoSpeedChangeMetadata {
  old_speed: number;
  new_speed: number;
}

/** Client information for audit trail */
export interface AuditClientInfo {
  device_type?: 'desktop' | 'tablet' | 'mobile';
  browser?: string;
  ip_hash?: string;
  user_agent?: string;
}

/** A single learning audit log entry */
export interface LearningAuditLog {
  id: string;
  user_id: string;
  resource_id: string | null;
  resource_type: AuditResourceType;
  action: AuditAction;
  duration_seconds: number;
  metadata: QuizAttemptMetadata | VideoSegmentMetadata | VideoSeekMetadata | VideoSpeedChangeMetadata | Record<string, unknown>;
  resource_title: string | null;
  module_id: string | null;
  module_title: string | null;
  course_id: string | null;
  course_title: string | null;
  client_info: AuditClientInfo;
  created_at: string;
  session_id: string | null;
}

/** Input for creating a new audit log entry */
export interface LearningAuditLogInput {
  resource_id?: string;
  resource_type: AuditResourceType;
  action: AuditAction;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
  resource_title?: string;
  module_id?: string;
  module_title?: string;
  course_id?: string;
  course_title?: string;
  session_id?: string;
}

/** Transcript summary statistics */
export interface TranscriptSummary {
  totalTime: number;
  totalTimeFormatted: string;
  lessonsCompleted: number;
  averageQuizScore: number;
  averageQuizGrade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  consistencyScore: number;
  globalRank: number;
  modulesCompleted: number;
  quizzesPassed: number;
  contentCoverage: number;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  memberSince: string;
}

/** Module time breakdown for transcript */
export interface ModuleTimeBreakdown {
  moduleId: string;
  moduleTitle: string;
  totalSeconds: number;
  totalFormatted: string;
  lessonCount: number;
  quizCount: number;
  percentageOfTotal: number;
}

/** A single activity in the learning history */
export interface LearningHistoryItem {
  id: string;
  date: string;
  dateFormatted: string;
  module: string;
  activityType: 'Video' | 'Quiz' | 'Lesson' | 'Practice' | 'Module' | 'Course';
  activityTitle: string;
  timeSpent: number;
  timeSpentFormatted: string;
  result: string | null;
  resultType?: 'score' | 'completion' | 'time';
  action: AuditAction;
}

/** Complete user transcript response */
export interface UserTranscript {
  userId: string;
  userName: string;
  summary: TranscriptSummary;
  history: LearningHistoryItem[];
  modules: ModuleTimeBreakdown[];
}

/** User learning achievement */
export interface UserLearningAchievement {
  id: string;
  userId: string;
  achievementSlug: string;
  achievementTitle: string;
  achievementDescription: string | null;
  achievementIcon: string;
  earnedAt: string;
  metadata: Record<string, unknown>;
}

/** Possible achievement slugs */
export type AchievementSlug =
  | 'ltp-master'
  | 'gamma-expert'
  | 'risk-manager'
  | 'consistency-king'
  | 'study-streak-7'
  | 'study-streak-30'
  | 'first-quiz-ace'
  | 'perfect-module'
  | 'video-marathon'
  | 'early-bird'
  | 'night-owl'
  | 'weekend-warrior';

/** Achievement definition for display */
export interface AchievementDefinition {
  slug: AchievementSlug;
  title: string;
  description: string;
  icon: string;
  criteria: string;
}
