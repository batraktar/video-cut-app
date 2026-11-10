import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildClipchampRetryCommand } from './clipchampRetry.js';

const temporary = [];
afterEach(() => temporary.splice(0).forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

describe('retry incomplete Clipchamp files', () => {
  it('keeps completed render and upload stages out of a retry', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'clipchamp-retry-'));
    temporary.push(cwd);
    fs.mkdirSync(path.join(cwd, 'out'));
    fs.writeFileSync(path.join(cwd, 'out', 'second.mp4'), 'rendered');
    const command = [
      '# CLIPCHAMP_EXPORT batch', 'set -o pipefail', "mkdir -p 'out'", 'CLIPCHAMP_EXPORT_FAILED=0',
      '# first → first.mp4', "printf 'CLIPCHAMP_RENDER_START %s\\n' 'first.mp4'", 'ffmpeg first', '',
      '# second → second.mp4', "printf 'CLIPCHAMP_RENDER_START %s\\n' 'second.mp4'", 'ffmpeg second', '',
      "printf %s 'metadata' > 'out/manifest'",
      "printf 'CLIPCHAMP_UPLOAD_START %s\\n' 'first.mp4'", 'rclone first', 'fi',
      "printf 'CLIPCHAMP_UPLOAD_START %s\\n' 'second.mp4'", 'rclone second', 'fi',
      "printf 'CLIPCHAMP_EXPORT_DONE\\n'"
    ].join('\n');
    const log = 'CLIPCHAMP_RENDER_DONE first.mp4\nCLIPCHAMP_UPLOAD_DONE first.mp4\nCLIPCHAMP_RENDER_DONE second.mp4\n';
    const retry = buildClipchampRetryCommand(command, log, cwd);
    expect(retry.remaining).toBe(1);
    expect(retry.command).not.toContain('ffmpeg first');
    expect(retry.command).not.toContain('ffmpeg second');
    expect(retry.command).not.toContain('rclone first');
    expect(retry.command).toContain('rclone second');
  });
});
