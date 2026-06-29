import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  DEFAULT_EDIT_STATE,
  MAX_HISTORY,
  RCLONE_FOLDER,
  RCLONE_FLAGS,
  RCLONE_REMOTE,
  SEGMENT_MODES,
  STORAGE_KEYS,
  SUFFIX_PRESETS
} from './lib/editorConstants';
import {
  clamp,
  filterElementsForMode,
  getFileKeyCounts,
  getSegmentOffsetForTime,
  getSegmentsForMode,
  getSuffixForSegmentMode,
  getTimeForSegmentOffset,
  loadFromStorage,
  mergeChannelLists,
  mergeLabelTokens,
  normalizeName,
  normalizeSegmentSets,
  parseNumericInput,
  resolveSegmentModeFromMeta,
  resolveSegmentModeFromSuffix,
  resolveSuffixFromMode,
  saveToStorage,
  updateSegmentsForMode
} from './lib/editorUtils';
import { buildFfmpegLinesFor } from './lib/ffmpeg/buildFfmpegLinesFor';
import useExportProcessing from './features/export/useExportProcessing';
import useBatchAutoExport from './features/export/useBatchAutoExport';
import {
  getExpectedModesForAi,
  getFileKeyVariants,
  getSegmentModeForVideo,
  isAnalogVariant,
  isThermalVariant
} from './features/editor/videoMeta';
import useEditorHotkeys from './features/editor/useEditorHotkeys';
import { normalizeHotkeys } from './features/editor/hotkeys';
import usePlaylistPersistence from './features/playlist/usePlaylistPersistence';
import usePlaylistActions from './features/playlist/usePlaylistActions';
import { buildEditFromSaved, getSavedEditForVideo } from './features/playlist/editRestore';
import AppOverlays from './components/AppOverlays';
import EditorLayout from './components/EditorLayout';
import useAdmin from './hooks/useAdmin';
import usePlaylist from './hooks/usePlaylist';

export default function App() {
  // --- STATE ---
  const [edits, setEdits] = useState({});
  const isSnowVideo = useCallback(video => {
    if (!video) return false;
    if (video.hasSnow) return true;
    const edit = edits?.[video.id];
    const sets = edit?.segmentSets;
    if (sets && typeof sets === 'object') {
      return Object.values(sets).some(
        list => Array.isArray(list) && list.some(seg => !!seg?.isSnow)
      );
    }
    const flat = edit?.segments;
    return Array.isArray(flat) && flat.some(seg => !!seg?.isSnow);
  }, [edits]);
  const isVideoEdited = useCallback(edit => {
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
  }, []);
  const [durationCache, setDurationCache] = useState(() =>
    loadFromStorage(STORAGE_KEYS.durations, {})
  );
  const getDurationKey = useCallback(video => {
    if (!video) return '';
    return video.fileKey || video.id || video.name || '';
  }, []);
  const getVideoDuration = useCallback(
    video => {
      const edit = edits?.[video?.id];
      const duration = edit?.meta?.duration;
      if (Number.isFinite(duration) && duration > 0) return duration;
      const key = getDurationKey(video);
      const cached = key ? durationCache[key] : null;
      return Number.isFinite(cached) ? cached : Number.POSITIVE_INFINITY;
    },
    [edits, durationCache, getDurationKey]
  );
  const isVideoEditedForVideo = useCallback(
    video => isVideoEdited(edits?.[video?.id]),
    [edits, isVideoEdited]
  );
  const [hotkeys, setHotkeys] = useState(() =>
    normalizeHotkeys(loadFromStorage(STORAGE_KEYS.hotkeys, null))
  );
  const [snowSpeed, setSnowSpeed] = useState(1);
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
  const [serverHydrationState, setServerHydrationState] = useState('pending');
  const [importPickerRequest, setImportPickerRequest] = useState(0);
  const [importPickerHandled, setImportPickerHandled] = useState(0);
  const [autoSyncAllowed, setAutoSyncAllowed] = useState(false);
  const hotkeyCaptureRef = useRef(false);
  const serverHydratedRef = useRef(false);
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
    labelOptions,
    activeLabelFilters,
    toggleLabelFilter,
    clearLabelFilters,
    setLabelFilters,
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
    snowCount,
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
  } = usePlaylist({
    suffixPresets: SUFFIX_PRESETS,
    getFileKeyCounts,
    isSnowVideo,
    getVideoDuration,
    isVideoEdited: isVideoEditedForVideo
  });
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
  const overlayRef = useRef(null);
  const viewportRef = useRef(null);
  const timelineRef = useRef(null);
  const segmentStartRef = useRef(null);
  const segmentEndRef = useRef(null);
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
  const lastTimeUiUpdateRef = useRef(0);
  const lastSegmentDragUpdateRef = useRef(0);

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
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const autoSaveEnabledRef = useRef(true);
  useEffect(() => {
    autoSaveEnabledRef.current = autoSaveEnabled;
  }, [autoSaveEnabled]);
  const timeUpdateRafRef = useRef(null);
  const lastTimeUpdateRef = useRef(0);

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
    let labels = Array.isArray(primary.labels) ? primary.labels : [];
    items.forEach(item => {
      channels = mergeChannelLists(channels, item?.channels);
      labels = mergeLabelTokens(labels, item?.labels);
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
      hasSnow: items.some(item => item?.hasSnow),
      labels,
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
  const savedEditsRef = useRef(loadFromStorage(STORAGE_KEYS.edits, {}));

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
  const buildRcloneCopyLine = outputPath =>
    uploadToDrive
      ? `rclone copy "${outputPath}" "${RCLONE_REMOTE}:${RCLONE_FOLDER}" ${RCLONE_FLAGS}`
      : null;
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
        sheetStatus: channel.sheetStatus || video.sheetStatus || '',
        sheetLink: channel.sheetLink || video.sheetLink || ''
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
  const ensureModeVariants = (video, variants, edit) => {
    const existing = new Set(variants.map(item => item.channelMode).filter(Boolean));
    const next = [...variants];
    SEGMENT_MODES.forEach(mode => {
      if (existing.has(mode.id)) return;
      const segs = getSegmentsForMode(edit, mode.id);
      if (!Array.isArray(segs) || segs.length === 0) return;
      next.push({
        ...video,
        channelMode: mode.id,
        suffix: getSuffixForSegmentMode(mode.id)
      });
    });
    return next;
  };
  const buildFfmpegCommand = () => {
    if (!activeVideo) return '';
    const edit = currentEdit || DEFAULT_EDIT_STATE;
    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const variants = ensureModeVariants(
      activeVideo,
      getVideoChannelVariants(activeVideo),
      edit
    );
    const lines = [];
    const outputDirs = new Set();
    const tmpDirs = new Set();
    let finalRenameLine = null;
    const splitBySnow = (segments, mode) => {
      const supportsSnow = true;
      if (!Array.isArray(segments) || segments.length === 0) {
        return { supportsSnow, hasAny: false, normal: [], snow: [] };
      }
      const snow = segments.filter(seg => !!seg?.isSnow);
      const normal = segments.filter(seg => !seg?.isSnow);
      return { supportsSnow, hasAny: true, normal, snow };
    };
    variants.forEach(variant => {
      const modeSegments = getSegmentsForMode(edit, variant.channelMode);
      const { supportsSnow, hasAny, normal, snow } = splitBySnow(modeSegments, variant.channelMode);
      const jobs = [];
      if (!hasAny) {
        jobs.push({ video: variant, segmentsOverride: undefined, labelSuffix: '' });
      } else {
        if (normal.length > 0) jobs.push({ video: variant, segmentsOverride: normal, labelSuffix: '' });
        if (supportsSnow && snow.length > 0) {
          jobs.push({
            video: { ...variant, suffix: `${variant.suffix || ''}_snow` },
            segmentsOverride: snow,
            labelSuffix: 'snow'
          });
        }
      }
      jobs.forEach(job => {
        const allowRenameOriginal = allowDoneForVideo(job.video, fileKeyCounts, fileKeyVariants);
        const result = buildFfmpegLinesFor(job.video, edit, {
          useBatchSuffix: false,
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
        if (result.error) return;
        if (result.renameLine) finalRenameLine = result.renameLine;
        if (result.needsOutputDir !== false) {
          const outDir = result.outputDir || 'cutted';
          outputDirs.add(outDir);
          if (result.usesTemp) tmpDirs.add(result.tmpDir || `${outDir}/_tmp`);
        }
        if (variants.length > 1 || jobs.length > 1) {
          const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
          const suffixLabel = job.video.suffix || variant.suffix || 'без суфіксу';
          lines.push(
            `# ${variant.name || variant.id} (${label || suffixLabel}${job.labelSuffix ? ` • ${job.labelSuffix}` : ''})`
          );
        }
        lines.push(...result.lines);
        lines.push('');
      });
    });
    if (finalRenameLine) {
      lines.push(finalRenameLine);
      lines.push('');
    }
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
      const variants = ensureModeVariants(video, getVideoChannelVariants(video), edit);
      let finalRenameLine = null;
      variants.forEach(variant => {
        const modeSegments = getSegmentsForMode(edit, variant.channelMode);
        const supportsSnow = true;
        const snow = Array.isArray(modeSegments) ? modeSegments.filter(seg => !!seg?.isSnow) : [];
        const normal = Array.isArray(modeSegments) ? modeSegments.filter(seg => !seg?.isSnow) : [];
        const hasAny = Array.isArray(modeSegments) && modeSegments.length > 0;
        const jobs = [];
        if (!hasAny) {
          jobs.push({ video: variant, segmentsOverride: undefined, labelSuffix: '' });
        } else {
          if (normal.length > 0) jobs.push({ video: variant, segmentsOverride: normal, labelSuffix: '' });
          if (supportsSnow && snow.length > 0) {
            jobs.push({
              video: { ...variant, suffix: `${variant.suffix || ''}_snow` },
              segmentsOverride: snow,
              labelSuffix: 'snow'
            });
          }
        }
        jobs.forEach(job => {
          const allowRenameOriginal = allowDoneForVideo(job.video, fileKeyCounts, fileKeyVariants);
          const result = buildFfmpegLinesFor(job.video, edit, {
            useBatchSuffix: true,
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
          if (result.renameLine) finalRenameLine = result.renameLine;
          if (result.usesTemp) needsTemp = true;
          if (result.needsOutputDir !== false) {
            const outDir = result.outputDir || 'cutted';
            outputDirs.add(outDir);
            if (result.usesTemp) tmpDirs.add(result.tmpDir || `${outDir}/_tmp`);
          }
          const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
          const suffixLabel = job.video.suffix || variant.suffix || 'без суфіксу';
          lines.push(`# ${job.video.name || job.video.id} (${label || suffixLabel}${job.labelSuffix ? ` • ${job.labelSuffix}` : ''})`);
          lines.push(...result.lines);
          lines.push('');
        });
      });
      if (finalRenameLine) {
        lines.push(finalRenameLine);
        lines.push('');
      }
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
    } catch {
      window.prompt('Скопіюйте команду вручну:', ffmpegCommand);
    }
  };
  const copyFfmpegBatchScript = async () => {
    if (!ffmpegBatchScript) return;
    try {
      await navigator.clipboard.writeText(ffmpegBatchScript);
      showHud("Скрипт скопійовано");
    } catch {
      window.prompt('Скопіюйте скрипт вручну:', ffmpegBatchScript);
    }
  };
  const copyText = async (value, label) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showHud(label || "Скопійовано");
    } catch {
      window.prompt('Скопіюйте вручну:', value);
    }
  };
  const copyVideoName = async (name, id) => {
    if (!name) return;
    try {
      await navigator.clipboard.writeText(name);
    } catch {
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
    adminAiQueue,
    adminAiLastRequestAt,
    adminAiLastError,
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
    saveAdminConfig,
    saveAdminSnapshot,
    applyAdminSnapshot,
    applySnapshotPayload,
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
      getVideoOutputDir,
      getVideoDoneDir,
      getSegmentModeForVideo,
      buildRcloneCopyLine,
      getExpectedModesForAi
    },
    autoSyncEnabled: serverHydrationState !== 'pending' && autoSyncAllowed
  });

  const applySnapshotPayloadRef = useRef(applySnapshotPayload);
  useEffect(() => {
    applySnapshotPayloadRef.current = applySnapshotPayload;
  }, [applySnapshotPayload]);

  const hasServerSnapshotData = payload => {
    if (!payload || typeof payload !== 'object') return false;
    const playlist = Array.isArray(payload.playlist) ? payload.playlist : [];
    return playlist.length > 0;
  };

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      serverHydratedRef.current = false;
      const localSnapshot = {
        playlist: loadFromStorage(STORAGE_KEYS.playlist, []),
        edits: loadFromStorage(STORAGE_KEYS.edits, {})
      };
      const hasLocalPlaylist =
        Array.isArray(localSnapshot.playlist) && localSnapshot.playlist.length > 0;
      if (!adminBaseUrl) {
        setServerHydrationState('failed');
        return;
      }
      setServerHydrationState('pending');
      const data = await loadAdminSnapshot();
      if (cancelled) return;
      if (data?.ok && data.payload && hasServerSnapshotData(data.payload)) {
        applySnapshotPayloadRef.current?.(data.payload);
        serverHydratedRef.current = true;
        setServerHydrationState('done');
        return;
      }
      if (hasLocalPlaylist) {
        applySnapshotPayloadRef.current?.(localSnapshot);
        showHud("Сервер порожній або недоступний — беру локальні дані");
      } else {
        showHud("Сервер порожній або недоступний");
      }
      setServerHydrationState('failed');
    };
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [adminBaseUrl, loadAdminSnapshot]);

  const { idbPutVideo, idbDeleteVideo } = usePlaylistPersistence({
    savedEditsRef,
    buildEditFromSaved,
    getSavedEditForVideo,
    dedupePlaylistAndEdits,
    getFileKeyCounts,
    setPlaylist,
    setEdits,
    currentId,
    setCurrentId,
    playlist,
    playlistRef,
    currentEdit,
    buildServerFileUrl,
    showHud,
    disableIdb: true,
    localHydrationEnabled: serverHydrationState === 'failed',
    autoSaveEnabled
  });

  const {
    isProcessing,
    processingJob,
    processingSrc,
    notifications,
    canvasRef,
    processingVideoRef,
    removeNotification,
    startProcessing
  } = useExportProcessing({
    activeVideo,
    currentEdit,
    currentId,
    playlistRef,
    setPlaylist,
    setEdits,
    savedEditsRef,
    setSegmentDraft,
    showHud,
    isBatchMode,
    batchSuffix,
    setBatchQueue,
    queueServerRename,
    allowDoneForVideo,
    getFileKeyVariants,
    getSegmentModeForVideo,
    idbPutVideo,
    idbDeleteVideo
  });

  useBatchAutoExport({
    isBatchMode,
    batchQueue,
    setIsBatchMode,
    currentId,
    switchVideo,
    isProcessing,
    activeVideo,
    currentEdit,
    processingVideoRef,
    startProcessing
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
    if (typeof prefs.snowSpeed === 'number' && Number.isFinite(prefs.snowSpeed)) {
      setSnowSpeed(Math.min(3, Math.max(0.25, prefs.snowSpeed)));
    }
    if (typeof prefs.autoSyncAllowed === 'boolean') {
      setAutoSyncAllowed(prefs.autoSyncAllowed);
    }
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.prefs, {
      isDark,
      batchSuffix,
      seekStep,
      uploadToDrive,
      sidebarWidth,
      adminBaseUrl,
      overwriteOutputs,
      snowSpeed,
      autoSyncAllowed
    });
  }, [
    isDark,
    batchSuffix,
    seekStep,
    uploadToDrive,
    sidebarWidth,
    adminBaseUrl,
    overwriteOutputs,
    snowSpeed,
    autoSyncAllowed
  ]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.hotkeys, hotkeys);
  }, [hotkeys]);
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.durations, durationCache);
  }, [durationCache]);
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
  const activeSegments = useMemo(
    () => getSegmentsForMode(currentEdit, activeSegmentMode),
    [currentEdit.segmentSets, currentEdit.segments, activeSegmentMode]
  );
  const cycleSegmentChannelForId = useCallback(
    segmentId => {
      if (!segmentId) return;
      const currentMode = activeSegmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
      const available = Array.isArray(activeSegmentModes) && activeSegmentModes.length > 0
        ? activeSegmentModes
        : SEGMENT_MODES.map(mode => mode.id);
      const currentIndex = available.indexOf(currentMode);
      if (currentIndex === -1 || available.length <= 1) return;
      const nextMode = available[(currentIndex + 1) % available.length];
      if (!nextMode || nextMode === currentMode) return;
      const baseSets = normalizeSegmentSets(
        currentEdit.segmentSets,
        currentEdit.segments,
        currentMode
      );
      const currentSegments = baseSets[currentMode] || [];
      const seg = currentSegments.find(item => item.id === segmentId);
      if (!seg) return;
      const nextCurrent = currentSegments.filter(item => item.id !== segmentId);
      const targetSegments = baseSets[nextMode] || [];
      const nextTarget = [...targetSegments, { ...seg }].sort((a, b) => a.start - b.start);
      const nextSets = {
        ...baseSets,
        [currentMode]: nextCurrent,
        [nextMode]: nextTarget
      };
      const nextState = {
        segmentSets: nextSets
      };
      if (currentEdit.segmentMode === currentMode) nextState.segments = nextCurrent;
      if (currentEdit.segmentMode === nextMode) nextState.segments = nextTarget;
      updateCurrentEdit(nextState, true);
      setActiveSegmentId(segmentId);
      showHud(`Сегмент → ${SEGMENT_MODES.find(item => item.id === nextMode)?.label || nextMode}`);
    },
    [activeSegmentMode, activeSegmentModes, activeVideo, currentEdit, updateCurrentEdit]
  );
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

  const { handleFileChange, removeVideo, deleteSelectedVideos } = usePlaylistActions({
    playlistRef,
    setPlaylist,
    setEdits,
    currentId,
    setCurrentId,
    savedEditsRef,
    idbPutVideo,
    showHud,
    loadSheetMap
  });

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

  function switchVideo(id) {
    setIsPlaying(false);
    setCurrentId(id);
    setZoom(1); // Reset zoom on switch
    setPan({ x: 0, y: 0 });
    if (videoRef.current) videoRef.current.pause();
  }

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
    if (duration > 0) {
      const cacheKey = getDurationKey(activeVideo);
      if (cacheKey) {
        setDurationCache(prev => {
          if (prev?.[cacheKey] === duration) return prev;
          return { ...prev, [cacheKey]: duration };
        });
      }
    }
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
    lastTimeUpdateRef.current = videoRef.current.currentTime;
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
    lastTimeUpdateRef.current = nextTime;
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
      const time = vid.currentTime;
      if (Math.abs(time - lastTimeUpdateRef.current) < 0.02) return;
      lastTimeUpdateRef.current = time;
      if (timeUpdateRafRef.current) return;
      timeUpdateRafRef.current = requestAnimationFrame(() => {
        timeUpdateRafRef.current = null;
        const now = performance.now();
        if (now - lastTimeUiUpdateRef.current >= 33) {
          lastTimeUiUpdateRef.current = now;
          setCurrentTime(lastTimeUpdateRef.current);
        }
        if (playSegmentsOnlyRef.current && isPlayingRef.current) handleSegmentPlayback(vid);
      });
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
      if (timeUpdateRafRef.current) {
        cancelAnimationFrame(timeUpdateRafRef.current);
        timeUpdateRafRef.current = null;
      }
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

  const toggleSegmentSnowAtTime = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !currentEdit) return;
    const mode =
      activeSegmentMode ||
      currentEdit.segmentMode ||
      getSegmentModeForVideo(activeVideo) ||
      'digital';
    const segments = getSegmentsForMode(currentEdit, mode);
    if (!segments.length) {
      showHud("Немає сегментів");
      return;
    }
    const t = vid.currentTime;
    const target = segments.find(seg => t >= seg.start && t <= seg.end);
    if (!target) {
      showHud("Немає сегмента під курсором");
      return;
    }
    const nextSegments = segments.map(seg =>
      seg.id === target.id ? { ...seg, isSnow: !seg.isSnow } : seg
    );
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
    showHud(target.isSnow ? "Snow знято" : "Snow додано");
  }, [activeSegmentMode, activeVideo, currentEdit, getSegmentModeForVideo, showHud, updateCurrentEdit]);
  const findSegmentAtTime = useCallback(() => {
    const mode = currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
    const segments = getSegmentsForMode(currentEdit, mode);
    if (!segments.length) return { mode, target: null, segments };
    const t = videoRef.current?.currentTime ?? currentTime;
    const target = segments.find(seg => t >= seg.start && t <= seg.end) || null;
    return { mode, target, segments };
  }, [activeVideo, currentEdit, currentTime, getSegmentModeForVideo]);
  const cycleSegmentChannelAtTime = useCallback(() => {
    const { mode: currentMode, target } = findSegmentAtTime();
    if (!target) {
      showHud("Немає сегмента під курсором");
      return;
    }
    cycleSegmentChannelForId(target.id);
  }, [findSegmentAtTime, cycleSegmentChannelForId, showHud]);
  const deleteSegmentAtTime = useCallback(() => {
    const { mode, target, segments } = findSegmentAtTime();
    if (!target) {
      showHud("Немає сегмента під курсором");
      return;
    }
    const nextSegments = segments.filter(seg => seg.id !== target.id);
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
    setActiveSegmentId(null);
    showHud("Сегмент видалено");
  }, [findSegmentAtTime, currentEdit, showHud, updateCurrentEdit]);

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

  function removeSegment(id) {
    const mode = getActiveSegmentMode();
    const nextSegments = getSegmentsForMode(currentEdit, mode).filter(seg => seg.id !== id);
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
  }
  useEditorHotkeys({
    hotkeys,
    hotkeyCaptureRef,
    altDownRef,
    altUsedWithOtherRef,
    spacePanRef,
    viewportHoverRef,
    searchInputRef,
    videoRef,
    activeVideo,
    isProcessing,
    processingJob,
    currentId,
    currentEdit,
    activeSegmentMode,
    seekStep,
    setCurrentTime,
    setIsFocusMode,
    setFocusSideOpen,
    undo,
    redo,
    cycleSegmentMode,
    cycleSegmentChannelForId,
    cycleSegmentChannelAtTime,
    cycleSeekStep,
    addSegmentFromDraft,
    addRect,
    updateElement,
    setSegmentDraft,
    toggleSegmentSnowAtTime,
    togglePlayback,
    copyAttributes,
    pasteAttributes,
    deleteElement,
    deleteSegment: removeSegment,
    deleteSegmentAtTime,
    activeSegmentId,
    showHud
  });

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
          const nowSeg = performance.now();
          if (nowSeg - lastSegmentDragUpdateRef.current < 33) return;
          lastSegmentDragUpdateRef.current = nowSeg;
          const rect = timelineRef.current.getBoundingClientRect();
          const deltaTime =
            ((clientX - startPos.current.x) / rect.width) * edit.meta.duration;
          const segStart = startState.current.start;
          const segEnd = startState.current.end;
          const segLen = segEnd - segStart;
          const applySegmentPreview = nextSeg => {
            const duration = edit.meta.duration;
            if (!duration) return;
            const left = (nextSeg.start / duration) * 100;
            const width = ((nextSeg.end - nextSeg.start) / duration) * 100;
            const selector = `[data-seg-id="${target.id}"][data-seg-mode="${target.mode}"]`;
            const el = timelineRef.current?.querySelector(selector);
            if (!el) return;
            el.style.left = `${left}%`;
            el.style.width = `${width}%`;
          };

          if (target.action === 'move') {
            let newStart = segStart + deltaTime;
            newStart = clamp(newStart, 0, edit.meta.duration - segLen);
            const newEnd = newStart + segLen;
            const nextSeg = { start: newStart, end: newEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            applySegmentPreview(nextSeg);
          } else if (target.action === 'resize-start') {
            const newStart = clamp(segStart + deltaTime, 0, segEnd - 0.1);
            const nextSeg = { start: newStart, end: segEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            applySegmentPreview(nextSeg);
          } else if (target.action === 'resize-end') {
            const newEnd = clamp(segEnd + deltaTime, segStart + 0.1, edit.meta.duration);
            const nextSeg = { start: segStart, end: newEnd };
            segmentPreviewRef.current.set(target.id, nextSeg);
            applySegmentPreview(nextSeg);
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
        if (latest) updateSegment(target.id, latest, true);
        setActiveSegmentId(target.id);
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
      if (!autoSaveEnabledRef.current) setAutoSaveEnabled(true);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  function startPan(e, force = false) {
    if (currentEdit.viewMode !== 'editor') return;
    const wantsPan = force || spacePanRef.current || e.button === 1 || e.button === 2;
    if (!wantsPan && zoom <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    if (autoSaveEnabledRef.current) setAutoSaveEnabled(false);
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
    if (autoSaveEnabledRef.current) setAutoSaveEnabled(false);
    isDragging.current = true;
    dragTarget.current = targetInfo;
    if (targetInfo?.type === 'segment') setActiveSegmentId(targetInfo.id);
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
      dragTarget.current.mode = mode;
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
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = e => handleWheelZoom(e);
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [handleWheelZoom]);

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
  const zoomToPoint = (nextZoom, clientX, clientY) => {
    const clampedZoom = clamp(nextZoom, 0.5, 5);
    const overlay = overlayRef.current;
    if (!overlay) {
      setZoom(clampedZoom);
      if (clampedZoom <= 1) setPan({ x: 0, y: 0 });
      return;
    }
    const overlayRect = overlay.getBoundingClientRect();
    const baseLeft = overlayRect.left - pan.x;
    const baseTop = overlayRect.top - pan.y;
    const worldX = (clientX - overlayRect.left) / zoom;
    const worldY = (clientY - overlayRect.top) / zoom;
    const nextPan = {
      x: clientX - baseLeft - worldX * clampedZoom,
      y: clientY - baseTop - worldY * clampedZoom
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
  const fitCanvas = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    showHud('Відео вписано в робочу область');
  };
  const segmentTotal = useMemo(
    () => (activeSegments.length > 0 ? getSegmentTotal(activeSegments) : 0),
    [activeSegments]
  );
  const segmentOffset = useMemo(
    () => (segmentTotal > 0 ? getSegmentOffsetForTime(currentTime, activeSegments) : 0),
    [segmentTotal, currentTime, activeSegments]
  );
  const focusHeightValue = Number.isFinite(focusCanvasHeight)
    ? focusCanvasHeight
    : typeof window !== 'undefined'
      ? Math.round(window.innerHeight * 0.8)
      : 600;
  const focusHeightPx = `${focusHeightValue}px`;
  const focusVideoMaxHeight = `${Math.max(240, focusHeightValue - 64)}px`;
  const viewportHeightClass = isFocusMode ? '' : 'h-full';
  const videoMaxHeight = isFocusMode
    ? focusVideoMaxHeight
    : isCanvasExpanded
      ? 'calc(100vh - 190px)'
      : 'calc(100vh - 250px)';
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
    snowCount,
    isAllSelected,
    searchQuery,
    onSearchChange: setSearchQuery,
    searchInputRef,
    labelOptions,
    activeLabelFilters,
    onLabelFiltersChange: setLabelFilters,
    onClearLabelFilters: clearLabelFilters,
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
    adminSyncState,
    onCopyVideoName: copyVideoName,
    onSetVideoSuffix: setVideoSuffix,
    onCopyText: copyText,
    onZoomToSelected: zoomToSelected,
    onFitCanvas: fitCanvas,
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
    onOpenImportPicker: () => {
      setAdminOpen(true);
      setImportPickerRequest(prev => prev + 1);
    },
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
    onZoomToSelected: zoomToSelected,
    onFitCanvas: fitCanvas,
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
	    selectedCount,
	    openFfmpegModal,
	    openFfmpegBatchModal,
    toggleNotRelevant,
    addRect,
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
    activeSegmentId,
    setActiveSegmentId,
    onCycleSegmentChannel: cycleSegmentChannelForId,
    selectedElement,
    duplicateElement,
	    copyAttributes,
	    pasteAttributes,
	    copiedAttributes,
	    deleteElement,
	    updateElement,
      hotkeys,
      setHotkeys,
      hotkeyCaptureRef,
      snowSpeed,
      setSnowSpeed
	  };

	  return (
	    <div
	      tabIndex={0}
	      className={`flex h-screen overflow-hidden ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
	        }`}
        style={{ '--snow-speed': snowSpeed }}
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
        adminAiQueue={adminAiQueue}
        adminAiLastRequestAt={adminAiLastRequestAt}
        adminAiLastError={adminAiLastError}
        adminAiRemoteState={adminAiRemoteState}
        adminJobProgress={adminJobProgress}
        adminJob={adminJob}
        adminJobs={adminJobs}
        adminSheetFilter={adminSheetFilter}
        adminSheetFiltered={adminSheetFiltered}
        adminSnapshot={adminSnapshot}
    adminShowSnapshot={adminShowSnapshot}
    adminLogoLoading={adminLogoLoading}
    adminLogoStats={adminLogoStats}
        adminSyncState={adminSyncState}
        importPickerRequest={importPickerRequest}
        importPickerHandled={importPickerHandled}
        onImportPickerHandled={setImportPickerHandled}
        autoSyncAllowed={autoSyncAllowed}
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
        onRunClipchampExport={runAdminClipchampExport}
        onRunAiSegmentsRemote={runAdminAiSegmentsRemote}
        onPingAiRemote={pingAdminAiRemote}
        onStopAi={stopAdminAi}
        onRetryAiFailed={retryAdminAiFailed}
        onOpenHistory={() => setAdminHistoryOpen(true)}
        onSelectJob={selectAdminJob}
        onLoadSheet={loadAdminSheet}
        onSheetFilterChange={setAdminSheetFilter}
        onToggleSnapshot={() => setAdminShowSnapshot(prev => !prev)}
        onLoadSnapshot={loadAdminSnapshot}
    onSaveSnapshot={saveAdminSnapshot}
    onApplySnapshot={applyAdminSnapshot}
    onToggleAutoSync={() => setAutoSyncAllowed(prev => !prev)}
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
