'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Course } from '@/types/learning';
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Users,
  BookOpen,
  Clock,
  ArrowRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface CourseStats {
  studentCount: number;
  moduleCount: number;
  lessonCount: number;
}

interface CourseCardProps {
  course: Course;
  stats?: CourseStats;
  onClick: () => void;
}

interface CourseGridProps {
  courses: Course[];
  onSelectCourse: (course: Course) => void;
  onCreateCourse: () => void;
}

// ============================================
// Course Card Component
// ============================================

function CourseCard({ course, stats, onClick }: CourseCardProps) {
  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        'hover:border-[var(--accent-primary)] hover:shadow-lg hover:shadow-[var(--accent-primary)]/10'
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] overflow-hidden">
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-xl bg-[var(--accent-primary)]/20 flex items-center justify-center">
                <Layers className="w-8 h-8 text-[var(--accent-primary)]" />
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <Badge
              variant={course.isPublished ? 'success' : 'default'}
              className="shadow-lg"
            >
              {course.isPublished ? (
                <>
                  <Eye className="w-3 h-3 mr-1" />
                  Published
                </>
              ) : (
                <>
                  <EyeOff className="w-3 h-3 mr-1" />
                  Draft
                </>
              )}
            </Badge>
          </div>

          {/* Hover Arrow */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1 line-clamp-1">
            {course.title}
          </h3>
          {course.description && (
            <p className="text-sm text-[var(--text-tertiary)] mb-3 line-clamp-2">
              {course.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
            {stats && (
              <>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {stats.studentCount} students
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  {stats.moduleCount} modules
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {stats.lessonCount} lessons
                </span>
              </>
            )}
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mt-3">
            {course.isGated && (
              <Badge variant="default" size="sm">
                Gated
              </Badge>
            )}
            {course.complianceRequired && (
              <Badge variant="warning" size="sm">
                Compliance
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Create Course Card Component
// ============================================

function CreateCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <Card
      className={cn(
        'cursor-pointer border-2 border-dashed transition-all duration-200',
        'hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5'
      )}
      onClick={onClick}
    >
      <CardContent className="p-0">
        <div className="aspect-video flex flex-col items-center justify-center p-6">
          <div className="w-16 h-16 rounded-xl bg-[var(--accent-primary)]/20 flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-[var(--accent-primary)]" />
          </div>
          <p className="text-lg font-semibold text-[var(--text-primary)]">Create New Course</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Start building your curriculum
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Course Grid Component
// ============================================

export function CourseGrid({ courses, onSelectCourse, onCreateCourse }: CourseGridProps) {
  const [courseStats, setCourseStats] = useState<Record<string, CourseStats>>({});

  // Fetch stats for all courses
  useEffect(() => {
    const fetchStats = async () => {
      const statsMap: Record<string, CourseStats> = {};

      for (const course of courses) {
        try {
          // Fetch modules to count modules and lessons
          const res = await fetch(`/api/admin/content/courses/${course.id}/modules`);
          if (res.ok) {
            const data = await res.json();
            const modules = data.modules || [];
            const lessonCount = modules.reduce(
              (acc: number, m: { lessons?: unknown[] }) => acc + (m.lessons?.length || 0),
              0
            );

            statsMap[course.id] = {
              studentCount: 0, // TODO: Fetch from enrollments
              moduleCount: modules.length,
              lessonCount,
            };
          }
        } catch (err) {
          console.error(`Error fetching stats for course ${course.id}:`, err);
        }
      }

      setCourseStats(statsMap);
    };

    if (courses.length > 0) {
      fetchStats();
    }
  }, [courses]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Content Studio</h1>
        <p className="text-[var(--text-tertiary)] mt-1">
          Select a course to manage its content, or create a new one.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create New Course Card */}
        <CreateCourseCard onClick={onCreateCourse} />

        {/* Existing Courses */}
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            stats={courseStats[course.id]}
            onClick={() => onSelectCourse(course)}
          />
        ))}
      </div>

      {/* Empty State */}
      {courses.length === 0 && (
        <div className="text-center py-12">
          <div className="w-20 h-20 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
            <Layers className="w-10 h-10 text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            No courses yet
          </h3>
          <p className="text-[var(--text-tertiary)] mb-4">
            Get started by creating your first course.
          </p>
          <Button variant="primary" onClick={onCreateCourse}>
            <Plus className="w-4 h-4 mr-2" />
            Create Course
          </Button>
        </div>
      )}
    </div>
  );
}
