import { NextResponse } from 'next/server';
import { CURRICULUM_MODULES, getCurriculumStats } from '@/data/curriculum';
import {
  getThinkificCourses,
  hasThinkificContent,
} from '@/lib/learning-progress';

// Default color palette for Thinkific courses
const COURSE_COLORS = [
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
];

// Map content type to icon name
const COURSE_ICONS = [
  'BookOpen',
  'TrendingUp',
  'Activity',
  'Target',
  'Crosshair',
  'ArrowRightLeft',
  'Brain',
  'ClipboardList',
  'ListChecks',
  'Shield',
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source'); // 'thinkific', 'local', or null (auto)

    // Check if we should use Thinkific data
    const useThinkific = source !== 'local' && await hasThinkificContent();

    if (useThinkific) {
      // Fetch from Thinkific synced data
      const courses = await getThinkificCourses();

      const modules = courses.map((course, index) => ({
        id: course.id,
        slug: course.slug,
        title: course.title,
        description: course.description,
        icon: COURSE_ICONS[index % COURSE_ICONS.length],
        color: COURSE_COLORS[index % COURSE_COLORS.length],
        order: index + 1,
        lessonsCount: course.lesson_count,
        chaptersCount: course.chapter_count,
        estimatedDuration: course.duration ? parseInt(course.duration) : 0,
        imageUrl: course.image_url,
        thinkificId: course.thinkific_id,
        source: 'thinkific' as const,
      }));

      return NextResponse.json({
        modules,
        stats: {
          totalModules: modules.length,
          totalLessons: modules.reduce((sum, m) => sum + m.lessonsCount, 0),
          totalHours: 0, // Would need to calculate from content durations
        },
        source: 'thinkific',
      });
    }

    // Fall back to hardcoded curriculum
    const stats = getCurriculumStats();

    const modules = CURRICULUM_MODULES.map((module) => ({
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      icon: module.icon,
      color: module.color,
      order: module.order,
      lessonsCount: module.lessons.length,
      estimatedDuration: module.lessons.reduce((sum, l) => sum + l.duration, 0),
      source: 'local' as const,
    }));

    return NextResponse.json({
      modules,
      stats,
      source: 'local',
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}
