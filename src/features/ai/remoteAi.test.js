import { describe, expect, it, vi } from 'vitest';
import {
  countAiSegments,
  describeRemoteAiResponse,
  normalizeRemoteAiSegments,
  pollRemoteAiTask
} from './remoteAi';

describe('remote AI responses', () => {
  it('normalizes result payloads and crop suffixes', () => {
    const segments = normalizeRemoteAiSegments({
      ok: true,
      status: 'done',
      result: {
        _crop_analog: [{ start: 1, end: 3 }],
        thermal_digital: [{ start: 4, end: 7 }]
      }
    });
    expect(segments).toEqual({
      analog: [{ start: 1, end: 3 }],
      thermal_digital: [{ start: 4, end: 7 }]
    });
    expect(countAiSegments(segments)).toBe(2);
  });

  it('polls queued tasks until the result is done', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, status: 'running' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, status: 'done', result: { analog: [] } })
      });

    const result = await pollRemoteAiTask({
      baseUrl: 'https://example.test',
      taskId: 'task_1',
      fetchImpl,
      intervalMs: 0
    });
    expect(result.status).toBe('done');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('normalizes nested predictions and time aliases', () => {
    const segments = normalizeRemoteAiSegments({
      result: {
        predictions: {
          _thermal_analog: [{ start_time: '1.5', end_time: '4.25' }]
        }
      }
    });
    expect(segments.thermal_analog).toEqual([
      { start_time: '1.5', end_time: '4.25', start: 1.5, end: 4.25 }
    ]);
  });

  it('describes an empty completed result', () => {
    expect(
      describeRemoteAiResponse({
        ok: true,
        status: 'done',
        result: {},
        frame_count: 12,
        label_counts: { analog: 12 },
        average_confidence: 0.91,
        dropped_runs: 1
      })
    ).toContain('кадрів: 12');
  });
});
