import React, { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_HOTKEYS,
  HOTKEY_DEFS,
  findHotkeyCollision,
  formatHotkey,
  normalizeHotkeys,
  serializeHotkey
} from '../features/editor/hotkeys';

const buildBindingFromEvent = e => ({
  code: e.code,
  ctrlKey: Boolean(e.ctrlKey),
  shiftKey: Boolean(e.shiftKey),
  altKey: Boolean(e.altKey),
  metaKey: Boolean(e.metaKey)
});

export default function HotkeysSettings({ isDark, hotkeys, setHotkeys, hotkeyCaptureRef }) {
  const normalized = useMemo(() => normalizeHotkeys(hotkeys), [hotkeys]);
  const actionLabelById = useMemo(
    () => Object.fromEntries(HOTKEY_DEFS.map(def => [def.id, def.label])),
    []
  );
  const [captureTarget, setCaptureTarget] = useState(null); // { actionId, index }
  const [captureError, setCaptureError] = useState(null);
  const slotStyles = useMemo(
    () => [
      {
        light: 'border-sky-800 bg-sky-700 text-white hover:bg-sky-800',
        dark: 'border-sky-700 bg-sky-950 text-sky-200 hover:bg-sky-900'
      },
      {
        light: 'border-emerald-800 bg-emerald-700 text-white hover:bg-emerald-800',
        dark: 'border-emerald-700 bg-emerald-950 text-emerald-200 hover:bg-emerald-900'
      }
    ],
    []
  );

  useEffect(() => {
    if (!hotkeyCaptureRef) return;
    hotkeyCaptureRef.current = Boolean(captureTarget);
    return () => {
      hotkeyCaptureRef.current = false;
    };
  }, [captureTarget, hotkeyCaptureRef]);

  useEffect(() => {
    if (!captureTarget) return;
    const { actionId, index } = captureTarget;
    const handleKeyDown = e => {
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCaptureError(null);
        setCaptureTarget(null);
        return;
      }
      if (e.code === 'Backspace' || e.code === 'Delete') {
        setCaptureError(null);
        setHotkeys(prev => {
          const next = normalizeHotkeys(prev);
          const list = Array.isArray(next[actionId]) ? [...next[actionId]] : [];
          list.splice(index, 1);
          next[actionId] = list;
          return next;
        });
        setCaptureTarget(null);
        return;
      }

      const isOnlyModifier =
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight' ||
        e.code === 'ControlLeft' ||
        e.code === 'ControlRight' ||
        e.code === 'AltLeft' ||
        e.code === 'AltRight' ||
        e.code === 'MetaLeft' ||
        e.code === 'MetaRight';
      if (isOnlyModifier) {
        setCaptureError('Не можна прив’язати тільки модифікатор (Ctrl/Shift/Alt/Cmd)');
        return;
      }

      const binding = buildBindingFromEvent(e);
      const collision = findHotkeyCollision(normalized, binding, {
        excludeActionId: actionId,
        excludeIndex: index
      });
      if (collision) {
        const label = actionLabelById[collision.actionId] || collision.actionId;
        setCaptureError(`Ця комбінація вже використовується: ${label} (слот ${collision.index + 1})`);
        return;
      }

      setHotkeys(prev => {
        const next = normalizeHotkeys(prev);
        const list = Array.isArray(next[actionId]) ? [...next[actionId]] : [];
        list[index] = binding;
        const deduped = list.filter(Boolean);
        const unique = [];
        for (const item of deduped) {
          if (unique.some(existing => serializeHotkey(existing) === serializeHotkey(item))) continue;
          unique.push(item);
        }
        next[actionId] = unique.slice(0, 2);
        return next;
      });
      setCaptureError(null);
      setCaptureTarget(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [captureTarget, normalized, setHotkeys]);

  const resetAll = () => setHotkeys(normalizeHotkeys(DEFAULT_HOTKEYS));
  const beginCapture = next => {
    if (hotkeyCaptureRef) hotkeyCaptureRef.current = true;
    setCaptureError(null);
    setCaptureTarget(next);
  };

  return (
    <div className={`mt-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <h3 className="font-bold text-sm">Хоткеї</h3>
        <button
          onClick={resetAll}
          className={`text-[10px] font-bold px-2 py-1 rounded border ${isDark ? 'border-slate-600 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
          title="Скинути всі хоткеї до дефолтних"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 text-[10px] opacity-70">
        Для кожної дії є 2 слоти (1/2). Клік → натисніть комбінацію. Esc — скасувати. Backspace/Delete — очистити слот. Виняток: Space може бути і Play, і Pan (контекстно).
      </div>
      {captureError && (
        <div className="mt-2 text-[10px] text-rose-500 font-bold">{captureError}</div>
      )}

      <div className="mt-3 space-y-2">
        {HOTKEY_DEFS.map(def => {
          const list = normalized[def.id] || [];
          const slots = [list[0] || null, list[1] || null];
          return (
            <div key={def.id} className="flex items-start justify-between gap-3">
              <div className="text-[11px] font-medium leading-tight pt-1">{def.label}</div>
              <div className="flex flex-wrap justify-end gap-1">
                {slots.map((binding, index) => {
                  const isCapturing =
                    captureTarget?.actionId === def.id && captureTarget?.index === index;
                  const label = isCapturing ? 'Натисни…' : binding ? formatHotkey(binding) : '—';
                  const slotStyle = slotStyles[index] || slotStyles[0];
                  return (
                    <button
                      key={`${def.id}:${index}`}
                      onClick={() => beginCapture({ actionId: def.id, index })}
                      className={`text-[10px] px-2 py-1 rounded border font-mono transition ${isCapturing
                        ? isDark
                          ? 'border-indigo-500 text-indigo-200 bg-indigo-900/40'
                          : 'border-indigo-400 text-indigo-700 bg-indigo-50'
                        : isDark
                          ? slotStyle.dark
                          : slotStyle.light
                        }`}
                      title={`Слот ${index + 1}: клік → натисніть нову комбінацію`}
                    >
                      {index + 1}:{label}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
