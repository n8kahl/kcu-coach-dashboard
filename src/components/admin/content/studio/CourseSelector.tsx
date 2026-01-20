'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useContentStudio, type ModuleWithLessons } from './ContentStudioContext';
import {
  ChevronDown,
  Plus,
  Settings,
  FolderPlus,
  Layers,
  Eye,
  EyeOff,
} from 'lucide-react';
import type { Course, CourseModule } from '@/types/learning';

// ============================================
// Course Editor Modal Component
// ============================================

interface CourseEditorModalProps {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Partial<Course>) => Promise<void>;
  onDelete?: (courseId: string) => Promise<void>;
}

function CourseEditorModal({ course, isOpen, onClose, onSave, onDelete }: CourseEditorModalProps) {
  // This will be imported from shared modals or defined inline
  // For now, we'll export the props interface so it can be connected
  return null;
}

// ============================================
// Course Selector Component
// ============================================

interface CourseSelectorProps {
  onEditCourse: (course: Course | null) => void;
  onCreateCourse: () => void;
  onEditModule: (module: CourseModule | null) => void;
  onCreateModule: () => void;
}

export function CourseSelector({
  onEditCourse,
  onCreateCourse,
  onEditModule,
  onCreateModule,
}: CourseSelectorProps) {
  const {
    courses,
    selectedCourse,
    modules,
    setSelectedCourse,
    fetchCourses,
    fetchModules,
  } = useContentStudio();

  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);

  // Fetch courses on mount
  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Fetch modules when course changes
  useEffect(() => {
    if (selectedCourse) {
      fetchModules();
    }
  }, [selectedCourse, fetchModules]);

  // Stats
  const totalLessons = modules.reduce(
    (acc, m) => acc + (m.lessons?.length || 0),
    0
  );
  const publishedLessons = modules.reduce(
    (acc, m) =>
      acc + (m.lessons?.filter((l) => l.isPublished)?.length || 0),
    0
  );

  return (
    <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--border-primary)] bg-[var(--bg-card)]">
      {/* Left: Course Selector */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Button
            variant="secondary"
            onClick={() => setCourseDropdownOpen(!courseDropdownOpen)}
            className="min-w-[200px] justify-between"
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="truncate">
                {selectedCourse?.title || 'Select Course'}
              </span>
            </span>
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>

          {/* Dropdown */}
          {courseDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setCourseDropdownOpen(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-20 w-64 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg shadow-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  {courses.map((course) => (
                    <button
                      key={course.id}
                      className="w-full px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
                      onClick={() => {
                        setSelectedCourse(course);
                        setCourseDropdownOpen(false);
                      }}
                    >
                      <span className="text-sm text-[var(--text-primary)] truncate">
                        {course.title}
                      </span>
                      <Badge
                        variant={course.isPublished ? 'success' : 'default'}
                        size="sm"
                      >
                        {course.isPublished ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                      </Badge>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[var(--border-primary)] p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => {
                      setCourseDropdownOpen(false);
                      onCreateCourse();
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Course
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Course Stats */}
        {selectedCourse && (
          <div className="flex items-center gap-4 text-sm text-[var(--text-tertiary)]">
            <span>{modules.length} modules</span>
            <span>
              {publishedLessons}/{totalLessons} lessons published
            </span>
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {selectedCourse && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCreateModule}
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditCourse(selectedCourse)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
