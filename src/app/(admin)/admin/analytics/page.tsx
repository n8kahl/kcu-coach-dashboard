'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { BarChart3, Users, TrendingUp, BookOpen, Activity, Loader2 } from 'lucide-react';

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalTrades: number;
  averageWinRate: number;
  completedLessons: number;
  practiceAttempts: number;
}

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    // Simulate loading - in a real implementation, fetch from API
    const timer = setTimeout(() => {
      setData({
        totalUsers: 0,
        activeUsers: 0,
        totalTrades: 0,
        averageWinRate: 0,
        completedLessons: 0,
        practiceAttempts: 0,
      });
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Users', value: data?.totalUsers ?? 0, icon: Users, color: 'text-blue-500' },
    { label: 'Active Users (30d)', value: data?.activeUsers ?? 0, icon: Activity, color: 'text-green-500' },
    { label: 'Total Trades', value: data?.totalTrades ?? 0, icon: TrendingUp, color: 'text-purple-500' },
    { label: 'Avg Win Rate', value: `${(data?.averageWinRate ?? 0).toFixed(1)}%`, icon: BarChart3, color: 'text-yellow-500' },
    { label: 'Completed Lessons', value: data?.completedLessons ?? 0, icon: BookOpen, color: 'text-cyan-500' },
    { label: 'Practice Attempts', value: data?.practiceAttempts ?? 0, icon: Activity, color: 'text-orange-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
        <p className="text-[var(--text-tertiary)]">Platform usage and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[var(--text-tertiary)]">{stat.label}</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Coming Soon" />
        <CardContent>
          <p className="text-[var(--text-secondary)]">
            Detailed analytics including user engagement charts, trading performance trends,
            and learning progress metrics will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
