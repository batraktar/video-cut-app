import React, { useMemo } from 'react';

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export default function SnowSettings({ isDark, snowSpeed, setSnowSpeed }) {
  const safeSpeed = Number.isFinite(snowSpeed) ? snowSpeed : 1;
  const label = useMemo(() => `${safeSpeed.toFixed(2)}x`, [safeSpeed]);

  return (
    <div className={`mt-3 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
        <h3 className="font-bold text-sm">Сніг</h3>
        <div className={`text-[10px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
          {label}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-medium opacity-80">Швидкість</div>
          <div className="flex gap-1">
            {[0.5, 1, 2].map(preset => (
              <button
                key={preset}
                onClick={() => setSnowSpeed(preset)}
                className={`text-[10px] font-bold px-2 py-1 rounded border transition ${Math.abs(safeSpeed - preset) < 0.001
                  ? isDark
                    ? 'bg-sky-900/40 border-sky-700 text-sky-200'
                    : 'bg-sky-100 border-sky-200 text-sky-700'
                  : isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                title="Швидкість снігу"
              >
                {preset}x
              </button>
            ))}
          </div>
        </div>

        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={clamp(safeSpeed, 0.25, 3)}
          onChange={e => {
            const next = clamp(Number(e.target.value), 0.25, 3);
            setSnowSpeed(next);
          }}
          className="w-full"
        />

        <div className="text-[10px] opacity-70">
          Розмір і прозорість — випадкові (невеликі). Сніг — тільки UI, не потрапляє у відео/експорт.
        </div>
      </div>
    </div>
  );
}

