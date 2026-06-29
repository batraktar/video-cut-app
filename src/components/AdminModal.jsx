import { useEffect, useRef, useState } from 'react';
import { CloudUpload, Layers, Save } from 'lucide-react';
import { SEGMENT_MODES } from '../lib/editorConstants';

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
  adminAiQueue,
  adminAiLastRequestAt,
  adminAiLastError,
  adminAiRemoteState,
  adminJobProgress,
  adminJob,
  adminJobs,
  adminSheetFilter,
  adminSheetFiltered,
  adminSnapshot,
  adminShowSnapshot,
  adminLogoLoading,
  adminLogoStats,
  adminSyncState,
  importPickerRequest,
  importPickerHandled,
  onImportPickerHandled,
  autoSyncAllowed,
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
  onRunClipchampExport,
  onRunAiSegmentsRemote,
  onPingAiRemote,
  onStopAi,
  onRetryAiFailed,
  onOpenHistory,
  onSelectJob,
  onLoadSheet,
  onSheetFilterChange,
  onToggleSnapshot,
  onLoadSnapshot,
  onSaveSnapshot,
  onApplySnapshot,
  onToggleAutoSync,
  onRunLogo
}) {
  const overlayRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedModes, setSelectedModes] = useState([]);
  const [snowFilter, setSnowFilter] = useState('any');
  const [onlySheet, setOnlySheet] = useState(true);
  const [pickerError, setPickerError] = useState('');

  useEffect(() => {
    if (!open) return;
    const handleKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!importPickerRequest) return;
    if (importPickerRequest <= importPickerHandled) return;
    const timer = window.setTimeout(() => {
      onLoadSheet?.();
      setPickerOpen(true);
      onImportPickerHandled?.(importPickerRequest);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, importPickerRequest, importPickerHandled, onLoadSheet, onImportPickerHandled]);

  if (!open) return null;

  const handleOverlayMouseDown = e => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleOpenPicker = () => {
    onLoadSheet?.();
    setPickerError('');
    setPickerOpen(true);
  };
  const toggleMode = modeId => {
    setSelectedModes(prev =>
      prev.includes(modeId) ? prev.filter(item => item !== modeId) : [...prev, modeId]
    );
  };

  const handleApplyPicker = async () => {
    if (!adminConfig?.baseDir) {
      setPickerError('Спочатку вкажіть робочу теку та збережіть.');
      return;
    }
    if (onSaveConfig) {
      await onSaveConfig();
    }
    onAddVideos({ modes: selectedModes, snow: snowFilter, onlySheet });
    setPickerOpen(false);
  };

  const syncTimeLabel = adminSyncState?.updatedAt
    ? new Date(adminSyncState.updatedAt).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '—';
  const syncStatus = adminSyncState?.status || 'idle';
  const syncLabel = `Синхронізація: ${syncTimeLabel}`;
  const syncDotClass =
    syncStatus === 'syncing'
      ? 'bg-slate-400'
      : syncStatus === 'ok'
        ? 'bg-emerald-500'
        : syncStatus === 'error'
          ? 'bg-red-500'
          : 'bg-slate-400';
  const syncTextClass =
    syncStatus === 'ok'
      ? 'text-emerald-400'
      : syncStatus === 'error'
        ? 'text-red-400'
        : 'text-slate-400';
  const aiTargetLabel = selectedCount > 0 ? `(${selectedCount})` : '';
  const aiLocalLabel = adminAiLoading ? 'AI працює...' : `AI локально ${aiTargetLabel}`.trim();
  const aiRemoteLabel = adminAiLoading ? 'AI працює...' : `AI Colab ${aiTargetLabel}`.trim();
  const hasAiTarget = selectedCount > 0 || !!activeVideo;
  const aiQueue = Array.isArray(adminAiQueue) ? adminAiQueue : [];
  const aiQueueTotal = aiQueue.length;
  const aiQueueDone = aiQueue.filter(item => item.status === 'done').length;
  const aiQueueFailed = aiQueue.filter(item => item.status === 'error').length;
  const aiQueuePending = aiQueue.filter(item => item.status === 'pending').length;
  const aiQueueRunning = aiQueue.filter(item => item.status === 'running').length;
  const aiQueueProgress = aiQueueTotal
    ? Math.round(((aiQueueDone + aiQueueFailed) / aiQueueTotal) * 100)
    : 0;
  const aiLastRequestLabel = adminAiLastRequestAt
    ? new Date(adminAiLastRequestAt).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '—';
  const remoteStatus = adminAiRemoteState?.status || 'idle';
  const remoteDotClass =
    remoteStatus === 'ok'
      ? 'bg-emerald-500'
      : remoteStatus === 'error'
        ? 'bg-rose-500'
        : remoteStatus === 'checking'
          ? 'bg-amber-400'
          : 'bg-slate-400';
  const remoteLabel =
    remoteStatus === 'ok'
      ? 'Online'
      : remoteStatus === 'error'
        ? 'Offline'
        : remoteStatus === 'checking'
          ? 'Checking'
          : '—';
  const aiErrorMessage = adminAiLastError || adminAiRemoteState?.lastError || '';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className={`w-full max-w-5xl rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
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
                onClick={handleOpenPicker}
                className="px-3 py-2 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminLoading}
              >
                Підтягнути з теки
              </button>
            </div>
            {adminImportStats && (
              <div className="mt-2 p-2 rounded bg-slate-100/10 border border-slate-200/10">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                  <span className="text-slate-400">
                    Всього:{' '}
                    <b className={isDark ? 'text-slate-200' : 'text-slate-700'}>
                      {adminImportStats.total ?? 0}
                    </b>
                  </span>
                  <span className="text-emerald-400">Додано: <b>{adminImportStats.added}</b></span>
                  <span className="text-sky-400">В таблиці: <b>{adminImportStats.inSheet}</b></span>
                  <span className="text-amber-400">Фільтр: <b>{adminImportStats.filteredOut || 0}</b></span>
                  <span className="text-rose-400">
                    Немає в табл: <b>{(adminImportStats.unmatchedCount ?? adminImportStats.unmatched?.length) || 0}</b>
                  </span>
                </div>
                {(adminImportStats.unmatchedSample?.length || adminImportStats.unmatched?.length) > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Файли, яких немає в таблиці:</div>
                    <div className="max-h-20 overflow-auto text-[9px] text-rose-300/80 font-mono bg-black/20 p-1 rounded">
                      {(adminImportStats.unmatchedSample || adminImportStats.unmatched || []).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`mt-4 rounded-lg border p-3 ${isDark ? 'border-sky-900/70 bg-sky-950/30' : 'border-sky-200 bg-sky-50'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <CloudUpload className="h-4 w-4 text-sky-500" />
                Clipchamp Drive export
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                Створює нову датовану теку, рендерить відео із суфіксами та додає links_map.csv і логи.
              </div>
            </div>
            <span className="shrink-0 text-[10px] text-slate-400">
              {selectedCount > 0
                ? `Обрано: ${selectedCount}`
                : activeVideo
                  ? 'Поточне відео'
                  : 'Нічого не обрано'}
            </span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <label className="flex flex-col gap-1 text-[10px] text-slate-400">
              Rclone remote
              <input
                type="text"
                value={adminConfig.clipchampDriveRemote || ''}
                onChange={e =>
                  onConfigChange(prev => ({ ...prev, clipchampDriveRemote: e.target.value }))
                }
                className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                placeholder="lqd-kotyk-helper"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-400 md:col-span-2">
              Google Drive Folder URL або ID
              <input
                type="text"
                value={adminConfig.clipchampDriveFolderId || ''}
                onChange={e =>
                  onConfigChange(prev => ({ ...prev, clipchampDriveFolderId: e.target.value }))
                }
                className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                placeholder="1_bNIOZBZfbHQU9oEC2e_5Xqu5lSC4D2H"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-400">
              Префікс нової теки
              <input
                type="text"
                value={adminConfig.clipchampFolderPrefix || ''}
                onChange={e =>
                  onConfigChange(prev => ({ ...prev, clipchampFolderPrefix: e.target.value }))
                }
                className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                placeholder="Clipchamp"
              />
            </label>
            <button
              onClick={onRunClipchampExport}
              disabled={adminLoading || (selectedCount === 0 && !activeVideo)}
              className="self-end rounded bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Вивантажити
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>Тека: Clipchamp_YYYY-MM-DD_HH-mm-ss</span>
            <button
              onClick={onSaveConfig}
              disabled={adminLoading}
              className="rounded border border-slate-500/40 px-2 py-1 font-bold hover:border-slate-400"
            >
              Зберегти налаштування
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50">
            <div className={`w-full max-w-lg rounded-xl p-4 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold">Фільтр перед імпортом</div>
                <button
                  onClick={() => setPickerOpen(false)}
                  className={`text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                  title="Закрити"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 text-xs text-slate-400">
                Оберіть канали/сніг. Якщо канали не вибрані — імпортуються всі.
              </div>
              {pickerError && (
                <div className="mt-2 text-[10px] text-rose-400">{pickerError}</div>
              )}
              <div className="mt-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold mb-2">Канали</div>
                  {selectedModes.length > 0 && (
                    <button
                      onClick={() => setSelectedModes([])}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Очистити
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SEGMENT_MODES.map(mode => {
                    const isActive = selectedModes.includes(mode.id);
                    return (
                      <button
                        key={mode.id}
                        onClick={() => toggleMode(mode.id)}
                        className={`px-2 py-1 rounded-full border text-[10px] font-bold transition ${isActive
                          ? mode.active
                          : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full mr-1 ${mode.dot}`} />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-xs font-bold mb-2">Snow</div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'any', label: 'Будь-які' },
                    { id: 'only', label: 'Тільки snow' },
                    { id: 'exclude', label: 'Без snow' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => setSnowFilter(option.id)}
                      className={`px-2 py-1 rounded-full border text-[10px] font-bold transition ${snowFilter === option.id
                        ? isDark
                          ? 'bg-sky-600 border-sky-500 text-white'
                          : 'bg-sky-600 border-sky-500 text-white'
                        : isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={onlySheet}
                    onChange={e => setOnlySheet(e.target.checked)}
                  />
                  Тільки з таблиці
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="px-3 py-2 rounded text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleApplyPicker}
                    className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Імпортувати
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
              <label className="flex flex-col gap-1 text-[10px] text-slate-400">
                Кадрів на секунду (FPS)
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, aiFps: parseNumericInput(e.target.value) }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                  placeholder="1"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-slate-400">
                Мінімальний сегмент, секунд
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, aiMinDuration: parseNumericInput(e.target.value) }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                  placeholder="2"
                />
              </label>
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
                disabled={adminAiLoading || adminLoading || !hasAiTarget}
              >
                {aiLocalLabel}
              </button>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-4">
              <input
                type="text"
                value={adminConfig.aiRemoteUrl || ''}
                onChange={e => onConfigChange(prev => ({ ...prev, aiRemoteUrl: e.target.value }))}
                className={`md:col-span-3 w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                placeholder="Colab URL (https://xxxx.ngrok-free.app)"
              />
              <button
                onClick={onRunAiSegmentsRemote}
                className="px-3 py-2 rounded text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
                disabled={adminAiLoading || adminLoading || !hasAiTarget || !adminConfig.aiRemoteUrl}
                title={!adminConfig.aiRemoteUrl ? 'Вкажіть Colab URL' : ''}
              >
                {aiRemoteLabel}
              </button>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              1 FPS = аналіз одного кадру щосекунди. Результати надходять по одному відео:
              готові сегменти одразу з’являються в редакторі, а черга працює далі у фоні.
            </div>
            {adminAiStats && (
              <div className="mt-1 text-[10px] text-slate-400">
                Оброблено відео: {adminAiStats.processed}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${remoteDotClass}`} />
                Colab: {remoteLabel}
              </span>
              <button
                onClick={onPingAiRemote}
                className="px-2 py-1 rounded border text-[10px] font-bold border-slate-400/40 text-slate-400 hover:border-slate-300"
                disabled={!adminConfig.aiRemoteUrl || adminAiLoading}
              >
                Ping
              </button>
              <span>Останній запит: {aiLastRequestLabel}</span>
            </div>
            {aiErrorMessage && (
              <div className="mt-1 text-[10px] text-rose-400">
                Помилка: {aiErrorMessage}
              </div>
            )}
            {aiQueueTotal > 0 && (
              <div className="mt-2 rounded border border-slate-200/20 bg-slate-900/20 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
                  <span>
                    Черга AI: {aiQueueDone}/{aiQueueTotal} • В роботі {aiQueueRunning} • Очікує {aiQueuePending} • Помилки {aiQueueFailed}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={onStopAi}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-rose-600/80 hover:bg-rose-600 text-white"
                      disabled={!adminAiLoading}
                    >
                      Стоп
                    </button>
                    <button
                      onClick={onRetryAiFailed}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/80 hover:bg-amber-500 text-white"
                      disabled={adminAiLoading || aiQueueFailed === 0}
                    >
                      Повторити помилки
                    </button>
                  </div>
                </div>
                <div className="mt-2 h-1 w-full rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${aiQueueProgress}%` }}
                  />
                </div>
                <div className="mt-2 max-h-28 overflow-auto text-[10px] text-slate-400">
                  {aiQueue.map(item => (
                    <div key={item.id} className="border-b border-slate-500/10 py-1 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{item.name}</span>
                        <span
                        className={`shrink-0 ${
                          item.status === 'done'
                            ? 'text-emerald-400'
                            : item.status === 'running'
                              ? 'text-amber-400'
                              : item.status === 'error'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                        }`}
                        >
                          {item.status === 'done'
                          ? `готово${Number.isFinite(item.segmentCount) ? ` • ${item.segmentCount} сегм.` : ''}`
                          : item.status === 'running'
                            ? 'в роботі'
                            : item.status === 'error'
                              ? item.error === 'no_segments'
                                ? item.provider === 'colab'
                                  ? 'Colab: порожній result'
                                  : '0 сегментів'
                                : 'помилка'
                                : 'очікує'}
                        </span>
                      </div>
                      {item.taskId && (
                        <div className="truncate font-mono text-[9px] text-slate-500">
                          {item.taskId}
                        </div>
                      )}
                      {item.errorDetail && (
                        <div className="mt-0.5 break-words text-[9px] leading-3 text-rose-300">
                          {item.errorDetail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
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
            <div className={`mt-1 flex items-center gap-2 text-[10px] ${syncTextClass}`}>
              <span className={`inline-block w-2 h-2 rounded-full ${syncDotClass}`} />
              <span>{syncLabel}</span>
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
              <button
                onClick={onToggleAutoSync}
                className={`px-3 py-2 rounded text-xs font-bold border ${autoSyncAllowed
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-700 border-slate-600 text-slate-200'
                  }`}
                disabled={adminLoading}
                title="Автосинхронізація"
              >
                Автосинк: {autoSyncAllowed ? 'ON' : 'OFF'}
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
