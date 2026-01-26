/**
 * VTT Parser Tests
 *
 * Tests for WebVTT parsing functionality used by the transcript worker.
 */

import {
  parseVTT,
  formatVTTTimestamp,
  formatDisplayTimestamp,
  msToSeconds,
  secondsToMs,
} from '@/lib/vtt-parser';

describe('parseVTT', () => {
  it('should parse a simple VTT file', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world

00:00:05.000 --> 00:00:10.000
This is a test`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toEqual({
      start: 0,
      end: 5,
      text: 'Hello world',
    });
    expect(result.segments[1]).toEqual({
      start: 5,
      end: 10,
      text: 'This is a test',
    });
    expect(result.text).toBe('Hello world This is a test');
  });

  it('should handle VTT with metadata headers', () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:03.500
First caption`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('First caption');
  });

  it('should handle VTT with cue identifiers', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
First cue

2
00:00:02.000 --> 00:00:04.000
Second cue`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].text).toBe('First cue');
    expect(result.segments[1].text).toBe('Second cue');
  });

  it('should handle multi-line captions', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
This is line one
This is line two`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('This is line one This is line two');
  });

  it('should strip HTML tags from captions', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<v Speaker>Hello</v> <c.loud>world</c>`;

    const result = parseVTT(vtt);

    expect(result.segments[0].text).toBe('Hello world');
  });

  it('should handle comma as millisecond separator', () => {
    const vtt = `WEBVTT

00:00:00,500 --> 00:00:02,750
Comma separated`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].start).toBe(0.5);
    expect(result.segments[0].end).toBe(2.75);
  });

  it('should handle hours in timestamps', () => {
    const vtt = `WEBVTT

01:30:45.123 --> 02:15:30.456
Long video caption`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    // 1*3600 + 30*60 + 45 + 0.123 = 5445.123
    expect(result.segments[0].start).toBeCloseTo(5445.123, 2);
    // 2*3600 + 15*60 + 30 + 0.456 = 8130.456
    expect(result.segments[0].end).toBeCloseTo(8130.456, 2);
  });

  it('should handle NOTE comments', () => {
    const vtt = `WEBVTT

NOTE This is a comment

00:00:00.000 --> 00:00:05.000
Actual caption`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('Actual caption');
  });

  it('should return empty result for invalid VTT', () => {
    const vtt = `This is not VTT content
just some random text`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(0);
    expect(result.text).toBe('');
  });

  it('should handle empty VTT', () => {
    const vtt = `WEBVTT`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(0);
    expect(result.text).toBe('');
  });

  it('should skip segments without text', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000

00:00:02.000 --> 00:00:04.000
Has text`;

    const result = parseVTT(vtt);

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe('Has text');
  });
});

describe('formatVTTTimestamp', () => {
  it('should format zero seconds', () => {
    expect(formatVTTTimestamp(0)).toBe('00:00:00.000');
  });

  it('should format seconds with milliseconds', () => {
    expect(formatVTTTimestamp(5.5)).toBe('00:00:05.500');
  });

  it('should format minutes and seconds', () => {
    expect(formatVTTTimestamp(125.25)).toBe('00:02:05.250');
  });

  it('should format hours, minutes, and seconds', () => {
    expect(formatVTTTimestamp(3723.1)).toBe('01:02:03.100');
  });
});

describe('formatDisplayTimestamp', () => {
  it('should format without hours when under 1 hour', () => {
    expect(formatDisplayTimestamp(0)).toBe('0:00');
    expect(formatDisplayTimestamp(65)).toBe('1:05');
    expect(formatDisplayTimestamp(3599)).toBe('59:59');
  });

  it('should format with hours when 1 hour or more', () => {
    expect(formatDisplayTimestamp(3600)).toBe('1:00:00');
    expect(formatDisplayTimestamp(3723)).toBe('1:02:03');
    expect(formatDisplayTimestamp(36000)).toBe('10:00:00');
  });
});

describe('msToSeconds', () => {
  it('should convert milliseconds to seconds', () => {
    expect(msToSeconds(0)).toBe(0);
    expect(msToSeconds(1000)).toBe(1);
    expect(msToSeconds(5500)).toBe(5.5);
    expect(msToSeconds(120000)).toBe(120);
  });
});

describe('secondsToMs', () => {
  it('should convert seconds to milliseconds', () => {
    expect(secondsToMs(0)).toBe(0);
    expect(secondsToMs(1)).toBe(1000);
    expect(secondsToMs(5.5)).toBe(5500);
    expect(secondsToMs(120)).toBe(120000);
  });

  it('should round to nearest millisecond', () => {
    expect(secondsToMs(1.0005)).toBe(1001);
    expect(secondsToMs(1.0004)).toBe(1000);
  });
});
