'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Twitter,
  Linkedin,
  Instagram,
  Copy,
  Check,
  Edit3,
  RefreshCw,
  Loader2,
  Target,
  Wand2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ============================================
// Types
// ============================================

type BrainDumpPlatform = 'twitter' | 'linkedin' | 'instagram';

interface BrainDumpResult {
  platform: BrainDumpPlatform;
  content: string;
  hashtags: string[];
  hook: string;
  cta: string;
  characterCount: number;
  threadPosts?: string[];
  carouselSlides?: string[];
}

interface BrainDumpOutput {
  results: BrainDumpResult[];
  rawInput: string;
  processedAt: string;
  toneMatchScore: number;
}

interface BrainDumpInputProps {
  onGenerate?: (output: BrainDumpOutput) => void;
  showToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message?: string }) => void;
}

// ============================================
// Platform Icons & Config
// ============================================

const platformConfig: Record<BrainDumpPlatform, {
  icon: typeof Twitter;
  label: string;
  color: string;
  bgColor: string;
  maxChars: number;
}> = {
  twitter: {
    icon: Twitter,
    label: 'Twitter/X',
    color: '#1DA1F2',
    bgColor: 'rgba(29, 161, 242, 0.15)',
    maxChars: 280,
  },
  linkedin: {
    icon: Linkedin,
    label: 'LinkedIn',
    color: '#0A66C2',
    bgColor: 'rgba(10, 102, 194, 0.15)',
    maxChars: 3000,
  },
  instagram: {
    icon: Instagram,
    label: 'Instagram',
    color: '#E4405F',
    bgColor: 'rgba(228, 64, 95, 0.15)',
    maxChars: 2200,
  },
};

// ============================================
// Result Card Component
// ============================================

function ResultCard({
  result,
  onCopy,
  onEdit,
}: {
  result: BrainDumpResult;
  onCopy: (text: string) => void;
  onEdit: (platform: BrainDumpPlatform, newContent: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(result.content);
  const [copied, setCopied] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [showCarousel, setShowCarousel] = useState(false);

  const config = platformConfig[result.platform];
  const Icon = config.icon;

  const handleCopy = () => {
    const fullContent = result.hashtags.length > 0
      ? `${result.content}\n\n${result.hashtags.map(h => `#${h}`).join(' ')}`
      : result.content;
    onCopy(fullContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    onEdit(result.platform, editContent);
    setIsEditing(false);
  };

  return (
    <Card variant="default" padding="none" className="overflow-hidden">
      {/* Header */}
      <div
        className="p-4 border-b border-[var(--border-primary)]"
        style={{ backgroundColor: config.bgColor }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" style={{ color: config.color }} />
            <span className="font-medium text-[var(--text-primary)]">{config.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="default" size="sm">
              {result.characterCount} / {config.maxChars}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Hook Preview */}
        {result.hook && (
          <div className="mb-3 pb-3 border-b border-[var(--border-primary)]">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Hook</span>
            <p className="text-[var(--accent-primary)] font-semibold mt-1">{result.hook}</p>
          </div>
        )}

        {/* Main Content */}
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full min-h-[200px] p-3 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
        ) : (
          <p className="text-[var(--text-secondary)] text-sm whitespace-pre-wrap">
            {result.content}
          </p>
        )}

        {/* Thread Posts (Twitter) */}
        {result.threadPosts && result.threadPosts.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowThread(!showThread)}
              className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showThread ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>Thread ({result.threadPosts.length} tweets)</span>
            </button>
            <AnimatePresence>
              {showThread && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  {result.threadPosts.map((tweet, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[var(--bg-primary)] rounded border-l-2"
                      style={{ borderColor: config.color }}
                    >
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {idx + 1}/{result.threadPosts!.length}
                      </span>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{tweet}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Carousel Slides (Instagram) */}
        {result.carouselSlides && result.carouselSlides.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowCarousel(!showCarousel)}
              className="flex items-center gap-2 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {showCarousel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              <span>Carousel ({result.carouselSlides.length} slides)</span>
            </button>
            <AnimatePresence>
              {showCarousel && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-3 space-y-2 overflow-hidden"
                >
                  {result.carouselSlides.map((slide, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-[var(--bg-primary)] rounded border-l-2"
                      style={{ borderColor: config.color }}
                    >
                      <span className="text-xs text-[var(--text-tertiary)]">
                        Slide {idx + 1}
                      </span>
                      <p className="text-sm text-[var(--text-secondary)] mt-1">{slide}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Hashtags */}
        {result.hashtags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Hashtags</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {result.hashtags.map((hashtag, idx) => (
                <Badge key={idx} variant="default" size="sm">
                  #{hashtag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {result.cta && (
          <div className="mt-4 p-3 bg-[rgba(245,158,11,0.1)] rounded">
            <span className="text-xs text-[var(--accent-primary)] uppercase tracking-wide">Call to Action</span>
            <p className="text-sm text-[var(--text-primary)] mt-1">{result.cta}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--border-primary)]">
          {isEditing ? (
            <>
              <Button variant="primary" size="sm" onClick={handleSaveEdit}>
                Save Changes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                icon={copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                icon={<Edit3 className="w-4 h-4" />}
              >
                Edit
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

export function BrainDumpInput({ onGenerate, showToast }: BrainDumpInputProps) {
  const [rawInput, setRawInput] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<BrainDumpPlatform[]>(['twitter', 'linkedin', 'instagram']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState<BrainDumpOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (platform: BrainDumpPlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleGenerate = async () => {
    if (!rawInput.trim()) {
      showToast({ type: 'error', title: 'Empty input', message: 'Please enter your brain dump first' });
      return;
    }

    if (selectedPlatforms.length === 0) {
      showToast({ type: 'error', title: 'No platforms', message: 'Select at least one platform' });
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/social/brain-dump', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawInput,
          platforms: selectedPlatforms,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      setOutput(data.data);
      onGenerate?.(data.data);
      showToast({
        type: 'success',
        title: 'Content generated!',
        message: `Created ${data.data.results.length} platform variants`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      setError(message);
      showToast({ type: 'error', title: 'Generation failed', message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast({ type: 'success', title: 'Copied to clipboard' });
  };

  const handleEdit = (platform: BrainDumpPlatform, newContent: string) => {
    if (!output) return;

    setOutput({
      ...output,
      results: output.results.map((r) =>
        r.platform === platform ? { ...r, content: newContent, characterCount: newContent.length } : r
      ),
    });
    showToast({ type: 'success', title: 'Content updated' });
  };

  const handleClear = () => {
    setRawInput('');
    setOutput(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card variant="default" padding="none">
        <CardHeader
          title="Brain Dump"
          icon={<Wand2 className="w-5 h-5" />}
          className="p-4 border-b border-[var(--border-primary)]"
        />
        <div className="p-4 space-y-4">
          {/* Instructions */}
          <p className="text-sm text-[var(--text-secondary)]">
            Dump your raw idea, thought, or teaching point below. We&apos;ll transform it into viral,
            Somesh-style content optimized for each platform.
          </p>

          {/* Textarea */}
          <div className="relative">
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Example: I keep seeing traders enter too early. They see a good level, the trend is right, but they don't wait for confirmation. The patience candle is what separates gambling from trading. It's the LTP framework - Level, Trend, PATIENCE. That last P is where most people fail..."
              className="w-full min-h-[200px] p-4 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-y focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] transition-all"
              maxLength={5000}
            />
            <div className="absolute bottom-3 right-3 text-xs text-[var(--text-tertiary)]">
              {rawInput.length} / 5000
            </div>
          </div>

          {/* Platform Selection */}
          <div>
            <span className="text-sm text-[var(--text-tertiary)] mb-2 block">Target Platforms</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(platformConfig) as BrainDumpPlatform[]).map((platform) => {
                const config = platformConfig[platform];
                const Icon = config.icon;
                const isSelected = selectedPlatforms.includes(platform);

                return (
                  <button
                    key={platform}
                    onClick={() => togglePlatform(platform)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg border transition-all
                      ${isSelected
                        ? 'border-transparent'
                        : 'border-[var(--border-primary)] bg-[var(--bg-primary)]'
                      }
                    `}
                    style={{
                      backgroundColor: isSelected ? config.bgColor : undefined,
                      borderColor: isSelected ? config.color : undefined,
                    }}
                  >
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isSelected ? config.color : 'var(--text-tertiary)' }}
                    />
                    <span
                      className="text-sm font-medium"
                      style={{ color: isSelected ? config.color : 'var(--text-secondary)' }}
                    >
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={!rawInput.trim() || selectedPlatforms.length === 0}
              icon={<Sparkles className="w-4 h-4" />}
              className="flex-1 sm:flex-none"
            >
              Make It Viral
            </Button>
            {(rawInput || output) && (
              <Button
                variant="ghost"
                onClick={handleClear}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-[rgba(239,68,68,0.1)] border border-[var(--error)] rounded-lg flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-[var(--error)] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[var(--error)]">Generation Failed</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{error}</p>
          </div>
        </motion.div>
      )}

      {/* Loading State */}
      {isGenerating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-12"
        >
          <div className="relative">
            <Loader2 className="w-12 h-12 text-[var(--accent-primary)] animate-spin" />
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)] absolute top-0 right-0 animate-pulse" />
          </div>
          <p className="text-[var(--text-secondary)] mt-4">Transforming your idea into viral content...</p>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">This usually takes 5-10 seconds</p>
        </motion.div>
      )}

      {/* Results Section */}
      {output && !isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Tone Match Score */}
          <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-lg border border-[var(--border-primary)]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[rgba(245,158,11,0.15)] rounded">
                <Target className="w-5 h-5 text-[var(--accent-primary)]" />
              </div>
              <div>
                <span className="text-sm text-[var(--text-tertiary)]">Somesh Voice Match</span>
                <p className="font-bold text-[var(--text-primary)]">{output.toneMatchScore}%</p>
              </div>
            </div>
            <div className="w-32 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-primary)] rounded-full transition-all"
                style={{ width: `${output.toneMatchScore}%` }}
              />
            </div>
          </div>

          {/* Result Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {output.results.map((result) => (
              <ResultCard
                key={result.platform}
                result={result}
                onCopy={handleCopy}
                onEdit={handleEdit}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default BrainDumpInput;
