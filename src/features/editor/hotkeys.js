export const DEFAULT_HOTKEYS = {
  undo: [
    { code: 'KeyZ', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
    { code: 'KeyZ', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true }
  ],
  redo: [
    { code: 'KeyZ', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false },
    { code: 'KeyZ', ctrlKey: false, shiftKey: true, altKey: false, metaKey: true },
    { code: 'KeyY', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
    { code: 'KeyY', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true }
  ],
  focusSearch: [
    { code: 'KeyF', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false },
    { code: 'KeyF', ctrlKey: false, shiftKey: false, altKey: false, metaKey: true }
  ],
  toggleFocusMode: [{ code: 'Backslash', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  cycleSegmentMode: [{ code: 'Slash', ctrlKey: false, shiftKey: true, altKey: false, metaKey: false }],
  panHold: [{ code: 'Space', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  togglePlayback: [{ code: 'Space', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  addRect: [{ code: 'KeyN', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  toggleElementChannel: [{ code: 'KeyL', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  addSegment: [{ code: 'Enter', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  toggleSnowSegment: [{ code: 'KeyS', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  outline: [
    { code: 'KeyB', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    { code: 'Comma', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
  ],
  fill: [
    { code: 'KeyU', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    { code: 'Period', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
  ],
  copyAttributes: [{ code: 'KeyC', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  pasteAttributes: [{ code: 'KeyV', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  deleteElement: [
    { code: 'Delete', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false },
    { code: 'Backspace', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }
  ],
  seekBackLarge: [{ code: 'ArrowLeft', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  seekForwardLarge: [{ code: 'ArrowRight', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  seekForwardSmall: [{ code: 'ArrowUp', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  seekBackSmall: [{ code: 'ArrowDown', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  markStart: [{ code: 'KeyM', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  markEnd: [{ code: 'Slash', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false }],
  cycleSeekStep: []
};

export const HOTKEY_DEFS = [
  { id: 'togglePlayback', label: 'Play/Pause' },
  { id: 'panHold', label: 'Панорамування (утримувати)' },
  { id: 'seekBackLarge', label: 'Перемотка назад (2s)' },
  { id: 'seekForwardLarge', label: 'Перемотка вперед (2s)' },
  { id: 'seekBackSmall', label: 'Перемотка назад (крок)' },
  { id: 'seekForwardSmall', label: 'Перемотка вперед (крок)' },
  { id: 'cycleSeekStep', label: 'Змінити крок перемотки' },
  { id: 'markStart', label: 'Поставити початок (елемент/сегмент)' },
  { id: 'markEnd', label: 'Поставити кінець (елемент/сегмент)' },
  { id: 'addSegment', label: 'Додати сегмент з чернетки' },
  { id: 'toggleSnowSegment', label: 'Snow: перемкнути сегмент під курсором' },
  { id: 'cycleSegmentMode', label: 'Перемкнути канал сегментів' },
  { id: 'addRect', label: 'Додати прямокутник' },
  { id: 'toggleElementChannel', label: 'Канал елемента: all/active' },
  { id: 'outline', label: 'Контур (елемент)' },
  { id: 'fill', label: 'Заливка (елемент)' },
  { id: 'copyAttributes', label: 'Копіювати налаштування (елемент)' },
  { id: 'pasteAttributes', label: 'Вставити налаштування (елемент)' },
  { id: 'deleteElement', label: 'Видалити елемент' },
  { id: 'undo', label: 'Undo' },
  { id: 'redo', label: 'Redo' },
  { id: 'focusSearch', label: 'Фокус на пошук' },
  { id: 'toggleFocusMode', label: 'Режим перегляду (Focus)' }
];

const normalizeHotkey = value => {
  if (!value || typeof value !== 'object') return null;
  if (typeof value.code !== 'string' || value.code.length === 0) return null;
  return {
    code: value.code,
    ctrlKey: Boolean(value.ctrlKey),
    shiftKey: Boolean(value.shiftKey),
    altKey: Boolean(value.altKey),
    metaKey: Boolean(value.metaKey)
  };
};

export const normalizeHotkeys = stored => {
  const next = { ...DEFAULT_HOTKEYS };
  if (!stored || typeof stored !== 'object') return next;
  Object.keys(DEFAULT_HOTKEYS).forEach(actionId => {
    const raw = stored[actionId];
    if (!raw) return;
    const arr = Array.isArray(raw) ? raw : [raw];
    const seen = new Set();
    const normalized = arr
      .map(normalizeHotkey)
      .filter(Boolean)
      .filter(item => {
        const key = serializeHotkey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 2);
    next[actionId] = normalized;
  });
  return next;
};

export const formatHotkey = hotkey => {
  if (!hotkey) return '';
  const codeLabelMap = {
    Space: 'Space',
    Enter: 'Enter',
    Escape: 'Esc',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Slash: '/',
    Backslash: '\\',
    Comma: ',',
    Period: '.',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓'
  };
  const parts = [];
  if (hotkey.ctrlKey) parts.push('Ctrl');
  if (hotkey.metaKey) parts.push('Cmd');
  if (hotkey.altKey) parts.push('Alt');
  if (hotkey.shiftKey) parts.push('Shift');
  const keyLabel =
    codeLabelMap[hotkey.code] || hotkey.code.replace(/^Key/, '').replace(/^Digit/, '');
  parts.push(keyLabel);
  return parts.join('+');
};

export const formatHotkeyList = list => {
  const normalized = Array.isArray(list) ? list : [];
  const parts = normalized.map(formatHotkey).filter(Boolean);
  return parts.length ? parts.join(' / ') : '—';
};

export const serializeHotkey = hotkey => {
  if (!hotkey) return '';
  return [
    hotkey.code,
    hotkey.ctrlKey ? '1' : '0',
    hotkey.shiftKey ? '1' : '0',
    hotkey.altKey ? '1' : '0',
    hotkey.metaKey ? '1' : '0'
  ].join('|');
};

export const eventMatchesHotkey = (event, hotkey) => {
  if (!hotkey) return false;
  return (
    event.code === hotkey.code &&
    Boolean(event.ctrlKey) === Boolean(hotkey.ctrlKey) &&
    Boolean(event.shiftKey) === Boolean(hotkey.shiftKey) &&
    Boolean(event.altKey) === Boolean(hotkey.altKey) &&
    Boolean(event.metaKey) === Boolean(hotkey.metaKey)
  );
};

export const eventMatchesAction = (event, hotkeys, actionId) => {
  const list = hotkeys?.[actionId];
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some(hotkey => eventMatchesHotkey(event, hotkey));
};

const isOverlapAllowed = (actionA, actionB, binding) => {
  if (!binding) return false;
  const a = String(actionA || '');
  const b = String(actionB || '');
  const pair =
    (a === 'panHold' && b === 'togglePlayback') || (a === 'togglePlayback' && b === 'panHold');
  if (!pair) return false;
  return (
    binding.code === 'Space' &&
    !binding.ctrlKey &&
    !binding.shiftKey &&
    !binding.altKey &&
    !binding.metaKey
  );
};

export const findHotkeyCollision = (hotkeys, binding, options = {}) => {
  const normalized = normalizeHotkeys(hotkeys);
  const targetKey = serializeHotkey(binding);
  if (!targetKey) return null;

  const excludeActionId = options.excludeActionId || null;
  const excludeIndex = Number.isFinite(options.excludeIndex) ? options.excludeIndex : null;

  for (const [actionId, list] of Object.entries(normalized)) {
    if (!Array.isArray(list)) continue;
    for (let index = 0; index < list.length; index += 1) {
      if (excludeActionId === actionId && excludeIndex === index) continue;
      const existing = list[index];
      if (!existing) continue;
      if (isOverlapAllowed(actionId, excludeActionId, binding)) continue;
      if (isOverlapAllowed(excludeActionId, actionId, binding)) continue;
      if (serializeHotkey(existing) === targetKey) return { actionId, index };
    }
  }
  return null;
};
