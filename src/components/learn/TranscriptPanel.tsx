'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, FileText, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptSegment {
  text: string;
  startTime?: number;  // Optional timestamp in seconds
}

interface TranscriptPanelProps {
  transcript: string;
  segments?: TranscriptSegment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  downloadUrl?: string;
  className?: string;
}

export function TranscriptPanel({
  transcript,
  segments,
  currentTime = 0,
  onSeek,
  downloadUrl,
  className = '',
}: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Parse transcript into paragraphs if no segments provided
  const parsedSegments: TranscriptSegment[] = useMemo(() => {
    if (segments && segments.length > 0) {
      return segments;
    }

    // Split by double newlines or periods followed by newlines
    const paragraphs: TranscriptSegment[] = transcript
      .split(/\n\n+/)
      .filter(p => p.trim().length > 0)
      .map(text => ({ text: text.trim() }));

    return paragraphs;
  }, [transcript, segments]);

  // Filter segments based on search
  const filteredSegments = useMemo(() => {
    if (!searchQuery.trim()) return parsedSegments;

    const query = searchQuery.toLowerCase();
    return parsedSegments.filter(seg =>
      seg.text.toLowerCase().includes(query)
    );
  }, [parsedSegments, searchQuery]);

  // Highlight search matches
  const highlightText = (text: string) => {
    if (!searchQuery.trim()) return text;

    const query = searchQuery.toLowerCase();
    const parts = text.split(new RegExp(`(${query})`, 'gi'));

    return parts.map((part, i) =>
      part.toLowerCase() === query ? (
        <mark key={i} className="bg-[var(--accent-primary)]/30 text-[var(--text-primary)] rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Find active segment based on current time
  const activeSegmentIndex = useMemo(() => {
    if (!segments || segments.length === 0) return -1;

    for (let i = segments.length - 1; i >= 0; i--) {
      if (segments[i].startTime !== undefined && segments[i].startTime! <= currentTime) {
        return i;
      }
    }
    return 0;
  }, [segments, currentTime]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = activeSegmentRef.current;

      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      // Only scroll if element is outside visible area
      if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeSegmentIndex]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            <span>Transcript</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                title="Download transcript"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <CardContent>
              <div
                ref={scrollRef}
                className="max-h-96 overflow-y-auto space-y-3 pr-2"
              >
                {filteredSegments.length === 0 ? (
                  <p className="text-center text-[var(--text-tertiary)] py-8">
                    {searchQuery ? 'No matches found' : 'No transcript available'}
                  </p>
                ) : (
                  filteredSegments.map((segment, index) => {
                    const isActive = index === activeSegmentIndex && !searchQuery;
                    const hasTimestamp = segment.startTime !== undefined;

                    return (
                      <div
                        key={index}
                        ref={isActive ? activeSegmentRef : null}
                        className={`
                          relative p-3 rounded-lg transition-colors
                          ${isActive
                            ? 'bg-[var(--accent-primary)]/10 border-l-2 border-[var(--accent-primary)]'
                            : 'hover:bg-[var(--bg-tertiary)]'
                          }
                          ${hasTimestamp ? 'cursor-pointer' : ''}
                        `}
                        onClick={() => hasTimestamp && onSeek?.(segment.startTime!)}
                      >
                        {hasTimestamp && (
                          <span className="text-xs text-[var(--accent-primary)] font-mono mb-1 block">
                            {formatTime(segment.startTime!)}
                          </span>
                        )}
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {highlightText(segment.text)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Search results count */}
              {searchQuery && (
                <div className="mt-3 pt-3 border-t border-[var(--border-primary)] text-sm text-[var(--text-tertiary)]">
                  {filteredSegments.length} result{filteredSegments.length !== 1 ? 's' : ''} found
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
