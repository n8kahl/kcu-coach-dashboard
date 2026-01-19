/**
 * Bulk Content Processor
 *
 * Client-side service for uploading entire course structures from ZIP files.
 * Handles the "5GB ZIP problem" by processing in the browser and uploading
 * assets directly to Cloudflare Stream (bypassing the server).
 *
 * ZIP Structure Expected:
 * course.zip/
 * ├── 01_Module-Name/
 * │   ├── 01_Lesson-Name.mp4          (Video)
 * │   ├── 01_Lesson-Name.txt          (Transcript - same name as video)
 * │   ├── 01_Lesson-Name.pdf          (Resource - attached to lesson)
 * │   ├── 02_Another-Lesson.mp4
 * │   ├── 02_Another-Lesson.txt
 * │   ├── resources/                  (Optional folder for module resources)
 * │   │   └── cheatsheet.pdf
 * │   └── quiz.csv                    (Quiz questions for this module)
 * ├── 02_Second-Module/
 * │   └── ...
 * └── course.json                     (Optional: course metadata)
 */

import JSZip from 'jszip';
import * as tus from 'tus-js-client';
import type { Resource, VideoStatus } from '@/types/learning';

// ============================================
// TYPES
// ============================================

export type ImportPhase =
  | 'idle'
  | 'parsing'
  | 'validating'
  | 'creating_modules'
  | 'uploading_videos'
  | 'creating_lessons'
  | 'importing_quizzes'
  | 'finalizing'
  | 'complete'
  | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  phaseProgress: number; // 0-100
  overallProgress: number; // 0-100
  currentItem: string;
  itemsProcessed: number;
  itemsTotal: number;
  errors: ImportError[];
  warnings: string[];
}

export interface ImportError {
  type: 'module' | 'video' | 'lesson' | 'quiz' | 'resource' | 'parse';
  item: string;
  message: string;
  recoverable: boolean;
}

export interface ParsedModule {
  folderName: string;
  order: number;
  title: string;
  slug: string;
  lessons: ParsedLesson[];
  resources: ParsedResource[];
  quizFile?: JSZip.JSZipObject;
  dbId?: string; // Populated after creation
}

export interface ParsedLesson {
  fileName: string;
  order: number;
  title: string;
  slug: string;
  videoFile: JSZip.JSZipObject;
  transcriptFile?: JSZip.JSZipObject;
  resources: ParsedResource[];
  videoUid?: string; // Populated after upload
  transcriptText?: string;
  videoDuration?: number;
  dbId?: string;
}

export interface ParsedResource {
  fileName: string;
  title: string;
  type: Resource['type'];
  file: JSZip.JSZipObject;
  url?: string; // Populated after upload
}

export interface ParsedQuizQuestion {
  questionText: string;
  questionType: 'single' | 'multiple' | 'true_false';
  choices: { text: string; isCorrect: boolean }[];
  explanation?: string;
  order: number;
}

export interface CourseMetadata {
  title: string;
  slug: string;
  description?: string;
}

export interface ImportResult {
  success: boolean;
  courseId?: string;
  modulesCreated: number;
  lessonsCreated: number;
  videosUploaded: number;
  quizQuestionsCreated: number;
  errors: ImportError[];
  warnings: string[];
  duration: number;
}

export interface BulkImportConfig {
  courseId?: string; // If importing into existing course
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  onProgress?: (progress: ImportProgress) => void;
  onPhaseChange?: (phase: ImportPhase, message: string) => void;
  onError?: (error: ImportError) => void;
  parallelUploads?: number; // Max concurrent video uploads
  skipExistingModules?: boolean;
  dryRun?: boolean; // Validate without creating anything
}

// ============================================
// BULK CONTENT PROCESSOR
// ============================================

export class BulkContentProcessor {
  private config: Required<BulkImportConfig>;
  private progress: ImportProgress;
  private abortController: AbortController | null = null;
  private startTime: number = 0;

  constructor(config: BulkImportConfig) {
    this.config = {
      courseId: config.courseId || '',
      cloudflareAccountId: config.cloudflareAccountId,
      cloudflareApiToken: config.cloudflareApiToken,
      onProgress: config.onProgress || (() => {}),
      onPhaseChange: config.onPhaseChange || (() => {}),
      onError: config.onError || (() => {}),
      parallelUploads: config.parallelUploads || 3,
      skipExistingModules: config.skipExistingModules ?? false,
      dryRun: config.dryRun ?? false,
    };

    this.progress = {
      phase: 'idle',
      phaseProgress: 0,
      overallProgress: 0,
      currentItem: '',
      itemsProcessed: 0,
      itemsTotal: 0,
      errors: [],
      warnings: [],
    };
  }

  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  async processZipFile(zipFile: File): Promise<ImportResult> {
    this.startTime = Date.now();
    this.abortController = new AbortController();

    try {
      // Phase 1: Parse ZIP structure
      this.setPhase('parsing', 'Reading ZIP file...');
      const zip = await this.loadZip(zipFile);
      const { modules, metadata } = await this.parseStructure(zip);

      if (modules.length === 0) {
        throw new Error('No valid modules found in ZIP file');
      }

      // Phase 2: Validate structure
      this.setPhase('validating', 'Validating content structure...');
      await this.validateStructure(modules);

      if (this.config.dryRun) {
        return this.createResult(true, modules);
      }

      // Phase 3: Create/get course
      let courseId = this.config.courseId;
      if (!courseId && metadata) {
        courseId = await this.createCourse(metadata);
      }

      if (!courseId) {
        throw new Error('No course ID provided and no course.json found');
      }

      // Phase 4: Create modules
      this.setPhase('creating_modules', 'Creating modules...');
      await this.createModules(courseId, modules);

      // Phase 5: Upload videos
      this.setPhase('uploading_videos', 'Uploading videos to Cloudflare...');
      await this.uploadVideos(modules);

      // Phase 6: Create lessons
      this.setPhase('creating_lessons', 'Creating lesson entries...');
      await this.createLessons(modules);

      // Phase 7: Import quizzes
      this.setPhase('importing_quizzes', 'Importing quiz questions...');
      await this.importQuizzes(modules);

      // Phase 8: Finalize
      this.setPhase('finalizing', 'Finalizing import...');
      await this.uploadResources(modules);

      this.setPhase('complete', 'Import complete!');
      return this.createResult(true, modules, courseId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.addError('parse', 'Import', message, false);
      this.setPhase('error', message);
      return this.createResult(false, []);
    }
  }

  abort(): void {
    this.abortController?.abort();
  }

  // ============================================
  // ZIP PARSING
  // ============================================

  private async loadZip(file: File): Promise<JSZip> {
    const arrayBuffer = await file.arrayBuffer();
    return JSZip.loadAsync(arrayBuffer);
  }

  private async parseStructure(
    zip: JSZip
  ): Promise<{ modules: ParsedModule[]; metadata?: CourseMetadata }> {
    const modules: ParsedModule[] = [];
    let metadata: CourseMetadata | undefined;

    // Check for course.json metadata
    const metadataFile = zip.file('course.json');
    if (metadataFile) {
      try {
        const content = await metadataFile.async('string');
        metadata = JSON.parse(content);
      } catch {
        this.addWarning('Could not parse course.json, skipping metadata');
      }
    }

    // Get all top-level folders (modules)
    const folders = new Set<string>();
    zip.forEach((relativePath) => {
      const parts = relativePath.split('/');
      if (parts.length > 1 && parts[0] && !parts[0].startsWith('.')) {
        folders.add(parts[0]);
      }
    });

    // Parse each folder as a module
    const sortedFolders = Array.from(folders).sort();
    for (let i = 0; i < sortedFolders.length; i++) {
      const folderName = sortedFolders[i];
      this.updateProgress(((i + 1) / sortedFolders.length) * 100, `Parsing ${folderName}...`);

      const module = await this.parseModule(zip, folderName, i + 1);
      if (module.lessons.length > 0) {
        modules.push(module);
      } else {
        this.addWarning(`Module "${folderName}" has no video files, skipping`);
      }
    }

    return { modules, metadata };
  }

  private async parseModule(zip: JSZip, folderName: string, order: number): Promise<ParsedModule> {
    const { title, slug } = this.parseNameFromFolder(folderName);

    const module: ParsedModule = {
      folderName,
      order,
      title,
      slug,
      lessons: [],
      resources: [],
    };

    // Find all files in this folder
    const folderPrefix = `${folderName}/`;
    const files: Map<string, JSZip.JSZipObject> = new Map();

    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith(folderPrefix) && !file.dir) {
        const fileName = relativePath.slice(folderPrefix.length);
        // Skip nested folders for now (handle resources/ separately)
        if (!fileName.includes('/') || fileName.startsWith('resources/')) {
          files.set(fileName, file);
        }
      }
    });

    // Group files by base name to match videos with transcripts
    const videoFiles = new Map<string, JSZip.JSZipObject>();
    const transcriptFiles = new Map<string, JSZip.JSZipObject>();
    const resourceFiles: ParsedResource[] = [];

    files.forEach((file, fileName) => {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const baseName = fileName.replace(/\.[^.]+$/, '');

      if (ext === 'mp4' || ext === 'mov' || ext === 'webm') {
        videoFiles.set(baseName, file);
      } else if (ext === 'txt' || ext === 'srt' || ext === 'vtt') {
        transcriptFiles.set(baseName, file);
      } else if (ext === 'csv' && fileName.toLowerCase().includes('quiz')) {
        module.quizFile = file;
      } else if (ext === 'pdf') {
        resourceFiles.push({
          fileName,
          title: this.prettifyFileName(baseName),
          type: 'pdf',
          file,
        });
      } else if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif') {
        resourceFiles.push({
          fileName,
          title: this.prettifyFileName(baseName),
          type: 'image',
          file,
        });
      }
    });

    // Create lesson entries from video files
    const sortedVideos = Array.from(videoFiles.entries()).sort(([a], [b]) => a.localeCompare(b));

    for (let i = 0; i < sortedVideos.length; i++) {
      const [baseName, videoFile] = sortedVideos[i];
      const { title: lessonTitle, slug: lessonSlug } = this.parseNameFromFile(baseName);

      const lesson: ParsedLesson = {
        fileName: baseName,
        order: i + 1,
        title: lessonTitle,
        slug: lessonSlug,
        videoFile,
        transcriptFile: transcriptFiles.get(baseName),
        resources: [],
      };

      // Check for lesson-specific resources (same base name)
      resourceFiles.forEach((resource) => {
        const resourceBase = resource.fileName.replace(/\.[^.]+$/, '');
        if (resourceBase === baseName || resourceBase.startsWith(`${baseName}_`)) {
          lesson.resources.push(resource);
        }
      });

      module.lessons.push(lesson);
    }

    // Module-level resources (resources/ folder or unmatched PDFs)
    resourceFiles.forEach((resource) => {
      const resourceBase = resource.fileName.replace(/\.[^.]+$/, '');
      const isLessonResource = sortedVideos.some(
        ([baseName]) => resourceBase === baseName || resourceBase.startsWith(`${baseName}_`)
      );
      if (!isLessonResource) {
        module.resources.push(resource);
      }
    });

    return module;
  }

  // ============================================
  // VALIDATION
  // ============================================

  private async validateStructure(modules: ParsedModule[]): Promise<void> {
    let totalLessons = 0;
    let totalVideos = 0;

    for (const module of modules) {
      // Check for duplicate slugs
      const slugs = new Set<string>();
      for (const lesson of module.lessons) {
        if (slugs.has(lesson.slug)) {
          this.addWarning(
            `Duplicate lesson slug "${lesson.slug}" in module "${module.title}", will auto-rename`
          );
          lesson.slug = `${lesson.slug}-${lesson.order}`;
        }
        slugs.add(lesson.slug);
        totalLessons++;

        // Validate video file size
        const videoSize = await this.getFileSize(lesson.videoFile);
        if (videoSize > 4 * 1024 * 1024 * 1024) {
          // 4GB limit for Cloudflare
          this.addError(
            'video',
            lesson.title,
            'Video file exceeds 4GB Cloudflare limit',
            false
          );
        }
        totalVideos++;
      }
    }

    this.progress.itemsTotal = totalLessons;
    this.updateProgress(100, `Found ${modules.length} modules, ${totalLessons} lessons`);
  }

  // ============================================
  // API OPERATIONS
  // ============================================

  private async createCourse(metadata: CourseMetadata): Promise<string> {
    const response = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: metadata.title,
        slug: metadata.slug,
        description: metadata.description,
        isPublished: false,
        isGated: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create course: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  private async createModules(courseId: string, modules: ParsedModule[]): Promise<void> {
    for (let i = 0; i < modules.length; i++) {
      const module = modules[i];
      this.updateProgress(
        ((i + 1) / modules.length) * 100,
        `Creating module: ${module.title}`
      );

      try {
        const response = await fetch('/api/admin/modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            title: module.title,
            slug: module.slug,
            moduleNumber: String(module.order),
            sortOrder: module.order,
            isPublished: false,
            isRequired: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        module.dbId = data.id;
      } catch (error) {
        this.addError(
          'module',
          module.title,
          `Failed to create: ${error instanceof Error ? error.message : 'Unknown'}`,
          true
        );
      }
    }
  }

  // ============================================
  // VIDEO UPLOAD (TUS to Cloudflare)
  // ============================================

  private async uploadVideos(modules: ParsedModule[]): Promise<void> {
    const allLessons: { module: ParsedModule; lesson: ParsedLesson }[] = [];

    for (const module of modules) {
      if (!module.dbId) continue;
      for (const lesson of module.lessons) {
        allLessons.push({ module, lesson });
      }
    }

    // Upload in batches for parallel processing
    const batchSize = this.config.parallelUploads;
    let uploaded = 0;

    for (let i = 0; i < allLessons.length; i += batchSize) {
      const batch = allLessons.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async ({ module, lesson }) => {
          try {
            await this.uploadVideoToCloudflare(lesson);
            uploaded++;
            this.progress.itemsProcessed = uploaded;
            this.updateProgress(
              (uploaded / allLessons.length) * 100,
              `Uploading: ${lesson.title}`
            );
          } catch (error) {
            this.addError(
              'video',
              `${module.title}/${lesson.title}`,
              error instanceof Error ? error.message : 'Upload failed',
              true
            );
          }
        })
      );

      // Check for abort
      if (this.abortController?.signal.aborted) {
        throw new Error('Import aborted by user');
      }
    }
  }

  private async uploadVideoToCloudflare(lesson: ParsedLesson): Promise<void> {
    const videoBlob = await lesson.videoFile.async('blob');
    const videoFile = new File([videoBlob], lesson.fileName + '.mp4', {
      type: 'video/mp4',
    });

    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(videoFile, {
        endpoint: `https://api.cloudflare.com/client/v4/accounts/${this.config.cloudflareAccountId}/stream`,
        headers: {
          Authorization: `Bearer ${this.config.cloudflareApiToken}`,
        },
        chunkSize: 50 * 1024 * 1024, // 50MB chunks
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          name: lesson.title,
          filename: lesson.fileName,
        },
        onError: (error) => {
          reject(new Error(`TUS upload failed: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = ((bytesUploaded / bytesTotal) * 100).toFixed(1);
          this.config.onProgress?.({
            ...this.progress,
            currentItem: `${lesson.title} (${pct}%)`,
          });
        },
        onSuccess: () => {
          // Extract video UID from upload URL
          const uploadUrl = upload.url;
          if (uploadUrl) {
            // URL format: https://api.cloudflare.com/client/v4/accounts/{account}/stream/{video_uid}
            const match = uploadUrl.match(/\/stream\/([a-f0-9]+)/);
            if (match) {
              lesson.videoUid = match[1];
            }
          }
          resolve();
        },
      });

      // Check abort
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          upload.abort();
          reject(new Error('Upload aborted'));
        });
      }

      upload.start();
    });
  }

  // ============================================
  // LESSON CREATION
  // ============================================

  private async createLessons(modules: ParsedModule[]): Promise<void> {
    let created = 0;
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

    for (const module of modules) {
      if (!module.dbId) continue;

      for (const lesson of module.lessons) {
        this.updateProgress(
          ((created + 1) / totalLessons) * 100,
          `Creating lesson: ${lesson.title}`
        );

        try {
          // Read transcript if available
          if (lesson.transcriptFile) {
            lesson.transcriptText = await lesson.transcriptFile.async('string');
          }

          // Get video info from Cloudflare if we have the UID
          let videoInfo: { duration?: number; hls?: string; dash?: string } = {};
          if (lesson.videoUid) {
            videoInfo = await this.getVideoInfo(lesson.videoUid);
          }

          const response = await fetch('/api/admin/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              moduleId: module.dbId,
              title: lesson.title,
              slug: lesson.slug,
              lessonNumber: `${module.order}.${lesson.order}`,
              videoUid: lesson.videoUid,
              videoUrl: videoInfo.hls,
              videoPlaybackHls: videoInfo.hls,
              videoPlaybackDash: videoInfo.dash,
              videoDurationSeconds: videoInfo.duration,
              videoStatus: lesson.videoUid ? 'processing' : 'pending',
              transcriptText: lesson.transcriptText,
              resources: lesson.resources.map((r) => ({
                type: r.type,
                title: r.title,
                url: r.url || '',
              })),
              sortOrder: lesson.order,
              isPublished: false,
              isRequired: true,
              minWatchPercent: 90,
              allowSkip: false,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          lesson.dbId = data.id;
          created++;
        } catch (error) {
          this.addError(
            'lesson',
            `${module.title}/${lesson.title}`,
            error instanceof Error ? error.message : 'Creation failed',
            true
          );
        }
      }
    }
  }

  private async getVideoInfo(
    videoUid: string
  ): Promise<{ duration?: number; hls?: string; dash?: string }> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.config.cloudflareAccountId}/stream/${videoUid}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.cloudflareApiToken}`,
          },
        }
      );

      if (!response.ok) return {};

      const data = await response.json();
      return {
        duration: data.result?.duration,
        hls: data.result?.playback?.hls,
        dash: data.result?.playback?.dash,
      };
    } catch {
      return {};
    }
  }

  // ============================================
  // QUIZ IMPORT
  // ============================================

  private async importQuizzes(modules: ParsedModule[]): Promise<void> {
    let totalQuestions = 0;

    for (const module of modules) {
      if (!module.dbId || !module.quizFile) continue;

      this.updateProgress(0, `Importing quiz for: ${module.title}`);

      try {
        const csvContent = await module.quizFile.async('string');
        const questions = this.parseQuizCsv(csvContent);

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];

          await fetch('/api/admin/quiz-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              moduleId: module.dbId,
              questionType: q.questionType,
              questionText: q.questionText,
              explanation: q.explanation,
              sortOrder: q.order,
              choices: q.choices.map((c, idx) => ({
                choiceText: c.text,
                isCorrect: c.isCorrect,
                sortOrder: idx,
              })),
            }),
          });

          totalQuestions++;
          this.updateProgress(
            ((i + 1) / questions.length) * 100,
            `Question ${i + 1}/${questions.length}`
          );
        }
      } catch (error) {
        this.addError(
          'quiz',
          module.title,
          error instanceof Error ? error.message : 'Quiz import failed',
          true
        );
      }
    }
  }

  private parseQuizCsv(csvContent: string): ParsedQuizQuestion[] {
    const questions: ParsedQuizQuestion[] = [];
    const lines = csvContent.split('\n').filter((line) => line.trim());

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCsvRow(lines[i]);
      if (row.length < 6) continue;

      // Expected format: question,type,choice1,choice2,choice3,choice4,correct,explanation
      const [questionText, type, c1, c2, c3, c4, correct, explanation] = row;

      const correctIndices = correct
        .split(',')
        .map((s) => parseInt(s.trim()) - 1)
        .filter((n) => !isNaN(n));

      const choices = [c1, c2, c3, c4]
        .filter((c) => c && c.trim())
        .map((text, idx) => ({
          text: text.trim(),
          isCorrect: correctIndices.includes(idx),
        }));

      questions.push({
        questionText: questionText.trim(),
        questionType:
          type?.toLowerCase() === 'multiple'
            ? 'multiple'
            : type?.toLowerCase() === 'true_false'
            ? 'true_false'
            : 'single',
        choices,
        explanation: explanation?.trim(),
        order: i,
      });
    }

    return questions;
  }

  private parseCsvRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  // ============================================
  // RESOURCE UPLOAD
  // ============================================

  private async uploadResources(modules: ParsedModule[]): Promise<void> {
    // Resources are uploaded to Supabase Storage
    // For now, we'll skip this and let admin upload manually
    // TODO: Implement Supabase Storage upload for PDFs/images

    for (const module of modules) {
      // Count resources that need upload
      const resourceCount =
        module.resources.length +
        module.lessons.reduce((sum, l) => sum + l.resources.length, 0);

      if (resourceCount > 0) {
        this.addWarning(
          `Module "${module.title}" has ${resourceCount} resources that need manual upload`
        );
      }
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private parseNameFromFolder(folderName: string): { title: string; slug: string } {
    // Handle formats like "01_Module-Name" or "1. Module Name"
    const cleaned = folderName.replace(/^[\d._-]+/, '').trim();
    const title = cleaned.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() || folderName;
    const slug = this.slugify(title);
    return { title, slug };
  }

  private parseNameFromFile(fileName: string): { title: string; slug: string } {
    // Handle formats like "01_Lesson-Name" or "1. Lesson Name"
    const baseName = fileName.replace(/\.[^.]+$/, '');
    const cleaned = baseName.replace(/^[\d._-]+/, '').trim();
    const title = cleaned.replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim() || baseName;
    const slug = this.slugify(title);
    return { title, slug };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100);
  }

  private prettifyFileName(name: string): string {
    return name
      .replace(/^[\d._-]+/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getFileSize(file: JSZip.JSZipObject): Promise<number> {
    const data = await file.async('uint8array');
    return data.length;
  }

  private setPhase(phase: ImportPhase, message: string): void {
    this.progress.phase = phase;
    this.progress.phaseProgress = 0;
    this.config.onPhaseChange?.(phase, message);
    this.emitProgress();
  }

  private updateProgress(phaseProgress: number, currentItem: string): void {
    this.progress.phaseProgress = phaseProgress;
    this.progress.currentItem = currentItem;

    // Calculate overall progress based on phase weights
    const phaseWeights: Record<ImportPhase, { start: number; weight: number }> = {
      idle: { start: 0, weight: 0 },
      parsing: { start: 0, weight: 5 },
      validating: { start: 5, weight: 5 },
      creating_modules: { start: 10, weight: 5 },
      uploading_videos: { start: 15, weight: 50 },
      creating_lessons: { start: 65, weight: 15 },
      importing_quizzes: { start: 80, weight: 10 },
      finalizing: { start: 90, weight: 5 },
      complete: { start: 100, weight: 0 },
      error: { start: 0, weight: 0 },
    };

    const { start, weight } = phaseWeights[this.progress.phase];
    this.progress.overallProgress = start + (phaseProgress / 100) * weight;

    this.emitProgress();
  }

  private emitProgress(): void {
    this.config.onProgress?.(this.progress);
  }

  private addError(
    type: ImportError['type'],
    item: string,
    message: string,
    recoverable: boolean
  ): void {
    const error: ImportError = { type, item, message, recoverable };
    this.progress.errors.push(error);
    this.config.onError?.(error);
  }

  private addWarning(message: string): void {
    this.progress.warnings.push(message);
  }

  private createResult(
    success: boolean,
    modules: ParsedModule[],
    courseId?: string
  ): ImportResult {
    return {
      success,
      courseId,
      modulesCreated: modules.filter((m) => m.dbId).length,
      lessonsCreated: modules.reduce(
        (sum, m) => sum + m.lessons.filter((l) => l.dbId).length,
        0
      ),
      videosUploaded: modules.reduce(
        (sum, m) => sum + m.lessons.filter((l) => l.videoUid).length,
        0
      ),
      quizQuestionsCreated: modules.filter((m) => m.quizFile && m.dbId).length * 10, // Estimate
      errors: this.progress.errors,
      warnings: this.progress.warnings,
      duration: Date.now() - this.startTime,
    };
  }
}

// ============================================
// USAGE EXAMPLE
// ============================================

/**
 * Example usage in a React component:
 *
 * ```tsx
 * const [progress, setProgress] = useState<ImportProgress | null>(null);
 *
 * const handleImport = async (file: File) => {
 *   const processor = new BulkContentProcessor({
 *     courseId: 'existing-course-id', // or undefined to create new
 *     cloudflareAccountId: process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID!,
 *     cloudflareApiToken: 'your-token', // Get from secure endpoint
 *     onProgress: setProgress,
 *     onPhaseChange: (phase, msg) => console.log(`[${phase}] ${msg}`),
 *     onError: (err) => toast.error(err.message),
 *     parallelUploads: 3,
 *   });
 *
 *   const result = await processor.processZipFile(file);
 *
 *   if (result.success) {
 *     toast.success(`Imported ${result.lessonsCreated} lessons!`);
 *   }
 * };
 * ```
 */

export default BulkContentProcessor;
