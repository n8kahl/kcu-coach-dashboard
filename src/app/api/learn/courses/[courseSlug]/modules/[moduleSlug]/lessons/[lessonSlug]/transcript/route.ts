/**
 * GET /api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/transcript
 *
 * Returns transcript text and URL for a lesson.
 * This endpoint is separate from the main lesson endpoint to avoid shipping
 * large transcript payloads on initial lesson fetch (improves TTFF).
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{
    courseSlug: string;
    moduleSlug: string;
    lessonSlug: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { courseSlug, moduleSlug, lessonSlug } = await context.params;

    // Get the lesson with transcript data
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select(`
        id,
        transcript_text,
        transcript_url,
        course_modules!inner (
          slug,
          courses!inner (
            slug
          )
        )
      `)
      .eq('slug', lessonSlug)
      .eq('course_modules.slug', moduleSlug)
      .eq('course_modules.courses.slug', courseSlug)
      .eq('is_published', true)
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    return NextResponse.json({
      transcriptText: lesson.transcript_text,
      transcriptUrl: lesson.transcript_url,
      // Future: add segments here for synchronized highlighting
      // segments: []
    });
  } catch (error) {
    console.error('Error in transcript API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
