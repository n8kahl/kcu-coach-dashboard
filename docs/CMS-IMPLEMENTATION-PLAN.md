# Video & Resource CMS Implementation Plan

## Overview

This document outlines the comprehensive implementation plan for adding a full-featured Content Management System (CMS) to the KCU Coach Dashboard. The CMS will allow administrators to manage videos, resources, and curriculum content without code changes.

**Goal**: Enable admins to add/edit/remove videos and resources, manage thumbnails, control visibility, and organize content in the Learning/Resources sections through a user-friendly interface.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Database Schema Changes](#2-database-schema-changes)
3. [API Endpoints](#3-api-endpoints)
4. [Admin UI Components](#4-admin-ui-components)
5. [Video Management Features](#5-video-management-features)
6. [Resource Management Features](#6-resource-management-features)
7. [Curriculum Builder Features](#7-curriculum-builder-features)
8. [Migration Strategy](#8-migration-strategy)
9. [Implementation Phases](#9-implementation-phases)
10. [File Structure](#10-file-structure)
11. [Testing Requirements](#11-testing-requirements)

---

## 1. Current State Analysis

### What Exists Today

| Content Type | Storage | Admin UI | Editable? |
|--------------|---------|----------|-----------|
| Curriculum Videos | Hardcoded in `src/data/curriculum.ts` | None | No - requires code changes |
| YouTube Resources | Supabase `youtube_videos` table | Partial - `/admin/knowledge` | Limited - sync only |
| Quizzes | Hardcoded in `src/data/quizzes.ts` | None | No |
| Thinkific Content | Synced from external LMS | Via Thinkific | Yes (externally) |

### Key Files

```
src/data/curriculum.ts          # 50+ lessons across 9 modules (hardcoded)
src/data/quizzes.ts             # Quiz questions (hardcoded)
src/types/learning.ts           # Type definitions
src/lib/learning-progress.ts    # Progress tracking, Thinkific fallback
src/app/(admin)/admin/knowledge/page.tsx  # Existing partial CMS
```

### Current Database Tables (Relevant)

- `youtube_videos` - YouTube resource library (already exists)
- `knowledge_chunks` - RAG embeddings
- `thinkific_courses/chapters/contents` - Synced from Thinkific
- `course_lessons` / `course_modules` / `courses` - Cloudflare Stream learning system

### Gap Analysis

1. **No database-driven curriculum** - Core learning content is hardcoded TypeScript
2. **No CRUD for videos** - Can't add/edit videos without code deployment
3. **No resource library management** - PDFs, links, supplementary content not manageable
4. **No visibility controls** - Can't draft/hide content
5. **No thumbnail management** - All thumbnails auto-generated
6. **No curriculum reordering** - Module/lesson order is fixed in code

---

## 2. Database Schema Changes

### 2.1 New Tables

#### `cms_videos`
Central video management table replacing hardcoded curriculum lessons.

```sql
CREATE TABLE cms_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Video source
  source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'cloudflare', 'vimeo', 'external')),
  source_id TEXT NOT NULL,                    -- YouTube video ID, Cloudflare stream ID, etc.
  source_url TEXT,                            -- Full URL for external videos

  -- Metadata
  title TEXT NOT NULL,
  description TEXT,
  duration_seconds INTEGER,

  -- Thumbnail
  thumbnail_url TEXT,                         -- Auto-fetched or custom
  thumbnail_source TEXT DEFAULT 'auto' CHECK (thumbnail_source IN ('auto', 'custom')),
  custom_thumbnail_path TEXT,                 -- Path in storage bucket

  -- Content
  transcript TEXT,
  transcript_status TEXT DEFAULT 'pending' CHECK (transcript_status IN ('pending', 'processing', 'complete', 'failed')),
  key_takeaways JSONB DEFAULT '[]'::jsonb,    -- Array of strings

  -- Organization
  category TEXT,                              -- 'LTP Framework', 'Price Action', 'Psychology', etc.
  topics TEXT[] DEFAULT '{}',
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  ltp_relevance INTEGER DEFAULT 0 CHECK (ltp_relevance >= 0 AND ltp_relevance <= 100),

  -- Visibility & Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  show_in_resources BOOLEAN DEFAULT false,    -- Show in Resources library
  show_in_curriculum BOOLEAN DEFAULT true,    -- Available for curriculum assignment

  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),

  -- Unique constraint on source
  UNIQUE(source_type, source_id)
);

-- Indexes
CREATE INDEX idx_cms_videos_status ON cms_videos(status);
CREATE INDEX idx_cms_videos_category ON cms_videos(category);
CREATE INDEX idx_cms_videos_source ON cms_videos(source_type, source_id);
```

#### `cms_modules`
Database-driven curriculum modules.

```sql
CREATE TABLE cms_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  slug TEXT UNIQUE NOT NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',               -- Lucide icon name
  color TEXT DEFAULT '#3B82F6',               -- Hex color

  -- Organization
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Unlock requirements
  unlock_type TEXT DEFAULT 'sequential' CHECK (unlock_type IN ('sequential', 'immediate', 'date', 'quiz_gate')),
  unlock_after_module_id UUID REFERENCES cms_modules(id),
  unlock_date TIMESTAMPTZ,
  required_quiz_score INTEGER,                -- Minimum score to unlock (if quiz_gate)

  -- Visibility
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cms_modules_sort ON cms_modules(sort_order);
CREATE INDEX idx_cms_modules_status ON cms_modules(status);
```

#### `cms_lessons`
Junction table linking videos to modules with ordering.

```sql
CREATE TABLE cms_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  module_id UUID NOT NULL REFERENCES cms_modules(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES cms_videos(id) ON DELETE CASCADE,

  -- Lesson-specific overrides
  title_override TEXT,                        -- Override video title for this lesson
  description_override TEXT,

  -- Organization
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Progress requirements
  require_completion BOOLEAN DEFAULT true,    -- Must complete before next lesson
  min_watch_percentage INTEGER DEFAULT 80,    -- Minimum % watched to mark complete

  -- Visibility
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  is_preview BOOLEAN DEFAULT false,           -- Available without enrollment

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint
  UNIQUE(module_id, video_id)
);

CREATE INDEX idx_cms_lessons_module ON cms_lessons(module_id);
CREATE INDEX idx_cms_lessons_sort ON cms_lessons(module_id, sort_order);
```

#### `cms_resources`
Managed resource library (PDFs, links, supplementary content).

```sql
CREATE TABLE cms_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Type
  resource_type TEXT NOT NULL CHECK (resource_type IN ('pdf', 'document', 'link', 'video', 'spreadsheet', 'image', 'other')),

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Source (depends on type)
  file_path TEXT,                             -- Path in storage bucket (for uploads)
  file_size INTEGER,                          -- File size in bytes
  file_mime_type TEXT,
  external_url TEXT,                          -- For links/external resources
  video_id UUID REFERENCES cms_videos(id),    -- For video type resources

  -- Thumbnail
  thumbnail_url TEXT,
  thumbnail_source TEXT DEFAULT 'auto' CHECK (thumbnail_source IN ('auto', 'custom', 'none')),

  -- Organization
  section TEXT NOT NULL DEFAULT 'general',    -- 'core_materials', 'tools', 'templates', 'supplementary'
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  sort_order INTEGER DEFAULT 0,

  -- Visibility
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Access control
  access_level TEXT DEFAULT 'member' CHECK (access_level IN ('public', 'member', 'premium')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_cms_resources_type ON cms_resources(resource_type);
CREATE INDEX idx_cms_resources_section ON cms_resources(section);
CREATE INDEX idx_cms_resources_status ON cms_resources(status);
```

#### `cms_quizzes`
Database-driven quizzes (replacing hardcoded quizzes.ts).

```sql
CREATE TABLE cms_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  module_id UUID REFERENCES cms_modules(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES cms_lessons(id) ON DELETE SET NULL,

  -- Content
  title TEXT NOT NULL,
  description TEXT,

  -- Settings
  passing_score INTEGER DEFAULT 70,           -- Percentage needed to pass
  time_limit_minutes INTEGER,                 -- NULL = no limit
  max_attempts INTEGER,                       -- NULL = unlimited
  shuffle_questions BOOLEAN DEFAULT false,
  shuffle_choices BOOLEAN DEFAULT true,
  show_correct_answers BOOLEAN DEFAULT true,  -- Show after completion

  -- Visibility
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE TABLE cms_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES cms_quizzes(id) ON DELETE CASCADE,

  -- Content
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'multiple_select')),
  explanation TEXT,                           -- Shown after answering

  -- Remediation
  remediation_video_id UUID REFERENCES cms_videos(id),
  remediation_timestamp INTEGER,              -- Seconds into video

  -- Organization
  sort_order INTEGER DEFAULT 0,
  points INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE cms_quiz_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES cms_quiz_questions(id) ON DELETE CASCADE,

  choice_text TEXT NOT NULL,
  is_correct BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Storage Bucket

Create a Supabase storage bucket for file uploads:

```sql
-- Create bucket for CMS uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('cms-uploads', 'cms-uploads', true);

-- Policies for cms-uploads bucket
CREATE POLICY "Admin users can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cms-uploads' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid()
    AND ur.name IN ('super_admin', 'admin', 'coach')
  )
);

CREATE POLICY "Public read access for cms-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'cms-uploads');

CREATE POLICY "Admin users can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cms-uploads' AND
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid()
    AND ur.name IN ('super_admin', 'admin')
  )
);
```

### 2.3 Row Level Security

```sql
-- Enable RLS
ALTER TABLE cms_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cms_quiz_choices ENABLE ROW LEVEL SECURITY;

-- Public can view published content
CREATE POLICY "Anyone can view published videos"
ON cms_videos FOR SELECT
USING (status = 'published');

CREATE POLICY "Anyone can view published modules"
ON cms_modules FOR SELECT
USING (status = 'published');

CREATE POLICY "Anyone can view published lessons"
ON cms_lessons FOR SELECT
USING (status = 'published');

CREATE POLICY "Anyone can view published resources"
ON cms_resources FOR SELECT
USING (status = 'published');

-- Admins can do everything
CREATE POLICY "Admins have full video access"
ON cms_videos FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_role_assignments ura
    JOIN user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid()
    AND ur.name IN ('super_admin', 'admin', 'coach')
  )
);

-- (Repeat for other tables...)
```

---

## 3. API Endpoints

### 3.1 Video Management APIs

```
/api/admin/cms/videos
├── GET     - List all videos (with filters)
├── POST    - Create new video
└── /[id]
    ├── GET     - Get single video
    ├── PUT     - Update video
    ├── DELETE  - Delete video (soft delete to archived)
    └── /thumbnail
        └── POST  - Upload custom thumbnail

/api/admin/cms/videos/import
├── POST    - Import from YouTube URL
└── /youtube
    └── POST  - Fetch metadata from YouTube

/api/admin/cms/videos/bulk
├── POST    - Bulk update (status, category)
└── DELETE  - Bulk archive
```

#### Video API Specifications

**GET /api/admin/cms/videos**
```typescript
// Query params
interface VideoListParams {
  status?: 'draft' | 'published' | 'archived' | 'all';
  category?: string;
  source_type?: 'youtube' | 'cloudflare' | 'vimeo' | 'external';
  search?: string;
  sort?: 'created_at' | 'updated_at' | 'title' | 'duration';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Response
interface VideoListResponse {
  videos: CMSVideo[];
  total: number;
  page: number;
  totalPages: number;
}
```

**POST /api/admin/cms/videos**
```typescript
interface CreateVideoRequest {
  source_type: 'youtube' | 'cloudflare' | 'vimeo' | 'external';
  source_id?: string;         // For youtube/cloudflare/vimeo
  source_url?: string;        // For external
  title: string;
  description?: string;
  category?: string;
  topics?: string[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  key_takeaways?: string[];
  status?: 'draft' | 'published';
  show_in_resources?: boolean;
}
```

**POST /api/admin/cms/videos/import**
```typescript
interface ImportYouTubeRequest {
  youtube_url: string;        // Full YouTube URL or video ID
  auto_fetch_metadata?: boolean;  // Default true
  auto_fetch_transcript?: boolean;
  category?: string;
}

// Response includes fetched metadata
interface ImportYouTubeResponse {
  video: CMSVideo;
  metadata: {
    title: string;
    description: string;
    duration_seconds: number;
    thumbnail_url: string;
    published_at: string;
  };
}
```

### 3.2 Module Management APIs

```
/api/admin/cms/modules
├── GET     - List all modules
├── POST    - Create new module
├── PUT     - Reorder modules (bulk sort_order update)
└── /[id]
    ├── GET     - Get module with lessons
    ├── PUT     - Update module
    ├── DELETE  - Delete module
    └── /lessons
        ├── GET     - List lessons in module
        ├── POST    - Add lesson to module
        └── PUT     - Reorder lessons
```

### 3.3 Resource Management APIs

```
/api/admin/cms/resources
├── GET     - List all resources
├── POST    - Create resource (with file upload)
└── /[id]
    ├── GET     - Get single resource
    ├── PUT     - Update resource
    ├── DELETE  - Delete resource
    └── /file
        └── POST  - Upload/replace file

/api/admin/cms/resources/upload
└── POST    - Direct file upload (returns file info)
```

### 3.4 Quiz Management APIs

```
/api/admin/cms/quizzes
├── GET     - List all quizzes
├── POST    - Create quiz
└── /[id]
    ├── GET     - Get quiz with questions
    ├── PUT     - Update quiz
    ├── DELETE  - Delete quiz
    └── /questions
        ├── GET     - List questions
        ├── POST    - Add question
        ├── PUT     - Reorder questions
        └── /[questionId]
            ├── PUT     - Update question
            └── DELETE  - Delete question
```

---

## 4. Admin UI Components

### 4.1 Component Structure

```
src/components/admin/cms/
├── videos/
│   ├── video-library.tsx           # Main video list view
│   ├── video-card.tsx              # Video preview card
│   ├── video-editor-modal.tsx      # Add/edit video modal
│   ├── video-import-modal.tsx      # YouTube import flow
│   ├── video-thumbnail-picker.tsx  # Thumbnail selection
│   ├── video-bulk-actions.tsx      # Bulk operations bar
│   └── video-filters.tsx           # Filter/search sidebar
│
├── modules/
│   ├── curriculum-builder.tsx      # Main curriculum view
│   ├── module-card.tsx             # Collapsible module card
│   ├── module-editor-modal.tsx     # Add/edit module
│   ├── lesson-row.tsx              # Draggable lesson row
│   └── lesson-editor-modal.tsx     # Add/edit lesson in module
│
├── resources/
│   ├── resource-library.tsx        # Main resource list
│   ├── resource-card.tsx           # Resource preview card
│   ├── resource-editor-modal.tsx   # Add/edit resource
│   ├── resource-upload.tsx         # File upload component
│   └── resource-sections.tsx       # Section management
│
├── quizzes/
│   ├── quiz-list.tsx               # Quiz list view
│   ├── quiz-editor.tsx             # Quiz builder
│   ├── question-editor.tsx         # Question form
│   └── choice-editor.tsx           # Answer choice form
│
└── shared/
    ├── cms-dashboard.tsx           # Overview dashboard
    ├── status-badge.tsx            # draft/published/archived badge
    ├── sortable-list.tsx           # Drag-and-drop list (dnd-kit)
    ├── category-select.tsx         # Category dropdown
    ├── thumbnail-preview.tsx       # Thumbnail display
    └── confirm-dialog.tsx          # Delete confirmation
```

### 4.2 Admin Pages

```
src/app/(admin)/admin/cms/
├── page.tsx                        # CMS Dashboard
├── videos/
│   └── page.tsx                    # Video Library Manager
├── curriculum/
│   └── page.tsx                    # Curriculum Builder
├── resources/
│   └── page.tsx                    # Resource Library Manager
└── quizzes/
    └── page.tsx                    # Quiz Manager
```

---

## 5. Video Management Features

### 5.1 Video Library Manager UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📹 Video Library                                        [+ Add Video]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Filters    Status: [All ▼]  Category: [All ▼]  Source: [All ▼] │   │
│  │            🔍 Search videos...                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ☑ Select All          [Bulk Actions ▼]          Showing 47 videos     │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ☐ ┌──────────┐ Module 1: Introduction to LTP                    │   │
│  │   │ 🖼️       │ Duration: 12:34  •  YouTube  •  LTP Framework   │   │
│  │   │ thumb    │ 🟢 Published  •  Used in: Module 1 > Lesson 1    │   │
│  │   └──────────┘ Transcript: ✅ Complete                 [Edit ▼] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ☐ ┌──────────┐ Understanding Price Action                       │   │
│  │   │ 🖼️       │ Duration: 8:21  •  YouTube  •  Price Action     │   │
│  │   │ thumb    │ 🟡 Draft  •  Not assigned to curriculum          │   │
│  │   └──────────┘ Transcript: ⏳ Processing               [Edit ▼] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [◀ Prev]  Page 1 of 5  [Next ▶]                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Add/Edit Video Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add New Video                                               [✕ Close] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─── Video Source ─────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  ○ YouTube    ○ Cloudflare Stream    ○ Vimeo    ○ External URL   │  │
│  │                                                                   │  │
│  │  YouTube URL or Video ID                                         │  │
│  │  ┌───────────────────────────────────────────────────────────┐   │  │
│  │  │ https://youtube.com/watch?v=abc123                        │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  │  [🔄 Fetch Metadata]                                             │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                         │
│  Title *                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Introduction to the LTP Framework                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  Description                                                            │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Learn the foundational concepts of the LTP trading              │   │
│  │ methodology in this comprehensive introduction...               │   │
│  │                                                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─── Thumbnail ────────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  ┌────────────┐                                                  │  │
│  │  │            │  ○ Auto-generated (from YouTube)                 │  │
│  │  │   🖼️ img   │  ○ Upload custom thumbnail                       │  │
│  │  │            │    [Choose File...]                              │  │
│  │  └────────────┘                                                  │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── Organization ─────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Category              Difficulty         LTP Relevance          │  │
│  │  [LTP Framework ▼]     [Intermediate ▼]   [====●====] 75%        │  │
│  │                                                                   │  │
│  │  Topics (comma-separated)                                        │  │
│  │  ┌───────────────────────────────────────────────────────────┐   │  │
│  │  │ level, trend, patience, entry                             │   │  │
│  │  └───────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── Key Takeaways ────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  • Understanding market structure                      [✕]       │  │
│  │  • Identifying key price levels                        [✕]       │  │
│  │  • Reading trend with EMAs                             [✕]       │  │
│  │  [+ Add takeaway]                                                │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── Visibility ───────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Status: [🟢 Published ▼]                                        │  │
│  │                                                                   │  │
│  │  ☑ Show in Resources library                                     │  │
│  │  ☑ Available for curriculum assignment                           │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─── Transcript ───────────────────────────────────────────────────┐  │
│  │                                                                   │  │
│  │  Status: ✅ Complete    [👁 View] [✏️ Edit] [🔄 Re-process]       │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│              [Cancel]                          [💾 Save Video]          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Video Features Checklist

- [ ] **Add video via YouTube URL** - Paste URL, auto-fetch metadata
- [ ] **Add video via Cloudflare Stream** - Enter stream ID
- [ ] **Edit video metadata** - Title, description, category, topics
- [ ] **Custom thumbnails** - Upload image or use auto-generated
- [ ] **Key takeaways editor** - Add/remove/reorder bullet points
- [ ] **Transcript management** - View, edit, trigger re-processing
- [ ] **Status management** - Draft, Published, Archived
- [ ] **Visibility toggles** - Show in resources, available for curriculum
- [ ] **Bulk operations** - Select multiple, bulk publish/archive/categorize
- [ ] **Search & filter** - By status, category, source type, text search
- [ ] **Curriculum assignment indicator** - Show where video is used

---

## 6. Resource Management Features

### 6.1 Resource Library Manager UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📚 Resource Library                                  [+ Add Resource]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Type: [All ▼]   Section: [All ▼]   Status: [All ▼]   🔍 Search...     │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  📁 Core Materials                                          [+ Add]    │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ≡ 📕 LTP Trading Playbook v2.1                          [⋮]     │  │
│  │   PDF • 2.4 MB • 🟢 Published • Members only                     │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ≡ 📘 Risk Management Worksheet                          [⋮]     │  │
│  │   Spreadsheet • 156 KB • 🟢 Published • Public                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  🔧 Tools & Templates                                       [+ Add]    │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ≡ 🌐 TradingView - Recommended Charts                   [⋮]     │  │
│  │   Link • 🟢 Published • Public                                   │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ ≡ 📊 Trade Journal Template                             [⋮]     │  │
│  │   Spreadsheet • 89 KB • 🟡 Draft • Members only                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│  📹 Supplementary Videos                                    [+ Add]    │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ≡ ▶️ Weekly Market Analysis - Jan 15                    [⋮]     │  │
│  │   Video • 12:34 • 🔴 Hidden                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Resource Types

| Type | Icon | Upload | External Link |
|------|------|--------|---------------|
| PDF | 📕 | ✅ | ✅ |
| Document | 📄 | ✅ (DOCX, etc.) | ✅ |
| Spreadsheet | 📊 | ✅ (XLSX, CSV) | ✅ |
| Link | 🌐 | ❌ | ✅ |
| Video | ▶️ | ❌ (uses cms_videos) | ✅ |
| Image | 🖼️ | ✅ | ✅ |

### 6.3 Resource Features Checklist

- [ ] **File upload** - Drag & drop or file picker
- [ ] **External links** - Add URLs with auto-fetch title/favicon
- [ ] **Link to CMS video** - Select from video library
- [ ] **Section organization** - Assign to sections (Core, Tools, etc.)
- [ ] **Custom sections** - Create/rename/delete sections
- [ ] **Drag-and-drop reordering** - Within sections
- [ ] **Access levels** - Public, Member, Premium
- [ ] **Status management** - Draft, Published, Archived
- [ ] **Thumbnail auto-generation** - First page of PDF, favicon for links
- [ ] **Custom thumbnails** - Upload override
- [ ] **File replacement** - Upload new version without changing URL

---

## 7. Curriculum Builder Features

### 7.1 Curriculum Builder UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📚 Curriculum Builder                                  [+ Add Module]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [👁 Preview as Student]    [📤 Export Structure]    [⚙️ Settings]      │
│                                                                         │
│  ═══════════════════════════════════════════════════════════════════   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ≡  🔵 Module 1: Trading Fundamentals        🟢 Published  [⚙️]  │   │
│  │     "Account setup, broker configuration, and chart basics"      │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐ │   │
│  │  │ ≡  1.1 Margin vs Cash Account              [12:34]   [⋮]   │ │   │
│  │  │      🟢 Published • Required • 80% watch                    │ │   │
│  │  ├─────────────────────────────────────────────────────────────┤ │   │
│  │  │ ≡  1.2 Interactive Brokers Setup           [10:00]   [⋮]   │ │   │
│  │  │      🟢 Published • Required • 80% watch                    │ │   │
│  │  ├─────────────────────────────────────────────────────────────┤ │   │
│  │  │ ≡  1.3 Chart Setup & Indicators            [9:00]    [⋮]   │ │   │
│  │  │      🟢 Published • Required • 80% watch                    │ │   │
│  │  ├─────────────────────────────────────────────────────────────┤ │   │
│  │  │ ≡  📝 Module 1 Quiz                        [10 Q]    [⋮]   │ │   │
│  │  │      🟢 Published • Pass required to unlock Module 2        │ │   │
│  │  └─────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │  [+ Add Lesson]  [+ Add Quiz]                                    │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ≡  🟣 Module 2: Price Action Mastery        🟢 Published  [⚙️]  │   │
│  │     "Understanding candlesticks and market structure"            │   │
│  │     🔒 Unlocks after Module 1 Quiz (70% pass)                   │   │
│  │                                                                   │   │
│  │  [▼ Expand to show lessons]                                      │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ≡  🟠 Module 3: The LTP Framework           🟡 Draft    [⚙️]    │   │
│  │     "Level, Trend, Patience - the core methodology"              │   │
│  │                                                                   │   │
│  │  [▼ Expand to show lessons]                                      │   │
│  │                                                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  [+ Add Module]                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Add Lesson Modal

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Add Lesson to "Trading Fundamentals"                        [✕ Close] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Select Video                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search videos...                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ○ ┌────┐ Advanced VWAP Strategies            [12:08] Indicators │   │
│  │   │ 🖼️ │ Pro-level VWAP trading strategies                      │   │
│  │   └────┘                                                         │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ ● ┌────┐ What is VWAP?                       [9:00] Indicators  │   │
│  │   │ 🖼️ │ Understanding Volume Weighted Average Price  ✓ Selected│   │
│  │   └────┘                                                         │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ ○ ┌────┐ How to Trade Using EMAs             [11:00] Indicators │   │
│  │   │ 🖼️ │ Using exponential moving averages                      │   │
│  │   └────┘                                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ───────────────────────────────────────────────────────────────────── │
│                                                                         │
│  Lesson Settings                                                        │
│                                                                         │
│  Title Override (optional)                                              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                                          Uses video title if empty│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ☑ Require completion before next lesson                               │
│     Minimum watch percentage: [80%___▼]                                │
│                                                                         │
│  ☐ Mark as preview (available without enrollment)                      │
│                                                                         │
│              [Cancel]                           [➕ Add Lesson]         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Curriculum Features Checklist

- [ ] **Create modules** - Title, description, icon, color
- [ ] **Drag-and-drop module reordering**
- [ ] **Add lessons from video library** - Search and select
- [ ] **Drag-and-drop lesson reordering** - Within modules
- [ ] **Title/description overrides** - Per-lesson customization
- [ ] **Completion requirements** - Watch percentage, required flag
- [ ] **Module unlock conditions** - Sequential, quiz gate, date-based
- [ ] **Quiz integration** - Add quiz as lesson item
- [ ] **Preview lessons** - Mark specific lessons as free preview
- [ ] **Bulk publish/draft** - Per module or entire curriculum
- [ ] **Student preview mode** - See curriculum as student would

---

## 8. Migration Strategy

### 8.1 Phase 1: Data Migration

Migrate existing hardcoded content to database without disrupting current functionality.

```typescript
// scripts/migrate-curriculum-to-db.ts

import { CURRICULUM_MODULES } from '@/data/curriculum';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function migrateCurriculum() {
  for (const module of CURRICULUM_MODULES) {
    // 1. Create module
    const { data: dbModule } = await supabaseAdmin
      .from('cms_modules')
      .insert({
        slug: module.slug,
        title: module.title,
        description: module.description,
        icon: module.icon,
        color: module.color,
        sort_order: module.order,
        status: 'published'
      })
      .select()
      .single();

    // 2. Create videos and lessons
    for (let i = 0; i < module.lessons.length; i++) {
      const lesson = module.lessons[i];

      // Create video
      const { data: video } = await supabaseAdmin
        .from('cms_videos')
        .insert({
          source_type: 'youtube',
          source_id: lesson.video_id,
          title: lesson.title,
          description: lesson.description,
          duration_seconds: lesson.duration,
          transcript: lesson.transcript,
          key_takeaways: lesson.key_takeaways,
          status: 'published',
          show_in_curriculum: true
        })
        .select()
        .single();

      // Create lesson link
      await supabaseAdmin
        .from('cms_lessons')
        .insert({
          module_id: dbModule.id,
          video_id: video.id,
          sort_order: i,
          status: 'published'
        });
    }
  }
}
```

### 8.2 Phase 2: Dual-Read Support

Update learning services to read from database with fallback to hardcoded data.

```typescript
// src/lib/curriculum-service.ts

export async function getModules(): Promise<CurriculumModule[]> {
  // Try database first
  const { data: dbModules } = await supabase
    .from('cms_modules')
    .select(`
      *,
      cms_lessons (
        *,
        cms_videos (*)
      )
    `)
    .eq('status', 'published')
    .order('sort_order');

  if (dbModules && dbModules.length > 0) {
    return transformDbModules(dbModules);
  }

  // Fallback to hardcoded data
  return CURRICULUM_MODULES;
}
```

### 8.3 Phase 3: Full Database Mode

Remove hardcoded fallback once CMS is validated.

```typescript
// After validation, simplify to database-only
export async function getModules(): Promise<CurriculumModule[]> {
  const { data, error } = await supabase
    .from('cms_modules')
    .select(`
      *,
      cms_lessons (
        *,
        cms_videos (*)
      )
    `)
    .eq('status', 'published')
    .order('sort_order');

  if (error) throw error;
  return transformDbModules(data);
}
```

---

## 9. Implementation Phases

### Phase 1: Database Foundation (Week 1)

**Deliverables:**
- [ ] Create Supabase migration for all new tables
- [ ] Set up storage bucket and policies
- [ ] Implement RLS policies
- [ ] Create database indexes
- [ ] Write migration script for existing curriculum data

**Files to Create:**
```
supabase/migrations/XXX_cms_tables.sql
scripts/migrate-curriculum-to-db.ts
```

### Phase 2: Video Management APIs (Week 2)

**Deliverables:**
- [ ] Implement all video CRUD endpoints
- [ ] YouTube metadata fetching service
- [ ] Thumbnail upload handling
- [ ] Transcript processing integration

**Files to Create:**
```
src/app/api/admin/cms/videos/route.ts
src/app/api/admin/cms/videos/[id]/route.ts
src/app/api/admin/cms/videos/import/route.ts
src/app/api/admin/cms/videos/[id]/thumbnail/route.ts
src/lib/services/youtube-metadata.ts
src/lib/services/video-service.ts
```

### Phase 3: Video Management UI (Week 3)

**Deliverables:**
- [ ] Video library page
- [ ] Video editor modal
- [ ] YouTube import flow
- [ ] Thumbnail picker component
- [ ] Bulk actions functionality

**Files to Create:**
```
src/app/(admin)/admin/cms/videos/page.tsx
src/components/admin/cms/videos/*.tsx
```

### Phase 4: Module & Curriculum APIs (Week 4)

**Deliverables:**
- [ ] Module CRUD endpoints
- [ ] Lesson management endpoints
- [ ] Reordering endpoints
- [ ] Curriculum service (dual-read support)

**Files to Create:**
```
src/app/api/admin/cms/modules/route.ts
src/app/api/admin/cms/modules/[id]/route.ts
src/app/api/admin/cms/modules/[id]/lessons/route.ts
src/lib/services/curriculum-service.ts
```

### Phase 5: Curriculum Builder UI (Week 5)

**Deliverables:**
- [ ] Curriculum builder page
- [ ] Module cards with collapse/expand
- [ ] Drag-and-drop for modules and lessons
- [ ] Add lesson modal with video search
- [ ] Module editor modal

**Files to Create:**
```
src/app/(admin)/admin/cms/curriculum/page.tsx
src/components/admin/cms/modules/*.tsx
```

### Phase 6: Resource Management (Week 6)

**Deliverables:**
- [ ] Resource CRUD APIs
- [ ] File upload handling
- [ ] Resource library page
- [ ] Resource editor modal
- [ ] Section management

**Files to Create:**
```
src/app/api/admin/cms/resources/route.ts
src/app/api/admin/cms/resources/[id]/route.ts
src/app/api/admin/cms/resources/upload/route.ts
src/app/(admin)/admin/cms/resources/page.tsx
src/components/admin/cms/resources/*.tsx
```

### Phase 7: Quiz Management (Week 7)

**Deliverables:**
- [ ] Quiz CRUD APIs
- [ ] Question/choice management
- [ ] Quiz builder page
- [ ] Question editor component
- [ ] Integration with curriculum builder

**Files to Create:**
```
src/app/api/admin/cms/quizzes/route.ts
src/app/api/admin/cms/quizzes/[id]/route.ts
src/app/api/admin/cms/quizzes/[id]/questions/route.ts
src/app/(admin)/admin/cms/quizzes/page.tsx
src/components/admin/cms/quizzes/*.tsx
```

### Phase 8: CMS Dashboard & Polish (Week 8)

**Deliverables:**
- [ ] CMS overview dashboard
- [ ] Content statistics
- [ ] Recent activity feed
- [ ] Quick actions
- [ ] Documentation
- [ ] Testing & bug fixes

**Files to Create:**
```
src/app/(admin)/admin/cms/page.tsx
src/components/admin/cms/cms-dashboard.tsx
```

---

## 10. File Structure

### Complete New File Structure

```
src/
├── app/
│   ├── (admin)/
│   │   └── admin/
│   │       └── cms/
│   │           ├── page.tsx                    # CMS Dashboard
│   │           ├── videos/
│   │           │   └── page.tsx                # Video Library
│   │           ├── curriculum/
│   │           │   └── page.tsx                # Curriculum Builder
│   │           ├── resources/
│   │           │   └── page.tsx                # Resource Library
│   │           └── quizzes/
│   │               └── page.tsx                # Quiz Manager
│   │
│   └── api/
│       └── admin/
│           └── cms/
│               ├── videos/
│               │   ├── route.ts                # GET list, POST create
│               │   ├── [id]/
│               │   │   ├── route.ts            # GET, PUT, DELETE
│               │   │   └── thumbnail/
│               │   │       └── route.ts        # POST upload
│               │   ├── import/
│               │   │   └── route.ts            # POST import from URL
│               │   └── bulk/
│               │       └── route.ts            # POST bulk operations
│               │
│               ├── modules/
│               │   ├── route.ts                # GET list, POST create, PUT reorder
│               │   └── [id]/
│               │       ├── route.ts            # GET, PUT, DELETE
│               │       └── lessons/
│               │           └── route.ts        # GET, POST, PUT reorder
│               │
│               ├── resources/
│               │   ├── route.ts                # GET list, POST create
│               │   ├── [id]/
│               │   │   ├── route.ts            # GET, PUT, DELETE
│               │   │   └── file/
│               │   │       └── route.ts        # POST upload
│               │   └── upload/
│               │       └── route.ts            # POST direct upload
│               │
│               └── quizzes/
│                   ├── route.ts                # GET list, POST create
│                   └── [id]/
│                       ├── route.ts            # GET, PUT, DELETE
│                       └── questions/
│                           ├── route.ts        # GET, POST, PUT reorder
│                           └── [questionId]/
│                               └── route.ts    # PUT, DELETE
│
├── components/
│   └── admin/
│       └── cms/
│           ├── videos/
│           │   ├── video-library.tsx
│           │   ├── video-card.tsx
│           │   ├── video-editor-modal.tsx
│           │   ├── video-import-modal.tsx
│           │   ├── video-thumbnail-picker.tsx
│           │   ├── video-bulk-actions.tsx
│           │   └── video-filters.tsx
│           │
│           ├── modules/
│           │   ├── curriculum-builder.tsx
│           │   ├── module-card.tsx
│           │   ├── module-editor-modal.tsx
│           │   ├── lesson-row.tsx
│           │   └── lesson-editor-modal.tsx
│           │
│           ├── resources/
│           │   ├── resource-library.tsx
│           │   ├── resource-card.tsx
│           │   ├── resource-editor-modal.tsx
│           │   ├── resource-upload.tsx
│           │   └── resource-sections.tsx
│           │
│           ├── quizzes/
│           │   ├── quiz-list.tsx
│           │   ├── quiz-editor.tsx
│           │   ├── question-editor.tsx
│           │   └── choice-editor.tsx
│           │
│           └── shared/
│               ├── cms-dashboard.tsx
│               ├── status-badge.tsx
│               ├── sortable-list.tsx
│               ├── category-select.tsx
│               ├── thumbnail-preview.tsx
│               └── confirm-dialog.tsx
│
├── lib/
│   └── services/
│       ├── cms-video-service.ts
│       ├── cms-module-service.ts
│       ├── cms-resource-service.ts
│       ├── cms-quiz-service.ts
│       ├── youtube-metadata-service.ts
│       └── curriculum-service.ts           # Updated for dual-read
│
├── types/
│   └── cms.ts                              # CMS type definitions
│
scripts/
└── migrate-curriculum-to-db.ts

supabase/
└── migrations/
    └── XXX_cms_tables.sql
```

---

## 11. Testing Requirements

### 11.1 Unit Tests

```typescript
// __tests__/services/cms-video-service.test.ts
describe('CMSVideoService', () => {
  describe('createVideo', () => {
    it('creates a video with YouTube source');
    it('auto-fetches YouTube metadata');
    it('validates required fields');
    it('handles duplicate source_id');
  });

  describe('updateVideo', () => {
    it('updates video metadata');
    it('handles status transitions');
  });

  describe('importFromYouTube', () => {
    it('extracts video ID from various URL formats');
    it('fetches and stores metadata');
    it('triggers transcript processing');
  });
});
```

### 11.2 Integration Tests

```typescript
// __tests__/api/cms/videos.test.ts
describe('Videos API', () => {
  it('GET /api/admin/cms/videos returns paginated list');
  it('POST /api/admin/cms/videos creates new video');
  it('PUT /api/admin/cms/videos/[id] updates video');
  it('DELETE /api/admin/cms/videos/[id] archives video');
  it('POST /api/admin/cms/videos/import imports from YouTube');
  it('requires admin role for all operations');
});
```

### 11.3 E2E Tests

```typescript
// e2e/cms/video-management.spec.ts
describe('Video Management', () => {
  it('admin can add video via YouTube URL');
  it('admin can edit video metadata');
  it('admin can upload custom thumbnail');
  it('admin can bulk publish videos');
  it('admin can search and filter videos');
});

// e2e/cms/curriculum-builder.spec.ts
describe('Curriculum Builder', () => {
  it('admin can create new module');
  it('admin can drag-and-drop reorder modules');
  it('admin can add lesson from video library');
  it('admin can reorder lessons within module');
  it('changes reflect in student learning view');
});
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.0.0",
    "@dnd-kit/sortable": "^7.0.0",
    "@dnd-kit/utilities": "^3.0.0"
  }
}
```

---

## Success Criteria

1. **Video Management**: Admins can add/edit/remove videos without code changes
2. **Auto Thumbnails**: YouTube thumbnails auto-fetched, custom upload supported
3. **Curriculum Builder**: Drag-and-drop module/lesson reordering
4. **Resource Library**: Full CRUD for PDFs, links, and other resources
5. **Visibility Control**: Draft/published/archived states work correctly
6. **No Regression**: Existing learning functionality unaffected during migration
7. **Performance**: CMS pages load in < 2 seconds with 100+ items
8. **Mobile Friendly**: Admin UI works on tablet screens

---

## Open Questions for Product Decision

1. **Quiz Builder Scope**: Full quiz editing or just linking existing quizzes?
2. **Version History**: Should we track edit history for videos/modules?
3. **Scheduling**: Add ability to schedule publish dates?
4. **Multi-language**: Any need for localized content in future?
5. **Content Locking**: Should published content require extra confirmation to edit?

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Author: Claude (Implementation Planning)*
