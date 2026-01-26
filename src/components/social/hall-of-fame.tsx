'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  RefreshCw,
  Sparkles,
  Check,
  X,
  Copy,
  Download,
  Instagram,
  Twitter,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  User,
  Flame,
  GraduationCap,
  Target,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HallOfFameWinCard,
  AspectRatioSelector,
  ThemeSelector,
  ASPECT_RATIOS,
  WIN_CARD_THEMES,
  type AspectRatioName,
} from '@/components/cards/win-card';
import type { WinCardThemeName } from '@/types/win-card';

// ============================================
// Types
// ============================================

type WinType =
  | 'course_completed'
  | 'module_completed'
  | 'quiz_passed'
  | 'streak_milestone'
  | 'xp_milestone'
  | 'first_trade'
  | 'profit_milestone'
  | 'consistency_award';

interface StudentWinData {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  winType: WinType;
  courseName?: string;
  moduleName?: string;
  quizScore?: number;
  lessonsCompleted?: number;
  totalLessons?: number;
  streakDays?: number;
  xpEarned?: number;
  level?: number;
  totalWatchTimeHours?: number;
  profitAmount?: number;
  profitPercent?: number;
  tradeSymbol?: string;
  achievedAt: string;
}

interface WinCardCaption {
  id: string;
  winType: WinType;
  studentName: string;
  headline: string;
  instagramCaption: string;
  twitterCaption: string;
  hook: string;
  achievement: string;
  encouragement: string;
  hashtags: string[];
  emojis: string[];
  cta: string;
  generatedAt: string;
  voiceProfileUsed: string;
}

interface QueuedWinCard {
  id: string;
  studentWin: StudentWinData;
  caption: WinCardCaption;
  aspectRatio: { name: string; ratio: string };
  theme: { name: string; accentColor: string };
  status: 'draft' | 'approved' | 'posted' | 'rejected';
  imageUrl?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  postedAt?: string;
  postedTo?: string[];
}

interface HallOfFameProps {
  showToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

// ============================================
// Win Type Icons & Colors
// ============================================

const WIN_TYPE_CONFIG: Record<WinType, { icon: typeof Trophy; label: string; color: string }> = {
  course_completed: { icon: GraduationCap, label: 'Course Complete', color: 'text-purple-400' },
  module_completed: { icon: CheckCircle, label: 'Module Complete', color: 'text-blue-400' },
  quiz_passed: { icon: Target, label: 'Quiz Passed', color: 'text-green-400' },
  streak_milestone: { icon: Flame, label: 'Streak Milestone', color: 'text-orange-400' },
  xp_milestone: { icon: Star, label: 'XP Milestone', color: 'text-yellow-400' },
  first_trade: { icon: Target, label: 'First Trade', color: 'text-cyan-400' },
  profit_milestone: { icon: Trophy, label: 'Profit Milestone', color: 'text-emerald-400' },
  consistency_award: { icon: Sparkles, label: 'Consistency Award', color: 'text-pink-400' },
};

// ============================================
// Main Component
// ============================================

export function HallOfFame({ showToast }: HallOfFameProps) {
  const [activeTab, setActiveTab] = useState<'detect' | 'queue' | 'posted'>('detect');
  const [detectedWins, setDetectedWins] = useState<StudentWinData[]>([]);
  const [queue, setQueue] = useState<QueuedWinCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Preview state
  const [previewWin, setPreviewWin] = useState<StudentWinData | null>(null);
  const [previewCaption, setPreviewCaption] = useState<WinCardCaption | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatioName>('post');
  const [theme, setTheme] = useState<WinCardThemeName>('gold');

  // Fetch detected wins
  const fetchDetectedWins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/social/hall-of-fame?action=detect&hours=48');
      const data = await response.json();

      if (data.success) {
        setDetectedWins(data.data);
      } else {
        showToast?.('Failed to detect wins', 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Fetch error:', error);
      showToast?.('Failed to detect wins', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch queue
  const fetchQueue = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = status
        ? `/api/admin/social/hall-of-fame?status=${status}`
        : '/api/admin/social/hall-of-fame';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setQueue(data.data);
      } else {
        showToast?.('Failed to fetch queue', 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Queue fetch error:', error);
      showToast?.('Failed to fetch queue', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Generate caption for a win
  const generateCaption = async (win: StudentWinData) => {
    setGenerating(win.userId);
    try {
      const response = await fetch('/api/admin/social/hall-of-fame?action=generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(win),
      });
      const data = await response.json();

      if (data.success) {
        setPreviewWin(win);
        setPreviewCaption(data.data);
        showToast?.('Caption generated!', 'success');
      } else {
        showToast?.('Failed to generate caption', 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Generate error:', error);
      showToast?.('Failed to generate caption', 'error');
    } finally {
      setGenerating(null);
    }
  };

  // Queue a win card
  const queueWinCard = async () => {
    if (!previewWin || !previewCaption) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/social/hall-of-fame?action=queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentWin: previewWin,
          aspectRatio,
          themeName: theme,
        }),
      });
      const data = await response.json();

      if (data.success) {
        showToast?.('Win card queued for review!', 'success');
        setPreviewWin(null);
        setPreviewCaption(null);
        fetchQueue('draft');
        setActiveTab('queue');
      } else {
        showToast?.('Failed to queue win card', 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Queue error:', error);
      showToast?.('Failed to queue win card', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Approve/Reject a win card
  const reviewWinCard = async (cardId: string, action: 'approve' | 'reject') => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/social/hall-of-fame?action=review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, action }),
      });
      const data = await response.json();

      if (data.success) {
        showToast?.(`Win card ${action}d!`, 'success');
        fetchQueue();
      } else {
        showToast?.(`Failed to ${action} win card`, 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Review error:', error);
      showToast?.(`Failed to ${action} win card`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Mark as posted
  const markAsPosted = async (cardId: string, platforms: string[]) => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/social/hall-of-fame?action=posted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, platforms }),
      });
      const data = await response.json();

      if (data.success) {
        showToast?.('Marked as posted!', 'success');
        fetchQueue();
      } else {
        showToast?.('Failed to mark as posted', 'error');
      }
    } catch (error) {
      console.error('[HallOfFame] Posted error:', error);
      showToast?.('Failed to mark as posted', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    showToast?.(`${label} copied!`, 'success');
  };

  // Load initial data
  useEffect(() => {
    if (activeTab === 'detect') {
      fetchDetectedWins();
    } else if (activeTab === 'queue') {
      fetchQueue('draft');
    } else if (activeTab === 'posted') {
      fetchQueue('posted');
    }
  }, [activeTab, fetchDetectedWins, fetchQueue]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="w-6 h-6 text-[var(--accent-primary)]" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Hall of Fame</h2>
          <Badge variant="gold" size="sm">Student Wins</Badge>
        </div>

        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
          onClick={() => activeTab === 'detect' ? fetchDetectedWins() : fetchQueue()}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border-primary)] pb-2">
        <button
          onClick={() => setActiveTab('detect')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
            activeTab === 'detect'
              ? 'bg-[var(--accent-primary)] text-black'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          Detect Wins ({detectedWins.length})
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
            activeTab === 'queue'
              ? 'bg-[var(--accent-primary)] text-black'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Review Queue ({queue.filter(q => q.status === 'draft').length})
        </button>
        <button
          onClick={() => setActiveTab('posted')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
            activeTab === 'posted'
              ? 'bg-[var(--accent-primary)] text-black'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          )}
        >
          <CheckCircle className="w-4 h-4 inline mr-2" />
          Posted
        </button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: List */}
        <div className="space-y-4">
          {activeTab === 'detect' && (
            <>
              {detectedWins.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent wins detected</p>
                  <p className="text-sm mt-2">Check back later or adjust the time range</p>
                </div>
              ) : (
                detectedWins.map((win) => (
                  <WinCard
                    key={`${win.userId}-${win.winType}-${win.achievedAt}`}
                    win={win}
                    onGenerate={() => generateCaption(win)}
                    isGenerating={generating === win.userId}
                    isSelected={previewWin?.userId === win.userId}
                  />
                ))
              )}
            </>
          )}

          {activeTab === 'queue' && (
            <>
              {queue.filter(q => q.status === 'draft').length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No cards in review queue</p>
                </div>
              ) : (
                queue
                  .filter(q => q.status === 'draft')
                  .map((card) => (
                    <QueueCard
                      key={card.id}
                      card={card}
                      onApprove={() => reviewWinCard(card.id, 'approve')}
                      onReject={() => reviewWinCard(card.id, 'reject')}
                      onCopyCaption={() => copyToClipboard(card.caption.instagramCaption, 'Caption')}
                    />
                  ))
              )}
            </>
          )}

          {activeTab === 'posted' && (
            <>
              {queue.filter(q => q.status === 'posted').length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No posted cards yet</p>
                </div>
              ) : (
                queue
                  .filter(q => q.status === 'posted')
                  .map((card) => (
                    <PostedCard
                      key={card.id}
                      card={card}
                    />
                  ))
              )}
            </>
          )}
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-4 space-y-4">
          {previewWin && previewCaption ? (
            <>
              {/* Controls */}
              <div className="p-4 bg-[var(--bg-elevated)] rounded-lg space-y-4">
                <div>
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide block mb-2">
                    Aspect Ratio
                  </label>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                </div>

                <div>
                  <label className="text-xs text-[var(--text-muted)] uppercase tracking-wide block mb-2">
                    Theme
                  </label>
                  <ThemeSelector value={theme} onChange={setTheme} />
                </div>
              </div>

              {/* Card Preview */}
              <div className="flex justify-center">
                <HallOfFameWinCard
                  winType={previewWin.winType}
                  username={previewWin.displayName}
                  avatarUrl={previewWin.avatarUrl}
                  achievedAt={previewWin.achievedAt}
                  courseName={previewWin.courseName}
                  moduleName={previewWin.moduleName}
                  quizScore={previewWin.quizScore}
                  streakDays={previewWin.streakDays}
                  xpEarned={previewWin.xpEarned}
                  level={previewWin.level}
                  lessonsCompleted={previewWin.lessonsCompleted}
                  totalLessons={previewWin.totalLessons}
                  totalWatchTimeHours={previewWin.totalWatchTimeHours}
                  aspectRatio={aspectRatio}
                  theme={theme}
                  caption={previewCaption.instagramCaption}
                  showCaption={aspectRatio === 'story'}
                  showActions={false}
                />
              </div>

              {/* Caption Preview */}
              <div className="p-4 bg-[var(--bg-elevated)] rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-[var(--text-primary)]">Generated Caption</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy className="w-4 h-4" />}
                    onClick={() => copyToClipboard(previewCaption.instagramCaption, 'Caption')}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed">
                  {previewCaption.instagramCaption}
                </p>
                <div className="flex flex-wrap gap-1 pt-2">
                  {previewCaption.hashtags.map((tag, i) => (
                    <span key={i} className="text-xs text-[var(--accent-primary)]">{tag}</span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  icon={<Check className="w-4 h-4" />}
                  onClick={queueWinCard}
                  loading={loading}
                  className="flex-1"
                >
                  Add to Queue
                </Button>
                <Button
                  variant="secondary"
                  icon={<Download className="w-4 h-4" />}
                  disabled
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  icon={<X className="w-4 h-4" />}
                  onClick={() => {
                    setPreviewWin(null);
                    setPreviewCaption(null);
                  }}
                >
                  Clear
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[400px] bg-[var(--bg-elevated)] rounded-lg">
              <div className="text-center text-[var(--text-muted)]">
                <Eye className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a win to preview</p>
                <p className="text-sm mt-2">Click "Generate Caption" on any win</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Win Card Component (List Item)
// ============================================

interface WinCardItemProps {
  win: StudentWinData;
  onGenerate: () => void;
  isGenerating: boolean;
  isSelected: boolean;
}

function WinCard({ win, onGenerate, isGenerating, isSelected }: WinCardItemProps) {
  const config = WIN_TYPE_CONFIG[win.winType];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-4 bg-[var(--bg-elevated)] rounded-lg border transition-colors',
        isSelected
          ? 'border-[var(--accent-primary)]'
          : 'border-[var(--border-primary)] hover:border-[var(--border-hover)]'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {win.avatarUrl ? (
            <img
              src={win.avatarUrl}
              alt={win.displayName}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)] flex items-center justify-center">
              <User className="w-6 h-6 text-[var(--text-muted)]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={cn('w-4 h-4', config.color)} />
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              {config.label}
            </span>
          </div>
          <h4 className="font-semibold text-[var(--text-primary)] truncate">
            {win.displayName}
          </h4>
          <p className="text-sm text-[var(--text-secondary)]">
            {getWinDescription(win)}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {new Date(win.achievedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Action */}
        <Button
          variant={isSelected ? 'primary' : 'secondary'}
          size="sm"
          icon={isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isSelected ? 'Selected' : 'Generate'}
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================
// Queue Card Component
// ============================================

interface QueueCardProps {
  card: QueuedWinCard;
  onApprove: () => void;
  onReject: () => void;
  onCopyCaption: () => void;
}

function QueueCard({ card, onApprove, onReject, onCopyCaption }: QueueCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-primary)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: card.theme.accentColor + '20' }}
          >
            <Trophy className="w-5 h-5" style={{ color: card.theme.accentColor }} />
          </div>
          <div>
            <h4 className="font-semibold text-[var(--text-primary)]">
              {card.studentWin.displayName}
            </h4>
            <p className="text-xs text-[var(--text-muted)]">
              {card.aspectRatio.ratio} • {card.theme.name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 border-t border-[var(--border-primary)]">
              <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap line-clamp-6">
                {card.caption.instagramCaption}
              </p>
              <button
                onClick={onCopyCaption}
                className="text-xs text-[var(--accent-primary)] hover:underline mt-2"
              >
                Copy full caption
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
        <Button
          variant="primary"
          size="sm"
          icon={<Check className="w-4 h-4" />}
          onClick={onApprove}
          className="flex-1"
        >
          Approve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<X className="w-4 h-4" />}
          onClick={onReject}
        >
          Reject
        </Button>
      </div>
    </motion.div>
  );
}

// ============================================
// Posted Card Component
// ============================================

interface PostedCardProps {
  card: QueuedWinCard;
}

function PostedCard({ card }: PostedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-primary)]"
    >
      <div className="flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-green-500" />
        <div className="flex-1">
          <h4 className="font-semibold text-[var(--text-primary)]">
            {card.studentWin.displayName}
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            Posted {card.postedAt ? new Date(card.postedAt).toLocaleDateString() : 'N/A'}
          </p>
        </div>
        <div className="flex gap-1">
          {card.postedTo?.includes('instagram') && (
            <Instagram className="w-4 h-4 text-pink-500" />
          )}
          {card.postedTo?.includes('twitter') && (
            <Twitter className="w-4 h-4 text-blue-400" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getWinDescription(win: StudentWinData): string {
  switch (win.winType) {
    case 'course_completed':
      return `Completed "${win.courseName}"`;
    case 'module_completed':
      return `Completed "${win.moduleName}" (${win.lessonsCompleted}/${win.totalLessons})`;
    case 'quiz_passed':
      return `Passed "${win.moduleName}" quiz with ${win.quizScore}%`;
    case 'streak_milestone':
      return `${win.streakDays}-day learning streak!`;
    case 'xp_milestone':
      return `Reached ${win.xpEarned?.toLocaleString()} XP (Level ${win.level})`;
    case 'first_trade':
      return 'Logged their first trade';
    case 'profit_milestone':
      return `${win.profitPercent}% gain on ${win.tradeSymbol}`;
    case 'consistency_award':
      return `${win.streakDays} days of consistency`;
    default:
      return 'Achievement unlocked';
  }
}
