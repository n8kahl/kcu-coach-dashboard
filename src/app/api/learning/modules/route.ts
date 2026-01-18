import { NextResponse } from 'next/server';
import { CURRICULUM_MODULES, getCurriculumStats } from '@/data/curriculum';

export async function GET() {
  try {
    const stats = getCurriculumStats();

    // Return modules with summary info (no full transcripts)
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
    }));

    return NextResponse.json({
      modules,
      stats,
    });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch modules' },
      { status: 500 }
    );
  }
}
