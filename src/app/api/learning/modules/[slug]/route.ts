import { NextRequest, NextResponse } from 'next/server';
import { getModuleBySlug } from '@/data/curriculum';
import { getThinkificCourseWithContents, hasThinkificContent } from '@/lib/learning-progress';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;

    // First, try to get from Thinkific synced content
    const hasThinkific = await hasThinkificContent();
    if (hasThinkific) {
      const courseData = await getThinkificCourseWithContents(slug);
      if (courseData) {
        return NextResponse.json({
          ...courseData,
          source: 'thinkific',
        });
      }
    }

    // Fall back to local curriculum data
    const module = getModuleBySlug(slug);

    if (!module) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    // Return module with lesson summaries (no full transcripts)
    const response = {
      course: {
        id: module.id,
        thinkific_id: 0,
        slug: module.slug,
        title: module.title,
        description: module.description,
        image_url: null,
        lesson_count: module.lessons.length,
        chapter_count: 1,
        duration: null,
      },
      chapters: [
        {
          id: `${module.id}-chapter-1`,
          thinkific_id: 0,
          name: module.title,
          description: module.description,
          position: 1,
          contents: module.lessons.map((lesson, index) => ({
            id: lesson.id,
            thinkific_id: 0,
            name: lesson.title,
            content_type: 'video',
            position: index + 1,
            video_duration: lesson.duration,
            video_provider: 'youtube',
            free_preview: false,
            description: lesson.description,
          })),
        },
      ],
      source: 'local',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching module:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module' },
      { status: 500 }
    );
  }
}
