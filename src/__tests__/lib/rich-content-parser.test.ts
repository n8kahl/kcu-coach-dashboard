/**
 * Rich Content Parser Tests
 *
 * Tests for parsing AI response markers into structured content.
 */

import {
  parseRichContent,
  stripRichContentMarkers,
  parseAIResponse,
  hasRichContent,
  formatTimestamp,
  generateYouTubeUrl,
} from '@/lib/rich-content-parser';
import type { RichContent, CourseVideoContent, LessonLinkContent, VideoTimestampContent } from '@/types';

describe('parseRichContent', () => {
  describe('COURSE marker', () => {
    it('should parse a COURSE marker with timestamp', () => {
      const text = '[[COURSE:ltp-framework/core-concepts/patience-candles|120|Patience Candles Explained]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as CourseVideoContent;
      expect(content.type).toBe('course_video');
      expect(content.courseSlug).toBe('ltp-framework');
      expect(content.moduleSlug).toBe('core-concepts');
      expect(content.lessonSlug).toBe('patience-candles');
      expect(content.timestampSeconds).toBe(120);
      expect(content.title).toBe('Patience Candles Explained');
      expect(content.timestampFormatted).toBe('2:00');
    });

    it('should parse COURSE marker with zero timestamp', () => {
      const text = '[[COURSE:course/module/lesson|0|Start of Video]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as CourseVideoContent;
      expect(content.timestampSeconds).toBe(0);
      expect(content.timestampFormatted).toBe('0:00');
    });

    it('should parse COURSE marker with hour-long timestamp', () => {
      const text = '[[COURSE:course/module/lesson|3723|Deep into the lesson]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as CourseVideoContent;
      expect(content.timestampSeconds).toBe(3723);
      expect(content.timestampFormatted).toBe('1:02:03');
    });

    it('should parse multiple COURSE markers', () => {
      const text = `Check out these sections:
[[COURSE:course1/mod1/lesson1|30|First Topic]]
[[COURSE:course2/mod2/lesson2|120|Second Topic]]`;
      const result = parseRichContent(text);

      const courseContents = result.filter((r): r is CourseVideoContent => r.type === 'course_video');
      expect(courseContents).toHaveLength(2);
      expect(courseContents[0].lessonSlug).toBe('lesson1');
      expect(courseContents[1].lessonSlug).toBe('lesson2');
    });

    it('should handle slug with hyphens', () => {
      const text = '[[COURSE:my-course/my-module/my-lesson-slug|45|Lesson Title]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as CourseVideoContent;
      expect(content.courseSlug).toBe('my-course');
      expect(content.moduleSlug).toBe('my-module');
      expect(content.lessonSlug).toBe('my-lesson-slug');
    });

    it('should trim whitespace from title', () => {
      const text = '[[COURSE:course/module/lesson|60|  Trimmed Title  ]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as CourseVideoContent;
      expect(content.title).toBe('Trimmed Title');
    });
  });

  describe('LESSON marker', () => {
    it('should parse 2-part LESSON marker', () => {
      const text = '[[LESSON:module-slug/lesson-slug|Lesson Title|15 min]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as LessonLinkContent;
      expect(content.type).toBe('lesson_link');
      expect(content.moduleId).toBe('module-slug');
      expect(content.lessonId).toBe('lesson-slug');
      expect(content.title).toBe('Lesson Title');
      expect(content.duration).toBe('15 min');
      expect(content.courseSlug).toBeUndefined();
    });

    it('should parse 3-part LESSON marker with courseSlug', () => {
      const text = '[[LESSON:course-slug/module-slug/lesson-slug|Lesson Title|20 min]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as LessonLinkContent;
      expect(content.courseSlug).toBe('course-slug');
      expect(content.moduleId).toBe('module-slug');
      expect(content.lessonId).toBe('lesson-slug');
    });
  });

  describe('VIDEO marker', () => {
    it('should parse VIDEO marker', () => {
      const text = '[[VIDEO:dQw4w9WgXcQ|120000|180000|Understanding LTP]]';
      const result = parseRichContent(text);

      expect(result).toHaveLength(1);
      const content = result[0] as VideoTimestampContent;
      expect(content.type).toBe('video_timestamp');
      expect(content.videoId).toBe('dQw4w9WgXcQ');
      expect(content.startMs).toBe(120000);
      expect(content.endMs).toBe(180000);
      expect(content.title).toBe('Understanding LTP');
      expect(content.source).toBe('youtube');
    });
  });

  describe('mixed content', () => {
    it('should parse multiple marker types', () => {
      const text = `Here are some resources:
[[LESSON:ltp/basics|LTP Basics|10 min]]
[[COURSE:ltp/core/patience|60|Patience Section]]
[[VIDEO:abc123|5000|10000|YouTube Clip]]`;

      const result = parseRichContent(text);

      expect(result).toHaveLength(3);
      expect(result.map(r => r.type)).toContain('lesson_link');
      expect(result.map(r => r.type)).toContain('course_video');
      expect(result.map(r => r.type)).toContain('video_timestamp');
    });
  });
});

describe('stripRichContentMarkers', () => {
  it('should remove COURSE markers', () => {
    const text = 'Check this out: [[COURSE:a/b/c|120|Title]] for more info.';
    const result = stripRichContentMarkers(text);

    expect(result).toBe('Check this out:  for more info.');
  });

  it('should remove LESSON markers', () => {
    const text = 'Watch [[LESSON:mod/lesson|Title|10 min]] to learn more.';
    const result = stripRichContentMarkers(text);

    expect(result).toBe('Watch  to learn more.');
  });

  it('should clean up extra newlines', () => {
    const text = `First line.


[[COURSE:a/b/c|0|Title]]


Last line.`;
    const result = stripRichContentMarkers(text);

    expect(result).not.toContain('\n\n\n');
  });

  it('should trim the result', () => {
    const text = '  [[COURSE:a/b/c|0|Title]]  ';
    const result = stripRichContentMarkers(text);

    expect(result).toBe('');
  });
});

describe('parseAIResponse', () => {
  it('should return both clean text and rich content', () => {
    const text = 'Here is the lesson: [[COURSE:a/b/c|60|Title]] Enjoy!';
    const result = parseAIResponse(text);

    expect(result.cleanText).toBe('Here is the lesson:  Enjoy!');
    expect(result.richContent).toHaveLength(1);
  });
});

describe('hasRichContent', () => {
  it('should return true for COURSE markers', () => {
    expect(hasRichContent('[[COURSE:a/b/c|0|T]]')).toBe(true);
  });

  it('should return true for LESSON markers', () => {
    expect(hasRichContent('[[LESSON:a/b|T|1m]]')).toBe(true);
  });

  it('should return true for VIDEO markers', () => {
    expect(hasRichContent('[[VIDEO:id|0|100|T]]')).toBe(true);
  });

  it('should return false for plain text', () => {
    expect(hasRichContent('Just plain text')).toBe(false);
  });

  it('should return false for malformed markers', () => {
    expect(hasRichContent('[[COURSE:incomplete')).toBe(false);
    expect(hasRichContent('LESSON:a/b|T|1m]]')).toBe(false);
  });
});

describe('formatTimestamp', () => {
  it('should format milliseconds under a minute', () => {
    expect(formatTimestamp(5000)).toBe('0:05');
    expect(formatTimestamp(30000)).toBe('0:30');
  });

  it('should format minutes and seconds', () => {
    expect(formatTimestamp(65000)).toBe('1:05');
    expect(formatTimestamp(600000)).toBe('10:00');
  });

  it('should format hours', () => {
    expect(formatTimestamp(3600000)).toBe('1:00:00');
    expect(formatTimestamp(3723000)).toBe('1:02:03');
  });
});

describe('generateYouTubeUrl', () => {
  it('should generate URL with timestamp', () => {
    const url = generateYouTubeUrl('dQw4w9WgXcQ', 120000);
    expect(url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s');
  });

  it('should handle zero timestamp', () => {
    const url = generateYouTubeUrl('abc123', 0);
    expect(url).toBe('https://www.youtube.com/watch?v=abc123&t=0s');
  });
});
