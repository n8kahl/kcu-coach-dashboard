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
import {
  BulkContentProcessor,
  type ImportProgress,
  type ImportPhase,
} from '@/lib/admin/bulk-import-service';
import type {
  Course,
  CourseModule,
  CourseLesson,
  Resource,
  QuizQuestion,
  QuizChoice,
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
  Play,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Edit3,
  Download,
  Link,
  Image,
  HelpCircle,
  BookOpen,
  Video,
  Archive,
} from 'lucide-react';

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
            {lessonData.isPublished ? 'Published' : 'Draft'}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ============================================
// Video Player / Upload Component
// ============================================

function VideoSection({
  lesson,
  onVideoUpload,
}: {
  lesson: CourseLesson | null;
  onVideoUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);

    // Simulate progress for now
    const interval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 10, 90));
    }, 500);

    try {
      await onVideoUpload(file);
      setUploadProgress(100);
    } finally {
      clearInterval(interval);
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1000);
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
          <Badge variant="success" size="sm">
            <CheckCircle className="w-3 h-3 mr-1" />
            Video Ready
          </Badge>
        </div>
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
// Quiz Builder Component
// ============================================

function QuizBuilder({
  moduleId,
  questions,
  onChange,
}: {
  moduleId: string;
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}) {
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);

  const addQuestion = () => {
    const newQuestion: QuizQuestion = {
      id: `temp-${Date.now()}`,
      moduleId,
      lessonId: null,
      questionType: 'single',
      questionText: '',
      explanation: null,
      remediationVideoId: null,
      remediationTimestampSeconds: null,
      sortOrder: questions.length,
      choices: [
        { id: `c1-${Date.now()}`, questionId: '', choiceText: '', isCorrect: false, sortOrder: 0 },
        { id: `c2-${Date.now()}`, questionId: '', choiceText: '', isCorrect: false, sortOrder: 1 },
        { id: `c3-${Date.now()}`, questionId: '', choiceText: '', isCorrect: false, sortOrder: 2 },
        { id: `c4-${Date.now()}`, questionId: '', choiceText: '', isCorrect: false, sortOrder: 3 },
      ],
    };
    setEditingQuestion(newQuestion);
  };

  const saveQuestion = () => {
    if (!editingQuestion || !editingQuestion.questionText) return;

    const existingIndex = questions.findIndex((q) => q.id === editingQuestion.id);
    if (existingIndex >= 0) {
      const updated = [...questions];
      updated[existingIndex] = editingQuestion;
      onChange(updated);
    } else {
      onChange([...questions, editingQuestion]);
    }
    setEditingQuestion(null);
  };

  const deleteQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const updateChoice = (index: number, field: 'choiceText' | 'isCorrect', value: string | boolean) => {
    if (!editingQuestion) return;

    const updatedChoices = [...editingQuestion.choices];
    if (field === 'isCorrect') {
      // For single choice, uncheck others
      if (editingQuestion.questionType === 'single') {
        updatedChoices.forEach((c, i) => {
          c.isCorrect = i === index;
        });
      } else {
        updatedChoices[index].isCorrect = value as boolean;
      }
    } else {
      updatedChoices[index].choiceText = value as string;
    }

    setEditingQuestion({ ...editingQuestion, choices: updatedChoices });
  };

  return (
    <div className="space-y-4">
      {/* Question List */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((question, index) => (
            <div
              key={question.id}
              className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)] flex items-start gap-3"
            >
              <div className="w-6 h-6 rounded bg-[var(--accent-primary)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent-primary)]">
                {index + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)]">{question.questionText}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" size="sm">
                    {question.questionType}
                  </Badge>
                  <span className="text-xs text-[var(--text-tertiary)]">
                    {question.choices.length} choices
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingQuestion(question)}
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteQuestion(question.id)}
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question Editor */}
      {editingQuestion && (
        <Card className="border-[var(--accent-primary)]">
          <CardHeader>
            <CardTitle className="text-base">
              {editingQuestion.id.startsWith('temp-') ? 'New Question' : 'Edit Question'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                Question Type
              </label>
              <select
                value={editingQuestion.questionType}
                onChange={(e) =>
                  setEditingQuestion({
                    ...editingQuestion,
                    questionType: e.target.value as 'single' | 'multiple' | 'true_false',
                  })
                }
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)]"
              >
                <option value="single">Single Choice</option>
                <option value="multiple">Multiple Choice</option>
                <option value="true_false">True/False</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                Question
              </label>
              <Textarea
                value={editingQuestion.questionText}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, questionText: e.target.value })
                }
                placeholder="Enter your question..."
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-2 block">
                Choices (click to mark correct)
              </label>
              <div className="space-y-2">
                {editingQuestion.choices.map((choice, index) => (
                  <div key={choice.id} className="flex items-center gap-2">
                    <button
                      onClick={() => updateChoice(index, 'isCorrect', !choice.isCorrect)}
                      className={cn(
                        'w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        choice.isCorrect
                          ? 'border-green-500 bg-green-500/20 text-green-500'
                          : 'border-[var(--border-secondary)] hover:border-[var(--text-tertiary)]'
                      )}
                    >
                      {choice.isCorrect && <CheckCircle className="w-4 h-4" />}
                    </button>
                    <Input
                      value={choice.choiceText}
                      onChange={(e) => updateChoice(index, 'choiceText', e.target.value)}
                      placeholder={`Choice ${index + 1}`}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-secondary)] mb-1 block">
                Explanation (shown after answering)
              </label>
              <Textarea
                value={editingQuestion.explanation || ''}
                onChange={(e) =>
                  setEditingQuestion({ ...editingQuestion, explanation: e.target.value || null })
                }
                placeholder="Optional explanation..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="primary" onClick={saveQuestion}>
                <Save className="w-4 h-4 mr-2" />
                Save Question
              </Button>
              <Button variant="secondary" onClick={() => setEditingQuestion(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Button */}
      {!editingQuestion && (
        <Button variant="secondary" onClick={addQuestion} className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Quiz Question
        </Button>
      )}
    </div>
  );
}

// ============================================
// Bulk Import Modal
// ============================================

function BulkImportModal({
  isOpen,
  onClose,
  courseId,
  onComplete,
}: {
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  onComplete: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const processorRef = useRef<BulkContentProcessor | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.name.endsWith('.zip')) {
      setFile(selected);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);

    const processor = new BulkContentProcessor({
      courseId,
      cloudflareAccountId: process.env.NEXT_PUBLIC_CLOUDFLARE_ACCOUNT_ID || '',
      cloudflareApiToken: '', // This should come from a secure endpoint
      onProgress: setProgress,
      onPhaseChange: (phase, msg) => console.log(`[${phase}] ${msg}`),
      parallelUploads: 3,
    });

    processorRef.current = processor;

    try {
      const result = await processor.processZipFile(file);
      if (result.success) {
        onComplete();
        onClose();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAbort = () => {
    processorRef.current?.abort();
    setIsProcessing(false);
    setProgress(null);
  };

  if (!isOpen) return null;

  const phaseLabels: Record<ImportPhase, string> = {
    idle: 'Ready',
    parsing: 'Reading ZIP file...',
    validating: 'Validating content...',
    creating_modules: 'Creating modules...',
    uploading_videos: 'Uploading videos...',
    creating_lessons: 'Creating lessons...',
    importing_quizzes: 'Importing quizzes...',
    finalizing: 'Finalizing...',
    complete: 'Complete!',
    error: 'Error',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center">
              <Archive className="w-5 h-5 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Bulk Import</h2>
              <p className="text-xs text-[var(--text-tertiary)]">Import from ZIP file</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!isProcessing && !progress && (
            <>
              <div
                onClick={() => document.getElementById('zip-upload')?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                  file
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-[var(--border-secondary)] hover:border-[var(--accent-primary)]'
                )}
              >
                <input
                  id="zip-upload"
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {file ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                    <p className="font-medium text-[var(--text-primary)]">{file.name}</p>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload className="w-10 h-10 text-[var(--text-tertiary)] mx-auto" />
                    <p className="font-medium text-[var(--text-primary)]">
                      Drop ZIP file or click to browse
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      Folder = Module, .mp4 = Video, .txt = Transcript
                    </p>
                  </div>
                )}
              </div>

              <div className="text-xs text-[var(--text-tertiary)] space-y-1">
                <p className="font-medium text-[var(--text-secondary)]">Expected structure:</p>
                <pre className="bg-[var(--bg-secondary)] p-2 rounded text-xs overflow-x-auto">
{`course.zip/
├── 01_Module-Name/
│   ├── 01_Lesson.mp4
│   ├── 01_Lesson.txt
│   └── quiz.csv
└── 02_Module-Name/
    └── ...`}
                </pre>
              </div>
            </>
          )}

          {(isProcessing || progress) && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {progress?.phase === 'complete' ? (
                  <CheckCircle className="w-6 h-6 text-green-500" />
                ) : progress?.phase === 'error' ? (
                  <AlertCircle className="w-6 h-6 text-[var(--error)]" />
                ) : (
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-[var(--text-primary)]">
                    {progress ? phaseLabels[progress.phase] : 'Starting...'}
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {progress?.currentItem || 'Initializing...'}
                  </p>
                </div>
              </div>

              <ProgressBar value={progress?.overallProgress || 0} />

              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {progress?.itemsProcessed || 0}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">Items Processed</p>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {progress?.itemsTotal || 0}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)]">Total Items</p>
                </div>
              </div>

              {progress?.errors && progress.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm">
                  <p className="font-medium text-red-400 mb-1">Errors:</p>
                  {progress.errors.slice(0, 3).map((err, i) => (
                    <p key={i} className="text-red-300 text-xs">
                      {err.item}: {err.message}
                    </p>
                  ))}
                  {progress.errors.length > 3 && (
                    <p className="text-red-400 text-xs mt-1">
                      +{progress.errors.length - 3} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-[var(--border-primary)]">
          {isProcessing ? (
            <Button variant="danger" onClick={handleAbort} className="flex-1">
              Abort Import
            </Button>
          ) : progress?.phase === 'complete' ? (
            <Button variant="primary" onClick={onClose} className="flex-1">
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={!file}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                Start Import
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function KnowledgeStudioPage() {
  const { showToast } = useToast();

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
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  // Bulk Import State
  const [showBulkImport, setShowBulkImport] = useState(false);

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
      const res = await fetch('/api/admin/courses');
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
      const res = await fetch(`/api/admin/courses/${selectedCourse.id}/modules`);
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
      // Fetch quiz questions for module
      fetchQuizQuestions((item.data as ModuleWithLessons).id);
    }
  };

  const fetchQuizQuestions = async (moduleId: string) => {
    try {
      const res = await fetch(`/api/admin/modules/${moduleId}/quiz`);
      if (res.ok) {
        const data = await res.json();
        setQuizQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setQuizQuestions([]);
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = treeItems.find((i) => i.id === active.id);
    const overItem = treeItems.find((i) => i.id === over.id);

    if (!activeItem || !overItem) return;

    // Handle reordering (simplified - just modules for now)
    if (activeItem.type === 'module' && overItem.type === 'module') {
      const oldIndex = modules.findIndex((m) => `module-${m.id}` === active.id);
      const newIndex = modules.findIndex((m) => `module-${m.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        setModules(arrayMove(modules, oldIndex, newIndex));
        // TODO: Save new order to backend
      }
    }
  };

  // ============================================
  // Save Handlers
  // ============================================

  const handleSaveLesson = async () => {
    if (!editedLesson) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/lessons/${editedLesson.id}`, {
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
        fetchModules(); // Refresh
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

  const handleVideoUpload = async (file: File) => {
    // TODO: Implement TUS upload to Cloudflare
    console.log('Uploading video:', file.name);
    showToast({
      type: 'info',
      title: 'Upload Started',
      message: 'Video upload to Cloudflare not yet implemented',
    });
  };

  // ============================================
  // Render
  // ============================================

  return (
    <>
      <Header
        title="Knowledge Studio"
        subtitle="Manage course content with drag-and-drop"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Knowledge Studio' }]}
        actions={
          <div className="flex items-center gap-2">
            {selectedCourse && (
              <Button
                variant="primary"
                icon={<Archive className="w-4 h-4" />}
                onClick={() => setShowBulkImport(true)}
              >
                Import ZIP
              </Button>
            )}
          </div>
        }
      />

      <PageShell>
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
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
            >
              New Course
            </Button>
          </div>
        </PageSection>

        {/* Two-Pane Layout */}
        <PageSection>
          <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-280px)]">
            {/* Left Pane - Tree View */}
            <div className="col-span-4">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Content Structure</CardTitle>
                    <Button variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />}>
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
                      <p className="text-sm">No content yet</p>
                      <p className="text-xs mt-1">Import a ZIP or add modules manually</p>
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
                ) : selectedItem.type === 'lesson' && editedLesson ? (
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
                          <VideoSection lesson={editedLesson} onVideoUpload={handleVideoUpload} />
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
                              Transcript is used for AI search and chapter markers. Include timestamps in [MM:SS] format for auto-chapters.
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
                                      minWatchPercent: parseInt(e.target.value) || 90,
                                    })
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-4 pt-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editedLesson.isPreview}
                                    onChange={(e) =>
                                      setEditedLesson({ ...editedLesson, isPreview: e.target.checked })
                                    }
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm text-[var(--text-secondary)]">Free Preview</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={editedLesson.allowSkip}
                                    onChange={(e) =>
                                      setEditedLesson({ ...editedLesson, allowSkip: e.target.checked })
                                    }
                                    className="w-4 h-4"
                                  />
                                  <span className="text-sm text-[var(--text-secondary)]">Allow Skip</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        </TabsContent>
                      </CardContent>
                    </Tabs>
                  </>
                ) : (
                  // Module Selected - Show Quiz Builder
                  <>
                    <CardHeader className="border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                          <FolderOpen className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h2 className="font-semibold text-[var(--text-primary)]">
                            {(selectedItem.data as ModuleWithLessons).title}
                          </h2>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            Module {(selectedItem.data as ModuleWithLessons).moduleNumber} •{' '}
                            {(selectedItem.data as ModuleWithLessons).lessons?.length || 0} lessons
                          </p>
                        </div>
                      </div>
                    </CardHeader>

                    <Tabs value="quiz" defaultValue="quiz">
                      <div className="px-4 pt-2 border-b border-[var(--border-primary)]">
                        <TabsList variant="underline">
                          <TabsTrigger value="quiz" variant="underline">
                            <HelpCircle className="w-4 h-4 mr-2" />
                            Quiz Questions
                          </TabsTrigger>
                          <TabsTrigger value="settings" variant="underline">
                            <Settings className="w-4 h-4 mr-2" />
                            Module Settings
                          </TabsTrigger>
                        </TabsList>
                      </div>

                      <CardContent className="p-4">
                        <TabsContent value="quiz">
                          <QuizBuilder
                            moduleId={(selectedItem.data as ModuleWithLessons).id}
                            questions={quizQuestions}
                            onChange={setQuizQuestions}
                          />
                        </TabsContent>

                        <TabsContent value="settings">
                          <div className="text-center py-12 text-[var(--text-tertiary)]">
                            <Settings className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>Module settings coming soon</p>
                          </div>
                        </TabsContent>
                      </CardContent>
                    </Tabs>
                  </>
                )}
              </Card>
            </div>
          </div>
        </PageSection>
      </PageShell>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        courseId={selectedCourse?.id || ''}
        onComplete={() => {
          fetchModules();
          showToast({
            type: 'success',
            title: 'Import Complete',
            message: 'Content imported successfully',
          });
        }}
      />
    </>
  );
}
