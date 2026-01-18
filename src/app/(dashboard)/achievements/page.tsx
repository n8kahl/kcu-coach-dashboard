'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AchievementsGrid, achievementDefinitions } from '@/components/dashboard/achievements';
import { Loader2 } from 'lucide-react';
import type { Achievement } from '@/types';

// Generate default achievements from definitions (used as fallback)
function generateDefaultAchievements(): Achievement[] {
  return Object.entries(achievementDefinitions).map(([typeKey, def]) => ({
    id: typeKey,
    slug: def.slug || typeKey,
    title: def.title || def.name || typeKey,
    description: def.description || '',
    icon: def.icon || def.emoji || '🏆',
    category: def.category || 'milestone',
    requirement: {
      type: typeKey,
      target: def.target ?? 100,
      current: 0,
    },
    xp_reward: def.xp_reward || 50,
    unlocked: false,
    unlocked_at: undefined,
    name: def.name || def.title,
    emoji: def.emoji || def.icon,
    earned_at: undefined,
    progress: 0,
    target: 100,
  }));
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAchievements() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch('/api/achievements');

        if (!res.ok) {
          // If not authenticated, use default achievements
          if (res.status === 401) {
            setAchievements(generateDefaultAchievements());
            return;
          }
          throw new Error('Failed to fetch achievements');
        }

        const data = await res.json();
        const fetchedAchievements = data.achievements || [];

        // If API returns achievements, use them; otherwise use defaults
        if (fetchedAchievements.length > 0) {
          // Ensure all required fields are present
          const processedAchievements: Achievement[] = fetchedAchievements.map((a: Partial<Achievement>) => ({
            id: a.id || a.slug || 'unknown',
            slug: a.slug || a.id || 'unknown',
            title: a.title || a.name || 'Unknown Achievement',
            description: a.description || '',
            icon: a.icon || a.emoji || '🏆',
            category: a.category || 'milestone',
            requirement: a.requirement || { type: 'unknown', target: 100, current: 0 },
            xp_reward: a.xp_reward || 50,
            unlocked: a.unlocked || !!a.unlocked_at,
            unlocked_at: a.unlocked_at || a.earned_at,
            name: a.name || a.title,
            emoji: a.emoji || a.icon,
            earned_at: a.earned_at || a.unlocked_at,
            progress: a.progress ?? a.requirement?.current ?? 0,
            target: a.target ?? a.requirement?.target ?? 100,
          }));
          setAchievements(processedAchievements);
        } else {
          setAchievements(generateDefaultAchievements());
        }
      } catch (err) {
        console.error('Error fetching achievements:', err);
        setError(err instanceof Error ? err.message : 'Failed to load achievements');
        // Use default achievements on error
        setAchievements(generateDefaultAchievements());
      } finally {
        setLoading(false);
      }
    }

    fetchAchievements();
  }, []);

  // Loading state
  if (loading) {
    return (
      <>
        <Header
          title="Achievements"
          subtitle="Track your milestones and badges"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Achievements' }]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading achievements...</span>
          </div>
        </PageShell>
      </>
    );
  }

  // Error state (but still show achievements with fallback data)
  if (error) {
    console.warn('Achievements loaded with fallback data due to error:', error);
  }

  return (
    <>
      <Header
        title="Achievements"
        subtitle="Track your milestones and badges"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Achievements' }]}
      />

      <PageShell>
        <AchievementsGrid achievements={achievements} />
      </PageShell>
    </>
  );
}
