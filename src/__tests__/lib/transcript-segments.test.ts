/**
 * Transcript Segments Tests
 *
 * Tests for transcript segment handling in AI search and lesson pages.
 */

describe('Transcript Segments', () => {
  describe('formatTimestamp helper', () => {
    // Helper to format seconds to MM:SS or HH:MM:SS
    function formatTimestamp(seconds: number): string {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);

      if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      }
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    it('should format seconds under a minute', () => {
      expect(formatTimestamp(0)).toBe('0:00');
      expect(formatTimestamp(5)).toBe('0:05');
      expect(formatTimestamp(30)).toBe('0:30');
      expect(formatTimestamp(59)).toBe('0:59');
    });

    it('should format minutes and seconds', () => {
      expect(formatTimestamp(60)).toBe('1:00');
      expect(formatTimestamp(65)).toBe('1:05');
      expect(formatTimestamp(125)).toBe('2:05');
      expect(formatTimestamp(599)).toBe('9:59');
      expect(formatTimestamp(600)).toBe('10:00');
      expect(formatTimestamp(3599)).toBe('59:59');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(formatTimestamp(3600)).toBe('1:00:00');
      expect(formatTimestamp(3661)).toBe('1:01:01');
      expect(formatTimestamp(3723)).toBe('1:02:03');
      expect(formatTimestamp(7200)).toBe('2:00:00');
    });
  });

  describe('Segment to URL transformation', () => {
    interface TranscriptSegment {
      text: string;
      startMs: number;
      endMs: number;
    }

    function buildLessonUrlWithTimestamp(
      courseSlug: string,
      moduleSlug: string,
      lessonSlug: string,
      segment?: TranscriptSegment
    ): string {
      const baseUrl = `/learn/${courseSlug}/${moduleSlug}/${lessonSlug}`;
      if (segment) {
        const timestampSeconds = Math.floor(segment.startMs / 1000);
        return `${baseUrl}?t=${timestampSeconds}`;
      }
      return baseUrl;
    }

    it('should build URL without timestamp when no segment', () => {
      const url = buildLessonUrlWithTimestamp('ltp-course', 'basics', 'intro');
      expect(url).toBe('/learn/ltp-course/basics/intro');
    });

    it('should build URL with timestamp from segment', () => {
      const segment: TranscriptSegment = {
        text: 'This is the content',
        startMs: 120000,
        endMs: 130000,
      };
      const url = buildLessonUrlWithTimestamp('ltp-course', 'basics', 'intro', segment);
      expect(url).toBe('/learn/ltp-course/basics/intro?t=120');
    });

    it('should handle zero timestamp', () => {
      const segment: TranscriptSegment = {
        text: 'Start of video',
        startMs: 0,
        endMs: 5000,
      };
      const url = buildLessonUrlWithTimestamp('course', 'module', 'lesson', segment);
      expect(url).toBe('/learn/course/module/lesson?t=0');
    });

    it('should round milliseconds to seconds', () => {
      const segment: TranscriptSegment = {
        text: 'Mid-second content',
        startMs: 5500,
        endMs: 10000,
      };
      const url = buildLessonUrlWithTimestamp('course', 'module', 'lesson', segment);
      expect(url).toBe('/learn/course/module/lesson?t=5');
    });
  });

  describe('Segment search result ranking', () => {
    interface SearchMatch {
      lessonId: string;
      score: number;
      hasTimestamp: boolean;
    }

    function rankSearchResults(results: SearchMatch[]): SearchMatch[] {
      // Results with timestamps get a relevance boost
      const TIMESTAMP_BOOST = 15;

      return results
        .map((r) => ({
          ...r,
          score: r.hasTimestamp ? r.score + TIMESTAMP_BOOST : r.score,
        }))
        .sort((a, b) => b.score - a.score);
    }

    it('should boost results with timestamps', () => {
      const results: SearchMatch[] = [
        { lessonId: 'lesson1', score: 70, hasTimestamp: false },
        { lessonId: 'lesson2', score: 60, hasTimestamp: true },
      ];

      const ranked = rankSearchResults(results);

      // lesson2 with timestamp (60 + 15 = 75) should rank higher than lesson1 (70)
      expect(ranked[0].lessonId).toBe('lesson2');
      expect(ranked[0].score).toBe(75);
    });

    it('should maintain order when boosts dont change ranking', () => {
      const results: SearchMatch[] = [
        { lessonId: 'lesson1', score: 90, hasTimestamp: false },
        { lessonId: 'lesson2', score: 60, hasTimestamp: true },
      ];

      const ranked = rankSearchResults(results);

      // lesson1 (90) should still rank higher than lesson2 (60 + 15 = 75)
      expect(ranked[0].lessonId).toBe('lesson1');
    });
  });

  describe('Segment text extraction', () => {
    interface DBSegment {
      segment_index: number;
      text: string;
      start_ms: number;
      end_ms: number;
      start_formatted: string;
    }

    interface TranscriptSegment {
      text: string;
      startTime: number;
      endTime: number;
      startFormatted: string;
    }

    function transformSegments(dbSegments: DBSegment[]): TranscriptSegment[] {
      return dbSegments.map((seg) => ({
        text: seg.text,
        startTime: seg.start_ms / 1000,
        endTime: seg.end_ms / 1000,
        startFormatted: seg.start_formatted,
      }));
    }

    it('should transform DB segments to frontend format', () => {
      const dbSegments: DBSegment[] = [
        {
          segment_index: 0,
          text: 'First segment',
          start_ms: 0,
          end_ms: 5000,
          start_formatted: '0:00',
        },
        {
          segment_index: 1,
          text: 'Second segment',
          start_ms: 5000,
          end_ms: 10000,
          start_formatted: '0:05',
        },
      ];

      const result = transformSegments(dbSegments);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        text: 'First segment',
        startTime: 0,
        endTime: 5,
        startFormatted: '0:00',
      });
      expect(result[1]).toEqual({
        text: 'Second segment',
        startTime: 5,
        endTime: 10,
        startFormatted: '0:05',
      });
    });

    it('should handle empty segments array', () => {
      const result = transformSegments([]);
      expect(result).toEqual([]);
    });
  });
});
