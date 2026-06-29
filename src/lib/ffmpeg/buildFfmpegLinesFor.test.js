import { describe, expect, it } from 'vitest';
import { buildFfmpegLinesFor } from './buildFfmpegLinesFor';

const baseEdit = {
  meta: { width: 1280, height: 720, duration: 20 },
  crop: { t: 0, b: 0, l: 0, r: 0 },
  trim: { start: 0, end: 20 },
  elements: [],
  segmentMode: 'analog',
  segments: [],
  segmentSets: {
    digital: [],
    analog: [
      { id: 'a', start: 1, end: 3 },
      { id: 'b', start: 7.5, end: 9 }
    ],
    thermal_digital: [],
    thermal_analog: []
  }
};

const options = {
  outputDir: '/exports',
  doneDir: '/done',
  getSegmentModeForVideo: () => 'analog'
};

describe('buildFfmpegLinesFor segment cutting', () => {
  it('cuts every segment and concatenates them when there are no visual filters', () => {
    const result = buildFfmpegLinesFor(
      { name: 'video.mp4', sourcePath: '/input/video.mp4' },
      baseEdit,
      options
    );

    expect(result.error).toBeUndefined();
    expect(result.usesTemp).toBe(true);
    expect(result.outputName).toBe('video.mp4');
    expect(result.outputPath).toBe('/exports/video.mp4');
    expect(result.lines.join('\n')).toContain('-ss 1.000 -to 3.000');
    expect(result.lines.join('\n')).toContain('-ss 7.500 -to 9.000');
    expect(result.lines.join('\n')).toContain('-f concat');
  });

  it('keeps all segments in the filter graph when a rectangle is present', () => {
    const result = buildFfmpegLinesFor(
      { name: 'video.mp4', sourcePath: '/input/video.mp4' },
      {
        ...baseEdit,
        elements: [
          {
            id: 'rect',
            type: 'rect',
            x: 10,
            y: 10,
            w: 20,
            h: 20,
            color: '#000000',
            isOutline: true,
            thickness: 1,
            startTime: 0,
            endTime: 20,
            channelMode: 'all'
          }
        ]
      },
      options
    );

    expect(result.error).toBeUndefined();
    expect(result.lines.join('\n')).toContain('trim=start=1.000:end=3.000');
    expect(result.lines.join('\n')).toContain('trim=start=7.500:end=9.000');
    expect(result.lines.join('\n')).toContain('concat=n=2:v=1:a=0');
  });
});
