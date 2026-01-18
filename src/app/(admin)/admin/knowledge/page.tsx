'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { PageShell, PageSection } from '@/components/layout/page-shell';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Stat, StatGrid } from '@/components/ui/stat';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/utils';
import {
  Database,
  FileText,
  Youtube,
  Play,
  RefreshCw,
  Trash2,
  Plus,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Brain,
} from 'lucide-react';

interface KnowledgeStats {
  embeddingsConfigured: boolean;
  ragAvailable: boolean;
  totalChunks: number;
  totalSources: number;
  videoStats: {
    total: number;
    pending: number;
    processing: number;
    complete: number;
    failed: number;
  };
}

interface KnowledgeSource {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  url?: string;
  status: string;
  chunk_count: number;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

interface YouTubeVideo {
  id: string;
  video_id: string;
  title: string;
  topics?: string[];
  transcript_status: string;
  chunk_count: number;
  created_at: string;
}

export default function KnowledgePage() {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [addingVideo, setAddingVideo] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch stats
      const statsRes = await fetch('/api/admin/knowledge?action=stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch sources and videos
      const dataRes = await fetch('/api/admin/knowledge');
      if (dataRes.ok) {
        const data = await dataRes.json();
        setSources(data.sources || []);
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('Error fetching knowledge data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProcessPending = async () => {
    setProcessing(true);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'process_pending', limit: 5 }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Processed ${result.successful} of ${result.totalProcessed} videos`);
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error processing pending:', error);
      alert('Failed to process videos');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddVideo = async () => {
    if (!newVideoUrl.trim()) return;

    setAddingVideo(true);
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_video', videoUrl: newVideoUrl }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`Video added: ${result.videoId}`);
        setNewVideoUrl('');
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error adding video:', error);
      alert('Failed to add video');
    } finally {
      setAddingVideo(false);
    }
  };

  const handleReprocessVideo = async (videoId: string) => {
    try {
      const res = await fetch('/api/admin/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reprocess_video', videoId }),
      });

      const result = await res.json();
      if (result.success) {
        alert(`Reprocessed: ${result.chunkCount} chunks created`);
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error reprocessing:', error);
      alert('Failed to reprocess video');
    }
  };

  const handleDeleteSource = async (sourceType: string, sourceId: string) => {
    if (!confirm('Are you sure you want to delete this knowledge source?')) return;

    try {
      const res = await fetch(
        `/api/admin/knowledge?sourceType=${sourceType}&sourceId=${sourceId}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        const result = await res.json();
        alert(`Deleted ${result.deletedChunks} chunks`);
        fetchData();
      } else {
        alert('Failed to delete source');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Failed to delete source');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <Badge variant="success" size="sm"><CheckCircle className="w-3 h-3 mr-1" /> Complete</Badge>;
      case 'processing':
        return <Badge variant="warning" size="sm"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'pending':
        return <Badge variant="default" size="sm"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="error" size="sm"><AlertCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <>
      <Header
        title="Knowledge Base"
        subtitle="Manage RAG knowledge base and video transcripts"
        breadcrumbs={[{ label: 'Admin' }, { label: 'Knowledge' }]}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<RefreshCw className="w-4 h-4" />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        }
      />

      <PageShell>
        {/* Configuration Status */}
        {!stats?.embeddingsConfigured && (
          <PageSection>
            <Card className="border-[var(--warning)] bg-[var(--warning)]/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3 text-[var(--warning)]">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Embeddings Not Configured</p>
                    <p className="text-sm opacity-75">Set OPENAI_API_KEY environment variable to enable RAG features.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </PageSection>
        )}

        {/* Stats */}
        <PageSection>
          <StatGrid columns={4}>
            <Card padding="md">
              <Stat
                label="Total Chunks"
                value={stats?.totalChunks || 0}
                icon={<Database className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Knowledge Sources"
                value={stats?.totalSources || 0}
                icon={<FileText className="w-4 h-4" />}
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Videos Processed"
                value={stats?.videoStats.complete || 0}
                icon={<Youtube className="w-4 h-4" />}
                valueColor="profit"
              />
            </Card>
            <Card padding="md">
              <Stat
                label="Pending Videos"
                value={stats?.videoStats.pending || 0}
                icon={<Clock className="w-4 h-4" />}
              />
            </Card>
          </StatGrid>
        </PageSection>

        {/* Add Video */}
        <PageSection>
          <Card>
            <CardHeader title="Add YouTube Video" />
            <CardContent>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="YouTube URL or Video ID..."
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    leftIcon={<Youtube className="w-4 h-4" />}
                  />
                </div>
                <Button
                  variant="primary"
                  icon={addingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  onClick={handleAddVideo}
                  disabled={addingVideo || !newVideoUrl.trim()}
                >
                  Add Video
                </Button>
                <Button
                  variant="secondary"
                  icon={processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  onClick={handleProcessPending}
                  disabled={processing || !stats?.embeddingsConfigured}
                >
                  Process Pending
                </Button>
              </div>
            </CardContent>
          </Card>
        </PageSection>

        {/* YouTube Videos Table */}
        <PageSection>
          <Card>
            <CardHeader
              title="YouTube Videos"
              action={
                <Badge variant="default" size="sm">
                  {videos.length} videos
                </Badge>
              }
            />
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Video</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="text-center py-8 text-[var(--text-tertiary)]">
                        No videos added yet. Add a YouTube URL above to get started.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  videos.map((video) => (
                    <TableRow key={video.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center">
                            <Youtube className="w-4 h-4 text-red-500" />
                          </div>
                          <div>
                            <p className="font-medium text-[var(--text-primary)] max-w-xs truncate">
                              {video.title}
                            </p>
                            <p className="text-xs text-[var(--text-tertiary)]">
                              {video.video_id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {video.topics?.map((topic, i) => (
                          <Badge key={i} variant="default" size="sm" className="mr-1">
                            {topic}
                          </Badge>
                        )) || <span className="text-[var(--text-tertiary)]">-</span>}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(video.transcript_status)}
                      </TableCell>
                      <TableCell mono>{video.chunk_count}</TableCell>
                      <TableCell>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {formatDateTime(video.created_at)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--accent-primary)]"
                            onClick={() => handleReprocessVideo(video.video_id)}
                            title="Reprocess transcript"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                            onClick={() => handleDeleteSource('transcript', video.video_id)}
                            title="Delete chunks"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </PageSection>

        {/* Knowledge Sources Table */}
        <PageSection>
          <Card>
            <CardHeader
              title="Knowledge Sources"
              action={
                <Badge variant="default" size="sm">
                  <Brain className="w-3 h-3 mr-1" />
                  {stats?.totalChunks || 0} chunks
                </Badge>
              }
            />
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Source</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Chunks</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="text-center py-8 text-[var(--text-tertiary)]">
                        No knowledge sources yet. Process videos or ingest documents to populate.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  sources.map((source) => (
                    <TableRow key={source.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-[var(--text-primary)] max-w-xs truncate">
                            {source.title}
                          </p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {source.source_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" size="sm">
                          {source.source_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(source.status)}
                        {source.error_message && (
                          <p className="text-xs text-[var(--error)] mt-1 max-w-xs truncate">
                            {source.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell mono>{source.chunk_count}</TableCell>
                      <TableCell>
                        <span className="text-xs text-[var(--text-tertiary)]">
                          {source.processed_at ? formatDateTime(source.processed_at) : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <button
                          className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--error)]"
                          onClick={() => handleDeleteSource(source.source_type, source.source_id)}
                          title="Delete source"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </PageSection>
      </PageShell>
    </>
  );
}
