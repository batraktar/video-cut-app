export default function FfmpegBatchModal({
  open,
  isDark,
  script,
  skipped,
  onCopy,
  onClose
}) {
  if (!open) return null;
  const hasSkipped = Array.isArray(skipped) && skipped.length > 0;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
      <div
        className={`w-full max-w-2xl rounded-xl p-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}
      >
        <div className="text-sm font-bold mb-2">FFmpeg масовий експорт</div>
        <div className="text-xs text-slate-400 mb-3">
          Запускайте у теці з відео. Вивід буде у `cutted/` без `_done`, а оригінали після
          успішного експорту отримають `_done` і переїдуть в `done/` (якщо є thermal —
          `_done` ставиться на thermal, інакше на analog). За потреби файли підуть у
          Google Drive через `rclone` (`gdrive:22.12.2025 [ATV&Drone]`).
        </div>
        {hasSkipped && (
          <div className="text-[10px] text-amber-500 mb-2">
            Пропущено (немає метаданих): {skipped.join(', ')}
          </div>
        )}
        <textarea
          readOnly
          value={script}
          className={`w-full h-56 text-xs font-mono p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'}`}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onCopy}
            className="flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Скопіювати
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-500 hover:bg-slate-50"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
