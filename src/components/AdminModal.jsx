import { Layers, Save } from 'lucide-react';

export default function AdminModal({
  open,
  isDark,
  adminError,
  adminHealth,
  adminBaseUrl,
  adminLastRefreshAt,
  adminConfig,
  adminLoading,
  adminImportStats,
  adminAiLoading,
  adminAiStats,
  adminJobProgress,
  adminJob,
  adminJobs,
  adminSheetFilter,
  adminSheetFiltered,
  adminSnapshot,
  adminShowSnapshot,
  adminLogoLoading,
  adminLogoStats,
  selectedCount,
  activeVideo,
  getJobMeta,
  parseNumericInput,
  onClose,
  onBaseUrlChange,
  onPing,
  onConfigChange,
  onPickFolder,
  onSaveConfig,
  onAddVideos,
  onRunAiSegments,
  onOpenHistory,
  onSelectJob,
  onLoadSheet,
  onSheetFilterChange,
  onToggleSnapshot,
  onLoadSnapshot,
  onSaveSnapshot,
  onApplySnapshot,
  onRunLogo
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
      <div className={`w-full max-w-5xl rounded-2xl p-5 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-base font-bold">Адмінка</div>
            <div className="text-[10px] text-slate-400">Локальний сервер • Job runner • Sheet map</div>
          </div>
          <button
            onClick={onClose}
            className={`text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
            title="Закрити"
          >
            ×
          </button>
        </div>
        {adminError && <div className="text-xs text-rose-400 mb-3">{adminError}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold">Підключення</div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border ${adminHealth?.ok
                  ? 'border-emerald-500/60 text-emerald-300 bg-emerald-900/30'
                  : 'border-slate-500/60 text-slate-400 bg-slate-800/40'
                  }`}
              >
                {adminHealth?.ok ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="text"
                value={adminBaseUrl}
                onChange={e => onBaseUrlChange(e.target.value)}
                className={`flex-1 text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="http://localhost:7071"
              />
              <button
                onClick={onPing}
                className="px-3 py-2 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminLoading}
              >
                Ping
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              {adminLastRefreshAt
                ? `Останнє оновлення: ${adminLastRefreshAt.toLocaleTimeString()}`
                : 'Оновлення ще не було'}
            </div>
          </div>

          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2">Робоча тека</div>
            <input
              type="text"
              value={adminConfig.baseDir || ''}
              onChange={e => onConfigChange(prev => ({ ...prev, baseDir: e.target.value }))}
              className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
              placeholder="/Users/mac/Desktop/video_cut/Telegram Uploads/..."
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={onPickFolder}
                className="px-3 py-2 rounded text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white"
                disabled={adminLoading}
              >
                Обрати теку
              </button>
              <button
                onClick={onSaveConfig}
                className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={adminLoading}
              >
                Зберегти
              </button>
              <button
                onClick={onAddVideos}
                className="px-3 py-2 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminLoading}
              >
                Підтягнути з теки
              </button>
            </div>
            {adminImportStats && (
              <div className="mt-2 p-2 rounded bg-slate-100/10 border border-slate-200/10">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                  <span className="text-slate-400">Всього: <b className="text-slate-200">{adminImportStats.total}</b></span>
                  <span className="text-emerald-400">Додано: <b>{adminImportStats.added}</b></span>
                  <span className="text-sky-400">В таблиці: <b>{adminImportStats.inSheet}</b></span>
                  <span className="text-rose-400">Немає в табл: <b>{adminImportStats.unmatched?.length || 0}</b></span>
                </div>
                {adminImportStats.unmatched?.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Файли, яких немає в таблиці:</div>
                    <div className="max-h-20 overflow-auto text-[9px] text-rose-300/80 font-mono bg-black/20 p-1 rounded">
                      {adminImportStats.unmatched.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className={`rounded-lg border p-3 md:col-span-2 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2">AI сегменти</div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                type="text"
                value={adminConfig.aiModelPath || ''}
                onChange={e => onConfigChange(prev => ({ ...prev, aiModelPath: e.target.value }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="/Users/mac/Desktop/video_cut/ml/best.pt"
              />
              <input
                type="text"
                value={adminConfig.aiPythonPath || ''}
                onChange={e => onConfigChange(prev => ({ ...prev, aiPythonPath: e.target.value }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="/Users/mac/Desktop/video_cut/.venv-ml/bin/python"
              />
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <input
                type="number"
                step="0.1"
                value={Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : ''}
                onChange={e => onConfigChange(prev => ({ ...prev, aiFps: parseNumericInput(e.target.value) }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="FPS"
              />
              <input
                type="number"
                step="0.1"
                value={Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : ''}
                onChange={e => onConfigChange(prev => ({ ...prev, aiMinDuration: parseNumericInput(e.target.value) }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Min duration"
              />
              <button
                onClick={onSaveConfig}
                className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={adminLoading || adminAiLoading}
              >
                Зберегти AI
              </button>
              <button
                onClick={onRunAiSegments}
                className="px-3 py-2 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminAiLoading || adminLoading || (selectedCount === 0 && !activeVideo)}
              >
                {adminAiLoading ? 'AI працює...' : selectedCount > 0 ? `AI обрані (${selectedCount})` : 'AI поточне'}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              AI запускає класифікацію кадрів і одразу заповнює сегменти в плеєрі.
            </div>
            {adminAiStats && (
              <div className="mt-1 text-[10px] text-slate-400">
                Оброблено відео: {adminAiStats.processed}
              </div>
            )}
          </div>
        </div>

        {adminJobProgress !== null && (
          <div className="mt-4">
            <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">Прогрес</span>
                <span className="text-xs font-bold text-indigo-400">{Math.round(adminJobProgress)}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${adminJobProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2">Лог поточного job</div>
            <pre className={`p-2 rounded border overflow-auto max-h-40 text-[10px] font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
              {adminJob?.log ? adminJob.log : 'Немає активного job'}
            </pre>
          </div>
        </div>

        {adminJobs.length > 0 && (
          <div className="mt-4">
            <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold">Останні job-и</div>
                <button
                  onClick={onOpenHistory}
                  className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                >
                  Показати всі
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {adminJobs.slice(0, 12).map(job => {
                  const jobMeta = getJobMeta(job);
                  return (
                    <button
                      key={job.id}
                      onClick={() => onSelectJob(job)}
                      className={`px-2 py-1 rounded text-[10px] border ${isDark
                        ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      title={jobMeta.tooltip || undefined}
                    >
                      {jobMeta.label} {job.status}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold">Sheet map</div>
              <button
                onClick={onLoadSheet}
                className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                disabled={adminLoading}
              >
                Оновити
              </button>
            </div>
            <input
              type="text"
              value={adminSheetFilter}
              onChange={e => onSheetFilterChange(e.target.value)}
              placeholder="Пошук по файлу/статусу..."
              className={`mt-2 w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'
                }`}
            />
            <div className="mt-2 text-[10px] text-slate-400">
              Рядків: {adminSheetFiltered.length}
            </div>
            <div className={`mt-2 max-h-48 overflow-auto rounded border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <table className="w-full text-[10px]">
                <thead className={isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}>
                  <tr>
                    <th className="px-2 py-1 text-left">#</th>
                    <th className="px-2 py-1 text-left">Файл</th>
                    <th className="px-2 py-1 text-left">Канал</th>
                    <th className="px-2 py-1 text-left">Камера</th>
                    <th className="px-2 py-1 text-left">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSheetFiltered.slice(0, 100).map(row => (
                    <tr key={`${row.rowIndex}-${row.fileName}`} className={isDark ? 'border-t border-slate-800' : 'border-t border-slate-100'}>
                      <td className="px-2 py-1 text-slate-400">{row.rowIndex}</td>
                      <td className="px-2 py-1">{row.fileName}</td>
                      <td className="px-2 py-1 text-slate-400">{row.analogDigital || '—'}</td>
                      <td className="px-2 py-1 text-slate-400">{row.cameraType || '—'}</td>
                      <td className="px-2 py-1 text-slate-400">{row.status || '—'}</td>
                    </tr>
                  ))}
                  {adminSheetFiltered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-3 text-center text-slate-400">
                        Немає даних
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold">Стан (snapshot)</div>
              <button
                onClick={onToggleSnapshot}
                className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
              >
                {adminShowSnapshot ? 'Сховати' : 'Деталі'}
              </button>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
              Оновлено: {adminSnapshot?.updatedAt || '—'}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={onLoadSnapshot}
                className="px-3 py-2 rounded text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white"
                disabled={adminLoading}
              >
                Оновити snapshot
              </button>
              <button
                onClick={onSaveSnapshot}
                className="px-3 py-2 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white"
                disabled={adminLoading}
              >
                Зберегти стан
              </button>
              <button
                onClick={onApplySnapshot}
                className="px-3 py-2 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white"
                disabled={adminLoading || !adminSnapshot?.payload}
              >
                Застосувати стан
              </button>
            </div>
            {adminShowSnapshot && (
              <pre className={`mt-2 p-2 rounded border overflow-auto max-h-40 text-[10px] ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                {adminSnapshot ? JSON.stringify(adminSnapshot, null, 2) : '—'}
              </pre>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2">Лого детекція (без тренування)</div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                type="text"
                value={adminConfig.logoTemplatePath || ''}
                onChange={e => onConfigChange(prev => ({ ...prev, logoTemplatePath: e.target.value }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="image.png"
              />
              <div className="grid gap-2 grid-cols-3">
                <input
                  type="number"
                  step="0.1"
                  value={Number.isFinite(adminConfig.logoFps) ? adminConfig.logoFps : ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, logoFps: parseNumericInput(e.target.value) }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                  placeholder="FPS"
                />
                <input
                  type="number"
                  step="1"
                  value={Number.isFinite(adminConfig.logoSize) ? adminConfig.logoSize : ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, logoSize: parseNumericInput(e.target.value) }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                  placeholder="Розмір"
                />
                <input
                  type="number"
                  step="0.01"
                  value={Number.isFinite(adminConfig.logoThreshold) ? adminConfig.logoThreshold : ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, logoThreshold: parseNumericInput(e.target.value) }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                  placeholder="Threshold"
                />
              </div>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <input
                type="number"
                step="0.1"
                value={Number.isFinite(adminConfig.logoMinDuration) ? adminConfig.logoMinDuration : ''}
                onChange={e => onConfigChange(prev => ({ ...prev, logoMinDuration: parseNumericInput(e.target.value) }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Min duration"
              />
              <input
                type="text"
                value={adminConfig.logoScales || ''}
                onChange={e => onConfigChange(prev => ({ ...prev, logoScales: e.target.value }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Scales (0.9,1.0,1.1)"
              />
              <input
                type="number"
                step="1"
                value={Number.isFinite(adminConfig.logoMaxMatches) ? adminConfig.logoMaxMatches : ''}
                onChange={e => onConfigChange(prev => ({ ...prev, logoMaxMatches: parseNumericInput(e.target.value) }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Max matches"
              />
              <input
                type="number"
                step="0.1"
                value={Number.isFinite(adminConfig.logoMaxGap) ? adminConfig.logoMaxGap : ''}
                onChange={e => onConfigChange(prev => ({ ...prev, logoMaxGap: parseNumericInput(e.target.value) }))}
                className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Max gap"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={onSaveConfig}
                className="flex-1 px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={adminLoading || adminLogoLoading}
              >
                Зберегти лого
              </button>
              <button
                onClick={onRunLogo}
                className="flex-1 px-3 py-2 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminLogoLoading || adminLoading || (selectedCount === 0 && !activeVideo)}
              >
                {adminLogoLoading
                  ? 'Лого працює...'
                  : selectedCount > 0
                    ? `Лого обрані (${selectedCount})`
                    : 'Лого поточне'}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Пошук шаблону логотипа і додавання чорних прямокутників у плеєрі (до {adminConfig.logoMaxMatches || 5} збігів на кадр, масштаби {adminConfig.logoScales || '1.0'}).
            </div>
            {adminLogoStats && (
              <div className="mt-1 text-[10px] text-slate-400">Оброблено відео: {adminLogoStats.processed}</div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900 shadow-xl' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Google Sheet</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-tight">Sheet ID</label>
                </div>
                <input
                  type="text"
                  value={adminConfig.sheetId || ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, sheetId: e.target.value }))}
                  className={`w-full text-[11px] p-2 rounded border focus:ring-1 focus:ring-sky-500 outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-white border-slate-200 focus:border-sky-400'}`}
                  placeholder="ID таблиці"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-tight">Sheet GID (Tab ID)</label>
                </div>
                <input
                  type="text"
                  value={adminConfig.sheetGid || ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, sheetGid: e.target.value }))}
                  className={`w-full text-[11px] p-2 rounded border focus:ring-1 focus:ring-sky-500 outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-white border-slate-200 focus:border-sky-400'}`}
                  placeholder="GID аркуша"
                />
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={onSaveConfig}
                className="w-full px-3 py-2 rounded text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center justify-center gap-2"
                disabled={adminLoading}
              >
                <Save className="w-3.5 h-3.5" />
                Зберегти налаштування таблиці
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
