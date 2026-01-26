'use client';

// Force dynamic rendering to prevent navigation caching issues
export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube,
  Search,
  Play,
  ExternalLink,
  Clock,
  Filter,
  X,
  Loader2,
  AlertCircle,
  TrendingUp,
  Brain,
  Target,
  Activity,
  BookOpen,
  Shield,
  Calendar,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  description: string | null;
  published_at: string;
  thumbnail_url: string;
  channel_title: string;
  category: string | null;
  topics: string[] | null;
  ltp_relevance: number | null;
  transcript_status: string;
  view_count: number | null;
}

interface CategoryCount {
  category: string;
  count: number;
}

// Category icon mapping
const categoryIcons: Record<string, React.ElementType> = {
  'LTP Framework': Target,
  'Price Action': TrendingUp,
  Psychology: Brain,
  'Risk Management': Shield,
  Indicators: Activity,
  Strategies: BookOpen,
  'Live Trading': Play,
  Education: BookOpen,
  'Trade Review': Activity,
  General: Youtube,
};

// Category colors
const categoryColors: Record<string, string> = {
  'LTP Framework': '#F59E0B',
  'Price Action': '#10B981',
  Psychology: '#8B5CF6',
  'Risk Management': '#EF4444',
  Indicators: '#3B82F6',
  Strategies: '#EC4899',
  'Live Trading': '#06B6D4',
  Education: '#84CC16',
  'Trade Review': '#F97316',
  General: '#6B7280',
};

// ============================================
// Video Card Component
// ============================================

function VideoCard({ video, onPlay }: { video: YouTubeVideo; onPlay: (video: YouTubeVideo) => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const CategoryIcon = categoryIcons[video.category || 'General'] || Youtube;
  const categoryColor = categoryColors[video.category || 'General'] || '#6B7280';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePlayClick = () => {
    onPlay(video);
  };

  const handleYouTubeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
    >
      <Card
        hoverable
        className="overflow-hidden cursor-pointer group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handlePlayClick}
      >
        {/* Thumbnail */}
        <div className="relative aspect-video bg-[var(--bg-tertiary)] overflow-hidden">
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Youtube className="w-12 h-12 text-[var(--text-tertiary)]" />
            </div>
          )}

          {/* Play Overlay */}
          <div
            className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: isHovered ? 1 : 0.8 }}
              className="w-16 h-16 rounded-full bg-[var(--accent-primary)] flex items-center justify-center shadow-lg"
            >
              <Play className="w-8 h-8 text-black ml-1" fill="currentColor" />
            </motion.div>
          </div>

          {/* Category Badge */}
          {video.category && (
            <div className="absolute top-2 left-2">
              <Badge
                variant="default"
                size="sm"
                className="backdrop-blur-sm"
                style={{ backgroundColor: `${categoryColor}20`, borderColor: categoryColor }}
              >
                <CategoryIcon className="w-3 h-3 mr-1" style={{ color: categoryColor }} />
                <span style={{ color: categoryColor }}>{video.category}</span>
              </Badge>
            </div>
          )}

          {/* LTP Relevance */}
          {video.ltp_relevance && video.ltp_relevance > 0.5 && (
            <div className="absolute top-2 right-2">
              <Badge variant="gold" size="sm">
                LTP {Math.round(video.ltp_relevance * 100)}%
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <CardContent className="p-4">
          <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2 mb-2 group-hover:text-[var(--accent-primary)] transition-colors">
            {video.title}
          </h3>

          {video.description && (
            <p className="text-sm text-[var(--text-tertiary)] line-clamp-2 mb-3">
              {video.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(video.published_at)}</span>
            </div>

            <div className="flex items-center gap-2">
              {video.transcript_status === 'completed' && (
                <Badge variant="success" size="sm">
                  Transcript
                </Badge>
              )}
              <button
                onClick={handleYouTubeClick}
                className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                title="Open on YouTube"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Topics */}
          {video.topics && video.topics.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {video.topics.slice(0, 3).map((topic, i) => (
                <Badge key={i} variant="default" size="sm" className="text-xs">
                  {topic}
                </Badge>
              ))}
              {video.topics.length > 3 && (
                <Badge variant="default" size="sm" className="text-xs">
                  +{video.topics.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// Video Modal Component
// ============================================

function VideoModal({
  video,
  onClose,
}: {
  video: YouTubeVideo | null;
  onClose: () => void;
}) {
  if (!video) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-5xl bg-[var(--bg-primary)] rounded-xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Video Embed */}
          <div className="aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${video.video_id}?autoplay=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          {/* Video Info */}
          <div className="p-4 border-t border-[var(--border-primary)]">
            <h3 className="font-semibold text-lg text-[var(--text-primary)] mb-2">
              {video.title}
            </h3>
            {video.description && (
              <p className="text-sm text-[var(--text-secondary)] line-clamp-3">
                {video.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {video.category && (
                <Badge variant="default">{video.category}</Badge>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(`https://www.youtube.com/watch?v=${video.video_id}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open on YouTube
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================
// Main Resources Page
// ============================================

export default function ResourcesPage() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [totalVideos, setTotalVideos] = useState(0);

  // Fetch videos
  const fetchVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: '100',
        sortBy: 'published_at',
        sortOrder: 'desc',
      });

      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }

      const response = await fetch(`/api/youtube/videos?${params}`);

      if (!response.ok) {
        if (response.status === 401) {
          setError('Please log in to view resources');
          return;
        }
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.videos || []);
      setTotalVideos(data.total || 0);
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load video resources. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  // Filter videos by search
  const filteredVideos = videos.filter((video) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      video.title.toLowerCase().includes(query) ||
      video.description?.toLowerCase().includes(query) ||
      video.topics?.some((t) => t.toLowerCase().includes(query))
    );
  });

  // Loading state
  if (loading) {
    return (
      <>
        <Header
          title="Video Resources"
          subtitle="Kay Capitals YouTube library"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Resources' }]}
        />
        <PageShell>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            <span className="ml-3 text-[var(--text-secondary)]">Loading videos...</span>
          </div>
        </PageShell>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Header
          title="Video Resources"
          subtitle="Kay Capitals YouTube library"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Resources' }]}
        />
        <PageShell>
          <Card className="border-[var(--error)] bg-[var(--error)]/10">
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="w-12 h-12 text-[var(--error)]" />
                <div>
                  <p className="font-medium text-[var(--text-primary)]">{error}</p>
                  <p className="text-sm text-[var(--text-tertiary)] mt-1">
                    Make sure YouTube API is configured and synced by an admin.
                  </p>
                </div>
                <Button variant="secondary" onClick={fetchVideos}>
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  // Empty state
  if (videos.length === 0 && !searchQuery) {
    return (
      <>
        <Header
          title="Video Resources"
          subtitle="Kay Capitals YouTube library"
          breadcrumbs={[{ label: 'Dashboard' }, { label: 'Resources' }]}
        />
        <PageShell>
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-4 text-center">
                <Youtube className="w-16 h-16 text-[var(--text-tertiary)]" />
                <div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                    No Videos Available
                  </h3>
                  <p className="text-[var(--text-secondary)]">
                    Video resources haven't been synced yet. An admin needs to sync the Kay Capitals
                    YouTube channel from Admin → Knowledge CMS.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <Header
        title="Video Resources"
        subtitle={`${totalVideos} videos from Kay Capitals YouTube`}
        breadcrumbs={[{ label: 'Dashboard' }, { label: 'Resources' }]}
        actions={
          <Badge variant="default" className="flex items-center gap-1">
            <Youtube className="w-3.5 h-3.5 text-red-500" />
            YouTube Library
          </Badge>
        }
      />

      <PageShell>
        <div className="space-y-6">
          {/* Search and Filters */}
          <PageSection>
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <Input
                  placeholder="Search videos by title, topic, or keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  rightIcon={
                    searchQuery ? (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="p-1 hover:bg-[var(--bg-tertiary)] rounded"
                      >
                        <X className="w-4 h-4 text-[var(--text-tertiary)]" />
                      </button>
                    ) : null
                  }
                />
              </div>

              {/* Results count */}
              <div className="flex items-center text-sm text-[var(--text-tertiary)]">
                <Filter className="w-4 h-4 mr-2" />
                {filteredVideos.length} video{filteredVideos.length !== 1 ? 's' : ''}
              </div>
            </div>
          </PageSection>

          {/* Category Tabs */}
          <PageSection>
            <Tabs
              defaultValue="all"
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <TabsList variant="pills" className="flex-wrap">
                <TabsTrigger value="all" variant="pills">
                  All Videos
                </TabsTrigger>
                {categories
                  .sort((a, b) => b.count - a.count)
                  .map((cat) => {
                    const Icon = categoryIcons[cat.category] || Youtube;
                    return (
                      <TabsTrigger key={cat.category} value={cat.category} variant="pills">
                        <Icon className="w-4 h-4 mr-1.5" />
                        {cat.category}
                        <Badge variant="default" size="sm" className="ml-1.5">
                          {cat.count}
                        </Badge>
                      </TabsTrigger>
                    );
                  })}
              </TabsList>
            </Tabs>
          </PageSection>

          {/* Video Grid */}
          <PageSection>
            {filteredVideos.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      onPlay={setSelectedVideo}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <Search className="w-12 h-12 text-[var(--text-tertiary)]" />
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                        No matching videos
                      </h3>
                      <p className="text-[var(--text-secondary)]">
                        Try adjusting your search or category filter.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                      }}
                    >
                      Clear Filters
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </PageSection>
        </div>
      </PageShell>

      {/* Video Modal */}
      <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />
    </>
  );
}
