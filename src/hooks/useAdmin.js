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
  formatClipchampFolderName
} from '../features/export/clipchampExport';
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
  mergeChannelLists,
  normalizeName,
  normalizeSegmentSets,
  parseLabelTokens,
  resolveSegmentModeFromMeta,
  resolveSegmentModeFromSuffix,
  resolveSuffixFromMode,
  saveToStorage
} from '../lib/editorUtils';

export default function useAdmin({
  playlist,
  setPlaylist,
  playlistRef,
  edits,
  setEdits,
  currentId,
  setCurrentId,
  activeVideo,
  savedEditsRef,
  showHud,
  prefs,
  setPrefs,
  helpers
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
  const [adminBaseUrl, setAdminBaseUrl] = useState('http://localhost:7071');
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
  const [adminAiQueue, setAdminAiQueue] = useState([]);
  const [adminAiLastRequestAt, setAdminAiLastRequestAt] = useState(null);
  const [adminAiLastError, setAdminAiLastError] = useState(null);
  const [adminAiLastProvider, setAdminAiLastProvider] = useState('');
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
  const adminAiAbortRef = useRef({ aborted: false, controller: null });

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
      const headers = base.includes('.ngrok-free.app')
        ? { 'ngrok-skip-browser-warning': 'true' }
        : undefined;
      const res = await fetch(`${base}/health`, { method: 'GET', headers });
      if (!res.ok) {
        setAdminAiRemoteState({
          status: 'error',
          lastCheckedAt: Date.now(),
          lastHttp: res.status,
          lastError: `HTTP ${res.status}`
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
  }, [adminConfig.aiRemoteUrl]);

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
        if (!options.silent) {
          const serverError = e?.payload?.error;
          if (serverError === 'sheet_read_failed') {
            setAdminError('Сервер працює, але не вдалося прочитати Google Sheet');
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

  const pingAdmin = useCallback(async () => {
    const data = await fetchAdminJson('/health');
    if (data) setAdminHealth(data);
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
        aiRemoteUrl: data.config.aiRemoteUrl || DEFAULT_ADMIN_CONFIG.aiRemoteUrl,
        sheetId: data.config.sheetId || DEFAULT_ADMIN_CONFIG.sheetId,
        sheetGid: data.config.sheetGid || DEFAULT_ADMIN_CONFIG.sheetGid
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
  }, [adminConfig, fetchAdminJson, showHud]);

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
    payload => {
      if (!payload) return;
      const savedList = Array.isArray(payload.playlist) ? payload.playlist : [];
      const normalized = savedList
        .filter(item => item?.fileKey)
        .map(item => {
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
            url: null,
            file: null,
            checked: false,
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
      const savedEdits = payload.edits || {};
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
        setAdminBaseUrl(prefsPayload.adminBaseUrl);
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
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const skipped = [];
    const jobsToRun = [];
    const useBatchSuffix = selected.length > 0;
    targets.forEach(video => {
      const edit = edits[video.id] || DEFAULT_EDIT_STATE;
      const baseVariants = getVideoChannelVariants(video);
      const existing = new Set(baseVariants.map(item => item.channelMode).filter(Boolean));
      const variants = [...baseVariants];
      SEGMENT_MODES.forEach(mode => {
        if (existing.has(mode.id)) return;
        const segs = getSegmentsForMode(edit, mode.id);
        if (!Array.isArray(segs) || segs.length === 0) return;
        variants.push({
          ...video,
          channelMode: mode.id,
          suffix: getSuffixForSegmentMode(mode.id)
        });
      });
      let lastJobIndex = null;
      let lastRenameLine = null;
      variants.forEach(variant => {
        const modeSegments = getSegmentsForMode(edit, variant.channelMode);
        const supportsSnow = true;
        const snowSegments = Array.isArray(modeSegments) ? modeSegments.filter(seg => !!seg?.isSnow) : [];
        const normalSegments = Array.isArray(modeSegments) ? modeSegments.filter(seg => !seg?.isSnow) : [];
        const hasAnySegments = Array.isArray(modeSegments) && modeSegments.length > 0;
        const jobs = [];

        if (!hasAnySegments) {
          jobs.push({ video: variant, segmentsOverride: undefined, labelSuffix: '' });
        } else {
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
    if (!remoteName || !rootFolderId) {
      showHud("Заповніть Clipchamp Drive remote і Folder ID");
      return;
    }

    const createdAt = new Date();
    const folderName = formatClipchampFolderName(
      createdAt,
      adminConfig.clipchampFolderPrefix || 'Clipchamp'
    );
    const localDir = `.clipchamp_exports/${folderName}`;
    const processingLines = [];
    const linksRows = [];
    const manifestFiles = [];
    const skipped = [];
    let expectedDuration = 0;
    const sheetMap = await loadSheetMap();

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
      const baseVariants = getVideoChannelVariants(video);
      const existingModes = new Set(baseVariants.map(item => item.channelMode).filter(Boolean));
      const variants = [...baseVariants];
      SEGMENT_MODES.forEach(mode => {
        if (existingModes.has(mode.id)) return;
        const segments = getSegmentsForMode(edit, mode.id);
        if (!Array.isArray(segments) || segments.length === 0) return;
        variants.push({
          ...video,
          channelMode: mode.id,
          suffix: getSuffixForSegmentMode(mode.id)
        });
      });

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
        if (!hasSegments) {
          jobs.push({ suffix: baseSuffix, segments: undefined, snow: false });
        } else {
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
          processingLines.push(...result.lines, '');
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
      folderName,
      processingLines,
      linksRows,
      manifest: {
        createdAt: createdAt.toISOString(),
        folderName,
        driveFolderId: rootFolderId,
        remote: remoteName,
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
          const expectedModes = getExpectedModesForAi(target);
          const labels = Object.keys(rawSegments).filter(label => modeSet.has(label));
          const filteredLabels =
            expectedModes.length > 0 ? labels.filter(label => expectedModes.includes(label)) : labels;
          if (filteredLabels.length === 0) return;
          const existing = next[target.id] || DEFAULT_EDIT_STATE;
          const baseSets = normalizeSegmentSets(
            existing.segmentSets,
            existing.segments,
            existing.segmentMode || 'digital'
          );
          const nextSets = { ...baseSets };
          filteredLabels.forEach(label => {
            const list = Array.isArray(rawSegments[label]) ? rawSegments[label] : [];
            nextSets[label] = list
              .map(seg => ({
                id: seg.id || `${label}_${Math.round((seg.start || 0) * 1000)}`,
                start: Number(seg.start) || 0,
                end: Number(seg.end) || 0
              }))
              .filter(seg => seg.end > seg.start);
          });
          const nextMode = filteredLabels.includes(existing.segmentMode)
            ? existing.segmentMode
            : filteredLabels[0];
          next[target.id] = {
            ...existing,
            segmentMode: nextMode,
            segmentSets: nextSets,
            segments: nextSets[nextMode] || []
          };
        });
        return next;
      });

      setPlaylist(prev => {
        const updates = new Map();
        items.forEach(item => {
          const target =
            (item.id && byId.get(item.id)) ||
            (item.sourcePath && bySource.get(item.sourcePath));
          if (!target) return;
          const rawSegments = item.segments || {};
          const expectedModes = getExpectedModesForAi(target);
          const labels = Object.keys(rawSegments).filter(label => modeSet.has(label));
          const filteredLabels =
            expectedModes.length > 0 ? labels.filter(label => expectedModes.includes(label)) : labels;
          if (filteredLabels.length === 0) return;
          const channelCandidates = filteredLabels.map(label => ({
            mode: label,
            suffix: getSuffixForSegmentMode(label),
            sheetMode: '',
            sheetCameraType: '',
            sheetStatus: '',
            sheetRow: null
          }));
          const merged = mergeChannelLists(target.channels, channelCandidates);
          updates.set(target.id, {
            ...target,
            channels: merged,
            suffix: merged[0]?.suffix || target.suffix
          });
        });
        if (updates.size === 0) return prev;
        return prev.map(item => updates.get(item.id) || item);
      });
    },
    [getExpectedModesForAi, playlistRef, setEdits, setPlaylist]
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
        return playlist.filter(item => overrideIds.has(item.id));
      }
      const selected = playlist.filter(p => p.checked);
      return selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
    },
    [activeVideo, playlist]
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
    const targets = resolveAiTargets(overrideIds);
    if (targets.length === 0) {
      showHud("Оберіть відео");
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
    adminAiAbortRef.current = { aborted: false, controller: null };
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
    buildAiQueue,
    fetchAdminJson,
    getExpectedModesForAi,
    overwriteOutputs,
    resolveAiTargets,
    setAiQueueStatus,
    showHud
  ]);

  const runAdminAiSegmentsRemote = useCallback(async (overrideIds = null) => {
    const targets = resolveAiTargets(overrideIds);
    if (targets.length === 0) {
      showHud("Оберіть відео");
      return;
    }
    const remoteBase = String(adminConfig.aiRemoteUrl || '').trim().replace(/\/+$/, '');
    if (!remoteBase) {
      showHud("Вкажіть Colab URL");
      return;
    }
    const fps = Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : 1;
    const minDuration = Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : 2;
    const modeSet = new Set(SEGMENT_MODES.map(mode => mode.id));
    const remoteHeaders = remoteBase.includes('.ngrok-free.app')
      ? { 'ngrok-skip-browser-warning': 'true' }
      : undefined;
    let failures = 0;
    const items = [];
    const updateStats = () =>
      setAdminAiStats({
        processed: items.length,
        failed: failures
      });

    buildAiQueue(targets, 'colab');
    setAdminAiLoading(true);
    setAdminAiStats(null);
    setAdminAiLastRequestAt(Date.now());
    setAdminAiLastError(null);
    adminAiAbortRef.current = { aborted: false, controller: null };
    for (const target of targets) {
      if (adminAiAbortRef.current.aborted) break;
      setAiQueueStatus(target.id, {
        status: 'running',
        error: null,
        errorDetail: null,
        taskId: null
      });
      const controller = new AbortController();
      adminAiAbortRef.current.controller = controller;
      let fileBlob = null;
      let fileName = target?.name || 'video.mp4';
      if (target?.file instanceof Blob) {
        fileBlob = target.file;
        if (target.file.name) fileName = target.file.name;
      } else if (target?.sourcePath) {
        const base = adminBaseUrl.replace(/\/+$/, '');
        const url = `${base}/file?path=${encodeURIComponent(target.sourcePath)}`;
        try {
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          fileBlob = await res.blob();
          fileName = target.sourcePath.split('/').pop() || fileName;
        } catch {
          failures += 1;
          setAiQueueStatus(target.id, { status: 'error', error: 'fetch_failed' });
          updateStats();
          continue;
        }
      }
      if (!fileBlob) {
        failures += 1;
        setAiQueueStatus(target.id, { status: 'error', error: 'no_source' });
        updateStats();
        continue;
      }

      const formData = new FormData();
      formData.append('video', fileBlob, fileName);
      formData.append('fps', String(fps));
      formData.append('min_duration', String(minDuration));

      try {
        const res = await fetch(`${remoteBase}/predict`, {
          method: 'POST',
          body: formData,
          headers: remoteHeaders,
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const queuedResult = await res.json();
        if (!queuedResult?.ok) {
          failures += 1;
          setAiQueueStatus(target.id, { status: 'error', error: 'remote_failed' });
          updateStats();
          continue;
        }
        if (queuedResult.task_id) {
          setAiQueueStatus(target.id, { taskId: queuedResult.task_id });
        }
        const data =
          queuedResult.status === 'queued' && queuedResult.task_id
            ? await pollRemoteAiTask({
                baseUrl: remoteBase,
                taskId: queuedResult.task_id,
                headers: remoteHeaders,
                signal: controller.signal
              })
            : queuedResult;
        setAdminAiRemoteState({
          status: 'ok',
          lastCheckedAt: Date.now(),
          lastHttp: res.status,
          lastError: null
        });
        const rawSegments = normalizeRemoteAiSegments(data);
        const allowedModes = getExpectedModesForAi(target);
        const filtered = {};
        Object.keys(rawSegments).forEach(label => {
          if (!modeSet.has(label)) return;
          if (allowedModes.length > 0 && !allowedModes.includes(label)) return;
          filtered[label] = rawSegments[label];
        });
        const segmentCount = countAiSegments(filtered);
        if (segmentCount === 0) {
          failures += 1;
          const diagnostic = describeRemoteAiResponse(data);
          const expected = allowedModes.length > 0 ? allowedModes.join(', ') : 'будь-який';
          const taskLabel = queuedResult.task_id ? `task ${queuedResult.task_id}; ` : '';
          const errorDetail = `${taskLabel}${diagnostic}; очікувався канал: ${expected}`;
          setAdminAiLastError(
            `${fileName}: Colab завершив task, але inference повернув порожній result. ` +
              `Canvas і parser отримали 0 сегментів. ${errorDetail}`
          );
          setAiQueueStatus(target.id, {
            status: 'error',
            error: 'no_segments',
            errorDetail,
            segmentCount: 0
          });
          updateStats();
          continue;
        }
        const completedItem = {
          id: target.id,
          sourcePath: target.sourcePath || '',
          segments: filtered
        };
        items.push(completedItem);
        applyAiSegments([completedItem]);
        setAiQueueStatus(target.id, {
          status: 'done',
          error: null,
          errorDetail: null,
          segmentCount
        });
        updateStats();
        showHud(`AI готово: ${fileName}`);
      } catch (e) {
        failures += 1;
        setAdminAiLastError(String(e?.message || e));
        setAdminAiRemoteState({
          status: 'error',
          lastCheckedAt: Date.now(),
          lastHttp: null,
          lastError: String(e?.message || e)
        });
        setAiQueueStatus(target.id, {
          status: 'error',
          error: 'remote_error',
          errorDetail: String(e?.message || e)
        });
        updateStats();
      }
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
    if (items.length === 0) {
      showHud(failures > 0 ? "AI Colab не відпрацював" : "Немає сегментів");
      return;
    }
    setAdminAiStats({
      processed: items.length,
      failed: failures
    });
    showHud(failures > 0 ? `AI Colab: ${items.length}, помилок: ${failures}` : `AI Colab: ${items.length}`);
  }, [
    adminBaseUrl,
    adminConfig.aiFps,
    adminConfig.aiMinDuration,
    adminConfig.aiRemoteUrl,
    applyAiSegments,
    buildAiQueue,
    getExpectedModesForAi,
    resolveAiTargets,
    setAiQueueStatus,
    showHud
  ]);

  const stopAdminAi = useCallback(() => {
    adminAiAbortRef.current.aborted = true;
    if (adminAiAbortRef.current.controller) {
      adminAiAbortRef.current.controller.abort();
    }
    setAdminAiLoading(false);
    setAdminAiLastError('stopped');
    setAdminAiQueue(prev =>
      prev.map(item =>
        item.status === 'running' || item.status === 'pending'
          ? { ...item, status: 'error', error: 'stopped' }
          : item
      )
    );
    showHud("AI зупинено");
  }, [showHud]);

  const retryAdminAiFailed = useCallback(() => {
    const failed = adminAiQueue.filter(item => item.status === 'error');
    if (failed.length === 0) {
      showHud("Немає помилок");
      return;
    }
    const ids = new Set(failed.map(item => item.id));
    if (adminAiLastProvider === 'colab') {
      runAdminAiSegmentsRemote(ids);
      return;
    }
    if (adminAiLastProvider === 'local') {
      runAdminAiSegments(ids);
      return;
    }
    showHud("Невідомий режим AI");
  }, [adminAiLastProvider, adminAiQueue, resolveAiTargets, runAdminAiSegments, runAdminAiSegmentsRemote, showHud]);

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
    const { modes = [], snow = 'any', onlySheet = true } = options;
    const data = await fetchAdminJson('/files');
    if (!data?.files) return;
    if (data.files.length === 0) {
      showHud("Файлів не знайдено");
      return;
    }
    const sheetMap = await loadSheetMap();
    if (!sheetMap) {
      showHud("Таблиця не завантажена");
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
        fileInfo.relativePath,
        fileInfo.size,
        fileInfo.mtimeMs
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
        const merged = mergeChannelLists(existingItem.channels, channels);
        const nextHasSnow = existingItem.hasSnow || hasSnow;
        const nextLabels = mergeLabelTokens(existingItem.labels, labels);
        if (
          (merged.length > 0 && merged.length !== (existingItem.channels || []).length) ||
          nextHasSnow !== existingItem.hasSnow ||
          nextLabels.length !== (existingItem.labels || []).length
        ) {
          const updated = {
            ...existingItem,
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

      const primarySuffix = channels[0]?.suffix || '';
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
      showHud("Нових файлів немає");
      return;
    }
    showHud(`Додано ${newVideos.length} файлів`);
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
    loadAdminConfig();
    loadAdminJobs();
  }, [adminOpen, loadAdminConfig, loadAdminJobs]);

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
    const payload = buildSnapshotPayload();
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
    adminAiLastRequestAt,
    adminAiLastError,
    adminAiLastProvider,
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
    saveAdminSnapshot,
    applySnapshotPayload,
    applyAdminSnapshot,
    loadAdminJobs,
    loadAdminJob,
    loadSheetMap,
    runAdminFfmpeg,
    runAdminClipchampExport,
    runAdminAiSegments,
    runAdminAiSegmentsRemote,
    runAdminLogoDetection,
    pingAdminAiRemote,
    stopAdminAi,
    retryAdminAiFailed,
    stopAdminJob,
    pickAdminFolder,
    addVideosFromServer,
    queueServerRename
  };
}
