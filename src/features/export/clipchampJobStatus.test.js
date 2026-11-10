import { describe, expect, it } from 'vitest';
import { getClipchampJobStatus } from './clipchampJobStatus.js';

describe('Clipchamp per-file status', () => {
  it('counts rendering separately from Drive upload after cancellation', () => {
    const status = getClipchampJobStatus({
      status: 'canceled',
      command: "# CLIPCHAMP_EXPORT batch\n# source → first.mp4\n# source → second.mp4\nrclone copyto",
      log: [
        'CLIPCHAMP_RENDER_DONE first.mp4',
        'CLIPCHAMP_RENDER_DONE second.mp4',
        'CLIPCHAMP_UPLOAD_DONE first.mp4',
        'CLIPCHAMP_UPLOAD_START second.mp4'
      ].join('\n')
    });
    expect(status.processedCount).toBe(2);
    expect(status.uploadedCount).toBe(1);
    expect(status.files.map(file => file.status)).toEqual(['uploaded', 'cancelled']);
  });
});
