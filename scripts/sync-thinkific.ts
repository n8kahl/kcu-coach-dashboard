#!/usr/bin/env npx tsx
/**
 * Thinkific Course Sync Script
 *
 * Fetches available courses from Thinkific API and syncs them to the database.
 *
 * Usage:
 *   npx tsx scripts/sync-thinkific.ts         # List available courses
 *   npx tsx scripts/sync-thinkific.ts --all   # Sync all courses
 *   npx tsx scripts/sync-thinkific.ts --id=123456  # Sync specific course by ID
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const THINKIFIC_API_BASE = 'https://api.thinkific.com/api/public/v1';
const THINKIFIC_SUBDOMAIN = process.env.THINKIFIC_SUBDOMAIN || 'kaycapitals';
const THINKIFIC_API_KEY = process.env.THINKIFIC_API_KEY;

interface ThinkificCourse {
  id: number;
  name: string;
  slug: string;
  description?: string;
  course_card_image_url?: string;
  banner_image_url?: string;
}

async function thinkificRequest<T>(endpoint: string): Promise<T> {
  if (!THINKIFIC_API_KEY) {
    throw new Error('THINKIFIC_API_KEY is not configured in .env.local');
  }

  const url = `${THINKIFIC_API_BASE}${endpoint}`;

  // Detect if API key is a JWT token or legacy API key
  const isJwtToken = THINKIFIC_API_KEY.startsWith('eyJ');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (isJwtToken) {
    headers['Authorization'] = `Bearer ${THINKIFIC_API_KEY}`;
  } else {
    headers['X-Auth-API-Key'] = THINKIFIC_API_KEY;
    headers['X-Auth-Subdomain'] = THINKIFIC_SUBDOMAIN;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Thinkific API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function getCourses(): Promise<ThinkificCourse[]> {
  const allCourses: ThinkificCourse[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await thinkificRequest<{ items: ThinkificCourse[] } | ThinkificCourse[]>(
      `/courses?page=${page}&limit=25`
    );

    const items = Array.isArray(response) ? response : response.items || [];
    allCourses.push(...items);

    if (items.length < 25) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allCourses;
}

async function main() {
  const args = process.argv.slice(2);
  const shouldSyncAll = args.includes('--all');
  const idArg = args.find(a => a.startsWith('--id='));
  const courseId = idArg ? parseInt(idArg.split('=')[1], 10) : null;

  console.log('\n🎓 Thinkific Course Sync Tool\n');
  console.log(`   Subdomain: ${THINKIFIC_SUBDOMAIN}`);
  console.log(`   API Key: ${THINKIFIC_API_KEY ? '✓ Configured' : '✗ Not configured'}\n`);

  if (!THINKIFIC_API_KEY) {
    console.error('❌ THINKIFIC_API_KEY is not set. Add it to .env.local');
    process.exit(1);
  }

  try {
    console.log('📚 Fetching available courses from Thinkific...\n');
    const courses = await getCourses();

    console.log(`Found ${courses.length} course(s):\n`);

    courses.forEach((course, index) => {
      console.log(`   ${index + 1}. [ID: ${course.id}] ${course.name}`);
      console.log(`      Slug: ${course.slug}`);
      if (course.description) {
        console.log(`      Description: ${course.description.substring(0, 80)}...`);
      }
      console.log('');
    });

    // Find Kay Capitals University course
    const kayCapitals = courses.find(c =>
      c.name.toLowerCase().includes('kay capitals') ||
      c.name.toLowerCase().includes('kings corner') ||
      c.name.toLowerCase().includes('kcu')
    );

    if (kayCapitals) {
      console.log(`\n✨ Found potential match: "${kayCapitals.name}" (ID: ${kayCapitals.id})\n`);
      console.log(`   To sync this course, run:`);
      console.log(`   npx tsx scripts/sync-thinkific.ts --id=${kayCapitals.id}\n`);
    }

    if (shouldSyncAll || courseId) {
      console.log('\n📥 Starting sync...\n');

      // Import the sync functions from the app
      const { syncThinkificCourses, syncThinkificCoursesByIds } = await import('../src/lib/thinkific-api');

      if (courseId) {
        console.log(`   Syncing course ID: ${courseId}`);
        const result = await syncThinkificCoursesByIds([courseId]);
        console.log('\n✅ Sync complete:');
        console.log(`   Courses: ${result.courses_synced}`);
        console.log(`   Chapters: ${result.chapters_synced}`);
        console.log(`   Contents: ${result.contents_synced}`);
        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`);
          result.errors.forEach(e => console.log(`      - ${e}`));
        }
      } else {
        console.log('   Syncing all courses...');
        const result = await syncThinkificCourses();
        console.log('\n✅ Sync complete:');
        console.log(`   Courses: ${result.courses_synced}`);
        console.log(`   Chapters: ${result.chapters_synced}`);
        console.log(`   Contents: ${result.contents_synced}`);
        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`);
          result.errors.forEach(e => console.log(`      - ${e}`));
        }
      }
    } else {
      console.log('💡 Usage:');
      console.log('   npx tsx scripts/sync-thinkific.ts --all       # Sync all courses');
      console.log('   npx tsx scripts/sync-thinkific.ts --id=12345  # Sync specific course\n');
    }

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
