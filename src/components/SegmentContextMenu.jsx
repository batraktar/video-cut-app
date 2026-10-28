import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatHotkeyList } from '../features/editor/hotkeys';

export default function SegmentContextMenu({
  segment,
  left,
  top,
  hotkeys,
  currentTime,
  onSplit,
  onToggleSnow,
  onCycleChannel,
  onRemove,
  onClose
}) {
  useEffect(() => {
    const closeOnOutsidePointer = event => {
      if (!event.target.closest?.('[data-segment-context-menu]')) onClose();
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const actions = [
    {
      label: 'Розділити тут',
      disabled: currentTime <= segment.start + 0.1 || currentTime >= segment.end - 0.1,
      hotkey: 'splitSegment',
      run: () => onSplit(segment.id)
    },
    {
      label: segment.isSnow ? 'Вимкнути Snow' : 'Увімкнути Snow',
      hotkey: 'toggleSnowSegment',
      run: () => onToggleSnow(segment.id)
    },
    {
      label: 'Змінити канал',
      hotkey: 'cycleSegmentChannel',
      run: () => onCycleChannel(segment.id)
    },
    {
      label: 'Видалити сегмент',
      hotkey: 'deleteSegment',
      danger: true,
      run: () => onRemove(segment.id)
    }
  ];

  return createPortal(
    <div
      data-segment-context-menu
      role="menu"
      aria-label="Дії із сегментом"
      className="fixed z-[10000] w-56 rounded-md border border-slate-600 bg-slate-900 p-1.5 text-xs text-slate-100 shadow-2xl"
      style={{ left, top }}
      onMouseDown={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
    >
      {actions.map(action => (
        <button
          key={action.label}
          type="button"
          role="menuitem"
          disabled={action.disabled}
          onClick={() => {
            onClose();
            action.run();
          }}
          className={`flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
            action.danger
              ? 'mt-1 border-t border-slate-700 pt-2 text-red-300 hover:bg-red-950/70'
              : 'hover:bg-slate-700'
          }`}
        >
          <span>{action.label}</span>
          {action.hotkey && (
            <kbd className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
              {formatHotkeyList(hotkeys?.[action.hotkey])}
            </kbd>
          )}
        </button>
      ))}
    </div>,
    document.body
  );
}
