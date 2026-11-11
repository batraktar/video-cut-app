import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_EDIT_STATE,
  SEGMENT_MODES,
  STORAGE_KEYS
} from '../lib/editorConstants';
import {
  countAiSegments,
  describeRemoteAiResponse,
  normalizeRemoteAiSegments,
  pollRemoteAiTask
} from '../features/ai/remoteAi';
import {
  buildClipchampExportCommand,
  extractDriveFolderId,
  formatClipchampFolderName,
  shellQuote
} from '../features/export/clipchampExport';
import { getClipchampJobStatus } from '../features/export/clipchampJobStatus';
import {
  buildChannelsFromEntries,
  clamp,
  entriesHaveBoth,
  extractFfmpegTime,
  getEntryOrder,
  getExportDurationForEdit,
  getSegmentsForMode,
  getServerFileKey,
  getSuffixForSegmentMode,
  mergeLabelTokens,
  loadFromStorage,
  normalizeName,
  normalizeSegmentSets,
  parseLabelTokens,
  resolveSegmentModeFromMeta,
  resolveSegmentModeFromSuffix,
  resolveImportSuffix,
  resolveSuffixFromMode,
  saveToStorage
} from '../lib/editorUtils';
import { getPlaylistItemChecked, getPlaylistSelection } from '../features/editor/playlistSelection';

const ADMIN_AI_QUEUE_STORAGE_KEY = 'videoCut.adminAiQueue.v2';
const AI_SHEET_SUGGESTIONS_STORAGE_KEY = 'videoCut.aiSheetSuggestions.v1';
const SERVER_CUT_APPLIED_KEY = 'videoCut.serverCutApplied.v2';
// Версія серверного результату нарізки: щоб автоматика не застосовувала
// той самий результат повторно, а лише нові/перерізані.
const cutResultVersion = item => {
  const r = (item && item.result) || {};
  if (r.finished_at) return 'f' + r.finished_at;
  return 'h' + JSON.stringify(r.label_counts || {}) + ':' + (r.frame_count || 0);
};
const createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;

// Серверна версія редактора (не localhost): API — той самий origin
// (nginx проксює на Express), адреса AI — стабільний /infer цього ж хоста.
const IS_REMOTE_HOST =
  typeof window !== 'undefined' &&
  !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);

export default function useAdmin({
  playlist,
  setPlaylist,
  playlistRef,
  edits,
  setEdits,
  currentId,
  setCurrentId,
  activeVideo,
  videoRef,
  currentTime,
  savedEditsRef,
  showHud,
  prefs,
  setPrefs,
  helpers,
  autoSyncEnabled = true
}) {
  const {
    isDark,
    batchSuffix,
    seekStep,
    uploadToDrive,
    sidebarWidth,
    overwriteOutputs
  } = prefs;
  const {
    setIsDark,
    setBatchSuffix,
    setSeekStep,
    setUploadToDrive,
    setSidebarWidth,
    setOverwriteOutputs
  } = setPrefs;
  const {
    getDisplayName,
    buildEditFromSaved,
    getSavedEditForVideo,
    dedupePlaylistAndEdits,
    getFileKeyCounts,
    getFileKeyVariants,
    getVideoChannelVariants,
    allowDoneForVideo,
    buildFfmpegLinesFor,
    getVideoOutputDir,
    getVideoDoneDir,
    getSegmentModeForVideo,
    buildRcloneCopyLine,
    getExpectedModesForAi
  } = helpers;

  const [adminOpen, setAdminOpen] = useState(false);
  const [adminBaseUrl, setAdminBaseUrl] = useState(
    IS_REMOTE_HOST ? '' : 'http://localhost:7071'
  );
  const [adminHealth, setAdminHealth] = useState(null);
  const [adminSheet, setAdminSheet] = useState(null);
  const [adminSnapshot, setAdminSnapshot] = useState(null);
  const [adminConfig, setAdminConfig] = useState(DEFAULT_ADMIN_CONFIG);
  const [adminJobs, setAdminJobs] = useState([]);
  const [adminJob, setAdminJob] = useState(null);
  const [adminJobId, setAdminJobId] = useState('');
  const [adminJobExpectedDuration, setAdminJobExpectedDuration] = useState(null);
  const [adminAutoRefresh, setAdminAutoRefresh] = useState(true);
  const [adminHistoryOpen, setAdminHistoryOpen] = useState(false);
  const [adminSheetFilter, setAdminSheetFilter] = useState('');
  const [adminShowSnapshot, setAdminShowSnapshot] = useState(false);
  const [adminImportStats, setAdminImportStats] = useState(null);
  const [adminLastRefreshAt, setAdminLastRefreshAt] = useState(null);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminAiLoading, setAdminAiLoading] = useState(false);
  const [adminAiStats, setAdminAiStats] = useState(null);
  const [adminAiQueue, setAdminAiQueue] = useState(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem(ADMIN_AI_QUEUE_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const [adminAiSheetSuggestions, setAdminAiSheetSuggestions] = useState(() => {
    try {
      const value = JSON.parse(window.localStorage.getItem(AI_SHEET_SUGGESTIONS_STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  });
  const [adminAiLastRequestAt, setAdminAiLastRequestAt] = useState(null);
  const [adminAiLastError, setAdminAiLastError] = useState(null);
  const [adminAiLastProvider, setAdminAiLastProvider] = useState('');
  const [adminAiColabMode, setAdminAiColabMode] = useState(() => {
    try {
      return window.localStorage.getItem('videoCut.adminAiColabMode.v1') === 'drive' ? 'drive' : 'ngrok';
    } catch {
      return 'ngrok';
    }
  });
  const [adminAiDriveCheck, setAdminAiDriveCheck] = useState('');
  const [adminAiRemoteState, setAdminAiRemoteState] = useState({
    status: 'idle',
    lastCheckedAt: null,
    lastHttp: null,
    lastError: null
  });
  const [adminLogoLoading, setAdminLogoLoading] = useState(false);
  const [adminLogoStats, setAdminLogoStats] = useState(null);
  const [adminSyncState, setAdminSyncState] = useState({
    status: 'idle',
    updatedAt: null,
    error: null
  });

  const sheetMapRef = useRef(null);
  const sheetMapPromiseRef = useRef(null);
  const adminJobExpectedMapRef = useRef(new Map());
  const adminJobStatusRef = useRef(new Map());
  const autoSaveTimerRef = useRef(null);
  const lastSnapshotRef = useRef('');
  const adminAiAbortRef = useRef({ aborted: false, controller: null, controllers: [] });
  const aiSheetAppendInFlightRef = useRef(new Set());

  useEffect(() => {
    try {
      window.localStorage.setItem(ADMIN_AI_QUEUE_STORAGE_KEY, JSON.stringify(adminAiQueue));
    } catch {
      // Queue recovery is best effort; the authoritative job state is stored by Colab in Drive.
    }
  }, [adminAiQueue]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        AI_SHEET_SUGGESTIONS_STORAGE_KEY,
        JSON.stringify(adminAiSheetSuggestions)
      );
    } catch {
      // Keep the current session usable if browser storage is full or unavailable.
    }
  }, [adminAiSheetSuggestions]);

  useEffect(() => {
    try {
      window.localStorage.setItem('videoCut.adminAiColabMode.v1', adminAiColabMode);
    } catch {
      // The selected Colab route is a convenience preference only.
    }
  }, [adminAiColabMode]);

  const setAiQueueStatus = useCallback((id, patch) => {
    setAdminAiQueue(prev =>
      prev.map(item => (item.id === id ? { ...item, ...patch } : item))
    );
  }, []);

  const pingAdminAiRemote = useCallback(async () => {
    const base = String(adminConfig.aiRemoteUrl || '').trim().replace(/\/+$/, '');
    if (!base) {
      setAdminAiRemoteState({
        status: 'idle',
        lastCheckedAt: null,
        lastHttp: null,
        lastError: null
      });
      return;
    }
    setAdminAiRemoteState(prev => ({
      ...prev,
      status: 'checking',
      lastCheckedAt: Date.now(),
      lastError: null
    }));
    try {
      const proxyBase = `${adminBaseUrl.replace(/\/+$/, '')}/ai/remote-proxy/${encodeURIComponent(base)}`;
      const res = await fetch(`${proxyBase}/health`);
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload?.ok !== true) {
        setAdminAiRemoteState({
          status: 'error',
          lastCheckedAt: Date.now(),
          lastHttp: res.status,
          lastError: payload?.detail || payload?.error || (res.ok ? 'Тунель не повернув health Colab' : `HTTP ${res.status}`)
        });
        return;
      }
      setAdminAiRemoteState({
        status: 'ok',
        lastCheckedAt: Date.now(),
        lastHttp: res.status,
        lastError: null
      });
    } catch (e) {
      setAdminAiRemoteState({
        status: 'error',
        lastCheckedAt: Date.now(),
        lastHttp: null,
        lastError: 'Connection failed'
      });
    }
  }, [adminBaseUrl, adminConfig.aiRemoteUrl]);

  const fetchAdminJson = useCallback(
    async (path, options = {}) => {
      if (!options.silent) {
        setAdminLoading(true);
        setAdminError('');
      }
      try {
        const res = await fetch(`${adminBaseUrl}${path}`, {
          method: options.method || 'GET',
          headers: options.json ? { 'Content-Type': 'application/json' } : undefined,
          body: options.json ? JSON.stringify(options.json) : undefined,
          signal: options.signal
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          const error = new Error(`HTTP ${res.status}`);
          error.status = res.status;
          error.payload = payload;
          throw error;
        }
        return payload;
      } catch (e) {
        if (options.returnErrorPayload && e?.payload) return e.payload;
        if (options.returnErrorPayload) {
          return {
            ok: false,
            error: e?.name === 'AbortError' ? 'request_aborted' : 'local_api_unreachable',
            detail: e?.name === 'AbortError'
              ? 'Запит скасовано.'
              : `Локальний API не відповів: ${String(e?.message || e)}`
          };
        }
        if (!options.silent) {
          const serverError = e?.payload?.error;
          if (e?.status === 404) {
            setAdminError('Локальний сервер застарів. Зупини його у вікні запуску (Ctrl+C) і знову відкрий START.command.');
          } else if (serverError === 'config_write_failed') {
            setAdminError('Не вдалося зберегти налаштування на локальному сервері');
          } else if (serverError === 'sheet_read_failed') {
            setAdminError('Сервер працює, але не вдалося прочитати Google Sheet');
          } else if (serverError === 'sheet_sync_failed') {
            setAdminError('Не вдалося записати в Google Sheets. Перевір доступ редактора та захищені діапазони.');
          } else if (serverError === 'links_map_not_found') {
            setAdminError('Не знайдено links_map.csv у папці з відео, поруч із нею або в Telegram Uploads');
          } else if (serverError === 'sheet_sync_columns_missing') {
            setAdminError('У таблиці мають бути колонки link і tg_file_name');
          } else if (serverError === 'sheet_sync_tabs_missing') {
            setAdminError('У таблиці мають бути аркуші parse та pre-final');
          } else if (serverError === 'sheet_write_not_configured') {
            setAdminError('Спочатку налаштуй доступ сервісного акаунта до таблиці');
          } else {
            setAdminError('Не вдалося підключитися до сервера');
          }
        }
        return null;
      } finally {
        if (!options.silent) setAdminLoading(false);
      }
    },
    [adminBaseUrl]
  );

  const getJobFileName = useCallback(command => {
    if (!command) return '';
    const lines = command
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    const ffmpegLine = lines.find(line => line.includes('ffmpeg') && line.includes('-i '));
    const extractInput = line => {
      const doubleMatch = line.match(/-i\s+"([^"]+)"/);
      if (doubleMatch) return doubleMatch[1];
      const singleMatch = line.match(/-i\s+'([^']+)'/);
      if (singleMatch) return singleMatch[1];
      const plainMatch = line.match(/-i\s+([^\s]+)/);
      return plainMatch ? plainMatch[1] : '';
    };
    const extractOutput = line => {
      const matches = [...line.matchAll(/"([^"]+)"/g)];
      if (matches.length === 0) return '';
      return matches[matches.length - 1][1];
    };
    if (ffmpegLine) {
      const inputPath = extractInput(ffmpegLine);
      const outputPath = extractOutput(ffmpegLine);
      const picked = outputPath || inputPath;
      return picked ? picked.split('/').pop() : '';
    }
    const mvMatch = command.match(/mv\s+"([^"]+)"\s+"([^"]+)"/);
    if (mvMatch) return mvMatch[1].split('/').pop();
    const anyQuoted = command.match(/"([^"]+)"/);
    return anyQuoted ? anyQuoted[1].split('/').pop() : '';
  }, []);

  const getJobMeta = useCallback(
    job => {
      const fileName = getJobFileName(job?.command || '');
      if (!fileName) return { label: job?.id ? `#${job.id.slice(-4)}` : 'job', tooltip: '' };
      const lower = fileName.toLowerCase();
      const channel = lower.includes('digital') ? 'digital' : lower.includes('analog') ? 'analog' : '';
      const isThermal = lower.includes('thermal') || lower.includes('infrared');
      const channelLabel = channel ? `Канал: ${channel}` : '';
      const thermalLabel =
        channel || isThermal ? `Термальне: ${isThermal ? 'так' : 'ні'}` : '';
      return {
        label: getDisplayName(fileName),
        tooltip: [fileName, channelLabel, thermalLabel].filter(Boolean).join(' • ')
      };
    },
    [getDisplayName, getJobFileName]
  );

  const getJobProgress = useCallback(
    job => {
      if (!job) return null;
      const exportStatus = getClipchampJobStatus(job);
      if (exportStatus?.percent !== null && exportStatus?.percent !== undefined) {
        return exportStatus.percent;
      }
      const expected =
        adminJobExpectedMapRef.current.get(job.id) ??
        (job.id === adminJob?.id ? adminJobExpectedDuration : null);
      if (job.status === 'done') return 100;
      if (!expected || expected <= 0) return null;
      const elapsed = extractFfmpegTime(job.log || '');
      if (elapsed === null) return null;
      return Math.min(100, (elapsed / expected) * 100);
    },
    [adminJob?.id, adminJobExpectedDuration]
  );

  const selectAdminJob = useCallback(job => {
    if (!job) return;
    setAdminJobId(job.id);
    setAdminJob(job);
    setAdminJobExpectedDuration(adminJobExpectedMapRef.current.get(job.id) ?? null);
  }, []);

  const pingAdmin = useCallback(async ({ silent = false } = {}) => {
    const data = await fetchAdminJson('/health', { silent });
    setAdminHealth(data?.ok ? data : { ok: false });
  }, [fetchAdminJson]);

  const loadAdminSheet = useCallback(async () => {
    const data = await fetchAdminJson('/sheet-map');
    if (data) setAdminSheet(data);
  }, [fetchAdminJson]);

  const loadAdminSnapshot = useCallback(async () => {
    const data = await fetchAdminJson('/snapshot');
    if (data) setAdminSnapshot(data);
  }, [fetchAdminJson]);

  const loadAdminConfig = useCallback(async () => {
    const data = await fetchAdminJson('/config');
    if (data?.config) {
      setAdminConfig({
        ...DEFAULT_ADMIN_CONFIG,
        ...data.config,
        logoTemplatePath:
          data.config.logoTemplatePath || DEFAULT_ADMIN_CONFIG.logoTemplatePath,
        aiFps: Number.isFinite(data.config.aiFps) ? data.config.aiFps : DEFAULT_ADMIN_CONFIG.aiFps,
        aiMinDuration: Number.isFinite(data.config.aiMinDuration)
          ? data.config.aiMinDuration
          : DEFAULT_ADMIN_CONFIG.aiMinDuration,
        logoFps: Number.isFinite(data.config.logoFps)
          ? data.config.logoFps
          : DEFAULT_ADMIN_CONFIG.logoFps,
        logoSize: Number.isFinite(data.config.logoSize)
          ? data.config.logoSize
          : DEFAULT_ADMIN_CONFIG.logoSize,
        logoThreshold: Number.isFinite(data.config.logoThreshold)
          ? data.config.logoThreshold
          : DEFAULT_ADMIN_CONFIG.logoThreshold,
        logoMinDuration: Number.isFinite(data.config.logoMinDuration)
          ? data.config.logoMinDuration
          : DEFAULT_ADMIN_CONFIG.logoMinDuration,
        logoMaxMatches: Number.isFinite(data.config.logoMaxMatches)
          ? data.config.logoMaxMatches
          : DEFAULT_ADMIN_CONFIG.logoMaxMatches,
        logoMaxGap: Number.isFinite(data.config.logoMaxGap)
          ? data.config.logoMaxGap
          : DEFAULT_ADMIN_CONFIG.logoMaxGap,
        logoScales:
          typeof data.config.logoScales === 'string'
            ? data.config.logoScales
            : DEFAULT_ADMIN_CONFIG.logoScales,
        aiRemoteUrl:
          IS_REMOTE_HOST &&
          (!data.config.aiRemoteUrl ||
            /ngrok|localhost|127\.0\.0\.1/.test(data.config.aiRemoteUrl))
            ? `${window.location.origin}/infer`
            : data.config.aiRemoteUrl || DEFAULT_ADMIN_CONFIG.aiRemoteUrl,
        sheetId: data.config.sheetId || DEFAULT_ADMIN_CONFIG.sheetId,
        sheetGid: data.config.sheetGid || DEFAULT_ADMIN_CONFIG.sheetGid,
        googleCredentialsConfigured: Boolean(data.config.googleCredentialsConfigured)
      });
    }
  }, [fetchAdminJson]);

  const saveAdminConfig = useCallback(async () => {
    const payload = {
      ...adminConfig,
      aiFps: Number.isFinite(adminConfig.aiFps)
        ? adminConfig.aiFps
        : DEFAULT_ADMIN_CONFIG.aiFps,
      aiMinDuration: Number.isFinite(adminConfig.aiMinDuration)
        ? adminConfig.aiMinDuration
        : DEFAULT_ADMIN_CONFIG.aiMinDuration,
      logoFps: Number.isFinite(adminConfig.logoFps)
        ? adminConfig.logoFps
        : DEFAULT_ADMIN_CONFIG.logoFps,
      logoSize: Number.isFinite(adminConfig.logoSize)
        ? adminConfig.logoSize
        : DEFAULT_ADMIN_CONFIG.logoSize,
      logoThreshold: Number.isFinite(adminConfig.logoThreshold)
        ? adminConfig.logoThreshold
        : DEFAULT_ADMIN_CONFIG.logoThreshold,
      logoMinDuration: Number.isFinite(adminConfig.logoMinDuration)
        ? adminConfig.logoMinDuration
        : DEFAULT_ADMIN_CONFIG.logoMinDuration,
      logoMaxMatches: Number.isFinite(adminConfig.logoMaxMatches)
        ? adminConfig.logoMaxMatches
        : DEFAULT_ADMIN_CONFIG.logoMaxMatches,
      logoMaxGap: Number.isFinite(adminConfig.logoMaxGap)
        ? adminConfig.logoMaxGap
        : DEFAULT_ADMIN_CONFIG.logoMaxGap,
      logoScales:
        typeof adminConfig.logoScales === 'string'
          ? adminConfig.logoScales
          : DEFAULT_ADMIN_CONFIG.logoScales,
      aiRemoteUrl: adminConfig.aiRemoteUrl || DEFAULT_ADMIN_CONFIG.aiRemoteUrl,
      sheetId: adminConfig.sheetId || DEFAULT_ADMIN_CONFIG.sheetId,
      sheetGid: adminConfig.sheetGid || DEFAULT_ADMIN_CONFIG.sheetGid
    };
    const data = await fetchAdminJson('/config', { method: 'POST', json: payload });
    if (data?.config) setAdminConfig(data.config);
    if (data?.ok) showHud("Налаштування збережено");
    return Boolean(data?.ok);
  }, [adminConfig, fetchAdminJson, showHud]);

  const syncSheetFromCsv = useCallback(async () => {
    const configSaved = await saveAdminConfig();
    if (!configSaved) return;
    const result = await fetchAdminJson('/sheet/sync-file-names', { method: 'POST' });
    if (!result?.ok) {
      showHud('Не вдалося оновити таблицю з links_map.csv');
      return;
    }
    showHud(`parse: оновлено ${result.parseUpdated}, додано ${result.parseAdded}; pre-final: заповнено ${result.preFinalFilled}`);
  }, [fetchAdminJson, saveAdminConfig, showHud]);

  const saveGoogleCredentials = useCallback(async serviceAccountJson => {
    const result = await fetchAdminJson('/google-credentials', {
      method: 'POST',
      json: { serviceAccountJson },
      returnErrorPayload: true
    });
    if (!result?.ok) return result?.error || 'google_validation_failed';
    setAdminConfig(current => ({ ...current, googleCredentialsConfigured: true }));
    showHud('Доступ Google Sheets збережено');
    return 'ok';
  }, [fetchAdminJson, showHud]);

  const loadSheetMap = useCallback(async () => {
    if (sheetMapPromiseRef.current) return sheetMapPromiseRef.current;
    sheetMapPromiseRef.current = (async () => {
      try {
        const data = await fetchAdminJson('/sheet-map');
        const rows = Array.isArray(data?.rows) ? data.rows : null;
        if (!rows) throw new Error('sheet_bad');
        const map = new Map();
        for (const row of rows) {
          const rawName = row.fileName;
          const key = normalizeName(rawName);
          if (!key) continue;
          if (!map.has(key)) map.set(key, []);
          map.get(key).push({
            rowIndex: row.rowIndex,
            link: String(row.link || '').trim(),
            fileName: String(rawName || '').trim(),
            analogDigital: String(row.analogDigital || '').trim(),
            cameraType: String(row.cameraType || '').trim(),
            status: String(row.status || '').trim(),
            labels: String(row.labels || '').trim()
          });
        }
        sheetMapRef.current = map;
        return map;
      } catch (e) {
        showHud("Не вдалося завантажити таблицю");
        sheetMapRef.current = null;
        return null;
      } finally {
        sheetMapPromiseRef.current = null;
      }
    })();
    return sheetMapPromiseRef.current;
  }, [fetchAdminJson, showHud]);

  const _queueMissingSheetChannelRows = useCallback(async items => {
    const sheetMap = await loadSheetMap();
    if (!sheetMap) return;
    const videosById = new Map(playlistRef.current.map(video => [video.id, video]));
    const proposals = [];
    items.forEach(item => {
      const video = (item.id && videosById.get(item.id)) ||
        playlistRef.current.find(candidate => item.sourcePath && candidate.sourcePath === item.sourcePath);
      if (!video) return;
      const fileName = video.name || video.sourcePath?.split('/').pop() || '';
      if (!fileName) return;
      const existingRows = sheetMap.get(normalizeName(fileName)) || [];
      const segmentModes = Object.entries(item.segments || {})
        .filter(([mode, segments]) =>
          SEGMENT_MODES.some(candidate => candidate.id === mode) &&
          Array.isArray(segments) && segments.length > 0
        );
      segmentModes.forEach(([mode, segments]) => {
        const alreadyInSheet = existingRows.some(row =>
          resolveSegmentModeFromMeta(row.analogDigital, row.cameraType) === mode
        );
        if (alreadyInSheet) return;
        const thermal = mode.startsWith('thermal_');
        const sourceRow = existingRows.find(row =>
          String(row.cameraType || '').toLowerCase().includes('thermal') === thermal
        ) || existingRows[0];
        const sourceIsThermal = /thermal|infrared/i.test(sourceRow?.cameraType || '');
        const modeLabel = SEGMENT_MODES.find(candidate => candidate.id === mode)?.label || mode;
        proposals.push({
          id: `${video.fileKey || video.id}:${mode}`,
          status: 'pending',
          videoId: video.id,
          fileName,
          mode,
          modeLabel,
          segmentCount: segments.length,
          segments: segments.map(segment => ({ start: Number(segment.start) || 0, end: Number(segment.end) || 0 })),
          detectedAt: new Date().toISOString(),
          row: {
            link: sourceRow?.link || video.sheetLink || '',
            double: '',
            status: sourceRow?.status || 'to cut',
            cameraType: thermal
              ? (sourceIsThermal ? sourceRow.cameraType : 'Thermal')
              : (sourceRow && !sourceIsThermal ? sourceRow.cameraType : 'Optical'),
            labels: sourceRow?.labels || '',
            analogDigital: mode.includes('analog') ? 'Analog' : 'Digital',
            cuttedLink: '',
            fileName
          }
        });
      });
    });
    if (proposals.length === 0) return;
    setAdminAiSheetSuggestions(previous => {
      const byId = new Map(previous.map(item => [item.id, item]));
      proposals.forEach(proposal => {
        const current = byId.get(proposal.id);
        if (!current || current.status === 'pending') byId.set(proposal.id, { ...current, ...proposal });
      });
      return Array.from(byId.values()).sort((left, right) =>
        String(right.detectedAt).localeCompare(String(left.detectedAt))
      );
    });
  }, [loadSheetMap, playlistRef]);

  const confirmAiSheetSuggestion = useCallback(async suggestionId => {
    const suggestion = adminAiSheetSuggestions.find(item => item.id === suggestionId);
    if (!suggestion || suggestion.status !== 'pending' || aiSheetAppendInFlightRef.current.has(suggestionId)) return;
    const confirmed = window.confirm(
      `Додати в Google Sheets новий рядок для ${suggestion.fileName} · ${suggestion.modeLabel}?\n\n` +
      'Буде додано один рядок для каналу відео.'
    );
    if (!confirmed) return;
    aiSheetAppendInFlightRef.current.add(suggestionId);
    setAdminAiSheetSuggestions(previous => previous.map(item =>
      item.id === suggestionId ? { ...item, status: 'saving', error: null } : item
    ));
    try {
      const result = await fetchAdminJson('/sheet/append-ai-channel-row', {
        method: 'POST',
        json: { row: { ...suggestion.row, mode: suggestion.mode } },
        silent: true,
        returnErrorPayload: true
      });
      if (!result?.ok) {
        const error = result?.error || 'sheet_ai_row_append_failed';
        setAdminAiSheetSuggestions(previous => previous.map(item =>
          item.id === suggestionId ? { ...item, status: 'pending', error } : item
        ));
        showHud(error === 'sheet_write_not_configured'
          ? 'Підключи Service Account для запису в Google Sheets'
          : 'Не вдалося додати рядок у Google Sheets');
        return;
      }
      setAdminAiSheetSuggestions(previous => previous.map(item =>
        item.id === suggestionId
          ? { ...item, status: result.duplicate ? 'already_exists' : 'added', rowIndex: result.rowIndex || null, error: null }
          : item
      ));
      sheetMapRef.current = null;
      loadSheetMap();
      showHud(result.duplicate ? 'Такий канал уже є в таблиці' : 'Новий канал додано в Google Sheets');
    } finally {
      aiSheetAppendInFlightRef.current.delete(suggestionId);
    }
  }, [adminAiSheetSuggestions, fetchAdminJson, loadSheetMap, showHud]);

  const dismissAiSheetSuggestion = useCallback(suggestionId => {
    setAdminAiSheetSuggestions(previous => previous.map(item =>
      item.id === suggestionId && item.status === 'pending'
        ? { ...item, status: 'dismissed' }
        : item
    ));
  }, []);

  const buildSnapshotPayload = useCallback(() => {
    const serializeEdit = edit => ({
      trim: edit.trim,
      crop: edit.crop,
      elements: edit.elements,
      segments: edit.segments,
      segmentSets: edit.segmentSets,
      segmentMode: edit.segmentMode,
      viewMode: edit.viewMode,
      meta: {
        duration: edit.meta?.duration || 0,
        width: edit.meta?.width || 0,
        height: edit.meta?.height || 0
      }
    });
    const mergedEdits = { ...(savedEditsRef.current || {}) };
    Object.entries(edits || {}).forEach(([id, edit]) => {
      if (!edit) return;
      mergedEdits[id] = serializeEdit(edit);
    });
    savedEditsRef.current = mergedEdits;
    return {
      playlist: playlistRef.current.map(v => ({
        id: v.id,
        name: v.name,
        type: v.type || v.file?.type || '',
        size: v.size || v.file?.size || 0,
        lastModified: v.lastModified || v.file?.lastModified || 0,
        fileKey: v.fileKey,
        suffix: v.suffix || '',
        sheetRow: v.sheetRow || null,
        sheetMode: v.sheetMode || '',
        sheetCameraType: v.sheetCameraType || '',
        sheetStatus: v.sheetStatus || '',
        checked: !!v.checked,
        notRelevant: !!v.notRelevant,
        hasSnow: !!v.hasSnow,
        labels: Array.isArray(v.labels) ? v.labels : [],
        channels: Array.isArray(v.channels) ? v.channels : [],
        source: v.source || '',
        sourcePath: v.sourcePath || '',
        sourceBaseDir: v.sourceBaseDir || ''
      })),
      edits: mergedEdits,
      prefs: {
        isDark,
        batchSuffix,
        seekStep,
        uploadToDrive,
        sidebarWidth,
        adminBaseUrl,
        overwriteOutputs
      }
    };
  }, [
    playlistRef,
    savedEditsRef,
    edits,
    isDark,
    batchSuffix,
    seekStep,
    uploadToDrive,
    sidebarWidth,
    adminBaseUrl,
    overwriteOutputs
  ]);

  const applySnapshotPayload = useCallback(
    (payload, { preserveLocalSelection = false } = {}) => {
      if (!payload) return;
      const savedList = Array.isArray(payload.playlist) ? payload.playlist : [];
      const localSelection = preserveLocalSelection
        ? getPlaylistSelection(loadFromStorage(STORAGE_KEYS.playlist, []))
        : null;
      const migratedEdits = { ...(payload.edits || {}) };
      const normalized = savedList
        .filter(item => item?.fileKey)
        .map(item => {
          const stableServerKey =
            item.source === 'server' && item.sourcePath
              ? getServerFileKey(item.sourceBaseDir || '', item.sourcePath)
              : '';
          if (stableServerKey && (stableServerKey !== item.id || stableServerKey !== item.fileKey)) {
            const savedEdit = migratedEdits[item.id] || migratedEdits[item.fileKey];
            if (savedEdit && !migratedEdits[stableServerKey]) {
              migratedEdits[stableServerKey] = savedEdit;
            }
            if (item.id !== stableServerKey) delete migratedEdits[item.id];
            if (item.fileKey !== stableServerKey) delete migratedEdits[item.fileKey];
          }
          const fallbackMode =
            resolveSegmentModeFromMeta(item.sheetMode, item.sheetCameraType) ||
            resolveSegmentModeFromSuffix(item.suffix);
          const fallbackChannels = fallbackMode
            ? [
              {
                mode: fallbackMode,
                suffix: item.suffix || resolveSuffixFromMode(item.sheetMode, item.sheetCameraType),
                sheetMode: item.sheetMode || '',
                sheetCameraType: item.sheetCameraType || '',
                sheetStatus: item.sheetStatus || '',
                sheetRow: item.sheetRow || null
              }
            ]
            : [];
          return {
            ...item,
            ...(stableServerKey ? { id: stableServerKey, fileKey: stableServerKey } : {}),
            url: null,
            file: null,
            checked: preserveLocalSelection
              ? getPlaylistItemChecked(
                  stableServerKey ? { ...item, id: stableServerKey, fileKey: stableServerKey } : item,
                  localSelection
                )
              : Boolean(item.checked),
            isLoading: false,
            suffix: item.suffix || '',
            sheetRow: item.sheetRow || null,
            sheetMode: item.sheetMode || '',
            sheetCameraType: item.sheetCameraType || '',
            sheetStatus: item.sheetStatus || '',
            notRelevant: !!item.notRelevant,
            hasSnow: !!item.hasSnow,
            labels: Array.isArray(item.labels) ? item.labels : [],
            source: item.source || '',
            sourcePath: item.sourcePath || '',
            sourceBaseDir: item.sourceBaseDir || '',
            channels: Array.isArray(item.channels) ? item.channels : fallbackChannels
          };
        });
      const { playlist: deduped } = dedupePlaylistAndEdits(normalized, {});
      const fileKeyCounts = getFileKeyCounts(deduped);
      const savedEdits = migratedEdits;
      savedEditsRef.current = savedEdits;
      setPlaylist(deduped);
      setEdits(() => {
        const next = {};
        deduped.forEach(item => {
          const restored = buildEditFromSaved(
            getSavedEditForVideo(savedEdits, item, fileKeyCounts)
          );
          if (restored) next[item.id] = restored;
        });
        return next;
      });
      setCurrentId(prev =>
        deduped.some(item => item.id === prev) ? prev : deduped[0]?.id || null
      );
      const prefsPayload = payload.prefs || {};
      if (typeof prefsPayload.isDark === 'boolean') setIsDark(prefsPayload.isDark);
      if (typeof prefsPayload.batchSuffix === 'string') setBatchSuffix(prefsPayload.batchSuffix);
      if (typeof prefsPayload.seekStep === 'number') setSeekStep(prefsPayload.seekStep);
      if (typeof prefsPayload.uploadToDrive === 'boolean')
        setUploadToDrive(prefsPayload.uploadToDrive);
      if (typeof prefsPayload.sidebarWidth === 'number')
        setSidebarWidth(prefsPayload.sidebarWidth);
      if (typeof prefsPayload.adminBaseUrl === 'string')
        setAdminBaseUrl(
          IS_REMOTE_HOST && /localhost|127\.0\.0\.1/.test(prefsPayload.adminBaseUrl)
            ? ''
            : prefsPayload.adminBaseUrl
        );
      if (typeof prefsPayload.overwriteOutputs === 'boolean')
        setOverwriteOutputs(prefsPayload.overwriteOutputs);
      saveToStorage(STORAGE_KEYS.playlist, savedList);
      saveToStorage(STORAGE_KEYS.edits, savedEdits);
      saveToStorage(STORAGE_KEYS.prefs, {
        isDark:
          typeof prefsPayload.isDark === 'boolean' ? prefsPayload.isDark : isDark,
        batchSuffix:
          typeof prefsPayload.batchSuffix === 'string'
            ? prefsPayload.batchSuffix
            : batchSuffix,
        seekStep:
          typeof prefsPayload.seekStep === 'number' ? prefsPayload.seekStep : seekStep,
        uploadToDrive:
          typeof prefsPayload.uploadToDrive === 'boolean'
            ? prefsPayload.uploadToDrive
            : uploadToDrive,
        sidebarWidth:
          typeof prefsPayload.sidebarWidth === 'number'
            ? prefsPayload.sidebarWidth
            : sidebarWidth,
        adminBaseUrl:
          typeof prefsPayload.adminBaseUrl === 'string'
            ? prefsPayload.adminBaseUrl
            : adminBaseUrl,
        overwriteOutputs:
          typeof prefsPayload.overwriteOutputs === 'boolean'
            ? prefsPayload.overwriteOutputs
            : overwriteOutputs
      });
    },
    [
      adminBaseUrl,
      batchSuffix,
      buildEditFromSaved,
      dedupePlaylistAndEdits,
      getFileKeyCounts,
      getSavedEditForVideo,
      isDark,
      overwriteOutputs,
      seekStep,
      setBatchSuffix,
      setCurrentId,
      setEdits,
      setIsDark,
      setOverwriteOutputs,
      setPlaylist,
      setSeekStep,
      setSidebarWidth,
      setUploadToDrive,
      sidebarWidth,
      uploadToDrive
    ]
  );

  const saveAdminSnapshot = useCallback(async () => {
    const payload = buildSnapshotPayload();
    setAdminSyncState(prev => ({ ...prev, status: 'syncing', error: null }));
    const data = await fetchAdminJson('/sync', { method: 'POST', json: payload });
    if (data?.ok) {
      setAdminSyncState({
        status: 'ok',
        updatedAt: data.updatedAt || new Date().toISOString(),
        error: null
      });
      showHud("Стан збережено в БД");
    } else {
      setAdminSyncState({ status: 'error', updatedAt: null, error: 'sync_failed' });
    }
  }, [buildSnapshotPayload, fetchAdminJson, showHud]);

  const applyAdminSnapshot = useCallback(() => {
    if (!adminSnapshot?.payload) {
      showHud("Немає snapshot");
      return;
    }
    applySnapshotPayload(adminSnapshot.payload);
    showHud("Стан відновлено");
  }, [adminSnapshot, applySnapshotPayload, showHud]);

  const loadAdminJobs = useCallback(
    async (options = {}) => {
      const data = await fetchAdminJson('/jobs', options);
      if (data?.jobs) {
        setAdminJobs(data.jobs);
        setAdminLastRefreshAt(new Date());
      }
    },
    [fetchAdminJson]
  );

  const loadAdminJob = useCallback(
    async (id, options = {}) => {
      if (!id) return;
      const data = await fetchAdminJson(`/jobs/${id}`, options);
      if (data?.job) {
        setAdminJob(data.job);
        setAdminLastRefreshAt(new Date());
        const expected = adminJobExpectedMapRef.current.get(data.job.id);
        if (typeof expected === 'number' || expected === null) {
          setAdminJobExpectedDuration(expected);
        }
      }
    },
    [fetchAdminJson]
  );

  const runAdminFfmpeg = useCallback(async () => {
    const selected = playlist.filter(p => p.checked);
    const targets = selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
    if (targets.length === 0) {
      showHud("Оберіть відео");
      return;
    }
    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const sheetMap = await loadSheetMap();
    if (!sheetMap) return;
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const skipped = [];
    const jobsToRun = [];
    const useBatchSuffix = selected.length > 0;
    targets.forEach(video => {
      const edit = edits[video.id] || DEFAULT_EDIT_STATE;
      const baseVariants = getVideoChannelVariants({
        ...video, channels: buildChannelsFromEntries(sheetMap.get(normalizeName(video.name)) || [])
      });
      const variants = baseVariants;
      let lastJobIndex = null;
      let lastRenameLine = null;
      variants.forEach(variant => {
        const modeSegments = getSegmentsForMode(edit, variant.channelMode);
        const supportsSnow = true;
        const snowSegments = Array.isArray(modeSegments) ? modeSegments.filter(seg => !!seg?.isSnow) : [];
        const normalSegments = Array.isArray(modeSegments) ? modeSegments.filter(seg => !seg?.isSnow) : [];
        const hasAnySegments = Array.isArray(modeSegments) && modeSegments.length > 0;
        const jobs = [];

        if (hasAnySegments) {
          if (normalSegments.length > 0) {
            jobs.push({ video: variant, segmentsOverride: normalSegments, labelSuffix: '' });
          }
          if (supportsSnow && snowSegments.length > 0) {
            jobs.push({
              video: { ...variant, suffix: `${variant.suffix || ''}_snow` },
              segmentsOverride: snowSegments,
              labelSuffix: 'snow'
            });
          }
        }

        jobs.forEach(job => {
          const allowRenameOriginal = allowDoneForVideo(job.video, fileKeyCounts, fileKeyVariants);
          const result = buildFfmpegLinesFor(job.video, edit, {
            useBatchSuffix,
            allowRenameOriginal,
            overwriteOutput: overwriteOutputs,
            segmentMode: variant.channelMode,
            segmentsOverride: job.segmentsOverride,
            batchSuffix,
            getVideoOutputDir,
            getVideoDoneDir,
            getSegmentModeForVideo,
            buildRcloneCopyLine,
            includeRenameLine: false
          });
          if (result.error) {
            skipped.push(job.video.name || job.video.id);
            return;
          }
          if (result.renameLine) lastRenameLine = result.renameLine;
          const needsOutputDir = result.needsOutputDir !== false;
          const outputDir = result.outputDir || 'cutted';
          const tmpDir = result.tmpDir || `${outputDir}/_tmp`;
          const header = [
            ...(needsOutputDir ? [`mkdir -p \"${outputDir}\"`] : []),
            ...(needsOutputDir && result.usesTemp ? [`mkdir -p \"${tmpDir}\"`] : [])
          ];
          const command = [...header, ...result.lines].join('\n').trim();
          if (!command) {
            skipped.push(job.video.name || job.video.id);
            return;
          }
          const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
          const expectedDuration = Array.isArray(job.segmentsOverride)
            ? job.segmentsOverride.reduce(
                (sum, seg) => sum + Math.max(0, (seg.end ?? 0) - (seg.start ?? 0)),
                0
              )
            : getExportDurationForEdit(edit, variant.channelMode);
          jobsToRun.push({
            command,
            expectedDuration,
            label: `${job.video.name || job.video.id} ${label || job.video.suffix || ''}${job.labelSuffix ? ` ${job.labelSuffix}` : ''}`.trim()
          });
          lastJobIndex = jobsToRun.length - 1;
        });
      });
      if (lastRenameLine && lastJobIndex !== null) {
        const base = jobsToRun[lastJobIndex];
        jobsToRun[lastJobIndex] = {
          ...base,
          command: `${base.command}\n${lastRenameLine}`.trim()
        };
      }
    });
    if (jobsToRun.length === 0) {
      showHud("Немає валідних відео для FFmpeg");
      return;
    }
    if (skipped.length > 0) showHud(`Пропущено: ${skipped.length}`);
    let firstId = null;
    for (const job of jobsToRun) {
      const data = await fetchAdminJson('/jobs', { method: 'POST', json: { command: job.command } });
      if (data?.id) {
        if (!firstId) firstId = data.id;
        adminJobExpectedMapRef.current.set(data.id, job.expectedDuration ?? null);
      }
    }
    if (firstId) {
      setAdminJobId(firstId);
      setAdminJobExpectedDuration(adminJobExpectedMapRef.current.get(firstId) ?? null);
      loadAdminJob(firstId);
    }
    showHud(`Запущено job-ів: ${jobsToRun.length}`);
  }, [
    activeVideo,
    allowDoneForVideo,
    buildFfmpegLinesFor,
    edits,
    fetchAdminJson,
    getFileKeyCounts,
    getFileKeyVariants,
    getVideoChannelVariants,
    loadAdminJob,
    loadSheetMap,
    overwriteOutputs,
    playlist,
    playlistRef,
    showHud
  ]);

  const runAdminClipchampExport = useCallback(async () => {
    const selected = playlist.filter(item => item.checked);
    const targets = selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
    if (targets.length === 0) {
      showHud("Оберіть відео для Clipchamp");
      return;
    }

    const remoteName = String(adminConfig.clipchampDriveRemote || '').trim().replace(/:+$/, '');
    const rootFolderId = extractDriveFolderId(adminConfig.clipchampDriveFolderId);
    const uploadToDrive = adminConfig.clipchampUploadToDrive !== false;
    if (uploadToDrive && (!remoteName || !rootFolderId)) {
      showHud("Заповніть Clipchamp Drive remote і Folder ID");
      return;
    }

    const createdAt = new Date();
    const folderName = formatClipchampFolderName(
      createdAt,
      adminConfig.clipchampFolderPrefix || 'Clipchamp'
    );
    const localDir = `Clipchamp_exports/${folderName}`;
    const processingLines = [];
    const linksRows = [];
    const manifestFiles = [];
    const skipped = [];
    let expectedDuration = 0;
    const sheetMap = await loadSheetMap();
    if (!sheetMap) return;

    targets.forEach(video => {
      if (video.notRelevant) {
        skipped.push(video.name || video.id);
        return;
      }
      if (!video.sourcePath) {
        skipped.push(`${video.name || video.id}: немає server sourcePath`);
        return;
      }
      const edit = edits[video.id] || DEFAULT_EDIT_STATE;
      const baseVariants = getVideoChannelVariants({
        ...video, channels: buildChannelsFromEntries(sheetMap.get(normalizeName(video.name)) || [])
      });
      const variants = baseVariants;

      variants.forEach(variant => {
        const channelMode = variant.channelMode || getSegmentModeForVideo(variant);
        const baseSuffix = variant.suffix || getSuffixForSegmentMode(channelMode);
        const modeSegments = getSegmentsForMode(edit, channelMode);
        const snowSegments = Array.isArray(modeSegments)
          ? modeSegments.filter(segment => !!segment?.isSnow)
          : [];
        const regularSegments = Array.isArray(modeSegments)
          ? modeSegments.filter(segment => !segment?.isSnow)
          : [];
        const hasSegments = Array.isArray(modeSegments) && modeSegments.length > 0;
        const jobs = [];
        if (hasSegments) {
          if (regularSegments.length > 0) {
            jobs.push({ suffix: baseSuffix, segments: regularSegments, snow: false });
          }
          if (snowSegments.length > 0) {
            jobs.push({ suffix: `${baseSuffix}_snow`, segments: snowSegments, snow: true });
          }
        }

        jobs.forEach(job => {
          const exportVideo = { ...variant, suffix: job.suffix, notRelevant: false };
          const result = buildFfmpegLinesFor(exportVideo, edit, {
            outputDir: localDir,
            doneDir: `${localDir}/_done`,
            useBatchSuffix: false,
            allowRenameOriginal: false,
            includeRenameLine: false,
            overwriteOutput: true,
            segmentMode: channelMode,
            segmentsOverride: job.segments,
            batchSuffix: '',
            getVideoOutputDir,
            getVideoDoneDir,
            getSegmentModeForVideo,
            buildRcloneCopyLine: null
          });
          if (result.error || !result.outputName) {
            skipped.push(`${video.name || video.id}: ${result.error || 'missing_output'}`);
            return;
          }

          processingLines.push(`# ${video.name || video.id} → ${result.outputName}`);
          processingLines.push(`printf 'CLIPCHAMP_RENDER_START %s\\n' ${shellQuote(result.outputName)}`);
          processingLines.push('if (');
          processingLines.push('set -e');
          processingLines.push(...result.lines, '');
          processingLines.push('); then');
          processingLines.push(`  printf 'CLIPCHAMP_RENDER_DONE %s\\n' ${shellQuote(result.outputName)}`);
          processingLines.push('else');
          processingLines.push(`  printf 'CLIPCHAMP_RENDER_FAILED %s\\n' ${shellQuote(result.outputName)}`);
          processingLines.push('  CLIPCHAMP_EXPORT_FAILED=1');
          processingLines.push('fi', '');
          const mapEntries = sheetMap?.get(normalizeName(video.name)) || [];
          const matchingEntry =
            mapEntries.find(
              entry =>
                resolveSegmentModeFromMeta(entry.analogDigital, entry.cameraType) === channelMode
            ) || mapEntries[0];
          const sourceLink = variant.sheetLink || matchingEntry?.link || '';
          const duration = Array.isArray(job.segments)
            ? job.segments.reduce(
                (sum, segment) =>
                  sum + Math.max(0, (segment.end ?? 0) - (segment.start ?? 0)),
                0
              )
            : getExportDurationForEdit(edit, channelMode);
          expectedDuration += duration;
          linksRows.push({ link: sourceLink, filename: result.outputName });
          manifestFiles.push({
            sourceName: video.name || '',
            sourcePath: video.sourcePath || '',
            sourceLink,
            filename: result.outputName,
            suffix: job.suffix,
            channelMode,
            snow: job.snow,
            segmentCount: Array.isArray(job.segments) ? job.segments.length : 0,
            duration: Number(duration.toFixed(3))
          });
        });
      });
    });

    if (manifestFiles.length === 0) {
      showHud("Немає валідних відео для Clipchamp");
      return;
    }

    const command = buildClipchampExportCommand({
      localDir,
      remoteName,
      rootFolderId,
      uploadToDrive,
      folderName,
      processingLines,
      linksRows,
      manifest: {
        createdAt: createdAt.toISOString(),
        folderName,
        ...(uploadToDrive ? { driveFolderId: rootFolderId, remote: remoteName } : {}),
        files: manifestFiles,
        skipped
      }
    });
    const data = await fetchAdminJson('/jobs', {
      method: 'POST',
      json: { command }
    });
    if (!data?.id) {
      showHud("Не вдалося запустити Clipchamp export");
      return;
    }
    adminJobExpectedMapRef.current.set(data.id, expectedDuration || null);
    setAdminJobId(data.id);
    setAdminJobExpectedDuration(expectedDuration || null);
    loadAdminJob(data.id);
    showHud(`Clipchamp export: ${folderName}`);
  }, [
    activeVideo,
    adminConfig.clipchampDriveFolderId,
    adminConfig.clipchampDriveRemote,
    adminConfig.clipchampFolderPrefix,
    adminConfig.clipchampUploadToDrive,
    buildFfmpegLinesFor,
    edits,
    fetchAdminJson,
    getExportDurationForEdit,
    getSegmentModeForVideo,
    getSuffixForSegmentMode,
    getVideoChannelVariants,
    getVideoDoneDir,
    getVideoOutputDir,
    loadAdminJob,
    loadSheetMap,
    playlist,
    showHud
  ]);

  const applyAiSegments = useCallback(
    items => {
      if (!Array.isArray(items) || items.length === 0) return;
      const modeSet = new Set(SEGMENT_MODES.map(mode => mode.id));
      const byId = new Map(playlistRef.current.map(item => [item.id, item]));
      const bySource = new Map(
        playlistRef.current.filter(item => item.sourcePath).map(item => [item.sourcePath, item])
      );

      setEdits(prev => {
        const next = { ...prev };
        items.forEach(item => {
          const target =
            (item.id && byId.get(item.id)) ||
            (item.sourcePath && bySource.get(item.sourcePath));
          if (!target) return;
          const rawSegments = item.segments || {};
          const allowedModes = new Set((target.channels || [])
            .filter(channel => channel.sheetRow)
            .map(channel => channel.mode));
          const labels = Object.keys(rawSegments).filter(label => modeSet.has(label) && allowedModes.has(label));
          if (labels.length === 0) return;
          const existing = next[target.id] || DEFAULT_EDIT_STATE;
          const baseSets = normalizeSegmentSets(
            existing.segmentSets,
            existing.segments,
            existing.segmentMode || 'digital'
          );
          const nextSets = { ...baseSets };
          labels.forEach(label => {
            const list = Array.isArray(rawSegments[label]) ? rawSegments[label] : [];
            nextSets[label] = list
              .map(seg => ({
                id: seg.id || `${label}_${Math.round((seg.start || 0) * 1000)}`,
                start: Number(seg.start) || 0,
                end: Number(seg.end) || 0
              }))
              .filter(seg => seg.end > seg.start);
          });
          const nextMode = labels.includes(existing.segmentMode)
            ? existing.segmentMode
            : labels[0];
          next[target.id] = {
            ...existing,
            segmentMode: nextMode,
            segmentSets: nextSets,
            segments: nextSets[nextMode] || []
          };
        });
        return next;
      });

    },
    [playlistRef, setEdits]
  );

  const applyLogoDetections = useCallback(
    items => {
      if (!Array.isArray(items) || items.length === 0) return;
      const byId = new Map(playlistRef.current.map(item => [item.id, item]));
      const bySource = new Map(
        playlistRef.current.filter(item => item.sourcePath).map(item => [item.sourcePath, item])
      );
      setEdits(prev => {
        const next = { ...prev };
        items.forEach(item => {
          const target =
            (item.id && byId.get(item.id)) ||
            (item.sourcePath && bySource.get(item.sourcePath));
          if (!target) return;
          const segments = Array.isArray(item.segments) ? item.segments : [];
          const existing = next[target.id] || DEFAULT_EDIT_STATE;
          const metaWidth = item.width || item.videoWidth || existing.meta?.width || 0;
          const metaHeight = item.height || item.videoHeight || existing.meta?.height || 0;
          if (!metaWidth || !metaHeight) return;
          const baseElements = Array.isArray(existing.elements)
            ? existing.elements.filter(el => el.source !== 'ai-logo')
            : [];
          if (segments.length === 0) {
            next[target.id] = {
              ...existing,
              elements: baseElements
            };
            return;
          }
          const logoElements = segments.map((seg, index) => {
            const xPct = clamp((Number(seg.x) || 0) / metaWidth * 100, 0, 100);
            const yPct = clamp((Number(seg.y) || 0) / metaHeight * 100, 0, 100);
            const wPct = clamp((Number(seg.w) || 0) / metaWidth * 100, 0.5, 100);
            const hPct = clamp((Number(seg.h) || 0) / metaHeight * 100, 0.5, 100);
            const safeW = clamp(Math.min(wPct, 100 - xPct), 0.5, 100);
            const safeH = clamp(Math.min(hPct, 100 - yPct), 0.5, 100);
            return {
              id: seg.id || `logo_${Date.now()}_${index}`,
              type: 'rect',
              x: xPct,
              y: yPct,
              w: safeW,
              h: safeH,
              color: '#000000',
              isOutline: false,
              thickness: 1,
              startTime: Number(seg.start) || 0,
              endTime: Number(seg.end) || (Number(seg.start) || 0) + 0.1,
              source: 'ai-logo'
            };
          });
          next[target.id] = {
            ...existing,
            meta: {
              ...existing.meta,
              width: existing.meta?.width || metaWidth,
              height: existing.meta?.height || metaHeight
            },
            elements: [...baseElements, ...logoElements]
          };
        });
        return next;
      });
    },
    [playlistRef, setEdits]
  );

  const resolveAiTargets = useCallback(
    overrideIds => {
      if (overrideIds && overrideIds.size) {
        return playlist.filter(item => overrideIds.has(item.id) && getExpectedModesForAi(item).length > 0);
      }
      const selected = playlist.filter(p => p.checked);
      const targets = selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
      return targets.filter(item => getExpectedModesForAi(item).length > 0);
    },
    [activeVideo, getExpectedModesForAi, playlist]
  );

  // Якщо серед цілей є відео, що вже мають сегменти нарізки, — питаємо:
  // перерізати заново (нові канали додадуться, наявні сегменти перезапишуться)
  // чи пропустити їх і не палити час Colab на повторну обробку.
  const askAboutAlreadyCut = useCallback(
    targets => {
      // Спочатку короткі: вони встигають навіть у коротку Colab-сесію,
      // а довгі не блокують усю чергу. Тривалість — з метаданих правок.
      const durationOf = item => {
        const d = Number(edits?.[item.id]?.meta?.duration);
        return Number.isFinite(d) && d > 0 ? d : Number.POSITIVE_INFINITY;
      };
      const byDuration = list => [...list].sort((a, b) => durationOf(a) - durationOf(b));
      const alreadyCut = targets.filter(item => {
        const edit = edits?.[item.id];
        if (!edit) return false;
        const sets = normalizeSegmentSets(edit.segmentSets, edit.segments, edit.segmentMode || 'digital');
        return Object.values(sets).some(list => Array.isArray(list) && list.length > 0);
      });
      if (alreadyCut.length === 0) return byDuration(targets);
      const names = alreadyCut.slice(0, 6).map(item => item.name || item.fileKey || item.id).join(', ');
      const more = alreadyCut.length > 6 ? ` і ще ${alreadyCut.length - 6}` : '';
      const redo = window.confirm(
        `Уже нарізані відео: ${alreadyCut.length} (${names}${more}).\n\nПерерізати їх заново? Нові канали додадуться, наявні сегменти перезапишуться.\n\nOK — перерізати всі\nСкасувати — пропустити вже нарізані`
      );
      if (redo) return byDuration(targets);
      const skip = new Set(alreadyCut.map(item => item.id));
      return byDuration(targets.filter(item => !skip.has(item.id)));
    },
    [edits]
  );

  const buildAiQueue = useCallback((targets, provider) => {
    setAdminAiQueue(
      targets.map(item => ({
        id: item.id,
        name: item.name || item.fileKey || item.id,
        sourcePath: item.sourcePath || '',
        status: 'pending',
        provider
      }))
    );
    setAdminAiLastProvider(provider);
  }, []);

  const runAdminAiSegments = useCallback(async (overrideIds = null) => {
    const resolvedTargets = resolveAiTargets(overrideIds);
    const targets = askAboutAlreadyCut(resolvedTargets);
    if (targets.length === 0) {
      showHud(resolvedTargets.length > 0 ? "Усі обрані вже нарізані — пропускаю" : "Немає вибраних відео з каналами таблиці");
      return;
    }
    const files = targets
      .filter(item => item.sourcePath)
      .map(item => {
        const allowedModes = getExpectedModesForAi(item);
        return {
          id: item.id,
          name: item.name || item.fileKey || item.id,
          fileKey: item.fileKey,
          sourcePath: item.sourcePath,
          allowedModes
        };
      });
    if (files.length === 0) {
      showHud("Потрібні відео з теки сервера");
      return;
    }
    buildAiQueue(targets, 'local');
    setAdminAiQueue(prev =>
      prev.map(item =>
        item.sourcePath
          ? { ...item, status: 'pending' }
          : { ...item, status: 'error', error: 'no_source' }
      )
    );
    setAdminAiLoading(true);
    setAdminAiStats(null);
    setAdminAiLastRequestAt(Date.now());
    setAdminAiLastError(null);
    adminAiAbortRef.current = { aborted: false, controller: null, controllers: [] };
    let processed = 0;
    let failures = targets.length - files.length;

    for (const file of files) {
      if (adminAiAbortRef.current.aborted) break;
      setAiQueueStatus(file.id, { status: 'running', error: null });
      const controller = new AbortController();
      adminAiAbortRef.current.controller = controller;
      const data = await fetchAdminJson('/ai/segments', {
        method: 'POST',
        json: {
          files: [file],
          modelPath: adminConfig.aiModelPath || '',
          pythonPath: adminConfig.aiPythonPath || '',
          fps: Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : 1,
          minDuration: Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : 2,
          writeFfmpeg: true,
          overwrite: overwriteOutputs
        },
        silent: true,
        signal: controller.signal
      });
      if (adminAiAbortRef.current.aborted) break;

      const items = Array.isArray(data?.payload?.items) ? data.payload.items : [];
      if (!data?.ok || items.length === 0) {
        failures += 1;
        setAiQueueStatus(file.id, {
          status: 'error',
          error: data?.ok ? 'no_segments' : 'request_failed'
        });
        setAdminAiStats({ processed, failed: failures });
        continue;
      }

      applyAiSegments(items);
      processed += items.length;
      setAiQueueStatus(file.id, { status: 'done', error: null });
      setAdminAiStats({ processed, failed: failures });
      showHud(`AI готово: ${file.name}`);
    }

    adminAiAbortRef.current.controller = null;
    setAdminAiLoading(false);
    if (adminAiAbortRef.current.aborted) {
      setAdminAiQueue(prev =>
        prev.map(item =>
          item.status === 'running' || item.status === 'pending'
            ? { ...item, status: 'error', error: 'stopped' }
            : item
        )
      );
      showHud("AI зупинено");
      return;
    }
    setAdminAiStats({ processed, failed: failures });
    if (processed === 0) {
      setAdminAiLastError('AI failed');
      showHud("AI не відпрацював");
      return;
    }
    showHud(failures > 0 ? `AI: ${processed}, помилок: ${failures}` : `AI сегменти: ${processed}`);
  }, [
    adminConfig.aiFps,
    adminConfig.aiMinDuration,
    adminConfig.aiModelPath,
    adminConfig.aiPythonPath,
    applyAiSegments,
    askAboutAlreadyCut,
    buildAiQueue,
    fetchAdminJson,
    getExpectedModesForAi,
    overwriteOutputs,
    resolveAiTargets,
    setAiQueueStatus,
    showHud
  ]);

  const runAdminAiSegmentsNgrok = useCallback(async (overrideIds = null) => {
    const resolvedTargets = resolveAiTargets(overrideIds);
    const targets = askAboutAlreadyCut(resolvedTargets);
    if (targets.length === 0) {
      showHud(resolvedTargets.length > 0 ? 'Усі обрані вже нарізані — пропускаю' : 'Немає вибраних відео з каналами таблиці');
      return;
    }
    const remoteBase = String(adminConfig.aiRemoteUrl || '').trim().replace(/\/+$/, '');
    if (!remoteBase) {
      showHud('Вкажи URL Cloudflare або ngrok тунелю');
      return;
    }
    const fps = Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : 1;
    const minDuration = Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : 2;
    const proxyBase = `${adminBaseUrl.replace(/\/+$/, '')}/ai/remote-proxy/${encodeURIComponent(remoteBase)}`;
    let processed = 0;
    let failed = 0;
    let mismatched = 0;
    const updateStats = () => setAdminAiStats({ processed, failed, mismatched });
    buildAiQueue(targets, 'ngrok');
    setAdminAiLoading(true);
    setAdminAiStats(null);
    setAdminAiLastRequestAt(Date.now());
    setAdminAiLastError(null);
    adminAiAbortRef.current = { aborted: false, controller: null, controllers: [] };

    for (const target of targets) {
      if (adminAiAbortRef.current.aborted) break;
      const controller = new AbortController();
      adminAiAbortRef.current.controller = controller;
      setAiQueueStatus(target.id, { status: 'running', error: null, errorDetail: null, taskId: null });
      try {
        let fileBlob = target?.file instanceof Blob ? target.file : null;
        let fileName = target?.file?.name || target?.name || 'video.mp4';
        if (!fileBlob && target?.sourcePath) {
          const url = `${adminBaseUrl.replace(/\/+$/, '')}/file?path=${encodeURIComponent(target.sourcePath)}`;
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) throw new Error(`Не вдалося прочитати відео з локального сервера: HTTP ${response.status}`);
          fileBlob = await response.blob();
          fileName = target.sourcePath.split('/').pop() || fileName;
        }
        if (!fileBlob) throw new Error('Не знайдено файл відео для старого Colab');

        const formData = new FormData();
        formData.append('video', fileBlob, fileName);
        formData.append('fps', String(fps));
        formData.append('min_duration', String(minDuration));
        const response = await fetch(`${proxyBase}/predict`, {
          method: 'POST', body: formData, signal: controller.signal
        });
        if (!response.ok) throw new Error(`Старий Colab відповів HTTP ${response.status}`);
        const queued = await response.json();
        if (!queued?.ok) throw new Error(queued?.error || 'Старий Colab не прийняв відео');
        if (queued.task_id) setAiQueueStatus(target.id, { taskId: queued.task_id });
        const result = queued.status === 'queued' && queued.task_id
          ? await pollRemoteAiTask({ baseUrl: proxyBase, taskId: queued.task_id, signal: controller.signal })
          : queued;
        setAdminAiRemoteState({ status: 'ok', lastCheckedAt: Date.now(), lastHttp: response.status, lastError: null });
        const raw = normalizeRemoteAiSegments(result);
        const allowedModes = new Set(getExpectedModesForAi(target));
        const segments = Object.fromEntries(Object.entries(raw).filter(([mode, values]) =>
          allowedModes.has(mode) && Array.isArray(values) && values.length > 0
        ));
        const segmentCount = countAiSegments(segments);
        if (!segmentCount) {
          const detail = describeRemoteAiResponse(result);
          if (countAiSegments(raw) > 0) {
            // Модель сегменти знайшла, але не в тих каналах, що очікує таблиця:
            // це не помилка нарізки, а розбіжність «таблиця ↔ вміст» — окремий статус.
            mismatched += 1;
            setAiQueueStatus(target.id, { status: 'mismatch', error: 'channel_mismatch', errorDetail: detail, segmentCount: 0 });
            updateStats();
            continue;
          }
          failed += 1;
          setAdminAiLastError(`${fileName}: Colab завершив task, але сегментів не знайдено. ${detail}`);
          setAiQueueStatus(target.id, { status: 'error', error: 'no_segments', errorDetail: detail, segmentCount: 0 });
          updateStats();
          continue;
        }
        applyAiSegments([{ id: target.id, sourcePath: target.sourcePath || '', segments }]);
        processed += 1;
        setAiQueueStatus(target.id, { status: 'done', error: null, errorDetail: null, segmentCount });
        updateStats();
        showHud(`AI готово: ${fileName}`);
      } catch (error) {
        if (adminAiAbortRef.current.aborted) break;
        failed += 1;
        const detail = String(error?.message || error);
        setAdminAiRemoteState({ status: 'error', lastCheckedAt: Date.now(), lastHttp: null, lastError: detail });
        setAiQueueStatus(target.id, { status: 'error', error: 'ngrok_failed', errorDetail: detail });
        setAdminAiLastError(`${target.name || target.id}: ${detail}`);
        updateStats();
      }
    }
    adminAiAbortRef.current.controller = null;
    setAdminAiLoading(false);
    if (adminAiAbortRef.current.aborted) {
      setAdminAiQueue(prev => prev.map(item => ['running', 'pending'].includes(item.status)
        ? { ...item, status: 'cancelled', error: 'stopped' }
        : item));
      showHud('Старий Colab зупинено');
      return;
    }
    showHud(processed ? `Старий Colab: готово ${processed}, помилок ${failed}` : failed ? 'Старий Colab не відпрацював' : 'Немає сегментів');
  }, [
    adminBaseUrl, adminConfig.aiFps, adminConfig.aiMinDuration, adminConfig.aiRemoteUrl,
    applyAiSegments, askAboutAlreadyCut, buildAiQueue, resolveAiTargets, setAiQueueStatus, showHud
  ]);

  const runAdminAiSegmentsRemote = useCallback(async (overrideIds = null) => {
    const resolvedTargets = resolveAiTargets(overrideIds);
    const targets = askAboutAlreadyCut(resolvedTargets);
    if (targets.length === 0) {
      showHud(resolvedTargets.length > 0 ? "Усі обрані вже нарізані — пропускаю" : "Немає вибраних відео з каналами таблиці");
      return;
    }
    if (!adminConfig.aiDriveRemote) {
      showHud("Спочатку налаштуй rclone у вкладці Google Drive");
      return;
    }
    const batchTimestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
    const batchId = `${batchTimestamp}Z-${createId()}`;
    const fps = Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : 1;
    const minDuration = Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : 2;
    const batchItems = targets.map(target => ({
      id: target.id,
      name: target.name || target.fileKey || target.id,
      sourcePath: target.sourcePath || '',
      status: 'pending',
      provider: 'colab',
      batchId,
      clientJobId: createId()
    }));
    setAdminAiQueue(batchItems);
    setAdminAiLastProvider('colab');
    setAdminAiLoading(true);
    setAdminAiStats(null);
    setAdminAiLastRequestAt(Date.now());
    setAdminAiLastError(null);
    adminAiAbortRef.current = { aborted: false, controller: null, controllers: [] };
    const setStatus = (id, patch, message) => setAdminAiQueue(prev => prev.map(item => {
      if (item.id !== id) return item;
      const logs = message
        ? [...(Array.isArray(item.logs) ? item.logs : []), { at: new Date().toISOString(), message }].slice(-40)
        : item.logs;
      return { ...item, ...patch, ...(logs ? { logs } : {}) };
    }));
    const started = await fetchAdminJson('/ai/drive-batch/start', {
      method: 'POST', json: { batchId }, silent: true, returnErrorPayload: true
    });
    if (!started?.ok) {
      const detail = started?.detail || started?.error || (started === null
        ? 'Локальний API не відповів. Повністю перезапусти редактор через START.command.'
        : 'rclone_failed');
      setAdminAiQueue(prev => prev.map(item => ({
        ...item,
        status: 'error',
        error: 'drive_start_failed',
        errorDetail: detail,
        logs: [...(Array.isArray(item.logs) ? item.logs : []), { at: new Date().toISOString(), message: `Не вдалося створити папку черги у Drive: ${detail}` }].slice(-40)
      })));
      setAdminAiLastError(`Не вдалося створити папку черги в Drive: ${detail}`);
      setAdminAiLoading(false);
      return;
    }

    let cursor = 0;
    let uploadFailures = 0;
    let uploadsFinished = false;
    const lastLoggedPercent = new Map();
    const lastProgressSignature = new Map();
    const lastRemoteStatus = new Map(batchItems.map(item => [item.id, 'pending']));
    const progressPolling = (async () => {
      while (!uploadsFinished && !adminAiAbortRef.current.aborted) {
        const snapshot = await fetchAdminJson(`/ai/drive-batch/${encodeURIComponent(batchId)}/progress`, {
          silent: true, returnErrorPayload: true
        });
        if (adminAiAbortRef.current.aborted) break;
        if (snapshot?.ok) {
          for (const progress of snapshot.items || []) {
            const target = targets.find(candidate => batchItems.some(item => item.id === candidate.id && item.clientJobId === progress.taskId));
            if (!target) continue;
            const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
            const signature = `${percent}:${progress.bytesTransferred || 0}:${progress.speed || ''}:${progress.eta || ''}:${progress.phase || ''}`;
            if (lastProgressSignature.get(progress.taskId) === signature) continue;
            lastProgressSignature.set(progress.taskId, signature);
            const priorPercent = lastLoggedPercent.get(progress.taskId) ?? -10;
            const shouldLog = percent >= 100 || percent >= priorPercent + 10;
            if (shouldLog) lastLoggedPercent.set(progress.taskId, percent);
            setStatus(target.id, {
              status: 'uploading',
              uploadProgress: {
                percent,
                bytesTransferred: progress.bytesTransferred,
                totalBytes: progress.totalBytes,
                speed: progress.speed,
                eta: progress.eta,
                phase: progress.phase
              }
            }, shouldLog
              ? (percent >= 100 ? 'Передавання відео в Drive завершено; зберігаю запис задачі.' : `Передавання оригіналу в Google Drive: ${percent}%.`)
              : null);
          }
        }
        await new Promise(resolve => window.setTimeout(resolve, 750));
      }
    })();
    const uploadWorker = async () => {
      while (cursor < targets.length && !adminAiAbortRef.current.aborted) {
        const index = cursor++;
        const target = targets[index];
        const item = batchItems[index];
        if (!target.sourcePath) {
          uploadFailures += 1;
          setStatus(target.id, { status: 'error', error: 'source_path_missing' }, 'Не знайдено вихідний файл на комп’ютері.');
          continue;
        }
        setStatus(target.id, { status: 'uploading', error: null, uploadProgress: { percent: 0, phase: 'uploading' } }, 'Почав передавання оригіналу в Google Drive.');
        const controller = new AbortController();
        adminAiAbortRef.current.controllers.push(controller);
        let result;
        try {
          result = await fetchAdminJson(`/ai/drive-batch/${encodeURIComponent(batchId)}/files`, {
            method: 'POST',
            json: {
              taskId: item.clientJobId,
              sourcePath: target.sourcePath,
              allowedModes: getExpectedModesForAi(target),
              fps,
              imageSize: 320,
              minDuration,
              smoothWindow: 3
            },
            silent: true,
            returnErrorPayload: true,
            signal: controller.signal
          });
        } finally {
          adminAiAbortRef.current.controllers = adminAiAbortRef.current.controllers.filter(active => active !== controller);
        }
        if (adminAiAbortRef.current.aborted) {
          setStatus(target.id, { status: 'cancelled', error: 'stopped', errorDetail: null }, 'Передавання зупинено.');
          continue;
        }
        if (!result?.ok) {
          uploadFailures += 1;
          const detail = result?.detail || result?.error || (result === null
            ? 'Локальний API не відповів. Перезапусти редактор через START.command.'
            : 'upload_failed');
          setStatus(target.id, {
            status: 'error', error: 'drive_upload_failed',
            errorDetail: detail
          }, `Не вдалося передати відео: ${detail}`);
          continue;
        }
        if (result.status === 'error') {
          uploadFailures += 1;
          setStatus(target.id, {
            status: 'error', error: 'drive_upload_failed',
            errorDetail: result.error || 'video_upload_failed', taskId: result.task_id
          }, `Помилка передавання в Drive: ${result.error || 'невідома помилка'}`);
          continue;
        }
        setStatus(target.id, {
          status: 'accepted',
          taskId: result.task_id,
          drivePath: result.drivePath,
          error: null,
          errorDetail: null,
          uploadProgress: { percent: 100, phase: 'uploaded' }
        }, 'Оригінал збережено в Google Drive. Colab ще має забрати його з черги.');
        lastRemoteStatus.set(target.id, 'accepted');
      }
    };
    await Promise.all(Array.from({ length: Math.min(2, targets.length) }, () => uploadWorker()));
    uploadsFinished = true;
    await progressPolling;
    if (adminAiAbortRef.current.aborted) {
      setAdminAiLoading(false);
      showHud('Передачу зупинено; вже прийняті файли залишились у Google Drive');
      return;
    }
    const acceptedCount = targets.length - uploadFailures;
    setAdminAiStats({ accepted: acceptedCount, failed: uploadFailures, processed: 0 });
    if (acceptedCount === 0) {
      setAdminAiLoading(false);
      showHud('Жодне відео не потрапило в Google Drive');
      return;
    }
    showHud(`${acceptedCount} відео прийнято у Drive; localhost можна вимкнути`);

    try {
      let remaining = acceptedCount;
      const missingJobSince = new Map();
      while (remaining > 0 && !adminAiAbortRef.current.aborted) {
        const snapshot = await fetchAdminJson(`/ai/drive-batch/${encodeURIComponent(batchId)}`, { silent: true });
        if (!snapshot?.ok) throw new Error(snapshot?.detail || snapshot?.error || 'drive_status_failed');
        const byTask = new Map((snapshot.items || []).map(job => [job.task_id, job]));
        let done = 0;
        let failed = uploadFailures;
        remaining = 0;
        for (const target of targets) {
          const item = batchItems.find(candidate => candidate.id === target.id);
          if (!item) continue;
          const job = byTask.get(item.clientJobId);
          if (!job) {
            const firstMissingAt = missingJobSince.get(item.clientJobId) || Date.now();
            missingJobSince.set(item.clientJobId, firstMissingAt);
            if (Date.now() - firstMissingAt > 120000) {
              failed += 1;
              setStatus(target.id, { status: 'error', error: 'job_missing', errorDetail: 'Не знайшов запис задачі у Drive за 2 хвилини.' }, 'У Drive не з’явився запис задачі за 2 хвилини.');
            } else {
              remaining += 1;
              setStatus(target.id, { status: 'accepted', errorDetail: 'Очікую запис задачі у Drive…' });
            }
            continue;
          }
          missingJobSince.delete(item.clientJobId);
          if (job?.status === 'done') {
            done += 1;
            if (!item.applied) {
              const raw = normalizeRemoteAiSegments(job);
              const filtered = Object.fromEntries(Object.entries(raw).filter(([label]) =>
                SEGMENT_MODES.some(mode => mode.id === label)
              ));
              const segmentCount = countAiSegments(filtered);
              applyAiSegments([{ id: target.id, sourcePath: target.sourcePath || '', segments: filtered }]);
              if (segmentCount > 0) {
                item.applied = true;
                setStatus(target.id, { status: 'done', applied: true, segmentCount, error: null }, `Colab завершив обробку; знайдено сегментів: ${segmentCount}.`);
              } else {
                failed += 1;
                setStatus(target.id, { status: 'error', error: 'no_segments', errorDetail: describeRemoteAiResponse(job) }, 'Colab завершив відео, але не повернув сегментів.');
              }
            }
          } else if (job?.status === 'error') {
            failed += 1;
            setStatus(target.id, { status: 'error', error: 'remote_error', errorDetail: job.error || 'Colab task failed' }, `Colab повідомив про помилку: ${job.error || 'невідома помилка'}`);
          } else if (job?.status === 'cancelled') {
            setStatus(target.id, { status: 'cancelled', error: 'stopped', errorDetail: null }, 'Задачу скасовано в Colab.');
          } else {
            remaining += 1;
            const nextStatus = job?.status === 'processing' ? 'processing' : 'accepted';
            const priorStatus = lastRemoteStatus.get(target.id);
            lastRemoteStatus.set(target.id, nextStatus);
            const processedFrames = Number(job?.processed_frames);
            const frameCount = Number(job?.frame_count);
            setStatus(target.id, {
              status: nextStatus,
              processingProgress: Number.isFinite(processedFrames) && Number.isFinite(frameCount) && frameCount > 0
                ? { frames: processedFrames, totalFrames: frameCount, percent: Math.min(100, Math.round(processedFrames / frameCount * 100)) }
                : null
            }, priorStatus !== nextStatus
              ? (nextStatus === 'processing' ? 'Colab почав обробляти відео.' : 'Відео в Drive; очікує на початок обробки Colab.')
              : null);
          }
        }
        setAdminAiStats({ accepted: acceptedCount, processed: done, failed });
        if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, 4000));
      }
      showHud('Colab batch завершено; сегменти збережені у Drive');
    } catch (error) {
      setAdminAiLastError(`Відео вже у Drive. Статуси можна оновити пізніше: ${String(error?.message || error)}`);
    } finally {
      setAdminAiLoading(false);
    }
  }, [
    adminConfig.aiFps,
    adminConfig.aiMinDuration,
    adminConfig.aiDriveRemote,
    applyAiSegments,
    askAboutAlreadyCut,
    fetchAdminJson,
    getExpectedModesForAi,
    resolveAiTargets,
    showHud
  ]);

  const checkAdminAiDrive = useCallback(async () => {
    const remote = String(adminConfig.aiDriveRemote || '').trim();
    if (!remote) {
      setAdminAiDriveCheck('Вкажи назву rclone remote, наприклад best2-my-drive.');
      return false;
    }
    setAdminAiDriveCheck('Перевіряю Google Drive…');
    const saved = await saveAdminConfig();
    if (!saved) {
      setAdminAiDriveCheck('Не вдалося зберегти налаштування. Перевір локальний сервер.');
      return false;
    }
    const result = await fetchAdminJson('/ai/drive-batch/check', {
      method: 'POST', json: { remote }, silent: true, returnErrorPayload: true
    });
    if (result?.ok) {
      setAdminAiDriveCheck(`Drive підключений: ${remote}:best2_training`);
      return true;
    }
    const detail = result?.detail || result?.error || 'Локальний сервер не відповів';
    setAdminAiDriveCheck(`Не підключено: ${detail}`);
    return false;
  }, [adminConfig.aiDriveRemote, fetchAdminJson, saveAdminConfig]);

  const refreshAdminAiBatch = useCallback(async () => {
    const queue = adminAiQueue.filter(item => item.provider === 'colab' && item.batchId);
    const batchId = queue.at(-1)?.batchId;
    if (!batchId) {
      showHud('Немає збереженої черги Colab');
      return;
    }
    setAdminAiLoading(true);
    try {
      const snapshot = await fetchAdminJson(`/ai/drive-batch/${encodeURIComponent(batchId)}`, { silent: true });
      if (!snapshot?.ok) throw new Error(snapshot?.detail || snapshot?.error || 'drive_status_failed');
      const byTask = new Map((snapshot.items || []).map(job => [job.task_id, job]));
      const updates = new Map();
      let done = 0;
      let failed = 0;
      let remaining = 0;
      for (const item of queue) {
        if (item.batchId !== batchId) continue;
        const withEvent = (patch, message) => {
          const logs = message && item.status !== patch.status
            ? [...(Array.isArray(item.logs) ? item.logs : []), { at: new Date().toISOString(), message }].slice(-40)
            : item.logs;
          return { ...item, ...patch, ...(logs ? { logs } : {}) };
        };
        if (!item.taskId) {
          if (['pending', 'uploading'].includes(item.status)) {
            failed += 1;
            updates.set(item.id, withEvent({ status: 'error', error: 'upload_incomplete', errorDetail: 'Файл не встиг зберегтися в Drive. Повтори передачу.' }, 'Передавання не було завершене; файл не прийнято в Drive.'));
          }
          continue;
        }
        const job = byTask.get(item.taskId);
        if (!job) {
          remaining += 1;
          continue;
        }
        if (job.status === 'done') {
          done += 1;
          const target = playlistRef.current.find(video => video.id === item.id);
          if (!item.applied && target) {
            const raw = normalizeRemoteAiSegments(job);
            const filtered = Object.fromEntries(Object.entries(raw).filter(([label]) =>
              SEGMENT_MODES.some(mode => mode.id === label)
            ));
            const segmentCount = countAiSegments(filtered);
            applyAiSegments([{ id: item.id, sourcePath: item.sourcePath || '', segments: filtered }]);
            const nextStatus = segmentCount > 0 ? 'done' : 'error';
            updates.set(item.id, withEvent({ status: nextStatus, applied: segmentCount > 0, segmentCount, error: segmentCount > 0 ? null : 'no_segments', errorDetail: segmentCount > 0 ? null : describeRemoteAiResponse(job) }, segmentCount > 0 ? `Colab завершив обробку; знайдено сегментів: ${segmentCount}.` : 'Colab завершив відео, але не повернув сегментів.'));
          } else {
            if (target) applyAiSegments([{ id: item.id, sourcePath: item.sourcePath || '', segments: {} }]);
            const segmentCount = item.segmentCount ?? countAiSegments(normalizeRemoteAiSegments(job));
            updates.set(item.id, withEvent({ status: 'done', segmentCount, error: null }, `Colab завершив обробку; знайдено сегментів: ${segmentCount}.`));
          }
        } else if (job.status === 'error') {
          failed += 1;
          updates.set(item.id, withEvent({ status: 'error', error: 'remote_error', errorDetail: job.error || 'Colab task failed' }, `Colab повідомив про помилку: ${job.error || 'невідома помилка'}`));
        } else if (job.status === 'cancelled') {
          updates.set(item.id, withEvent({ status: 'cancelled', error: 'stopped', errorDetail: null }, 'Задачу скасовано в Colab.'));
        } else {
          remaining += 1;
          const nextStatus = job.status === 'processing' ? 'processing' : 'accepted';
          const processedFrames = Number(job.processed_frames);
          const frameCount = Number(job.frame_count);
          updates.set(item.id, withEvent({
            status: nextStatus,
            processingProgress: Number.isFinite(processedFrames) && Number.isFinite(frameCount) && frameCount > 0
              ? { frames: processedFrames, totalFrames: frameCount, percent: Math.min(100, Math.round(processedFrames / frameCount * 100)) }
              : null
          }, nextStatus === 'processing' ? 'Colab почав обробляти відео.' : 'Відео в Drive; очікує на початок обробки Colab.'));
        }
      }
      if (updates.size) setAdminAiQueue(prev => prev.map(item => updates.get(item.id) || item));
      setAdminAiStats({ accepted: queue.length, processed: done, failed });
      showHud(remaining ? `Статуси оновлено; у черзі ще ${remaining}` : 'Результати синхронізовано з Drive');
    } catch (error) {
      setAdminAiLastError(`Не вдалося прочитати чергу з Drive: ${String(error?.message || error)}`);
    } finally {
      setAdminAiLoading(false);
    }
  }, [adminAiQueue, applyAiSegments, fetchAdminJson, getExpectedModesForAi, playlistRef, showHud]);

  const stopAdminAi = useCallback(async () => {
    adminAiAbortRef.current.aborted = true;
    if (adminAiAbortRef.current.controller) {
      adminAiAbortRef.current.controller.abort();
    }
    adminAiAbortRef.current.controllers.forEach(controller => controller.abort());
    const batchId = adminAiQueue.find(item => item.batchId)?.batchId;
    let stopped = !batchId;
    if (batchId) {
      const result = await fetchAdminJson(`/ai/drive-batch/${encodeURIComponent(batchId)}/stop`, {
        method: 'POST', json: {}, silent: true, returnErrorPayload: true
      });
      stopped = Boolean(result?.ok);
      if (stopped) {
        setAdminAiLastError(null);
      } else {
        setAdminAiLastError(`Не вдалося зупинити чергу в Drive: ${result?.detail || result?.error || 'сервер не відповів'}`);
      }
    }
    setAdminAiLoading(false);
    if (stopped) {
      setAdminAiQueue(prev => prev.map(item =>
        ['running', 'pending', 'uploading', 'accepted', 'processing'].includes(item.status)
          ? { ...item, status: 'cancelled', error: 'stopped', errorDetail: null }
          : item
      ));
    }
    showHud(stopped ? (batchId ? 'Передачу і чергу Colab зупинено' : 'AI зупинено') : 'Передачу перервано; перевір стан черги в Drive');
  }, [adminAiQueue, fetchAdminJson, showHud]);

  const retryAdminAiFailed = useCallback(async () => {
    const failed = adminAiQueue.filter(item => item.status === 'error' || item.status === 'mismatch');
    if (failed.length === 0) {
      showHud("Немає помилок");
      return;
    }
    const groups = ['local', 'ngrok', 'colab'].map(provider => ({
      provider,
      ids: new Set(failed.filter(item => (item.provider || adminAiLastProvider) === provider).map(item => item.id))
    })).filter(group => group.ids.size > 0);
    if (groups.length === 0) {
      showHud("Не вдалося визначити режим для повтору");
      return;
    }
    for (const group of groups) {
      if (group.provider === 'local') await runAdminAiSegments(group.ids);
      else if (group.provider === 'ngrok') await runAdminAiSegmentsNgrok(group.ids);
      else await runAdminAiSegmentsRemote(group.ids);
    }
  }, [adminAiLastProvider, adminAiQueue, runAdminAiSegments, runAdminAiSegmentsNgrok, runAdminAiSegmentsRemote, showHud]);

  // Забрати готові нарізки, які серверний пайплайн зробив у фоні
  // (Telegram → черга → Colab), і застосувати їх до відео за назвами файлів.
  // Автоматика (вимога Максима): редактор сам підтягує нові нарізки —
  // при відкритті й далі кожні 2 хвилини; кнопка — лише ручний запас,
  // якщо щось злетіло (ручний виклик застосовує все примусово).
  const pullCutInFlight = useRef(false);
  const pullServerCutResults = useCallback(async (opts = {}) => {
    const auto = Boolean(opts && opts.auto);
    if (pullCutInFlight.current) return;
    if (auto && playlist.length === 0) return;
    pullCutInFlight.current = true;
    try {
      let data;
      try {
        const res = await fetch('/ui/cut-results', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
      } catch {
        if (!auto) showHud('Не вдалося забрати результати з сервера');
        return;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      if (items.length === 0) {
        if (!auto) showHud('На сервері ще немає готових нарізок');
        return;
      }
      const markers = auto ? (loadFromStorage(SERVER_CUT_APPLIED_KEY, {}) || {}) : {};
      const byName = new Map();
      playlist.forEach(video => {
        if (video.name) byName.set(video.name, video);
        if (video.fileKey) byName.set(video.fileKey, video);
      });
      const toApply = [];
      const mismatches = [];
      let skipped = 0;
      for (const item of items) {
        const video = byName.get(item.name);
        if (!video) { skipped += 1; continue; }
        const version = cutResultVersion(item);
        if (auto && markers[item.name] === version) { skipped += 1; continue; }
        const raw = normalizeRemoteAiSegments(item.result || {});
        const allowedModes = new Set(getExpectedModesForAi(video));
        const segments = Object.fromEntries(Object.entries(raw).filter(([mode, values]) =>
          allowedModes.has(mode) && Array.isArray(values) && values.length > 0
        ));
        if (countAiSegments(segments) === 0) {
          if (countAiSegments(raw) > 0) {
            // Модель нарізала, але не ті канали, що очікує таблиця: як і в
            // ручному AI-потоці, сегменти НЕ кладемо — відео отримує статус
            // «перевір тип каналу» в AI-черзі редактора.
            mismatches.push({ id: video.id, name: video.name || video.fileKey || item.name, sourcePath: video.sourcePath || '', detail: describeRemoteAiResponse(item.result || {}), _name: item.name, _version: version });
          } else {
            skipped += 1;
          }
          continue;
        }
        toApply.push({ id: video.id, sourcePath: video.sourcePath || '', segments, _name: item.name, _version: version });
      }
      if (mismatches.length > 0) {
        setAdminAiQueue(prev => {
          const map = new Map(prev.map(q => [q.id, q]));
          mismatches.forEach(m => {
            map.set(m.id, { ...(map.get(m.id) || {}), id: m.id, name: m.name, sourcePath: m.sourcePath, status: 'mismatch', provider: 'colab', error: 'channel_mismatch', errorDetail: m.detail, segmentCount: 0 });
          });
          return [...map.values()];
        });
      }
      if (toApply.length > 0 || mismatches.length > 0) {
        if (auto) {
          const next = { ...markers };
          toApply.forEach(({ _name, _version }) => { next[_name] = _version; });
          mismatches.forEach(({ _name, _version }) => { next[_name] = _version; });
          saveToStorage(SERVER_CUT_APPLIED_KEY, next);
        }
        if (toApply.length > 0) applyAiSegments(toApply.map(({ _name, _version, ...rest }) => rest));
        if (auto) {
          showHud(`З сервера підтягнулось нових нарізок: ${toApply.length}` + (mismatches.length > 0 ? ` · перевір тип каналу: ${mismatches.length}` : ''));
        } else {
          showHud(`Серверні нарізки: застосовано ${toApply.length}, перевір тип каналу: ${mismatches.length}, пропущено ${skipped}`);
        }
      } else if (!auto) {
        showHud(`Серверні нарізки: застосовано 0, пропущено ${skipped}`);
      }
    } finally {
      pullCutInFlight.current = false;
    }
  }, [applyAiSegments, getExpectedModesForAi, playlist, setAdminAiQueue, showHud]);

  const pullCutRef = useRef(pullServerCutResults);
  pullCutRef.current = pullServerCutResults;
  useEffect(() => {
    if (!IS_REMOTE_HOST) return undefined;
    const first = setTimeout(() => { pullCutRef.current({ auto: true }); }, 6000);
    const timer = setInterval(() => { pullCutRef.current({ auto: true }); }, 120000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);

  const runAdminLogoDetection = useCallback(async () => {
    const selected = playlist.filter(p => p.checked);
    const targets = selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
    if (targets.length === 0) {
      showHud("Оберіть відео");
      return;
    }
    const files = targets
      .filter(item => item.sourcePath)
      .map(item => ({ id: item.id, fileKey: item.fileKey, sourcePath: item.sourcePath }));
    if (files.length === 0) {
      showHud("Потрібні відео з теки сервера");
      return;
    }
    setAdminLogoLoading(true);
    setAdminLogoStats(null);
    const data = await fetchAdminJson('/ai/logo', {
      method: 'POST',
      json: {
        files,
        templatePath: adminConfig.logoTemplatePath || '',
        pythonPath: adminConfig.aiPythonPath || '',
        fps: Number.isFinite(adminConfig.logoFps) ? adminConfig.logoFps : 2,
        size: Number.isFinite(adminConfig.logoSize) ? adminConfig.logoSize : 640,
        threshold: Number.isFinite(adminConfig.logoThreshold) ? adminConfig.logoThreshold : 0.55,
        minDuration: Number.isFinite(adminConfig.logoMinDuration)
          ? adminConfig.logoMinDuration
          : 0.5,
        maxMatches: Number.isFinite(adminConfig.logoMaxMatches)
          ? adminConfig.logoMaxMatches
          : 5,
        maxGap: Number.isFinite(adminConfig.logoMaxGap) ? adminConfig.logoMaxGap : 0.5,
        scales: typeof adminConfig.logoScales === 'string' ? adminConfig.logoScales : ''
      },
      silent: true
    });
    setAdminLogoLoading(false);
    if (!data?.ok) {
      showHud("Лого не знайдено");
      return;
    }
    const items = data.items || [];
    applyLogoDetections(items);
    setAdminLogoStats({ processed: items.length });
    showHud(`Лого: ${items.length}`);
  }, [
    activeVideo,
    adminConfig.aiPythonPath,
    adminConfig.logoFps,
    adminConfig.logoMaxGap,
    adminConfig.logoMaxMatches,
    adminConfig.logoMinDuration,
    adminConfig.logoScales,
    adminConfig.logoSize,
    adminConfig.logoTemplatePath,
    adminConfig.logoThreshold,
    applyLogoDetections,
    fetchAdminJson,
    playlist,
    showHud
  ]);

  const saveCoverTrainingExample = useCallback(async elementId => {
    const video = videoRef?.current;
    const element = (edits[currentId]?.elements || []).find(item => item.id === elementId);
    if (!video || video.readyState < 2 || !element || !['rect', 'circle'].includes(element.type)) {
      showHud('Обери прямокутник або коло на завантаженому відео');
      return;
    }
    if (currentTime < Number(element.startTime || 0) || currentTime > Number(element.endTime || 0)) {
      showHud('Перейди на час, коли це перекриття видно у відео');
      return;
    }
    const canvas = document.createElement('canvas');
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const scale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
    canvas.width = Math.max(1, Math.round(sourceWidth * scale));
    canvas.height = Math.max(1, Math.round(sourceHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      showHud('Не вдалося захопити кадр');
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const payload = {
      image: canvas.toDataURL('image/jpeg', 0.9),
      x: clamp(Number(element.x) / 100, 0, 1),
      y: clamp(Number(element.y) / 100, 0, 1),
      w: clamp(Number(element.w) / 100, 0.001, 1 - clamp(Number(element.x) / 100, 0, 1)),
      h: clamp(Number(element.h) / 100, 0.001, 1 - clamp(Number(element.y) / 100, 0, 1)),
      kind: 'cover_region',
      sourceVideo: activeVideo?.name || activeVideo?.sourcePath || '',
      timestamp: Number(video.currentTime ?? currentTime) || 0,
      imageWidth: canvas.width,
      imageHeight: canvas.height
    };
    const result = await fetchAdminJson('/ai/cover-example', {
      method: 'POST', json: payload, silent: true, returnErrorPayload: true
    });
    if (result?.ok) showHud('Кадр і рамку додано в Drive: cover_region');
    else showHud(`Не вдалося зберегти приклад: ${result?.detail || result?.error || 'перевір rclone'}`);
  }, [activeVideo, currentId, currentTime, edits, fetchAdminJson, showHud, videoRef]);

  const stopAdminJob = useCallback(
    async id => {
      const targetId = id || adminJobId || adminJob?.id;
      if (!targetId) {
        showHud("Немає активного job-а");
        return;
      }
      if (!window.confirm("Зупинити job?")) return;
      const data = await fetchAdminJson(`/jobs/${targetId}/stop`, { method: 'POST' });
      if (data?.ok) {
        showHud("Job зупинено");
        loadAdminJobs();
        loadAdminJob(targetId, { silent: true });
      }
    },
    [adminJob?.id, adminJobId, fetchAdminJson, loadAdminJob, loadAdminJobs, showHud]
  );

  const retryIncompleteAdminJob = useCallback(async id => {
    const targetId = id || adminJobId || adminJob?.id;
    if (!targetId) return;
    const data = await fetchAdminJson(`/jobs/${targetId}/retry-incomplete`, {
      method: 'POST', returnErrorPayload: true
    });
    if (!data?.ok) {
      showHud(data?.error === 'no_incomplete_files'
        ? 'Незавершених файлів немає'
        : 'Не вдалося повторити незавершені файли');
      return;
    }
    setAdminJobId(data.id);
    loadAdminJobs();
    loadAdminJob(data.id);
    showHud(`Повторено незавершені файли: ${data.remaining}`);
  }, [adminJob?.id, adminJobId, fetchAdminJson, loadAdminJob, loadAdminJobs, showHud]);

  const buildRenameCommand = useCallback(
    (video, mode) => {
      if (!video) return null;
      const sourcePath = video.sourcePath || video.name;
      if (!sourcePath) return null;
      const fileName = sourcePath.split('/').pop() || sourcePath;
      const dot = fileName.lastIndexOf('.');
      const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
      const ext = dot > 0 ? fileName.slice(dot + 1) : 'mp4';
      if (mode === 'done' && baseName.endsWith('_done')) return null;
      const doneDir = getVideoDoneDir(video);
      const suffix = mode === 'not_relevant' ? '_not_relevant' : '_done';
      const targetPath = `${doneDir}/${baseName}${suffix}.${ext}`;
      const inputPath = sourcePath.startsWith('./') ? sourcePath : `./${sourcePath}`;
      return `[ -e "${inputPath}" ] && [ ! -e "${targetPath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${targetPath}"`;
    },
    [getVideoDoneDir]
  );

  const queueServerRename = useCallback(
    async (video, mode) => {
      if (!video || video.source !== 'server') return;
      const command = buildRenameCommand(video, mode);
      if (!command) return;
      await fetchAdminJson('/jobs', { method: 'POST', json: { command }, silent: true });
    },
    [buildRenameCommand, fetchAdminJson]
  );

  const pickAdminFolder = useCallback(async () => {
    const data = await fetchAdminJson('/config/pick-folder', {
      method: 'POST',
      json: { save: true }
    });
    if (data?.config) {
      setAdminConfig(data.config);
      if (data.path) showHud("Теку вибрано");
    } else if (data?.path) {
      setAdminConfig(prev => ({ ...prev, baseDir: data.path }));
      showHud("Теку вибрано");
    }
  }, [fetchAdminJson, showHud]);

  const addVideosFromServer = useCallback(async (options = {}) => {
    const { modes = [], snow = 'any', onlySheet = true, silent = false } = options;
    const hud = silent ? () => {} : showHud;
    const data = await fetchAdminJson('/files');
    if (!data?.files) return;
    if (data.files.length === 0) {
      hud("Файлів не знайдено");
      return;
    }
    const sheetMap = await loadSheetMap();
    if (!sheetMap) {
      hud("Таблиця не завантажена");
      if (onlySheet) return;
    }
    const savedEdits = savedEditsRef.current || {};
    const existingByFileKey = new Map(
      playlistRef.current.filter(v => v.fileKey).map(v => [v.fileKey, v])
    );
    const newVideos = [];
    const mergedUpdates = [];
    let skipped = 0;
    let inSheetCount = 0;
    let filteredOut = 0;
    const unmatched = [];
    const baseDir = data.baseDir || '';
    const entryHasSnow = entry => {
      if (!entry) return false;
      const rawLabels = entry.labels ? String(entry.labels) : '';
      const normalized = normalizeName(rawLabels);
      return normalized.includes('snow') || normalized.includes('сніг');
    };

    data.files.forEach(fileInfo => {
      const fileKey = getServerFileKey(
        baseDir,
        fileInfo.relativePath
      );
      const normalizedName = normalizeName(fileInfo.name);
      const sheetEntries = sheetMap?.get(normalizedName) || [];
      const hasSheetEntry = sheetEntries.length > 0;
      const sheetHasBoth = hasSheetEntry && entriesHaveBoth(sheetEntries);

      if (hasSheetEntry) inSheetCount += 1;
      else unmatched.push(fileInfo.name);

      if (onlySheet && !hasSheetEntry) {
        filteredOut += 1;
        return;
      }

      const entries = hasSheetEntry ? sheetEntries : [null];
      const orderedEntries = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const orderDiff = getEntryOrder(a.entry) - getEntryOrder(b.entry);
          return orderDiff !== 0 ? orderDiff : a.index - b.index;
        })
        .map(item => item.entry);

      const channels = buildChannelsFromEntries(orderedEntries);
      const hasSnow = orderedEntries.some(entryHasSnow) || normalizeName(fileInfo.name).includes('snow');
      const labels = mergeLabelTokens(
        [],
        orderedEntries.flatMap(entry => parseLabelTokens(entry?.labels))
      );

      if (modes.length > 0 && !channels.some(channel => modes.includes(channel.mode))) {
        filteredOut += 1;
        return;
      }
      if (snow === 'only' && !hasSnow) {
        filteredOut += 1;
        return;
      }
      if (snow === 'exclude' && hasSnow) {
        filteredOut += 1;
        return;
      }
      const existingItem = existingByFileKey.get(fileKey);

      if (existingItem) {
        const merged = channels;
        const nextSuffix = resolveImportSuffix('', merged);
        const nextHasSnow = existingItem.hasSnow || hasSnow;
        const nextLabels = mergeLabelTokens(existingItem.labels, labels);
        if (
          JSON.stringify(merged) !== JSON.stringify(existingItem.channels || []) ||
          nextSuffix !== existingItem.suffix ||
          nextHasSnow !== existingItem.hasSnow ||
          nextLabels.length !== (existingItem.labels || []).length
        ) {
          const updated = {
            ...existingItem,
            suffix: nextSuffix,
            channels: merged,
            sheetHasBoth: existingItem.sheetHasBoth || sheetHasBoth,
            hasSnow: nextHasSnow,
            labels: nextLabels
          };
          existingByFileKey.set(fileKey, updated);
          mergedUpdates.push(updated);
        }
        skipped += 1;
        return;
      }

      const primarySuffix = resolveImportSuffix('', channels);
      newVideos.push({
        id: fileKey,
        file: null,
        url: null,
        name: fileInfo.name,
        checked: false,
        suffix: primarySuffix,
        notRelevant: false,
        hasSnow,
        fileKey,
        type: fileInfo.type || '',
        size: fileInfo.size || 0,
        lastModified: fileInfo.mtimeMs || 0,
        isLoading: false,
        sheetRow: null,
        sheetMode: '',
        sheetCameraType: '',
        sheetStatus: '',
        sheetHasBoth,
        channels,
        labels,
        source: 'server',
        sourcePath: fileInfo.relativePath,
        sourceBaseDir: baseDir
      });
    });

    setAdminImportStats({
      added: newVideos.length,
      updated: mergedUpdates.length,
      skipped,
      inSheet: inSheetCount,
      unmatched,
      filteredOut,
      total: data.files.length
    });

    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const combinedList = [...currentList, ...mergedUpdates, ...newVideos];
    const { playlist: dedupedList, edits: dedupedEdits, idMap } =
      dedupePlaylistAndEdits(combinedList, edits);
    const fileKeyCounts = getFileKeyCounts(dedupedList);
    const nextEdits = { ...dedupedEdits };
    dedupedList.forEach(video => {
      if (nextEdits[video.id]) return;
      const restored = buildEditFromSaved(
        getSavedEditForVideo(savedEdits, video, fileKeyCounts)
      );
      if (restored) nextEdits[video.id] = restored;
    });
    setPlaylist(dedupedList);
    setEdits(nextEdits);
    if (currentId && !dedupedList.some(item => item.id === currentId)) {
      const mapped = idMap.get(currentId);
      if (mapped && dedupedList.some(item => item.id === mapped)) {
        setCurrentId(mapped);
      } else if (dedupedList[0]) {
        setCurrentId(dedupedList[0].id);
      }
    }
    if (!currentId && dedupedList[0]) setCurrentId(dedupedList[0].id);
    if (newVideos.length === 0) {
      hud(
        mergedUpdates.length > 0
          ? `Оновлено ${mergedUpdates.length} файлів`
          : "Нових файлів немає"
      );
      return;
    }
    hud(`Додано ${newVideos.length} файлів`);
  }, [
    buildEditFromSaved,
    currentId,
    dedupePlaylistAndEdits,
    edits,
    fetchAdminJson,
    getFileKeyCounts,
    getSavedEditForVideo,
    loadSheetMap,
    playlist,
    playlistRef,
    savedEditsRef,
    setCurrentId,
    setEdits,
    setPlaylist,
    showHud
  ]);

  const adminSheetFiltered = useMemo(() => {
    const rows = adminSheet?.rows || [];
    return rows.filter(row => {
      if (!adminSheetFilter) return true;
      const query = normalizeName(adminSheetFilter);
      return (
        normalizeName(row.fileName).includes(query) ||
        normalizeName(row.status).includes(query) ||
        normalizeName(row.analogDigital).includes(query) ||
        normalizeName(row.cameraType).includes(query)
      );
    });
  }, [adminSheet, adminSheetFilter]);

  const adminJobProgress = useMemo(
    () => (adminJob ? getJobProgress(adminJob) : null),
    [adminJob, getJobProgress]
  );

  useEffect(() => {
    if (!adminOpen) return;
    const healthCheck = window.setTimeout(() => pingAdmin({ silent: true }), 0);
    loadAdminConfig();
    loadAdminJobs();
    return () => window.clearTimeout(healthCheck);
  }, [adminOpen, loadAdminConfig, loadAdminJobs, pingAdmin]);

  // Серверна версія: конфіг підтягується одразу, без відкриття адмінки.
  useEffect(() => {
    if (!IS_REMOTE_HOST) return;
    loadAdminConfig();
  }, [loadAdminConfig]);

  // Серверна версія: файли з робочої теки підтягуються САМІ — при старті
  // й кожні 5 хвилин, без ручного «Підтягнути з теки». Тихо (silent):
  // автоматична перевірка не показує HUD-тостів — вони лише для кнопки.
  // Політика імпорту та сама, що в пікера за замовчуванням: усі режими,
  // будь-який сніг, не лише таблиця.
  useEffect(() => {
    if (!IS_REMOTE_HOST) return;
    if (!adminConfig.baseDir) return;
    const run = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const r = addVideosFromServer({ modes: [], snow: 'any', onlySheet: false, silent: true });
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch {
        /* наступний цикл повторить */
      }
    };
    const first = window.setTimeout(run, 2000);
    const iv = window.setInterval(run, 300000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, [adminConfig.baseDir, addVideosFromServer]);

  useEffect(() => {
    if (!adminOpen) return;
    if (!adminConfig.aiRemoteUrl) return;
    pingAdminAiRemote();
  }, [adminOpen, adminConfig.aiRemoteUrl, pingAdminAiRemote]);

  useEffect(() => {
    if (!adminOpen) setAdminHistoryOpen(false);
  }, [adminOpen]);

  useEffect(() => {
    const hasActiveJob =
      adminJob?.status === 'running' ||
      adminJob?.status === 'queued' ||
      adminJobs.some(job => job.status === 'running' || job.status === 'queued');
    if (!adminAutoRefresh || (!adminOpen && !hasActiveJob)) return;
    const interval = setInterval(() => {
      const id = adminJobId || adminJob?.id;
      loadAdminJobs({ silent: true });
      if (id) loadAdminJob(id, { silent: true });
    }, 1500);
    return () => clearInterval(interval);
  }, [
    adminOpen,
    adminAutoRefresh,
    adminJobId,
    adminJob?.id,
    adminJob?.status,
    adminJobs,
    loadAdminJobs,
    loadAdminJob
  ]);

  useEffect(() => {
    if (!adminAutoRefresh || adminJobs.length === 0) return;
    const currentIsRunning = adminJobs.some(
      job => job.id === (adminJobId || adminJob?.id) && job.status === 'running'
    );
    if (currentIsRunning) return;
    const runningJob = adminJobs.find(job => job.status === 'running');
    if (!runningJob || runningJob.id === adminJobId) return;
    setAdminJobId(runningJob.id);
    setAdminJob(runningJob);
    setAdminJobExpectedDuration(
      adminJobExpectedMapRef.current.get(runningJob.id) ?? null
    );
  }, [adminJobs, adminAutoRefresh, adminJobId, adminJob?.id]);

  useEffect(() => {
    if (!adminJobs.length) return;
    const prev = adminJobStatusRef.current;
    const next = new Map();
    adminJobs.forEach(job => {
      next.set(job.id, job.status);
      const prevStatus = prev.get(job.id);
      if (prevStatus && prevStatus !== job.status) {
        const label = getJobMeta(job).label || `#${job.id.slice(-4)}`;
        if (job.status === 'done') showHud(`Готово: ${label}`);
        if (job.status === 'error') showHud(`Помилка: ${label}`);
        if (job.status === 'canceled') showHud(`Зупинено: ${label}`);
      }
    });
    adminJobStatusRef.current = next;
  }, [adminJobs, getJobMeta, showHud]);

  useEffect(() => {
    if (!autoSyncEnabled) return;
    const payload = buildSnapshotPayload();
    if (payload.playlist.length === 0) return;
    const json = JSON.stringify(payload);
    if (json === lastSnapshotRef.current) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      lastSnapshotRef.current = json;
      fetchAdminJson('/sync', { method: 'POST', json: payload, silent: true });
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    playlist,
    edits,
    isDark,
    batchSuffix,
    seekStep,
    uploadToDrive,
    sidebarWidth,
    adminBaseUrl,
    overwriteOutputs,
    autoSyncEnabled,
    buildSnapshotPayload,
    fetchAdminJson
  ]);

  return {
    adminOpen,
    setAdminOpen,
    adminHistoryOpen,
    setAdminHistoryOpen,
    adminBaseUrl,
    setAdminBaseUrl,
    adminHealth,
    adminSheet,
    adminSheetFilter,
    adminSheetFiltered,
    setAdminSheetFilter,
    adminSnapshot,
    adminConfig,
    setAdminConfig,
    adminJobs,
    adminJob,
    adminJobId,
    adminJobExpectedDuration,
    adminAutoRefresh,
    setAdminAutoRefresh,
    adminShowSnapshot,
    setAdminShowSnapshot,
    adminImportStats,
    adminLastRefreshAt,
    adminError,
    adminLoading,
    adminAiLoading,
    adminAiStats,
    adminAiQueue,
    adminAiSheetSuggestions,
    adminAiLastRequestAt,
    adminAiLastError,
    adminAiDriveCheck,
    adminAiLastProvider,
    adminAiColabMode,
    setAdminAiColabMode,
    adminAiRemoteState,
    adminLogoLoading,
    adminLogoStats,
    adminSyncState,
    adminJobProgress,
    getJobMeta,
    getJobProgress,
    selectAdminJob,
    pingAdmin,
    loadAdminSheet,
    loadAdminSnapshot,
    loadAdminConfig,
    saveAdminConfig,
    syncSheetFromCsv,
    saveGoogleCredentials,
    saveAdminSnapshot,
    applySnapshotPayload,
    applyAdminSnapshot,
    loadAdminJobs,
    loadAdminJob,
    loadSheetMap,
    confirmAiSheetSuggestion,
    dismissAiSheetSuggestion,
    runAdminFfmpeg,
    runAdminClipchampExport,
    runAdminAiSegments,
    runAdminAiSegmentsNgrok,
    runAdminAiSegmentsRemote,
    checkAdminAiDrive,
    runAdminLogoDetection,
    saveCoverTrainingExample,
    pingAdminAiRemote,
    stopAdminAi,
    pullServerCutResults,
    retryAdminAiFailed,
    refreshAdminAiBatch,
    stopAdminJob,
    retryIncompleteAdminJob,
    pickAdminFolder,
    addVideosFromServer,
    queueServerRename
  };
}
