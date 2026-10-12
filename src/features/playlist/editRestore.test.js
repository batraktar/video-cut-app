import { describe, expect, it } from 'vitest';
import { getSavedEditForVideo } from './editRestore';

describe('getSavedEditForVideo', () => {
  it('restores a server video edit from its legacy metadata-based key', () => {
    const savedEdit = { segments: [{ id: 'segment-1', start: 2, end: 4 }] };
    const savedEdits = {
      'server:/videos|folder/clip.mp4|1234|5678': savedEdit
    };
    const video = {
      id: 'server:/videos|folder/clip.mp4',
      fileKey: 'server:/videos|folder/clip.mp4',
      source: 'server',
      sourceBaseDir: '/videos',
      sourcePath: 'folder/clip.mp4'
    };

    expect(getSavedEditForVideo(savedEdits, video, new Map())).toBe(savedEdit);
  });
});
