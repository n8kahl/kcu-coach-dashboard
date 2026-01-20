'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PreviewPlayer } from '@/components/admin/content/PreviewPlayer';
import { VideoPickerModal, type LibraryVideo } from '@/components/admin/content/library-manager';
import { useContentStudio, type ModuleWithLessons, type TreeItem } from './ContentStudioContext';
import type { CourseLesson, CourseModule, Resource, ResourceType } from '@/types/learning';
import {
  Save,
  Loader2,
  FileVideo,
  FileText,
  Settings,
  Plus,
  Trash2,
  Upload,
  Library,
  Edit3,
  FolderOpen,
  BookOpen,
  Eye,
  EyeOff,
  X,
  Download,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProgressBar } from '@/components/ui/progress';
import { useToast } from '@/components/ui/toast';

// ============================================
// useDebounce Hook for Auto-Save
// ============================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================
// Video Uploader Component
// ============================================

interface VideoUploaderProps {
  lesson: CourseLesson | null;
  onUploadComplete: (videoUid: string, duration: number) => void;
  onTranscriptGenerated?: (transcript: string) => void;
  onStatusChange?: (status: 'pending' | 'processing' | 'ready' | 'error', metadata?: { duration?: number; thumbnailUrl?: string }) => void;
}

function VideoUploader({
  lesson,
  onUploadComplete,
  onTranscriptGenerated,
  onStatusChange,
}: VideoUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [generatingTranscript, setGeneratingTranscript] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Environment check for Cloudflare Stream domain
  const streamDomain = process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN;
  const missingEnvVar = !streamDomain;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    if (file.size > 4 * 1024 * 1024 * 1024) {
      setError('File size must be under 4GB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const tokenRes = await fetch('/api/admin/content/video/upload-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta: { name: file.name, lessonId: lesson?.id },
          maxDurationSeconds: 7200,
        }),
      });

      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.details || errData.error || 'Failed to get upload URL');
      }

      const { uploadURL, uid } = await tokenRes.json();
      const { Upload } = await import('tus-js-client');

      const upload = new Upload(file, {
        uploadUrl: uploadURL,
        chunkSize: 50 * 1024 * 1024,
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
          setError(err instanceof Error ? err.message : 'Upload failed');
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

  const handlePreviewStatusChange = (status: 'pending' | 'processing' | 'ready' | 'error', metadata?: { duration?: number; thumbnailUrl?: string }) => {
    onStatusChange?.(status, metadata);
  };

  if (lesson?.videoUid) {
    return (
      <div className="space-y-4">
        <PreviewPlayer
          videoUid={lesson.videoUid}
          videoStatus={lesson.videoStatus}
          videoDurationSeconds={lesson.videoDurationSeconds}
          thumbnailUrl={lesson.thumbnailUrl}
          onStatusChange={handlePreviewStatusChange}
        />

        {lesson.videoStatus === 'ready' && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Replace Video
            </Button>
          </div>
        )}

        {lesson.videoStatus === 'ready' && (
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
        )}

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

  if (missingEnvVar) {
    return (
      <div className="space-y-4">
        <div className="aspect-video bg-red-500/10 border-2 border-dashed border-red-500/50 rounded-lg flex flex-col items-center justify-center p-6">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-3">
            <X className="w-6 h-6 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-400 text-center mb-2">
            Configuration Error
          </p>
          <p className="text-xs text-red-400/80 text-center max-w-sm">
            <code className="bg-red-500/20 px-1 py-0.5 rounded">NEXT_PUBLIC_CLOUDFLARE_STREAM_DOMAIN</code> environment variable is not set.
          </p>
        </div>
      </div>
    );
  }

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

  const handleAddResource = () => {
    if (!newResource.title || !newResource.url) return;

    onChange([
      ...resources,
      {
        type: newResource.type as ResourceType,
        title: newResource.title,
        url: newResource.url,
        description: newResource.description,
      },
    ]);

    setNewResource({ type: 'link', title: '', url: '' });
  };

  const handleRemoveResource = (index: number) => {
    onChange(resources.filter((_, i) => i !== index));
  };

  const getResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'download':
        return <Download className="w-4 h-4" />;
      case 'image':
        return <ImageIcon className="w-4 h-4" />;
      default:
        return <LinkIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Existing Resources */}
      {resources.length > 0 && (
        <div className="space-y-2">
          {resources.map((resource, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
            >
              <div className="w-8 h-8 rounded-md bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">
                {getResourceIcon(resource.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {resource.title}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {resource.url}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveResource(index)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Resource */}
      <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] space-y-3">
        <p className="text-sm font-medium text-[var(--text-secondary)]">Add Resource</p>

        <div className="grid grid-cols-4 gap-2">
          {(['link', 'pdf', 'download', 'image'] as ResourceType[]).map((type) => (
            <button
              key={type}
              onClick={() => setNewResource({ ...newResource, type })}
              className={cn(
                'px-3 py-2 rounded-md text-xs font-medium transition-colors capitalize',
                newResource.type === type
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <Input
          placeholder="Resource Title"
          value={newResource.title || ''}
          onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
        />

        <Input
          placeholder="Resource URL"
          value={newResource.url || ''}
          onChange={(e) => setNewResource({ ...newResource, url: e.target.value })}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddResource}
          disabled={!newResource.title || !newResource.url}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Resource
        </Button>
      </div>
    </div>
  );
}

// ============================================
// Lesson Editor Component
// ============================================

interface LessonEditorProps {
  onAddLesson: (moduleId: string) => void;
}

export function LessonEditor({ onAddLesson }: LessonEditorProps) {
  const { showToast } = useToast();
  const {
    selectedItem,
    editedLesson,
    setEditedLesson,
    saving,
    saveLesson,
  } = useContentStudio();

  const [editorTab, setEditorTab] = useState<'video' | 'transcript' | 'resources' | 'settings'>('video');
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Track the initial lesson state for auto-save comparison
  const [lastSavedLesson, setLastSavedLesson] = useState<CourseLesson | null>(null);

  // Debounce the edited lesson for auto-save (2 seconds)
  const debouncedLesson = useDebounce(editedLesson, 2000);

  // Auto-save effect
  useEffect(() => {
    const shouldAutoSave =
      debouncedLesson &&
      lastSavedLesson &&
      debouncedLesson.id === lastSavedLesson.id &&
      (debouncedLesson.title !== lastSavedLesson.title ||
        debouncedLesson.description !== lastSavedLesson.description);

    if (shouldAutoSave) {
      setAutoSaveStatus('saving');
      saveLesson(debouncedLesson).then(() => {
        setLastSavedLesson(debouncedLesson);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      });
    }
  }, [debouncedLesson, lastSavedLesson, saveLesson]);

  // Update lastSavedLesson when a new lesson is selected
  useEffect(() => {
    if (editedLesson && editedLesson.id !== lastSavedLesson?.id) {
      setLastSavedLesson(editedLesson);
    }
  }, [editedLesson, lastSavedLesson?.id]);

  // Handle save
  const handleSave = async () => {
    if (!editedLesson) return;
    await saveLesson(editedLesson);
    setLastSavedLesson(editedLesson);
  };

  // Handle video upload complete
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

  // Handle video status change
  const handleVideoStatusChange = (
    status: 'pending' | 'processing' | 'ready' | 'error',
    metadata?: { duration?: number; thumbnailUrl?: string }
  ) => {
    if (!editedLesson) return;

    setEditedLesson({
      ...editedLesson,
      videoStatus: status,
      ...(metadata?.duration && { videoDurationSeconds: metadata.duration }),
      ...(metadata?.thumbnailUrl && { thumbnailUrl: metadata.thumbnailUrl }),
    });
  };

  // Handle library video selection
  const handleSelectLibraryVideo = (video: LibraryVideo) => {
    if (!editedLesson) return;

    if (video.type === 'youtube') {
      setEditedLesson({
        ...editedLesson,
        videoUrl: video.url || `https://www.youtube.com/watch?v=${video.videoId}`,
        videoUid: null,
        videoDurationSeconds: video.duration ?? null,
        videoStatus: video.status === 'ready' ? 'ready' : 'pending',
        thumbnailUrl: video.thumbnailUrl || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`,
      });
    } else {
      setEditedLesson({
        ...editedLesson,
        videoUid: video.videoId,
        videoUrl: null,
        videoDurationSeconds: video.duration ?? null,
        videoStatus: video.status === 'ready' ? 'ready' : 'pending',
        thumbnailUrl: video.thumbnailUrl || null,
      });
    }

    setVideoPickerOpen(false);
    showToast({
      type: 'success',
      title: 'Video Selected',
      message: `Using "${video.title}"`,
    });
  };

  // No selection state
  if (!selectedItem) {
    return (
      <Card className="h-full">
        <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
          <div className="text-center">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a module or lesson to edit</p>
          </div>
        </div>
      </Card>
    );
  }

  // Module selected state
  if (selectedItem.type === 'module') {
    const moduleData = selectedItem.data as ModuleWithLessons;
    return (
      <Card className="h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <FolderOpen className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">
                  {moduleData.title}
                </h2>
                <p className="text-sm text-[var(--text-tertiary)]">
                  Module {moduleData.moduleNumber} • {moduleData.lessons?.length || 0} lessons
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Button
              variant="primary"
              onClick={() => onAddLesson(moduleData.id)}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Lesson to Module
            </Button>

            {moduleData.lessons && moduleData.lessons.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Lessons in this module:
                </p>
                <div className="space-y-2">
                  {moduleData.lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
                    >
                      <span className="text-sm text-[var(--text-tertiary)]">{index + 1}.</span>
                      <span className="text-sm text-[var(--text-primary)] flex-1">{lesson.title}</span>
                      <Badge variant={lesson.isPublished ? 'success' : 'default'} size="sm">
                        {lesson.isPublished ? 'Live' : 'Draft'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Lesson selected state
  if (!editedLesson) {
    return (
      <Card className="h-full">
        <div className="h-full flex items-center justify-center text-[var(--text-tertiary)]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="h-full flex flex-col">
        {/* Header */}
        <CardHeader className="py-3 px-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <FileVideo className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  value={editedLesson.title}
                  onChange={(e) => setEditedLesson({ ...editedLesson, title: e.target.value })}
                  className="text-lg font-semibold border-none bg-transparent p-0 h-auto focus:ring-0"
                  placeholder="Lesson Title"
                />
                <p className="text-xs text-[var(--text-tertiary)]">
                  Lesson {editedLesson.lessonNumber}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Auto-save indicator */}
              {autoSaveStatus === 'saving' && (
                <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {autoSaveStatus === 'saved' && (
                <span className="text-xs text-green-400">Saved</span>
              )}

              <Badge variant={editedLesson.isPublished ? 'success' : 'default'}>
                {editedLesson.isPublished ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Published
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Draft
                  </>
                )}
              </Badge>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Tabs */}
        <Tabs
          value={editorTab}
          onValueChange={(v) => setEditorTab(v as typeof editorTab)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="px-4 py-2 border-b border-[var(--border-primary)]">
            <TabsList>
              <TabsTrigger value="video">
                <FileVideo className="w-4 h-4 mr-2" />
                Video
              </TabsTrigger>
              <TabsTrigger value="transcript">
                <FileText className="w-4 h-4 mr-2" />
                Transcript
              </TabsTrigger>
              <TabsTrigger value="resources">
                <FolderOpen className="w-4 h-4 mr-2" />
                Resources
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="p-4 flex-1 overflow-y-auto">
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
                  <div className="space-y-3">
                    <PreviewPlayer
                      videoUrl={editedLesson.videoUrl}
                      videoStatus={editedLesson.videoStatus}
                      videoDurationSeconds={editedLesson.videoDurationSeconds}
                      thumbnailUrl={editedLesson.thumbnailUrl}
                    />
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditedLesson({ ...editedLesson, videoUrl: null, thumbnailUrl: null })}
                      >
                        Remove Video
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
                    onStatusChange={handleVideoStatusChange}
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
                  placeholder="Paste or generate video transcript..."
                  rows={20}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-[var(--text-tertiary)]">
                  {editedLesson.transcriptText
                    ? `${editedLesson.transcriptText.split(' ').length} words`
                    : 'No transcript'}
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
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Basic Info</h3>

                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      URL Slug
                    </label>
                    <Input
                      value={editedLesson.slug}
                      onChange={(e) =>
                        setEditedLesson({ ...editedLesson, slug: e.target.value })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      Lesson Number
                    </label>
                    <Input
                      value={editedLesson.lessonNumber}
                      onChange={(e) =>
                        setEditedLesson({ ...editedLesson, lessonNumber: e.target.value })
                      }
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
                      rows={3}
                    />
                  </div>
                </div>

                {/* Publishing */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Publishing</h3>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedLesson.isPublished}
                      onChange={(e) =>
                        setEditedLesson({ ...editedLesson, isPublished: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                    />
                    <div>
                      <span className="text-sm text-[var(--text-primary)]">Published</span>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Make this lesson visible to students
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedLesson.isPreview}
                      onChange={(e) =>
                        setEditedLesson({ ...editedLesson, isPreview: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                    />
                    <div>
                      <span className="text-sm text-[var(--text-primary)]">Free Preview</span>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Available to non-subscribers as a preview
                      </p>
                    </div>
                  </label>
                </div>

                {/* Compliance */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compliance</h3>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editedLesson.isRequired}
                      onChange={(e) =>
                        setEditedLesson({ ...editedLesson, isRequired: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-[var(--border-primary)] accent-[var(--accent-primary)]"
                    />
                    <div>
                      <span className="text-sm text-[var(--text-primary)]">Required for Compliance</span>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        User must complete this lesson for compliance certification
                      </p>
                    </div>
                  </label>

                  <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                      Minimum Watch Percentage
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={editedLesson.minWatchPercent}
                        onChange={(e) =>
                          setEditedLesson({
                            ...editedLesson,
                            minWatchPercent: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-24"
                      />
                      <span className="text-sm text-[var(--text-tertiary)]">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Video Picker Modal */}
      <VideoPickerModal
        isOpen={videoPickerOpen}
        onClose={() => setVideoPickerOpen(false)}
        onSelect={handleSelectLibraryVideo}
      />
    </>
  );
}
