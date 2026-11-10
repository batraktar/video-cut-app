import { describe, expect, it } from 'vitest';
import { getPlaylistItemChecked, getPlaylistSelection } from './playlistSelection';

describe('playlist selection persistence', () => {
  it('preserves the latest local checked and unchecked states by stable file key', () => {
    const selection = getPlaylistSelection([
      { id: 'old-id', fileKey: 'video-a', checked: true },
      { id: 'old-id-2', fileKey: 'video-b', checked: false }
    ]);

    expect(getPlaylistItemChecked({ id: 'server-id', fileKey: 'video-a', checked: false }, selection)).toBe(true);
    expect(getPlaylistItemChecked({ id: 'server-id-2', fileKey: 'video-b', checked: true }, selection)).toBe(false);
  });

  it('uses the server snapshot state for files missing from local storage', () => {
    const selection = getPlaylistSelection([{ id: 'local', checked: true }]);

    expect(getPlaylistItemChecked({ id: 'remote', checked: true }, selection)).toBe(true);
    expect(getPlaylistItemChecked({ id: 'remote-2', checked: false }, selection)).toBe(false);
  });
});
