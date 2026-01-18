'use client';

import { useState, useEffect } from 'react';
import {
  Instagram,
  Youtube,
  Users,
  TrendingUp,
  Sparkles,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Zap,
  Target,
  MessageSquare,
  Hash,
} from 'lucide-react';

// TikTok icon component (not in lucide)
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
  </svg>
);

interface DashboardStats {
  total_followers: number;
  followers_change_7d: number;
  total_posts_30d: number;
  average_engagement_rate: number;
  pending_suggestions: number;
  scheduled_posts: number;
  tracked_influencers: number;
  trending_topics: number;
}

interface ContentSuggestion {
  id: string;
  suggested_caption: string;
  suggested_hook: string;
  platforms: string[];
  category: string;
  predicted_engagement_score: number;
  kcu_tone_match_score: number;
  created_at: string;
  status: string;
}

interface TrendingTopic {
  id: string;
  topic: string;
  category: string;
  trend_score: number;
  velocity: string;
}

export default function SocialBuilderPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'suggestions' | 'influencers' | 'trending'>('overview');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const [suggestionsRes, influencersRes] = await Promise.all([
        fetch('/api/admin/social/suggestions?status=pending&limit=5'),
        fetch('/api/admin/social/influencers?limit=1'),
      ]);

      const suggestionsData = await suggestionsRes.json();
      const influencersData = await influencersRes.json();

      setSuggestions(suggestionsData.data || []);

      setStats({
        total_followers: 0, // Would come from connected accounts
        followers_change_7d: 0,
        total_posts_30d: 0,
        average_engagement_rate: 0,
        pending_suggestions: suggestionsData.total || 0,
        scheduled_posts: 0,
        tracked_influencers: influencersData.total || 0,
        trending_topics: 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateContent = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: ['instagram', 'tiktok'],
          count: 5,
          include_trending: true,
          include_influencer_posts: true,
          include_kcu_data: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Error generating content:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSuggestionAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      await fetch('/api/admin/social/suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      fetchDashboardData();
    } catch (error) {
      console.error('Error updating suggestion:', error);
    }
  };

  const platformColors = {
    instagram: 'bg-gradient-to-r from-purple-500 to-pink-500',
    tiktok: 'bg-black',
    youtube: 'bg-red-600',
  };

  const categoryColors: Record<string, string> = {
    educational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    community: 'bg-green-500/20 text-green-400 border-green-500/30',
    market_commentary: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    promotional: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    motivation: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              KCU Social Builder
            </h1>
            <p className="text-slate-400 mt-1">
              AI-powered social media management for day trading content
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateContent}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
            >
              {generating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Generate Content
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
            { id: 'influencers', label: 'Influencers', icon: Users },
            { id: 'trending', label: 'Trending', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Pending Suggestions</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.pending_suggestions || 0}
              </p>
            </div>
            <div className="p-3 bg-amber-500/20 rounded-lg">
              <Sparkles className="w-6 h-6 text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Tracked Influencers</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.tracked_influencers || 0}
              </p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Scheduled Posts</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.scheduled_posts || 0}
              </p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <Calendar className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Trending Topics</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.trending_topics || 0}
              </p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Platform Connections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 ${platformColors.instagram} rounded-lg`}>
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">Instagram</h3>
              <p className="text-slate-400 text-sm">Not connected</p>
            </div>
          </div>
          <button className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all text-sm">
            Connect Account
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 ${platformColors.tiktok} rounded-lg`}>
              <TikTokIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">TikTok</h3>
              <p className="text-slate-400 text-sm">Not connected</p>
            </div>
          </div>
          <button className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all text-sm">
            Connect Account
          </button>
        </div>

        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 ${platformColors.youtube} rounded-lg`}>
              <Youtube className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-medium">YouTube</h3>
              <p className="text-slate-400 text-sm">Not connected</p>
            </div>
          </div>
          <button className="w-full py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-all text-sm">
            Connect Account
          </button>
        </div>
      </div>

      {/* Content Suggestions */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8">
        <div className="p-5 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            AI Content Suggestions
          </h2>
          <button
            onClick={() => setActiveTab('suggestions')}
            className="text-amber-400 text-sm hover:text-amber-300 transition-colors"
          >
            View All
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading suggestions...
          </div>
        ) : suggestions.length === 0 ? (
          <div className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No pending suggestions</p>
            <button
              onClick={generateContent}
              disabled={generating}
              className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all text-sm"
            >
              Generate New Content
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {suggestions.slice(0, 5).map((suggestion) => (
              <div key={suggestion.id} className="p-5 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Platform badges */}
                    <div className="flex items-center gap-2 mb-2">
                      {suggestion.platforms.map((platform) => (
                        <span
                          key={platform}
                          className={`px-2 py-0.5 rounded text-xs text-white ${
                            platform === 'instagram'
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                              : platform === 'tiktok'
                                ? 'bg-black'
                                : 'bg-red-600'
                          }`}
                        >
                          {platform}
                        </span>
                      ))}
                      {suggestion.category && (
                        <span
                          className={`px-2 py-0.5 rounded text-xs border ${
                            categoryColors[suggestion.category] || 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {suggestion.category}
                        </span>
                      )}
                    </div>

                    {/* Hook */}
                    {suggestion.suggested_hook && (
                      <p className="text-amber-400 text-sm mb-1 font-medium">
                        {suggestion.suggested_hook}
                      </p>
                    )}

                    {/* Caption preview */}
                    <p className="text-slate-300 text-sm line-clamp-2">
                      {suggestion.suggested_caption}
                    </p>

                    {/* Scores */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Target className="w-3 h-3" />
                        <span>Engagement: {suggestion.predicted_engagement_score}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <MessageSquare className="w-3 h-3" />
                        <span>Tone Match: {suggestion.kcu_tone_match_score}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleSuggestionAction(suggestion.id, 'approve')}
                      className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors"
                      title="Approve"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSuggestionAction(suggestion.id, 'reject')}
                      className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Reject"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 hover:text-white transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-all text-left group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
              <Plus className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-white font-medium">Add Influencer</h3>
          </div>
          <p className="text-slate-400 text-sm">Track a new day trading influencer</p>
        </button>

        <button className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-all text-left group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors">
              <RefreshCw className="w-5 h-5 text-green-400" />
            </div>
            <h3 className="text-white font-medium">Scrape All</h3>
          </div>
          <p className="text-slate-400 text-sm">Update all influencer content</p>
        </button>

        <button className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-all text-left group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-white font-medium">Content Calendar</h3>
          </div>
          <p className="text-slate-400 text-sm">View and schedule posts</p>
        </button>

        <button className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-amber-500/50 transition-all text-left group">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors">
              <BarChart3 className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-white font-medium">Analytics</h3>
          </div>
          <p className="text-slate-400 text-sm">View performance metrics</p>
        </button>
      </div>
    </div>
  );
}
