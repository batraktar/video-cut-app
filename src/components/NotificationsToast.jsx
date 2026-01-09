export default function NotificationsToast({ notifications, isDark, onDismiss }) {
  if (!Array.isArray(notifications) || notifications.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9998] space-y-2 w-64">
      {notifications.map(note => {
        const statusText =
          note.status === 'done'
            ? 'Готово'
            : note.status === 'canceled'
              ? 'Зупинено'
              : 'В процесі';
        return (
          <div
            key={note.id}
            className={`rounded-lg border shadow-lg p-3 ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
              }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold truncate">{note.name}</div>
              <button
                onClick={() => onDismiss(note.id)}
                className="text-slate-400 hover:text-slate-700 text-xs"
                title="Закрити"
              >
                ×
              </button>
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              {note.type === 'crop' ? 'Обрізання' : 'Експорт'} • {statusText}
            </div>
            <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${note.status === 'done' ? 'bg-emerald-500' : note.status === 'canceled' ? 'bg-rose-400' : 'bg-indigo-500'
                  }`}
                style={{ width: `${Math.round(note.progress || 0)}%` }}
              />
            </div>
            <div className="mt-1 text-[10px] text-slate-400 text-right">
              {Math.round(note.progress || 0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
