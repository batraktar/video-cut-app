import { ListTodo, Square } from 'lucide-react';

export default function JobStatusBar({
  job,
  progress,
  isDark,
  getJobMeta,
  onOpenHistory,
  onStopJob
}) {
  const isActive = job?.status === 'running' || job?.status === 'queued';
  if (!isActive) return null;

  const meta = getJobMeta(job);
  const hasProgress = Number.isFinite(progress);
  const safeProgress = hasProgress ? Math.max(0, Math.min(100, progress)) : null;
  const statusLabel = job.status === 'queued' ? 'У черзі' : 'Виконується';

  return (
    <aside
      className={`fixed bottom-4 left-1/2 z-[9995] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl backdrop-blur ${
        isDark
          ? 'border-slate-700 bg-slate-900/95 text-slate-100'
          : 'border-slate-200 bg-white/95 text-slate-800'
      }`}
      aria-live="polite"
      aria-label="Статус фонового завдання"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-50" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
            <span className="font-bold uppercase tracking-wide">{statusLabel}</span>
            <span>{hasProgress ? `${Math.round(safeProgress)}%` : 'Обробка…'}</span>
          </div>
          <div className="truncate text-xs font-semibold" title={meta.tooltip || meta.label}>
            {meta.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenHistory}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
            isDark
              ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
          title="Відкрити завдання та логи"
        >
          <ListTodo className="h-3.5 w-3.5" />
          Деталі
        </button>
        <button
          type="button"
          onClick={() => onStopJob(job.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-2 py-1.5 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10"
          title="Зупинити завдання"
        >
          <Square className="h-3 w-3 fill-current" />
          Стоп
        </button>
      </div>
      <div className="h-1 bg-slate-500/15">
        {hasProgress ? (
          <div
            className="h-full bg-indigo-500 transition-[width] duration-500"
            style={{ width: `${safeProgress}%` }}
          />
        ) : (
          <div className="h-full w-1/3 animate-pulse rounded-full bg-indigo-500" />
        )}
      </div>
    </aside>
  );
}
