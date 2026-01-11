import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  DEFAULT_EDIT_STATE,
  MAX_HISTORY,
  RCLONE_FOLDER,
  RCLONE_REMOTE,
  SEGMENT_MODES,
  STORAGE_KEYS,
  SUFFIX_PRESETS
} from './lib/editorConstants';
import {
  buildChannelsFromEntries,
  clamp,
  entriesHaveBoth,
  filterElementsForMode,
  getDefaultSegmentSets,
  getEntryOrder,
  getFileKey,
  getFileKeyCounts,
  getSegmentOffsetForTime,
  getSegmentsForMode,
  getTimeForSegmentOffset,
  loadFromStorage,
  mergeChannelLists,
  normalizeCropPx,
  normalizeName,
  normalizeSegmentSets,
  parseNumericInput,
  resolveSegmentModeFromMeta,
  resolveSegmentModeFromSuffix,
  resolveSuffixFromMode,
  saveToStorage,
  updateSegmentsForMode
} from './lib/editorUtils';
import AppOverlays from './components/AppOverlays';
import EditorLayout from './components/EditorLayout';
import useAdmin from './hooks/useAdmin';
import usePlaylist from './hooks/usePlaylist';

export default function App() {
  // --- GEMINI API CONFIG ---
  const apiKey = "";

  // --- STATE ---
  const [edits, setEdits] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [processingJob, setProcessingJob] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [processingSrc, setProcessingSrc] = useState(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [ffmpegModalOpen, setFfmpegModalOpen] = useState(false);
  const [ffmpegCommand, setFfmpegCommand] = useState('');
  const [ffmpegBatchModalOpen, setFfmpegBatchModalOpen] = useState(false);
  const [ffmpegBatchScript, setFfmpegBatchScript] = useState('');
  const [ffmpegBatchSkipped, setFfmpegBatchSkipped] = useState([]);
  const [playSegmentsOnly, setPlaySegmentsOnly] = useState(false);
  const [copiedNameId, setCopiedNameId] = useState(null);
  const [seekStep, setSeekStep] = useState(0.05);
  const [uploadToDrive, setUploadToDrive] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusSideOpen, setFocusSideOpen] = useState(false);
  const [overwriteOutputs, setOverwriteOutputs] = useState(false);
  const {
    playlist,
    setPlaylist,
    currentId,
    setCurrentId,
    activeVideo,
    searchQuery,
    setSearchQuery,
    activeGroupKey,
    setActiveGroupKey,
    draggingId,
    setDraggingId,
    dragOverId,
    setDragOverId,
    playlistRef,
    playlistScrollRef,
    searchInputRef,
    filteredPlaylist,
    groupedPlaylist,
    activeGroupItems,
    selectedCount,
    isAllSelected,
    allCount,
    multiCount,
    playlistVisibleItems,
    playlistPaddingTop,
    playlistPaddingBottom,
    playlistItemHeight,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    selectVisible,
    reorderPlaylist,
    handlePlaylistScroll
  } = usePlaylist({ suffixPresets: SUFFIX_PRESETS, getFileKeyCounts });
  const [isCanvasExpanded, setIsCanvasExpanded] = useState(false);
  const [focusCanvasHeight, setFocusCanvasHeight] = useState(() => {
    if (typeof window === 'undefined') return 600;
    return Math.round(window.innerHeight * 0.8);
  });

  // Theme State
  const [isDark, setIsDark] = useState(false);

  // Batch & Export
  const [batchSuffix, setBatchSuffix] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchQueue, setBatchQueue] = useState([]);
  const [batchTotal, setBatchTotal] = useState(0); // For progress tracking

  // AI State
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiTip, setAiTip] = useState(null);

  // Clipboard
  const [copiedAttributes, setCopiedAttributes] = useState(null);

  // HUD
  const [hudText, setHudText] = useState(null);
  const hudTimeoutRef = useRef(null);
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartRef = useRef({ x: 0, width: 256 });
  const focusResizeRef = useRef(false);
  const focusResizeStartRef = useRef({ y: 0, height: 0 });

  // Editor View State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const processingVideoRef = useRef(null);
  const overlayRef = useRef(null);
  const viewportRef = useRef(null);
  const timelineRef = useRef(null);
  const segmentStartRef = useRef(null);
  const segmentEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const stopLoopRef = useRef(null);
  const cancelProcessingRef = useRef(false);
  const altDownRef = useRef(false);
  const altUsedWithOtherRef = useRef(false);
  const playSegmentsOnlyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const segmentsRef = useRef([]);
  const segmentLoopStartRef = useRef(null);
  const segmentLoopActiveRef = useRef(false);
  const copiedNameTimeoutRef = useRef(null);
  const spacePanRef = useRef(false);
  const viewportHoverRef = useRef(false);

  // Dragging state
  const isDragging = useRef(false);
  const dragTarget = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startState = useRef(null);
  const dragRafRef = useRef(null);
  const dragPendingRef = useRef(null);
  const elementPreviewRef = useRef(new Map());
  const segmentPreviewRef = useRef(new Map());
  const trimPreviewRef = useRef(null);
  const cropPreviewRef = useRef(null);
  const lastDragTimeRef = useRef(0);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [segmentDraft, setSegmentDraft] = useState({ start: null, end: null });

  // --- HELPERS ---
  const currentEdit = edits[currentId] || DEFAULT_EDIT_STATE;
  const activeSuffix = activeVideo?.suffix || '';
  const activeSuffixPreset = SUFFIX_PRESETS.includes(activeSuffix) ? activeSuffix : null;
  const currentIdRef = useRef(currentId);
  useEffect(() => {
    currentIdRef.current = currentId;
  }, [currentId]);
  const currentEditRef = useRef(currentEdit);
  useEffect(() => {
    currentEditRef.current = currentEdit;
  }, [currentEdit]);
  const buildServerFileUrl = relativePath => {
    const base = adminBaseUrl.replace(/\/+$/, '');
    return `${base}/file?path=${encodeURIComponent(relativePath)}`;
  };
  const mergePlaylistItems = items => {
    if (!Array.isArray(items) || items.length === 0) return null;
    const primary = items.find(item => item?.file || item?.url) || items[0];
    let channels = Array.isArray(primary.channels) ? primary.channels : [];
    items.forEach(item => {
      channels = mergeChannelLists(channels, item?.channels);
    });
    const pick = (value, fallback) =>
      value !== undefined && value !== null && value !== '' ? value : fallback;
    const merged = {
      ...primary,
      channels,
      name: pick(primary.name, items.find(item => item?.name)?.name || ''),
      type: pick(primary.type, items.find(item => item?.type)?.type || ''),
      size: primary.size || items.find(item => item?.size)?.size || 0,
      lastModified: primary.lastModified || items.find(item => item?.lastModified)?.lastModified || 0,
      suffix: pick(primary.suffix, items.find(item => item?.suffix)?.suffix || ''),
      sheetRow: primary.sheetRow || items.find(item => item?.sheetRow)?.sheetRow || null,
      sheetMode: pick(primary.sheetMode, items.find(item => item?.sheetMode)?.sheetMode || ''),
      sheetCameraType: pick(
        primary.sheetCameraType,
        items.find(item => item?.sheetCameraType)?.sheetCameraType || ''
      ),
      sheetStatus: pick(primary.sheetStatus, items.find(item => item?.sheetStatus)?.sheetStatus || ''),
      notRelevant: items.some(item => item?.notRelevant),
      checked: items.some(item => item?.checked),
      isLoading: items.some(item => item?.isLoading),
      source: pick(primary.source, items.find(item => item?.source)?.source || ''),
      sourcePath: pick(primary.sourcePath, items.find(item => item?.sourcePath)?.sourcePath || ''),
      sourceBaseDir: pick(
        primary.sourceBaseDir,
        items.find(item => item?.sourceBaseDir)?.sourceBaseDir || ''
      ),
      file: primary.file || items.find(item => item?.file)?.file || null,
      url: primary.url || items.find(item => item?.url)?.url || null
    };
    const stableId = merged.fileKey || merged.id;
    return stableId ? { ...merged, id: stableId } : merged;
  };
  const isMeaningfulEdit = edit => {
    if (!edit) return false;
    const hasElements = Array.isArray(edit.elements) && edit.elements.length > 0;
    const hasCrop = edit.crop && (edit.crop.t || edit.crop.b || edit.crop.l || edit.crop.r);
    const hasTrim =
      edit.meta?.duration > 0 &&
      (edit.trim?.start > 0.01 ||
        Math.abs((edit.trim?.end || edit.meta.duration) - edit.meta.duration) > 0.01);
    const segmentSets = normalizeSegmentSets(
      edit.segmentSets,
      edit.segments,
      edit.segmentMode || 'digital'
    );
    const hasSegments = Object.values(segmentSets).some(list => list.length > 0);
    return hasElements || hasCrop || hasTrim || hasSegments;
  };
  const mergeEditMeta = (base, incoming) => ({
    duration: Math.max(base?.duration || 0, incoming?.duration || 0),
    width: Math.max(base?.width || 0, incoming?.width || 0),
    height: Math.max(base?.height || 0, incoming?.height || 0)
  });
  const mergeEditsForItems = (items, editsMap) => {
    const candidates = items
      .map(item => ({ item, edit: editsMap?.[item.id] }))
      .filter(entry => entry.edit);
    if (candidates.length === 0) return null;
    const baseEntry =
      candidates.find(entry => isMeaningfulEdit(entry.edit)) || candidates[0];
    const baseEdit = baseEntry.edit || DEFAULT_EDIT_STATE;
    let mergedMeta = { ...baseEdit.meta };
    candidates.forEach(({ edit }) => {
      if (edit?.meta) mergedMeta = mergeEditMeta(mergedMeta, edit.meta);
    });
    let segmentSets = normalizeSegmentSets(
      baseEdit.segmentSets,
      baseEdit.segments,
      baseEdit.segmentMode || 'digital'
    );
    candidates.forEach(({ item, edit }) => {
      const mode = getSegmentModeForVideo(item);
      const segments = getSegmentsForMode(edit, mode);
      if (segments.length > 0) segmentSets = { ...segmentSets, [mode]: segments };
    });
    const nextMode = baseEdit.segmentMode || getSegmentModeForVideo(baseEntry.item);
    return {
      ...DEFAULT_EDIT_STATE,
      ...baseEdit,
      meta: mergedMeta,
      segmentMode: nextMode,
      segmentSets,
      segments: segmentSets[nextMode] || [],
      history: [],
      future: []
    };
  };
  const dedupePlaylistAndEdits = (list, editsMap) => {
    const groups = new Map();
    (list || []).forEach(item => {
      if (!item) return;
      const key = item.fileKey || item.id;
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    const nextEdits = { ...(editsMap || {}) };
    const deduped = [];
    const idMap = new Map();
    groups.forEach(items => {
      if (items.length === 1) {
        const item = items[0];
        const stableId = item.fileKey || item.id;
        const normalized = stableId && item.id !== stableId ? { ...item, id: stableId } : item;
        if (normalized.id !== item.id && nextEdits[item.id] && !nextEdits[normalized.id]) {
          nextEdits[normalized.id] = nextEdits[item.id];
          delete nextEdits[item.id];
        }
        deduped.push(normalized);
        idMap.set(item.id, normalized.id);
        return;
      }
      const merged = mergePlaylistItems(items);
      if (!merged) return;
      deduped.push(merged);
      items.forEach(item => idMap.set(item.id, merged.id));
      const mergedEdit = mergeEditsForItems(items, editsMap || {});
      if (mergedEdit) nextEdits[merged.id] = mergedEdit;
      items.forEach(item => {
        if (item.id !== merged.id && nextEdits[item.id]) delete nextEdits[item.id];
      });
    });
    return { playlist: deduped, edits: nextEdits, idMap };
  };
  const getVideoSourceDir = video => {
    const sourcePath = video?.sourcePath || '';
    if (!sourcePath || !sourcePath.includes('/')) return '';
    const parts = sourcePath.split('/');
    parts.pop();
    return parts.join('/');
  };
  const getVideoOutputDir = video => {
    const dir = getVideoSourceDir(video);
    return dir ? `${dir}/cutted` : 'cutted';
  };
  const getVideoDoneDir = video => {
    const dir = getVideoSourceDir(video);
    return dir ? `${dir}/done` : 'done';
  };
  const getThermalLabel = cameraType => {
    const value = String(cameraType || '').trim();
    if (!value) return '';
    const isThermal = /thermal|infrared/i.test(value);
    return `Термальне: ${isThermal ? 'так' : 'ні'}`;
  };
  const getDisplayName = name => {
    if (!name) return '';
    const base = name.replace(/\.[^/.]+$/, '');
    if (base.length <= 28) return base;
    return `${base.slice(0, 18)}…${base.slice(-6)}`;
  };
  const getShortId = id => {
    if (!id) return '';
    const rowMatch = id.match(/::row(\d+)/);
    if (rowMatch) return `row${rowMatch[1]}`;
    return id.slice(-4);
  };
  const getVideoTooltip = video => {
    const name = video?.sourcePath || video?.name || '';
    const nameLower = name.toLowerCase();
    const channelFallback = nameLower.includes('digital')
      ? 'digital'
      : nameLower.includes('analog')
        ? 'analog'
        : '';
    const channelLabels = (() => {
      if (Array.isArray(video?.channels) && video.channels.length > 0) {
        return video.channels
          .map(channel => SEGMENT_MODES.find(mode => mode.id === channel.mode)?.label)
          .filter(Boolean)
          .join(', ');
      }
      if (video?.sheetMode) return video.sheetMode;
      return channelFallback;
    })();
    const channel = channelLabels ? `Канали: ${channelLabels}` : '';
    const thermalFromSheet = getThermalLabel(video?.sheetCameraType);
    const thermalFallback =
      !thermalFromSheet && (nameLower.includes('thermal') || nameLower.includes('infrared') || channelFallback)
        ? `Термальне: ${nameLower.includes('thermal') || nameLower.includes('infrared') ? 'так' : 'ні'}`
        : '';
    const thermal = thermalFromSheet || thermalFallback;
    return [name, channel, thermal].filter(Boolean).join(' • ');
  };
  const getVideoChannelBadges = video => {
    if (Array.isArray(video?.channels) && video.channels.length > 0) {
      return video.channels
        .map(channel => SEGMENT_MODES.find(mode => mode.id === channel.mode))
        .filter(Boolean);
    }
    const mode = resolveSegmentModeFromMeta(video?.sheetMode, video?.sheetCameraType) ||
      resolveSegmentModeFromSuffix(video?.suffix) ||
      getSegmentModeForVideo(video);
    const meta = SEGMENT_MODES.find(item => item.id === mode);
    return meta ? [meta] : [];
  };
  const buildEditFromSaved = saved => {
    if (!saved) return null;
    const segmentMode = saved.segmentMode || 'digital';
    const segmentSets = normalizeSegmentSets(saved.segmentSets, saved.segments, segmentMode);
    const meta = saved.meta || {};
    const metaWidth = Number.isFinite(meta.width) ? meta.width : 0;
    const metaHeight = Number.isFinite(meta.height) ? meta.height : 0;
    const metaDuration = Number.isFinite(meta.duration) ? meta.duration : saved.duration || 0;
    return {
      ...DEFAULT_EDIT_STATE,
      trim: saved.trim ? { ...saved.trim } : DEFAULT_EDIT_STATE.trim,
      crop: saved.crop ? { ...saved.crop } : DEFAULT_EDIT_STATE.crop,
      elements: Array.isArray(saved.elements) ? saved.elements.map(el => ({ ...el })) : [],
      segments: segmentSets[segmentMode] || [],
      segmentMode,
      segmentSets,
      viewMode: saved.viewMode || 'editor',
      processedUrl: null,
      processedExt: null,
      selectedId: null,
      history: [],
      future: [],
      meta: { duration: metaDuration, width: metaWidth, height: metaHeight }
    };
  };
  const getSavedEditForVideo = (savedEdits, video, fileKeyCounts) => {
    if (!savedEdits || !video) return null;
    if (savedEdits[video.id]) return savedEdits[video.id];
    if (video.fileKey && savedEdits[video.fileKey]) return savedEdits[video.fileKey];
    if (fileKeyCounts?.get(video.fileKey) === 1) return savedEdits[video.fileKey] || null;
    return null;
  };
  const savedEditsRef = useRef(loadFromStorage(STORAGE_KEYS.edits, {}));
  const dbRef = useRef(null);
  const editsLoadedRef = useRef(false);

  const openDb = () =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB недоступна'));
        return;
      }
      const request = indexedDB.open('video-cut-db', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'fileKey' });
        }
        if (!db.objectStoreNames.contains('edits')) {
          db.createObjectStore('edits', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const getDb = async () => {
    if (dbRef.current) return dbRef.current;
    const db = await openDb();
    dbRef.current = db;
    return db;
  };

  const idbPutVideo = async record => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      tx.objectStore('videos').put(record);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbGetVideo = async fileKey => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').get(fileKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  };

  const idbDeleteVideo = async fileKey => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      tx.objectStore('videos').delete(fileKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbSaveEdit = async (id, snapshot) => {
    if (!id) return;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edits', 'readwrite');
      tx.objectStore('edits').put({ id, snapshot });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbLoadEdits = async () => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edits', 'readonly');
      const req = tx.objectStore('edits').getAll();
      req.onsuccess = () => {
        const result = {};
        (req.result || []).forEach(item => {
          if (item?.id && item.snapshot) result[item.id] = item.snapshot;
        });
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const hydrateFromIdb = async () => {
      if (editsLoadedRef.current) return;
      try {
        const idbEdits = await idbLoadEdits();
        if (cancelled || !idbEdits || Object.keys(idbEdits).length === 0) {
          editsLoadedRef.current = true;
          return;
        }
        const current = savedEditsRef.current || {};
        if (Object.keys(current).length === 0) {
          savedEditsRef.current = idbEdits;
          saveToStorage(STORAGE_KEYS.edits, idbEdits);
          setEdits(prev => {
            const next = { ...prev };
            Object.entries(idbEdits).forEach(([key, snap]) => {
              const restored = buildEditFromSaved(snap);
              if (restored) next[key] = restored;
            });
            return next;
          });
        }
      } catch (e) {
        // ignore
      } finally {
        editsLoadedRef.current = true;
      }
    };
    hydrateFromIdb();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const savedList = loadFromStorage(STORAGE_KEYS.playlist, []);
    if (!Array.isArray(savedList) || savedList.length === 0) return;
    const normalized = savedList
      .filter(item => item?.fileKey)
      .map(item => {
        const fallbackMode = resolveSegmentModeFromMeta(item.sheetMode, item.sheetCameraType) ||
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
          source: item.source || '',
          sourcePath: item.sourcePath || '',
          sourceBaseDir: item.sourceBaseDir || '',
          channels: Array.isArray(item.channels) ? item.channels : fallbackChannels
        };
      });
    const { playlist: deduped } = dedupePlaylistAndEdits(normalized, {});
    const fileKeyCounts = getFileKeyCounts(deduped);
    const savedEdits = savedEditsRef.current || {};
    setPlaylist(deduped);
    setEdits(prev => {
      const next = { ...prev };
      deduped.forEach(item => {
        const restored = buildEditFromSaved(
          getSavedEditForVideo(savedEdits, item, fileKeyCounts)
        );
        if (restored) next[item.id] = restored;
      });
      return next;
    });
    if (!currentId && deduped[0]) setCurrentId(deduped[0].id);
  }, []);

  // --- GEMINI FUNCTIONS ---
  const generateAiSuffix = async () => {
    if (!aiPrompt.trim()) {
      showHud("Введіть опис для AI");
      return;
    }
    setIsGeneratingAI(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Generate a short, concise filename suffix (starting with underscore, max 15 chars, alphanumeric only, no spaces) based on this video description: "${aiPrompt}". Return ONLY the suffix.`
                  }
                ]
              }
            ]
          })
        }
      );
      const data = await response.json();
      const suffix =
        data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        `_${aiPrompt.replace(/\s+/g, '_').substr(0, 10)}`;
      const cleanSuffix = suffix.replace(/[^a-zA-Z0-9_]/g, '');
      const nextSuffix = cleanSuffix.startsWith('_') ? cleanSuffix : `_${cleanSuffix}`;
      setVideoSuffix(currentId, nextSuffix);
      showHud("Суфікс згенеровано! ✨");
      setShowAiInput(false);
      setAiPrompt('');
    } catch (e) {
      showHud("Помилка AI");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const getAiTip = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Give me one short, useful tip about video editing, cropping, or using overlays for social media content. Keep it under 20 words. Language: Ukrainian.`
                  }
                ]
              }
            ]
          })
        }
      );
      const data = await response.json();
      setAiTip(data.candidates?.[0]?.content?.parts?.[0]?.text);
      setTimeout(() => setAiTip(null), 6000);
    } catch (e) {
      setAiTip("Експериментуйте з ритмом монтажу! (AI Offline)");
      setTimeout(() => setAiTip(null), 3000);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // --- STATE MANAGEMENT ---
  const pushToHistory = (newEdit, oldEdit) => {
    const stateSnapshot = {
      trim: oldEdit.trim,
      crop: oldEdit.crop,
      elements: oldEdit.elements,
      segmentSets: oldEdit.segmentSets,
      meta: oldEdit.meta
    };
    const newHistory = [stateSnapshot, ...oldEdit.history].slice(0, MAX_HISTORY);
    return { ...newEdit, history: newHistory, future: [] };
  };

  const updateCurrentEdit = (updates, saveHistory = true) => {
    const targetId = currentIdRef.current;
    if (!targetId) return;
    setEdits(prev => {
      const oldEdit = prev[targetId] || DEFAULT_EDIT_STATE;
      const nextUpdates = typeof updates === 'function' ? updates(oldEdit) : updates;
      if (!nextUpdates) return prev;
      let newEdit = { ...oldEdit, ...nextUpdates };
      if (saveHistory) {
        const relevantKeys = ['trim', 'crop', 'elements', 'segmentSets'];
        const hasChanges = relevantKeys.some(
          key => nextUpdates[key] !== undefined && nextUpdates[key] !== oldEdit[key]
        );
        if (hasChanges) newEdit = pushToHistory(newEdit, oldEdit);
      }
      return { ...prev, [targetId]: newEdit };
    });
  };
  const updateCurrentEditRef = useRef(updateCurrentEdit);
  useEffect(() => {
    updateCurrentEditRef.current = updateCurrentEdit;
  }, [updateCurrentEdit]);

  const undo = () => {
    if (currentEdit.history.length === 0) return;
    const [previousState, ...remainingHistory] = currentEdit.history;
    const currentStateSnapshot = {
      trim: currentEdit.trim,
      crop: currentEdit.crop,
      elements: currentEdit.elements,
      segmentSets: currentEdit.segmentSets,
      meta: currentEdit.meta
    };
    const newEdit = {
      ...currentEdit,
      ...previousState,
      history: remainingHistory,
      future: [currentStateSnapshot, ...currentEdit.future].slice(0, MAX_HISTORY)
    };
    const undoMode = newEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    newEdit.segments = getSegmentsForMode(newEdit, undoMode);
    setEdits(prev => ({ ...prev, [currentId]: newEdit }));
    showHud("Скасовано");
  };

  const redo = () => {
    if (currentEdit.future.length === 0) return;
    const [nextState, ...remainingFuture] = currentEdit.future;
    const currentStateSnapshot = {
      trim: currentEdit.trim,
      crop: currentEdit.crop,
      elements: currentEdit.elements,
      segmentSets: currentEdit.segmentSets,
      meta: currentEdit.meta
    };
    const newEdit = {
      ...currentEdit,
      ...nextState,
      history: [currentStateSnapshot, ...currentEdit.history].slice(0, MAX_HISTORY),
      future: remainingFuture
    };
    const redoMode = newEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    newEdit.segments = getSegmentsForMode(newEdit, redoMode);
    setEdits(prev => ({ ...prev, [currentId]: newEdit }));
    showHud("Повторено");
  };

  const getPct = val => {
    const d = currentEdit.meta.duration;
    if (!d || d <= 0) return 0;
    return (val / d) * 100;
  };
  const getSegmentTotal = segments =>
    segments.reduce((sum, seg) => sum + Math.max(0, (seg.end ?? 0) - (seg.start ?? 0)), 0);

  const lastHudRef = useRef(0);
  const showHud = text => {
    if (isDragging.current) return;
    const now = performance.now();
    if (now - lastHudRef.current < 120) return;
    lastHudRef.current = now;
    setHudText(text);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setHudText(null), 1000);
  };
  const setVideoSuffix = (videoId, suffix) => {
    if (!videoId) return;
    setPlaylist(prev => prev.map(v => (v.id === videoId ? { ...v, suffix } : v)));
  };
  const handleSegmentPlayback = vid => {
    if (!playSegmentsOnlyRef.current) return;
    const segments = segmentsRef.current;
    if (!Array.isArray(segments) || segments.length === 0) return;
    const time = vid.currentTime;
    const epsilon = 0.04;
    let inIndex = -1;
    for (let i = 0; i < segments.length; i += 1) {
      const seg = segments[i];
      if (time >= seg.start - epsilon && time <= seg.end - epsilon) {
        inIndex = i;
        break;
      }
    }
    if (inIndex === -1) {
      const next = segments.find(seg => time < seg.start - epsilon) || segments[0];
      if (isPlayingRef.current) {
        vid.currentTime = next.start;
        vid.play().catch(() => { });
      }
      return;
    }
    const currentSeg = segments[inIndex];
    if (isPlayingRef.current && time >= currentSeg.end - epsilon) {
      const next = segments[inIndex + 1];
      if (next) {
        vid.currentTime = next.start;
        vid.play().catch(() => { });
      } else {
        vid.pause();
        vid.currentTime = currentSeg.end;
      }
    }
  };
  const cycleSeekStep = () => {
    const options = [0.1, 0.05, 0.025, 0.01];
    const index = Math.max(0, options.indexOf(seekStep));
    const nextStep = options[(index + 1) % options.length];
    setSeekStep(nextStep);
    showHud(`Крок: ${nextStep}s`);
  };
  const cycleSegmentMode = () => {
    const modes = activeSegmentModes && activeSegmentModes.length > 0
      ? activeSegmentModes
      : SEGMENT_MODES.map(mode => mode.id);
    const currentIndex = modes.indexOf(getActiveSegmentMode(modes));
    const nextMode = modes[(currentIndex + 1) % modes.length];
    const next = SEGMENT_MODES.find(mode => mode.id === nextMode);
    if (!next) return;
    setActiveSegmentMode(next.id);
    showHud(`Сегменти: ${next.label}`);
  };
  const addNotification = note => {
    setNotifications(prev => [...prev, note]);
  };
  const updateNotification = (id, updates) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, ...updates } : n)));
  };
  const removeNotification = id => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  const buildRcloneCopyLine = outputPath =>
    uploadToDrive ? `rclone copy "${outputPath}" "${RCLONE_REMOTE}:${RCLONE_FOLDER}"` : null;
  const startSidebarResize = e => {
    if (e.button !== 0) return;
    e.preventDefault();
    sidebarResizingRef.current = true;
    sidebarResizeStartRef.current = { x: e.clientX, width: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const startFocusResize = e => {
    if (!isFocusMode || e.button !== 0) return;
    e.preventDefault();
    focusResizeRef.current = true;
    const fallbackHeight =
      viewportRef.current?.getBoundingClientRect().height ||
      Math.round(window.innerHeight * 0.75);
    focusResizeStartRef.current = {
      y: e.clientY,
      height: Number.isFinite(focusCanvasHeight) ? focusCanvasHeight : fallbackHeight
    };
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  };
  const getFileKeyVariants = list => {
    const variants = new Map();
    (list || []).forEach(item => {
      if (!item?.fileKey) return;
      const entry = variants.get(item.fileKey) || { hasThermal: false };
      if (isThermalVariant(item)) entry.hasThermal = true;
      variants.set(item.fileKey, entry);
    });
    return variants;
  };
  const isAnalogVariant = video => {
    if (video?.channelMode) return normalizeName(video.channelMode).includes('analog');
    if (Array.isArray(video?.channels) && video.channels.length > 0) {
      return video.channels.some(channel => normalizeName(channel.mode).includes('analog'));
    }
    const mode = normalizeName(video?.sheetMode);
    if (mode.includes('analog')) return true;
    const suffix = normalizeName(video?.suffix);
    return suffix.includes('analog');
  };
  const isThermalVariant = video => {
    if (video?.channelMode) return normalizeName(video.channelMode).includes('thermal');
    if (Array.isArray(video?.channels) && video.channels.length > 0) {
      return video.channels.some(channel => normalizeName(channel.mode).includes('thermal'));
    }
    const camera = normalizeName(video?.sheetCameraType);
    if (camera.includes('thermal') || camera.includes('infrared')) return true;
    const suffix = normalizeName(video?.suffix);
    return suffix.includes('thermal');
  };
  const getSegmentModeForVideo = video => {
    if (video?.channelMode) return video.channelMode;
    if (Array.isArray(video?.channels) && video.channels.length > 0) {
      return video.channels[0].mode || 'digital';
    }
    const metaMode = resolveSegmentModeFromMeta(video?.sheetMode, video?.sheetCameraType);
    if (metaMode) return metaMode;
    const suffixMode = resolveSegmentModeFromSuffix(video?.suffix);
    if (suffixMode) return suffixMode;
    const isThermal = isThermalVariant(video);
    const isAnalog = isAnalogVariant(video);
    if (isThermal && isAnalog) return 'thermal_analog';
    if (isThermal && !isAnalog) return 'thermal_digital';
    if (!isThermal && isAnalog) return 'analog';
    return 'digital';
  };
  const getExpectedModesForAi = video => {
    if (!video) return [];
    if (video.channelMode) return [video.channelMode];
    if (Array.isArray(video.channels) && video.channels.length > 0) {
      return video.channels.map(channel => channel.mode).filter(Boolean);
    }
    const metaMode = resolveSegmentModeFromMeta(video.sheetMode, video.sheetCameraType);
    const suffixMode = resolveSegmentModeFromSuffix(video.suffix);
    const hint = metaMode || suffixMode;
    return hint ? [hint] : [];
  };
  const buildChannelSuffixChips = video => {
    if (!video) return [];
    const baseChannels =
      Array.isArray(video.channels) && video.channels.length > 0
        ? video.channels
        : [
          {
            mode:
              resolveSegmentModeFromMeta(video.sheetMode, video.sheetCameraType) ||
              resolveSegmentModeFromSuffix(video.suffix) ||
              '',
            suffix: video.suffix || resolveSuffixFromMode(video.sheetMode, video.sheetCameraType),
            sheetMode: video.sheetMode || '',
            sheetCameraType: video.sheetCameraType || ''
          }
        ];
    return baseChannels.map((channel, index) => {
      const suffix =
        channel.suffix || resolveSuffixFromMode(channel.sheetMode, channel.sheetCameraType) || '';
      const modeId =
        channel.mode ||
        resolveSegmentModeFromSuffix(suffix) ||
        resolveSegmentModeFromMeta(channel.sheetMode, channel.sheetCameraType) ||
        getSegmentModeForVideo(video);
      const meta = SEGMENT_MODES.find(mode => mode.id === modeId) || SEGMENT_MODES[0];
      const label = suffix || 'без суфіксу';
      const titleParts = [meta.label];
      if (suffix) titleParts.push(suffix);
      if (channel.sheetCameraType) titleParts.push(channel.sheetCameraType);
      return {
        id: `${video.id || 'vid'}-${modeId}-${index}`,
        label,
        suffix,
        modeId,
        meta,
        title: titleParts.join(' • ')
      };
    });
  };
  const getActiveSegmentMode = modes => {
    const available = Array.isArray(modes) && modes.length > 0 ? modes : activeSegmentModes;
    const fallback = getSegmentModeForVideo(activeVideo) || 'digital';
    if (currentEdit.segmentMode && available?.includes(currentEdit.segmentMode)) {
      return currentEdit.segmentMode;
    }
    if (available?.length) return available[0];
    return fallback;
  };
  const setActiveSegmentMode = mode => {
    if (!mode) return;
    const nextSegments = getSegmentsForMode(currentEdit, mode);
    updateCurrentEdit({ segmentMode: mode, segments: nextSegments }, false);
  };
  const getVideoChannelVariants = video => {
    if (!video) return [];
    if (Array.isArray(video.channels) && video.channels.length > 0) {
      return video.channels.map(channel => ({
        ...video,
        channelMode: channel.mode,
        suffix: channel.suffix || resolveSuffixFromMode(channel.sheetMode, channel.sheetCameraType),
        sheetMode: channel.sheetMode || video.sheetMode || '',
        sheetCameraType: channel.sheetCameraType || video.sheetCameraType || '',
        sheetStatus: channel.sheetStatus || video.sheetStatus || ''
      }));
    }
    const fallbackMode = getSegmentModeForVideo(video);
    return [
      {
        ...video,
        channelMode: fallbackMode,
        suffix: video.suffix || resolveSuffixFromMode(video.sheetMode, video.sheetCameraType)
      }
    ];
  };
  const toggleNotRelevant = id => {
    if (!id) return;
    setPlaylist(prev => prev.map(v => (v.id === id ? { ...v, notRelevant: !v.notRelevant } : v)));
  };
  const allowDoneForVideo = (video, countsMap, variantsMap) => {
    if (!video?.fileKey) return true;
    const count = countsMap.get(video.fileKey) || 0;
    if (count <= 1) return true;
    const variants = variantsMap.get(video.fileKey);
    if (variants?.hasThermal) return isThermalVariant(video);
    return isAnalogVariant(video);
  };
  const buildFfmpegLinesFor = (video, edit, options = {}) => {
    const outputDir = options.outputDir || getVideoOutputDir(video);
    const useBatchSuffix = options.useBatchSuffix || false;
    const allowRenameOriginal = options.allowRenameOriginal !== false;
    const doneDir = options.doneDir || getVideoDoneDir(video);
    const overwriteOutput = options.overwriteOutput;
    const overwriteFlag =
      overwriteOutput === true ? '-y ' : overwriteOutput === false ? '-n ' : '';
    if (!video || !edit) return { lines: [], usesTemp: false, error: 'missing' };
    const meta = edit.meta || {};
    const crop = edit.crop || DEFAULT_EDIT_STATE.crop;
    const segmentMode = options.segmentMode || getSegmentModeForVideo(video);
    const elements = filterElementsForMode(edit.elements, segmentMode);
    const hasCrop = !!(crop.t || crop.b || crop.l || crop.r);
    const hasElements = elements.length > 0;
    const hasFilters = hasCrop || hasElements;
    const safeDuration =
      Number.isFinite(meta.duration) && meta.duration > 0 ? meta.duration : null;
    const clampTime = val =>
      safeDuration ? clamp(val, 0, safeDuration) : Math.max(0, val);
    const modeSegments = getSegmentsForMode(edit, segmentMode);
    const baseSegments =
      Array.isArray(modeSegments) && modeSegments.length > 0
        ? modeSegments
        : [
          {
            start: edit.trim?.start ?? 0,
            end: edit.trim?.end ?? safeDuration ?? 0
          }
        ];
    const exportSegments = baseSegments
      .map(seg => {
        const rawStart = Number.isFinite(seg.start) ? seg.start : 0;
        const rawEnd =
          Number.isFinite(seg.end) ? seg.end : safeDuration ?? rawStart + 0.1;
        const start = clampTime(Math.min(rawStart, rawEnd));
        const end = clampTime(Math.max(rawStart, rawEnd));
        return { start, end };
      })
      .filter(seg => seg.end > seg.start);
    if (exportSegments.length === 0) exportSegments.push({ start: 0, end: safeDuration ?? 0 });
    const sourcePath = video.sourcePath || video.name || 'input.mp4';
    const fileName = sourcePath.split('/').pop() || sourcePath;
    const dot = fileName.lastIndexOf('.');
    const baseName = dot > 0 ? fileName.slice(0, dot) : fileName;
    const ext = dot > 0 ? fileName.slice(dot + 1) : 'mp4';
    const perVideoSuffix = video?.suffix || '';
    const extraBatchSuffix = useBatchSuffix && batchSuffix ? batchSuffix : '';
    const suffix = `${perVideoSuffix}${extraBatchSuffix}`;
    const outputName = `${baseName}${suffix}.${ext}`;
    const inputPath = sourcePath.startsWith('./') ? sourcePath : `./${sourcePath}`;
    const outputPath = `${outputDir}/${outputName}`;
    if (video.notRelevant) {
      const notRelevantPath = `${doneDir}/${baseName}_not_relevant.${ext}`;
      const moveLine = `[ -e "${inputPath}" ] && [ ! -e "${notRelevantPath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${notRelevantPath}"`;
      return {
        lines: [moveLine],
        usesTemp: false,
        needsOutputDir: false,
        outputDir,
        doneDir
      };
    }
    const sourceDonePath =
      allowRenameOriginal && !baseName.endsWith('_done')
        ? `${doneDir}/${baseName}_done.${ext}`
        : null;
    const renameLine = sourceDonePath
      ? `[ -f "${outputPath}" ] && [ -e "${inputPath}" ] && [ ! -e "${sourceDonePath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${sourceDonePath}"`
      : null;
    if (!hasFilters) {
      if (exportSegments.length === 1) {
        const seg = exportSegments[0];
        const rcloneLine = buildRcloneCopyLine(outputPath);
        return {
          lines: [
            `ffmpeg ${overwriteFlag}-ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
              3
            )} -i "${inputPath}" -c copy -an -movflags +faststart "${outputPath}"`,
            ...(rcloneLine ? [rcloneLine] : []),
            ...(renameLine ? [renameLine] : [])
          ],
          usesTemp: false,
          needsOutputDir: true,
          outputDir,
          doneDir
        };
      }
      const tmpDir = `${outputDir}/_tmp`;
      const listPath = `${tmpDir}/${baseName}_list.txt`;
      const segmentFiles = exportSegments.map((seg, idx) => ({
        path: `${tmpDir}/${baseName}_seg${idx + 1}.${ext}`,
        start: seg.start,
        end: seg.end
      }));
      const listLines = segmentFiles.map(seg => `file '${seg.path.split('/').pop()}'`).join('\\n');
      const rcloneLine = buildRcloneCopyLine(outputPath);
      const lines = [
        ...segmentFiles.map(
          seg =>
            `ffmpeg ${overwriteFlag}-ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
              3
            )} -i "${inputPath}" -c copy -an "${seg.path}"`
        ),
        `printf "${listLines}\\n" > "${listPath}"`,
        `ffmpeg ${overwriteFlag}-f concat -safe 0 -i "${listPath}" -c copy -an "${outputPath}"`,
        ...(rcloneLine ? [rcloneLine] : []),
        `rm -f "${listPath}" ${segmentFiles.map(seg => `"${seg.path}"`).join(' ')}`,
        ...(renameLine ? [renameLine] : [])
      ];
      return {
        lines,
        usesTemp: true,
        needsOutputDir: true,
        outputDir,
        tmpDir,
        doneDir
      };
    }
    if (!meta.width || !meta.height) {
      return { lines: [], usesTemp: false, error: 'missingMeta' };
    }
    const cropPx = normalizeCropPx(crop, meta);
    const cropX = cropPx.x;
    const cropY = cropPx.y;
    const cropW = cropPx.w;
    const cropH = cropPx.h;
    if (hasCrop && (!cropW || !cropH)) return { lines: [], usesTemp: false, error: 'invalidCrop' };
    const filters = [];
    elements.forEach(el => {
      const elStart = clampTime(Number.isFinite(el.startTime) ? el.startTime : 0);
      const elEnd = clampTime(
        Number.isFinite(el.endTime) ? el.endTime : safeDuration ?? elStart + 0.1
      );
      if (elEnd <= elStart) return;
      const elRealX = (el.x / 100) * meta.width;
      const elRealY = (el.y / 100) * meta.height;
      const elRealW = (el.w / 100) * meta.width;
      const elRealH = (el.h / 100) * meta.height;
      const rawX = Math.round(elRealX);
      const rawY = Math.round(elRealY);
      const rawW = Math.round(elRealW);
      const rawH = Math.round(elRealH);
      const maxW = meta.width;
      const maxH = meta.height;
      const x = clamp(rawX, 0, Math.max(0, maxW - 1));
      const y = clamp(rawY, 0, Math.max(0, maxH - 1));
      const w = clamp(rawW, 1, Math.max(1, maxW - x));
      const h = clamp(rawH, 1, Math.max(1, maxH - y));
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
      const color =
        typeof el.color === 'string' && el.color.startsWith('#')
          ? `0x${el.color.slice(1)}`
          : '0x000000';
      const thickness = el.isOutline ? Math.max(1, Math.round(el.thickness || 1)) : 'fill';
      filters.push(
        `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@1:t=${thickness}:enable='between(t,${elStart.toFixed(
          3
        )},${elEnd.toFixed(3)})'`
      );
    });
    if (hasCrop) {
      filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
    }
    const filterLines = [];
    if (filters.length > 0) filterLines.push(`[0:v]${filters.join(',')}[vbase]`);
    else filterLines.push('[0:v]null[vbase]');
    const splitLabels =
      exportSegments.length > 1
        ? exportSegments.map((_, index) => `vs${index}`)
        : ['vbase'];
    if (exportSegments.length > 1) {
      filterLines.push(
        `[vbase]split=${exportSegments.length}${splitLabels.map(label => `[${label}]`).join('')}`
      );
    }
    const segmentLabels = exportSegments.map((seg, index) => {
      const label = `v${index}`;
      const source = splitLabels[index] || 'vbase';
      filterLines.push(
        `[${source}]trim=start=${seg.start.toFixed(3)}:end=${seg.end.toFixed(
          3
        )},setpts=PTS-STARTPTS[${label}]`
      );
      return label;
    });
    let outputLabel = segmentLabels[0];
    if (segmentLabels.length > 1) {
      outputLabel = 'vout';
      filterLines.push(
        `${segmentLabels.map(label => `[${label}]`).join('')}concat=n=${segmentLabels.length
        }:v=1:a=0[${outputLabel}]`
      );
    }
    const graph = filterLines.join(';');
    const rcloneLine = buildRcloneCopyLine(outputPath);
    return {
      lines: [
        `ffmpeg ${overwriteFlag}-i "${inputPath}" -filter_complex "${graph}" -map "[${outputLabel}]" -an -c:v libx264 -crf 18 -preset slow -movflags +faststart "${outputPath}"`,
        ...(rcloneLine ? [rcloneLine] : []),
        ...(renameLine ? [renameLine] : [])
      ],
      usesTemp: false,
      needsOutputDir: true,
      outputDir,
      doneDir
    };
  };
  const buildFfmpegCommand = () => {
    if (!activeVideo) return '';
    const edit = currentEdit || DEFAULT_EDIT_STATE;
    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const variants = getVideoChannelVariants(activeVideo);
    const lines = [];
    const outputDirs = new Set();
    const tmpDirs = new Set();
    variants.forEach(variant => {
      const allowRenameOriginal = allowDoneForVideo(variant, fileKeyCounts, fileKeyVariants);
      const result = buildFfmpegLinesFor(variant, edit, {
        useBatchSuffix: false,
        allowRenameOriginal,
        overwriteOutput: overwriteOutputs,
        segmentMode: variant.channelMode
      });
      if (result.error) return;
      if (result.needsOutputDir !== false) {
        const outDir = result.outputDir || 'cutted';
        outputDirs.add(outDir);
        if (result.usesTemp) tmpDirs.add(result.tmpDir || `${outDir}/_tmp`);
      }
      if (variants.length > 1) {
        const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
        lines.push(`# ${variant.name || variant.id} (${label || variant.suffix || 'без суфіксу'})`);
      }
      lines.push(...result.lines);
      lines.push('');
    });
    if (lines.length === 0) return '';
    const header = [
      ...Array.from(outputDirs).map(dir => `mkdir -p "${dir}"`),
      ...Array.from(tmpDirs).map(dir => `mkdir -p "${dir}"`)
    ];
    return [...header, '', ...lines].join('\n').trim();
  };
  const openFfmpegModal = () => {
    const cmd = buildFfmpegCommand();
    if (!cmd) {
      showHud("Немає даних для FFmpeg");
      return;
    }
    setFfmpegCommand(cmd);
    setFfmpegModalOpen(true);
  };
  const openFfmpegBatchModal = () => {
    const selected = playlist.filter(p => p.checked);
    if (selected.length === 0) {
      showHud("Оберіть відео галочками");
      return;
    }
    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const lines = [];
    const skipped = [];
    let needsTemp = false;
    const outputDirs = new Set();
    const tmpDirs = new Set();
    selected.forEach(video => {
      const edit = edits[video.id] || DEFAULT_EDIT_STATE;
      const variants = getVideoChannelVariants(video);
      variants.forEach(variant => {
        const allowRenameOriginal = allowDoneForVideo(variant, fileKeyCounts, fileKeyVariants);
        const result = buildFfmpegLinesFor(variant, edit, {
          useBatchSuffix: true,
          allowRenameOriginal,
          overwriteOutput: overwriteOutputs,
          segmentMode: variant.channelMode
        });
        if (result.error) {
          skipped.push(variant.name || variant.id);
          return;
        }
        if (result.usesTemp) needsTemp = true;
        if (result.needsOutputDir !== false) {
          const outDir = result.outputDir || 'cutted';
          outputDirs.add(outDir);
          if (result.usesTemp) tmpDirs.add(result.tmpDir || `${outDir}/_tmp`);
        }
        const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
        lines.push(`# ${variant.name || variant.id} (${label || variant.suffix || 'без суфіксу'})`);
        lines.push(...result.lines);
        lines.push('');
      });
    });
    if (lines.length === 0) {
      showHud("Немає валідних відео для FFmpeg");
      return;
    }
    const header = [
      ...Array.from(outputDirs).map(dir => `mkdir -p "${dir}"`),
      ...(needsTemp ? Array.from(tmpDirs).map(dir => `mkdir -p "${dir}"`) : []),
      ''
    ];
    setFfmpegBatchScript([...header, ...lines].join('\n').trim());
    setFfmpegBatchSkipped(skipped);
    setFfmpegBatchModalOpen(true);
  };
  const copyFfmpegCommand = async () => {
    if (!ffmpegCommand) return;
    try {
      await navigator.clipboard.writeText(ffmpegCommand);
      showHud("Команда скопійована");
    } catch (e) {
      window.prompt('Скопіюйте команду вручну:', ffmpegCommand);
    }
  };
  const copyFfmpegBatchScript = async () => {
    if (!ffmpegBatchScript) return;
    try {
      await navigator.clipboard.writeText(ffmpegBatchScript);
      showHud("Скрипт скопійовано");
    } catch (e) {
      window.prompt('Скопіюйте скрипт вручну:', ffmpegBatchScript);
    }
  };
  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showHud(label || "Скопійовано");
    } catch (e) {
      window.prompt('Скопіюйте вручну:', value);
    }
  };
  const copyVideoName = async (name, id) => {
    if (!name) return;
    try {
      await navigator.clipboard.writeText(name);
    } catch (e) {
      window.prompt('Скопіюйте назву вручну:', name);
    }
    setCopiedNameId(id);
    if (copiedNameTimeoutRef.current) clearTimeout(copiedNameTimeoutRef.current);
    copiedNameTimeoutRef.current = setTimeout(() => setCopiedNameId(null), 1200);
  };
  const {
    adminOpen,
    setAdminOpen,
    adminHistoryOpen,
    setAdminHistoryOpen,
    adminBaseUrl,
    setAdminBaseUrl,
    adminHealth,
    adminSheetFilter,
    adminSheetFiltered,
    setAdminSheetFilter,
    adminSnapshot,
    adminConfig,
    setAdminConfig,
    adminJobs,
    adminJob,
    adminShowSnapshot,
    setAdminShowSnapshot,
    adminImportStats,
    adminLastRefreshAt,
    adminError,
    adminLoading,
    adminAiLoading,
    adminAiStats,
    adminLogoLoading,
    adminLogoStats,
    adminJobProgress,
    getJobMeta,
    getJobProgress,
    selectAdminJob,
    pingAdmin,
    loadAdminSheet,
    loadAdminSnapshot,
    saveAdminConfig,
    saveAdminSnapshot,
    applyAdminSnapshot,
    loadSheetMap,
    runAdminFfmpeg,
    runAdminAiSegments,
    runAdminLogoDetection,
    stopAdminJob,
    pickAdminFolder,
    addVideosFromServer,
    queueServerRename
  } = useAdmin({
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
    prefs: {
      isDark,
      batchSuffix,
      seekStep,
      uploadToDrive,
      sidebarWidth,
      overwriteOutputs
    },
    setPrefs: {
      setIsDark,
      setBatchSuffix,
      setSeekStep,
      setUploadToDrive,
      setSidebarWidth,
      setOverwriteOutputs
    },
    helpers: {
      getDisplayName,
      buildEditFromSaved,
      getSavedEditForVideo,
      dedupePlaylistAndEdits,
      getFileKeyCounts,
      getFileKeyVariants,
      getVideoChannelVariants,
      allowDoneForVideo,
      buildFfmpegLinesFor,
      getVideoDoneDir,
      getExpectedModesForAi
    }
  });
  useEffect(() => {
    const prefs = loadFromStorage(STORAGE_KEYS.prefs, null);
    if (!prefs) return;
    if (typeof prefs.isDark === 'boolean') setIsDark(prefs.isDark);
    if (typeof prefs.batchSuffix === 'string') setBatchSuffix(prefs.batchSuffix);
    else if (typeof prefs.filenameSuffix === 'string') setBatchSuffix(prefs.filenameSuffix);
    if (typeof prefs.seekStep === 'number') setSeekStep(prefs.seekStep);
    if (typeof prefs.uploadToDrive === 'boolean') setUploadToDrive(prefs.uploadToDrive);
    if (typeof prefs.sidebarWidth === 'number') setSidebarWidth(prefs.sidebarWidth);
    if (typeof prefs.adminBaseUrl === 'string') setAdminBaseUrl(prefs.adminBaseUrl);
    if (typeof prefs.overwriteOutputs === 'boolean')
      setOverwriteOutputs(prefs.overwriteOutputs);
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.prefs, {
      isDark,
      batchSuffix,
      seekStep,
      uploadToDrive,
      sidebarWidth,
      adminBaseUrl,
      overwriteOutputs
    });
  }, [
    isDark,
    batchSuffix,
    seekStep,
    uploadToDrive,
    sidebarWidth,
    adminBaseUrl,
    overwriteOutputs
  ]);
  useEffect(() => {
    if (!isFocusMode) setFocusSideOpen(false);
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) return;
    if (!Number.isFinite(focusCanvasHeight) || focusCanvasHeight <= 0) {
      setFocusCanvasHeight(Math.round(window.innerHeight * 0.75));
    }
  }, [isFocusMode, focusCanvasHeight]);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!focusResizeRef.current) return;
      const deltaY = e.clientY - focusResizeStartRef.current.y;
      const nextHeight = clamp(
        focusResizeStartRef.current.height + deltaY,
        240,
        Math.max(320, window.innerHeight - 80)
      );
      setFocusCanvasHeight(nextHeight);
    };
    const handleMouseUp = () => {
      if (!focusResizeRef.current) return;
      focusResizeRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);
  // --- BATCH LOGIC ---
  const startBatchExport = () => {
    const selectedVideos = playlist.filter(p => p.checked);
    if (selectedVideos.length === 0) {
      alert("Виберіть хоча б одне відео галочкою!");
      return;
    }
    if (
      !window.confirm(
        `Ви хочете обробити та автоматично скачати ${selectedVideos.length} обраних відео?`
      )
    )
      return;

    const selectedIds = selectedVideos.map(p => p.id);
    setBatchQueue(selectedIds);
    setBatchTotal(selectedIds.length);
    setIsBatchMode(true);
    switchVideo(selectedIds[0]);
  };

  useEffect(() => {
    if (!isBatchMode) return;
    if (batchQueue.length === 0) {
      setIsBatchMode(false);
      setBatchTotal(0);
      alert("Всі обрані файли успішно оброблено та завантажено!");
      return;
    }
    const nextId = batchQueue[0];
    if (currentId !== nextId) switchVideo(nextId);
  }, [batchQueue, isBatchMode, currentId]);

  useEffect(() => {
    if (!isBatchMode || isProcessing || batchQueue.length === 0) return;
    if (batchQueue[0] !== currentId) return;
    if (!activeVideo?.url || !activeVideo?.file) return;
    if (!currentEdit.meta.duration) return;
    const vid = processingVideoRef.current;
    if (!vid) return;

    const startWhenReady = () => startProcessing({ autoDownload: true });

    if (vid.readyState >= 1) {
      const timer = setTimeout(startWhenReady, 300);
      return () => clearTimeout(timer);
    }

    const onReady = () => startWhenReady();
    vid.addEventListener('loadedmetadata', onReady, { once: true });
    return () => vid.removeEventListener('loadedmetadata', onReady);
  }, [isBatchMode, isProcessing, batchQueue, currentId, activeVideo?.url, activeVideo?.file, currentEdit.meta.duration]);

  useEffect(() => {
    setSegmentDraft({ start: null, end: null });
  }, [currentId]);

  useEffect(() => {
    elementPreviewRef.current.clear();
  }, [currentId]);

  const fileKeySegmentModes = useMemo(() => {
    const map = new Map();
    playlist.forEach(video => {
      if (!video?.fileKey) return;
      const modes = Array.isArray(video.channels) && video.channels.length > 0
        ? video.channels.map(channel => channel.mode).filter(Boolean)
        : [getSegmentModeForVideo(video)];
      if (!map.has(video.fileKey)) map.set(video.fileKey, new Set());
      const set = map.get(video.fileKey);
      modes.forEach(mode => {
        if (mode) set.add(mode);
      });
    });
    return map;
  }, [playlist]);
  const activeSegmentModes = useMemo(() => {
    const fallback = getSegmentModeForVideo(activeVideo) || 'digital';
    if (!activeVideo?.fileKey) return [fallback];
    const set = fileKeySegmentModes.get(activeVideo.fileKey);
    if (!set || set.size === 0) return [fallback];
    return SEGMENT_MODES.map(mode => mode.id).filter(id => set.has(id));
  }, [activeVideo?.fileKey, activeVideo?.id, fileKeySegmentModes]);
  const activeSegmentModesMeta = useMemo(
    () => activeSegmentModes.map(id => SEGMENT_MODES.find(mode => mode.id === id)).filter(Boolean),
    [activeSegmentModes]
  );
  const activeSegmentMode = getActiveSegmentMode(activeSegmentModes);
  const activeSegmentMeta =
    SEGMENT_MODES.find(mode => mode.id === activeSegmentMode) || SEGMENT_MODES[0];
  const activeChannelChips = useMemo(
    () => buildChannelSuffixChips(activeVideo),
    [activeVideo, currentEdit.segmentMode]
  );
  const activeSegments = getSegmentsForMode(currentEdit, activeSegmentMode);
  const visibleElements = useMemo(
    () => filterElementsForMode(currentEdit.elements, activeSegmentMode),
    [currentEdit.elements, activeSegmentMode]
  );
  const activeSegmentModesKey = activeSegmentModes.join('|');
  const allSegmentsByMode = useMemo(
    () =>
      activeSegmentModesMeta.map(mode => ({
        meta: mode,
        segments: getSegmentsForMode(currentEdit, mode.id)
      })),
    [currentEdit.segmentSets, activeSegmentModesKey]
  );
  useEffect(() => {
    if (!activeSegmentModes.length) return;
    if (currentEdit.segmentMode && activeSegmentModes.includes(currentEdit.segmentMode)) return;
    setActiveSegmentMode(activeSegmentModes[0]);
  }, [activeSegmentModesKey, currentId]);


  // --- KEYBOARD LISTENERS ---
  useEffect(() => {
    const handleKeyDown = e => {
      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        if (!altDownRef.current) {
          altDownRef.current = true;
          altUsedWithOtherRef.current = false;
        }
        return;
      }
      if (altDownRef.current) altUsedWithOtherRef.current = true;
      if (!activeVideo || (isProcessing && processingJob?.videoId === currentId)) return;

      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') {
        e.preventDefault();
        redo();
        return;
      }
      if (
        (e.code === 'Backslash' || e.key === '\\' || e.key === "'") &&
        e.target.tagName !== 'INPUT' &&
        e.target.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsFocusMode(prev => {
          const next = !prev;
          if (!next) setFocusSideOpen(false);
          return next;
        });
        return;
      }
      if (
        e.shiftKey &&
        (e.code === 'Slash' || e.key === '?' || e.key === '/' || e.key === '*')
      ) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        cycleSegmentMode();
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.code === 'Enter' && e.target.dataset?.segmentInput === 'true') {
          e.preventDefault();
          addSegmentFromDraft();
        }
        return;
      }
      if (e.code === 'Space' && viewportHoverRef.current && currentEdit.viewMode === 'editor') {
        e.preventDefault();
        spacePanRef.current = true;
        return;
      }

      const vid = videoRef.current;
      if (!vid) return;

      const key = (e.key || '').toLowerCase();
      if (key === 'n' || e.code === 'KeyN') {
        e.preventDefault();
        addRect();
        showHud("Додано прямокутник");
        return;
      }
      if (key === 'l' || key === 'д' || e.code === 'KeyL') {
        e.preventDefault();
        if (!currentEdit.selectedId) {
          showHud("Спочатку оберіть елемент");
          return;
        }
        const selected = currentEdit.elements.find(el => el.id === currentEdit.selectedId);
        if (!selected) return;
        const activeMode =
          activeSegmentMode || currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
        const normalizedActive = normalizeName(activeMode);
        const currentMode = normalizeName(selected.channelMode);
        const nextMode = currentMode === normalizedActive ? 'all' : activeMode;
        updateElement(selected.id, { channelMode: nextMode });
        if (nextMode === 'all') {
          showHud("Канал: всі");
        } else {
          const label = SEGMENT_MODES.find(mode => mode.id === activeMode)?.label || activeMode;
          showHud(`Канал: ${label}`);
        }
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        addSegmentFromDraft();
        return;
      }
      if (key === 'b' || key === 'б' || key === ',' || e.code === 'KeyB' || e.code === 'Comma') {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { isOutline: true });
          showHud("Контур");
        } else {
          showHud("Спочатку оберіть елемент");
        }
        return;
      }
      if (key === 'u' || key === 'ю' || key === '.' || e.code === 'KeyU' || e.code === 'Period') {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { isOutline: false });
          showHud("Заливка");
        } else {
          showHud("Спочатку оберіть елемент");
        }
        return;
      }
      if (!e.ctrlKey && !e.metaKey && (key === 'c' || e.code === 'KeyC')) {
        e.preventDefault();
        const selected = currentEdit.elements.find(el => el.id === currentEdit.selectedId);
        if (selected) copyAttributes(selected);
        else showHud("Спочатку оберіть елемент");
        return;
      }
      if (!e.ctrlKey && !e.metaKey && (key === 'v' || e.code === 'KeyV')) {
        e.preventDefault();
        if (currentEdit.selectedId) pasteAttributes(currentEdit.selectedId);
        else showHud("Спочатку оберіть елемент");
        return;
      }
      if (e.code === 'Delete' || e.code === 'Backspace' || key === 'delete') {
        if (currentEdit.selectedId) {
          e.preventDefault();
          deleteElement(currentEdit.selectedId);
          showHud("Елемент видалено");
        }
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayback();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - 2);
          showHud(`⏪ ${vid.currentTime.toFixed(3)}s`);
          break;
        case 'ArrowRight':
          e.preventDefault();
          vid.currentTime = Math.min(currentEdit.meta.duration, vid.currentTime + 2);
          showHud(`⏩ ${vid.currentTime.toFixed(3)}s`);
          break;
        case 'ArrowUp':
          e.preventDefault();
          vid.currentTime = Math.min(currentEdit.meta.duration, vid.currentTime + seekStep);
          showHud(`+${seekStep}s: ${vid.currentTime.toFixed(3)}s`);
          setCurrentTime(vid.currentTime);
          break;
        case 'ArrowDown':
          e.preventDefault();
          vid.currentTime = Math.max(0, vid.currentTime - seekStep);
          showHud(`-${seekStep}s: ${vid.currentTime.toFixed(3)}s`);
          setCurrentTime(vid.currentTime);
          break;
        // NEW HOTKEYS FOR TIME
        case 'KeyM':
          e.preventDefault();
          if (currentEdit.selectedId) {
            updateElement(currentEdit.selectedId, { startTime: vid.currentTime });
            showHud(`Початок: ${vid.currentTime.toFixed(2)}s`);
          } else {
            setSegmentDraft(prev => ({ ...prev, start: vid.currentTime }));
            showHud(`Сегмент початок: ${vid.currentTime.toFixed(2)}s`);
          }
          break;
        case 'Slash':
          e.preventDefault();
          if (currentEdit.selectedId) {
            updateElement(currentEdit.selectedId, { endTime: vid.currentTime });
            showHud(`Кінець: ${vid.currentTime.toFixed(2)}s`);
          } else {
            setSegmentDraft(prev => ({ ...prev, end: vid.currentTime }));
            showHud(`Сегмент кінець: ${vid.currentTime.toFixed(2)}s`);
          }
          break;
        default:
          break;
      }
    };
    const handleKeyUp = e => {
      if (e.code === 'Space') {
        spacePanRef.current = false;
        return;
      }
      if (e.code !== 'AltLeft' && e.code !== 'AltRight') return;
      if (altDownRef.current && !altUsedWithOtherRef.current) {
        cycleSeekStep();
      }
      altDownRef.current = false;
      altUsedWithOtherRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeVideo, isPlaying, currentEdit, isProcessing, processingJob, currentId, seekStep, activeSegmentMode]);

  useEffect(() => {
    const handlePointerDown = e => {
      const overlay = overlayRef.current;
      if (!overlay || overlay.contains(e.target)) return;
      if (!currentEdit.selectedId) return;
      updateCurrentEdit({ selectedId: null }, false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [currentId, currentEdit.selectedId]);

  // --- HANDLERS ---
  const handleFileChange = async event => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    const sheetMap = await loadSheetMap();
    if (!sheetMap) showHud("Таблиця не завантажена, суфікси не підтягнуто");
    const savedEdits = savedEditsRef.current || {};
    const existingByFileKey = new Map(
      playlistRef.current.filter(v => v.fileKey).map(v => [v.fileKey, v])
    );
    const newVideos = [];
    const replacements = [];
    files.forEach(file => {
      const fileKey = getFileKey(file);
      const normalizedName = normalizeName(file.name);
      const sheetEntries = sheetMap?.get(normalizedName) || [];
      const sheetHasBoth = sheetEntries.length > 0 && entriesHaveBoth(sheetEntries);
      const entries = sheetEntries.length > 0 ? sheetEntries : [null];
      const orderedEntries = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const orderDiff = getEntryOrder(a.entry) - getEntryOrder(b.entry);
          return orderDiff !== 0 ? orderDiff : a.index - b.index;
        })
        .map(item => item.entry);
      const channels = buildChannelsFromEntries(orderedEntries);
      const existingItem = existingByFileKey.get(fileKey);
      if (existingItem && (existingItem.file || existingItem.url)) {
        if (channels.length > 0) {
          replacements.push({
            ...existingItem,
            file,
            url: existingItem.url || URL.createObjectURL(file),
            channels: mergeChannelLists(existingItem.channels, channels),
            sheetHasBoth: existingItem.sheetHasBoth || sheetHasBoth
          });
        }
        return;
      }
      const url = URL.createObjectURL(file);
      const primarySuffix = channels[0]?.suffix || '';
      const baseItem = {
        id: fileKey,
        file,
        url,
        name: file.name,
        checked: false,
        suffix: primarySuffix,
        notRelevant: existingItem?.notRelevant || false,
        fileKey,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        isLoading: false,
        sheetRow: null,
        sheetMode: '',
        sheetCameraType: '',
        sheetStatus: '',
        sheetHasBoth,
        channels
      };
      if (existingItem) {
        replacements.push({ ...baseItem, channels: mergeChannelLists(existingItem.channels, channels) });
        return;
      }
      newVideos.push(baseItem);
      idbPutVideo({
        fileKey,
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        blob: file
      }).catch(() => showHud("Не вдалося зберегти файл локально"));
    });
    const fileKeyCounts = new Map();
    const countFileKey = item => {
      if (!item?.fileKey) return;
      fileKeyCounts.set(item.fileKey, (fileKeyCounts.get(item.fileKey) || 0) + 1);
    };
    playlistRef.current.forEach(countFileKey);
    newVideos.forEach(countFileKey);
    if (newVideos.length === 0 && replacements.length === 0) {
      showHud("Файли вже додані");
      return;
    }
    setPlaylist(prev => {
      let next = prev;
      if (replacements.length > 0) {
        const byId = new Map(replacements.map(r => [r.id, r]));
        next = prev.map(v => (byId.has(v.id) ? { ...v, ...byId.get(v.id) } : v));
      }
      if (newVideos.length > 0) next = [...next, ...newVideos];
      return next;
    });
    setEdits(prev => {
      const next = { ...prev };
      [...newVideos, ...replacements].forEach(video => {
        const restored = buildEditFromSaved(
          getSavedEditForVideo(savedEdits, video, fileKeyCounts)
        );
        if (restored) next[video.id] = restored;
      });
      return next;
    });
    if (!currentId) {
      const first = newVideos[0] || replacements[0];
      if (first) setCurrentId(first.id);
    }
  };

  useEffect(() => {
    if (!currentId) return;
    const currentVideo = playlist.find(v => v.id === currentId);
    if (!currentVideo?.id) return;
    const saved = savedEditsRef.current || {};
    const snapshot = {
      trim: currentEdit.trim,
      crop: currentEdit.crop,
      elements: currentEdit.elements,
      segments: currentEdit.segments,
      segmentSets: currentEdit.segmentSets,
      segmentMode: currentEdit.segmentMode,
      viewMode: currentEdit.viewMode,
      meta: {
        duration: currentEdit.meta.duration,
        width: currentEdit.meta.width,
        height: currentEdit.meta.height
      }
    };
    saved[currentVideo.id] = snapshot;
    if (currentVideo.fileKey && currentVideo.fileKey !== currentVideo.id) {
      saved[currentVideo.fileKey] = snapshot;
    }
    savedEditsRef.current = saved;
    saveToStorage(STORAGE_KEYS.edits, saved);
    idbSaveEdit(currentVideo.id, snapshot).catch(() => { });
    if (currentVideo.fileKey && currentVideo.fileKey !== currentVideo.id) {
      idbSaveEdit(currentVideo.fileKey, snapshot).catch(() => { });
    }
  }, [currentId, currentEdit, playlist]);

  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    const handleMouseMove = e => {
      if (!sidebarResizingRef.current) return;
      const delta = e.clientX - sidebarResizeStartRef.current.x;
      const nextWidth = clamp(sidebarResizeStartRef.current.width + delta, 220, 420);
      setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => {
      if (!sidebarResizingRef.current) return;
      sidebarResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  useEffect(() => {
    playSegmentsOnlyRef.current = playSegmentsOnly;
    if (!playSegmentsOnly) return;
    const vid = videoRef.current;
    const segments = segmentsRef.current;
    if (!vid || !segments.length) return;
    const time = vid.currentTime;
    const epsilon = 0.04;
    const inSegment = segments.some(seg => time >= seg.start - epsilon && time <= seg.end - epsilon);
    if (!inSegment) {
      const next = segments.find(seg => time < seg.start - epsilon) || segments[0];
      vid.currentTime = next.start;
      if (isPlayingRef.current) vid.play().catch(() => { });
      setCurrentTime(vid.currentTime);
    }
    if (isPlayingRef.current) segmentLoopStartRef.current?.();
  }, [playSegmentsOnly, currentId]);

  useEffect(() => {
    const mode = currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    const segments = getSegmentsForMode(currentEdit, mode);
    segmentsRef.current = (segments || [])
      .map(seg => ({
        start: Number.isFinite(seg.start) ? seg.start : 0,
        end: Number.isFinite(seg.end) ? seg.end : 0
      }))
      .filter(seg => seg.end > seg.start)
      .sort((a, b) => a.start - b.start);
  }, [
    currentEdit.segmentSets,
    currentEdit.segments,
    currentEdit.segmentMode,
    currentId,
    activeVideo?.id
  ]);

  const switchVideo = id => {
    setIsPlaying(false);
    if (!isProcessing) {
      setProgress(0);
      setErrorMsg('');
    }
    setCurrentId(id);
    setZoom(1); // Reset zoom on switch
    setPan({ x: 0, y: 0 });
    if (videoRef.current) videoRef.current.pause();
  };

  useEffect(() => {
    if (!currentId) return;
    const currentVideo = playlistRef.current.find(v => v.id === currentId);
    if (!currentVideo || currentVideo.url) return;
    if (currentVideo.source === 'server' && currentVideo.sourcePath) {
      const remoteUrl = buildServerFileUrl(currentVideo.sourcePath);
      setPlaylist(prev =>
        prev.map(v =>
          v.id === currentId
            ? {
              ...v,
              url: remoteUrl,
              isLoading: false
            }
            : v
        )
      );
      return;
    }
    if (!currentVideo.fileKey) return;
    let canceled = false;
    const load = async () => {
      setPlaylist(prev =>
        prev.map(v => (v.id === currentId ? { ...v, isLoading: true } : v))
      );
      let record = null;
      try {
        record = await idbGetVideo(currentVideo.fileKey);
      } catch (e) { }
      if (canceled) return;
      if (!record?.blob) {
        setPlaylist(prev =>
          prev.map(v => (v.id === currentId ? { ...v, isLoading: false } : v))
        );
        showHud("Файл не знайдено в кеші");
        return;
      }
      const file =
        record.blob instanceof File
          ? record.blob
          : new File([record.blob], record.name || currentVideo.name, {
            type: record.type || currentVideo.type || 'video/mp4',
            lastModified: record.lastModified || currentVideo.lastModified || Date.now()
          });
      const url = URL.createObjectURL(file);
      setPlaylist(prev =>
        prev.map(v =>
          v.id === currentId
            ? {
              ...v,
              file,
              url,
              isLoading: false,
              name: record.name || v.name,
              type: record.type || v.type,
              size: record.size || v.size,
              lastModified: record.lastModified || v.lastModified
            }
            : v
        )
      );
    };
    load();
    return () => {
      canceled = true;
    };
  }, [currentId]);

  const removeVideo = (e, id) => {
    e.stopPropagation();
    const target = playlistRef.current.find(p => p.id === id);
    if (target?.url) URL.revokeObjectURL(target.url);
    setPlaylist(prev => prev.filter(p => p.id !== id));
    setEdits(prev => {
      const newEdits = { ...prev };
      delete newEdits[id];
      return newEdits;
    });
    if (currentId === id) setCurrentId(null);
  };

  const handleMetadata = e => {
    const vid = e.target;
    const needsMeta =
      currentEdit.meta.duration === 0 ||
      currentEdit.meta.width === 0 ||
      currentEdit.meta.height === 0;
    if (!needsMeta) return;
    const duration = Number.isFinite(vid.duration) ? vid.duration : 0;
    const clampTime = val => clamp(val, 0, duration);
    const hasSavedTrim = currentEdit.trim?.end > 0;
    let nextTrim = hasSavedTrim
      ? {
        start: clampTime(currentEdit.trim.start || 0),
        end: clampTime(currentEdit.trim.end || duration)
      }
      : { start: 0, end: duration };
    if (nextTrim.end <= nextTrim.start) {
      nextTrim.end = clampTime(nextTrim.start + 0.1);
    }
    const nextElements = currentEdit.elements.map(el => {
      const startTime = clampTime(el.startTime ?? 0);
      let endTime = clampTime(el.endTime ?? duration);
      if (endTime <= startTime) endTime = clampTime(startTime + 0.1);
      return { ...el, startTime, endTime };
    });
    const segmentMode = currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    const baseSegmentSets = normalizeSegmentSets(
      currentEdit.segmentSets,
      currentEdit.segments,
      segmentMode
    );
    const nextSegmentSets = Object.fromEntries(
      Object.entries(baseSegmentSets).map(([mode, segments]) => [
        mode,
        (segments || []).map(seg => {
          const start = clampTime(seg.start ?? 0);
          let end = clampTime(seg.end ?? duration);
          if (end <= start) end = clampTime(start + 0.1);
          return { ...seg, start, end };
        })
      ])
    );
    updateCurrentEdit(
      {
        meta: { duration, width: vid.videoWidth, height: vid.videoHeight },
        trim: nextTrim,
        elements: nextElements,
        segmentSets: nextSegmentSets,
        segments: nextSegmentSets[segmentMode] || []
      },
      false
    );
  };

  const togglePlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };
  const toggleCanvasExpand = () => {
    const next = !isCanvasExpanded;
    setIsCanvasExpanded(next);
    if (isFocusMode && typeof window !== 'undefined') {
      const factor = next ? 0.9 : 0.8;
      setFocusCanvasHeight(Math.round(window.innerHeight * factor));
    }
  };
  const handleViewportMouseEnter = () => {
    viewportHoverRef.current = true;
  };
  const handleViewportMouseLeave = () => {
    viewportHoverRef.current = false;
    spacePanRef.current = false;
  };
  const handleSeek = e => {
    if (!videoRef.current || !currentEdit.meta.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const perc = Math.max(0, Math.min(1, x / rect.width));
    videoRef.current.currentTime = perc * currentEdit.meta.duration;
    setCurrentTime(videoRef.current.currentTime);
  };
  const handleSegmentSeek = e => {
    const mode = currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    const segments = getSegmentsForMode(currentEdit, mode);
    if (!videoRef.current || segments.length === 0) return;
    const total = getSegmentTotal(segments);
    if (!total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const perc = Math.max(0, Math.min(1, x / rect.width));
    const offset = perc * total;
    const nextTime = getTimeForSegmentOffset(offset, segments);
    videoRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const useVfc = typeof vid.requestVideoFrameCallback === 'function';
    let vfcId = null;
    let rafId = null;
    const stopSegmentLoop = () => {
      segmentLoopActiveRef.current = false;
      if (useVfc && vfcId !== null) vid.cancelVideoFrameCallback(vfcId);
      if (!useVfc && rafId) cancelAnimationFrame(rafId);
      vfcId = null;
      rafId = null;
    };
    const segmentLoop = () => {
      if (!playSegmentsOnlyRef.current || !isPlayingRef.current) {
        stopSegmentLoop();
        return;
      }
      handleSegmentPlayback(vid);
      if (useVfc) vfcId = vid.requestVideoFrameCallback(segmentLoop);
      else rafId = requestAnimationFrame(segmentLoop);
    };
    const startSegmentLoop = () => {
      if (!playSegmentsOnlyRef.current || !isPlayingRef.current) return;
      if (segmentLoopActiveRef.current) return;
      segmentLoopActiveRef.current = true;
      if (useVfc) vfcId = vid.requestVideoFrameCallback(segmentLoop);
      else rafId = requestAnimationFrame(segmentLoop);
    };
    segmentLoopStartRef.current = startSegmentLoop;
    const onTimeUpdate = () => {
      setCurrentTime(vid.currentTime);
      if (playSegmentsOnlyRef.current && isPlayingRef.current) handleSegmentPlayback(vid);
    };
    const onEnded = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopSegmentLoop();
    };
    const onPause = () => {
      isPlayingRef.current = false;
      setIsPlaying(false);
      stopSegmentLoop();
    };
    const onPlay = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
      startSegmentLoop();
    };
    vid.addEventListener('timeupdate', onTimeUpdate);
    vid.addEventListener('ended', onEnded);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('play', onPlay);
    return () => {
      vid.removeEventListener('timeupdate', onTimeUpdate);
      vid.removeEventListener('ended', onEnded);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('play', onPlay);
      stopSegmentLoop();
      segmentLoopStartRef.current = null;
    };
  }, [currentId]);

  // --- ELEMENT LOGIC ---
  const addRect = () => {
    const { crop, elements, meta } = currentEdit;
    const cropW = 100 - crop.l - crop.r;
    const cropH = 100 - crop.t - crop.b;
    const newEl = {
      id: Date.now().toString(),
      type: 'rect',
      x: crop.l + cropW / 2 - 10,
      y: crop.t + cropH / 2 - 10,
      w: 20,
      h: 20,
      color: '#000000',
      isOutline: true,
      thickness: 1,
      channelMode: 'all',
      startTime: currentTime || 0,
      endTime: meta.duration || 10
    };
    updateCurrentEdit({ elements: [...elements, newEl], selectedId: newEl.id, viewMode: 'editor' });
  };
  const addCircle = () => {
    const { crop, elements, meta } = currentEdit;
    const cropW = 100 - crop.l - crop.r;
    const cropH = 100 - crop.t - crop.b;
    const newEl = {
      id: Date.now().toString(),
      type: 'circle',
      x: crop.l + cropW / 2 - 10,
      y: crop.t + cropH / 2 - 10,
      w: 20,
      h: 20,
      color: '#000000',
      isOutline: true,
      thickness: 1,
      channelMode: 'all',
      startTime: currentTime || 0,
      endTime: meta.duration || 10
    };
    updateCurrentEdit({ elements: [...elements, newEl], selectedId: newEl.id, viewMode: 'editor' });
  };

  const updateElement = (id, updates, saveHistory = true) => {
    updateCurrentEdit(
      oldEdit => ({
        elements: (oldEdit.elements || []).map(el =>
          el.id === id ? { ...el, ...updates } : el
        )
      }),
      saveHistory
    );
  };

  const deleteElement = id => {
    updateCurrentEdit({ elements: currentEdit.elements.filter(e => e.id !== id), selectedId: null });
  };

  const duplicateElement = id => {
    const el = currentEdit.elements.find(e => e.id === id);
    if (!el) return;
    const newEl = { ...el, id: Date.now().toString(), x: el.x + 2, y: el.y + 2 };
    updateCurrentEdit({ elements: [...currentEdit.elements, newEl], selectedId: newEl.id });
    showHud("Прямокутник дубльовано");
  };

  const alignElement = (id, mode) => {
    const el = currentEdit.elements.find(e => e.id === id);
    if (!el) return;
    const next = { ...el };
    if (mode === 'center-h') next.x = 50 - el.w / 2;
    if (mode === 'center-v') next.y = 50 - el.h / 2;
    if (mode === 'top') next.y = 0;
    if (mode === 'bottom') next.y = 100 - el.h;
    if (mode === 'left') next.x = 0;
    if (mode === 'right') next.x = 100 - el.w;
    updateElement(id, next);
    showHud("Вирівняно");
  };

  const snapElementToGrid = (id, step = 5) => {
    const el = currentEdit.elements.find(e => e.id === id);
    if (!el) return;
    const snap = val => Math.max(0, Math.min(100, Math.round(val / step) * step));
    updateElement(id, {
      x: snap(el.x),
      y: snap(el.y),
      w: snap(el.w),
      h: snap(el.h)
    });
    showHud("Прив’язка до сітки");
  };

  const copyAttributes = el => {
    setCopiedAttributes({
      color: el.color,
      isOutline: el.isOutline,
      thickness: el.thickness,
      startTime: el.startTime,
      endTime: el.endTime,
      channelMode: el.channelMode || 'all'
    });
    showHud("Налаштування скопійовано");
  };

  const pasteAttributes = id => {
    if (!copiedAttributes) {
      showHud("Спочатку скопіюйте!");
      return;
    }
    updateElement(id, { ...copiedAttributes });
    showHud("Налаштування вставлено");
  };

  const addSegmentFromDraft = () => {
    if (!currentEdit.meta.duration) {
      showHud("Спочатку дочекайтесь метаданих");
      return;
    }
    let start = segmentDraft.start;
    let end = segmentDraft.end;
    if (!Number.isFinite(start) && segmentStartRef.current) {
      start = parseNumericInput(segmentStartRef.current.value);
    }
    if (!Number.isFinite(end) && segmentEndRef.current) {
      end = parseNumericInput(segmentEndRef.current.value);
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      showHud("Задайте початок і кінець");
      return;
    }
    const s = clamp(Math.min(start, end), 0, currentEdit.meta.duration);
    let e = clamp(Math.max(start, end), 0, currentEdit.meta.duration);
    if (e <= s) e = clamp(s + 0.1, 0, currentEdit.meta.duration);
    const newSegment = { id: Date.now().toString(), start: s, end: e };
    const mode = getActiveSegmentMode();
    const nextSegments = [...getSegmentsForMode(currentEdit, mode), newSegment];
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
    setSegmentDraft({ start: null, end: null });
    showHud("Сегмент додано");
  };

  const normalizeSegment = (seg, duration) => {
    if (!duration) return seg;
    const rawStart = Number.isFinite(seg.start) ? seg.start : 0;
    const rawEnd = Number.isFinite(seg.end) ? seg.end : rawStart + 0.1;
    const start = clamp(rawStart, 0, duration);
    let end = clamp(rawEnd, 0, duration);
    if (end <= start) end = clamp(start + 0.1, 0, duration);
    return { ...seg, start, end };
  };

  const updateSegment = (id, updates, saveHistory = true) => {
    const mode = getActiveSegmentMode();
    updateCurrentEdit(
      oldEdit => {
        const duration = oldEdit.meta?.duration || 0;
        const nextSegments = getSegmentsForMode(oldEdit, mode).map(seg =>
          seg.id === id ? normalizeSegment({ ...seg, ...updates }, duration) : seg
        );
        return {
          segmentSets: updateSegmentsForMode(oldEdit, mode, nextSegments),
          segments: nextSegments
        };
      },
      saveHistory
    );
  };
  const updateElementRef = useRef(updateElement);
  useEffect(() => {
    updateElementRef.current = updateElement;
  }, [updateElement]);
  const updateSegmentRef = useRef(updateSegment);
  useEffect(() => {
    updateSegmentRef.current = updateSegment;
  }, [updateSegment]);

  const removeSegment = id => {
    const mode = getActiveSegmentMode();
    const nextSegments = getSegmentsForMode(currentEdit, mode).filter(seg => seg.id !== id);
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
  };

  const moveSegment = (id, direction) => {
    const mode = getActiveSegmentMode();
    const segments = getSegmentsForMode(currentEdit, mode);
    const index = segments.findIndex(seg => seg.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= segments.length) return;
    const next = [...segments];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, next),
      segments: next
    });
  };

  const clearSegments = () => {
    const mode = getActiveSegmentMode();
    const segments = getSegmentsForMode(currentEdit, mode);
    if (segments.length === 0) return;
    if (!window.confirm("Очистити всі сегменти?")) return;
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, []),
      segments: []
    });
  };

  const stopExport = () => {
    if (!isProcessing) return;
    cancelProcessingRef.current = true;
    stopLoopRef.current?.();
    if (processingVideoRef.current) processingVideoRef.current.pause();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch (e) { }
    }
    setIsProcessing(false);
    setProgress(0);
    if (processingJob?.id) {
      updateNotification(processingJob.id, { status: 'canceled' });
      setTimeout(() => removeNotification(processingJob.id), 3000);
    }
    setProcessingJob(null);
    setProcessingSrc(null);
    if (isBatchMode) {
      setIsBatchMode(false);
      setBatchQueue([]);
      setBatchTotal(0);
    }
    showHud("Експорт зупинено");
  };

  const deleteSelectedVideos = () => {
    const selected = playlistRef.current.filter(p => p.checked);
    if (selected.length === 0) {
      showHud("Немає обраних");
      return;
    }
    if (!window.confirm(`Видалити ${selected.length} обраних відео?`)) return;
    const selectedIds = new Set(selected.map(p => p.id));
    selected.forEach(item => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setPlaylist(prev => prev.filter(p => !selectedIds.has(p.id)));
    setEdits(prev => {
      const next = { ...prev };
      selectedIds.forEach(id => {
        delete next[id];
      });
      return next;
    });
    if (selectedIds.has(currentId)) {
      const nextId = playlistRef.current.find(p => !selectedIds.has(p.id))?.id || null;
      setCurrentId(nextId);
    }
  };

  const replaceVideoById = (videoId, blob, ext, mimeType) => {
    const currentVideo = playlistRef.current.find(v => v.id === videoId);
    if (!currentVideo) return;
    const baseName =
      currentVideo.name?.lastIndexOf('.') !== -1
        ? currentVideo.name.substring(0, currentVideo.name.lastIndexOf('.'))
        : currentVideo.name || 'video';
    const newName = `${baseName}_crop.${ext}`;
    const file = new File([blob], newName, { type: mimeType, lastModified: Date.now() });
    const newFileKey = getFileKey(file);
    const url = URL.createObjectURL(file);
    if (currentVideo.url) URL.revokeObjectURL(currentVideo.url);

    setPlaylist(prev =>
      prev.map(v =>
        v.id === videoId
          ? {
            ...v,
            file,
            url,
            name: newName,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            fileKey: newFileKey,
            isLoading: false
          }
          : v
      )
    );
    if (currentVideo.fileKey && currentVideo.fileKey !== newFileKey) {
      idbDeleteVideo(currentVideo.fileKey).catch(() => { });
      const saved = savedEditsRef.current || {};
      delete saved[currentVideo.id];
      savedEditsRef.current = saved;
      saveToStorage(STORAGE_KEYS.edits, saved);
    }
    idbPutVideo({
      fileKey: newFileKey,
      name: newName,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
      blob: file
    }).catch(() => { });
    const resetEdit = {
      ...DEFAULT_EDIT_STATE,
      trim: { ...DEFAULT_EDIT_STATE.trim },
      crop: { ...DEFAULT_EDIT_STATE.crop },
      elements: [],
      segments: [],
      segmentMode: 'digital',
      segmentSets: getDefaultSegmentSets(),
      meta: { duration: 0, width: 0, height: 0 },
      history: [],
      future: []
    };
    setEdits(prev => ({ ...prev, [videoId]: resetEdit }));
    setSegmentDraft({ start: null, end: null });
    showHud("Відео замінено");
  };

  const applyChanges = mode => {
    if (!activeVideo) return;
    setApplyModalOpen(false);
    const includeElements = mode === 'all';
    startProcessing({ autoDownload: false, includeElements, replaceSource: true });
  };
  useEffect(() => {
    return () => {
      if (dragRafRef.current) cancelAnimationFrame(dragRafRef.current);
      elementPreviewRef.current.clear();
    };
  }, []);

  // --- DRAGGING LOGIC ---
  const applyElementPreview = (id, next) => {
    const overlay = overlayRef.current;
    if (!overlay || !id || !next) return;
    const node = overlay.querySelector(`[data-el-id="${id}"]`);
    if (!node) return;
    node.style.left = `${next.x}%`;
    node.style.top = `${next.y}%`;
    node.style.width = `${next.w}%`;
    node.style.height = `${next.h}%`;
  };

  const applyTrimPreview = (trim, duration) => {
    if (!timelineRef.current || !duration) return;
    const pct = val => (val / duration) * 100;
    const start = Math.max(0, Math.min(100, pct(trim.start || 0)));
    const end = Math.max(0, Math.min(100, pct(trim.end || duration)));
    const box = timelineRef.current.querySelector('[data-trim-box]');
    const maskStart = timelineRef.current.querySelector('[data-trim-start-mask]');
    const maskEnd = timelineRef.current.querySelector('[data-trim-end-mask]');
    const handleStart = timelineRef.current.querySelector('[data-trim-start]');
    const handleEnd = timelineRef.current.querySelector('[data-trim-end]');
    if (box) {
      box.style.left = `${start}%`;
      box.style.right = `${100 - end}%`;
    }
    if (maskStart) maskStart.style.width = `${start}%`;
    if (maskEnd) maskEnd.style.width = `${100 - end}%`;
    if (handleStart) handleStart.style.left = `${start}%`;
    if (handleEnd) handleEnd.style.left = `${end}%`;
  };

  const applyCropPreview = crop => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const box = overlay.querySelector('[data-crop-box]');
    const topMask = overlay.querySelector('[data-crop-top]');
    const bottomMask = overlay.querySelector('[data-crop-bottom]');
    const leftMask = overlay.querySelector('[data-crop-left]');
    const rightMask = overlay.querySelector('[data-crop-right]');
    if (box) {
      box.style.top = `${crop.t}%`;
      box.style.bottom = `${crop.b}%`;
      box.style.left = `${crop.l}%`;
      box.style.right = `${crop.r}%`;
    }
    if (topMask) topMask.style.height = `${crop.t}%`;
    if (bottomMask) bottomMask.style.height = `${crop.b}%`;
    if (leftMask) {
      leftMask.style.top = `${crop.t}%`;
      leftMask.style.bottom = `${crop.b}%`;
      leftMask.style.width = `${crop.l}%`;
    }
    if (rightMask) {
      rightMask.style.top = `${crop.t}%`;
      rightMask.style.bottom = `${crop.b}%`;
      rightMask.style.width = `${crop.r}%`;
    }
  };

  useEffect(() => {
    const scheduleDragUpdate = fn => {
      dragPendingRef.current = fn;
      if (dragRafRef.current) return;
      dragRafRef.current = requestAnimationFrame(() => {
        dragRafRef.current = null;
        const run = dragPendingRef.current;
        dragPendingRef.current = null;
        if (run) run();
      });
    };

    const handleMouseMove = e => {
      if (!isDragging.current) return;
      e.preventDefault();
      const now = performance.now();
      if (now - lastDragTimeRef.current < 12) return;
      lastDragTimeRef.current = now;
      const target = dragTarget.current;
      if (!target) return;
      const clientX = e.clientX;
      const clientY = e.clientY;

      scheduleDragUpdate(() => {
        if (!isDragging.current) return;
        const edit = currentEditRef.current;
        if (!edit) return;

        // Trim Handles
        if (target.type === 'trim-start' || target.type === 'trim-end') {
          if (!timelineRef.current || !edit.meta.duration) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const x = clientX - rect.left;
          let perc = Math.max(0, Math.min(1, x / rect.width));
          let time = perc * edit.meta.duration;

          if (target.type === 'trim-start') {
            time = Math.min(time, edit.trim.end - 0.5);
            const nextTrim = { ...edit.trim, start: time };
            trimPreviewRef.current = nextTrim;
            applyTrimPreview(nextTrim, edit.meta.duration);
            if (videoRef.current) videoRef.current.currentTime = time;
          } else {
            time = Math.max(time, edit.trim.start + 0.5);
            const nextTrim = { ...edit.trim, end: time };
            trimPreviewRef.current = nextTrim;
            applyTrimPreview(nextTrim, edit.meta.duration);
            if (videoRef.current) videoRef.current.currentTime = time;
          }
          return;
        }

        if (target.type === 'segment') {
          if (!timelineRef.current || !edit.meta.duration) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const deltaTime =
            ((clientX - startPos.current.x) / rect.width) * edit.meta.duration;
          const segStart = startState.current.start;
          const segEnd = startState.current.end;
          const segLen = segEnd - segStart;

          if (target.action === 'move') {
            let newStart = segStart + deltaTime;
            newStart = clamp(newStart, 0, edit.meta.duration - segLen);
            const newEnd = newStart + segLen;
            const nextSeg = { start: newStart, end: newEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            updateSegmentRef.current?.(target.id, nextSeg, false);
          } else if (target.action === 'resize-start') {
            const newStart = clamp(segStart + deltaTime, 0, segEnd - 0.1);
            const nextSeg = { start: newStart, end: segEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            updateSegmentRef.current?.(target.id, nextSeg, false);
          } else if (target.action === 'resize-end') {
            const newEnd = clamp(segEnd + deltaTime, segStart + 0.1, edit.meta.duration);
            const nextSeg = { start: segStart, end: newEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            updateSegmentRef.current?.(target.id, nextSeg, false);
          }
          return;
        }

        if (target.type === 'pan') {
          const deltaX = clientX - startPos.current.x;
          const deltaY = clientY - startPos.current.y;
          setPan({ x: startState.current.x + deltaX, y: startState.current.y + deltaY });
          return;
        }

        // Canvas Overlay
        if (overlayRef.current && edit.viewMode === 'editor') {
          const rect = overlayRef.current.getBoundingClientRect();

          const deltaPercX = ((clientX - startPos.current.x) / rect.width) * 100;
          const deltaPercY = ((clientY - startPos.current.y) / rect.height) * 100;

          if (target.type === 'element') {
            const elId = target.id;
            const startEl = startState.current;
            let nextEl = null;
            if (target.action === 'move') {
              nextEl = { x: startEl.x + deltaPercX, y: startEl.y + deltaPercY, w: startEl.w, h: startEl.h };
            } else if (target.action === 'resize') {
              if (target.corner === 'br') {
                nextEl = {
                  x: startEl.x,
                  y: startEl.y,
                  w: Math.max(2, startEl.w + deltaPercX),
                  h: Math.max(2, startEl.h + deltaPercY)
                };
              }
              if (target.corner === 'tl') {
                nextEl = {
                  w: Math.max(2, startEl.w - deltaPercX),
                  h: Math.max(2, startEl.h - deltaPercY),
                  x: startEl.x + deltaPercX,
                  y: startEl.y + deltaPercY
                };
              }
              if (target.corner === 'tr') {
                nextEl = {
                  w: Math.max(2, startEl.w + deltaPercX),
                  h: Math.max(2, startEl.h - deltaPercY),
                  x: startEl.x,
                  y: startEl.y + deltaPercY
                };
              }
              if (target.corner === 'bl') {
                nextEl = {
                  w: Math.max(2, startEl.w - deltaPercX),
                  h: Math.max(2, startEl.h + deltaPercY),
                  x: startEl.x + deltaPercX,
                  y: startEl.y
                };
              }
            }
            if (nextEl) {
              elementPreviewRef.current.set(elId, nextEl);
              applyElementPreview(elId, nextEl);
            }
          } else if (target.type === 'crop') {
            const sc = startState.current;
            let newCrop = { ...sc };
            if (target.action === 'move') {
              const cropW = Math.max(1, 100 - sc.l - sc.r);
              const cropH = Math.max(1, 100 - sc.t - sc.b);
              const nextL = clamp(sc.l + deltaPercX, 0, 100 - cropW);
              const nextT = clamp(sc.t + deltaPercY, 0, 100 - cropH);
              newCrop = {
                l: nextL,
                r: 100 - cropW - nextL,
                t: nextT,
                b: 100 - cropH - nextT
              };
            } else {
              // Crop resize logic
              if (target.corner.includes('l'))
                newCrop.l = Math.max(0, Math.min(sc.l + deltaPercX, 100 - sc.r - 5));
              if (target.corner.includes('r'))
                newCrop.r = Math.max(0, Math.min(sc.r - deltaPercX, 100 - sc.l - 5));
              if (target.corner.includes('t'))
                newCrop.t = Math.max(0, Math.min(sc.t + deltaPercY, 100 - sc.b - 5));
              if (target.corner.includes('b'))
                newCrop.b = Math.max(0, Math.min(sc.b - deltaPercY, 100 - sc.t - 5));
            }
            cropPreviewRef.current = newCrop;
            applyCropPreview(newCrop);
          }
        }
      });
    };

    const handleMouseUp = () => {
      const target = dragTarget.current;
      isDragging.current = false;
      dragPendingRef.current = null;
      dragTarget.current = null;
      lastDragTimeRef.current = 0;
      if (target?.type === 'element') {
        const latest = elementPreviewRef.current.get(target.id);
        if (latest) {
          updateElement(target.id, latest, true);
        }
        elementPreviewRef.current.delete(target.id);
      } else if (target?.type === 'segment') {
        const latest = segmentPreviewRef.current.get(target.id);
        if (latest) {
          updateSegment(target.id, latest, true);
        }
        segmentPreviewRef.current.delete(target.id);
      } else if (target?.type === 'trim-start' || target?.type === 'trim-end') {
        if (trimPreviewRef.current) {
          updateCurrentEdit({ trim: trimPreviewRef.current }, true);
        }
      } else if (target?.type === 'crop') {
        if (cropPreviewRef.current) {
          updateCurrentEdit({ crop: cropPreviewRef.current }, true);
        }
      }
      trimPreviewRef.current = null;
      cropPreviewRef.current = null;
      segmentPreviewRef.current.clear();
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  function startPan(e) {
    if (currentEdit.viewMode !== 'editor') return;
    const wantsPan = spacePanRef.current || e.button === 1 || e.button === 2;
    if (!wantsPan && zoom <= 1) return;
    e.preventDefault();
    isDragging.current = true;
    dragTarget.current = { type: 'pan' };
    startPos.current = { x: e.clientX, y: e.clientY };
    startState.current = { ...pan };
  }
  const startDrag = (e, targetInfo) => {
    if (spacePanRef.current || e.button === 1 || e.button === 2) {
      startPan(e);
      return;
    }
    e.stopPropagation();
    isDragging.current = true;
    dragTarget.current = targetInfo;
    startPos.current = { x: e.clientX, y: e.clientY };
    if (targetInfo.type === 'element') {
      const el = currentEdit.elements.find(e => e.id === targetInfo.id);
      startState.current = { ...el };
      updateCurrentEdit({ selectedId: targetInfo.id }, false);
      elementPreviewRef.current.delete(targetInfo.id);
    } else if (targetInfo.type === 'segment') {
      const mode = getActiveSegmentMode();
      const seg = getSegmentsForMode(currentEdit, mode).find(s => s.id === targetInfo.id);
      if (seg) startState.current = { start: seg.start, end: seg.end };
      segmentPreviewRef.current.delete(targetInfo.id);
    } else if (targetInfo.type === 'crop') {
      startState.current = { ...currentEdit.crop };
      cropPreviewRef.current = null;
    } else if (targetInfo.type === 'trim-start' || targetInfo.type === 'trim-end') {
      trimPreviewRef.current = null;
    }
  };
  const handleWheelZoom = e => {
    if (!viewportRef.current) return;
    e.preventDefault();
    const step = e.ctrlKey ? 0.01 : 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const nextZoom = clamp(zoom + direction * step, 0.5, 5);
    zoomToPoint(nextZoom, e.clientX, e.clientY);
    showHud(`Зум ${Math.round(nextZoom * 100)}%`);
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const onWheel = e => handleWheelZoom(e);
    overlay.addEventListener('wheel', onWheel, { passive: false });
    return () => overlay.removeEventListener('wheel', onWheel);
  }, [handleWheelZoom]);

  // --- PROCESSING ---
  const startProcessing = async (options = {}) => {
    const { autoDownload = false, includeElements = true, replaceSource = false } = options;
    if (!processingVideoRef.current || !activeVideo) return;
    const jobVideo = activeVideo;
    const jobEdit = currentEdit;
    const jobVideoId = currentId;
    const jobId = Date.now().toString();
    const jobName = jobVideo?.name || 'video';
    const jobType = replaceSource ? 'crop' : 'export';
    if (jobVideo.notRelevant) {
      if (jobVideo.source === 'server') {
        await queueServerRename(jobVideo, 'not_relevant');
        showHud("Not relevant: перенесено в done");
      } else {
        showHud("Not relevant доступний лише для файлів з теки");
      }
      return;
    }
    setProcessingJob({
      id: jobId,
      videoId: jobVideoId,
      name: jobName,
      progress: 0,
      status: 'running',
      type: jobType
    });
    addNotification({
      id: jobId,
      videoId: jobVideoId,
      name: jobName,
      progress: 0,
      status: 'running',
      type: jobType
    });
    setProcessingSrc(jobVideo.url);
    cancelProcessingRef.current = false;
    setIsProcessing(true);
    setProgress(0);
    setErrorMsg('');
    if (!jobVideo.file && jobVideo.source !== 'server') {
      setIsProcessing(false);
      showHud("Файл ще завантажується");
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }
    if (!jobEdit.meta.duration) {
      setIsProcessing(false);
      showHud("Метадані ще не готові");
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }

    const vid = processingVideoRef.current;
    if (vid.src !== jobVideo.url) {
      vid.src = jobVideo.url;
      vid.load();
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!ctx) {
      setIsProcessing(false);
      setErrorMsg('Canvas недоступний для обробки');
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

    const ensureVideoReady = () =>
      new Promise((resolve, reject) => {
        if (vid.readyState >= 2) return resolve();
        const onReady = () => resolve();
        const onError = () => reject(new Error('Не вдалося завантажити відео'));
        vid.addEventListener('loadeddata', onReady, { once: true });
        vid.addEventListener('error', onError, { once: true });
        vid.load();
      });
    try {
      await ensureVideoReady();
    } catch (e) {
      setIsProcessing(false);
      setErrorMsg('Не вдалося завантажити відео для обробки');
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }

    const cropPx = normalizeCropPx(jobEdit.crop, jobEdit.meta);
    if (cropPx.w <= 0 || cropPx.h <= 0) {
      setIsProcessing(false);
      setErrorMsg('Обрізання має нульовий розмір');
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }
    canvas.width = cropPx.w;
    canvas.height = cropPx.h;
    const { trim, meta } = jobEdit;
    const segmentMode = getSegmentModeForVideo(jobVideo);
    const elements = filterElementsForMode(jobEdit.elements, segmentMode);
    const segments = getSegmentsForMode(jobEdit, segmentMode);

    const exportSegments = Array.isArray(segments) && segments.length > 0
      ? segments
        .map(seg => ({
          start: clamp(seg.start, 0, meta.duration || 0),
          end: clamp(seg.end, 0, meta.duration || 0)
        }))
        .filter(seg => seg.end > seg.start)
      : [
        {
          start: clamp(trim.start, 0, meta.duration || 0),
          end: clamp(trim.end, 0, meta.duration || 0)
        }
      ];
    if (exportSegments.length === 1 && exportSegments[0].end <= exportSegments[0].start) {
      exportSegments[0] = { start: 0, end: meta.duration };
    }
    if (exportSegments.length === 0) {
      setIsProcessing(false);
      showHud("Немає валідних сегментів");
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }
    const totalDuration = exportSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    if (totalDuration <= 0.05) {
      setIsProcessing(false);
      showHud("Надто короткий фрагмент для експорту");
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      return;
    }
    let animationId;
    let vfcId = null;
    const useVfc = typeof vid.requestVideoFrameCallback === 'function';
    const stopLoop = () => {
      if (useVfc && vfcId !== null) vid.cancelVideoFrameCallback(vfcId);
      if (!useVfc && animationId) cancelAnimationFrame(animationId);
    };
    stopLoopRef.current = stopLoop;
    let segmentIndex = 0;
    const scheduleNextFrame = () => {
      if (useVfc) vfcId = vid.requestVideoFrameCallback(processFrame);
      else animationId = requestAnimationFrame(processFrame);
    };
    const waitForFrame = () =>
      new Promise(resolve => {
        if (useVfc) {
          vid.requestVideoFrameCallback(() => resolve());
        } else {
          setTimeout(resolve, 0);
        }
      });
    const seekToSegment = async (index, shouldPlay = true) => {
      vid.pause();
      await new Promise(r => {
        vid.onseeked = r;
        vid.currentTime = exportSegments[index].start;
      });
      if (shouldPlay) {
        try {
          await vid.play();
        } catch (e) { }
        await waitForFrame();
        scheduleNextFrame();
      }
    };
    await seekToSegment(0, false);

    let targetFps = 30;
    try {
      const sourceStream = vid.captureStream ? vid.captureStream() : null;
      const sourceTrack = sourceStream?.getVideoTracks?.()[0];
      const sourceFps = sourceTrack?.getSettings?.().frameRate;
      if (Number.isFinite(sourceFps) && sourceFps > 0) targetFps = Math.round(sourceFps);
    } catch (e) { }
    const stream = canvas.captureStream(targetFps);
    const frameEpsilon = targetFps > 0 ? 1 / targetFps : 0.04;

    let mimeType = 'video/webm';
    const sourceType = jobVideo.file?.type || '';
    if (sourceType.includes('mp4') && MediaRecorder.isTypeSupported('video/mp4'))
      mimeType = 'video/mp4';
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      mimeType = 'video/webm;codecs=vp9';

    let mediaRecorder;
    try {
      let videoBitsPerSecond = null;
      if (jobVideo.file?.size && meta.duration > 0) {
        const totalBps = Math.floor((jobVideo.file.size * 8) / meta.duration);
        videoBitsPerSecond = Math.max(1_000_000, totalBps);
      }
      mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: videoBitsPerSecond || undefined,
        bitsPerSecond: videoBitsPerSecond || undefined
      });
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream, { mimeType });
    }
    mediaRecorderRef.current = mediaRecorder;
    const chunks = [];
    let finalizeCalled = false;
    let hardStopTimer = null;
    const onVideoEnded = () => {
      if (!finalizeCalled) finalizeRecording('ended');
    };
    const cleanupFinalize = () => {
      if (hardStopTimer) clearTimeout(hardStopTimer);
      vid.removeEventListener('ended', onVideoEnded);
    };
    const finalizeRecording = () => {
      if (finalizeCalled) return;
      finalizeCalled = true;
      cleanupFinalize();
      stopLoop();
      if (mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch (e) { }
      }
    };
    mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    mediaRecorder.onerror = () => {
      setIsProcessing(false);
      setErrorMsg('Помилка кодування відео');
      updateNotification(jobId, { status: 'canceled' });
      setTimeout(() => removeNotification(jobId), 3000);
      setProcessingJob(null);
      setProcessingSrc(null);
      finalizeRecording();
    };
    mediaRecorder.onstop = () => {
      cleanupFinalize();
      const canceled = cancelProcessingRef.current;
      cancelProcessingRef.current = false;
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      setIsProcessing(false);
      vid.pause();
      mediaRecorderRef.current = null;
      stopLoopRef.current = null;
      setProcessingSrc(null);
      setProcessingJob(null);
      if (canceled) {
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      if (replaceSource) {
        replaceVideoById(jobVideoId, blob, ext, mimeType);
        updateNotification(jobId, { status: 'done', progress: 100 });
        setTimeout(() => removeNotification(jobId), 4000);
        return;
      }
      const url = URL.createObjectURL(blob);
      setEdits(prev => {
        const existing = prev[jobVideoId] || DEFAULT_EDIT_STATE;
        return { ...prev, [jobVideoId]: { ...existing, processedUrl: url, processedExt: ext } };
      });
      updateNotification(jobId, { status: 'done', progress: 100 });
      setTimeout(() => removeNotification(jobId), 4000);

      if (autoDownload) {
        const a = document.createElement('a');
        a.href = url;
        const baseName =
          jobVideo.name.lastIndexOf('.') !== -1
            ? jobVideo.name.substring(0, jobVideo.name.lastIndexOf('.'))
            : jobVideo.name;
        const perVideoSuffix = jobVideo?.suffix || '';
        const extraBatchSuffix = isBatchMode && batchSuffix ? batchSuffix : '';
        const downloadSuffix = `${perVideoSuffix}${extraBatchSuffix}`;
        a.download = `${baseName}${downloadSuffix}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (jobVideo.source === 'server') {
          const fileKeyCounts = new Map();
          playlistRef.current.forEach(item => {
            if (!item?.fileKey) return;
            fileKeyCounts.set(item.fileKey, (fileKeyCounts.get(item.fileKey) || 0) + 1);
          });
          const variants = getFileKeyVariants(playlistRef.current);
          const allowRenameOriginal = allowDoneForVideo(jobVideo, fileKeyCounts, variants);
          if (allowRenameOriginal) {
            queueServerRename(jobVideo, 'done');
          }
        }
        if (isBatchMode) setBatchQueue(prev => prev.slice(1));
      }
    };

    mediaRecorder.start();
    vid.addEventListener('ended', onVideoEnded);
    hardStopTimer = setTimeout(() => {
      if (!finalizeCalled) finalizeRecording('timeout');
    }, Math.max(2000, Math.ceil((totalDuration + 1) * 1000)));
    vid.muted = true;
    vid.volume = 0.0;
    try {
      await vid.play();
    } catch (e) {
      console.error(e);
    }
    await waitForFrame();

    let lastVideoTime = vid.currentTime || 0;
    let lastAdvanceAt = performance.now();
    const processFrame = () => {
      if (!isProcessing && vid.paused) return;
      if (vid.readyState < 2) {
        scheduleNextFrame();
        return;
      }
      const now = performance.now();
      if (vid.currentTime > lastVideoTime + 0.0005) {
        lastVideoTime = vid.currentTime;
        lastAdvanceAt = now;
      } else if (now - lastAdvanceAt > 2000) {
        finalizeRecording('stalled');
        return;
      }
      const currentSegment = exportSegments[segmentIndex];
      if (vid.ended || currentSegment.end - vid.currentTime <= frameEpsilon) {
        if (segmentIndex < exportSegments.length - 1) {
          segmentIndex += 1;
          seekToSegment(segmentIndex);
          return;
        }
        finalizeRecording();
        return;
      }

      ctx.drawImage(vid, cropPx.x, cropPx.y, cropPx.w, cropPx.h, 0, 0, cropPx.w, cropPx.h);
      if (includeElements) {
        elements.forEach(el => {
          if (vid.currentTime < el.startTime || vid.currentTime > el.endTime) return;
          const elRealX = (el.x / 100) * meta.width;
          const elRealY = (el.y / 100) * meta.height;
          const elRealW = (el.w / 100) * meta.width;
          const elRealH = (el.h / 100) * meta.height;
          const canvasX = elRealX - cropPx.x;
          const canvasY = elRealY - cropPx.y;
          ctx.fillStyle = el.color;
          ctx.strokeStyle = el.color;
          ctx.lineWidth = el.isOutline ? 1 : Math.max(1, (el.thickness / 100) * meta.width * 0.5);
          if (el.type === 'circle') {
            const cx = canvasX + elRealW / 2;
            const cy = canvasY + elRealH / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, elRealW / 2, elRealH / 2, 0, 0, Math.PI * 2);
            if (el.isOutline) ctx.stroke();
            else ctx.fill();
          } else {
            if (el.isOutline) ctx.strokeRect(canvasX, canvasY, elRealW, elRealH);
            else ctx.fillRect(canvasX, canvasY, elRealW, elRealH);
          }
        });
      }

      const currentOffset = exportSegments
        .slice(0, segmentIndex)
        .reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      const currentProgress = currentOffset + (vid.currentTime - currentSegment.start);
      const pct = Math.min(100, (currentProgress / totalDuration) * 100);
      setProgress(pct);
      setProcessingJob(prev => (prev?.id === jobId ? { ...prev, progress: pct } : prev));
      updateNotification(jobId, { progress: pct });
      scheduleNextFrame();
    };
    processFrame();
  };

  const getPreviewStyle = () => {
    if (currentEdit.viewMode !== 'preview')
      return { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' };
    const { crop } = currentEdit;
    const cropW = 100 - crop.l - crop.r;
    const cropH = 100 - crop.t - crop.b;
    const scale = Math.min(100 / cropW, 100 / cropH);
    return {
      transformOrigin: '0 0',
      transform: `scale(${scale}) translate(${-crop.l}%, ${-crop.t}%)`,
      width: '100%',
      height: '100%'
    };
  };

  const selectedElement = currentEdit.elements.find(e => e.id === currentEdit.selectedId);
  const isVideoEdited = edit => {
    if (!edit) return false;
    const hasElements = Array.isArray(edit.elements) && edit.elements.length > 0;
    const hasCrop = edit.crop && (edit.crop.t || edit.crop.b || edit.crop.l || edit.crop.r);
    const hasTrim =
      edit.meta?.duration > 0 &&
      (edit.trim?.start > 0.01 ||
        Math.abs((edit.trim?.end || edit.meta.duration) - edit.meta.duration) > 0.01);
    const segmentSets = normalizeSegmentSets(edit.segmentSets, edit.segments, edit.segmentMode || 'digital');
    const hasSegments = Object.values(segmentSets).some(list => list.length > 0);
    return hasElements || hasCrop || hasTrim || hasSegments;
  };
  const zoomToPoint = (nextZoom, clientX, clientY) => {
    const clampedZoom = clamp(nextZoom, 0.5, 5);
    const viewport = viewportRef.current;
    if (!viewport) {
      setZoom(clampedZoom);
      if (clampedZoom <= 1) setPan({ x: 0, y: 0 });
      return;
    }
    const rect = viewport.getBoundingClientRect();
    const pointX = clientX - rect.left;
    const pointY = clientY - rect.top;
    const worldX = (pointX - pan.x) / zoom;
    const worldY = (pointY - pan.y) / zoom;
    const nextPan = {
      x: pointX - worldX * clampedZoom,
      y: pointY - worldY * clampedZoom
    };
    setZoom(clampedZoom);
    setPan(nextPan);
  };
  const zoomToSelected = nextZoom => {
    const clampedZoom = clamp(nextZoom, 0.5, 5);
    if (!selectedElement || !overlayRef.current || !viewportRef.current) {
      setZoom(clampedZoom);
      if (clampedZoom <= 1) setPan({ x: 0, y: 0 });
      return;
    }
    const overlayRect = overlayRef.current.getBoundingClientRect();
    const viewportRect = viewportRef.current.getBoundingClientRect();
    if (!overlayRect.width || !overlayRect.height) {
      setZoom(clampedZoom);
      return;
    }
    const baseWidth = overlayRect.width / zoom;
    const baseHeight = overlayRect.height / zoom;
    const centerX = ((selectedElement.x + selectedElement.w / 2) / 100) * baseWidth;
    const centerY = ((selectedElement.y + selectedElement.h / 2) / 100) * baseHeight;
    const originLeft = overlayRect.left - pan.x;
    const originTop = overlayRect.top - pan.y;
    const viewportCenterX = viewportRect.left + viewportRect.width / 2;
    const viewportCenterY = viewportRect.top + viewportRect.height / 2;
    const newPan = {
      x: viewportCenterX - originLeft - clampedZoom * centerX,
      y: viewportCenterY - originTop - clampedZoom * centerY
    };
    setZoom(clampedZoom);
    setPan(newPan);
  };
  // Batch Progress: (Total - Queue) / Total
  const batchProgressPercent =
    batchTotal > 0 ? ((batchTotal - batchQueue.length) / batchTotal) * 100 : 0;
  const segmentTotal = activeSegments.length > 0 ? getSegmentTotal(activeSegments) : 0;
  const segmentOffset = segmentTotal > 0 ? getSegmentOffsetForTime(currentTime, activeSegments) : 0;
  const focusHeightValue = Number.isFinite(focusCanvasHeight)
    ? focusCanvasHeight
    : typeof window !== 'undefined'
      ? Math.round(window.innerHeight * 0.8)
      : 600;
  const focusHeightPx = `${focusHeightValue}px`;
  const focusVideoMaxHeight = `${Math.max(240, focusHeightValue - 64)}px`;
  const viewportHeightClass = isFocusMode
    ? ''
    : isCanvasExpanded
      ? 'lg:h-[80vh]'
      : 'lg:h-[60vh]';
  const videoMaxHeight = isFocusMode
    ? focusVideoMaxHeight
    : isCanvasExpanded
      ? 'calc(80vh - 4rem)'
      : 'calc(60vh - 4rem)';
  const sidebarProps = {
    isFocusMode,
    focusSideOpen,
    isDark,
    sidebarWidth,
    onFocusSideClose: () => setFocusSideOpen(false),
    onStartResize: startSidebarResize,
    activeGroupItems,
    filteredPlaylist,
    groupedPlaylist,
    activeGroupKey,
    allCount,
    multiCount,
    isAllSelected,
    searchQuery,
    onSearchChange: setSearchQuery,
    searchInputRef,
    onToggleSelectAll: toggleSelectAll,
    onClearSelection: clearSelection,
    onSelectVisible: selectVisible,
    onSetActiveGroupKey: setActiveGroupKey,
    playlistScrollRef,
    onScroll: handlePlaylistScroll,
    playlist,
    playlistVisibleItems,
    playlistPaddingTop,
    playlistPaddingBottom,
    playlistItemHeight,
    currentId,
    draggingId,
    dragOverId,
    setDraggingId,
    setDragOverId,
    reorderPlaylist,
    switchVideo,
    toggleSelection,
    edits,
    getVideoTooltip,
    getDisplayName,
    getShortId,
    isVideoEdited,
    getVideoChannelBadges,
    removeVideo,
    selectedCount,
    onDeleteSelected: deleteSelectedVideos,
    onFileChange: handleFileChange
  };
  const topBarProps = {
    isFocusMode,
    isDark,
    activeVideo,
    activeSuffix,
    activeSuffixPreset,
    suffixPresets: SUFFIX_PRESETS,
    activeChannelChips,
    currentEdit,
    copiedNameId,
    zoom,
    isCanvasExpanded,
    selectedCount,
    adminLoading,
    onCopyVideoName: copyVideoName,
    onSetVideoSuffix: setVideoSuffix,
    onCopyText: copyText,
    onZoomToSelected: zoomToSelected,
    onToggleCanvasExpand: toggleCanvasExpand,
    onUndo: undo,
    onRedo: redo,
    onToggleViewMode: () =>
      updateCurrentEdit(
        { viewMode: currentEdit.viewMode === 'editor' ? 'preview' : 'editor' },
        false
      ),
    onRunAdminFfmpeg: runAdminFfmpeg,
    onAddVideosFromServer: addVideosFromServer,
    onOpenAdmin: () => setAdminOpen(true),
    onOpenAdminAi: () => {
      setAdminOpen(true);
      setAdminHistoryOpen(false);
    },
    onOpenFocusMenu: () => setFocusSideOpen(true),
    onToggleFocusMode: () => setIsFocusMode(prev => !prev),
    onToggleTheme: () => setIsDark(!isDark)
  };
  const workspaceProps = {
    activeVideo,
    onFileChange: handleFileChange,
    isFocusMode,
    isDark,
    focusHeightPx,
    viewportHeightClass,
    zoom,
    getPreviewStyle,
    onPanStart: startPan,
    onViewportMouseEnter: handleViewportMouseEnter,
    onViewportMouseLeave: handleViewportMouseLeave,
    viewportRef,
    overlayRef,
    videoRef,
    currentEdit,
    currentTime,
    isProcessing,
    processingJob,
    currentId,
    videoMaxHeight,
    onMetadata: handleMetadata,
    onDragStart: startDrag,
    onSelectElement: id => updateCurrentEdit({ selectedId: id }, false),
    onFocusResizeStart: startFocusResize,
    visibleElements,
    selectedElementId: currentEdit.selectedId,
    processedUrl: currentEdit.processedUrl,
    seekStep,
    activeSegments,
    activeSegmentModesMeta,
    activeSegmentMode,
    onSetActiveSegmentMode: setActiveSegmentMode,
    playSegmentsOnly,
    onTogglePlaySegments: () => setPlaySegmentsOnly(prev => !prev),
    togglePlayback,
    isPlaying,
    getPct,
    timelineRef,
    onSeek: handleSeek,
    allSegmentsByMode,
    activeSegmentMeta,
    getSegmentTotal,
    segmentTotal,
    segmentOffset,
    onSegmentSeek: handleSegmentSeek,
    processingVideoRef,
    processingSrc,
    processedUrl: currentEdit.processedUrl,
    selectedCount,
    openFfmpegModal,
    openFfmpegBatchModal,
    toggleNotRelevant,
    addCircle,
    clearSegments,
    segmentDraft,
    setSegmentDraft,
    parseNumericInput,
    segmentStartRef,
    segmentEndRef,
    addSegmentFromDraft,
    updateSegment,
    moveSegment,
    removeSegment,
    selectedElement,
    duplicateElement,
    copyAttributes,
    pasteAttributes,
    copiedAttributes,
    deleteElement,
    updateElement
  };

  return (
    <div
      tabIndex={0}
      className={`flex h-screen overflow-hidden ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
        }`}
    >
      <AppOverlays
        hudText={hudText}
        notifications={notifications}
        isDark={isDark}
        onDismissNotification={removeNotification}
        applyModalOpen={applyModalOpen}
        onApplyCrop={() => applyChanges('crop')}
        onApplyAll={() => applyChanges('all')}
        onCloseApply={() => setApplyModalOpen(false)}
        ffmpegModalOpen={ffmpegModalOpen}
        ffmpegCommand={ffmpegCommand}
        onCopyFfmpegCommand={copyFfmpegCommand}
        onCloseFfmpegModal={() => setFfmpegModalOpen(false)}
        ffmpegBatchModalOpen={ffmpegBatchModalOpen}
        ffmpegBatchScript={ffmpegBatchScript}
        ffmpegBatchSkipped={ffmpegBatchSkipped}
        onCopyFfmpegBatchScript={copyFfmpegBatchScript}
        onCloseFfmpegBatchModal={() => setFfmpegBatchModalOpen(false)}
        adminOpen={adminOpen}
        adminHistoryOpen={adminHistoryOpen}
        adminError={adminError}
        adminHealth={adminHealth}
        adminBaseUrl={adminBaseUrl}
        adminLastRefreshAt={adminLastRefreshAt}
        adminConfig={adminConfig}
        adminLoading={adminLoading}
        adminImportStats={adminImportStats}
        adminAiLoading={adminAiLoading}
        adminAiStats={adminAiStats}
        adminJobProgress={adminJobProgress}
        adminJob={adminJob}
        adminJobs={adminJobs}
        adminSheetFilter={adminSheetFilter}
        adminSheetFiltered={adminSheetFiltered}
        adminSnapshot={adminSnapshot}
        adminShowSnapshot={adminShowSnapshot}
        adminLogoLoading={adminLogoLoading}
        adminLogoStats={adminLogoStats}
        selectedCount={selectedCount}
        activeVideo={activeVideo}
        getJobMeta={getJobMeta}
        parseNumericInput={parseNumericInput}
        onCloseAdmin={() => {
          setAdminOpen(false);
          setAdminHistoryOpen(false);
        }}
        onBaseUrlChange={setAdminBaseUrl}
        onPing={pingAdmin}
        onConfigChange={setAdminConfig}
        onPickFolder={pickAdminFolder}
        onSaveConfig={saveAdminConfig}
        onAddVideos={addVideosFromServer}
        onRunAiSegments={runAdminAiSegments}
        onOpenHistory={() => setAdminHistoryOpen(true)}
        onSelectJob={selectAdminJob}
        onLoadSheet={loadAdminSheet}
        onSheetFilterChange={setAdminSheetFilter}
        onToggleSnapshot={() => setAdminShowSnapshot(prev => !prev)}
        onLoadSnapshot={loadAdminSnapshot}
        onSaveSnapshot={saveAdminSnapshot}
        onApplySnapshot={applyAdminSnapshot}
        onRunLogo={runAdminLogoDetection}
        onCloseHistory={() => setAdminHistoryOpen(false)}
        getJobProgress={getJobProgress}
        onStopJob={stopAdminJob}
      />

      <EditorLayout
        isDark={isDark}
        sidebarProps={sidebarProps}
        topBarProps={topBarProps}
        workspaceProps={workspaceProps}
      />
      <canvas ref={canvasRef} className="hidden" />
    </div >
  );
}
