import { describe, expect, it } from 'vitest';
import { buildFilterGraph } from './buildFilterGraph';

describe('buildFilterGraph', () => {
  it('builds crop + multi-segment concat graph', () => {
    const res = buildFilterGraph({
      meta: { width: 1000, height: 500, duration: 10 },
      crop: { t: 0, b: 0, l: 10, r: 10 },
      elements: [],
      segments: [
        { start: 1, end: 2 },
        { start: 3.5, end: 4 }
      ]
    });

    expect(res.error).toBeUndefined();
    expect(res.outputLabel).toBe('vout');
    expect(res.graph).toContain('[0:v]');
    expect(res.graph).toContain('crop=');
    expect(res.graph).toContain('split=2');
    expect(res.graph).toContain('trim=start=1.000:end=2.000');
    expect(res.graph).toContain('trim=start=3.500:end=4.000');
    expect(res.graph).toContain('concat=n=2:v=1:a=0[vout]');
  });

  it('adds drawbox with enable window', () => {
    const res = buildFilterGraph({
      meta: { width: 100, height: 100, duration: 10 },
      crop: { t: 0, b: 0, l: 0, r: 0 },
      elements: [
        {
          x: 10,
          y: 20,
          w: 30,
          h: 40,
          startTime: 1,
          endTime: 2.2,
          color: '#ff00aa',
          isOutline: true,
          thickness: 3
        }
      ],
      segments: [{ start: 0, end: 5 }]
    });

    expect(res.error).toBeUndefined();
    expect(res.outputLabel).toBe('v0');
    expect(res.graph).toContain('drawbox=');
    expect(res.graph).toContain('color=0xff00aa@1');
    expect(res.graph).toContain("enable='between(t,1.000,2.200)'");
  });
});

