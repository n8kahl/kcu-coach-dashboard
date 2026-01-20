'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useToast } from '@/components/ui/toast';
import type {
  Course,
  CourseModule,
  CourseLesson,
} from '@/types/learning';

// ============================================
// Types
// ============================================

export interface ModuleWithLessons extends CourseModule {
  lessons: CourseLesson[];
  isExpanded: boolean;
}

export interface TreeItem {
  id: string;
  type: 'module' | 'lesson';
  data: ModuleWithLessons | CourseLesson;
  parentId?: string;
}

interface ContentStudioState {
  // Course State
  courses: Course[];
  selectedCourse: Course | null;
  loading: boolean;

  // Module State
  modules: ModuleWithLessons[];

  // Selection State
  selectedItem: TreeItem | null;
  editedLesson: CourseLesson | null;

  // Saving State
  saving: boolean;

  // Tree Items (computed)
  treeItems: TreeItem[];
}

interface ContentStudioActions {
  // Data Fetching
  fetchCourses: () => Promise<void>;
  fetchModules: () => Promise<void>;

  // Selection
  setSelectedCourse: (course: Course | null) => void;
  setSelectedItem: (item: TreeItem | null) => void;
  setEditedLesson: (lesson: CourseLesson | null) => void;
  toggleModuleExpand: (moduleId: string) => void;

  // Module Actions
  setModules: (modules: ModuleWithLessons[] | ((prev: ModuleWithLessons[]) => ModuleWithLessons[])) => void;

  // Course CRUD
  saveCourse: (courseData: Partial<Course>, courseId?: string) => Promise<void>;
  deleteCourse: (courseId: string) => Promise<void>;

  // Module CRUD
  saveModule: (moduleData: Partial<CourseModule>, moduleId?: string) => Promise<void>;
  deleteModule: (moduleId: string) => Promise<void>;

  // Lesson CRUD
  saveLesson: (lesson: CourseLesson) => Promise<void>;
  addLesson: (moduleId: string) => Promise<void>;
  deleteLesson: (lessonId: string) => Promise<void>;
  moveLessonToModule: (lessonId: string, targetModuleId: string, targetIndex?: number) => Promise<void>;

  // Reordering
  reorderModules: (moduleIds: string[]) => Promise<void>;
  reorderLessons: (moduleId: string, lessonIds: string[]) => Promise<void>;
}

interface ContentStudioContextValue extends ContentStudioState, ContentStudioActions {}

// ============================================
// Context
// ============================================

const ContentStudioContext = createContext<ContentStudioContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function ContentStudioProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast();

  // ============================================
  // State
  // ============================================

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [editedLesson, setEditedLesson] = useState<CourseLesson | null>(null);
  const [saving, setSaving] = useState(false);

  // ============================================
  // Computed: Tree Items
  // ============================================

  const treeItems = useMemo((): TreeItem[] => {
    const items: TreeItem[] = [];

    modules.forEach((module) => {
      items.push({
        id: `module-${module.id}`,
        type: 'module',
        data: module,
      });

      if (module.isExpanded) {
        module.lessons?.forEach((lesson) => {
          items.push({
            id: `lesson-${lesson.id}`,
            type: 'lesson',
            data: lesson,
            parentId: `module-${module.id}`,
          });
        });
      }
    });

    return items;
  }, [modules]);

  // ============================================
  // Data Fetching
  // ============================================

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
        if (data.courses?.length > 0 && !selectedCourse) {
          setSelectedCourse(data.courses[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  }, [selectedCourse]);

  const fetchModules = useCallback(async () => {
    if (!selectedCourse) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/content/courses/${selectedCourse.id}/modules`);
      if (res.ok) {
        const data = await res.json();
        const modulesWithExpanded = (data.modules || []).map(
          (m: CourseModule & { lessons?: CourseLesson[] }) => ({
            ...m,
            lessons: m.lessons || [],
            isExpanded: true,
          })
        );
        setModules(modulesWithExpanded);
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  // ============================================
  // Selection Handlers
  // ============================================

  const toggleModuleExpand = useCallback((moduleId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
      )
    );
  }, []);

  // ============================================
  // Course CRUD
  // ============================================

  const saveCourse = useCallback(
    async (courseData: Partial<Course>, courseId?: string) => {
      try {
        const url = courseId
          ? `/api/admin/content/courses/${courseId}`
          : '/api/admin/content/courses';
        const method = courseId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(courseData),
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: courseId ? 'Course Updated' : 'Course Created',
            message: 'Changes saved successfully',
          });
          await fetchCourses();
        } else {
          throw new Error('Failed to save course');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to save course',
        });
        throw err;
      }
    },
    [fetchCourses, showToast]
  );

  const deleteCourse = useCallback(
    async (courseId: string) => {
      try {
        const res = await fetch(`/api/admin/content/courses/${courseId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Course Deleted',
            message: 'Course has been permanently deleted',
          });
          setSelectedCourse(null);
          setModules([]);
          setSelectedItem(null);
          setEditedLesson(null);
          await fetchCourses();
        } else {
          throw new Error('Failed to delete course');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete course',
        });
      }
    },
    [fetchCourses, showToast]
  );

  // ============================================
  // Module CRUD
  // ============================================

  const saveModule = useCallback(
    async (moduleData: Partial<CourseModule>, moduleId?: string) => {
      try {
        const url = moduleId
          ? `/api/admin/content/modules/${moduleId}`
          : '/api/admin/content/modules';
        const method = moduleId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(moduleData),
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: moduleId ? 'Module Updated' : 'Module Created',
            message: 'Changes saved successfully',
          });
          await fetchModules();
        } else {
          throw new Error('Failed to save module');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to save module',
        });
        throw err;
      }
    },
    [fetchModules, showToast]
  );

  const deleteModule = useCallback(
    async (moduleId: string) => {
      try {
        const res = await fetch(`/api/admin/content/modules/${moduleId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Module Deleted',
            message: 'Module and all its lessons have been deleted',
          });
          setSelectedItem(null);
          setEditedLesson(null);
          await fetchModules();
        } else {
          throw new Error('Failed to delete module');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete module',
        });
      }
    },
    [fetchModules, showToast]
  );

  // ============================================
  // Lesson CRUD
  // ============================================

  const saveLesson = useCallback(
    async (lesson: CourseLesson) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/admin/content/lessons/${lesson.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(lesson),
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Saved',
            message: 'Lesson updated successfully',
          });
          await fetchModules();
        } else {
          throw new Error('Failed to save');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to save lesson',
        });
      } finally {
        setSaving(false);
      }
    },
    [fetchModules, showToast]
  );

  const addLesson = useCallback(
    async (moduleId: string) => {
      try {
        const res = await fetch('/api/admin/content/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleId,
            title: 'New Lesson',
            slug: `lesson-${Date.now()}`,
            lessonNumber: '0',
            isPublished: false,
          }),
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Lesson Created',
            message: 'New lesson added',
          });
          await fetchModules();
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to create lesson',
        });
      }
    },
    [fetchModules, showToast]
  );

  const deleteLesson = useCallback(
    async (lessonId: string) => {
      try {
        const res = await fetch(`/api/admin/content/lessons/${lessonId}`, {
          method: 'DELETE',
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Lesson Deleted',
            message: 'Lesson has been permanently deleted',
          });
          setSelectedItem(null);
          setEditedLesson(null);
          await fetchModules();
        } else {
          throw new Error('Failed to delete lesson');
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to delete lesson',
        });
      }
    },
    [fetchModules, showToast]
  );

  const moveLessonToModule = useCallback(
    async (lessonId: string, targetModuleId: string, targetIndex?: number) => {
      try {
        const res = await fetch(`/api/admin/content/lessons/${lessonId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            moduleId: targetModuleId,
          }),
        });

        if (res.ok) {
          showToast({
            type: 'success',
            title: 'Lesson Moved',
            message: 'Lesson moved to new module',
          });
          await fetchModules();
        }
      } catch (err) {
        showToast({
          type: 'error',
          title: 'Error',
          message: 'Failed to move lesson',
        });
      }
    },
    [fetchModules, showToast]
  );

  // ============================================
  // Reordering
  // ============================================

  const reorderModules = useCallback(
    async (moduleIds: string[]) => {
      if (!selectedCourse) return;

      try {
        await fetch('/api/admin/content/modules/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: selectedCourse.id,
            moduleIds,
          }),
        });
      } catch (err) {
        console.error('Error saving module order:', err);
      }
    },
    [selectedCourse]
  );

  const reorderLessons = useCallback(async (moduleId: string, lessonIds: string[]) => {
    try {
      await fetch('/api/admin/content/lessons/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          lessonIds,
        }),
      });
    } catch (err) {
      console.error('Error saving lesson order:', err);
    }
  }, []);

  // ============================================
  // Context Value
  // ============================================

  const value: ContentStudioContextValue = useMemo(
    () => ({
      // State
      courses,
      selectedCourse,
      loading,
      modules,
      selectedItem,
      editedLesson,
      saving,
      treeItems,

      // Actions
      fetchCourses,
      fetchModules,
      setSelectedCourse,
      setSelectedItem,
      setEditedLesson,
      setModules,
      toggleModuleExpand,
      saveCourse,
      deleteCourse,
      saveModule,
      deleteModule,
      saveLesson,
      addLesson,
      deleteLesson,
      moveLessonToModule,
      reorderModules,
      reorderLessons,
    }),
    [
      courses,
      selectedCourse,
      loading,
      modules,
      selectedItem,
      editedLesson,
      saving,
      treeItems,
      fetchCourses,
      fetchModules,
      toggleModuleExpand,
      saveCourse,
      deleteCourse,
      saveModule,
      deleteModule,
      saveLesson,
      addLesson,
      deleteLesson,
      moveLessonToModule,
      reorderModules,
      reorderLessons,
    ]
  );

  return (
    <ContentStudioContext.Provider value={value}>
      {children}
    </ContentStudioContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useContentStudio() {
  const context = useContext(ContentStudioContext);
  if (!context) {
    throw new Error('useContentStudio must be used within a ContentStudioProvider');
  }
  return context;
}
