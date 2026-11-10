import { describe, expect, it } from 'vitest';
import { parseRcloneProgressLine } from './rcloneProgress.js';

describe('parseRcloneProgressLine', () => {
  it('parses rclone one-line stats with binary units', () => {
    expect(parseRcloneProgressLine('2026/10/31 15:14:52 NOTICE: 6 MiB / 12 MiB, 50%, 2 MiB/s, ETA 3s')).toEqual({
      bytesTransferred: 6 * 1024 ** 2,
      totalBytes: 12 * 1024 ** 2,
      percent: 50,
      speed: '2 MiB/s',
      eta: '3s'
    });
  });

  it('parses decimal units and a completed transfer', () => {
    expect(parseRcloneProgressLine('NOTICE: 2 MB / 2 MB, 100%, 0 B/s, ETA -')).toMatchObject({
      bytesTransferred: 2_000_000,
      totalBytes: 2_000_000,
      percent: 100,
      eta: '-'
    });
  });

  it('ignores unrelated rclone output', () => {
    expect(parseRcloneProgressLine('Transferred: 1 file')).toBeNull();
  });
});
