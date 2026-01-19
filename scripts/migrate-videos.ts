/**
 * Video Migration Script
 *
 * Migrates videos from local storage to Cloudflare Stream
 * and populates the course database with video metadata.
 *
 * Usage:
 *   npx ts-node scripts/migrate-videos.ts --path="/path/to/videos" --dry-run
 *   npx ts-node scripts/migrate-videos.ts --path="/path/to/videos" --course="KCU Trading Mastery"
 *   npx ts-node scripts/migrate-videos.ts --check-quota  # Check current usage
 *   npx ts-node scripts/migrate-videos.ts --path="/path/to/videos" --resume  # Resume from last failure
 *
 * Environment variables required:
 *   CLOUDFLARE_ACCOUNT_ID
 *   CLOUDFLARE_API_TOKEN
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as tus from 'tus-js-client';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
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
const CHECK_QUOTA = args.includes('--check-quota');
const RESUME = args.includes('--resume');

// File size threshold for TUS uploads (200MB)
const TUS_THRESHOLD_BYTES = 200 * 1024 * 1024;

// Progress tracking file
const PROGRESS_FILE = path.join(process.cwd(), 'scripts', '.migration-progress.json');

interface MigrationProgress {
  lastProcessedVideo: string;
  successfulUploads: string[];
  failedUploads: { file: string; error: string }[];
  startedAt: string;
  lastUpdated: string;
}

function loadProgress(): MigrationProgress | null {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn('Could not load progress file, starting fresh');
  }
  return null;
}

function saveProgress(progress: MigrationProgress): void {
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function checkCloudflareQuota(): Promise<{ usedMinutes: number; allocatedMinutes: number; remainingMinutes: number } | null> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/storage-usage`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch quota info:', await response.text());
      return null;
    }

    const data = await response.json();
    const result = data.result;

    // Get total minutes from videos
    const videosResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream?per_page=1000`,
      {
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );

    if (!videosResponse.ok) {
      console.error('Failed to fetch videos:', await videosResponse.text());
      return null;
    }

    const videosData = await videosResponse.json();
    const totalDuration = videosData.result?.reduce((acc: number, v: any) => acc + (v.duration || 0), 0) || 0;
    const usedMinutes = Math.round(totalDuration / 60);

    // The allocated minutes would need to be fetched from account settings
    // For now, we'll use the error message value if available, or estimate
    const allocatedMinutes = 11000; // Default from your error

    return {
      usedMinutes,
      allocatedMinutes,
      remainingMinutes: allocatedMinutes - usedMinutes,
    };
  } catch (error) {
    console.error('Error checking quota:', error);
    return null;
  }
}

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

// Upload large files using TUS (resumable upload) protocol
async function uploadWithTus(
  filePath: string,
  metadata: { name: string; module: string }
): Promise<{ uid: string; playbackUrl: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const fileBuffer = fs.readFileSync(filePath);
    const fileSize = fs.statSync(filePath).size;

    const upload = new tus.Upload(fileBuffer, {
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream`,
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      },
      chunkSize: 50 * 1024 * 1024, // 50MB chunks
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        name: metadata.name,
        filetype: 'video/mp4',
        requiresignedurls: 'false',
      },
      uploadSize: fileSize,
      onError: (error) => {
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
        process.stdout.write(`\r    Uploading: ${percentage}%`);
      },
      onSuccess: async () => {
        console.log('');
        // Extract video UID from the upload URL
        // Cloudflare returns URL like: https://api.cloudflare.com/.../stream/<uid>
        const uploadUrl = upload.url;
        const uidMatch = uploadUrl?.match(/\/stream\/([a-f0-9]+)/) ||
                        uploadUrl?.match(/([a-f0-9]{32})/);
        const videoUid = uidMatch?.[1];

        if (!videoUid) {
          // Try to get from response headers
          console.log('    Upload URL:', uploadUrl);
          reject(new Error('Could not extract video UID from upload URL'));
          return;
        }

        // Wait for processing
        console.log('    Waiting for video processing...');
        let attempts = 0;
        let videoDetails = null;

        while (attempts < 60) { // Increase attempts for large files
          await new Promise(r => setTimeout(r, 3000));

          try {
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
              const state = data.result?.status?.state;
              if (state === 'ready') {
                videoDetails = data.result;
                break;
              } else if (state === 'error') {
                reject(new Error(`Video processing failed: ${data.result?.status?.errorReasonText || 'Unknown error'}`));
                return;
              }
              // Still processing, continue waiting
            }
          } catch (e) {
            // Retry on network errors
          }

          attempts++;
        }

        resolve({
          uid: videoUid,
          playbackUrl: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${videoUid}/manifest/video.m3u8`,
          duration: videoDetails?.duration || 0,
        });
      },
    });

    upload.start();
  });
}

// Upload smaller files using direct upload API
async function uploadDirect(
  filePath: string,
  metadata: { name: string; module: string }
): Promise<{ uid: string; playbackUrl: string; duration: number }> {
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
  console.log('    Waiting for video processing...');
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
}

interface UploadError {
  type: 'quota_exceeded' | 'payload_too_large' | 'network' | 'unknown';
  message: string;
}

function parseUploadError(error: any): UploadError {
  const errorStr = error?.message || String(error);

  if (errorStr.includes('10011') || errorStr.includes('Storage capacity exceeded') || errorStr.includes('exceeded your allocated')) {
    return { type: 'quota_exceeded', message: 'Cloudflare Stream storage quota exceeded' };
  }

  if (errorStr.includes('Payload Too Large') || errorStr.includes('413')) {
    return { type: 'payload_too_large', message: 'File too large for direct upload' };
  }

  if (errorStr.includes('ENOTFOUND') || errorStr.includes('ETIMEDOUT') || errorStr.includes('fetch failed')) {
    return { type: 'network', message: 'Network error during upload' };
  }

  return { type: 'unknown', message: errorStr };
}

async function uploadToCloudflareStream(
  filePath: string,
  metadata: { name: string; module: string }
): Promise<{ uid: string; playbackUrl: string; duration: number; error?: UploadError } | null> {
  if (SKIP_UPLOAD) {
    console.log(`    [SKIP] Would upload: ${metadata.name}`);
    return {
      uid: `mock-uid-${Date.now()}`,
      playbackUrl: `https://mock.cloudflarestream.com/mock/manifest/video.m3u8`,
      duration: 0,
    };
  }

  try {
    const fileSize = fs.statSync(filePath).size;
    const fileSizeMB = (fileSize / 1024 / 1024).toFixed(1);

    // Use TUS for files larger than 200MB
    if (fileSize > TUS_THRESHOLD_BYTES) {
      console.log(`    Using TUS upload for large file (${fileSizeMB} MB)...`);
      return await uploadWithTus(filePath, metadata);
    } else {
      console.log(`    Using direct upload (${fileSizeMB} MB)...`);
      return await uploadDirect(filePath, metadata);
    }
  } catch (error: any) {
    const parsedError = parseUploadError(error);
    console.error(`    Error uploading to Cloudflare: ${parsedError.message}`);

    // For payload too large errors, try TUS as fallback
    if (parsedError.type === 'payload_too_large') {
      console.log(`    Retrying with TUS upload...`);
      try {
        return await uploadWithTus(filePath, metadata);
      } catch (tusError) {
        const tusErrorParsed = parseUploadError(tusError);
        return { uid: '', playbackUrl: '', duration: 0, error: tusErrorParsed };
      }
    }

    return { uid: '', playbackUrl: '', duration: 0, error: parsedError };
  }
}

async function migrateVideos() {
  console.log('='.repeat(60));
  console.log('KCU Video Migration Script');
  console.log('='.repeat(60));

  // Handle quota check mode
  if (CHECK_QUOTA) {
    console.log('\nChecking Cloudflare Stream quota...\n');

    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');
      process.exit(1);
    }

    const quota = await checkCloudflareQuota();
    if (quota) {
      console.log('Cloudflare Stream Usage:');
      console.log(`  Used:      ${quota.usedMinutes.toLocaleString()} minutes`);
      console.log(`  Allocated: ${quota.allocatedMinutes.toLocaleString()} minutes`);
      console.log(`  Remaining: ${quota.remainingMinutes.toLocaleString()} minutes`);

      if (quota.remainingMinutes <= 0) {
        console.log('\n⚠️  WARNING: You have exceeded your storage quota!');
        console.log('   You need to either:');
        console.log('   1. Upgrade your Cloudflare Stream plan');
        console.log('   2. Delete existing videos to free up space');
      } else if (quota.remainingMinutes < 100) {
        console.log('\n⚠️  WARNING: You are running low on storage quota!');
      }
    } else {
      console.log('Could not fetch quota information');
    }
    return;
  }

  console.log(`\nSource: ${VIDEO_BASE_PATH}`);
  console.log(`Course: ${COURSE_TITLE}`);
  console.log(`Dry Run: ${DRY_RUN}`);
  console.log(`Skip Upload: ${SKIP_UPLOAD}`);
  console.log(`Resume Mode: ${RESUME}\n`);

  // Validate environment
  if (!DRY_RUN && !SKIP_UPLOAD) {
    if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
      console.error('Error: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required');
      process.exit(1);
    }

    // Check quota before starting
    console.log('Checking Cloudflare quota...');
    const quota = await checkCloudflareQuota();
    if (quota) {
      console.log(`  Current usage: ${quota.usedMinutes.toLocaleString()}/${quota.allocatedMinutes.toLocaleString()} minutes`);
      if (quota.remainingMinutes <= 0) {
        console.error('\n❌ ERROR: Storage quota exceeded!');
        console.error('   You have used all your allocated storage minutes.');
        console.error('   Please upgrade your plan or delete existing videos before continuing.');
        console.error('\n   To check current usage: npx ts-node scripts/migrate-videos.ts --check-quota');
        process.exit(1);
      }
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Error: Supabase credentials are required');
    process.exit(1);
  }

  // Load previous progress if resuming
  let previousProgress: MigrationProgress | null = null;
  if (RESUME) {
    previousProgress = loadProgress();
    if (previousProgress) {
      console.log(`Resuming from previous run (started ${previousProgress.startedAt})`);
      console.log(`  Previously successful: ${previousProgress.successfulUploads.length}`);
      console.log(`  Previously failed: ${previousProgress.failedUploads.length}\n`);
    } else {
      console.log('No previous progress found, starting fresh\n');
    }
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
  let quotaExceeded = false;

  // Initialize or continue progress tracking
  const progress: MigrationProgress = previousProgress || {
    lastProcessedVideo: '',
    successfulUploads: [],
    failedUploads: [],
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  };

  for (const [moduleNumber, moduleVideos] of Array.from(moduleGroups.entries())) {
    if (quotaExceeded) break;

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
      if (quotaExceeded) break;

      const videoKey = `${video.moduleNumber}/${video.lessonNumber}`;

      // Skip if already successfully uploaded in a previous run
      if (RESUME && progress.successfulUploads.includes(videoKey)) {
        console.log(`\n  ${video.lessonNumber} ${video.title}`);
        console.log(`    [SKIPPED] Already uploaded in previous run`);
        lessonOrder++;
        continue;
      }

      console.log(`\n  ${video.lessonNumber} ${video.title}`);

      // Upload to Cloudflare Stream
      console.log(`    Uploading to Cloudflare Stream...`);
      const streamResult = await uploadToCloudflareStream(video.filePath, {
        name: `${video.lessonNumber} ${video.title}`,
        module: video.moduleName,
      });

      // Check for errors
      if (!streamResult || streamResult.error) {
        const errorInfo = streamResult?.error || { type: 'unknown', message: 'Unknown error' };

        // Handle quota exceeded - stop processing
        if (errorInfo.type === 'quota_exceeded') {
          console.error('\n❌ QUOTA EXCEEDED - Stopping migration');
          console.error('   You need to upgrade your Cloudflare Stream plan or delete existing videos.');
          quotaExceeded = true;
          progress.failedUploads.push({ file: videoKey, error: errorInfo.message });
          saveProgress(progress);
          break;
        }

        results.push({
          success: false,
          error: errorInfo.message,
        });
        progress.failedUploads.push({ file: videoKey, error: errorInfo.message });
        progress.lastProcessedVideo = videoKey;
        saveProgress(progress);
        continue;
      }

      if (!streamResult.uid) {
        results.push({
          success: false,
          error: 'Failed to upload to Cloudflare Stream',
        });
        progress.failedUploads.push({ file: videoKey, error: 'Failed to upload' });
        progress.lastProcessedVideo = videoKey;
        saveProgress(progress);
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

      // Track successful upload
      progress.successfulUploads.push(videoKey);
      progress.lastProcessedVideo = videoKey;
      saveProgress(progress);
    }
  }

  // Save final progress
  saveProgress(progress);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Migration Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\nThis session:`);
  console.log(`  Videos processed: ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed: ${failed}`);

  console.log(`\nOverall progress:`);
  console.log(`  Total successful uploads: ${progress.successfulUploads.length}`);
  console.log(`  Total failed: ${progress.failedUploads.length}`);

  if (quotaExceeded) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  MIGRATION STOPPED DUE TO QUOTA EXCEEDED');
    console.log('='.repeat(60));
    console.log('\nTo continue, you need to:');
    console.log('  1. Upgrade your Cloudflare Stream plan, OR');
    console.log('  2. Delete existing videos to free up space');
    console.log('\nOnce you have more capacity, resume with:');
    console.log('  npx ts-node scripts/migrate-videos.ts --path="..." --resume');
  } else if (failed > 0) {
    console.log('\nFailed uploads:');

    // Group failures by error type
    const errorGroups = new Map<string, string[]>();
    progress.failedUploads.forEach(f => {
      if (!errorGroups.has(f.error)) {
        errorGroups.set(f.error, []);
      }
      errorGroups.get(f.error)!.push(f.file);
    });

    errorGroups.forEach((files, error) => {
      console.log(`\n  ${error}:`);
      files.slice(0, 5).forEach(f => console.log(`    - ${f}`));
      if (files.length > 5) {
        console.log(`    ... and ${files.length - 5} more`);
      }
    });

    console.log('\nTo retry failed videos, run:');
    console.log('  npx ts-node scripts/migrate-videos.ts --path="..." --resume');
  } else {
    console.log('\n✅ Migration complete!');

    // Clean up progress file on successful completion
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
      console.log('Progress file cleaned up.');
    }
  }

  console.log(`\nProgress saved to: ${PROGRESS_FILE}`);
}

// Run
migrateVideos().catch(console.error);
