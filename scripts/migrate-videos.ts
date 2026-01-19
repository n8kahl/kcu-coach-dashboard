/**
 * Video Migration Script
 *
 * Migrates videos from local storage to Cloudflare Stream
 * and populates the course database with video metadata.
 *
 * Usage:
 *   npx ts-node scripts/migrate-videos.ts --path="/path/to/videos" --dry-run
 *   npx ts-node scripts/migrate-videos.ts --path="/path/to/videos" --course="KCU Trading Mastery"
 *
 * Environment variables required:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Configuration
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface VideoFile {
  moduleName: string;
  moduleNumber: string;
  lessonNumber: string;
  title: string;
  filePath: string;
  transcriptPath?: string;
  fileSize: number;
}

interface MigrationResult {
  success: boolean;
  moduleId?: string;
  lessonId?: string;
  videoUid?: string;
  videoUrl?: string;
  error?: string;
}

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find(a => a.startsWith(`--${name}=`));
  return arg?.split('=')[1];
};

const VIDEO_BASE_PATH = getArg('path') || '/path/to/Videos - English';
const COURSE_TITLE = getArg('course') || 'KCU Trading Mastery';
const DRY_RUN = args.includes('--dry-run');
const SKIP_UPLOAD = args.includes('--skip-upload');

async function discoverVideos(basePath: string): Promise<VideoFile[]> {
  const videos: VideoFile[] = [];

  if (!fs.existsSync(basePath)) {
    console.error(`Error: Path does not exist: ${basePath}`);
    return videos;
  }

  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const moduleDir = entry.name;
    const modulePath = path.join(basePath, moduleDir);

    // Parse module number from directory name
    const moduleMatch = moduleDir.match(/Module\s*([\d.]+)/i) ||
                       moduleDir.match(/^([\d.]+)/);
    const moduleNumber = moduleMatch ? moduleMatch[1] : '0';

    // Find video files in this module directory
    const moduleFiles = fs.readdirSync(modulePath);

    for (const file of moduleFiles) {
      // Match video files (mp4, mov)
      if (!file.match(/\.(mp4|mov)$/i)) continue;

      // Parse lesson number and title from filename
      // Format: "5.1 Module Overview.mp4" or "1. Introduction.mp4"
      const lessonMatch = file.match(/^([\d.]+)\s*[.-]?\s*(.+)\.(mp4|mov)$/i);
      if (!lessonMatch) {
        console.warn(`Skipping file with unexpected format: ${file}`);
        continue;
      }

      const lessonNumber = lessonMatch[1];
      const title = lessonMatch[2].trim();
      const filePath = path.join(modulePath, file);
      const fileStats = fs.statSync(filePath);

      // Look for matching transcript
      const transcriptDirs = ['txt', 'Transcriptions', 'transcripts'];
      let transcriptPath: string | undefined;

      for (const txDir of transcriptDirs) {
        const txDirPath = path.join(modulePath, txDir);
        if (!fs.existsSync(txDirPath)) continue;

        // Try different transcript naming patterns
        const patterns = [
          `${lessonNumber} ${title}.txt`,
          `${lessonNumber}. ${title}.txt`,
          `${lessonNumber} - ${title}.txt`,
          `${title}.txt`,
        ];

        for (const pattern of patterns) {
          const txPath = path.join(txDirPath, pattern);
          if (fs.existsSync(txPath)) {
            transcriptPath = txPath;
            break;
          }
        }
        if (transcriptPath) break;
      }

      videos.push({
        moduleName: moduleDir,
        moduleNumber,
        lessonNumber,
        title,
        filePath,
        transcriptPath,
        fileSize: fileStats.size,
      });
    }
  }

  // Sort by module and lesson number
  return videos.sort((a, b) => {
    const aModule = parseFloat(a.moduleNumber) || 0;
    const bModule = parseFloat(b.moduleNumber) || 0;
    if (aModule !== bModule) return aModule - bModule;

    const aLesson = parseFloat(a.lessonNumber) || 0;
    const bLesson = parseFloat(b.lessonNumber) || 0;
    return aLesson - bLesson;
  });
}

async function uploadToCloudflareStream(
  filePath: string,
  metadata: { name: string; module: string }
): Promise<{ uid: string; playbackUrl: string; duration: number } | null> {
  if (SKIP_UPLOAD) {
    console.log(`    [SKIP] Would upload: ${metadata.name}`);
    return {
      uid: `mock-uid-${Date.now()}`,
      playbackUrl: `https://mock.cloudflarestream.com/mock/manifest/video.m3u8`,
      duration: 0,
    };
  }

  try {
    // Read the file
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Create upload using direct upload API
    const createResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200, // 2 hours max
          meta: {
            name: metadata.name,
            module: metadata.module,
          },
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create upload URL: ${error}`);
    }

    const { result } = await createResponse.json();
    const uploadUrl = result.uploadURL;
    const videoUid = result.uid;

    // Upload the file using the provided URL
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileSize.toString(),
      },
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload video: ${uploadResponse.statusText}`);
    }

    // Wait for processing and get video details
    let attempts = 0;
    let videoDetails = null;

    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const detailsResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${videoUid}`,
        {
          headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
          },
        }
      );

      if (detailsResponse.ok) {
        const data = await detailsResponse.json();
        if (data.result?.status?.state === 'ready') {
          videoDetails = data.result;
          break;
        }
      }

      attempts++;
    }

    if (!videoDetails) {
      console.warn(`    Warning: Video ${videoUid} still processing after timeout`);
    }

    return {
      uid: videoUid,
      playbackUrl: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${videoUid}/manifest/video.m3u8`,
      duration: videoDetails?.duration || 0,
    };
  } catch (error) {
    console.error(`    Error uploading to Cloudflare:`, error);
    return null;
  }
}

async function migrateVideos() {
  console.log('='.repeat(60));
  console.log('KCU Video Migration Script');
  console.log('='.repeat(60));
  console.log(`\nSource: ${VIDEO_BASE_PATH}`);
  console.log(`Course: ${COURSE_TITLE}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log(`Skip Upload: ${SKIP_UPLOAD}\n`);

  // Validate environment
  if (!DRY_RUN && !SKIP_UPLOAD) {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');
      process.exit(1);
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: Supabase credentials are required');
    process.exit(1);
  }

  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Discover videos
  console.log('Discovering videos...');
  const videos = await discoverVideos(VIDEO_BASE_PATH);
  console.log(`Found ${videos.length} videos\n`);

  if (videos.length === 0) {
    console.log('No videos found. Exiting.');
    return;
  }

  // Group by module
  const moduleGroups = new Map<string, VideoFile[]>();
  for (const video of videos) {
    const key = video.moduleNumber;
    if (!moduleGroups.has(key)) {
      moduleGroups.set(key, []);
    }
    moduleGroups.get(key)!.push(video);
  }

  console.log(`Modules found: ${moduleGroups.size}`);
  moduleGroups.forEach((vids, mod) => {
    console.log(`  Module ${mod}: ${vids.length} videos`);
  });
  console.log('');

  if (DRY_RUN) {
    console.log('DRY RUN - No changes will be made\n');
    console.log('Videos to migrate:');
    for (const video of videos) {
      const sizeInMB = (video.fileSize / 1024 / 1024).toFixed(1);
      console.log(`  ${video.lessonNumber} ${video.title} (${sizeInMB} MB)`);
      console.log(`    Path: ${video.filePath}`);
      console.log(`    Transcript: ${video.transcriptPath || 'Not found'}`);
    }
    return;
  }

  // Create or get course
  console.log('Creating/updating course...');
  const courseSlug = COURSE_TITLE.toLowerCase().replace(/\s+/g, '-');

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .upsert({
      title: COURSE_TITLE,
      slug: courseSlug,
      description: 'Complete trading education from basics to advanced LTP strategy',
      is_published: true,
      is_gated: true,
    }, { onConflict: 'slug' })
    .select()
    .single();

  if (courseError) {
    console.error('Error creating course:', courseError);
    process.exit(1);
  }

  console.log(`Course ID: ${course.id}\n`);

  // Process each module
  let moduleOrder = 0;
  const results: MigrationResult[] = [];

  for (const [moduleNumber, moduleVideos] of Array.from(moduleGroups.entries())) {
    const firstVideo = moduleVideos[0];
    console.log(`\nProcessing Module ${moduleNumber}: ${firstVideo.moduleName}`);
    console.log('-'.repeat(50));

    // Create module
    const moduleSlug = `module-${moduleNumber.replace('.', '-')}`;
    const { data: module, error: moduleError } = await supabase
      .from('course_modules')
      .upsert({
        course_id: course.id,
        title: firstVideo.moduleName,
        slug: moduleSlug,
        module_number: moduleNumber,
        sort_order: moduleOrder++,
        is_published: true,
      }, { onConflict: 'course_id,slug' })
      .select()
      .single();

    if (moduleError) {
      console.error(`  Error creating module: ${moduleError.message}`);
      continue;
    }

    // Process each video
    let lessonOrder = 0;
    for (const video of moduleVideos) {
      console.log(`\n  ${video.lessonNumber} ${video.title}`);

      // Upload to Cloudflare Stream
      console.log(`    Uploading to Cloudflare Stream...`);
      const streamResult = await uploadToCloudflareStream(video.filePath, {
        name: `${video.lessonNumber} ${video.title}`,
        module: video.moduleName,
      });

      if (!streamResult) {
        results.push({
          success: false,
          error: 'Failed to upload to Cloudflare Stream',
        });
        continue;
      }

      // Read transcript
      let transcriptText = '';
      let transcriptUrl = '';

      if (video.transcriptPath && fs.existsSync(video.transcriptPath)) {
        transcriptText = fs.readFileSync(video.transcriptPath, 'utf-8');

        // Upload transcript to Supabase Storage
        const transcriptBuffer = fs.readFileSync(video.transcriptPath);
        const storagePath = `${moduleNumber}/${video.lessonNumber}.txt`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('transcripts')
          .upload(storagePath, transcriptBuffer, {
            contentType: 'text/plain',
            upsert: true,
          });

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('transcripts')
            .getPublicUrl(uploadData.path);
          transcriptUrl = urlData.publicUrl;
        }

        if (uploadError) {
          console.warn(`    Warning: Failed to upload transcript: ${uploadError.message}`);
        }
      }

      // Create lesson record
      const lessonSlug = `${video.lessonNumber.replace('.', '-')}-${video.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const { data: lesson, error: lessonError } = await supabase
        .from('course_lessons')
        .upsert({
          module_id: module.id,
          title: video.title,
          slug: lessonSlug,
          lesson_number: video.lessonNumber,
          video_url: streamResult.playbackUrl,
          video_uid: streamResult.uid,
          video_duration_seconds: Math.round(streamResult.duration),
          transcript_url: transcriptUrl,
          transcript_text: transcriptText,
          sort_order: lessonOrder++,
          is_published: true,
        }, { onConflict: 'module_id,slug' })
        .select()
        .single();

      if (lessonError) {
        console.error(`    Error creating lesson: ${lessonError.message}`);
        results.push({
          success: false,
          moduleId: module.id,
          error: lessonError.message,
        });
        continue;
      }

      const duration = streamResult.duration > 0
        ? `${Math.round(streamResult.duration / 60)}min`
        : 'processing';

      console.log(`    OK (${duration})`);
      results.push({
        success: true,
        moduleId: module.id,
        lessonId: lesson.id,
        videoUid: streamResult.uid,
        videoUrl: streamResult.playbackUrl,
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total videos processed: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    console.log('\nFailed uploads:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.error}`);
    });
  }

  console.log('\nMigration complete!');
}

// Run
migrateVideos().catch(console.error);
