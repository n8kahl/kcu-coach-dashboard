#!/usr/bin/env npx ts-node
/**
 * Verify KCU Content Import Status
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';

config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

async function verifyImport() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('           KCU Content Import Verification');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get course
  const { data: course } = await supabase
    .from('courses')
    .select('id, title')
    .eq('slug', 'kcu-masterclass')
    .single();
  console.log('Course:', course?.title);
  console.log('ID:', course?.id);

  // Get modules count
  const { data: modules } = await supabase
    .from('course_modules')
    .select('id, title, sort_order')
    .eq('course_id', course?.id)
    .order('sort_order');
  console.log('\nTotal Modules:', modules?.length);

  // Get total lessons
  const { count: totalLessons } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact', head: true });
  console.log('Total Lessons:', totalLessons);

  // Get lessons with videos
  const { count: withVideos } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact', head: true })
    .not('video_uid', 'is', null);
  console.log('Lessons with videos:', withVideos);

  // Get lessons with transcripts
  const { count: withTranscripts } = await supabase
    .from('course_lessons')
    .select('id', { count: 'exact', head: true })
    .not('transcript_text', 'is', null);
  console.log('Lessons with transcripts:', withTranscripts);

  // Get lessons per module
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log('Breakdown by Module:');
  console.log('─────────────────────────────────────────────────────────────');

  for (const mod of modules || []) {
    const { count } = await supabase
      .from('course_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', mod.id);

    const { count: vids } = await supabase
      .from('course_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', mod.id)
      .not('video_uid', 'is', null);

    const { count: transcripts } = await supabase
      .from('course_lessons')
      .select('id', { count: 'exact', head: true })
      .eq('module_id', mod.id)
      .not('transcript_text', 'is', null);

    console.log(
      `  ${mod.title.substring(0, 18).padEnd(18)}: ${String(count).padStart(2)} lessons, ${String(vids).padStart(2)} videos, ${String(transcripts).padStart(2)} transcripts`
    );
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

verifyImport().catch(console.error);
