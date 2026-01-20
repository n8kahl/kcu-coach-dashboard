'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileVideo,
  Loader2,
  Sparkles,
  Copy,
  Check,
  Clock,
  Hash,
  MessageSquare,
  Zap,
  Film,
  Target,
  ChevronDown,
  ChevronUp,
  Play,
  AlertCircle,
  RefreshCw,
  Link,
  FileText,
  Scissors,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface HighValueMoment {
  id: string;
  timestamp: string;
  startSeconds: number;
  endSeconds: number;
  quote: string;
  topic: string;
  emotionalIntensity: 'low' | 'medium' | 'high';
  contentType: 'educational' | 'motivational' | 'story' | 'tip' | 'insight';
  keywords: string[];
}

interface GeneratedClip {
  momentId: string;
  hookTitle: string;
  caption: string;
  hashtags: string[];
  platform: 'reels' | 'tiktok' | 'shorts' | 'all';
  suggestedDuration: number;
  textOverlay?: string;
  callToAction: string;
}

interface VideoAnalysisResult {
  videoId: string;
  totalMoments: number;
  moments: HighValueMoment[];
  clips: GeneratedClip[];
  summary: string;
  mainTopics: string[];
  processedAt: string;
  transcriptLength?: number;
  transcriptDuration?: number;
}

interface VideoContentStudioProps {
  showToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

type ProcessingStage = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'generating' | 'complete' | 'error';

// ============================================
// Clip Card Component
// ============================================

function ClipCard({
  clip,
  moment,
  onCopy,
}: {
  clip: GeneratedClip;
  moment: HighValueMoment;
  onCopy: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    onCopy(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const intensityColors = {
    low: 'bg-blue-500/20 text-blue-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-red-500/20 text-red-400',
  };

  const contentTypeIcons = {
    educational: <Target className="w-3.5 h-3.5" />,
    motivational: <Zap className="w-3.5 h-3.5" />,
    story: <MessageSquare className="w-3.5 h-3.5" />,
    tip: <Sparkles className="w-3.5 h-3.5" />,
    insight: <Film className="w-3.5 h-3.5" />,
  };

  return (
    <Card variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2">
              {clip.hookTitle}
            </h3>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="default" size="sm" className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {moment.timestamp}
              </Badge>
              <Badge variant="default" size="sm" className={intensityColors[moment.emotionalIntensity]}>
                {moment.emotionalIntensity} intensity
              </Badge>
              <Badge variant="default" size="sm" className="flex items-center gap-1">
                {contentTypeIcons[moment.contentType]}
                {moment.contentType}
              </Badge>
            </div>
          </div>
          <Badge variant="primary" size="sm">
            ~{clip.suggestedDuration}s
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Text Overlay */}
        {clip.textOverlay && (
          <div className="p-3 bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--accent-primary)] uppercase tracking-wide font-medium">
                Text Overlay
              </span>
              <button
                onClick={() => handleCopy(clip.textOverlay!, 'overlay')}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {copiedField === 'overlay' ? (
                  <Check className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[var(--text-primary)] font-bold text-lg">
              "{clip.textOverlay}"
            </p>
          </div>
        )}

        {/* Caption */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Caption</span>
            <button
              onClick={() => handleCopy(clip.caption, 'caption')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copiedField === 'caption' ? (
                <Check className="w-4 h-4 text-[var(--success)]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">{clip.caption}</p>
        </div>

        {/* Hashtags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide flex items-center gap-1">
              <Hash className="w-3 h-3" />
              Hashtags
            </span>
            <button
              onClick={() => handleCopy(clip.hashtags.map((h) => `#${h}`).join(' '), 'hashtags')}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {copiedField === 'hashtags' ? (
                <Check className="w-4 h-4 text-[var(--success)]" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {clip.hashtags.map((tag, idx) => (
              <Badge key={idx} variant="default" size="sm">
                #{tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-2 bg-[var(--bg-secondary)] rounded text-center">
          <span className="text-sm text-[var(--text-secondary)]">{clip.callToAction}</span>
        </div>

        {/* Expandable Quote */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors w-full"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          <span>Original transcript excerpt</span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-3 bg-[var(--bg-primary)] rounded border-l-2 border-[var(--accent-primary)]">
                <p className="text-sm text-[var(--text-secondary)] italic">"{moment.quote}"</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {moment.keywords.map((kw, idx) => (
                    <Badge key={idx} variant="default" size="sm" className="bg-[var(--accent-primary)]/10">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// ============================================
// Processing Progress Component
// ============================================

function ProcessingProgress({
  stage,
  progress,
}: {
  stage: ProcessingStage;
  progress: number;
}) {
  const stages: { key: ProcessingStage; label: string; icon: React.ReactNode }[] = [
    { key: 'uploading', label: 'Uploading Video', icon: <Upload className="w-4 h-4" /> },
    { key: 'transcribing', label: 'Transcribing Audio', icon: <FileText className="w-4 h-4" /> },
    { key: 'analyzing', label: 'Finding High-Value Moments', icon: <Target className="w-4 h-4" /> },
    { key: 'generating', label: 'Generating Clip Content', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const currentIndex = stages.findIndex((s) => s.key === stage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <Loader2 className="w-6 h-6 text-[var(--accent-primary)] animate-spin" />
        <span className="text-[var(--text-primary)] font-medium">
          {stages.find((s) => s.key === stage)?.label || 'Processing...'}
        </span>
      </div>

      <ProgressBar value={progress} size="md" className="w-full" />

      <div className="flex justify-between">
        {stages.map((s, idx) => (
          <div
            key={s.key}
            className={cn(
              'flex flex-col items-center gap-1',
              idx <= currentIndex ? 'text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)]'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                idx < currentIndex
                  ? 'bg-[var(--success)] text-white'
                  : idx === currentIndex
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)]'
              )}
            >
              {idx < currentIndex ? <Check className="w-4 h-4" /> : s.icon}
            </div>
            <span className="text-xs hidden sm:block">{s.label.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function VideoContentStudio({ showToast }: VideoContentStudioProps) {
  // State
  const [inputMode, setInputMode] = useState<'upload' | 'url' | 'transcript'>('upload');
  const [transcript, setTranscript] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [stage, setStage] = useState<ProcessingStage>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload
  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast({ type: 'error', title: 'Invalid file', message: 'Please select a video file' });
      return;
    }

    // For now, we'll use the transcript mode as video upload requires
    // additional infrastructure (Cloudflare Stream)
    showToast({
      type: 'info',
      title: 'Coming Soon',
      message: 'Direct video upload is coming soon. For now, paste your transcript below.',
    });
    setInputMode('transcript');
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  // Process transcript
  const handleProcess = async () => {
    if (inputMode === 'transcript' && !transcript.trim()) {
      showToast({ type: 'error', title: 'Empty transcript', message: 'Please enter a transcript' });
      return;
    }

    if (inputMode === 'url' && !videoUrl.trim()) {
      showToast({ type: 'error', title: 'Empty URL', message: 'Please enter a video URL' });
      return;
    }

    setStage('analyzing');
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      let response;

      if (inputMode === 'url') {
        setStage('transcribing');
        response = await fetch('/api/admin/social/video-extract?action=from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoUrl,
            generateClips: true,
            maxMoments: 10,
          }),
        });
      } else {
        setStage('analyzing');
        await new Promise((r) => setTimeout(r, 1000));
        setStage('generating');

        response = await fetch('/api/admin/social/video-extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            generateClips: true,
            maxMoments: 10,
          }),
        });
      }

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to extract content');
      }

      setProgress(100);
      setStage('complete');
      setResult(data.data);

      showToast({
        type: 'success',
        title: 'Extraction Complete!',
        message: `Found ${data.data.totalMoments} high-value moments`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed';
      setError(message);
      setStage('error');
      showToast({ type: 'error', title: 'Extraction failed', message });
    }
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast({ type: 'success', title: 'Copied to clipboard' });
  };

  // Reset
  const handleReset = () => {
    setStage('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    setTranscript('');
    setVideoUrl('');
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      {stage === 'idle' && (
        <Card variant="default" padding="none">
          <CardHeader
            title="Video Repurposing Studio"
            icon={<Scissors className="w-5 h-5" />}
            className="p-4 border-b border-[var(--border-primary)]"
          />

          <div className="p-4 space-y-4">
            {/* Mode Selector */}
            <div className="flex gap-2 p-1 bg-[var(--bg-secondary)] rounded-lg">
              <button
                onClick={() => setInputMode('upload')}
                className={cn(
                  'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                  inputMode === 'upload'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <FileVideo className="w-4 h-4 inline mr-2" />
                Upload Video
              </button>
              <button
                onClick={() => setInputMode('url')}
                className={cn(
                  'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                  inputMode === 'url'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Link className="w-4 h-4 inline mr-2" />
                From URL
              </button>
              <button
                onClick={() => setInputMode('transcript')}
                className={cn(
                  'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors',
                  inputMode === 'transcript'
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
                )}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                Paste Transcript
              </button>
            </div>

            {/* Upload Zone */}
            {inputMode === 'upload' && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'aspect-video max-h-[300px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all',
                    isDragging
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : 'border-[var(--border-secondary)] hover:border-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)]'
                  )}
                >
                  <Upload className="w-12 h-12 text-[var(--text-tertiary)] mb-3" />
                  <p className="text-[var(--text-primary)] font-medium">
                    Drop your video here or click to upload
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)] mt-1">
                    MP4, MOV, WebM - Max 4GB
                  </p>
                </div>
              </>
            )}

            {/* URL Input */}
            {inputMode === 'url' && (
              <div className="space-y-3">
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  leftIcon={<Link className="w-4 h-4" />}
                />
                <p className="text-xs text-[var(--text-tertiary)]">
                  Enter a direct video URL. Supports MP4, WebM, and audio files up to 25MB.
                </p>
              </div>
            )}

            {/* Transcript Input */}
            {inputMode === 'transcript' && (
              <div className="space-y-3">
                <Textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste your video transcript here...

Example with timestamps:
[0:00] Hey fam, welcome back to another session.
[0:15] Today we're going to talk about the holy grail of trading...
[1:30] Listen, here's the secret: LTP is everything.

Or just paste plain text and we'll estimate timestamps."
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    {transcript.length} characters | ~{Math.round(transcript.split(/\s+/).length / 150)} min
                  </p>
                </div>
              </div>
            )}

            {/* Process Button */}
            <Button
              variant="primary"
              onClick={handleProcess}
              disabled={
                (inputMode === 'transcript' && !transcript.trim()) ||
                (inputMode === 'url' && !videoUrl.trim())
              }
              icon={<Sparkles className="w-4 h-4" />}
              className="w-full"
            >
              Extract High-Value Moments
            </Button>
          </div>
        </Card>
      )}

      {/* Processing State */}
      {(stage === 'uploading' ||
        stage === 'transcribing' ||
        stage === 'analyzing' ||
        stage === 'generating') && (
        <Card variant="default" className="py-12">
          <ProcessingProgress stage={stage} progress={progress} />
        </Card>
      )}

      {/* Error State */}
      {stage === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-[rgba(239,68,68,0.1)] border border-[var(--error)] rounded-lg"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[var(--error)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--error)]">Extraction Failed</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleReset}
                icon={<RefreshCw className="w-4 h-4" />}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Results */}
      {stage === 'complete' && result && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary Card */}
          <Card variant="default" className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--success)]/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-[var(--success)]" />
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    Found {result.totalMoments} High-Value Moments
                  </h3>
                  <p className="text-sm text-[var(--text-tertiary)]">{result.summary}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReset}
                  icon={<RefreshCw className="w-4 h-4" />}
                >
                  New Video
                </Button>
              </div>
            </div>

            {/* Main Topics */}
            {result.mainTopics.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
                <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">
                  Main Topics
                </span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.mainTopics.map((topic, idx) => (
                    <Badge key={idx} variant="primary" size="sm">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Clip Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {result.clips.map((clip) => {
              const moment = result.moments.find((m) => m.id === clip.momentId);
              if (!moment) return null;

              return (
                <ClipCard key={clip.momentId} clip={clip} moment={moment} onCopy={handleCopy} />
              );
            })}
          </div>

          {/* Moments without clips */}
          {result.moments.length > result.clips.length && (
            <Card variant="default" className="p-4">
              <h4 className="font-medium text-[var(--text-primary)] mb-3">
                Additional Moments ({result.moments.length - result.clips.length})
              </h4>
              <div className="space-y-3">
                {result.moments
                  .filter((m) => !result.clips.find((c) => c.momentId === m.id))
                  .map((moment) => (
                    <div
                      key={moment.id}
                      className="p-3 bg-[var(--bg-secondary)] rounded-lg flex items-start gap-3"
                    >
                      <Badge variant="default" size="sm">
                        {moment.timestamp}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                          {moment.quote}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {moment.keywords.slice(0, 3).map((kw, idx) => (
                            <Badge key={idx} variant="default" size="sm">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default VideoContentStudio;
