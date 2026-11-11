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

  it('renders rotated shapes via a small local geq layer', () => {
    const res = buildFilterGraph({
      meta: { width: 1000, height: 800, duration: 10 },
      crop: { t: 0, b: 0, l: 0, r: 0 },
      elements: [
        {
          type: 'rect',
          x: 40,
          y: 40,
          w: 20,
          h: 10,
          rotation: 30,
          startTime: 1,
          endTime: 5,
          color: '#000000'
        }
      ],
      segments: [{ start: 0, end: 5 }]
    });

    expect(res.error).toBeUndefined();
    // локальний шар: не весь кадр і лише 1 кадр/сек
    expect(res.graph).not.toContain('s=1000x800');
    expect(res.graph).toContain(':r=1:');
    expect(res.graph).toMatch(/overlay=x=\d+:y=\d+/);
  });

  it('extends rotated shapes that touch the frame edge', () => {
    const gtBounds = graph =>
      [...graph.matchAll(/gt\(.+?\\,(-?[\d.]+)\)/g)].map(m => parseFloat(m[1]));

    const flush = buildFilterGraph({
      meta: { width: 1000, height: 800, duration: 10 },
      crop: { t: 0, b: 0, l: 0, r: 0 },
      elements: [
        { type: 'rect', x: 0, y: 0, w: 100, h: 10, rotation: 30, startTime: 0, endTime: 5, color: '#000000' }
      ],
      segments: [{ start: 0, end: 5 }]
    });
    const [flushDx, flushDy] = gtBounds(flush.graph);
    // півширина 500 + подовження боку, що торкається краю
    expect(flushDx).toBeLessThan(-500);
    // піввисота 40 + (500 * tan30 + 2) проти кутової дірки зверху
    expect(flushDy).toBeLessThan(-300);

    const mid = buildFilterGraph({
      meta: { width: 1000, height: 800, duration: 10 },
      crop: { t: 0, b: 0, l: 0, r: 0 },
      elements: [
        { type: 'rect', x: 40, y: 40, w: 20, h: 10, rotation: 30, startTime: 0, endTime: 5, color: '#000000' }
      ],
      segments: [{ start: 0, end: 5 }]
    });
    const [midDx, midDy] = gtBounds(mid.graph);
    // фігура в середині кадру — без подовжень, рівно піврозміри
    expect(midDx).toBeCloseTo(-100);
    expect(midDy).toBeCloseTo(-40);
  });
});

