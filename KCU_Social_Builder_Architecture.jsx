import React from 'react';

const SocialBuilderArchitecture = () => {
  const colors = {
    primary: '#F59E0B',
    secondary: '#1E293B',
    accent: '#3B82F6',
    success: '#22C55E',
    instagram: '#E4405F',
    tiktok: '#000000',
    youtube: '#FF0000',
    bg: '#0F172A',
    card: '#1E293B',
    border: '#334155',
    text: '#F1F5F9',
    textMuted: '#94A3B8'
  };

  return (
    <div className="p-8 min-h-screen" style={{ backgroundColor: colors.bg }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2" style={{ color: colors.primary }}>
            KCU Social Builder
          </h1>
          <p className="text-xl" style={{ color: colors.textMuted }}>
            System Architecture Overview
          </p>
        </div>

        {/* Main Architecture Diagram */}
        <div className="relative">
          {/* Top Row - External Platforms */}
          <div className="flex justify-center gap-6 mb-8">
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-xl flex items-center justify-center shadow-lg"
                   style={{ backgroundColor: colors.instagram, border: `2px solid ${colors.border}` }}>
                <span className="text-white text-3xl">📷</span>
              </div>
              <span className="mt-2 text-sm font-medium" style={{ color: colors.text }}>Instagram</span>
              <span className="text-xs" style={{ color: colors.textMuted }}>Graph API</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-xl flex items-center justify-center shadow-lg"
                   style={{ backgroundColor: colors.tiktok, border: `2px solid ${colors.border}` }}>
                <span className="text-white text-3xl">🎵</span>
              </div>
              <span className="mt-2 text-sm font-medium" style={{ color: colors.text }}>TikTok</span>
              <span className="text-xs" style={{ color: colors.textMuted }}>Business API</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-xl flex items-center justify-center shadow-lg"
                   style={{ backgroundColor: colors.youtube, border: `2px solid ${colors.border}` }}>
                <span className="text-white text-3xl">▶️</span>
              </div>
              <span className="mt-2 text-sm font-medium" style={{ color: colors.text }}>YouTube</span>
              <span className="text-xs" style={{ color: colors.textMuted }}>Data API v3</span>
            </div>
          </div>

          {/* Connection Lines */}
          <div className="flex justify-center mb-4">
            <svg width="400" height="40">
              <path d="M 80 0 L 80 20 L 200 20 L 200 40" stroke={colors.primary} strokeWidth="2" fill="none" />
              <path d="M 200 0 L 200 40" stroke={colors.primary} strokeWidth="2" fill="none" />
              <path d="M 320 0 L 320 20 L 200 20 L 200 40" stroke={colors.primary} strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* Integration Layer */}
          <div className="flex justify-center mb-8">
            <div className="px-8 py-4 rounded-xl text-center shadow-lg"
                 style={{ backgroundColor: colors.card, border: `2px solid ${colors.primary}` }}>
              <span className="text-lg font-bold" style={{ color: colors.primary }}>
                Social Platform Integration Layer
              </span>
              <p className="text-sm mt-1" style={{ color: colors.textMuted }}>
                OAuth, Rate Limiting, Media Processing
              </p>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center mb-4">
            <svg width="40" height="40">
              <path d="M 20 0 L 20 30 M 10 20 L 20 30 L 30 20" stroke={colors.primary} strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* Main System Box */}
          <div className="rounded-2xl p-6 mb-8" style={{ backgroundColor: colors.card, border: `2px solid ${colors.border}` }}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold" style={{ color: colors.primary }}>KCU Social Builder Core</h2>
            </div>

            {/* Core Components Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* Content Intelligence */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🧠</span>
                  <h3 className="font-bold" style={{ color: colors.text }}>Content Intelligence</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: colors.textMuted }}>
                  <li>• Trending Topics Analysis</li>
                  <li>• Influencer Monitoring</li>
                  <li>• Sentiment Analysis</li>
                  <li>• Market News Processing</li>
                </ul>
              </div>

              {/* AI Content Engine */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.accent}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🤖</span>
                  <h3 className="font-bold" style={{ color: colors.text }}>AI Content Engine</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: colors.textMuted }}>
                  <li>• Claude AI Generation</li>
                  <li>• Caption Optimization</li>
                  <li>• Hook/CTA Creation</li>
                  <li>• Tone Analysis</li>
                </ul>
              </div>

              {/* Analytics Dashboard */}
              <div className="p-4 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📊</span>
                  <h3 className="font-bold" style={{ color: colors.text }}>Analytics Dashboard</h3>
                </div>
                <ul className="space-y-2 text-sm" style={{ color: colors.textMuted }}>
                  <li>• Cross-Platform Metrics</li>
                  <li>• Engagement Tracking</li>
                  <li>• Performance Insights</li>
                  <li>• Growth Analytics</li>
                </ul>
              </div>
            </div>

            {/* Content Calendar */}
            <div className="p-4 rounded-xl" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.success}` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📅</span>
                  <h3 className="font-bold" style={{ color: colors.text }}>Content Calendar & Scheduling</h3>
                </div>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: colors.instagram, color: 'white' }}>IG</span>
                  <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: colors.tiktok, color: 'white' }}>TT</span>
                  <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: colors.youtube, color: 'white' }}>YT</span>
                </div>
              </div>
            </div>
          </div>

          {/* Arrow Down */}
          <div className="flex justify-center mb-4">
            <svg width="40" height="40">
              <path d="M 20 0 L 20 30 M 10 20 L 20 30 L 30 20" stroke={colors.primary} strokeWidth="2" fill="none" />
            </svg>
          </div>

          {/* Data Sources */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="text-center">
              <h3 className="font-bold mb-4" style={{ color: colors.textMuted }}>Internal Data Sources</h3>
              <div className="flex gap-4">
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                  <span className="text-2xl">🏆</span>
                  <p className="text-sm mt-2" style={{ color: colors.text }}>Win Cards</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>Member Victories</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                  <span className="text-2xl">🔥</span>
                  <p className="text-sm mt-2" style={{ color: colors.text }}>Streaks</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>Consistency</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                  <span className="text-2xl">📚</span>
                  <p className="text-sm mt-2" style={{ color: colors.text }}>Curriculum</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>LTP Framework</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                  <span className="text-2xl">📈</span>
                  <p className="text-sm mt-2" style={{ color: colors.text }}>Trade Stats</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>Analytics</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                  <span className="text-2xl">👥</span>
                  <p className="text-sm mt-2" style={{ color: colors.text }}>Community</p>
                  <p className="text-xs" style={{ color: colors.textMuted }}>Leaderboard</p>
                </div>
              </div>
            </div>
          </div>

          {/* External Data */}
          <div className="flex justify-center gap-4">
            <div className="text-center">
              <h3 className="font-bold mb-4" style={{ color: colors.textMuted }}>External Data Feeds</h3>
              <div className="flex gap-4">
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.accent}` }}>
                  <span className="text-xl">💹</span>
                  <p className="text-xs mt-1" style={{ color: colors.text }}>Market Data</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.accent}` }}>
                  <span className="text-xl">📰</span>
                  <p className="text-xs mt-1" style={{ color: colors.text }}>Financial News</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.accent}` }}>
                  <span className="text-xl">📅</span>
                  <p className="text-xs mt-1" style={{ color: colors.text }}>Earnings Calendar</p>
                </div>
                <div className="p-3 rounded-lg text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.accent}` }}>
                  <span className="text-xl">🌐</span>
                  <p className="text-xs mt-1" style={{ color: colors.text }}>Economic Events</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-12 p-4 rounded-xl" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
          <h3 className="font-bold mb-3" style={{ color: colors.text }}>Content Flow</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.instagram }}></div>
              <span style={{ color: colors.textMuted }}>Instagram Posts (Feed, Reels, Stories)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.tiktok }}></div>
              <span style={{ color: colors.textMuted }}>TikTok Videos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.youtube }}></div>
              <span style={{ color: colors.textMuted }}>YouTube Videos & Shorts</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: colors.primary }}></div>
              <span style={{ color: colors.textMuted }}>AI-Generated Suggestions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SocialBuilderArchitecture;
