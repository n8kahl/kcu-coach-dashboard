'use client';

/**
 * StudyStatsCard Component
 *
 * A social sharing card for learning statistics with "Dark Academia meets Wall Street" aesthetic.
 * Features: Gold serif typography, dark background, achievement badges, AI commentary, QR code
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toPng, toJpeg } from 'html-to-image';
import {
  Download,
  Copy,
  Share2,
  X,
  Award,
  BookOpen,
  Clock,
  Target,
  Flame,
  Trophy,
  Star,
  Shield,
  Zap,
  Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TranscriptSummary, AchievementSlug, UserLearningAchievement } from '@/types/learning';

// ============================================
// TYPES
// ============================================

interface StudyStatsCardProps {
  summary: TranscriptSummary;
  userName: string;
  achievements?: UserLearningAchievement[];
  onClose?: () => void;
}

interface StudyStatsCardModalProps extends StudyStatsCardProps {
  isOpen: boolean;
}

// ============================================
// BADGE DEFINITIONS
// ============================================

interface BadgeDefinition {
  slug: AchievementSlug;
  icon: React.ReactNode;
  label: string;
  color: string;
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { slug: 'ltp-master', icon: <Target className="h-4 w-4" />, label: 'LTP Master', color: '#f59e0b' },
  { slug: 'gamma-expert', icon: <Zap className="h-4 w-4" />, label: 'Gamma Expert', color: '#8b5cf6' },
  { slug: 'risk-manager', icon: <Shield className="h-4 w-4" />, label: 'Risk Manager', color: '#22c55e' },
  { slug: 'consistency-king', icon: <Crown className="h-4 w-4" />, label: 'Consistency King', color: '#f59e0b' },
  { slug: 'study-streak-7', icon: <Flame className="h-4 w-4" />, label: '7 Day Streak', color: '#ef4444' },
  { slug: 'study-streak-30', icon: <Flame className="h-4 w-4" />, label: '30 Day Streak', color: '#ef4444' },
  { slug: 'first-quiz-ace', icon: <Star className="h-4 w-4" />, label: 'Quiz Ace', color: '#f59e0b' },
  { slug: 'perfect-module', icon: <Award className="h-4 w-4" />, label: 'Perfect Module', color: '#3b82f6' },
  { slug: 'video-marathon', icon: <BookOpen className="h-4 w-4" />, label: 'Video Marathon', color: '#ec4899' },
  { slug: 'early-bird', icon: <Star className="h-4 w-4" />, label: 'Early Bird', color: '#f59e0b' },
  { slug: 'night-owl', icon: <Star className="h-4 w-4" />, label: 'Night Owl', color: '#6366f1' },
  { slug: 'weekend-warrior', icon: <Trophy className="h-4 w-4" />, label: 'Weekend Warrior', color: '#14b8a6' },
];

// ============================================
// AI COMMENTARY GENERATOR
// ============================================

function generateAICommentary(summary: TranscriptSummary): string {
  const hours = Math.floor(summary.totalTime / 3600);
  const score = summary.averageQuizScore;
  const consistency = summary.consistencyScore;

  // Generate contextual commentary
  if (hours >= 100 && score >= 90) {
    return "This trader puts in the work while others sleep. Dedication like this doesn't go unnoticed by the market.";
  }
  if (hours >= 50 && consistency >= 80) {
    return "Consistency builds champions. This level of dedication separates the professionals from the dreamers.";
  }
  if (score >= 95) {
    return "Knowledge is power. With understanding this deep, the charts become a language they speak fluently.";
  }
  if (hours >= 20) {
    return "Building a foundation of knowledge, one lesson at a time. The journey of mastery has begun.";
  }
  if (consistency >= 70) {
    return "Showing up every day is half the battle. This trader understands that consistency beats intensity.";
  }
  return "Every expert was once a beginner. The commitment to learning shows in every hour logged.";
}

// ============================================
// VERIFICATION HASH
// ============================================

function generateVerificationHash(userName: string, totalTime: number): string {
  // Create a deterministic hash-like string
  const data = `${userName}-${totalTime}-KCU`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

// ============================================
// STUDY STATS CARD COMPONENT
// ============================================

export function StudyStatsCard({
  summary,
  userName,
  achievements = [],
}: StudyStatsCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copying, setCopying] = useState(false);

  // Calculate hours from seconds
  const hours = Math.floor(summary.totalTime / 3600);
  const minutes = Math.floor((summary.totalTime % 3600) / 60);

  // Get earned achievement badges
  const earnedBadges = useMemo(() => {
    const earned = achievements.map((a) => a.achievementSlug);
    return BADGE_DEFINITIONS.filter((b) => earned.includes(b.slug)).slice(0, 6);
  }, [achievements]);

  // Generate AI commentary
  const commentary = useMemo(() => generateAICommentary(summary), [summary]);

  // Generate verification hash
  const verificationHash = useMemo(
    () => generateVerificationHash(userName, summary.totalTime),
    [userName, summary.totalTime]
  );

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!cardRef.current) return;

    setCopying(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });

      // Create blob and copy to clipboard
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);

      // Show success feedback
      alert('Card copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy card. Please try downloading instead.');
    } finally {
      setCopying(false);
    }
  }, []);

  // Download as image
  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return;

    try {
      const dataUrl = await toJpeg(cardRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#0a0a0a',
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `kcu-study-stats-${userName.toLowerCase().replace(/\s/g, '-')}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download:', error);
      alert('Failed to download card. Please try again.');
    }
  }, [userName]);

  return (
    <div className="flex flex-col gap-4">
      {/* Card Preview */}
      <div
        ref={cardRef}
        className="relative mx-auto overflow-hidden rounded-xl"
        style={{
          width: '400px',
          height: '520px',
          background: 'linear-gradient(145deg, #0a0a0a 0%, #141414 50%, #0d0d0d 100%)',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Decorative Border */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            border: '2px solid #2a2520',
            borderRadius: '12px',
            boxShadow: 'inset 0 0 30px rgba(212, 175, 55, 0.05)',
          }}
        />

        {/* Gold Corner Accents */}
        <div
          className="absolute left-3 top-3 h-8 w-8"
          style={{
            borderLeft: '2px solid #d4af37',
            borderTop: '2px solid #d4af37',
          }}
        />
        <div
          className="absolute right-3 top-3 h-8 w-8"
          style={{
            borderRight: '2px solid #d4af37',
            borderTop: '2px solid #d4af37',
          }}
        />
        <div
          className="absolute bottom-3 left-3 h-8 w-8"
          style={{
            borderLeft: '2px solid #d4af37',
            borderBottom: '2px solid #d4af37',
          }}
        />
        <div
          className="absolute bottom-3 right-3 h-8 w-8"
          style={{
            borderRight: '2px solid #d4af37',
            borderBottom: '2px solid #d4af37',
          }}
        />

        {/* Header */}
        <div className="px-8 pt-8">
          <div className="flex items-center justify-between">
            <span
              className="text-xs uppercase tracking-[0.3em]"
              style={{ color: '#d4af37' }}
            >
              KCU Academy
            </span>
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: '#666' }}
            >
              Verified
            </span>
          </div>
          <div
            className="mt-1 h-px"
            style={{ background: 'linear-gradient(90deg, #d4af37 0%, transparent 100%)' }}
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center px-8 pt-8">
          {/* Big Hours Number */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center"
          >
            <span
              className="block text-7xl font-bold tracking-tight"
              style={{
                color: '#d4af37',
                textShadow: '0 0 60px rgba(212, 175, 55, 0.3)',
                fontFamily: 'Georgia, serif',
              }}
            >
              {hours}
            </span>
            <span
              className="block text-sm uppercase tracking-[0.4em]"
              style={{ color: '#8b8b8b' }}
            >
              Hours of Study
            </span>
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-center"
          >
            <span
              className="text-xl font-semibold italic"
              style={{ color: '#e0e0e0' }}
            >
              Market Prep Completed
            </span>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 flex w-full justify-center gap-8"
          >
            <div className="text-center">
              <span
                className="block text-2xl font-bold"
                style={{ color: '#d4af37' }}
              >
                {summary.lessonsCompleted}
              </span>
              <span className="text-xs uppercase" style={{ color: '#666' }}>
                Lessons
              </span>
            </div>
            <div
              className="w-px"
              style={{ background: '#333' }}
            />
            <div className="text-center">
              <span
                className="block text-2xl font-bold"
                style={{ color: '#d4af37' }}
              >
                {summary.averageQuizGrade}
              </span>
              <span className="text-xs uppercase" style={{ color: '#666' }}>
                Avg Grade
              </span>
            </div>
            <div
              className="w-px"
              style={{ background: '#333' }}
            />
            <div className="text-center">
              <span
                className="block text-2xl font-bold"
                style={{ color: '#d4af37' }}
              >
                {summary.consistencyScore}%
              </span>
              <span className="text-xs uppercase" style={{ color: '#666' }}>
                Consistency
              </span>
            </div>
          </motion.div>

          {/* Achievement Badges */}
          {earnedBadges.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-6 flex flex-wrap justify-center gap-2"
            >
              {earnedBadges.map((badge) => (
                <div
                  key={badge.slug}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1"
                  style={{
                    background: `${badge.color}20`,
                    border: `1px solid ${badge.color}40`,
                  }}
                >
                  <span style={{ color: badge.color }}>{badge.icon}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: badge.color }}
                  >
                    {badge.label}
                  </span>
                </div>
              ))}
            </motion.div>
          )}

          {/* AI Commentary */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 px-4 text-center"
          >
            <p
              className="text-sm italic leading-relaxed"
              style={{ color: '#9ca3af' }}
            >
              &ldquo;{commentary}&rdquo;
            </p>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-8 pb-6">
          <div
            className="h-px"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)' }}
          />
          <div className="mt-4 flex items-center justify-between">
            <div>
              <span
                className="block text-sm font-semibold"
                style={{ color: '#d4af37' }}
              >
                {userName}
              </span>
              <span
                className="block text-xs"
                style={{ color: '#666' }}
              >
                Verified KCU Trader
              </span>
            </div>
            <div className="text-right">
              <span
                className="block text-xs font-mono"
                style={{ color: '#444' }}
              >
                #{verificationHash}
              </span>
              <span
                className="block text-xs"
                style={{ color: '#444' }}
              >
                kcu.gg/verify
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          disabled={copying}
        >
          <Copy className="mr-2 h-4 w-4" />
          {copying ? 'Copying...' : 'Copy to Clipboard'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleDownload}
        >
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

// ============================================
// MODAL WRAPPER
// ============================================

export function StudyStatsCardModal({
  isOpen,
  onClose,
  summary,
  userName,
  achievements,
}: StudyStatsCardModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative mx-4 max-h-[90vh] overflow-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Share Your Study Stats
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Show off your dedication with a verified KCU study card
            </p>
          </div>

          {/* Card */}
          <StudyStatsCard
            summary={summary}
            userName={userName}
            achievements={achievements}
          />

          {/* Share Options */}
          <div className="mt-6 border-t border-[var(--border-primary)] pt-4">
            <p className="mb-2 text-center text-xs text-[var(--text-tertiary)]">
              Share to inspire others in your trading journey
            </p>
            <div className="flex justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const text = `Just logged ${Math.floor(summary.totalTime / 3600)} hours of study at @KCU_Trading! The grind never stops. #DayTrading #StudyGrind`;
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
                    '_blank'
                  );
                }}
              >
                Share on Twitter/X
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default StudyStatsCard;
