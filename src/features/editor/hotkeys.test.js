import { describe, expect, it } from 'vitest';
import { DEFAULT_HOTKEYS, shouldIgnoreRepeatedHotkey } from './hotkeys';

const repeatedKey = code => ({
  code,
  key: code.replace('Arrow', ''),
  repeat: true,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false
});

describe('repeated editor hotkeys', () => {
  it('keeps repeating small seek steps while a key is held', () => {
    expect(shouldIgnoreRepeatedHotkey(repeatedKey('ArrowDown'), DEFAULT_HOTKEYS)).toBe(false);
    expect(shouldIgnoreRepeatedHotkey(repeatedKey('ArrowUp'), DEFAULT_HOTKEYS)).toBe(false);
  });

  it('keeps one-shot editing commands from repeating', () => {
    expect(shouldIgnoreRepeatedHotkey(repeatedKey('KeyN'), DEFAULT_HOTKEYS)).toBe(true);
  });

  it('preserves the held pan shortcut but suppresses repeat for shared play/pan', () => {
    const panOnly = { ...DEFAULT_HOTKEYS, togglePlayback: [] };
    expect(shouldIgnoreRepeatedHotkey(repeatedKey('Space'), panOnly)).toBe(false);
    expect(shouldIgnoreRepeatedHotkey(repeatedKey('Space'), DEFAULT_HOTKEYS)).toBe(true);
  });
});
