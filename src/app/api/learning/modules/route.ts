import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { CURRICULUM_MODULES, getCurriculumStats } from '@/data/curriculum';

// Default color palette for modules
const MODULE_COLORS = [
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

// Map modules to icons
const MODULE_ICONS = [
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
    const source = searchParams.get('source'); // 'native', 'local', or null (auto)
    const courseId = searchParams.get('course_id'); // Optional: filter by course

    // Check if we have native course_modules content
    const { count: moduleCount } = await supabaseAdmin
      .from('course_modules')
      .select('*', { count: 'exact', head: true });

    const hasNativeContent = (moduleCount || 0) > 0;
    const useNative = source !== 'local' && hasNativeContent;

    if (useNative) {
      // Query course_modules with lesson counts
      let query = supabaseAdmin
        .from('course_modules')
        .select(`
          id,
          course_id,
          title,
          slug,
          description,
          module_number,
          thumbnail_url,
          sort_order,
          is_published,
          unlock_after_module_id,
          unlock_after_days,
          requires_quiz_pass,
          min_quiz_score,
          is_required,
          created_at,
          courses!inner (
            id,
            title,
            slug,
            is_published
          )
        `)
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      // Filter by course if specified
      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data: modules, error } = await query;

      if (error) {
        console.error('Error fetching modules:', error);
        throw error;
      }

      // Get lesson counts for each module
      const moduleIds = modules?.map(m => m.id) || [];
      const { data: lessonCounts } = await supabaseAdmin
        .from('course_lessons')
        .select('module_id')
        .in('module_id', moduleIds)
        .eq('is_published', true);

      // Count lessons per module
      const lessonCountMap = new Map<string, number>();
      lessonCounts?.forEach(l => {
        const count = lessonCountMap.get(l.module_id) || 0;
        lessonCountMap.set(l.module_id, count + 1);
      });

      // Get total duration per module
      const { data: durations } = await supabaseAdmin
        .from('course_lessons')
        .select('module_id, video_duration_seconds')
        .in('module_id', moduleIds)
        .eq('is_published', true);

      const durationMap = new Map<string, number>();
      durations?.forEach(l => {
        const duration = durationMap.get(l.module_id) || 0;
        durationMap.set(l.module_id, duration + (l.video_duration_seconds || 0));
      });

      const formattedModules = (modules || []).map((module, index) => ({
        id: module.id,
        courseId: module.course_id,
        slug: module.slug,
        title: module.title,
        description: module.description,
        moduleNumber: module.module_number,
        icon: MODULE_ICONS[index % MODULE_ICONS.length],
        color: MODULE_COLORS[index % MODULE_COLORS.length],
        order: module.sort_order,
        lessonsCount: lessonCountMap.get(module.id) || 0,
        estimatedDuration: Math.round((durationMap.get(module.id) || 0) / 60), // Convert to minutes
        thumbnailUrl: module.thumbnail_url,
        isPublished: module.is_published,
        isRequired: module.is_required,
        requiresQuizPass: module.requires_quiz_pass,
        minQuizScore: module.min_quiz_score,
        unlockAfterModuleId: module.unlock_after_module_id,
        unlockAfterDays: module.unlock_after_days,
        course: module.courses,
        source: 'native' as const,
      }));

      return NextResponse.json({
        modules: formattedModules,
        stats: {
          totalModules: formattedModules.length,
          totalLessons: Array.from(lessonCountMap.values()).reduce((sum, c) => sum + c, 0),
          totalHours: Math.round(Array.from(durationMap.values()).reduce((sum, d) => sum + d, 0) / 3600),
        },
        source: 'native',
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
