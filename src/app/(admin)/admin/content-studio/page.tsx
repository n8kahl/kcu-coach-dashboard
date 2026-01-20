'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import type {
  Course,
  CourseModule,
  CourseLesson,
  Resource,
} from '@/types/learning';
import {
  Upload,
  FolderOpen,
  FileVideo,
  FileText,
  FilePlus,
  GripVertical,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  X,
  Edit3,
  Download,
  Link,
  Image,
  Settings,
  Video,
  BookOpen,
  Layers,
  LayoutGrid,
  Library,
  Youtube,
  Scissors,
} from 'lucide-react';
import { LibraryManager, VideoPickerModal, type LibraryVideo } from '@/components/admin/content/library-manager';
import { VideoContentStudio } from '@/components/social';

// ============================================
// Types
// ============================================

interface ModuleWithLessons extends CourseModule {
  lessons: CourseLesson[];
  isExpanded: boolean;
}

interface TreeItem {
  id: string;
  type: 'module' | 'lesson';
  data: ModuleWithLessons | CourseLesson;
  parentId?: string;
}

// ============================================
// Sortable Tree Item Component
// ============================================

function SortableTreeItem({
  item,
  isSelected,
  onSelect,
  onToggleExpand,
  depth = 0,
}: {
  item: TreeItem;
  isSelected: boolean;
  onSelect: () => void;
  onToggleExpand?: () => void;
  depth?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isModule = item.type === 'module';
  const moduleData = isModule ? (item.data as ModuleWithLessons) : null;
  const lessonData = !isModule ? (item.data as CourseLesson) : null;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/50'
            : 'hover:bg-[var(--bg-tertiary)] border border-transparent',
          isDragging && 'ring-2 ring-[var(--accent-primary)]'
        )}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={onSelect}
      >
        <button
          className="p-0.5 cursor-grab active:cursor-grabbing text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {isModule && onToggleExpand && (
          <button
            className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {moduleData?.isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}

        <div
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center flex-shrink-0',
            isModule ? 'bg-indigo-500/20 text-indigo-400' : 'bg-cyan-500/20 text-cyan-400'
          )}
        >
          {isModule ? (
            <FolderOpen className="w-3.5 h-3.5" />
          ) : (
            <FileVideo className="w-3.5 h-3.5" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {isModule ? moduleData?.title : lessonData?.title}
          </p>
          <p className="text-xs text-[var(--text-tertiary)] truncate">
            {isModule
              ? `${moduleData?.lessons?.length || 0} lessons`
              : lessonData?.lessonNumber}
          </p>
        </div>

        {!isModule && lessonData && (
          <Badge
            variant={lessonData.isPublished ? 'success' : 'default'}
            size="sm"
            className="flex-shrink-0"
          >
            {lessonData.isPublished ? 'Live' : 'Draft'}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================
// Video Upload Component with TUS
// ============================================

function VideoUploader({
  lesson,
  onUploadComplete,
  onTranscriptGenerated,
}: {
  lesson: CourseLesson | null;
  onUploadComplete: (videoUid: string, duration: number) => void;
  onTranscriptGenerated?: (transcript: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatingTranscript, setGeneratingTranscript] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    // Validate file size (4GB max)
    if (file.size > 4 * 1024 * 1024 * 1024) {
      setError('File size must be under 4GB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get upload URL from our API (centralized content endpoint)
      const tokenRes = await fetch('/api/admin/content/video/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { name: file.name, lessonId: lesson?.id },
          maxDurationSeconds: 7200, // 2 hours
        }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'Failed to get upload URL');
      }

      const { uploadURL, uid } = await tokenRes.json();

      // Step 2: Upload directly to Cloudflare using TUS protocol
      // CRITICAL: Use uploadUrl (not endpoint) for Direct Creator Upload flow
      const { Upload } = await import('tus-js-client');

      const upload = new Upload(file, {
        uploadUrl: uploadURL, // Direct Creator Upload uses uploadUrl, not endpoint
        chunkSize: 50 * 1024 * 1024, // 50MB chunks
        retryDelays: [0, 1000, 3000, 5000],
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percent = Math.round((bytesUploaded / bytesTotal) * 100);
          setUploadProgress(percent);
        },
        onSuccess: () => {
          // Get video duration from file
          const videoEl = document.createElement('video');
          videoEl.preload = 'metadata';
          videoEl.onloadedmetadata = () => {
            const duration = Math.round(videoEl.duration);
            onUploadComplete(uid, duration);
            setUploading(false);
            URL.revokeObjectURL(videoEl.src);
          };
          videoEl.src = URL.createObjectURL(file);
        },
        onError: (err) => {
          console.error('TUS upload error:', err);
          // Try to extract more details from the error
          let errorMessage = 'Upload failed. Please try again.';
          if (err instanceof Error && err.message) {
            errorMessage = err.message;
          }
          // Check for response body if available (DetailedError type from tus-js-client)
          const detailedErr = err as { originalResponse?: { getBody?: () => string } };
          if (detailedErr.originalResponse?.getBody) {
            try {
              const body = detailedErr.originalResponse.getBody();
              if (body) {
                errorMessage += ` - ${body}`;
              }
            } catch {
              // Ignore
            }
          }
          setError(errorMessage);
          setUploading(false);
        },
      });

      upload.start();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploading(false);
    }
  };

  const handleGenerateTranscript = async () => {
    if (!lesson?.videoUid) return;

    setGeneratingTranscript(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/content/video/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          videoUid: lesson.videoUid,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate transcript');
      }

      const data = await res.json();
      if (data.transcript && onTranscriptGenerated) {
        onTranscriptGenerated(data.transcript);
      }
    } catch (err) {
      console.error('Transcript error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate transcript');
    } finally {
      setGeneratingTranscript(false);
    }
  };

  if (lesson?.videoUid) {
    // Show Cloudflare Stream player
    const streamDomain =
      process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN || 'customer-f33zs165nr7gyfy4.cloudflarestream.com';

    return (
      <div className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://${streamDomain}/${lesson.videoUid}/iframe`}
            className="w-full h-full"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--text-tertiary)]">
            Duration: {lesson.videoDurationSeconds ? `${Math.floor(lesson.videoDurationSeconds / 60)}:${String(lesson.videoDurationSeconds % 60).padStart(2, '0')}` : 'Unknown'}
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="success" size="sm">
              <CheckCircle className="w-3 h-3 mr-1" />
              Video Ready
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
          </div>
        </div>

        {/* Generate Transcript Button */}
        <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {lesson.transcriptText ? 'Transcript Available' : 'No Transcript'}
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                {lesson.transcriptText
                  ? `${lesson.transcriptText.split(' ').length} words`
                  : 'Generate using AI transcription'}
              </p>
            </div>
            <Button
              variant={lesson.transcriptText ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleGenerateTranscript}
              disabled={generatingTranscript}
            >
              {generatingTranscript ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  {lesson.transcriptText ? 'Regenerate' : 'Generate'} Transcript
                </>
              )}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {error}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Show upload dropzone
  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={cn(
          'aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors',
          uploading
            ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
            : 'border-[var(--border-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]'
        )}
      >
        {uploading ? (
          <div className="text-center space-y-3 px-8">
            <Loader2 className="w-10 h-10 animate-spin text-[var(--accent-primary)] mx-auto" />
            <div className="w-48">
              <ProgressBar value={uploadProgress} size="sm" />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Uploading to Cloudflare Stream... {uploadProgress}%
            </p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <Upload className="w-10 h-10 text-[var(--text-tertiary)] mx-auto" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Drop video here or click to upload
            </p>
            <p className="text-xs text-[var(--text-tertiary)]">
              MP4, MOV, WebM up to 4GB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

// ============================================
// Resource Editor Component
// ============================================

function ResourceEditor({
  resources,
  onChange,
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    type: 'link',
    title: '',
    url: '',
  });

  const addResource = () => {
    if (!newResource.title || !newResource.url) return;

    onChange([
      ...resources,
      {
        type: newResource.type || 'link',
        title: newResource.title,
        url: newResource.url,
        description: newResource.description,
      },
    ]);

    setNewResource({ type: 'link', title: '', url: '' });
  };

  const removeResource = (index: number) => {
    onChange(resources.filter((_, i) => i !== index));
  };

  const getTypeIcon = (type: Resource['type']) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'download':
        return <Download className="w-4 h-4" />;
      default:
        return <Link className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
            >
              <div className="w-8 h-8 rounded bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-tertiary)]">
                {getTypeIcon(resource.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {resource.title}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {resource.url}
                </p>
              </div>
              <Badge variant="default" size="sm">
                {resource.type}
              </Badge>
              <button
                onClick={() => removeResource(index)}
                className="p-1 text-[var(--text-tertiary)] hover:text-[var(--error)]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Resource Form */}
      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Add Resource</p>
        <div className="grid grid-cols-4 gap-2">
          <select
            value={newResource.type}
            onChange={(e) =>
              setNewResource({ ...newResource, type: e.target.value as Resource['type'] })
            }
            className="px-3 py-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)]"
          >
            <option value="link">Link</option>
            <option value="pdf">PDF</option>
            <option value="image">Image</option>
            <option value="download">Download</option>
          </select>
          <Input
            placeholder="Title"
            value={newResource.title || ''}
            onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
            className="col-span-2"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={addResource}
            disabled={!newResource.title || !newResource.url}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <Input
          placeholder="URL"
          value={newResource.url || ''}
          onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
          leftIcon={<Link className="w-4 h-4" />}
        />
      </div>
    </div>
  );
}

// ============================================
// Course Editor Modal
// ============================================

function CourseEditorModal({
  course,
  isOpen,
  onClose,
  onSave,
}: {
  course: Course | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (course: Partial<Course>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<Course>>({
    title: '',
    slug: '',
    description: '',
    isPublished: false,
    isGated: false,
    complianceRequired: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (course) {
      setFormData(course);
    } else {
      setFormData({
        title: '',
        slug: '',
        description: '',
        isPublished: false,
        isGated: false,
        complianceRequired: false,
      });
    }
  }, [course, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">
                {course ? 'Edit Course' : 'New Course'}
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {course ? 'Update course details' : 'Create a new course'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
              Course Title
            </label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., KCU Masterclass"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
              URL Slug
            </label>
            <Input
              value={formData.slug || ''}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., kcu-masterclass"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
              Description
            </label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Course description..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isGated}
                onChange={(e) => setFormData({ ...formData, isGated: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Gated</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.complianceRequired}
                onChange={(e) => setFormData({ ...formData, complianceRequired: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Compliance</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !formData.title}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {course ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Module Editor Modal
// ============================================

function ModuleEditorModal({
  module,
  courseId,
  isOpen,
  onClose,
  onSave,
}: {
  module: CourseModule | null;
  courseId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (module: Partial<CourseModule>) => Promise<void>;
}) {
  const [formData, setFormData] = useState<Partial<CourseModule>>({
    title: '',
    slug: '',
    description: '',
    moduleNumber: '',
    isPublished: true,
    isRequired: true,
    requiresQuizPass: false,
    minQuizScore: 70,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (module) {
      setFormData(module);
    } else {
      setFormData({
        title: '',
        slug: '',
        description: '',
        moduleNumber: '',
        courseId,
        isPublished: true,
        isRequired: true,
        requiresQuizPass: false,
        minQuizScore: 70,
      });
    }
  }, [module, courseId, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...formData, courseId });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">
                {module ? 'Edit Module' : 'New Module'}
              </h2>
              <p className="text-xs text-[var(--text-tertiary)]">
                {module ? 'Update module details' : 'Create a new module'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                Module Number
              </label>
              <Input
                value={formData.moduleNumber || ''}
                onChange={(e) => setFormData({ ...formData, moduleNumber: e.target.value })}
                placeholder="e.g., 1.0"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                URL Slug
              </label>
              <Input
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="e.g., fundamentals"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
              Module Title
            </label>
            <Input
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Trading Fundamentals"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
              Description
            </label>
            <Textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Module description..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPublished}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Published</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRequired}
                onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Required</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresQuizPass}
                onChange={(e) => setFormData({ ...formData, requiresQuizPass: e.target.checked })}
                className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Quiz Required</span>
            </label>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving || !formData.title}
            className="flex-1"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {module ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Content Studio Component
// ============================================

export default function ContentStudioPage() {
  const { showToast } = useToast();

  // Page Mode: 'courses', 'library', or 'repurpose'
  const [pageMode, setPageMode] = useState<'courses' | 'library' | 'repurpose'>('courses');

  // Data State
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<ModuleWithLessons[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedItem, setSelectedItem] = useState<TreeItem | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Editor State
  const [editorTab, setEditorTab] = useState('video');
  const [editedLesson, setEditedLesson] = useState<CourseLesson | null>(null);
  const [saving, setSaving] = useState(false);

  // Modal State
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);

  // Video Library Picker Modal
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ============================================
  // Data Fetching
  // ============================================

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
        if (data.courses?.length > 0 && !selectedCourse) {
          setSelectedCourse(data.courses[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  }, [selectedCourse]);

  const fetchModules = useCallback(async () => {
    if (!selectedCourse) return;

    try {
      const res = await fetch(`/api/admin/content/courses/${selectedCourse.id}/modules`);
      if (res.ok) {
        const data = await res.json();
        const modulesWithExpanded = (data.modules || []).map((m: CourseModule & { lessons?: CourseLesson[] }) => ({
          ...m,
          lessons: m.lessons || [],
          isExpanded: true,
        }));
        setModules(modulesWithExpanded);
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (selectedCourse) {
      setLoading(true);
      fetchModules();
    }
  }, [selectedCourse, fetchModules]);

  // ============================================
  // Tree Items
  // ============================================

  const treeItems = useMemo((): TreeItem[] => {
    const items: TreeItem[] = [];

    modules.forEach((module) => {
      items.push({
        id: `module-${module.id}`,
        type: 'module',
        data: module,
      });

      if (module.isExpanded) {
        module.lessons?.forEach((lesson) => {
          items.push({
            id: `lesson-${lesson.id}`,
            type: 'lesson',
            data: lesson,
            parentId: `module-${module.id}`,
          });
        });
      }
    });

    return items;
  }, [modules]);

  // ============================================
  // Selection Handling
  // ============================================

  const handleSelectItem = (item: TreeItem) => {
    setSelectedItem(item);

    if (item.type === 'lesson') {
      setEditedLesson(item.data as CourseLesson);
      setEditorTab('video');
    } else {
      setEditedLesson(null);
    }
  };

  const toggleModuleExpand = (moduleId: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.id === moduleId ? { ...m, isExpanded: !m.isExpanded } : m
      )
    );
  };

  // ============================================
  // Drag & Drop
  // ============================================

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = treeItems.find((i) => i.id === active.id);
    const overItem = treeItems.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Handle module reordering
    if (activeItem.type === 'module' && overItem.type === 'module') {
      const oldIndex = modules.findIndex((m) => `module-${m.id}` === active.id);
      const newIndex = modules.findIndex((m) => `module-${m.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newModules = arrayMove(modules, oldIndex, newIndex);
        setModules(newModules);

        // Save new order to backend
        try {
          await fetch('/api/admin/content/modules/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId: selectedCourse?.id,
              moduleIds: newModules.map((m) => m.id),
            }),
          });
        } catch (err) {
          console.error('Error saving module order:', err);
        }
      }
    }

    // Handle lesson reordering within same module
    if (activeItem.type === 'lesson' && overItem.type === 'lesson' && activeItem.parentId === overItem.parentId) {
      const moduleId = (activeItem.data as CourseLesson).moduleId;
      setModules((prev) =>
        prev.map((m) => {
          if (m.id === moduleId) {
            const oldIndex = m.lessons.findIndex((l) => `lesson-${l.id}` === active.id);
            const newIndex = m.lessons.findIndex((l) => `lesson-${l.id}` === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
              const newLessons = arrayMove(m.lessons, oldIndex, newIndex);

              // Save new order to backend
              fetch('/api/admin/content/lessons/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  moduleId: m.id,
                  lessonIds: newLessons.map((l) => l.id),
                }),
              }).catch(console.error);

              return { ...m, lessons: newLessons };
            }
          }
          return m;
        })
      );
    }
  };

  // ============================================
  // Save Handlers
  // ============================================

  const handleSaveCourse = async (courseData: Partial<Course>) => {
    try {
      const url = editingCourse
        ? `/api/admin/content/courses/${editingCourse.id}`
        : '/api/admin/content/courses';
      const method = editingCourse ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData),
      });

      if (res.ok) {
        showToast({
          type: 'success',
          title: editingCourse ? 'Course Updated' : 'Course Created',
          message: 'Changes saved successfully',
        });
        fetchCourses();
      } else {
        throw new Error('Failed to save course');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to save course',
      });
      throw err;
    }
  };

  const handleSaveModule = async (moduleData: Partial<CourseModule>) => {
    try {
      const url = editingModule
        ? `/api/admin/content/modules/${editingModule.id}`
        : '/api/admin/content/modules';
      const method = editingModule ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(moduleData),
      });

      if (res.ok) {
        showToast({
          type: 'success',
          title: editingModule ? 'Module Updated' : 'Module Created',
          message: 'Changes saved successfully',
        });
        fetchModules();
      } else {
        throw new Error('Failed to save module');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to save module',
      });
      throw err;
    }
  };

  const handleSaveLesson = async () => {
    if (!editedLesson) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/content/lessons/${editedLesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedLesson),
      });

      if (res.ok) {
        showToast({
          type: 'success',
          title: 'Saved',
          message: 'Lesson updated successfully',
        });
        fetchModules();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to save lesson',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUploadComplete = (videoUid: string, duration: number) => {
    if (editedLesson) {
      setEditedLesson({
        ...editedLesson,
        videoUid,
        videoDurationSeconds: duration,
        videoStatus: 'ready',
      });
    }
  };

  const handleAddLesson = async (moduleId: string) => {
    try {
      const res = await fetch('/api/admin/content/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId,
          title: 'New Lesson',
          slug: `lesson-${Date.now()}`,
          lessonNumber: '0',
          isPublished: false,
        }),
      });

      if (res.ok) {
        showToast({
          type: 'success',
          title: 'Lesson Created',
          message: 'New lesson added',
        });
        fetchModules();
      }
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to create lesson',
      });
    }
  };

  // Handle selecting a video from the library
  const handleSelectLibraryVideo = (video: LibraryVideo) => {
    if (!editedLesson) return;

    if (video.type === 'youtube') {
      // YouTube video - set videoUrl
      setEditedLesson({
        ...editedLesson,
        videoUrl: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
        videoUid: null, // Clear Cloudflare UID if switching to YouTube
        videoDurationSeconds: video.duration ?? null,
        videoStatus: video.status === 'ready' ? 'ready' : 'pending',
      });
    } else {
      // Cloudflare video - set videoUid
      setEditedLesson({
        ...editedLesson,
        videoUid: video.videoId,
        videoUrl: null, // Clear YouTube URL if switching to Cloudflare
        videoDurationSeconds: video.duration ?? null,
        videoStatus: video.status === 'ready' ? 'ready' : 'pending',
      });
    }

    setVideoPickerOpen(false);
    showToast({
      type: 'success',
      title: 'Video Selected',
      message: `Using "${video.title}"`,
    });
  };

  // ============================================
  // Render
  // ============================================

  return (
    <>
      <Header
        title="Content Studio"
        subtitle="Create and manage course content"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Content Studio' }]}
        actions={
          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center bg-[var(--bg-secondary)] rounded-lg p-1">
              <button
                onClick={() => setPageMode('courses')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  pageMode === 'courses'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Layers className="w-4 h-4 inline mr-1.5" />
                Courses
              </button>
              <button
                onClick={() => setPageMode('library')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  pageMode === 'library'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Library className="w-4 h-4 inline mr-1.5" />
                Library
              </button>
              <button
                onClick={() => setPageMode('repurpose')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  pageMode === 'repurpose'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Scissors className="w-4 h-4 inline mr-1.5" />
                Repurpose
              </button>
            </div>

            {pageMode === 'courses' && (
              <Button
                variant="secondary"
                icon={<Layers className="w-4 h-4" />}
                onClick={() => {
                  setEditingCourse(null);
                  setCourseModalOpen(true);
                }}
              >
                New Course
              </Button>
            )}
          </div>
        }
      />

      <PageShell>
        {/* Library Mode */}
        {pageMode === 'library' && (
          <PageSection>
            <LibraryManager />
          </PageSection>
        )}

        {/* Repurpose Mode */}
        {pageMode === 'repurpose' && (
          <PageSection>
            <VideoContentStudio showToast={showToast} />
          </PageSection>
        )}

        {/* Courses Mode */}
        {pageMode === 'courses' && (
          <>
            {/* Course Selector */}
            <PageSection>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Course:</label>
                <select
                  value={selectedCourse?.id || ''}
                  onChange={(e) => {
                    const course = courses.find((c) => c.id === e.target.value);
                    setSelectedCourse(course || null);
                    setSelectedItem(null);
                    setEditedLesson(null);
                  }}
                  className="flex-1 max-w-xs px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)]"
                >
                  <option value="">Select a course...</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
                {selectedCourse && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit3 className="w-4 h-4" />}
                    onClick={() => {
                      setEditingCourse(selectedCourse);
                      setCourseModalOpen(true);
                    }}
                  >
                    Edit Course
                  </Button>
                )}
              </div>
            </PageSection>

        {/* Two-Pane Layout */}
        {selectedCourse ? (
          <PageSection>
            <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-280px)]">
              {/* Left Pane - Tree View */}
              <div className="col-span-4">
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Content Structure</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => {
                          setEditingModule(null);
                          setModuleModalOpen(true);
                        }}
                      >
                        Add Module
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-2">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                      </div>
                    ) : modules.length === 0 ? (
                      <div className="text-center py-12 text-[var(--text-tertiary)]">
                        <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No modules yet</p>
                        <p className="text-xs mt-1">Add your first module to get started</p>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={treeItems.map((i) => i.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-0.5">
                            {treeItems.map((item) => (
                              <SortableTreeItem
                                key={item.id}
                                item={item}
                                isSelected={selectedItem?.id === item.id}
                                onSelect={() => handleSelectItem(item)}
                                onToggleExpand={
                                  item.type === 'module'
                                    ? () => toggleModuleExpand((item.data as ModuleWithLessons).id)
                                    : undefined
                                }
                                depth={item.parentId ? 1 : 0}
                              />
                            ))}
                          </div>
                        </SortableContext>

                        <DragOverlay>
                          {activeId && (
                            <div className="bg-[var(--bg-card)] border border-[var(--accent-primary)] rounded-md px-3 py-2 shadow-lg">
                              {treeItems.find((i) => i.id === activeId)?.type === 'module'
                                ? (treeItems.find((i) => i.id === activeId)?.data as ModuleWithLessons)?.title
                                : (treeItems.find((i) => i.id === activeId)?.data as CourseLesson)?.title}
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Pane - Editor */}
              <div className="col-span-8">
                <Card className="h-full">
                  {!selectedItem ? (
                    <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
                      <div className="text-center">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>Select a module or lesson to edit</p>
                      </div>
                    </div>
                  ) : selectedItem.type === 'module' ? (
                    // Module selected - show module info and add lesson button
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                            <FolderOpen className="w-6 h-6 text-indigo-400" />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                              {(selectedItem.data as ModuleWithLessons).title}
                            </h2>
                            <p className="text-sm text-[var(--text-tertiary)]">
                              Module {(selectedItem.data as ModuleWithLessons).moduleNumber} • {(selectedItem.data as ModuleWithLessons).lessons?.length || 0} lessons
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit3 className="w-4 h-4" />}
                          onClick={() => {
                            setEditingModule(selectedItem.data as CourseModule);
                            setModuleModalOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </div>

                      <p className="text-[var(--text-secondary)] mb-6">
                        {(selectedItem.data as ModuleWithLessons).description || 'No description'}
                      </p>

                      <Button
                        variant="primary"
                        icon={<Plus className="w-4 h-4" />}
                        onClick={() => handleAddLesson((selectedItem.data as ModuleWithLessons).id)}
                      >
                        Add Lesson
                      </Button>
                    </CardContent>
                  ) : editedLesson ? (
                    // Lesson editor
                    <>
                      <CardHeader className="border-b border-[var(--border-primary)]">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                              <Video className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div>
                              <Input
                                value={editedLesson.title}
                                onChange={(e) =>
                                  setEditedLesson({ ...editedLesson, title: e.target.value })
                                }
                                className="font-semibold text-lg border-none bg-transparent p-0 h-auto"
                              />
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Lesson {editedLesson.lessonNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant={editedLesson.isPublished ? 'success' : 'secondary'}
                              size="sm"
                              icon={editedLesson.isPublished ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              onClick={() =>
                                setEditedLesson({ ...editedLesson, isPublished: !editedLesson.isPublished })
                              }
                            >
                              {editedLesson.isPublished ? 'Published' : 'Draft'}
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              onClick={handleSaveLesson}
                              disabled={saving}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      </CardHeader>

                      <Tabs value={editorTab} onValueChange={setEditorTab} defaultValue="video">
                        <div className="px-4 pt-2 border-b border-[var(--border-primary)]">
                          <TabsList variant="underline">
                            <TabsTrigger value="video" variant="underline">
                              <Video className="w-4 h-4 mr-2" />
                              Video
                            </TabsTrigger>
                            <TabsTrigger value="transcript" variant="underline">
                              <FileText className="w-4 h-4 mr-2" />
                              Transcript
                            </TabsTrigger>
                            <TabsTrigger value="resources" variant="underline">
                              <FilePlus className="w-4 h-4 mr-2" />
                              Resources
                            </TabsTrigger>
                            <TabsTrigger value="settings" variant="underline">
                              <Settings className="w-4 h-4 mr-2" />
                              Settings
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <CardContent className="p-4">
                          <TabsContent value="video">
                            <div className="space-y-4">
                              {/* Video Source Options */}
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]">
                                <span className="text-sm text-[var(--text-secondary)]">Video Source:</span>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={<Library className="w-4 h-4" />}
                                  onClick={() => setVideoPickerOpen(true)}
                                >
                                  Select from Library
                                </Button>
                                <span className="text-xs text-[var(--text-tertiary)]">or upload below</span>
                              </div>

                              {/* Show YouTube video if using videoUrl */}
                              {editedLesson.videoUrl && !editedLesson.videoUid && (
                                <div className="space-y-2">
                                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                    <iframe
                                      src={`https://www.youtube.com/embed/${new URL(editedLesson.videoUrl).searchParams.get('v') || editedLesson.videoUrl.split('/').pop()}`}
                                      className="w-full h-full"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Youtube className="w-4 h-4 text-red-500" />
                                      <span className="text-sm text-[var(--text-tertiary)]">YouTube Video</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setEditedLesson({ ...editedLesson, videoUrl: null })}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Cloudflare Video Uploader */}
                              {!editedLesson.videoUrl && (
                                <VideoUploader
                                  lesson={editedLesson}
                                  onUploadComplete={handleVideoUploadComplete}
                                  onTranscriptGenerated={(transcript) => {
                                    setEditedLesson({ ...editedLesson, transcriptText: transcript });
                                  }}
                                />
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="transcript">
                            <div className="space-y-4">
                              <Textarea
                                value={editedLesson.transcriptText || ''}
                                onChange={(e) =>
                                  setEditedLesson({ ...editedLesson, transcriptText: e.target.value })
                                }
                                placeholder="Paste or type transcript text here..."
                                rows={20}
                                className="font-mono text-sm"
                              />
                              <p className="text-xs text-[var(--text-tertiary)]">
                                Transcript is used for AI search and context. Include timestamps in [MM:SS] format for auto-chapters.
                              </p>
                            </div>
                          </TabsContent>

                          <TabsContent value="resources">
                            <ResourceEditor
                              resources={editedLesson.resources || []}
                              onChange={(resources) =>
                                setEditedLesson({ ...editedLesson, resources })
                              }
                            />
                          </TabsContent>

                          <TabsContent value="settings">
                            <div className="space-y-6">
                              <div>
                                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                                  Lesson Number
                                </label>
                                <Input
                                  value={editedLesson.lessonNumber || ''}
                                  onChange={(e) =>
                                    setEditedLesson({ ...editedLesson, lessonNumber: e.target.value })
                                  }
                                  placeholder="e.g., 1.1"
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                                  URL Slug
                                </label>
                                <Input
                                  value={editedLesson.slug || ''}
                                  onChange={(e) =>
                                    setEditedLesson({ ...editedLesson, slug: e.target.value })
                                  }
                                  placeholder="e.g., intro-to-ltp"
                                />
                              </div>

                              <div>
                                <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                                  Description
                                </label>
                                <Textarea
                                  value={editedLesson.description || ''}
                                  onChange={(e) =>
                                    setEditedLesson({ ...editedLesson, description: e.target.value })
                                  }
                                  placeholder="Lesson description..."
                                  rows={3}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                                    Minimum Watch %
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={editedLesson.minWatchPercent}
                                    onChange={(e) =>
                                      setEditedLesson({
                                        ...editedLesson,
                                        minWatchPercent: parseInt(e.target.value) || 80,
                                      })
                                    }
                                  />
                                </div>
                                <div className="flex flex-col justify-end">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={editedLesson.isRequired}
                                      onChange={(e) =>
                                        setEditedLesson({ ...editedLesson, isRequired: e.target.checked })
                                      }
                                      className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                                    />
                                    <span className="text-sm text-[var(--text-primary)]">Required for completion</span>
                                  </label>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editedLesson.isPreview}
                                    onChange={(e) =>
                                      setEditedLesson({ ...editedLesson, isPreview: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                                  />
                                  <span className="text-sm text-[var(--text-primary)]">Free preview</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editedLesson.allowSkip}
                                    onChange={(e) =>
                                      setEditedLesson({ ...editedLesson, allowSkip: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                                  />
                                  <span className="text-sm text-[var(--text-primary)]">Allow skip</span>
                                </label>
                              </div>
                            </div>
                          </TabsContent>
                        </CardContent>
                      </Tabs>
                    </>
                  ) : null}
                </Card>
              </div>
            </div>
          </PageSection>
        ) : (
          <PageSection>
            <Card>
              <CardContent className="py-16">
                <div className="text-center text-[var(--text-tertiary)]">
                  <LayoutGrid className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
                    No Course Selected
                  </h3>
                  <p className="mb-4">Select a course from the dropdown or create a new one</p>
                  <Button
                    variant="primary"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => {
                      setEditingCourse(null);
                      setCourseModalOpen(true);
                    }}
                  >
                    Create First Course
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PageSection>
        )}
          </>
        )}
      </PageShell>

      {/* Video Picker Modal */}
      <VideoPickerModal
        isOpen={videoPickerOpen}
        onClose={() => setVideoPickerOpen(false)}
        onSelect={handleSelectLibraryVideo}
      />

      {/* Course Editor Modal */}
      <CourseEditorModal
        course={editingCourse}
        isOpen={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        onSave={handleSaveCourse}
      />

      {/* Module Editor Modal */}
      {selectedCourse && (
        <ModuleEditorModal
          module={editingModule}
          courseId={selectedCourse.id}
          isOpen={moduleModalOpen}
          onClose={() => setModuleModalOpen(false)}
          onSave={handleSaveModule}
        />
      )}
    </>
  );
}
