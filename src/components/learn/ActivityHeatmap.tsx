'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import type { DailyActivity } from '@/types/learning';

interface ActivityHeatmapProps {
  activities: DailyActivity[];
  weeks?: number;
  className?: string;
}

export function ActivityHeatmap({ activities, weeks = 12, className = '' }: ActivityHeatmapProps) {
  const { grid, stats, maxScore } = useMemo(() => {
    const activityMap = new Map<string, DailyActivity>();
    activities.forEach(a => activityMap.set(a.activityDate, a));

    // Generate grid data for the last N weeks
    const today = new Date();
    const gridData: { date: Date; activity: DailyActivity | null }[][] = [];
    let maxEngagement = 0;

    // Start from the first day of the week, N weeks ago
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) - startDate.getDay());

    for (let week = 0; week < weeks; week++) {
      const weekData: { date: Date; activity: DailyActivity | null }[] = [];
      for (let day = 0; day < 7; day++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + (week * 7) + day);

        const dateStr = date.toISOString().split('T')[0];
        const activity = activityMap.get(dateStr) || null;

        if (activity && activity.engagementScore > maxEngagement) {
          maxEngagement = activity.engagementScore;
        }

        weekData.push({ date, activity });
      }
      gridData.push(weekData);
    }

    // Calculate stats
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    let thisWeekTime = 0;
    let thisWeekLessons = 0;
    let totalDaysActive = 0;

    activities.forEach(a => {
      const actDate = new Date(a.activityDate);
      if (actDate >= thisWeekStart) {
        thisWeekTime += a.watchTimeSeconds;
        thisWeekLessons += a.lessonsCompleted;
      }
      if (a.watchTimeSeconds > 0 || a.lessonsCompleted > 0) {
        totalDaysActive++;
      }
    });

    return {
      grid: gridData,
      stats: {
        thisWeekHours: Math.round(thisWeekTime / 3600 * 10) / 10,
        thisWeekLessons,
        totalDaysActive,
        avgPerDay: activities.length > 0
          ? Math.round(activities.reduce((s, a) => s + a.watchTimeSeconds, 0) / activities.length / 60)
          : 0,
      },
      maxScore: maxEngagement || 100,
    };
  }, [activities, weeks]);

  const getIntensityColor = (activity: DailyActivity | null, isFuture: boolean) => {
    if (isFuture) return 'var(--bg-tertiary)';
    if (!activity || activity.engagementScore === 0) return 'var(--bg-secondary)';

    const intensity = Math.min(activity.engagementScore / maxScore, 1);

    if (intensity < 0.25) return 'rgba(34, 197, 94, 0.25)';
    if (intensity < 0.5) return 'rgba(34, 197, 94, 0.5)';
    if (intensity < 0.75) return 'rgba(34, 197, 94, 0.75)';
    return 'rgba(34, 197, 94, 1)';
  };

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Activity</span>
          <div className="flex items-center gap-4 text-sm font-normal">
            <span className="text-[var(--text-tertiary)]">
              {stats.thisWeekHours}h this week
            </span>
            <span className="text-[var(--text-tertiary)]">
              {stats.thisWeekLessons} lessons
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {/* Day labels */}
          <div className="flex flex-col gap-1 text-xs text-[var(--text-tertiary)] pt-6">
            {dayLabels.map((day, i) => (
              <div key={day} className="h-3 flex items-center" style={{ display: i % 2 === 1 ? 'flex' : 'none' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-1">
              {grid.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-1">
                  {week.map((day, dayIndex) => {
                    const isFuture = day.date > today;
                    const isToday = day.date.toDateString() === today.toDateString();

                    return (
                      <motion.div
                        key={`${weekIndex}-${dayIndex}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: (weekIndex * 7 + dayIndex) * 0.002 }}
                        className={`w-3 h-3 rounded-sm cursor-pointer transition-transform hover:scale-125 ${isToday ? 'ring-1 ring-[var(--accent-primary)]' : ''}`}
                        style={{ backgroundColor: getIntensityColor(day.activity, isFuture) }}
                        title={
                          day.activity
                            ? `${day.date.toLocaleDateString()}: ${day.activity.lessonsCompleted} lessons, ${Math.round(day.activity.watchTimeSeconds / 60)}min`
                            : day.date.toLocaleDateString()
                        }
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-xs text-[var(--text-tertiary)]">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--bg-secondary)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.25)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.5)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 0.75)' }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgba(34, 197, 94, 1)' }} />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-[var(--border-primary)]">
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalDaysActive}</p>
            <p className="text-xs text-[var(--text-tertiary)]">Days Active</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.avgPerDay}m</p>
            <p className="text-xs text-[var(--text-tertiary)]">Avg/Day</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.thisWeekLessons}</p>
            <p className="text-xs text-[var(--text-tertiary)]">This Week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
