/**
 * GET /api/learn/courses/[courseSlug]/modules/[moduleSlug]/lessons/[lessonSlug]/transcript-segments
 *
 * Returns timestamped transcript segments for a lesson.
 * Used by TranscriptPanel for synchronized transcript highlighting.
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

    // Get the lesson ID from the slugs
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from('course_lessons')
      .select(`
        id,
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
      .single();

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Fetch transcript segments for this lesson
    const { data: segments, error: segmentsError } = await supabaseAdmin
      .from('transcript_segments')
      .select('segment_index, text, start_ms, end_ms, start_formatted')
      .eq('content_type', 'course_lesson')
      .eq('content_id', lesson.id)
      .order('start_ms', { ascending: true });

    if (segmentsError) {
      console.error('Error fetching transcript segments:', segmentsError);
      return NextResponse.json({ segments: [] });
    }

    // Transform to match TranscriptPanel's expected format
    const formattedSegments = (segments || []).map(seg => ({
      text: seg.text,
      startTime: seg.start_ms / 1000, // Convert ms to seconds
      endTime: seg.end_ms / 1000,
      startFormatted: seg.start_formatted,
    }));

    return NextResponse.json({
      segments: formattedSegments,
      count: formattedSegments.length,
    });
  } catch (error) {
    console.error('Error in transcript-segments API:', error);
    return NextResponse.json({ segments: [] });
  }
}
