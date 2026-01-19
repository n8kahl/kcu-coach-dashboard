# KCU Video Learning System - Migration Plan

## Overview

This document outlines the plan to migrate the KCU course videos from Thinkific to a native video learning system integrated with the coach dashboard, using Cloudflare Stream for video hosting and Supabase for data storage.

---

## Current Asset Inventory

| Asset Type | Count | Location |
|------------|-------|----------|
| **Video Files** | 237 | `.mp4` and `.mov` files |
| **Transcripts** | 248 | `.txt` files in `/txt` or `/Transcriptions` folders |
| **Quiz CSVs** | ~15 | `Module_X_Quiz_Questions_Formatted.csv` |
| **Module PDFs** | ~18 | Combined transcript PDFs per module |
| **Audio Files** | ~200+ | `/Audio Only` folders (backup/accessibility) |

### Module Structure

```
/Videos - English/
├── Start Here - Onboarding/     (8 videos)
├── Welcome To the Inside/       (3 videos)
├── Module 1/                    (9 videos - Stock Market Basics)
├── Module 2/                    (14 videos - Options)
├── Module 3/                    (13+ videos - Setup & Tools)
├── Module 3.2/                  (Additional setup content)
├── Module 4/                    (Charting)
├── Module 5/                    (Volume Mastery)
├── Module 6/                    (LTP Framework - Core Strategy)
├── Module 7/                    (Hourly Levels)
├── Module 8/                    (Content TBD)
├── Module 9/                    (Trading Strategies)
├── Module 10/                   (Content TBD)
├── Module 11/                   (Content TBD)
├── Module 12.1/                 (LTP Masterclass)
├── Module 12.2/                 (LTP on Steroids)
├── Module 13/                   (Content TBD)
├── Module 14/                   (Content TBD)
├── Module 15/                   (Content TBD)
└── Module 16/                   (Dashboard Enrollments)
```

### Transcript Format
- Plain text format (no timestamps)
- Paragraph-separated
- Good for full-text search and AI context

### Quiz CSV Format
```csv
QuestionType,QuestionText,Explanation,Choice1,Choice2,Choice3,Choice4,...
SA,Question text here,Explanation text,*Correct answer,Wrong1,Wrong2,Wrong3
```
- `SA` = Single Answer
- Correct answer prefixed with `*`

---

## Architecture

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    KCU Coach Dashboard                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│  │ Course        │  │ Video Player    │  │ Transcript      │   │
│  │ Navigation    │──│ (Video.js)      │──│ Panel + Search  │   │
│  └───────────────┘  └────────┬────────┘  └────────┬────────┘   │
│                              │                     │            │
│  ┌───────────────────────────┴─────────────────────┴──────┐    │
│  │              Progress Tracking & Quiz System            │    │
│  └─────────────────────────────┬──────────────────────────┘    │
│                                │                                │
└────────────────────────────────┼────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Cloudflare     │    │    Supabase     │    │    Supabase     │
│  Stream         │    │    Database     │    │    Storage      │
│                 │    │                 │    │                 │
│  • Video hosting│    │  • Courses      │    │  • Transcripts  │
│  • Adaptive     │    │  • Modules      │    │  • Module PDFs  │
│    bitrate      │    │  • Lessons      │    │  • Thumbnails   │
│  • Global CDN   │    │  • Progress     │    │                 │
│  • Analytics    │    │  • Quizzes      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

## Database Schema

### New Tables (Add to existing schema)

```sql
-- ============================================
-- COURSE LEARNING SYSTEM
-- ============================================

-- Courses (top-level container)
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Modules within courses
CREATE TABLE course_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  module_number TEXT NOT NULL,  -- "1", "3.2", "12.1", etc.
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL,
  is_published BOOLEAN DEFAULT TRUE,
  unlock_after_module_id UUID REFERENCES course_modules(id),  -- For drip content
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(course_id, slug)
);

-- Individual lessons/videos
CREATE TABLE course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  lesson_number TEXT NOT NULL,  -- "5.1", "5.2", etc.

  -- Video info
  video_url TEXT,                      -- Cloudflare Stream URL
  video_uid TEXT,                      -- Cloudflare Stream UID
  video_duration_seconds INTEGER,
  thumbnail_url TEXT,

  -- Transcript info
  transcript_url TEXT,                 -- Supabase storage URL
  transcript_text TEXT,                -- Full text for search/AI

  -- Settings
  sort_order INTEGER NOT NULL,
  is_preview BOOLEAN DEFAULT FALSE,    -- Free preview access?
  is_published BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(module_id, slug)
);

-- User progress tracking
CREATE TABLE user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE,

  progress_seconds INTEGER DEFAULT 0,   -- Playback position
  progress_percent DECIMAL(5,2) DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,

  watch_count INTEGER DEFAULT 0,
  total_watch_seconds INTEGER DEFAULT 0,

  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, lesson_id)
);

-- User course enrollment/access
CREATE TABLE user_course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,

  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES user_profiles(id),
  expires_at TIMESTAMPTZ,              -- NULL = lifetime access
  access_type TEXT DEFAULT 'full',     -- 'full', 'preview', 'trial'

  UNIQUE(user_id, course_id)
);

-- Quiz questions
CREATE TABLE course_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES course_lessons(id),  -- Optional: tie to specific lesson

  question_type TEXT NOT NULL DEFAULT 'single',  -- 'single', 'multiple'
  question_text TEXT NOT NULL,
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quiz answer choices
CREATE TABLE course_quiz_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES course_quiz_questions(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0
);

-- User quiz attempts
CREATE TABLE user_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  module_id UUID REFERENCES course_modules(id) ON DELETE CASCADE,

  score_percent DECIMAL(5,2),
  passed BOOLEAN DEFAULT FALSE,
  answers JSONB,                        -- Store submitted answers

  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_course_modules_course ON course_modules(course_id);
CREATE INDEX idx_course_lessons_module ON course_lessons(module_id);
CREATE INDEX idx_user_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX idx_user_lesson_progress_lesson ON user_lesson_progress(lesson_id);
CREATE INDEX idx_user_course_access_user ON user_course_access(user_id);

-- Full-text search on transcripts
CREATE INDEX idx_lessons_transcript_search
  ON course_lessons USING gin(to_tsvector('english', transcript_text));

-- RLS Policies
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_quiz_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view published content they have access to
CREATE POLICY "Users can view courses they have access to" ON courses
  FOR SELECT USING (
    is_published = TRUE OR
    EXISTS (SELECT 1 FROM user_role_assignments ura
            JOIN user_roles ur ON ura.role_id = ur.id
            WHERE ura.user_id = auth.uid()
            AND ur.name IN ('admin', 'super_admin', 'coach'))
  );

CREATE POLICY "Users can track their own progress" ON user_lesson_progress
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own access" ON user_course_access
  FOR SELECT USING (user_id = auth.uid());
```

---

## Migration Script

### Phase 1: Upload Videos to Cloudflare Stream

```typescript
// scripts/migrate-videos.ts

import Cloudflare from 'cloudflare';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const VIDEO_BASE_PATH = '/path/to/Videos - English';

interface VideoFile {
  moduleName: string;
  moduleNumber: string;
  lessonNumber: string;
  title: string;
  filePath: string;
  transcriptPath?: string;
}

async function discoverVideos(): Promise<VideoFile[]> {
  const videos: VideoFile[] = [];
  const moduleDirs = fs.readdirSync(VIDEO_BASE_PATH);

  for (const moduleDir of moduleDirs) {
    const modulePath = path.join(VIDEO_BASE_PATH, moduleDir);
    if (!fs.statSync(modulePath).isDirectory()) continue;

    // Parse module number (e.g., "Module 5" -> "5", "Module 12.1" -> "12.1")
    const moduleMatch = moduleDir.match(/Module\s+([\d.]+)/i);
    const moduleNumber = moduleMatch ? moduleMatch[1] : moduleDir;

    // Find video files
    const files = fs.readdirSync(modulePath);
    for (const file of files) {
      if (!file.match(/\.(mp4|mov)$/i)) continue;

      // Parse lesson number (e.g., "5.1 Module Overview.mp4" -> "5.1")
      const lessonMatch = file.match(/^([\d.]+)\s+(.+)\.(mp4|mov)$/i);
      if (!lessonMatch) continue;

      const lessonNumber = lessonMatch[1];
      const title = lessonMatch[2];

      // Find matching transcript
      const transcriptDirs = ['txt', 'Transcriptions'];
      let transcriptPath: string | undefined;

      for (const txDir of transcriptDirs) {
        const txPath = path.join(modulePath, txDir, `${lessonNumber} ${title}.txt`);
        if (fs.existsSync(txPath)) {
          transcriptPath = txPath;
          break;
        }
      }

      videos.push({
        moduleName: moduleDir,
        moduleNumber,
        lessonNumber,
        title,
        filePath: path.join(modulePath, file),
        transcriptPath,
      });
    }
  }

  return videos.sort((a, b) => {
    const aNum = parseFloat(a.lessonNumber);
    const bNum = parseFloat(b.lessonNumber);
    return aNum - bNum;
  });
}

async function uploadToCloudflareStream(
  filePath: string,
  metadata: { title: string; module: string }
): Promise<{ uid: string; playbackUrl: string; duration: number }> {
  // Using Cloudflare Stream TUS upload for large files
  const cf = new Cloudflare({ apiToken: CLOUDFLARE_API_TOKEN });

  const fileStream = fs.createReadStream(filePath);
  const fileSize = fs.statSync(filePath).size;

  // Create upload URL
  const uploadResponse = await cf.stream.create({
    account_id: CLOUDFLARE_ACCOUNT_ID,
    body: {},
    'Tus-Resumable': '1.0.0',
    'Upload-Length': fileSize.toString(),
    'Upload-Metadata': Buffer.from(JSON.stringify({
      name: metadata.title,
      meta: { module: metadata.module }
    })).toString('base64'),
  });

  // Upload the file
  // ... TUS upload implementation

  return {
    uid: uploadResponse.uid!,
    playbackUrl: `https://customer-${CLOUDFLARE_ACCOUNT_ID}.cloudflarestream.com/${uploadResponse.uid}/manifest/video.m3u8`,
    duration: uploadResponse.duration || 0,
  };
}

async function migrateVideos() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const videos = await discoverVideos();

  console.log(`Found ${videos.length} videos to migrate`);

  // Create course
  const { data: course } = await supabase
    .from('courses')
    .upsert({
      title: 'KCU Trading Mastery',
      slug: 'kcu-trading-mastery',
      description: 'Complete trading education from basics to advanced LTP strategy',
      is_published: true,
    })
    .select()
    .single();

  // Group videos by module
  const moduleGroups = new Map<string, VideoFile[]>();
  for (const video of videos) {
    const key = video.moduleNumber;
    if (!moduleGroups.has(key)) {
      moduleGroups.set(key, []);
    }
    moduleGroups.get(key)!.push(video);
  }

  // Process each module
  let moduleOrder = 0;
  for (const [moduleNumber, moduleVideos] of moduleGroups) {
    console.log(`\nProcessing Module ${moduleNumber}...`);

    // Create module
    const { data: module } = await supabase
      .from('course_modules')
      .upsert({
        course_id: course.id,
        title: `Module ${moduleNumber}`,
        slug: `module-${moduleNumber.replace('.', '-')}`,
        module_number: moduleNumber,
        sort_order: moduleOrder++,
      })
      .select()
      .single();

    // Process each video in module
    let lessonOrder = 0;
    for (const video of moduleVideos) {
      console.log(`  Uploading: ${video.lessonNumber} ${video.title}`);

      // Upload video to Cloudflare Stream
      const streamResult = await uploadToCloudflareStream(video.filePath, {
        title: `${video.lessonNumber} ${video.title}`,
        module: video.moduleName,
      });

      // Read transcript if available
      let transcriptText = '';
      let transcriptUrl = '';
      if (video.transcriptPath && fs.existsSync(video.transcriptPath)) {
        transcriptText = fs.readFileSync(video.transcriptPath, 'utf-8');

        // Upload transcript to Supabase Storage
        const transcriptBuffer = fs.readFileSync(video.transcriptPath);
        const { data: uploadData } = await supabase.storage
          .from('transcripts')
          .upload(
            `${moduleNumber}/${video.lessonNumber}.txt`,
            transcriptBuffer,
            { contentType: 'text/plain', upsert: true }
          );

        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from('transcripts')
            .getPublicUrl(uploadData.path);
          transcriptUrl = urlData.publicUrl;
        }
      }

      // Create lesson record
      await supabase.from('course_lessons').upsert({
        module_id: module.id,
        title: video.title,
        slug: `${video.lessonNumber.replace('.', '-')}-${video.title.toLowerCase().replace(/\s+/g, '-')}`,
        lesson_number: video.lessonNumber,
        video_url: streamResult.playbackUrl,
        video_uid: streamResult.uid,
        video_duration_seconds: Math.round(streamResult.duration),
        transcript_url: transcriptUrl,
        transcript_text: transcriptText,
        sort_order: lessonOrder++,
      });

      console.log(`    ✓ Uploaded (${Math.round(streamResult.duration / 60)}min)`);
    }
  }

  console.log('\n✅ Migration complete!');
}

migrateVideos().catch(console.error);
```

### Phase 2: Import Quiz Questions

```typescript
// scripts/import-quizzes.ts

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

async function importQuizzes() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Find all quiz CSVs
  const quizFiles = findQuizFiles(VIDEO_BASE_PATH);

  for (const quizFile of quizFiles) {
    const moduleMatch = quizFile.match(/Module[_\s]*([\d.]+)/i);
    if (!moduleMatch) continue;

    const moduleNumber = moduleMatch[1];
    console.log(`Importing quiz for Module ${moduleNumber}`);

    // Get module ID
    const { data: module } = await supabase
      .from('course_modules')
      .select('id')
      .eq('module_number', moduleNumber)
      .single();

    if (!module) {
      console.warn(`  Module ${moduleNumber} not found, skipping`);
      continue;
    }

    // Parse CSV
    const csvContent = fs.readFileSync(quizFile, 'utf-8');
    const records = parse(csvContent, { columns: true });

    let order = 0;
    for (const row of records) {
      // Insert question
      const { data: question } = await supabase
        .from('course_quiz_questions')
        .insert({
          module_id: module.id,
          question_type: row.QuestionType === 'SA' ? 'single' : 'multiple',
          question_text: row.QuestionText,
          explanation: row.Explanation,
          sort_order: order++,
        })
        .select()
        .single();

      // Insert choices
      const choices: { choice_text: string; is_correct: boolean; sort_order: number }[] = [];
      for (let i = 1; i <= 10; i++) {
        const choiceText = row[`Choice${i}`];
        if (!choiceText) continue;

        const isCorrect = choiceText.startsWith('*');
        choices.push({
          choice_text: isCorrect ? choiceText.slice(1) : choiceText,
          is_correct: isCorrect,
          sort_order: i - 1,
        });
      }

      await supabase.from('course_quiz_choices').insert(
        choices.map(c => ({ ...c, question_id: question.id }))
      );
    }

    console.log(`  ✓ Imported ${records.length} questions`);
  }
}
```

---

## Implementation Phases

### Phase 1: Infrastructure Setup (Week 1)
- [ ] Create Cloudflare Stream account
- [ ] Get API credentials (Account ID, API Token)
- [ ] Create Supabase storage bucket for transcripts
- [ ] Run database migration SQL
- [ ] Test video upload with 1-2 sample videos

### Phase 2: Migration Script (Week 1-2)
- [ ] Build and test video discovery script
- [ ] Implement Cloudflare Stream upload (with TUS for large files)
- [ ] Implement transcript upload to Supabase Storage
- [ ] Run full migration (~237 videos)
- [ ] Import quiz questions from CSVs

### Phase 3: UI Components (Week 2-3)
- [ ] Course library page (grid of available courses)
- [ ] Module browser (expandable list with progress)
- [ ] Video player component (Video.js + HLS)
- [ ] Transcript panel with search
- [ ] Progress tracking (auto-save every 10s)
- [ ] "Resume where you left off" feature

### Phase 4: Quiz System (Week 3)
- [ ] Quiz display component
- [ ] Answer submission and scoring
- [ ] Quiz results and explanations
- [ ] Module completion gating (optional)

### Phase 5: Progress Dashboard (Week 3-4)
- [ ] User progress page with visual tracking
- [ ] Module completion indicators
- [ ] Learning streaks and statistics
- [ ] Time-based analytics
- [ ] Achievement/milestone system

### Phase 6: Polish & Integration (Week 4)
- [ ] Mobile responsive design
- [ ] Keyboard shortcuts (space=pause, arrows=seek)
- [ ] Playback speed control
- [ ] Integration with AI coach (query transcripts)
- [ ] Admin: bulk grant course access

---

## Progress Page Design

### Overview

The Progress Page provides users with a comprehensive view of their learning journey, including completion status, time invested, and learning patterns.

### User Progress Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  My Learning Progress                                          [View: Grid] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PROGRESS OVERVIEW                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │     68%      │  │    42hrs     │  │    156/237   │  │  12 day  │ │   │
│  │  │  ██████████░ │  │  Total Time  │  │   Lessons    │  │  Streak  │ │   │
│  │  │  Completed   │  │   Watched    │  │  Completed   │  │   🔥     │ │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WEEKLY ACTIVITY                                                     │   │
│  │                                                                       │   │
│  │  Mon   Tue   Wed   Thu   Fri   Sat   Sun                             │   │
│  │   █     █     █     ░     █     █     ░                              │   │
│  │   █     █     █     ░     █     █     ░                              │   │
│  │   █     ░     █     ░     █     ░     ░                              │   │
│  │                                                                       │   │
│  │  This week: 8.5 hrs  │  Avg: 1.2 hrs/day  │  Best day: Tuesday      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  MODULE PROGRESS                                                     │   │
│  │                                                                       │   │
│  │  Module 1: Stock Market Basics          ████████████████████ 100% ✓ │   │
│  │  Module 2: Options Fundamentals         ████████████████████ 100% ✓ │   │
│  │  Module 3: Setup & Tools                ██████████████████░░  90%   │   │
│  │  Module 4: Charting                     ████████████████░░░░  80%   │   │
│  │  Module 5: Volume Mastery               ██████████░░░░░░░░░░  50%   │   │
│  │  Module 6: LTP Framework         ▶      ████░░░░░░░░░░░░░░░░  20%   │   │
│  │  Module 7: Hourly Levels                ░░░░░░░░░░░░░░░░░░░░   0% 🔒│   │
│  │  ...                                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  CONTINUE LEARNING                                                   │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │  [▶ Thumbnail]  6.3 Mastering Levels                        │    │   │
│  │  │                 Module 6: LTP Framework                     │    │   │
│  │  │                 ████████░░░░░░░░ 12:45 / 28:30              │    │   │
│  │  │                                          [Resume Watching]  │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ACHIEVEMENTS                                                        │   │
│  │                                                                       │   │
│  │  🏆 First Steps      🎯 Module Master    ⚡ Speed Learner            │   │
│  │  Completed 1st       Finished Module 1   Watched 5 lessons           │   │
│  │  lesson              with 100%           in one day                  │   │
│  │                                                                       │   │
│  │  🔥 7-Day Streak     📚 Halfway There    🎓 [Locked]                 │   │
│  │  Learned 7 days      50% course          Complete the                │   │
│  │  in a row            complete            full course                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Detail Progress View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Progress                                                         │
│                                                                             │
│  Module 6: LTP Framework - Core Strategy                                    │
│  ████████░░░░░░░░░░░░ 40% Complete  │  4/10 Lessons  │  Quiz: Not Started  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LESSONS                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ ✅ 6.1  Three Money Making Things You Need to Master    18:30  ✓   │   │
│  │ ✅ 6.2  Levels                                          24:15  ✓   │   │
│  │ ✅ 6.3  Mastering Levels                                28:30  ✓   │   │
│  │ ✅ 6.4  Trends                                          22:00  ✓   │   │
│  │ ▶️ 6.5  Mastering Trends                    ████░░ 45%  19:45      │   │
│  │ ○  6.6  Patience Candles                                31:20      │   │
│  │ ○  6.7  Questions On Patience Candles                   15:45      │   │
│  │ ○  6.8  Patience Candles PHEWWWWWW!                     26:30      │   │
│  │ ○  6.9  How to Properly Position Size                   33:15      │   │
│  │ ○  6.10 Module Recap                                    12:00      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MODULE QUIZ                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  🔒 Complete all lessons to unlock the Module 6 Quiz                │   │
│  │     15 questions  │  Pass: 80%  │  Best Score: --                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  TIME SPENT ON THIS MODULE                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Total: 2h 45m  │  Avg per lesson: 16m  │  Started: Jan 10, 2026    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Extensions for Progress Tracking

```sql
-- Learning streaks tracking
CREATE TABLE user_learning_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,

  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Daily activity log (for activity heatmap)
CREATE TABLE user_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,

  lessons_watched INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  quizzes_taken INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, activity_date)
);

-- Achievements/badges system
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,  -- Emoji or icon name

  -- Unlock criteria (JSON for flexibility)
  criteria JSONB NOT NULL,
  -- e.g., {"type": "lessons_completed", "count": 1}
  -- e.g., {"type": "streak_days", "count": 7}
  -- e.g., {"type": "module_completed", "module_id": "..."}

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User earned achievements
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,

  earned_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, achievement_id)
);

-- Indexes
CREATE INDEX idx_user_daily_activity_user_date ON user_daily_activity(user_id, activity_date);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);

-- RLS
ALTER TABLE user_learning_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view/update their own streaks" ON user_learning_streaks
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view/update their own activity" ON user_daily_activity
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own achievements" ON user_achievements
  FOR SELECT USING (user_id = auth.uid());

-- Insert default achievements
INSERT INTO achievements (slug, title, description, icon, criteria, sort_order) VALUES
('first_lesson', 'First Steps', 'Completed your first lesson', '🏆', '{"type": "lessons_completed", "count": 1}', 1),
('ten_lessons', 'Getting Started', 'Completed 10 lessons', '📚', '{"type": "lessons_completed", "count": 10}', 2),
('fifty_lessons', 'Dedicated Learner', 'Completed 50 lessons', '🎯', '{"type": "lessons_completed", "count": 50}', 3),
('first_module', 'Module Master', 'Completed your first module', '⭐', '{"type": "modules_completed", "count": 1}', 4),
('streak_7', 'Week Warrior', 'Maintained a 7-day learning streak', '🔥', '{"type": "streak_days", "count": 7}', 5),
('streak_30', 'Monthly Master', 'Maintained a 30-day learning streak', '💪', '{"type": "streak_days", "count": 30}', 6),
('speed_learner', 'Speed Learner', 'Watched 5 lessons in one day', '⚡', '{"type": "daily_lessons", "count": 5}', 7),
('quiz_ace', 'Quiz Ace', 'Scored 100% on a module quiz', '🎓', '{"type": "perfect_quiz", "count": 1}', 8),
('halfway', 'Halfway There', 'Completed 50% of the course', '🌟', '{"type": "course_percent", "value": 50}', 9),
('course_complete', 'Graduate', 'Completed the entire course', '🎉', '{"type": "course_percent", "value": 100}', 10);
```

### Progress API Endpoints

```typescript
// app/api/progress/overview/route.ts
// Returns: overall stats, current streak, recent activity

// app/api/progress/modules/route.ts
// Returns: all modules with completion percentage

// app/api/progress/modules/[moduleId]/route.ts
// Returns: specific module with lesson-level progress

// app/api/progress/activity/route.ts
// Returns: daily activity for heatmap (last 90 days)

// app/api/progress/achievements/route.ts
// Returns: all achievements with earned status

// app/api/progress/resume/route.ts
// Returns: last watched lesson with timestamp
```

### React Components

```
src/
├── app/
│   └── (dashboard)/
│       └── learn/
│           ├── page.tsx                    # Course library
│           ├── progress/
│           │   └── page.tsx                # Progress dashboard
│           ├── [courseSlug]/
│           │   ├── page.tsx                # Course overview
│           │   └── [moduleSlug]/
│           │       ├── page.tsx            # Module detail
│           │       └── [lessonSlug]/
│           │           └── page.tsx        # Video player
│           └── quiz/
│               └── [moduleId]/
│                   └── page.tsx            # Quiz page
├── components/
│   └── learn/
│       ├── ProgressOverview.tsx           # Stats cards
│       ├── ActivityHeatmap.tsx            # Weekly activity grid
│       ├── ModuleProgressList.tsx         # Module progress bars
│       ├── ContinueLearning.tsx           # Resume card
│       ├── AchievementGrid.tsx            # Badges display
│       ├── VideoPlayer.tsx                # Video.js wrapper
│       ├── TranscriptPanel.tsx            # Synced transcript
│       └── LessonList.tsx                 # Lesson navigation
└── hooks/
    ├── useProgress.ts                      # Progress data hook
    ├── useVideoProgress.ts                 # Video playback tracking
    └── useAchievements.ts                  # Achievement checking
```

### Progress Tracking Logic

```typescript
// hooks/useVideoProgress.ts

export function useVideoProgress(lessonId: string) {
  const supabase = useSupabase();
  const [progress, setProgress] = useState(0);

  // Save progress every 10 seconds
  const saveProgress = useCallback(
    debounce(async (currentTime: number, duration: number) => {
      const percent = (currentTime / duration) * 100;
      const completed = percent >= 90; // Mark complete at 90%

      await supabase.from('user_lesson_progress').upsert({
        user_id: userId,
        lesson_id: lessonId,
        progress_seconds: Math.floor(currentTime),
        progress_percent: percent,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        watch_count: completed ? sql`watch_count + 1` : sql`watch_count`,
        last_watched_at: new Date().toISOString(),
      });

      // Update daily activity
      await supabase.rpc('update_daily_activity', {
        p_watch_seconds: 10,
        p_lesson_completed: completed,
      });

      // Check for achievements
      if (completed) {
        await checkAchievements(userId);
      }
    }, 10000),
    [lessonId]
  );

  return { progress, saveProgress };
}
```

### Admin Progress View (Coach Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Student Progress Overview                              [Export CSV]        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Search: [________________________]  Filter: [All Modules ▼] [Date Range]  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Student          │ Progress │ Last Active │ Streak │ Quiz Scores   │   │
│  ├──────────────────┼──────────┼─────────────┼────────┼───────────────┤   │
│  │ John Smith       │ ████ 85% │ Today       │ 12 🔥  │ Avg: 92%      │   │
│  │ Jane Doe         │ ███░ 62% │ Yesterday   │ 5      │ Avg: 88%      │   │
│  │ Bob Wilson       │ ██░░ 45% │ 3 days ago  │ 0      │ Avg: 76%      │   │
│  │ Alice Chen       │ █░░░ 23% │ 1 week ago  │ 0      │ Not started   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ENGAGEMENT METRICS                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Active Today │  │ This Week    │  │ Avg Progress │  │ Completion   │   │
│  │     24       │  │     89       │  │     58%      │  │     12%      │   │
│  │   students   │  │   students   │  │   overall    │  │   graduated  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Estimate

### Cloudflare Stream
- **Storage**: ~50GB of video → ~$5/month
- **Streaming**: 1000 minutes watched → $1
- **Estimated monthly** (100 users, 10hrs each): **$15-25/month**

### Supabase
- **Database**: Already included in plan
- **Storage**: <1GB transcripts → included
- **Bandwidth**: Minimal for text files

### Total: ~$20-30/month
(vs Thinkific Pro at $99-399/month)

---

## Environment Variables Needed

```env
# Cloudflare Stream
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token

# Already have these
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Next Steps

1. **Confirm this plan** - Any changes needed?
2. **Set up Cloudflare Stream account** - I can guide you through this
3. **Run database migration** - Apply the new schema
4. **Execute migration script** - Upload all content
5. **Build UI components** - Video player, course browser, etc.

---

## File Locations

| File | Purpose |
|------|---------|
| `docs/VIDEO-LEARNING-SYSTEM-PLAN.md` | This plan document |
| `scripts/migrate-videos.ts` | Video migration script (to be created) |
| `scripts/import-quizzes.ts` | Quiz import script (to be created) |
| `supabase/migrations/XXX_course_learning.sql` | Database schema (to be created) |
| `src/app/(dashboard)/learn/progress/page.tsx` | Progress dashboard page |
| `src/components/learn/ProgressOverview.tsx` | Stats cards component |
| `src/components/learn/ActivityHeatmap.tsx` | Weekly activity visualization |
| `src/components/learn/ModuleProgressList.tsx` | Module progress bars |
| `src/components/learn/AchievementGrid.tsx` | Badges/achievements display |
| `src/hooks/useProgress.ts` | Progress data fetching hook |
| `src/hooks/useVideoProgress.ts` | Video playback progress tracking |
| `src/app/api/progress/overview/route.ts` | Progress overview API |
| `src/app/api/progress/activity/route.ts` | Daily activity API |
| `src/app/api/progress/achievements/route.ts` | Achievements API |
