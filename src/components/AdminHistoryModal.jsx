export default function AdminHistoryModal({
  open,
  isDark,
  adminJobs,
  getJobMeta,
  getJobProgress,
  onClose,
  onSelectJob,
  onStopJob
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60">
      <div className={`w-full max-w-4xl rounded-2xl p-4 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-bold">Історія job-ів</div>
          <button
            onClick={onClose}
            className={`text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
            title="Закрити"
          >
            ×
          </button>
        </div>
        <div className="text-[10px] text-slate-400 mb-3">
          Клік по рядку відкриє job у головному блоці логів.
        </div>
        <div className={`max-h-[60vh] overflow-auto rounded border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <table className="w-full text-[10px]">
            <thead className={isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}>
              <tr>
                <th className="px-2 py-1 text-left">Файл</th>
                <th className="px-2 py-1 text-left">Статус</th>
                <th className="px-2 py-1 text-left">Прогрес</th>
                <th className="px-2 py-1 text-right">Дії</th>
              </tr>
            </thead>
            <tbody>
              {adminJobs.map(job => {
                const meta = getJobMeta(job);
                const progress = getJobProgress(job);
                const isStoppable = job.status === 'running' || job.status === 'queued';
                return (
                  <tr
                    key={job.id}
                    className={isDark ? 'border-t border-slate-800' : 'border-t border-slate-100'}
                    onClick={() => {
                      onSelectJob(job);
                      onClose();
                    }}
                  >
                    <td className="px-2 py-1" title={meta.tooltip || undefined}>
                      {meta.label}
                    </td>
                    <td className="px-2 py-1 text-slate-400">{job.status}</td>
                    <td className="px-2 py-1">
                      {progress === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 bg-slate-200/40 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-slate-400">{Math.round(progress)}%</span>
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          onSelectJob(job);
                          onClose();
                        }}
                        className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                      >
                        Відкрити
                      </button>
                      <button
                        onClick={() => onStopJob(job.id)}
                        disabled={!isStoppable}
                        className={`ml-2 text-[10px] px-2 py-1 rounded border disabled:opacity-40 ${isDark ? 'border-rose-700 text-rose-400 hover:bg-rose-900/30' : 'border-rose-300 text-rose-500 hover:bg-rose-50'}`}
                      >
                        Зупинити
                      </button>
                    </td>
                  </tr>
                );
              })}
              {adminJobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-slate-400">
                    Немає job-ів
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
