/**
 * Admin Knowledge - Course Structure Management
 *
 * Handles batch insert/upsert of modules and lessons from
 * bulk imports or the Knowledge Studio UI.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import logger from '@/lib/logger';
import { z } from 'zod';

// Validation schemas
const ResourceSchema = z.object({
  type: z.enum(['pdf', 'link', 'image', 'download']),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional(),
  size: z.number().optional(),
  mimeType: z.string().optional(),
});

const LessonSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  lessonNumber: z.string().optional(),
  videoUid: z.string().nullable().optional(),
  videoDurationSeconds: z.number().nullable().optional(),
  videoStatus: z.enum(['pending', 'processing', 'ready', 'error']).optional(),
  videoPlaybackHls: z.string().nullable().optional(),
  videoPlaybackDash: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  transcriptText: z.string().nullable().optional(),
  resources: z.array(ResourceSchema).optional(),
  sortOrder: z.number().optional(),
  isPreview: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  minWatchPercent: z.number().min(0).max(100).optional(),
  allowSkip: z.boolean().optional(),
});

const ModuleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  moduleNumber: z.string().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isPublished: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  requiresQuizPass: z.boolean().optional(),
  minQuizScore: z.number().min(0).max(100).optional(),
  lessons: z.array(LessonSchema).optional(),
});

const StructureRequestSchema = z.object({
  courseId: z.string().uuid(),
  modules: z.array(ModuleSchema),
  replaceExisting: z.boolean().optional(), // If true, delete modules not in the list
});

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * POST /api/admin/knowledge/structure
 *
 * Batch insert/upsert course structure (modules and lessons).
 *
 * Request body:
 * {
 *   courseId: string;
 *   modules: Array<{
 *     id?: string;           // If provided, will update; otherwise create
 *     title: string;
 *     lessons?: Array<{...}>
 *   }>;
 *   replaceExisting?: boolean; // Delete modules not in the list
 * }
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = StructureRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { courseId, modules, replaceExisting } = validationResult.data;

    // Verify course exists
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('id, title')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    logger.info('Processing course structure update', {
      courseId,
      moduleCount: modules.length,
      replaceExisting,
      adminId: session.userId,
    });

    const results = {
      modulesCreated: 0,
      modulesUpdated: 0,
      lessonsCreated: 0,
      lessonsUpdated: 0,
      errors: [] as string[],
    };

    // Get existing module IDs for replacement logic
    const { data: existingModules } = await supabaseAdmin
      .from('course_modules')
      .select('id')
      .eq('course_id', courseId);

    const existingModuleIds = new Set(existingModules?.map((m) => m.id) || []);
    const processedModuleIds = new Set<string>();

    // Process each module
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex++) {
      const moduleData = modules[moduleIndex];

      try {
        const moduleSlug = moduleData.slug || generateSlug(moduleData.title);
        const moduleNumber = moduleData.moduleNumber || String(moduleIndex + 1).padStart(2, '0');

        let moduleId: string;

        if (moduleData.id && existingModuleIds.has(moduleData.id)) {
          // Update existing module
          const { error: updateError } = await supabaseAdmin
            .from('course_modules')
            .update({
              title: moduleData.title,
              slug: moduleSlug,
              description: moduleData.description || null,
              module_number: moduleNumber,
              thumbnail_url: moduleData.thumbnailUrl || null,
              sort_order: moduleData.sortOrder ?? moduleIndex,
              is_published: moduleData.isPublished ?? false,
              is_required: moduleData.isRequired ?? true,
              requires_quiz_pass: moduleData.requiresQuizPass ?? false,
              min_quiz_score: moduleData.minQuizScore ?? 80,
            })
            .eq('id', moduleData.id);

          if (updateError) {
            results.errors.push(`Module "${moduleData.title}": ${updateError.message}`);
            continue;
          }

          moduleId = moduleData.id;
          results.modulesUpdated++;
        } else {
          // Create new module
          const { data: newModule, error: insertError } = await supabaseAdmin
            .from('course_modules')
            .insert({
              course_id: courseId,
              title: moduleData.title,
              slug: moduleSlug,
              description: moduleData.description || null,
              module_number: moduleNumber,
              thumbnail_url: moduleData.thumbnailUrl || null,
              sort_order: moduleData.sortOrder ?? moduleIndex,
              is_published: moduleData.isPublished ?? false,
              is_required: moduleData.isRequired ?? true,
              requires_quiz_pass: moduleData.requiresQuizPass ?? false,
              min_quiz_score: moduleData.minQuizScore ?? 80,
            })
            .select('id')
            .single();

          if (insertError || !newModule) {
            results.errors.push(`Module "${moduleData.title}": ${insertError?.message || 'Insert failed'}`);
            continue;
          }

          moduleId = newModule.id;
          results.modulesCreated++;
        }

        processedModuleIds.add(moduleId);

        // Process lessons for this module
        if (moduleData.lessons && moduleData.lessons.length > 0) {
          const { data: existingLessons } = await supabaseAdmin
            .from('course_lessons')
            .select('id')
            .eq('module_id', moduleId);

          const existingLessonIds = new Set(existingLessons?.map((l) => l.id) || []);

          for (let lessonIndex = 0; lessonIndex < moduleData.lessons.length; lessonIndex++) {
            const lessonData = moduleData.lessons[lessonIndex];

            try {
              const lessonSlug = lessonData.slug || generateSlug(lessonData.title);
              const lessonNumber = lessonData.lessonNumber || String(lessonIndex + 1).padStart(2, '0');

              const lessonPayload = {
                module_id: moduleId,
                title: lessonData.title,
                slug: lessonSlug,
                description: lessonData.description || null,
                lesson_number: lessonNumber,
                video_uid: lessonData.videoUid || null,
                video_duration_seconds: lessonData.videoDurationSeconds || null,
                video_status: lessonData.videoStatus || 'pending',
                video_playback_hls: lessonData.videoPlaybackHls || null,
                video_playback_dash: lessonData.videoPlaybackDash || null,
                thumbnail_url: lessonData.thumbnailUrl || null,
                transcript_text: lessonData.transcriptText || null,
                resources: lessonData.resources || [],
                sort_order: lessonData.sortOrder ?? lessonIndex,
                is_preview: lessonData.isPreview ?? false,
                is_published: lessonData.isPublished ?? false,
                is_required: lessonData.isRequired ?? true,
                min_watch_percent: lessonData.minWatchPercent ?? 90,
                allow_skip: lessonData.allowSkip ?? false,
              };

              if (lessonData.id && existingLessonIds.has(lessonData.id)) {
                // Update existing lesson
                const { error: updateError } = await supabaseAdmin
                  .from('course_lessons')
                  .update(lessonPayload)
                  .eq('id', lessonData.id);

                if (updateError) {
                  results.errors.push(`Lesson "${lessonData.title}": ${updateError.message}`);
                  continue;
                }
                results.lessonsUpdated++;
              } else {
                // Create new lesson
                const { error: insertError } = await supabaseAdmin
                  .from('course_lessons')
                  .insert(lessonPayload);

                if (insertError) {
                  results.errors.push(`Lesson "${lessonData.title}": ${insertError.message}`);
                  continue;
                }
                results.lessonsCreated++;
              }
            } catch (lessonError) {
              results.errors.push(
                `Lesson "${lessonData.title}": ${lessonError instanceof Error ? lessonError.message : 'Unknown error'}`
              );
            }
          }
        }
      } catch (moduleError) {
        results.errors.push(
          `Module "${moduleData.title}": ${moduleError instanceof Error ? moduleError.message : 'Unknown error'}`
        );
      }
    }

    // Delete modules not in the list if replaceExisting is true
    if (replaceExisting) {
      const modulesToDelete = Array.from(existingModuleIds).filter((id) => !processedModuleIds.has(id));

      if (modulesToDelete.length > 0) {
        // First delete lessons in those modules
        await supabaseAdmin
          .from('course_lessons')
          .delete()
          .in('module_id', modulesToDelete);

        // Then delete the modules
        const { error: deleteError } = await supabaseAdmin
          .from('course_modules')
          .delete()
          .in('id', modulesToDelete);

        if (deleteError) {
          results.errors.push(`Failed to delete modules: ${deleteError.message}`);
        } else {
          logger.info('Deleted orphaned modules', {
            courseId,
            count: modulesToDelete.length,
          });
        }
      }
    }

    logger.info('Course structure update complete', {
      courseId,
      results,
    });

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    logger.error(
      'Error updating course structure',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/knowledge/structure
 *
 * Get the full structure of a course (modules and lessons).
 *
 * Query params:
 * - courseId: string (required)
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json(
        { error: 'courseId is required' },
        { status: 400 }
      );
    }

    // Get course with modules and lessons
    const { data: course, error: courseError } = await supabaseAdmin
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const { data: modules, error: modulesError } = await supabaseAdmin
      .from('course_modules')
      .select('*')
      .eq('course_id', courseId)
      .order('sort_order', { ascending: true });

    if (modulesError) {
      return NextResponse.json(
        { error: 'Failed to fetch modules' },
        { status: 500 }
      );
    }

    // Get lessons for each module
    const moduleIds = modules?.map((m) => m.id) || [];
    const { data: lessons } = await supabaseAdmin
      .from('course_lessons')
      .select('*')
      .in('module_id', moduleIds)
      .order('sort_order', { ascending: true });

    // Group lessons by module
    const lessonsByModule = new Map<string, typeof lessons>();
    lessons?.forEach((lesson) => {
      const existing = lessonsByModule.get(lesson.module_id) || [];
      existing.push(lesson);
      lessonsByModule.set(lesson.module_id, existing);
    });

    // Build the tree structure
    const structure = modules?.map((module) => ({
      ...module,
      lessons: lessonsByModule.get(module.id) || [],
    }));

    return NextResponse.json({
      course,
      modules: structure,
    });
  } catch (error) {
    logger.error(
      'Error fetching course structure',
      error instanceof Error ? error : { message: String(error) }
    );
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
