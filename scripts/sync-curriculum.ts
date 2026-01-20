#!/usr/bin/env npx ts-node
/**
 * Sync Curriculum Data from Database
 *
 * Generates the curriculum data file from the database content
 * so the AI Coach can reference imported lessons.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Module colors for visual distinction
const MODULE_COLORS: Record<number, string> = {
  1: '#3B82F6', // Blue
  2: '#10B981', // Green
  3: '#8B5CF6', // Purple
  4: '#F59E0B', // Amber
  5: '#EF4444', // Red
  6: '#06B6D4', // Cyan
  7: '#EC4899', // Pink
  8: '#6366F1', // Indigo
  9: '#84CC16', // Lime
  10: '#F97316', // Orange
};

const MODULE_ICONS: Record<number, string> = {
  1: 'BookOpen',
  2: 'TrendingUp',
  3: 'Settings',
  4: 'LineChart',
  5: 'BarChart2',
  6: 'Target',
  7: 'Clock',
  8: 'Zap',
  9: 'Award',
  10: 'Layers',
};

async function syncCurriculum() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           Sync Curriculum from Database');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get course
  const { data: course } = await supabase
    .from('courses')
    .select('id, title')
    .eq('slug', 'kcu-masterclass')
    .single();

  if (!course) {
    console.error('Course not found!');
    return;
  }

  console.log('Course:', course.title);

  // Get modules with lessons
  const { data: modules } = await supabase
    .from('course_modules')
    .select('*')
    .eq('course_id', course.id)
    .order('sort_order');

  if (!modules?.length) {
    console.error('No modules found!');
    return;
  }

  // Get all lessons
  const moduleIds = modules.map((m) => m.id);
  const { data: lessons } = await supabase
    .from('course_lessons')
    .select('*')
    .in('module_id', moduleIds)
    .order('sort_order');

  // Group lessons by module
  const lessonsByModule: Record<string, typeof lessons> = {};
  for (const lesson of lessons || []) {
    if (!lessonsByModule[lesson.module_id]) {
      lessonsByModule[lesson.module_id] = [];
    }
    lessonsByModule[lesson.module_id].push(lesson);
  }

  // Generate curriculum modules
  const curriculumModules = modules.map((mod, idx) => {
    const modLessons = lessonsByModule[mod.id] || [];
    const order = idx + 1;

    return {
      id: mod.id,
      slug: mod.slug,
      title: mod.title,
      description: mod.description || `${mod.title} - KCU Masterclass content`,
      icon: MODULE_ICONS[order] || 'BookOpen',
      color: MODULE_COLORS[order] || '#6366F1',
      order,
      lessons: modLessons.map((lesson) => ({
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        description: lesson.description || '',
        video_id: lesson.video_uid || '',
        duration: lesson.video_duration_seconds || 0,
        transcript: lesson.transcript_text ? '(available)' : '',
        key_takeaways: [] as string[],
      })),
    };
  });

  // Generate TypeScript file content
  const fileContent = `/**
 * KCU Curriculum Data
 *
 * Auto-generated from database content.
 * Last synced: ${new Date().toISOString()}
 *
 * This file contains the complete curriculum structure for the learning management system.
 */

import type { CurriculumModule } from '@/types';

export const CURRICULUM_MODULES: CurriculumModule[] = ${JSON.stringify(curriculumModules, null, 2)};
`;

  // Write to file
  const outputPath = path.join(__dirname, '..', 'src', 'data', 'curriculum.ts');
  await fs.writeFile(outputPath, fileContent, 'utf-8');

  console.log(`\n✓ Generated curriculum file with:`);
  console.log(`  - ${modules.length} modules`);
  console.log(`  - ${lessons?.length || 0} lessons`);
  console.log(`  - Output: ${outputPath}`);
  console.log('\n═══════════════════════════════════════════════════════════\n');
}

syncCurriculum().catch(console.error);
