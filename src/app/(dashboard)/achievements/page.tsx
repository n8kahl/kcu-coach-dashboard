'use client';

import { Header } from '@/components/layout/header';
import { PageShell } from '@/components/layout/page-shell';
import { AchievementsGrid, achievementDefinitions } from '@/components/dashboard/achievements';
import type { Achievement } from '@/types';

// Generate achievements from definitions
const mockAchievements: Achievement[] = Object.entries(achievementDefinitions).map(
  ([typeKey, def], index) => ({
    id: typeKey,
    ...def,
    // Mark some as earned for demo
    earned_at: index < 5 ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    // Add progress for locked ones
    progress: index >= 5 ? Math.floor(Math.random() * 80) : undefined,
    target: index >= 5 ? 100 : undefined,
  })
);

export default function AchievementsPage() {
  return (
    <>
      <Header
        title="Achievements"
        subtitle="Track your milestones and badges"
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Achievements' }]}
      />

      <PageShell>
        <AchievementsGrid achievements={mockAchievements} />
      </PageShell>
    </>
  );
}
