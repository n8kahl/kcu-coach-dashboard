'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Users,
  BookOpen,
  Clock,
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  ChevronRight,
  GraduationCap,
  Play,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  totalEnrollments: number;
  activeUsers: number;
  completionRate: number;
  averageProgress: number;
  totalWatchTimeHours: number;
  lessonsCount: number;
  modulesCount: number;
  quizPassRate: number;
  averageQuizScore: number;
}

interface LessonAnalytics {
  lessonId: string;
  lessonTitle: string;
  moduleTitle: string;
  viewCount: number;
  completionRate: number;
  averageWatchPercent: number;
  dropOffRate: number;
  averageWatchTimeSeconds: number;
}

interface OverviewStats {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalLessons: number;
  totalWatchTimeHours: number;
  totalCompletions: number;
  averageCompletionRate: number;
}

export default function CourseAnalyticsPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [courses, setCourses] = useState<CourseAnalytics[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseAnalytics | null>(null);
  const [lessonAnalytics, setLessonAnalytics] = useState<LessonAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const fetchOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/analytics/courses?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setOverview(data.overview);
        setCourses(data.courses || []);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchCourseDetail = useCallback(async (courseId: string) => {
    setLoadingLessons(true);
    try {
      const response = await fetch(`/api/admin/analytics/courses?courseId=${courseId}&period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setLessonAnalytics(data.lessons || []);
      }
    } catch (error) {
      console.error('Error fetching course detail:', error);
    } finally {
      setLoadingLessons(false);
    }
  }, [period]);

  useEffect(() => {
    fetchOverviewData();
  }, [fetchOverviewData]);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseDetail(selectedCourse.courseId);
    }
  }, [selectedCourse, fetchCourseDetail]);

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${Math.round(hours * 10) / 10}h`;
  };

  const StatCard = ({
    title,
    value,
    subValue,
    icon: Icon,
    trend,
    color = 'primary',
  }: {
    title: string;
    value: string | number;
    subValue?: string;
    icon: typeof Users;
    trend?: 'up' | 'down' | 'neutral';
    color?: 'primary' | 'success' | 'warning' | 'error';
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-[var(--text-tertiary)]">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
            {subValue && (
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{subValue}</p>
            )}
          </div>
          <div className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            color === 'primary' && 'bg-[var(--accent-primary)]/20',
            color === 'success' && 'bg-[var(--profit)]/20',
            color === 'warning' && 'bg-[var(--warning)]/20',
            color === 'error' && 'bg-[var(--error)]/20'
          )}>
            <Icon className={cn(
              'w-5 h-5',
              color === 'primary' && 'text-[var(--accent-primary)]',
              color === 'success' && 'text-[var(--profit)]',
              color === 'warning' && 'text-[var(--warning)]',
              color === 'error' && 'text-[var(--error)]'
            )} />
          </div>
        </div>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            trend === 'up' && 'text-[var(--profit)]',
            trend === 'down' && 'text-[var(--error)]',
            trend === 'neutral' && 'text-[var(--text-tertiary)]'
          )}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            <span>vs previous period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <>
        <Header
          title="Course Analytics"
          subtitle="Track engagement and completion metrics"
          breadcrumbs={[{ label: 'Admin' }, { label: 'Analytics' }, { label: 'Courses' }]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading analytics...</span>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Course Analytics"
        subtitle="Track engagement and completion metrics"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Analytics' }, { label: 'Courses' }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Period Selector */}
            <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg p-1">
              {(['7d', '30d', '90d', 'all'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                    period === p
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                  )}
                >
                  {p === 'all' ? 'All Time' : p.replace('d', ' Days')}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={fetchOverviewData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        }
      />

      <PageShell>
        {/* Overview Stats */}
        <PageSection>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={overview?.totalUsers || 0}
              subValue={`${overview?.activeUsers || 0} active`}
              icon={Users}
              color="primary"
            />
            <StatCard
              title="Published Courses"
              value={overview?.publishedCourses || 0}
              subValue={`${overview?.totalLessons || 0} total lessons`}
              icon={BookOpen}
              color="success"
            />
            <StatCard
              title="Watch Time"
              value={formatDuration(overview?.totalWatchTimeHours || 0)}
              subValue="total across all users"
              icon={Clock}
              color="warning"
            />
            <StatCard
              title="Completions"
              value={overview?.totalCompletions || 0}
              subValue={`${overview?.averageCompletionRate || 0}% avg rate`}
              icon={Trophy}
              color="success"
            />
          </div>
        </PageSection>

        {/* Course List and Detail */}
        <PageSection>
          <div className="grid grid-cols-12 gap-6">
            {/* Course List */}
            <div className="col-span-12 lg:col-span-5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-base">Courses</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-[var(--border-primary)]">
                    {courses.map((course) => (
                      <button
                        key={course.courseId}
                        onClick={() => setSelectedCourse(course)}
                        className={cn(
                          'w-full text-left p-4 transition-colors hover:bg-[var(--bg-tertiary)]',
                          selectedCourse?.courseId === course.courseId && 'bg-[var(--accent-primary)]/10'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[var(--text-primary)] truncate">
                              {course.courseTitle}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-tertiary)]">
                              <span>{course.modulesCount} modules</span>
                              <span>{course.lessonsCount} lessons</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-[var(--text-primary)]">
                                {course.completionRate}%
                              </p>
                              <p className="text-xs text-[var(--text-tertiary)]">
                                completion
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                          </div>
                        </div>
                        <div className="mt-2">
                          <ProgressBar value={course.completionRate} size="sm" />
                        </div>
                      </button>
                    ))}

                    {courses.length === 0 && (
                      <div className="p-8 text-center text-[var(--text-tertiary)]">
                        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p>No courses found</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Course Detail */}
            <div className="col-span-12 lg:col-span-7">
              {selectedCourse ? (
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedCourse.courseTitle}</CardTitle>
                        <p className="text-sm text-[var(--text-tertiary)] mt-1">
                          {selectedCourse.modulesCount} modules • {selectedCourse.lessonsCount} lessons
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Course Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                          <Users className="w-4 h-4" />
                          <span className="text-xs">Enrollments</span>
                        </div>
                        <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                          {selectedCourse.totalEnrollments}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                          <Play className="w-4 h-4" />
                          <span className="text-xs">Active Users</span>
                        </div>
                        <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                          {selectedCourse.activeUsers}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                          <Clock className="w-4 h-4" />
                          <span className="text-xs">Watch Time</span>
                        </div>
                        <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                          {formatDuration(selectedCourse.totalWatchTimeHours)}
                        </p>
                      </div>
                      <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                          <GraduationCap className="w-4 h-4" />
                          <span className="text-xs">Quiz Pass Rate</span>
                        </div>
                        <p className="text-xl font-bold text-[var(--text-primary)] mt-1">
                          {selectedCourse.quizPassRate}%
                        </p>
                      </div>
                    </div>

                    {/* Lesson Analytics */}
                    <div>
                      <h3 className="font-medium text-[var(--text-primary)] mb-3">
                        Lesson Performance
                      </h3>
                      {loadingLessons ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {lessonAnalytics.map((lesson) => (
                            <div
                              key={lesson.lessonId}
                              className="p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {lesson.lessonTitle}
                                  </p>
                                  <p className="text-xs text-[var(--text-tertiary)]">
                                    {lesson.moduleTitle}
                                  </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <div className="text-right">
                                    <p className="text-[var(--text-primary)]">{lesson.viewCount}</p>
                                    <p className="text-xs text-[var(--text-tertiary)]">views</p>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      lesson.completionRate >= 70 ? 'text-[var(--profit)]' :
                                      lesson.completionRate >= 40 ? 'text-[var(--warning)]' :
                                      'text-[var(--error)]'
                                    )}>
                                      {lesson.completionRate}%
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)]">complete</p>
                                  </div>
                                  <div className="text-right">
                                    <p className={cn(
                                      lesson.dropOffRate <= 30 ? 'text-[var(--profit)]' :
                                      lesson.dropOffRate <= 60 ? 'text-[var(--warning)]' :
                                      'text-[var(--error)]'
                                    )}>
                                      {lesson.dropOffRate}%
                                    </p>
                                    <p className="text-xs text-[var(--text-tertiary)]">drop-off</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2">
                                <ProgressBar
                                  value={lesson.averageWatchPercent}
                                  size="sm"
                                  variant={
                                    lesson.averageWatchPercent >= 70 ? 'success' :
                                    lesson.averageWatchPercent >= 40 ? 'warning' : 'default'
                                  }
                                />
                              </div>
                            </div>
                          ))}

                          {lessonAnalytics.length === 0 && (
                            <div className="py-8 text-center text-[var(--text-tertiary)]">
                              <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No lesson data available</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center py-12 text-[var(--text-tertiary)]">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a course to view detailed analytics</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </PageSection>
      </PageShell>
    </>
  );
}
