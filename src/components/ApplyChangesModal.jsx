export default function ApplyChangesModal({
  open,
  isDark,
  onApplyCrop,
  onApplyAll,
  onClose
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
      <div
        className={`w-full max-w-sm rounded-xl p-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}
      >
        <div className="text-sm font-bold mb-2">Застосувати зміни</div>
        <div className="text-xs text-slate-400 mb-4">
          Оберіть, що саме запікати у відео.
        </div>
        <div className="space-y-2">
          <button
            onClick={onApplyCrop}
            className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Лише обрізання
          </button>
          <button
            onClick={onApplyAll}
            className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Все (обрізання + прямокутники)
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-500 hover:bg-slate-50"
          >
            Скасувати
          </button>
        </div>
      </div>
    </div>
  );
}
