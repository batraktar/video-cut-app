import { useEffect, useRef, useState } from 'react';
import { PanelRightOpen, Pin, PinOff, Scissors, SlidersHorizontal } from 'lucide-react';

const PIN_STORAGE_KEY = 'videoCut.inspectorPinned.v1';
const WIDTH_STORAGE_KEY = 'videoCut.inspectorWidth.v1';

const loadBoolean = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const saved = window.localStorage.getItem(key);
  return saved === null ? fallback : saved === 'true';
};

const loadWidth = () => {
  if (typeof window === 'undefined') return 300;
  const saved = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
  return Number.isFinite(saved) ? Math.min(440, Math.max(280, saved)) : 300;
};

export default function InspectorDrawer({ isDark, segmentCount = 0, children }) {
  const [pinned, setPinned] = useState(() => loadBoolean(PIN_STORAGE_KEY, false));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(loadWidth);
  const closeTimerRef = useRef(null);
  const resizeRef = useRef(null);
  const open = pinned || hovered || focused;

  const cancelClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setHovered(true);
  };

  const scheduleClose = () => {
    if (pinned || focused) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setHovered(false), 380);
  };

  useEffect(() => {
    window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  }, [pinned]);

  useEffect(() => {
    window.localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  }, [width]);

  useEffect(() => {
    const onMove = event => {
      if (!resizeRef.current) return;
      const delta = resizeRef.current.startX - event.clientX;
      setWidth(Math.min(440, Math.max(280, resizeRef.current.startWidth + delta)));
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const startResize = event => {
    if (event.button !== 0) return;
    event.preventDefault();
    setPinned(true);
    resizeRef.current = { startX: event.clientX, startWidth: width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const railButton = 'relative flex h-10 w-10 items-center justify-center rounded-md transition';

  return (
    <div
      className="relative z-40 hidden h-full shrink-0 lg:block"
      style={{ width: pinned ? width + 52 : 52 }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => {
        setFocused(true);
        cancelClose();
      }}
      onBlurCapture={event => {
        if (event.currentTarget.contains(event.relatedTarget)) return;
        setFocused(false);
        if (!pinned) {
          if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
          closeTimerRef.current = window.setTimeout(() => setHovered(false), 380);
        }
      }}
    >
      <section
        className={`absolute bottom-0 top-0 z-10 flex flex-col border-l shadow-[-18px_0_36px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-200 ${
          isDark ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-50'
        } ${open ? 'translate-x-0 opacity-100' : 'translate-x-2 pointer-events-none opacity-0'}`}
        style={{ right: 52, width }}
        aria-hidden={!open}
        inert={!open}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <div
          className={`flex h-10 shrink-0 items-center justify-between border-b px-3 ${
            isDark ? 'border-slate-700' : 'border-slate-200'
          }`}
        >
          <span className="text-xs font-bold">Інспектор</span>
          <button
            type="button"
            onClick={() => setPinned(value => !value)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold ${
              pinned ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-400 hover:bg-slate-700/20'
            }`}
          >
            {pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            {pinned ? 'Відкріпити' : 'Закріпити'}
          </button>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
        <div
          className="absolute bottom-0 left-0 top-0 w-1.5 cursor-col-resize hover:bg-cyan-400/40"
          onMouseDown={startResize}
          title="Змінити ширину"
        />
      </section>

      <aside
        className={`absolute bottom-0 right-0 top-0 flex w-[52px] flex-col items-center gap-1 border-l px-1.5 py-2 ${
          isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'
        }`}
      >
        <button
          type="button"
          onClick={cancelClose}
          className={`${railButton} ${open ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-400 hover:bg-slate-700/20'}`}
          title="Відкрити інспектор"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancelClose}
          className={`${railButton} text-slate-400 hover:bg-slate-700/20`}
          title="Сегменти"
        >
          <Scissors className="h-4 w-4" />
          {segmentCount > 0 && (
            <span className="absolute right-0 top-0 min-w-4 rounded-full bg-emerald-500 px-1 text-center text-[8px] font-bold text-white">
              {segmentCount > 99 ? '99+' : segmentCount}
            </span>
          )}
        </button>
        <div className="my-1 h-px w-8 bg-slate-600/40" />
        <button
          type="button"
          onClick={() => setPinned(value => !value)}
          className={`${railButton} ${pinned ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-400 hover:bg-slate-700/20'}`}
          title={pinned ? 'Відкріпити панель' : 'Закріпити панель'}
        >
          {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <PanelRightOpen className="mt-auto h-4 w-4 text-slate-600" />
      </aside>
    </div>
  );
}
