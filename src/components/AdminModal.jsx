import { useEffect, useRef, useState } from 'react';
import { CloudUpload, Layers, RefreshCw, Save } from 'lucide-react';
import { SEGMENT_MODES } from '../lib/editorConstants';
import { formatMismatchHuman } from '../lib/mismatchText';
import {
  formatExportBytes,
  getClipchampJobStatus,
  getExportFileStatusLabel,
  getJobStatusLabel
} from '../features/export/clipchampJobStatus';

const ADMIN_TABS = [
  { id: 'files', label: 'Файли' },
  { id: 'ai', label: 'AI' },
  { id: 'drive', label: 'Google Drive' },
  { id: 'jobs', label: 'Завдання' },
  { id: 'data', label: 'Дані' }
];
const AI_SHEET_ADDITIONS_ENABLED = false;

const formatTransferSize = bytes => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(0)} КБ`;
  return `${(value / 1024 ** 2).toFixed(1)} МБ`;
};

export default function AdminModal({
  open,
  initialTab = 'files',
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
  adminAiSheetSuggestions = [],
  adminAiLastRequestAt,
  adminAiLastError,
  adminAiDriveCheck,
  adminAiColabMode,
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
  onSyncSheetFromCsv,
  onSaveGoogleCredentials,
  onAddVideos,
  onRunAiSegments,
  onRunAiSegmentsNgrok,
  onRunClipchampExport,
  onRetryIncompleteJob,
  onRunAiSegmentsRemote,
  onColabModeChange,
  onPingAiRemote,
  onCheckAiDrive,
  onStopAi,
  onPullServerResults,
  onRetryAiFailed,
  onRefreshAiBatch,
  onConfirmAiSheetSuggestion,
  onDismissAiSheetSuggestion,
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
  const [onlySheet, setOnlySheet] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [activeTab, setActiveTab] = useState(initialTab);
  const [googleServiceAccountJson, setGoogleServiceAccountJson] = useState('');
  const [googleCredentialsError, setGoogleCredentialsError] = useState('');
  const [technicalLogCopied, setTechnicalLogCopied] = useState(false);
  const [copiedAiRowId, setCopiedAiRowId] = useState('');

  const copyAiSheetSuggestionRow = async suggestion => {
    const row = suggestion?.row || {};
    const values = [
      row.link,
      row.double,
      row.status,
      row.cameraType,
      row.labels,
      row.analogDigital,
      row.cuttedLink,
      '',
      row.fileName
    ].map(value => String(value || '').replace(/[\t\r\n]+/g, ' '));
    try {
      await navigator.clipboard.writeText(values.join('\t'));
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = values.join('\t');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedAiRowId(suggestion.id);
    window.setTimeout(() => setCopiedAiRowId(''), 1400);
  };

  const saveGoogleCredentials = async () => {
    setGoogleCredentialsError('');
    const result = await onSaveGoogleCredentials(googleServiceAccountJson);
    if (result === 'ok') {
      setGoogleServiceAccountJson('');
      return;
    }
    const messages = {
      credentials_json_invalid: 'JSON пошкоджений або скопійований не повністю. Встав увесь вміст нового JSON-файлу.',
      credentials_fields_missing: 'У JSON не знайдено client_email або private_key. Потрібен повний JSON-ключ Service Account.',
      credentials_key_invalid: 'Ключ недійсний або відкликаний. Створи новий JSON-ключ Service Account і встав увесь файл.',
      sheets_api_disabled: 'У проєкті Google Cloud вимкнено Google Sheets API. Увімкни його й повтори перевірку.',
      sheet_access_denied: 'Немає доступу до таблиці. Поділися нею з client_email із JSON як із Редактором.',
      spreadsheet_not_found_or_unshared: 'Таблицю не знайдено. Перевір Sheet ID і доступ Service Account до неї.',
      google_validation_failed: 'Google не підтвердив доступ. Перевір новий JSON-ключ, Sheet ID і доступ Service Account.'
    };
    setGoogleCredentialsError(messages[result] || 'Перевір підключення до локального сервера й повтори спробу.');
  };

  useEffect(() => {
    if (!open) return;
    const handleKey = e => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const clipchampStatus = getClipchampJobStatus(adminJob);
  const copyTechnicalLog = async () => {
    if (!adminJob?.log || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(adminJob.log);
      setTechnicalLogCopied(true);
      window.setTimeout(() => setTechnicalLogCopied(false), 1800);
    } catch {
      setTechnicalLogCopied(false);
    }
  };

  if (!open) return null;

  const handleOverlayMouseDown = e => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleOpenPicker = () => {
    onLoadSheet?.();
    setPickerError('');
    setOnlySheet(false);
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
  const isRemoteHost =
    typeof window !== 'undefined' &&
    !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const aiLocalLabel = adminAiLoading ? 'AI працює...' : `AI локально ${aiTargetLabel}`.trim();
  const aiRemoteLabel = adminAiLoading ? 'AI працює...' : `AI Colab ${aiTargetLabel}`.trim();
  const hasAiTarget = selectedCount > 0 || !!activeVideo;
  const aiQueue = Array.isArray(adminAiQueue) ? adminAiQueue : [];
  const aiQueueTotal = aiQueue.length;
  const aiQueueDone = aiQueue.filter(item => item.status === 'done').length;
  const aiQueueFailed = aiQueue.filter(item => item.status === 'error').length;
  const aiQueueMismatch = aiQueue.filter(item => item.status === 'mismatch').length;
  const aiQueuePending = aiQueue.filter(item => item.status === 'pending').length;
  const aiQueueUploading = aiQueue.filter(item => item.status === 'uploading').length;
  const aiQueueAccepted = aiQueue.filter(item => item.status === 'accepted').length;
  const aiQueueProcessing = aiQueue.filter(item => item.status === 'processing').length;
  const aiQueueRunning = aiQueue.filter(item => item.status === 'running').length;
  const aiLastRequestLabel = adminAiLastRequestAt
    ? new Date(adminAiLastRequestAt).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '—';
  const aiErrorMessage = adminAiLastError || '';

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
            {isRemoteHost && (
              <a
                href="/panel"
                className="mt-2 inline-block rounded bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700"
              >
                📋 Панель сервера
              </a>
            )}
            {isRemoteHost && (
              <button
                onClick={onPullServerResults}
                className="mt-2 ml-2 inline-block rounded bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-sky-700"
              >
                ⬇ Забрати нарізки з сервера
              </button>
            )}
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

        <div
          className={`sticky top-0 z-10 mb-4 flex gap-1 overflow-x-auto rounded-xl border p-1 backdrop-blur ${
            isDark
              ? 'border-slate-800 bg-slate-900/95'
              : 'border-slate-200 bg-white/95'
          }`}
          role="tablist"
          aria-label="Розділи адмінки"
        >
          {ADMIN_TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const badge =
              tab.id === 'jobs' && adminJobs.length > 0
                ? adminJobs.length
                : tab.id === 'ai' && aiQueueTotal > 0
                  ? `${aiQueueDone}/${aiQueueTotal}`
                  : null;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : isDark
                      ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {badge !== null && (
                  <span
                    className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === 'files' && (
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
                {adminHealth === null ? 'Перевірка…' : adminHealth.ok ? 'Online' : 'Offline'}
              </span>
            </div>
            {!isRemoteHost && (
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
            )}
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
                  <span className="text-indigo-400">Оновлено: <b>{adminImportStats.updated || 0}</b></span>
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
        )}

        {activeTab === 'drive' && (
        <div className={`rounded-lg border p-3 ${isDark ? 'border-sky-900/70 bg-sky-950/30' : 'border-sky-200 bg-sky-50'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <CloudUpload className="h-4 w-4 text-sky-500" />
                Clipchamp Drive export
              </div>
              <div className="mt-1 text-[10px] text-slate-400">
                Рендерить вибрані відео в локальну датовану теку, а готові відеофайли завантажує безпосередньо у вказану теку Google Drive.
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
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={adminConfig.clipchampUploadToDrive !== false}
              onChange={e =>
                onConfigChange(prev => ({ ...prev, clipchampUploadToDrive: e.target.checked }))
              }
              className="h-4 w-4 accent-sky-600"
            />
            Також завантажувати готові відео в Google Drive
          </label>
          {adminConfig.clipchampUploadToDrive === false && (
            <p className="mt-1 text-[10px] text-slate-400">
              Вимкнено: результат залишиться в `Clipchamp_exports` у робочій папці локального сервера.
            </p>
          )}
          <div className="mt-3 grid gap-2 md:grid-cols-5">
            <label className="flex flex-col gap-1 text-[10px] text-slate-400">
              Назва rclone-підключення (remote)
              <input
                type="text"
                value={adminConfig.clipchampDriveRemote || ''}
                disabled={adminConfig.clipchampUploadToDrive === false}
                onChange={e =>
                  onConfigChange(prev => ({ ...prev, clipchampDriveRemote: e.target.value }))
                }
                className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                placeholder="my-google-drive"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-400 md:col-span-2">
              Посилання або ID папки Google Drive
              <input
                type="text"
                value={adminConfig.clipchampDriveFolderId || ''}
                disabled={adminConfig.clipchampUploadToDrive === false}
                onChange={e =>
                  onConfigChange(prev => ({ ...prev, clipchampDriveFolderId: e.target.value }))
                }
                className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                placeholder="https://drive.google.com/drive/folders/..."
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] text-slate-400">
              Префікс локальної теки
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
          <details className={`mt-3 rounded border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-900/60 text-slate-300' : 'border-sky-200 bg-white/80 text-slate-700'}`}>
            <summary className="cursor-pointer font-bold">Як надати редактору доступ до Google Drive</summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Доступ налаштовується один раз на цьому комп’ютері через rclone. У параметрах нижче вкажи назву remote і папку, куди можна завантажувати файли. Пароль Google тут вводити не потрібно.
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>
                  Встанови <a className="font-semibold underline" href="https://rclone.org/downloads/" target="_blank" rel="noreferrer">rclone</a> на той самий комп’ютер, де запущено редактор.
                </li>
                <li>
                  Відкрий Terminal (Mac) або PowerShell (Windows), введи <code className="rounded bg-black/10 px-1">rclone config</code>, обери створення нового remote, задай йому назву як у полі нижче та вибери Google Drive (`drive`).
                </li>
                <li>
                  Для стабільного доступу створи власні OAuth Client ID і Secret за <a className="font-semibold underline" href="https://rclone.org/drive/#making-your-own-client-id" target="_blank" rel="noreferrer">інструкцією rclone</a>. У майстрі rclone введи їх, обери scope `drive`, дозволь авторизацію в браузері та увійди в Google-акаунт із правом редактора для цільової папки.
                </li>
                <li>
                  Перевір доступ командою <code className="rounded bg-black/10 px-1">rclone lsd {String(adminConfig.clipchampDriveRemote || 'my-google-drive').trim().replace(/:+$/, '')}:</code>. Якщо команда показує папки без помилки, встав посилання на папку Drive у поле нижче та натисни «Зберегти налаштування».
                </li>
              </ol>
              <p className="text-slate-400">
                Remote і авторизація зберігаються локально в профілі користувача ОС, а не у вебредакторі. Для Shared Drive під час налаштування rclone обери, що це Shared Drive.
              </p>
            </div>
          </details>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>Локально: Clipchamp_YYYY-MM-DD_HH-mm-ss · Drive: у вказану теку</span>
            <button
              onClick={onSaveConfig}
              disabled={adminLoading}
              className="rounded border border-slate-500/40 px-2 py-1 font-bold hover:border-slate-400"
            >
              Зберегти налаштування
            </button>
          </div>
        </div>
        )}

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

        {activeTab === 'ai' && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`rounded-lg border p-3 md:col-span-2 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            <div className="text-xs font-bold mb-2">AI сегменти</div>
            <div className={`mb-3 inline-flex rounded-lg border p-1 ${isDark ? 'border-slate-700 bg-slate-950' : 'border-slate-200 bg-white'}`} role="group" aria-label="Режим Colab">
              {[
                { id: 'ngrok', label: 'Colab · Cloudflare / ngrok' },
                { id: 'drive', label: 'Новий Colab · Drive' }
              ].map(option => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={adminAiColabMode === option.id}
                  onClick={() => onColabModeChange(option.id)}
                  className={`rounded-md px-3 py-2 text-xs font-semibold transition-colors ${adminAiColabMode === option.id ? 'bg-indigo-600 text-white' : isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {option.label}
                </button>
              ))}
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
            </div>
            {adminAiColabMode === 'ngrok' ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[10px] text-slate-400">
                  Colab tunnel URL (Cloudflare або ngrok)
                  <input
                    type="text"
                    value={adminConfig.aiRemoteUrl || ''}
                    onChange={e => onConfigChange(prev => ({ ...prev, aiRemoteUrl: e.target.value }))}
                    className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                    placeholder="https://xxxx.trycloudflare.com"
                  />
                </label>
                <button
                  onClick={onPingAiRemote}
                  className="self-end rounded border border-slate-400/40 px-3 py-2 text-xs font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  disabled={adminLoading || adminAiLoading || !adminConfig.aiRemoteUrl}
                >
                  Ping Colab
                </button>
                <button
                  onClick={onRunAiSegmentsNgrok}
                  className="self-end rounded bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700"
                  disabled={adminAiLoading || adminLoading || !hasAiTarget || !adminConfig.aiRemoteUrl}
                >
                  {adminAiLoading ? 'Colab працює…' : `Запустити старий Colab ${aiTargetLabel}`}
                </button>
                <div className="w-full text-[10px] text-slate-400">
                  Режим надсилає відео до активного notebook через Cloudflare або ngrok. {adminAiRemoteState?.status === 'ok' ? 'Colab на зв’язку.' : adminAiRemoteState?.lastError ? `Зв’язок: ${adminAiRemoteState.lastError}` : 'Запусти notebook і встав його поточний tunnel URL.'}
                </div>
              </div>
            ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[10px] text-slate-400">
                rclone remote для AI у My Drive
                <input
                  type="text"
                  value={adminConfig.aiDriveRemote || ''}
                  onChange={e => onConfigChange(prev => ({ ...prev, aiDriveRemote: e.target.value }))}
                  className={`w-full rounded border p-2 text-xs ${isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}
                  placeholder="best2-my-drive"
                  aria-label="rclone remote для AI черги"
                />
              </label>
              <button
                onClick={onCheckAiDrive}
                className="self-end rounded border border-slate-400/40 px-3 py-2 text-xs font-bold text-slate-500 hover:border-slate-300 hover:text-slate-700"
                disabled={adminLoading || adminAiLoading}
              >
                Перевірити Drive
              </button>
              <div className="min-w-0 flex-1 text-[10px] text-slate-400">
                Batch піде у <code>best2_training/colab_jobs</code> через <span className="font-semibold">{adminConfig.aiDriveRemote || 'вкажи My Drive remote'}</span>.
                У корені цього remote має бути папка <code>best2_training</code>. Remote Clipchamp налаштовується окремо у вкладці Google Drive.
              </div>
              <button
                onClick={onRunAiSegmentsRemote}
                className="px-3 py-2 rounded text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
                disabled={adminAiLoading || adminLoading || !hasAiTarget || !adminConfig.aiDriveRemote}
                title={!adminConfig.aiDriveRemote ? 'Вкажи rclone remote, що веде до My Drive' : ''}
              >
                {aiRemoteLabel} → Drive
              </button>
            </div>)}
            {adminAiColabMode === 'drive' && <div className="mt-1 text-[10px] text-slate-400">
              Натисни «Зберегти AI». Перевір у Terminal: <code>rclone lsd REMOTE:</code> має показати <code>best2_training</code>. Якщо ні — створи окремий rclone remote для особистого My Drive, не Shared Drive, і авторизуй тим самим Google-акаунтом.
            </div>}
            {adminAiColabMode === 'drive' && adminAiDriveCheck && (
              <div className={`mt-1 break-words text-[10px] ${adminAiDriveCheck.startsWith('Drive підключений') ? 'text-emerald-600' : adminAiDriveCheck.startsWith('Перевіряю') ? 'text-amber-500' : 'text-rose-500'}`}>
                {adminAiDriveCheck}
              </div>
            )}
            {adminAiColabMode === 'drive' && <div className="mt-1 text-[10px] text-slate-400">
              Після прийому всіх відео localhost можна вимкнути. Поки Colab обробляє чергу, не зупиняй notebook; результати залишаться в Drive й переживуть завершення runtime.
            </div>}
            {adminAiStats && (
              <div className="mt-1 text-[10px] text-slate-400">
                {adminAiColabMode === 'drive' ? `У Drive: ${adminAiStats.accepted ?? 0} • ` : ''}Оброблено: {adminAiStats.processed ?? 0} • помилки: {adminAiStats.failed ?? 0}{(adminAiStats.mismatched ?? 0) > 0 ? ` • перевір тип: ${adminAiStats.mismatched}` : ''}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
              {adminAiColabMode === 'drive' && <span>Статуси зберігаються на Drive</span>}
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
                    {adminAiColabMode === 'drive'
                      ? `Не передано: ${aiQueuePending} • Передається: ${aiQueueUploading} • У Drive, чекають Colab: ${aiQueueAccepted} • Colab обробляє: ${aiQueueProcessing} • Готово: ${aiQueueDone}/${aiQueueTotal} • Помилки: ${aiQueueFailed}`
                      : `Очікує: ${aiQueuePending} • У роботі: ${aiQueueRunning} • Готово: ${aiQueueDone}/${aiQueueTotal} • Помилки: ${aiQueueFailed}${aiQueueMismatch > 0 ? ` • Перевір тип: ${aiQueueMismatch}` : ''}`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={onStopAi}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-rose-600/80 hover:bg-rose-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={!adminAiLoading}
                      title={adminAiColabMode === 'drive' ? 'Зупиняє передавання та просить Drive-чергу скасувати задачі' : 'Зупиняє активний запит до старого Colab'}
                    >
                      Стоп
                    </button>
                    <button
                      onClick={onRetryAiFailed}
                      className="px-2 py-1 rounded text-[10px] font-bold bg-amber-500/80 hover:bg-amber-500 text-white"
                      disabled={adminAiLoading || (aiQueueFailed === 0 && aiQueueMismatch === 0)}
                    >
                      Повторити помилки
                    </button>
                    {aiQueue.some(item => item.provider === 'colab' && item.batchId) && (
                      <button
                        onClick={onRefreshAiBatch}
                        className="px-2 py-1 rounded text-[10px] font-bold bg-sky-600/80 hover:bg-sky-600 text-white"
                        disabled={adminAiLoading}
                      >
                        Оновити з Drive
                      </button>
                    )}
                  </div>
                </div>
                {adminAiColabMode === 'drive' && <div className="mt-1 text-[9px] leading-3 text-slate-500">
                  «У Drive • очікує Colab» означає, що оригінал уже передано, але сегменти ще не створені.
                </div>}
                <div className="mt-2 max-h-64 overflow-auto text-[10px] text-slate-400">
                  {aiQueue.map(item => (
                    <div key={item.id} className="border-b border-slate-500/10 py-2 last:border-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium text-slate-200">{item.name}</span>
                        <span
                        className={`shrink-0 ${
                          item.status === 'done'
                            ? 'text-emerald-400'
                          : ['running', 'uploading', 'accepted', 'processing'].includes(item.status)
                              ? 'text-amber-400'
                              : item.status === 'mismatch'
                                ? 'text-sky-400'
                              : item.status === 'error'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                        }`}
                        >
                          {item.status === 'done'
                          ? `готово${Number.isFinite(item.segmentCount) ? ` • ${item.segmentCount} сегм.` : ''}`
                            : item.status === 'uploading'
                              ? `передається в Drive${Number.isFinite(item.uploadProgress?.percent) ? ` • ${item.uploadProgress.percent}%` : ''}`
                              : item.status === 'accepted'
                                ? 'у Drive • очікує Colab'
                                : item.status === 'processing'
                                  ? 'обробляється'
                                  : item.status === 'running'
                                    ? 'в роботі'
                                : item.status === 'mismatch'
                                  ? 'перевір тип каналу'
                                : item.status === 'error'
                              ? item.error === 'no_segments'
                            ? ['colab', 'ngrok'].includes(item.provider)
                                  ? 'Colab: порожній result'
                                  : '0 сегментів'
                                : 'помилка'
                            : item.status === 'cancelled'
                              ? 'зупинено'
                              : 'очікує'}
                        </span>
                      </div>
                      {item.logs?.length > 0 && (
                        <div className="mt-0.5 break-words text-[9px] leading-3 text-slate-400">
                          <time className="mr-1 font-mono text-slate-500">
                            {new Date(item.logs.at(-1).at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </time>
                          {item.logs.at(-1).message}
                        </div>
                      )}
                      {item.status === 'uploading' && (
                        <div className="mt-1">
                          <div
                            className="h-1.5 overflow-hidden rounded-full bg-slate-700/70"
                            role="progressbar"
                            aria-label={`Передавання ${item.name} у Google Drive`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={item.uploadProgress?.percent ?? 0}
                          >
                            <div
                              className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
                              style={{ width: `${item.uploadProgress?.percent ?? 0}%` }}
                            />
                          </div>
                          <div className="mt-0.5 flex justify-between gap-2 text-[9px] text-slate-400">
                            <span>
                              {formatTransferSize(item.uploadProgress?.bytesTransferred)}
                              {Number.isFinite(item.uploadProgress?.totalBytes) ? ` / ${formatTransferSize(item.uploadProgress.totalBytes)}` : ''}
                              {item.uploadProgress?.speed ? ` • ${item.uploadProgress.speed}` : ''}
                            </span>
                            <span>{item.uploadProgress?.eta && item.uploadProgress.eta !== '-' ? `залишилось ${item.uploadProgress.eta}` : ''}</span>
                          </div>
                        </div>
                      )}
                      {item.status === 'processing' && item.processingProgress && (
                        <div className="mt-1 text-[9px] text-slate-400">
                          Colab: кадр {item.processingProgress.frames}/{item.processingProgress.totalFrames} ({item.processingProgress.percent}%)
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-700/70">
                            <div className="h-full bg-amber-400 transition-[width] duration-300" style={{ width: `${item.processingProgress.percent}%` }} />
                          </div>
                        </div>
                      )}
                      {item.taskId && (
                        <div className="truncate font-mono text-[9px] text-slate-500">
                          {item.taskId}
                        </div>
                      )}
                      {item.errorDetail && (
                        <div className={`mt-0.5 break-words text-[9px] leading-3 ${item.status === 'mismatch' ? 'text-sky-300' : 'text-rose-300'}`}>
                          {item.status === 'mismatch' ? formatMismatchHuman(item) : item.errorDetail}
                        </div>
                      )}
                      {Array.isArray(item.logs) && item.logs.length > 0 && (
                        <details className="mt-1 text-[9px]">
                          <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">
                            Повний журнал · {item.logs.length} подій
                          </summary>
                          <ol className="mt-1 space-y-0.5 border-l border-slate-500/30 pl-2">
                            {item.logs.map((entry, index) => (
                              <li key={`${entry.at}-${index}`} className="break-words leading-3 text-slate-400">
                                <time className="mr-1 font-mono text-slate-500">
                                  {new Date(entry.at).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </time>
                                {entry.message}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {AI_SHEET_ADDITIONS_ENABLED && adminAiSheetSuggestions.some(item => item.status !== 'dismissed') && (
              <section className={`mt-3 rounded border p-3 ${isDark ? 'border-amber-500/30 bg-amber-950/20' : 'border-amber-300 bg-amber-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold">Нові канали для таблиці</h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Сегменти збережені в редакторі. Тут лише канали, яких ще немає в рядках Google Sheets.
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-bold text-amber-600">
                    {adminAiSheetSuggestions.filter(item => item.status === 'pending').length} нових
                  </span>
                </div>
                <div className="mt-2 max-h-72 space-y-2 overflow-auto">
                  {adminAiSheetSuggestions.filter(item => item.status !== 'dismissed').slice(0, 40).map(item => {
                    const row = item.row || {};
                    const statusLabel = item.status === 'added'
                      ? `Додано в таблицю${item.rowIndex ? ` · рядок ${item.rowIndex}` : ''}`
                      : item.status === 'already_exists'
                        ? `Вже є в таблиці${item.rowIndex ? ` · рядок ${item.rowIndex}` : ''}`
                        : item.status === 'saving' ? 'Записую…' : 'Потрібне підтвердження';
                    const segmentSummary = (item.segments || []).map(segment =>
                      `${Number(segment.start).toFixed(1)}–${Number(segment.end).toFixed(1)}с`
                    ).join(', ');
                    return (
                      <div key={item.id} className={`rounded border p-2 ${isDark ? 'border-slate-700 bg-slate-900/60' : 'border-amber-200 bg-white'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
                              <span className="truncate">{item.fileName}</span>
                              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-sky-600">новий канал: {item.modeLabel}</span>
                              <span className={item.status === 'pending' ? 'text-amber-600' : item.status === 'added' || item.status === 'already_exists' ? 'text-emerald-600' : 'text-slate-500'}>{statusLabel}</span>
                            </div>
                            <p className="mt-1 text-[10px] text-slate-500">
                              {item.segmentCount} сегм. · {segmentSummary || 'часові відрізки не задані'}
                            </p>
                            <div className="mt-1 overflow-x-auto rounded bg-slate-500/5 p-1.5 font-mono text-[9px] text-slate-500" title="Порядок колонок: link, double, status, camera_type, Labels, analog_digital, cutted_link, date_video, file_name">
                              {[
                                row.link || 'link —', row.double || 'double —', row.status || 'status —',
                                row.cameraType || 'camera_type —', row.labels || 'Labels —',
                                row.analogDigital || 'analog_digital —', row.cuttedLink || 'cutted_link —', 'date_video —',
                                row.fileName || item.fileName
                              ].join('  |  ')}
                            </div>
                            {item.error && <p className="mt-1 text-[10px] text-rose-500">Не записано: {item.error}</p>}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => copyAiSheetSuggestionRow(item)}
                              className="rounded border border-slate-400/40 px-2 py-1 text-[10px] font-semibold hover:border-slate-400"
                            >{copiedAiRowId === item.id ? 'Скопійовано' : 'Копіювати рядок'}</button>
                            {item.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onConfirmAiSheetSuggestion?.(item.id)}
                                  className="rounded bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700"
                                >Підтвердити й додати</button>
                                <button
                                  type="button"
                                  onClick={() => onDismissAiSheetSuggestion?.(item.id)}
                                  className="rounded border border-slate-400/40 px-2 py-1 text-[10px] hover:border-slate-400"
                                >Відкласти</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
        )}

        {activeTab === 'jobs' && !clipchampStatus && adminJobProgress !== null && (
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

        {activeTab === 'jobs' && (
        <div className="mt-4">
          <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
            {clipchampStatus ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">Експорт відео</div>
                    <p role="status" aria-live="polite" aria-atomic="true" className="mt-1 text-xs text-slate-500">{clipchampStatus.stageText}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{clipchampStatus.workflowText}</p>
                  </div>
                  <div className="flex items-center gap-2">
                  {['error', 'cancelled'].includes(clipchampStatus.stage) && (
                    <button type="button" onClick={() => onRetryIncompleteJob(adminJob?.id)} className="rounded border border-amber-500 px-2.5 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/10">
                      Повторити незавершені
                    </button>
                  )}
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    clipchampStatus.stage === 'done'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                      : clipchampStatus.stage === 'error'
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                        : 'border-indigo-500/40 bg-indigo-500/10 text-indigo-600'
                  }`}>
                    {getJobStatusLabel(adminJob?.status)}
                  </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                    <div className="text-[11px] text-slate-500">Файлів на виході</div>
                    <div className="mt-1 text-sm font-semibold">{clipchampStatus.totalCount || '—'}</div>
                  </div>
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                    <div className="text-[11px] text-slate-500">Відео оброблено</div>
                    <div className="mt-1 text-sm font-semibold">
                      {clipchampStatus.totalCount
                        ? `${clipchampStatus.processedCount} з ${clipchampStatus.totalCount}`
                        : 'Очікую дані'}
                    </div>
                  </div>
                  {clipchampStatus.uploadsToDrive && (
                    <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                      <div className="text-[11px] text-slate-500">Уже в Google Drive</div>
                      <div className="mt-1 text-sm font-semibold">{clipchampStatus.uploadedCount} з {clipchampStatus.totalCount}</div>
                    </div>
                  )}
                  <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                    <div className="text-[11px] text-slate-500">{clipchampStatus.hasPerFileEvents ? 'Поточний файл передано' : 'Передано за розміром'}</div>
                    <div className="mt-1 text-sm font-semibold">
                      {Number.isFinite(clipchampStatus.transferredBytes) && Number.isFinite(clipchampStatus.totalBytes)
                        ? `${formatExportBytes(clipchampStatus.transferredBytes)} з ${formatExportBytes(clipchampStatus.totalBytes)}`
                        : clipchampStatus.percent !== null ? `${clipchampStatus.percent}%` : 'Ще рахується'}
                    </div>
                  </div>
                </div>

                {clipchampStatus.percent !== null && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                      <span>{clipchampStatus.stage === 'cancelled' ? 'Прогрес на момент зупинки' : clipchampStatus.uploadsToDrive ? 'Передавання в Drive' : 'Підготовка експорту'}</span>
                      <span>{clipchampStatus.percent}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                      role="progressbar"
                      aria-label="Прогрес експорту відео"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={clipchampStatus.percent}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${clipchampStatus.stage === 'error' ? 'bg-rose-500' : clipchampStatus.stage === 'done' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${clipchampStatus.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {clipchampStatus.currentFile && !['done', 'cancelled'].includes(clipchampStatus.stage) && (
                  <div className={`mt-3 rounded-lg border p-3 text-xs ${isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-white'}`}>
                    <div className="font-semibold">{clipchampStatus.stage === 'uploading' ? 'Зараз завантажується' : clipchampStatus.stage === 'error' ? 'Останній файл перед помилкою' : 'Зараз обробляється'}</div>
                    <div className="mt-1 break-all text-slate-600 dark:text-slate-300">{clipchampStatus.currentFile}</div>
                    {clipchampStatus.currentFilePercent !== null && (
                      <div className="mt-1 text-slate-500">
                        {clipchampStatus.currentFilePercent}% цього файла
                        {clipchampStatus.hasPerFileEvents && Number.isFinite(clipchampStatus.transferredBytes) && Number.isFinite(clipchampStatus.totalBytes)
                          ? ` · ${formatExportBytes(clipchampStatus.transferredBytes)} з ${formatExportBytes(clipchampStatus.totalBytes)}`
                          : ''}
                      </div>
                    )}
                  </div>
                )}

                {clipchampStatus.transferNote && (
                  <div className={`mt-3 rounded-lg border p-3 text-xs ${isDark ? 'border-amber-700/60 bg-amber-950/30 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                    {clipchampStatus.transferNote}
                  </div>
                )}

                {clipchampStatus.driveUrl && (
                  <a
                    href={clipchampStatus.driveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-9 items-center rounded border border-indigo-500/30 px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300"
                  >
                    Відкрити теку призначення в Google Drive
                  </a>
                )}

                {clipchampStatus.canShowFileList && clipchampStatus.files.length > 0 && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold">Стан кожного відео</div>
                    <div className={`max-h-56 overflow-auto rounded-lg border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      {clipchampStatus.files.map(file => (
                        <div key={file.name} className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 last:border-0 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                          <span className="min-w-0 break-all text-xs">{file.name}</span>
                          <span className={`shrink-0 text-[11px] font-medium ${file.status === 'error' ? 'text-rose-500' : file.status === 'uploaded' ? 'text-emerald-600' : file.status === 'uploading' || file.status === 'rendering' ? 'text-indigo-500' : 'text-slate-500'}`}>
                            {getExportFileStatusLabel(file.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!clipchampStatus.hasPerFileEvents && clipchampStatus.isUpload && clipchampStatus.totalCount > 0 && clipchampStatus.stage !== 'done' && (
                  <p className="mt-2 text-[11px] text-slate-500">
                    Це завдання запущене старою версією: вона не записувала окремий статус для кожного файла. Тут показані загальна кількість і поточний файл.
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-3 text-xs">
                <div className="font-semibold">{adminJob ? `Завдання: ${getJobStatusLabel(adminJob.status)}` : 'Немає вибраного завдання'}</div>
                {adminJob?.status === 'running' && <p className="mt-1 text-slate-500">Локальний сервер зараз виконує команду. Якщо прогресу немає, відкрий журнал нижче.</p>}
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer select-none text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                Технічний журнал {adminJob?.log ? `· ${adminJob.log.length.toLocaleString('uk-UA')} символів` : ''}
              </summary>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={copyTechnicalLog}
                  disabled={!adminJob?.log}
                  className={`rounded border px-2.5 py-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-40 ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                >
                  {technicalLogCopied ? 'Журнал скопійовано' : 'Скопіювати журнал'}
                </button>
              </div>
              <pre className={`mt-2 whitespace-pre-wrap break-words rounded border p-3 max-h-72 overflow-auto text-[11px] font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                {adminJob?.log ? adminJob.log : 'Журнал поки порожній.'}
              </pre>
            </details>
          </div>
        </div>
        )}

        {activeTab === 'jobs' && adminJobs.length > 0 && (
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
                      {jobMeta.label} {getJobStatusLabel(job.status)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && (
        <div className="grid gap-4 md:grid-cols-2">
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
        )}

        {activeTab === 'ai' && (
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
        )}

        {activeTab === 'files' && (
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
            <details className={`mt-3 rounded border p-3 text-xs leading-relaxed ${isDark ? 'border-slate-700 bg-slate-800/60 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
              <summary className="cursor-pointer font-semibold text-sky-500">Як підключити Google Sheets</summary>
              <ol className="mt-2 list-decimal space-y-2 pl-4">
                <li>У <a className="text-sky-500 underline" href="https://console.cloud.google.com/apis/library/sheets.googleapis.com" target="_blank" rel="noreferrer">Google Cloud Console</a> вибери або створи проєкт і ввімкни Google Sheets API.</li>
                <li>Створи Service Account і завантаж для нього JSON-ключ. Нижче відкрий цей файл у текстовому редакторі, скопіюй увесь вміст і встав у поле доступу.</li>
                <li>Відкрий JSON-файл, скопіюй значення <code>client_email</code> і надай цій адресі доступ до таблиці як <strong>Редактор</strong>.</li>
                <li>У URL таблиці скопіюй ID між <code>/d/</code> та <code>/edit</code>. GID — число після <code>gid=</code> у URL потрібної вкладки. Встав значення вище й натисни «Зберегти налаштування таблиці».</li>
              </ol>
              <p className="mt-2">Ключ зберігається локально на цьому комп’ютері й не відображається після збереження.</p>
              <p className="mt-2">Документація: <a className="text-sky-500 underline" href="https://developers.google.com/workspace/sheets/api/quickstart/js" target="_blank" rel="noreferrer">увімкнення Sheets API</a> · <a className="text-sky-500 underline" href="https://cloud.google.com/iam/docs/service-accounts-create" target="_blank" rel="noreferrer">створення Service Account</a> · <a className="text-sky-500 underline" href="https://cloud.google.com/iam/docs/keys-create-delete" target="_blank" rel="noreferrer">JSON-ключ</a></p>
            </details>
            <div className="mt-3 flex flex-col gap-2">
              <label htmlFor="google-service-account-json" className="text-xs font-medium text-slate-500">
                {adminConfig.googleCredentialsConfigured ? 'Google доступ налаштовано. Встав новий JSON-ключ, щоб замінити його.' : 'JSON-ключ сервісного акаунта'}
              </label>
              <input
                id="google-service-account-json"
                type="password"
                autoComplete="new-password"
                value={googleServiceAccountJson}
                onChange={event => setGoogleServiceAccountJson(event.target.value)}
                className={`w-full text-xs p-2 rounded border focus:ring-1 focus:ring-sky-500 outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-white border-slate-200 focus:border-sky-400'}`}
                placeholder="Встав сюди весь вміст JSON-файлу"
              />
              {googleCredentialsError && <p role="alert" className="text-xs text-red-500">{googleCredentialsError}</p>}
              <button
                type="button"
                onClick={saveGoogleCredentials}
                disabled={!googleServiceAccountJson.trim() || adminLoading}
                className="w-full px-3 py-2 rounded text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white disabled:opacity-50 transition-colors"
              >
                Зберегти й перевірити доступ Google
              </button>
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
            <div className="mt-2">
              <button
                type="button"
                onClick={onSyncSheetFromCsv}
                disabled={adminLoading}
                className="w-full px-3 py-2 rounded text-xs font-bold border border-sky-600 text-sky-700 hover:bg-sky-50 dark:border-sky-500 dark:text-sky-300 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Оновити таблицю з links_map.csv
              </button>
              <p className="mt-1 text-xs text-slate-400">
                Оновить parse!A:B з CSV і заповнить pre-final!H за посиланнями з колонки A. Інші колонки не змінює.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Для pre-final без відповідника в parse!A:B клітинка H очищується, як у твоєму Apps Script. Береться найновіший links_map.csv.
              </p>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
