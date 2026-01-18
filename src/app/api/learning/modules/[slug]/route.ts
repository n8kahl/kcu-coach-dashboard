import { NextRequest, NextResponse } from 'next/server';
import { getModuleBySlug } from '@/data/curriculum';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const module = getModuleBySlug(params.slug);

    if (!module) {
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    // Return module with lesson summaries (no full transcripts)
    const response = {
      id: module.id,
      slug: module.slug,
      title: module.title,
      description: module.description,
      icon: module.icon,
      color: module.color,
      order: module.order,
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description,
        duration: lesson.duration,
        video_id: lesson.video_id,
        key_takeaways: lesson.key_takeaways,
      })),
      estimatedDuration: module.lessons.reduce((sum, l) => sum + l.duration, 0),
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
