import { describe, expect, it } from 'vitest';
import { getServerFileKey, resolveImportSuffix } from './editorUtils';

describe('resolveImportSuffix', () => {
  it('uses the sheet channel suffix when an imported video has none', () => {
    expect(resolveImportSuffix('', [{ suffix: '_crop_analog' }])).toBe('_crop_analog');
  });

  it('uses crop digital when neither the video nor the sheet supplies a suffix', () => {
    expect(resolveImportSuffix('', [])).toBe('_crop_digital');
  });
});

describe('getServerFileKey', () => {
  it('keeps a server video identity when its file metadata changes', () => {
    expect(getServerFileKey('/videos', 'folder/clip.mp4', 100, 1)).toBe(
      getServerFileKey('/videos', 'folder/clip.mp4', 200, 2)
    );
  });
});
