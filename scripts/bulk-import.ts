#!/usr/bin/env npx ts-node
/**
 * KCU Bulk Content Import Script
 *
 * Automatically imports video courses from a local folder structure
 * into the KCU Content Studio CMS.
 *
 * Usage:
 *   npx ts-node scripts/bulk-import.ts --dry-run
 *   npx ts-node scripts/bulk-import.ts --source "/path/to/Videos" --course "KCU Masterclass"
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv({ path: path.join(__dirname, '..', '.env.local') });

import {
  getOrCreateCourse,
  getOrCreateModule,
  getOrCreateLesson,
  updateLesson,
  slugify,
} from './lib/supabase-admin';
import {
  uploadVideo,
  formatBytes,
  getFileSize,
} from './lib/cloudflare-upload';

// ============================================
// Types
// ============================================

interface ScannedLesson {
  filePath: string;
  fileName: string;
  lessonNumber: string;
  title: string;
  transcriptPath?: string;
  sortOrder: number;
  fileSize: number;
}

interface ScannedModule {
  folderName: string;
  folderPath: string;
  moduleNumber: string;
  title: string;
  sortOrder: number;
  lessons: ScannedLesson[];
}

interface ImportConfig {
  sourcePath: string;
  transcriptsPath?: string;
  courseName: string;
  courseSlug: string;
  dryRun: boolean;
  skipExisting: boolean;
  startModule?: number;
  limitLessons?: number;
  concurrentUploads: number;
}

interface ImportStats {
  modulesProcessed: number;
  lessonsCreated: number;
  lessonsSkipped: number;
  videosUploaded: number;
  transcriptsImported: number;
  errors: string[];
  startTime: number;
}

// ============================================
// CLI Argument Parsing
// ============================================

function parseArgs(): ImportConfig {
  const args = process.argv.slice(2);
  const config: ImportConfig = {
    sourcePath: '/Users/natekahl/Desktop/Kay/Videos - English',
    courseName: 'KCU Masterclass',
    courseSlug: 'kcu-masterclass',
    dryRun: false,
    skipExisting: true,
    concurrentUploads: 1,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--source':
        config.sourcePath = args[++i];
        break;
      case '--transcripts':
        config.transcriptsPath = args[++i];
        break;
      case '--course':
        config.courseName = args[++i];
        config.courseSlug = slugify(args[i]);
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--no-skip-existing':
        config.skipExisting = false;
        break;
      case '--start-module':
        config.startModule = parseInt(args[++i], 10);
        break;
      case '--concurrent':
        config.concurrentUploads = parseInt(args[++i], 10);
        break;
      case '--limit':
        config.limitLessons = parseInt(args[++i], 10);
        break;
      case '--help':
        printHelp();
        process.exit(0);
    }
  }

  // Auto-detect transcripts path if not provided
  if (!config.transcriptsPath) {
    config.transcriptsPath = path.join(config.sourcePath, 'Transcriptions');
  }

  return config;
}

function printHelp(): void {
  console.log(`
KCU Bulk Content Import

Usage:
  npx ts-node scripts/bulk-import.ts [options]

Options:
  --source <path>       Path to Videos folder (default: ~/Desktop/Kay/Videos - English)
  --transcripts <path>  Path to Transcriptions folder (default: <source>/Transcriptions)
  --course <name>       Course name to create/update (default: "KCU Masterclass")
  --dry-run             Preview what would be imported without making changes
  --no-skip-existing    Re-upload videos for existing lessons
  --start-module <n>    Start import from module number N
  --concurrent <n>      Number of concurrent uploads (default: 1)
  --help                Show this help message
`);
}

// ============================================
// Directory Scanner
// ============================================

async function scanDirectory(config: ImportConfig): Promise<ScannedModule[]> {
  const modules: ScannedModule[] = [];

  // Read source directory
  const entries = await fs.readdir(config.sourcePath, { withFileTypes: true });

  // Filter to module folders
  const modulePattern = /^Module\s+(\d+(?:\.\d+)?)/i;
  const moduleFolders = entries
    .filter((entry) => entry.isDirectory() && modulePattern.test(entry.name))
    .sort((a, b) => {
      const numA = parseFloat(a.name.match(modulePattern)?.[1] || '0');
      const numB = parseFloat(b.name.match(modulePattern)?.[1] || '0');
      return numA - numB;
    });

  for (const folder of moduleFolders) {
    const moduleMatch = folder.name.match(modulePattern);
    if (!moduleMatch) continue;

    const moduleNumber = moduleMatch[1];
    const moduleSortOrder = Math.round(parseFloat(moduleNumber) * 10);

    // Skip modules before startModule
    if (config.startModule && parseFloat(moduleNumber) < config.startModule) {
      continue;
    }

    const moduleFolder = path.join(config.sourcePath, folder.name);
    const lessons = await scanModuleFolder(moduleFolder, moduleNumber, config);

    modules.push({
      folderName: folder.name,
      folderPath: moduleFolder,
      moduleNumber,
      title: `Module ${moduleNumber}`,
      sortOrder: moduleSortOrder,
      lessons,
    });
  }

  return modules;
}

async function scanModuleFolder(
  moduleFolder: string,
  moduleNumber: string,
  config: ImportConfig
): Promise<ScannedLesson[]> {
  const lessons: ScannedLesson[] = [];

  const files = await fs.readdir(moduleFolder);
  const videoFiles = files.filter((f) => f.toLowerCase().endsWith('.mp4'));

  // Parse video filenames: "1.1 Module Overview.mp4" or "3.1.1 Module Overview.mp4"
  const lessonPattern = /^(\d+(?:\.\d+)+)\s+(.+)\.mp4$/i;

  for (const videoFile of videoFiles) {
    const match = videoFile.match(lessonPattern);
    if (!match) {
      console.warn(`  Skipping non-matching file: ${videoFile}`);
      continue;
    }

    const lessonNumber = match[1];
    const title = match[2].trim();
    const filePath = path.join(moduleFolder, videoFile);

    // Look for matching transcript
    // Transcripts are stored in a Transcriptions subfolder within each module folder
    let transcriptPath: string | undefined;
    const transcriptFileName = `${lessonNumber} ${title}.txt`;

    // First try: Transcriptions subfolder inside the module folder
    const moduleTranscriptFolder = path.join(moduleFolder, 'Transcriptions');

    try {
      const transcriptFullPath = path.join(moduleTranscriptFolder, transcriptFileName);
      await fs.access(transcriptFullPath);
      transcriptPath = transcriptFullPath;
    } catch {
      // Try alternate naming patterns
      try {
        const transcriptFiles = await fs.readdir(moduleTranscriptFolder);
        const matchingTranscript = transcriptFiles.find((f) =>
          f.toLowerCase().startsWith(lessonNumber.toLowerCase()) && f.endsWith('.txt')
        );
        if (matchingTranscript) {
          transcriptPath = path.join(moduleTranscriptFolder, matchingTranscript);
        }
      } catch {
        // No transcript folder exists, try root transcripts folder
        if (config.transcriptsPath) {
          const rootTranscriptFolder = path.join(config.transcriptsPath, `Module ${moduleNumber}`);
          try {
            const transcriptFiles = await fs.readdir(rootTranscriptFolder);
            const matchingTranscript = transcriptFiles.find((f) =>
              f.toLowerCase().startsWith(lessonNumber.toLowerCase()) && f.endsWith('.txt')
            );
            if (matchingTranscript) {
              transcriptPath = path.join(rootTranscriptFolder, matchingTranscript);
            }
          } catch {
            // No transcript found
          }
        }
      }
    }

    // Get file size
    let fileSize = 0;
    try {
      fileSize = await getFileSize(filePath);
    } catch {
      // Ignore
    }

    // Calculate sort order from lesson number (e.g., 1.1 -> 110, 1.2 -> 120, 3.1.1 -> 311)
    const parts = lessonNumber.split('.').map((p) => parseInt(p, 10));
    const lessonSortOrder =
      parts.length === 2
        ? parts[0] * 100 + parts[1] * 10
        : parts[0] * 100 + parts[1] * 10 + parts[2];

    lessons.push({
      filePath,
      fileName: videoFile,
      lessonNumber,
      title,
      transcriptPath,
      sortOrder: lessonSortOrder,
      fileSize,
    });
  }

  // Sort by lesson number
  lessons.sort((a, b) => a.sortOrder - b.sortOrder);

  return lessons;
}

// ============================================
// Import Logic
// ============================================

async function runImport(config: ImportConfig): Promise<void> {
  const stats: ImportStats = {
    modulesProcessed: 0,
    lessonsCreated: 0,
    lessonsSkipped: 0,
    videosUploaded: 0,
    transcriptsImported: 0,
    errors: [],
    startTime: Date.now(),
  };

  // Print header
  console.log('\n' + '═'.repeat(60));
  console.log('           KCU Bulk Content Import');
  console.log('═'.repeat(60));
  console.log(`\nSource: ${config.sourcePath}`);
  console.log(`Course: ${config.courseName}`);
  console.log(`Mode: ${config.dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  console.log('');

  // Scan directories
  console.log('Scanning directories...');
  const modules = await scanDirectory(config);

  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalSize = modules.reduce(
    (sum, m) => sum + m.lessons.reduce((ls, l) => ls + l.fileSize, 0),
    0
  );

  console.log(`  Found ${modules.length} modules, ${totalLessons} lessons total`);
  console.log(`  Total video size: ${formatBytes(totalSize)}`);
  console.log('');

  if (config.dryRun) {
    // Just print what would be imported
    printDryRunSummary(modules);
    return;
  }

  // Create/get course
  console.log(`Creating course: ${config.courseName}...`);
  const course = await getOrCreateCourse(
    config.courseName,
    config.courseSlug,
    'KCU Trading Education Course'
  );
  console.log(`  Course ID: ${course.id}`);
  console.log('');

  // Process each module
  let totalProcessed = 0;

  moduleLoop: for (const scannedModule of modules) {
    console.log(`\n[${scannedModule.folderName}] (${scannedModule.lessons.length} lessons)`);

    // Create/get module
    const moduleSlug = slugify(scannedModule.title);
    const module = await getOrCreateModule(
      course.id,
      scannedModule.title,
      moduleSlug,
      scannedModule.moduleNumber,
      scannedModule.sortOrder
    );

    stats.modulesProcessed++;

    // Process each lesson
    for (const scannedLesson of scannedModule.lessons) {
      // Check limit
      if (config.limitLessons && totalProcessed >= config.limitLessons) {
        console.log(`\n  Reached limit of ${config.limitLessons} lessons, stopping.`);
        break moduleLoop;
      }

      const lessonSlug = slugify(`${scannedLesson.lessonNumber}-${scannedLesson.title}`);

      process.stdout.write(
        `  ${scannedLesson.lessonNumber} ${scannedLesson.title.substring(0, 30).padEnd(30)}`
      );

      try {
        // Create/get lesson
        const { lesson, created } = await getOrCreateLesson(
          module.id,
          scannedLesson.title,
          lessonSlug,
          scannedLesson.lessonNumber,
          scannedLesson.sortOrder
        );

        if (!created && config.skipExisting && lesson.video_uid) {
          stats.lessonsSkipped++;
          console.log(' [skipped - exists]');
          continue;
        }

        if (created) {
          stats.lessonsCreated++;
        }

        // Upload video if needed
        if (!lesson.video_uid || !config.skipExisting) {
          process.stdout.write(' [uploading...');

          const result = await uploadVideo(
            scannedLesson.filePath,
            {
              lessonId: lesson.id,
              lessonTitle: scannedLesson.title,
              moduleNumber: scannedModule.moduleNumber,
            },
            (percent) => {
              process.stdout.write(`\r  ${scannedLesson.lessonNumber} ${scannedLesson.title.substring(0, 30).padEnd(30)} [uploading ${percent}%]`);
            }
          );

          if (result.success && result.uid) {
            await updateLesson(lesson.id, {
              video_uid: result.uid,
              video_status: 'processing',
              video_duration_seconds: result.duration ? Math.round(result.duration) : undefined,
              video_playback_hls: result.playbackUrl,
            });
            stats.videosUploaded++;
            process.stdout.write(`\r  ${scannedLesson.lessonNumber} ${scannedLesson.title.substring(0, 30).padEnd(30)} [uploaded]`);
          } else {
            throw new Error(result.error || 'Upload failed');
          }
        }

        // Import transcript if exists
        if (scannedLesson.transcriptPath) {
          const transcriptText = await fs.readFile(scannedLesson.transcriptPath, 'utf-8');
          await updateLesson(lesson.id, {
            transcript_text: transcriptText,
          });
          stats.transcriptsImported++;
          process.stdout.write(' [transcript]');
        }

        console.log(' ✓');
        totalProcessed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`${scannedLesson.lessonNumber}: ${errorMsg}`);
        console.log(` ✗ Error: ${errorMsg}`);
        totalProcessed++;
      }
    }
  }

  // Print summary
  printImportSummary(stats);
}

function printDryRunSummary(modules: ScannedModule[]): void {
  console.log('─'.repeat(60));
  console.log('DRY RUN - Would import:');
  console.log('─'.repeat(60));

  for (const module of modules) {
    console.log(`\n[${module.folderName}]`);

    for (const lesson of module.lessons) {
      const transcriptStatus = lesson.transcriptPath ? '📄' : '  ';
      const size = formatBytes(lesson.fileSize).padStart(8);
      console.log(
        `  ${transcriptStatus} ${lesson.lessonNumber} ${lesson.title.substring(0, 40).padEnd(40)} ${size}`
      );
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('Legend: 📄 = has transcript file');
  console.log('─'.repeat(60));
}

function printImportSummary(stats: ImportStats): void {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log('\n' + '═'.repeat(60));
  console.log('                    Import Complete');
  console.log('═'.repeat(60));
  console.log(`  Modules processed:    ${stats.modulesProcessed}`);
  console.log(`  Lessons created:      ${stats.lessonsCreated}`);
  console.log(`  Lessons skipped:      ${stats.lessonsSkipped}`);
  console.log(`  Videos uploaded:      ${stats.videosUploaded}`);
  console.log(`  Transcripts imported: ${stats.transcriptsImported}`);
  console.log(`  Errors:               ${stats.errors.length}`);
  console.log(`  Time elapsed:         ${minutes}m ${seconds}s`);

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    for (const error of stats.errors) {
      console.log(`  - ${error}`);
    }
  }

  console.log('═'.repeat(60) + '\n');
}

// ============================================
// Main Entry Point
// ============================================

async function main(): Promise<void> {
  try {
    const config = parseArgs();
    await runImport(config);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
