import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  Scissors,
  Upload,
  Video,
  Square,
  Circle,
  Trash2,
  Eye,
  EyeOff,
  Film,
  Plus,
  Clock,
  Layers,
  Save,
  Target,
  Copy,
  Clipboard,
  Repeat,
  Moon,
  Sun,
  ShieldCheck,
  CheckSquare,
  Square as SquareIcon,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  BoxSelect,
  Settings,
  Menu,
  Bot
} from 'lucide-react';

export default function App() {
  // --- GEMINI API CONFIG ---
  const apiKey = "";

  // --- STATE ---
  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState(null);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [activeGroupKey, setActiveGroupKey] = useState('__none__');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusSideOpen, setFocusSideOpen] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminBaseUrl, setAdminBaseUrl] = useState('http://localhost:7071');
  const [adminHealth, setAdminHealth] = useState(null);
  const [adminSheet, setAdminSheet] = useState(null);
  const [adminSnapshot, setAdminSnapshot] = useState(null);
  const DEFAULT_ADMIN_CONFIG = {
    baseDir: '',
    aiModelPath: '',
    aiPythonPath: '',
    aiFps: 1,
    aiMinDuration: 2,
    logoTemplatePath: 'image.png',
    logoFps: 2,
    logoSize: 640,
    logoThreshold: 0.55,
    logoMinDuration: 0.5,
    logoMaxMatches: 5,
    logoMaxGap: 0.5,
    logoScales: '0.9,1.0,1.1',
    sheetId: '1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ',
    sheetGid: '1633760181'
  };
  const [adminConfig, setAdminConfig] = useState(DEFAULT_ADMIN_CONFIG);
  const [adminJobs, setAdminJobs] = useState([]);
  const [adminJob, setAdminJob] = useState(null);
  const [adminJobId, setAdminJobId] = useState('');
  const [adminJobExpectedDuration, setAdminJobExpectedDuration] = useState(null);
  const [adminAutoRefresh, setAdminAutoRefresh] = useState(true);
  const [overwriteOutputs, setOverwriteOutputs] = useState(false);
  const [adminHistoryOpen, setAdminHistoryOpen] = useState(false);
  const [adminSheetFilter, setAdminSheetFilter] = useState('');
  const [adminShowSnapshot, setAdminShowSnapshot] = useState(false);
  const [adminImportStats, setAdminImportStats] = useState(null);
  const [adminLastRefreshAt, setAdminLastRefreshAt] = useState(null);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminAiLoading, setAdminAiLoading] = useState(false);
  const [adminAiStats, setAdminAiStats] = useState(null);
  const [adminLogoLoading, setAdminLogoLoading] = useState(false);
  const [adminLogoStats, setAdminLogoStats] = useState(null);
  const [playlistScrollTop, setPlaylistScrollTop] = useState(0);
  const [playlistViewportHeight, setPlaylistViewportHeight] = useState(0);
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
  const sheetMapRef = useRef(null);
  const sheetMapPromiseRef = useRef(null);
  const adminJobExpectedMapRef = useRef(new Map());
  const adminJobStatusRef = useRef(new Map());
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
  const searchInputRef = useRef(null);
  const playlistScrollRef = useRef(null);
  const segmentStartRef = useRef(null);
  const segmentEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const stopLoopRef = useRef(null);
  const cancelProcessingRef = useRef(false);
  const altDownRef = useRef(false);
  const altUsedWithOtherRef = useRef(false);
  const playSegmentsOnlyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const lastSnapshotRef = useRef('');
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

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [segmentDraft, setSegmentDraft] = useState({ start: null, end: null });

  // --- HELPERS ---
  const activeVideo = useMemo(
    () => playlist.find(v => v.id === currentId),
    [playlist, currentId]
  );

  const MAX_HISTORY = 20;

  const defaultEditState = {
    trim: { start: 0, end: 0 },
    crop: { t: 0, b: 0, l: 0, r: 0 },
    elements: [],
    segments: [],
    segmentMode: 'digital',
    segmentSets: {
      digital: [],
      analog: [],
      thermal_digital: [],
      thermal_analog: []
    },
    selectedId: null,
    processedUrl: null,
    processedExt: null,
    viewMode: 'editor',
    meta: { duration: 0, width: 0, height: 0 },
    history: [],
    future: []
  };

  const currentEdit = edits[currentId] || defaultEditState;
  const STORAGE_KEYS = {
    edits: 'videoCut.edits.v1',
    prefs: 'videoCut.prefs.v1',
    playlist: 'videoCut.playlist.v1'
  };
  const SUFFIX_PRESETS = ['_crop_digital', '_crop_analog', '_thermal_digital', '_thermal_analog'];
  const SEGMENT_MODES = [
    {
      id: 'digital',
      label: 'Digital',
      dot: 'bg-emerald-500',
      track: 'bg-emerald-500/70 border-emerald-300/40',
      handle: 'bg-emerald-200 border-emerald-600',
      active: 'bg-emerald-600 border-emerald-500 text-white'
    },
    {
      id: 'analog',
      label: 'Analog',
      dot: 'bg-sky-500',
      track: 'bg-sky-500/70 border-sky-300/40',
      handle: 'bg-sky-200 border-sky-600',
      active: 'bg-sky-600 border-sky-500 text-white'
    },
    {
      id: 'thermal_digital',
      label: 'Thermal D',
      dot: 'bg-emerald-800',
      track: 'bg-emerald-800/70 border-emerald-600/50',
      handle: 'bg-emerald-400 border-emerald-800',
      active: 'bg-emerald-800 border-emerald-600 text-white'
    },
    {
      id: 'thermal_analog',
      label: 'Thermal A',
      dot: 'bg-blue-800',
      track: 'bg-blue-800/70 border-blue-600/50',
      handle: 'bg-blue-300 border-blue-800',
      active: 'bg-blue-800 border-blue-600 text-white'
    }
  ];
  const activeSuffix = activeVideo?.suffix || '';
  const activeSuffixPreset = SUFFIX_PRESETS.includes(activeSuffix) ? activeSuffix : null;
  const RCLONE_REMOTE = 'gdrive';
  const RCLONE_FOLDER = '22.12.2025 [ATV&Drone]';
  const getSheetCsvUrl = (config) => {
    const id = config?.sheetId || SHEET_ID;
    const gid = config?.sheetGid || SHEET_GID;
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  };
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
  const normalizeCropPx = (crop, meta) => {
    const width = meta.width || 0;
    const height = meta.height || 0;
    if (!width || !height) return { x: 0, y: 0, w: 0, h: 0 };
    let lPx = Math.floor((crop.l / 100) * width);
    let rPx = Math.floor((crop.r / 100) * width);
    let tPx = Math.floor((crop.t / 100) * height);
    let bPx = Math.floor((crop.b / 100) * height);
    lPx = clamp(lPx, 0, width - 1);
    rPx = clamp(rPx, 0, width - 1);
    tPx = clamp(tPx, 0, height - 1);
    bPx = clamp(bPx, 0, height - 1);
    if (lPx + rPx >= width) rPx = Math.max(0, width - lPx - 1);
    if (tPx + bPx >= height) bPx = Math.max(0, height - tPx - 1);
    return {
      x: lPx,
      y: tPx,
      w: Math.max(1, width - lPx - rPx),
      h: Math.max(1, height - tPx - bPx)
    };
  };
  const loadFromStorage = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  };
  const parseNumericInput = value => {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    const normalized = String(value).trim().replace(',', '.');
    if (normalized === '') return NaN;
    return Number(normalized);
  };
  const normalizeName = value => String(value || '').trim().toLowerCase();
  const suffixOptions = useMemo(() => {
    const known = new Set(SUFFIX_PRESETS);
    playlist.forEach(item => {
      if (item?.suffix) known.add(item.suffix);
    });
    return Array.from(known);
  }, [playlist]);
  const parseCsv = text => {
    const rows = [];
    let row = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (char === '"' && next === '"') {
          current += '"';
          i += 1;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current);
        current = '';
      } else if (char === '\n') {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      } else if (char === '\r') {
        continue;
      } else {
        current += char;
      }
    }
    row.push(current);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    return rows;
  };
  const saveToStorage = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { }
  };
  const getFileKey = file => `${file.name}|${file.size}|${file.lastModified}`;
  const getDefaultSegmentSets = () => ({
    digital: [],
    analog: [],
    thermal_digital: [],
    thermal_analog: []
  });
  const normalizeSegmentSets = (segmentSets, fallbackSegments, fallbackMode = 'digital') => {
    if (segmentSets && typeof segmentSets === 'object') {
      return {
        digital: Array.isArray(segmentSets.digital) ? segmentSets.digital : [],
        analog: Array.isArray(segmentSets.analog) ? segmentSets.analog : [],
        thermal_digital: Array.isArray(segmentSets.thermal_digital) ? segmentSets.thermal_digital : [],
        thermal_analog: Array.isArray(segmentSets.thermal_analog) ? segmentSets.thermal_analog : []
      };
    }
    const base = getDefaultSegmentSets();
    if (Array.isArray(fallbackSegments) && fallbackSegments.length > 0) {
      base[fallbackMode] = fallbackSegments;
    }
    return base;
  };
  const getSegmentsForMode = (edit, mode) => {
    if (!edit) return [];
    const resolvedMode = mode || edit.segmentMode || 'digital';
    const sets = normalizeSegmentSets(edit.segmentSets, edit.segments, resolvedMode);
    return sets[resolvedMode] || [];
  };
  const updateSegmentsForMode = (edit, mode, nextSegments) => {
    const resolvedMode = mode || edit.segmentMode || 'digital';
    const sets = normalizeSegmentSets(edit.segmentSets, edit.segments, resolvedMode);
    return { ...sets, [resolvedMode]: nextSegments };
  };
  const resolveSegmentModeFromMeta = (mode, cameraType) => {
    const value = normalizeName(mode);
    const camera = normalizeName(cameraType);
    const isThermal = camera.includes('thermal') || camera.includes('infrared');
    if (isThermal && value.includes('analog')) return 'thermal_analog';
    if (isThermal && value.includes('digital')) return 'thermal_digital';
    if (isThermal) return 'thermal_digital';
    if (value.includes('analog')) return 'analog';
    if (value.includes('digital')) return 'digital';
    return '';
  };
  const resolveSegmentModeFromSuffix = suffix => {
    const value = normalizeName(suffix);
    if (value.includes('thermal') && value.includes('analog')) return 'thermal_analog';
    if (value.includes('thermal') && value.includes('digital')) return 'thermal_digital';
    if (value.includes('thermal')) return 'thermal_digital';
    if (value.includes('analog')) return 'analog';
    if (value.includes('digital')) return 'digital';
    return '';
  };
  const getSuffixForSegmentMode = mode => {
    switch (mode) {
      case 'thermal_analog':
        return '_thermal_analog';
      case 'thermal_digital':
        return '_thermal_digital';
      case 'analog':
        return '_crop_analog';
      case 'digital':
        return '_crop_digital';
      default:
        return '';
    }
  };
  const sortChannels = channels => {
    if (!Array.isArray(channels)) return [];
    const order = SEGMENT_MODES.map(mode => mode.id);
    return [...channels].sort(
      (a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)
    );
  };
  const buildChannelsFromEntries = entries => {
    if (!Array.isArray(entries) || entries.length === 0) return [];
    const byMode = new Map();
    entries.forEach(entry => {
      if (!entry) return;
      const mode = resolveSegmentModeFromMeta(entry.analogDigital, entry.cameraType);
      if (!mode || byMode.has(mode)) return;
      byMode.set(mode, {
        mode,
        suffix: resolveSuffixFromMode(entry.analogDigital, entry.cameraType),
        sheetMode: entry.analogDigital || '',
        sheetCameraType: entry.cameraType || '',
        sheetStatus: entry.status || '',
        sheetRow: entry.rowIndex || null
      });
    });
    return sortChannels(Array.from(byMode.values()));
  };
  const mergeChannelLists = (base, incoming) => {
    const next = new Map();
    (base || []).forEach(item => {
      if (item?.mode) next.set(item.mode, item);
    });
    (incoming || []).forEach(item => {
      if (item?.mode && !next.has(item.mode)) next.set(item.mode, item);
    });
    return sortChannels(Array.from(next.values()));
  };
  const getServerFileKey = (baseDir, relativePath, size, mtimeMs) =>
    `server:${baseDir}|${relativePath}|${size}|${mtimeMs}`;
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
    const baseEdit = baseEntry.edit || defaultEditState;
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
      ...defaultEditState,
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
  const getJobFileName = command => {
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
  };
  const getJobMeta = job => {
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
  };
  const getJobProgress = job => {
    if (!job) return null;
    const expected =
      adminJobExpectedMapRef.current.get(job.id) ??
      (job.id === adminJob?.id ? adminJobExpectedDuration : null);
    if (job.status === 'done') return 100;
    if (!expected || expected <= 0) return null;
    const elapsed = extractFfmpegTime(job.log || '');
    if (elapsed === null) return null;
    return Math.min(100, (elapsed / expected) * 100);
  };
  const buildEditFromSaved = saved => {
    if (!saved) return null;
    const segmentMode = saved.segmentMode || 'digital';
    const segmentSets = normalizeSegmentSets(saved.segmentSets, saved.segments, segmentMode);
    return {
      ...defaultEditState,
      trim: saved.trim ? { ...saved.trim } : defaultEditState.trim,
      crop: saved.crop ? { ...saved.crop } : defaultEditState.crop,
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
      meta: { duration: saved.duration || 0, width: 0, height: 0 }
    };
  };
  const getSavedEditForVideo = (savedEdits, video, fileKeyCounts) => {
    if (!savedEdits || !video) return null;
    if (savedEdits[video.id]) return savedEdits[video.id];
    if (fileKeyCounts?.get(video.fileKey) === 1) return savedEdits[video.fileKey] || null;
    return null;
  };
  const savedEditsRef = useRef(loadFromStorage(STORAGE_KEYS.edits, {}));
  const playlistRef = useRef([]);
  const dbRef = useRef(null);

  const openDb = () =>
    new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB недоступна'));
        return;
      }
      const request = indexedDB.open('video-cut-db', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'fileKey' });
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

  useEffect(() => {
    playlistRef.current = playlist;
    const payload = playlist.map(v => ({
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
      channels: Array.isArray(v.channels) ? v.channels : [],
      source: v.source || '',
      sourcePath: v.sourcePath || '',
      sourceBaseDir: v.sourceBaseDir || ''
    }));
    saveToStorage(STORAGE_KEYS.playlist, payload);
  }, [playlist]);

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
    setEdits(prev => {
      const oldEdit = prev[currentId] || defaultEditState;
      let newEdit = { ...oldEdit, ...updates };
      if (saveHistory) {
        const relevantKeys = ['trim', 'crop', 'elements', 'segmentSets'];
        const hasChanges = relevantKeys.some(
          key => updates[key] !== undefined && updates[key] !== oldEdit[key]
        );
        if (hasChanges) newEdit = pushToHistory(newEdit, oldEdit);
      }
      return { ...prev, [currentId]: newEdit };
    });
  };

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
  const getSegmentOffsetForTime = (time, segments) => {
    let offset = 0;
    for (const seg of segments) {
      const start = seg.start ?? 0;
      const end = seg.end ?? start;
      const len = Math.max(0, end - start);
      if (time < start) return offset;
      if (time <= end) return offset + (time - start);
      offset += len;
    }
    return offset;
  };
  const getTimeForSegmentOffset = (offset, segments) => {
    let remaining = Math.max(0, offset);
    for (const seg of segments) {
      const start = seg.start ?? 0;
      const end = seg.end ?? start;
      const len = Math.max(0, end - start);
      if (remaining <= len) return start + remaining;
      remaining -= len;
    }
    const last = segments[segments.length - 1];
    return last ? last.end ?? last.start ?? 0 : 0;
  };
  const parseTimeToSeconds = value => {
    if (!value) return null;
    const parts = String(value)
      .trim()
      .split(':')
      .map(part => Number(part));
    if (parts.some(part => Number.isNaN(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    return null;
  };
  const extractFfmpegTime = log => {
    if (!log) return null;
    const matches = log.match(/time=([0-9:.]+)/g);
    if (!matches || matches.length === 0) return null;
    const last = matches[matches.length - 1].replace('time=', '');
    return parseTimeToSeconds(last);
  };
  const getExportDurationForEdit = (edit, mode) => {
    if (!edit) return 0;
    const segments = mode ? getSegmentsForMode(edit, mode) : edit.segments;
    if (Array.isArray(segments) && segments.length > 0) {
      return segments.reduce(
        (sum, seg) => sum + Math.max(0, (seg.end ?? 0) - (seg.start ?? 0)),
        0
      );
    }
    const trimStart = Number.isFinite(edit.trim?.start) ? edit.trim.start : 0;
    const trimEnd = Number.isFinite(edit.trim?.end)
      ? edit.trim.end
      : edit.meta?.duration || 0;
    return Math.max(0, trimEnd - trimStart);
  };

  const showHud = text => {
    setHudText(text);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setHudText(null), 1000);
  };
  const resolveSuffixFromMode = (mode, cameraType) => {
    const value = normalizeName(mode);
    const camera = normalizeName(cameraType);
    if (camera.includes('thermal') || camera.includes('infrared')) {
      if (value.includes('analog')) return '_thermal_analog';
      if (value.includes('digital')) return '_thermal_digital';
      return '';
    }
    if (!value) return '';
    if (value.includes('analog')) return '_crop_analog';
    if (value.includes('digital')) return '_crop_digital';
    return '';
  };
  const getEntryOrder = entry => {
    if (!entry) return 99;
    const camera = normalizeName(entry.cameraType);
    const mode = normalizeName(entry.analogDigital);
    if (camera.includes('thermal') || camera.includes('infrared')) return 2;
    if (mode.includes('digital')) return 0;
    if (mode.includes('analog')) return 1;
    return 1;
  };
  const loadSheetMap = async () => {
    if (sheetMapPromiseRef.current) return sheetMapPromiseRef.current;
    sheetMapPromiseRef.current = (async () => {
      try {
        const res = await fetch(getSheetCsvUrl(adminConfig));
        if (!res.ok) throw new Error('sheet_fetch_failed');
        const csvText = await res.text();
        const rows = parseCsv(csvText);
        if (!rows.length) throw new Error('sheet_bad');
        const headers = rows[0].map(h => String(h).trim().toLowerCase());
        const idxFile = headers.indexOf('tg_file_name');
        const idxMode = headers.indexOf('analog_digital');
        const idxCameraType = headers.indexOf('camera_type');
        const idxStatus = headers.indexOf('status');
        if (idxFile === -1) throw new Error('sheet_bad');
        const map = new Map();
        for (let i = 1; i < rows.length; i += 1) {
          const row = rows[i];
          const rawName = row[idxFile];
          const key = normalizeName(rawName);
          if (!key) continue;
          if (!map.has(key)) map.set(key, []);
          map.get(key).push({
            rowIndex: i + 1,
            fileName: String(rawName || '').trim(),
            analogDigital: row[idxMode] ? String(row[idxMode]).trim() : '',
            cameraType: row[idxCameraType] ? String(row[idxCameraType]).trim() : '',
            status: row[idxStatus] ? String(row[idxStatus]).trim() : ''
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
  const getFileKeyCounts = list => {
    const counts = new Map();
    (list || []).forEach(item => {
      if (!item?.fileKey) return;
      const existing = counts.get(item.fileKey) || 0;
      const channelCount =
        Array.isArray(item.channels) && item.channels.length > 0 ? item.channels.length : 0;
      if (channelCount > 0) {
        counts.set(item.fileKey, Math.max(existing, channelCount));
      } else {
        counts.set(item.fileKey, existing + 1);
      }
    });
    return counts;
  };
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
    const crop = edit.crop || defaultEditState.crop;
    const elements = Array.isArray(edit.elements) ? edit.elements : [];
    const hasCrop = !!(crop.t || crop.b || crop.l || crop.r);
    const hasElements = elements.length > 0;
    const hasFilters = hasCrop || hasElements;
    const safeDuration =
      Number.isFinite(meta.duration) && meta.duration > 0 ? meta.duration : null;
    const clampTime = val =>
      safeDuration ? clamp(val, 0, safeDuration) : Math.max(0, val);
    const segmentMode = options.segmentMode || getSegmentModeForVideo(video);
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
    const edit = currentEdit || defaultEditState;
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
      const edit = edits[video.id] || defaultEditState;
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
  const reorderPlaylist = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setPlaylist(prev => {
      const fromIndex = prev.findIndex(p => p.id === fromId);
      const toIndex = prev.findIndex(p => p.id === toId);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      next.splice(insertIndex, 0, moved);
      return next;
    });
  };
  const fetchAdminJson = async (path, options = {}) => {
    if (!options.silent) {
      setAdminLoading(true);
      setAdminError('');
    }
    try {
      const res = await fetch(`${adminBaseUrl}${path}`, {
        method: options.method || 'GET',
        headers: options.json ? { 'Content-Type': 'application/json' } : undefined,
        body: options.json ? JSON.stringify(options.json) : undefined
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (!options.silent) {
        setAdminError('Не вдалося підключитися до сервера');
      }
      return null;
    } finally {
      if (!options.silent) setAdminLoading(false);
    }
  };
  const pingAdmin = async () => {
    const data = await fetchAdminJson('/health');
    if (data) setAdminHealth(data);
  };
  const loadAdminSheet = async () => {
    const data = await fetchAdminJson('/sheet-map');
    if (data) setAdminSheet(data);
  };
  const loadAdminSnapshot = async () => {
    const data = await fetchAdminJson('/snapshot');
    if (data) setAdminSnapshot(data);
  };
  const loadAdminConfig = async () => {
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
        sheetId: data.config.sheetId || DEFAULT_ADMIN_CONFIG.sheetId,
        sheetGid: data.config.sheetGid || DEFAULT_ADMIN_CONFIG.sheetGid
      });
    }
  };
  const saveAdminConfig = async () => {
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
      sheetId: adminConfig.sheetId || DEFAULT_ADMIN_CONFIG.sheetId,
      sheetGid: adminConfig.sheetGid || DEFAULT_ADMIN_CONFIG.sheetGid
    };
    const data = await fetchAdminJson('/config', { method: 'POST', json: payload });
    if (data?.config) setAdminConfig(data.config);
    if (data?.ok) showHud("Налаштування збережено");
  };
  const buildSnapshotPayload = () => ({
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
      channels: Array.isArray(v.channels) ? v.channels : [],
      source: v.source || '',
      sourcePath: v.sourcePath || '',
      sourceBaseDir: v.sourceBaseDir || ''
    })),
    edits: savedEditsRef.current || {},
    prefs: {
      isDark,
      batchSuffix,
      seekStep,
      uploadToDrive,
      sidebarWidth,
      adminBaseUrl,
      overwriteOutputs
    }
  });
  const applySnapshotPayload = payload => {
    if (!payload) return;
    const savedList = Array.isArray(payload.playlist) ? payload.playlist : [];
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
    const prefs = payload.prefs || {};
    if (typeof prefs.isDark === 'boolean') setIsDark(prefs.isDark);
    if (typeof prefs.batchSuffix === 'string') setBatchSuffix(prefs.batchSuffix);
    if (typeof prefs.seekStep === 'number') setSeekStep(prefs.seekStep);
    if (typeof prefs.uploadToDrive === 'boolean') setUploadToDrive(prefs.uploadToDrive);
    if (typeof prefs.sidebarWidth === 'number') setSidebarWidth(prefs.sidebarWidth);
    if (typeof prefs.adminBaseUrl === 'string') setAdminBaseUrl(prefs.adminBaseUrl);
    if (typeof prefs.overwriteOutputs === 'boolean')
      setOverwriteOutputs(prefs.overwriteOutputs);
    saveToStorage(STORAGE_KEYS.playlist, savedList);
    saveToStorage(STORAGE_KEYS.edits, savedEdits);
    saveToStorage(STORAGE_KEYS.prefs, {
      isDark: typeof prefs.isDark === 'boolean' ? prefs.isDark : isDark,
      batchSuffix: typeof prefs.batchSuffix === 'string' ? prefs.batchSuffix : batchSuffix,
      seekStep: typeof prefs.seekStep === 'number' ? prefs.seekStep : seekStep,
      uploadToDrive:
        typeof prefs.uploadToDrive === 'boolean' ? prefs.uploadToDrive : uploadToDrive,
      sidebarWidth: typeof prefs.sidebarWidth === 'number' ? prefs.sidebarWidth : sidebarWidth,
      adminBaseUrl: typeof prefs.adminBaseUrl === 'string' ? prefs.adminBaseUrl : adminBaseUrl,
      overwriteOutputs:
        typeof prefs.overwriteOutputs === 'boolean'
          ? prefs.overwriteOutputs
          : overwriteOutputs
    });
  };
  const saveAdminSnapshot = async () => {
    const payload = buildSnapshotPayload();
    const data = await fetchAdminJson('/sync', { method: 'POST', json: payload });
    if (data?.ok) showHud("Стан збережено в БД");
  };
  const applyAdminSnapshot = () => {
    if (!adminSnapshot?.payload) {
      showHud("Немає snapshot");
      return;
    }
    applySnapshotPayload(adminSnapshot.payload);
    showHud("Стан відновлено");
  };
  const loadAdminJobs = async (options = {}) => {
    const data = await fetchAdminJson('/jobs', options);
    if (data?.jobs) {
      setAdminJobs(data.jobs);
      setAdminLastRefreshAt(new Date());
    }
  };
  const loadAdminJob = async (id, options = {}) => {
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
  };
  const runAdminFfmpeg = async () => {
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
      const edit = edits[video.id] || defaultEditState;
      const variants = getVideoChannelVariants(video);
      variants.forEach(variant => {
        const allowRenameOriginal = allowDoneForVideo(variant, fileKeyCounts, fileKeyVariants);
        const result = buildFfmpegLinesFor(variant, edit, {
          useBatchSuffix,
          allowRenameOriginal,
          overwriteOutput: overwriteOutputs,
          segmentMode: variant.channelMode
        });
        if (result.error) {
          skipped.push(variant.name || variant.id);
          return;
        }
        const needsOutputDir = result.needsOutputDir !== false;
        const outputDir = result.outputDir || 'cutted';
        const tmpDir = result.tmpDir || `${outputDir}/_tmp`;
        const header = [
          ...(needsOutputDir ? [`mkdir -p "${outputDir}"`] : []),
          ...(needsOutputDir && result.usesTemp ? [`mkdir -p "${tmpDir}"`] : [])
        ];
        const command = [...header, ...result.lines].join('\n').trim();
        if (!command) {
          skipped.push(variant.name || variant.id);
          return;
        }
        const label = SEGMENT_MODES.find(mode => mode.id === variant.channelMode)?.label;
        jobsToRun.push({
          command,
          expectedDuration: getExportDurationForEdit(edit, variant.channelMode),
          label: `${variant.name || variant.id} ${label || variant.suffix || ''}`.trim()
        });
      });
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
  };
  const applyAiSegments = items => {
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
        const existing = next[target.id] || defaultEditState;
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
  };
  const applyLogoDetections = items => {
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
        const existing = next[target.id] || defaultEditState;
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
  };
  const runAdminAiSegments = async () => {
    const selected = playlist.filter(p => p.checked);
    const targets = selected.length > 0 ? selected : activeVideo ? [activeVideo] : [];
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
          fileKey: item.fileKey,
          sourcePath: item.sourcePath,
          allowedModes
        };
      });
    if (files.length === 0) {
      showHud("Потрібні відео з теки сервера");
      return;
    }
    setAdminAiLoading(true);
    setAdminAiStats(null);
    const data = await fetchAdminJson('/ai/segments', {
      method: 'POST',
      json: {
        files,
        modelPath: adminConfig.aiModelPath || '',
        pythonPath: adminConfig.aiPythonPath || '',
        fps: Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : 1,
        minDuration: Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : 2,
        writeFfmpeg: true,
        overwrite: overwriteOutputs
      },
      silent: true
    });
    setAdminAiLoading(false);
    if (!data?.ok) {
      showHud("AI не відпрацював");
      return;
    }
    const items = data.payload?.items || [];
    applyAiSegments(items);
    setAdminAiStats({ processed: items.length });
    showHud(`AI сегменти: ${items.length}`);
  };
  const runAdminLogoDetection = async () => {
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
  };
  const stopAdminJob = async id => {
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
  };
  const buildRenameCommand = (video, mode) => {
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
  };
  const queueServerRename = async (video, mode) => {
    if (!video || video.source !== 'server') return;
    const command = buildRenameCommand(video, mode);
    if (!command) return;
    await fetchAdminJson('/jobs', { method: 'POST', json: { command }, silent: true });
  };
  const pickAdminFolder = async () => {
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
  };
  const addVideosFromServer = async () => {
    const data = await fetchAdminJson('/files');
    if (!data?.files) return;
    if (data.files.length === 0) {
      showHud("Файлів не знайдено");
      return;
    }
    const sheetMap = await loadSheetMap();
    if (!sheetMap) showHud("Таблиця не завантажена, суфікси не підтягнуто");
    const savedEdits = savedEditsRef.current || {};
    const existingByFileKey = new Map(
      playlistRef.current.filter(v => v.fileKey).map(v => [v.fileKey, v])
    );
    const newVideos = [];
    const mergedUpdates = [];
    let skipped = 0;
    let inSheetCount = 0;
    const unmatched = [];
    const baseDir = data.baseDir || '';

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

      if (hasSheetEntry) inSheetCount += 1;
      else unmatched.push(fileInfo.name);

      const entries = hasSheetEntry ? sheetEntries : [null];
      const orderedEntries = entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
          const orderDiff = getEntryOrder(a.entry) - getEntryOrder(b.entry);
          return orderDiff !== 0 ? orderDiff : a.index - b.index;
        })
        .map(item => item.entry);

      const channels = buildChannelsFromEntries(orderedEntries);
      const existingItem = existingByFileKey.get(fileKey);

      if (existingItem) {
        const merged = mergeChannelLists(existingItem.channels, channels);
        if (merged.length > 0 && merged.length !== (existingItem.channels || []).length) {
          const updated = { ...existingItem, channels: merged };
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
        fileKey,
        type: fileInfo.type || '',
        size: fileInfo.size || 0,
        lastModified: fileInfo.mtimeMs || 0,
        isLoading: false,
        sheetRow: null,
        sheetMode: '',
        sheetCameraType: '',
        sheetStatus: '',
        channels,
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
    setAdminImportStats({ added: newVideos.length, skipped });
    if (newVideos.length === 0) {
      showHud("Нових файлів немає");
      return;
    }
    showHud(`Додано ${newVideos.length} файлів`);
  };
  useEffect(() => {
    if (!adminOpen) return;
    loadAdminConfig();
    loadAdminJobs();
  }, [adminOpen]);
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
    if (!adminOpen) setAdminHistoryOpen(false);
  }, [adminOpen]);
  useEffect(() => {
    if (!adminOpen || !adminAutoRefresh) return;
    const interval = setInterval(() => {
      const id = adminJobId || adminJob?.id;
      loadAdminJobs({ silent: true });
      if (id) loadAdminJob(id, { silent: true });
    }, 1500);
    return () => clearInterval(interval);
  }, [adminOpen, adminAutoRefresh, adminJobId, adminJob?.id]);
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
  }, [adminJobs]);
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
    overwriteOutputs
  ]);
  useEffect(() => {
    if (!playlistScrollRef.current) return;
    const updateHeight = () => {
      if (!playlistScrollRef.current) return;
      setPlaylistViewportHeight(playlistScrollRef.current.clientHeight);
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  // --- BATCH LOGIC ---
  const toggleSelection = (e, id) => {
    e.stopPropagation();
    setPlaylist(prev =>
      prev.map(vid => (vid.id === id ? { ...vid, checked: !vid.checked } : vid))
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = new Set(activeGroupItems.map(p => p.id));
    const allSelected =
      activeGroupItems.length > 0 && activeGroupItems.every(p => p.checked);
    setPlaylist(prev =>
      prev.map(p => (visibleIds.has(p.id) ? { ...p, checked: !allSelected } : p))
    );
  };

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
  }, [activeVideo, isPlaying, currentEdit, isProcessing, processingJob, currentId, seekStep]);

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
            channels: mergeChannelLists(existingItem.channels, channels)
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
    saved[currentVideo.id] = {
      trim: currentEdit.trim,
      crop: currentEdit.crop,
      elements: currentEdit.elements,
      segments: currentEdit.segments,
      segmentSets: currentEdit.segmentSets,
      segmentMode: currentEdit.segmentMode,
      viewMode: currentEdit.viewMode,
      duration: currentEdit.meta.duration
    };
    savedEditsRef.current = saved;
    saveToStorage(STORAGE_KEYS.edits, saved);
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
      startTime: currentTime || 0,
      endTime: meta.duration || 10
    };
    updateCurrentEdit({ elements: [...elements, newEl], selectedId: newEl.id, viewMode: 'editor' });
  };

  const updateElement = (id, updates) => {
    updateCurrentEdit({
      elements: currentEdit.elements.map(el => (el.id === id ? { ...el, ...updates } : el))
    });
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
      endTime: el.endTime
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

  const normalizeSegment = seg => {
    if (!currentEdit.meta.duration) return seg;
    const rawStart = Number.isFinite(seg.start) ? seg.start : 0;
    const rawEnd = Number.isFinite(seg.end) ? seg.end : rawStart + 0.1;
    const start = clamp(rawStart, 0, currentEdit.meta.duration);
    let end = clamp(rawEnd, 0, currentEdit.meta.duration);
    if (end <= start) end = clamp(start + 0.1, 0, currentEdit.meta.duration);
    return { ...seg, start, end };
  };

  const updateSegment = (id, updates) => {
    const mode = getActiveSegmentMode();
    const nextSegments = getSegmentsForMode(currentEdit, mode).map(seg =>
      seg.id === id ? normalizeSegment({ ...seg, ...updates }) : seg
    );
    updateCurrentEdit({
      segmentSets: updateSegmentsForMode(currentEdit, mode, nextSegments),
      segments: nextSegments
    });
  };

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
      ...defaultEditState,
      trim: { ...defaultEditState.trim },
      crop: { ...defaultEditState.crop },
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

  // --- DRAGGING LOGIC ---
  useEffect(() => {
    const handleMouseMove = e => {
      if (!isDragging.current) return;
      e.preventDefault();
      const target = dragTarget.current;

      // Trim Handles
      if (target.type === 'trim-start' || target.type === 'trim-end') {
        if (!timelineRef.current || !currentEdit.meta.duration) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let perc = Math.max(0, Math.min(1, x / rect.width));
        let time = perc * currentEdit.meta.duration;

        if (target.type === 'trim-start') {
          time = Math.min(time, currentEdit.trim.end - 0.5);
          updateCurrentEdit({ trim: { ...currentEdit.trim, start: time } });
          if (videoRef.current) videoRef.current.currentTime = time;
        } else {
          time = Math.max(time, currentEdit.trim.start + 0.5);
          updateCurrentEdit({ trim: { ...currentEdit.trim, end: time } });
          if (videoRef.current) videoRef.current.currentTime = time;
        }
        return;
      }

      if (target.type === 'segment') {
        if (!timelineRef.current || !currentEdit.meta.duration) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const deltaTime =
          ((e.clientX - startPos.current.x) / rect.width) * currentEdit.meta.duration;
        const segStart = startState.current.start;
        const segEnd = startState.current.end;
        const segLen = segEnd - segStart;

        if (target.action === 'move') {
          let newStart = segStart + deltaTime;
          newStart = clamp(newStart, 0, currentEdit.meta.duration - segLen);
          const newEnd = newStart + segLen;
          updateSegment(target.id, { start: newStart, end: newEnd });
        } else if (target.action === 'resize-start') {
          const newStart = clamp(segStart + deltaTime, 0, segEnd - 0.1);
          updateSegment(target.id, { start: newStart, end: segEnd });
        } else if (target.action === 'resize-end') {
          const newEnd = clamp(segEnd + deltaTime, segStart + 0.1, currentEdit.meta.duration);
          updateSegment(target.id, { start: segStart, end: newEnd });
        }
        return;
      }

      if (target.type === 'pan') {
        const deltaX = e.clientX - startPos.current.x;
        const deltaY = e.clientY - startPos.current.y;
        setPan({ x: startState.current.x + deltaX, y: startState.current.y + deltaY });
        return;
      }

      // Canvas Overlay
      if (overlayRef.current && currentEdit.viewMode === 'editor') {
        const rect = overlayRef.current.getBoundingClientRect();
        // Adjust delta by zoom level so dragging feels 1:1 with mouse even when zoomed
        const deltaX = (e.clientX - startPos.current.x) / zoom;
        const deltaY = (e.clientY - startPos.current.y) / zoom;

        // Calculate percentage based on the UNZOOOMED rect width (approx logic)
        // Actually, rect.width IS the zoomed width.
        // So deltaPerc = (deltaX / rect.width) * 100 is correct for zoomed visual too?
        // No, if zoomed 2x, rect is 2x. A 100px drag is 50 video-units.
        // Let's use the standard perc calculation based on the visual rect.
        const deltaPercX = ((e.clientX - startPos.current.x) / rect.width) * 100;
        const deltaPercY = ((e.clientY - startPos.current.y) / rect.height) * 100;

        if (target.type === 'element') {
          const elId = target.id;
          const startEl = startState.current;
          if (target.action === 'move') {
            updateElement(elId, { x: startEl.x + deltaPercX, y: startEl.y + deltaPercY });
          } else if (target.action === 'resize') {
            if (target.corner === 'br') {
              updateElement(elId, {
                w: Math.max(2, startEl.w + deltaPercX),
                h: Math.max(2, startEl.h + deltaPercY)
              });
            }
            if (target.corner === 'tl') {
              updateElement(elId, {
                w: Math.max(2, startEl.w - deltaPercX),
                h: Math.max(2, startEl.h - deltaPercY),
                x: startEl.x + deltaPercX,
                y: startEl.y + deltaPercY
              });
            }
            if (target.corner === 'tr') {
              updateElement(elId, {
                w: Math.max(2, startEl.w + deltaPercX),
                h: Math.max(2, startEl.h - deltaPercY),
                y: startEl.y + deltaPercY
              });
            }
            if (target.corner === 'bl') {
              updateElement(elId, {
                w: Math.max(2, startEl.w - deltaPercX),
                h: Math.max(2, startEl.h + deltaPercY),
                x: startEl.x + deltaPercX
              });
            }
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
          updateCurrentEdit({ crop: newCrop });
        }
      }
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      dragTarget.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [currentEdit, currentId, zoom]);

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
    } else if (targetInfo.type === 'segment') {
      const mode = getActiveSegmentMode();
      const seg = getSegmentsForMode(currentEdit, mode).find(s => s.id === targetInfo.id);
      if (seg) startState.current = { start: seg.start, end: seg.end };
    } else if (targetInfo.type === 'crop') startState.current = { ...currentEdit.crop };
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
    const { trim, elements, meta } = jobEdit;
    const segmentMode = getSegmentModeForVideo(jobVideo);
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
        const existing = prev[jobVideoId] || defaultEditState;
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
  const fileKeyCountsAll = useMemo(() => getFileKeyCounts(playlist), [playlist]);
  const filteredPlaylist = useMemo(() => {
    const query = normalizeName(searchQuery);
    return playlist.filter(p => {
      if (!query) return true;
      return normalizeName(p.name).includes(query);
    });
  }, [playlist, searchQuery]);
  const multiChannelPlaylist = useMemo(
    () => filteredPlaylist.filter(p => (fileKeyCountsAll.get(p.fileKey) || 0) > 1),
    [filteredPlaylist, fileKeyCountsAll]
  );
  const allCount = filteredPlaylist.length;
  const multiCount = multiChannelPlaylist.length;
  const groupOrder = useMemo(() => ['__none__', ...suffixOptions], [suffixOptions]);
  const groupedPlaylist = useMemo(() => {
    const groups = new Map();
    filteredPlaylist.forEach(item => {
      const key = item.suffix ? item.suffix : '__none__';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const idxA = groupOrder.indexOf(a[0]);
      const idxB = groupOrder.indexOf(b[0]);
      if (idxA === -1 && idxB === -1) return a[0].localeCompare(b[0]);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [filteredPlaylist, groupOrder]);
  const activeGroupItems = useMemo(() => {
    if (activeGroupKey === '__all__') return filteredPlaylist;
    if (activeGroupKey === '__multi__') return multiChannelPlaylist;
    const entry = groupedPlaylist.find(([key]) => key === activeGroupKey);
    return entry ? entry[1] : [];
  }, [groupedPlaylist, activeGroupKey, filteredPlaylist, multiChannelPlaylist]);
  useEffect(() => {
    if (groupedPlaylist.length === 0) return;
    if (activeGroupKey === '__all__' || activeGroupKey === '__multi__') return;
    const exists = groupedPlaylist.some(([key]) => key === activeGroupKey);
    if (!exists) setActiveGroupKey(groupedPlaylist[0][0]);
  }, [groupedPlaylist, activeGroupKey]);
  useEffect(() => {
    if (!playlistScrollRef.current) return;
    playlistScrollRef.current.scrollTop = 0;
    setPlaylistScrollTop(0);
  }, [activeGroupKey, searchQuery]);
  const selectedCount = playlist.filter(p => p.checked).length;
  const isAllSelected =
    activeGroupItems.length > 0 && activeGroupItems.every(p => p.checked);
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
  // Batch Progress: (Total - Queue) / Total
  const batchProgressPercent =
    batchTotal > 0 ? ((batchTotal - batchQueue.length) / batchTotal) * 100 : 0;
  const segmentTotal = activeSegments.length > 0 ? getSegmentTotal(activeSegments) : 0;
  const segmentOffset = segmentTotal > 0 ? getSegmentOffsetForTime(currentTime, activeSegments) : 0;
  const adminJobMeta = adminJob ? getJobMeta(adminJob) : null;
  const adminJobIsStoppable =
    adminJob && (adminJob.status === 'running' || adminJob.status === 'queued');
  const playlistItemHeight = 78;
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
  const playlistOverscan = 6;
  const playlistStartIndex = Math.max(
    0,
    Math.floor(playlistScrollTop / playlistItemHeight) - playlistOverscan
  );
  const playlistEndIndex = Math.min(
    activeGroupItems.length,
    Math.ceil((playlistScrollTop + playlistViewportHeight) / playlistItemHeight) + playlistOverscan
  );
  const playlistVisibleItems = activeGroupItems.slice(playlistStartIndex, playlistEndIndex);
  const playlistPaddingTop = playlistStartIndex * playlistItemHeight;
  const playlistPaddingBottom =
    (activeGroupItems.length - playlistEndIndex) * playlistItemHeight;
  const adminSheetRows = adminSheet?.rows || [];
  const adminSheetFiltered = adminSheetRows.filter(row => {
    if (!adminSheetFilter) return true;
    const query = normalizeName(adminSheetFilter);
    return (
      normalizeName(row.fileName).includes(query) ||
      normalizeName(row.status).includes(query) ||
      normalizeName(row.analogDigital).includes(query) ||
      normalizeName(row.cameraType).includes(query)
    );
  });
  const adminJobProgress = adminJob ? getJobProgress(adminJob) : null;
  const adminJobStats = adminJobs.reduce(
    (acc, job) => {
      if (job.status === 'running') acc.running += 1;
      else if (job.status === 'queued') acc.queued += 1;
      else if (job.status === 'done') acc.done += 1;
      else if (job.status === 'error') acc.error += 1;
      else if (job.status === 'canceled') acc.canceled += 1;
      return acc;
    },
    { running: 0, queued: 0, done: 0, error: 0, canceled: 0 }
  );

  return (
    <div
      tabIndex={0}
      className={`flex h-screen overflow-hidden ${isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
        }`}
    >
      {hudText && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-black/80 text-white px-6 py-3 rounded-full text-xl font-mono font-bold shadow-2xl z-[9999] pointer-events-none animate-in fade-in zoom-in duration-100">
          {hudText}
        </div>
      )}
      {notifications.length > 0 && (
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
                    onClick={() => removeNotification(note.id)}
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
      )}
      {applyModalOpen && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-sm rounded-xl p-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="text-sm font-bold mb-2">Застосувати зміни</div>
            <div className="text-xs text-slate-400 mb-4">
              Оберіть, що саме запікати у відео.
            </div>
            <div className="space-y-2">
              <button
                onClick={() => applyChanges('crop')}
                className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Лише обрізання
              </button>
              <button
                onClick={() => applyChanges('all')}
                className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Все (обрізання + прямокутники)
              </button>
              <button
                onClick={() => setApplyModalOpen(false)}
                className="w-full py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                Скасувати
              </button>
            </div>
          </div>
        </div>
      )}
      {ffmpegModalOpen && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-lg rounded-xl p-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="text-sm font-bold mb-2">FFmpeg команда</div>
            <div className="text-xs text-slate-400 mb-3">
              Запускайте в теці з відео. Вивід буде у `cutted/` без `_done`, а оригінал після успішного експорту отримає `_done` і переїде в `done/` (якщо є thermal — `_done` ставиться на thermal, інакше на analog). За потреби файл піде в Google Drive через `rclone` (`gdrive:22.12.2025 [ATV&Drone]`).
            </div>
            <textarea
              readOnly
              value={ffmpegCommand}
              className={`w-full h-32 text-xs font-mono p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'}`}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyFfmpegCommand}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Скопіювати
              </button>
              <button
                onClick={() => setFfmpegModalOpen(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
      {ffmpegBatchModalOpen && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-2xl rounded-xl p-4 shadow-xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="text-sm font-bold mb-2">FFmpeg масовий експорт</div>
            <div className="text-xs text-slate-400 mb-3">
              Запускайте у теці з відео. Вивід буде у `cutted/` без `_done`, а оригінали після успішного експорту отримають `_done` і переїдуть в `done/` (якщо є thermal — `_done` ставиться на thermal, інакше на analog). За потреби файли підуть у Google Drive через `rclone` (`gdrive:22.12.2025 [ATV&Drone]`).
            </div>
            {ffmpegBatchSkipped.length > 0 && (
              <div className="text-[10px] text-amber-500 mb-2">
                Пропущено (немає метаданих): {ffmpegBatchSkipped.join(', ')}
              </div>
            )}
            <textarea
              readOnly
              value={ffmpegBatchScript}
              className={`w-full h-56 text-xs font-mono p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200'}`}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyFfmpegBatchScript}
                className="flex-1 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Скопіювати
              </button>
              <button
                onClick={() => setFfmpegBatchModalOpen(false)}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
      {adminOpen && (
        <div className="fixed inset-0 z-[9997] flex items-center justify-center bg-black/50">
          <div className={`w-full max-w-5xl rounded-2xl p-5 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-base font-bold">Адмінка</div>
                <div className="text-[10px] text-slate-400">Локальний сервер • Job runner • Sheet map</div>
              </div>
              <button
                onClick={() => {
                  setAdminOpen(false);
                  setAdminHistoryOpen(false);
                }}
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
                    onChange={e => setAdminBaseUrl(e.target.value)}
                    className={`flex-1 text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="http://localhost:7071"
                  />
                  <button
                    onClick={pingAdmin}
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
                  onChange={e => setAdminConfig(prev => ({ ...prev, baseDir: e.target.value }))}
                  className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                  placeholder="/Users/mac/Desktop/video_cut/Telegram Uploads/..."
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={pickAdminFolder}
                    className="px-3 py-2 rounded text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white"
                    disabled={adminLoading}
                  >
                    Обрати теку
                  </button>
                  <button
                    onClick={saveAdminConfig}
                    className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={adminLoading}
                  >
                    Зберегти
                  </button>
                  <button
                    onClick={addVideosFromServer}
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
                    onChange={e => setAdminConfig(prev => ({ ...prev, aiModelPath: e.target.value }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="/Users/mac/Desktop/video_cut/ml/best.pt"
                  />
                  <input
                    type="text"
                    value={adminConfig.aiPythonPath || ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, aiPythonPath: e.target.value }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="/Users/mac/Desktop/video_cut/.venv-ml/bin/python"
                  />
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-4">
                  <input
                    type="number"
                    step="0.1"
                    value={Number.isFinite(adminConfig.aiFps) ? adminConfig.aiFps : ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, aiFps: parseNumericInput(e.target.value) }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="FPS"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={Number.isFinite(adminConfig.aiMinDuration) ? adminConfig.aiMinDuration : ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, aiMinDuration: parseNumericInput(e.target.value) }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="Min duration"
                  />
                  <button
                    onClick={saveAdminConfig}
                    className="px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={adminLoading || adminAiLoading}
                  >
                    Зберегти AI
                  </button>
                  <button
                    onClick={runAdminAiSegments}
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

            {/* Job Progress Bar */}
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

            {/* Job Log */}
            <div className="mt-4">
              <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                <div className="text-xs font-bold mb-2">Лог поточного job</div>
                <pre className={`p-2 rounded border overflow-auto max-h-40 text-[10px] font-mono ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                  {adminJob?.log ? adminJob.log : 'Немає активного job'}
                </pre>
              </div>
            </div>

            {/* Job History Buttons */}
            {adminJobs.length > 0 && (
              <div className="mt-4">
                <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold">Останні job-и</div>
                    <button
                      onClick={() => setAdminHistoryOpen(true)}
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
                          onClick={() => {
                            setAdminJobId(job.id);
                            setAdminJob(job);
                            setAdminJobExpectedDuration(
                              adminJobExpectedMapRef.current.get(job.id) ?? null
                            );
                          }}
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
                    onClick={loadAdminSheet}
                    className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                    disabled={adminLoading}
                  >
                    Оновити
                  </button>
                </div>
                <input
                  type="text"
                  value={adminSheetFilter}
                  onChange={e => setAdminSheetFilter(e.target.value)}
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
                    onClick={() => setAdminShowSnapshot(prev => !prev)}
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
                    onClick={loadAdminSnapshot}
                    className="px-3 py-2 rounded text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white"
                    disabled={adminLoading}
                  >
                    Оновити snapshot
                  </button>
                  <button
                    onClick={saveAdminSnapshot}
                    className="px-3 py-2 rounded text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white"
                    disabled={adminLoading}
                  >
                    Зберегти стан
                  </button>
                  <button
                    onClick={applyAdminSnapshot}
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

            {/* Logo Detection Settings */}
            <div className="mt-4">
              <div className={`rounded-lg border p-3 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                <div className="text-xs font-bold mb-2">Лого детекція (без тренування)</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    type="text"
                    value={adminConfig.logoTemplatePath || ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, logoTemplatePath: e.target.value }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="image.png"
                  />
                  <div className="grid gap-2 grid-cols-3">
                    <input
                      type="number"
                      step="0.1"
                      value={Number.isFinite(adminConfig.logoFps) ? adminConfig.logoFps : ''}
                      onChange={e => setAdminConfig(prev => ({ ...prev, logoFps: parseNumericInput(e.target.value) }))}
                      className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                      placeholder="FPS"
                    />
                    <input
                      type="number"
                      step="1"
                      value={Number.isFinite(adminConfig.logoSize) ? adminConfig.logoSize : ''}
                      onChange={e => setAdminConfig(prev => ({ ...prev, logoSize: parseNumericInput(e.target.value) }))}
                      className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                      placeholder="Розмір"
                    />
                    <input
                      type="number"
                      step="0.01"
                      value={Number.isFinite(adminConfig.logoThreshold) ? adminConfig.logoThreshold : ''}
                      onChange={e => setAdminConfig(prev => ({ ...prev, logoThreshold: parseNumericInput(e.target.value) }))}
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
                    onChange={e => setAdminConfig(prev => ({ ...prev, logoMinDuration: parseNumericInput(e.target.value) }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="Min duration"
                  />
                  <input
                    type="text"
                    value={adminConfig.logoScales || ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, logoScales: e.target.value }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="Scales (0.9,1.0,1.1)"
                  />
                  <input
                    type="number"
                    step="1"
                    value={Number.isFinite(adminConfig.logoMaxMatches) ? adminConfig.logoMaxMatches : ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, logoMaxMatches: parseNumericInput(e.target.value) }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="Max matches"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={Number.isFinite(adminConfig.logoMaxGap) ? adminConfig.logoMaxGap : ''}
                    onChange={e => setAdminConfig(prev => ({ ...prev, logoMaxGap: parseNumericInput(e.target.value) }))}
                    className={`w-full text-xs p-2 rounded border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200'}`}
                    placeholder="Max gap"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <button onClick={saveAdminConfig} className="flex-1 px-3 py-2 rounded text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white" disabled={adminLoading || adminLogoLoading}>Зберегти лого</button>
                  <button
                    onClick={runAdminLogoDetection}
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

            {/* Google Sheet Settings */}
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
                      onChange={e => setAdminConfig(prev => ({ ...prev, sheetId: e.target.value }))}
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
                      onChange={e => setAdminConfig(prev => ({ ...prev, sheetGid: e.target.value }))}
                      className={`w-full text-[11px] p-2 rounded border focus:ring-1 focus:ring-sky-500 outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-sky-500' : 'bg-white border-slate-200 focus:border-sky-400'}`}
                      placeholder="GID аркуша"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <button
                    onClick={saveAdminConfig}
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
      )
      }

      {
        adminHistoryOpen && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60">
            <div className={`w-full max-w-4xl rounded-2xl p-4 shadow-2xl ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold">Історія job-ів</div>
                <button
                  onClick={() => setAdminHistoryOpen(false)}
                  className={`text-lg leading-none ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                  title="Закрити"
                >
                  ×
                </button>
              </div>
              <div className="text-[10px] text-slate-400 mb-3">
                Клік по рядку відкриє job у головному блоці логів.
              </div>
              <div className={`max-h-[60vh] overflow-auto rounded border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <table className="w-full text-[10px]">
                  <thead className={isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'}>
                    <tr>
                      <th className="px-2 py-1 text-left">Файл</th>
                      <th className="px-2 py-1 text-left">Статус</th>
                      <th className="px-2 py-1 text-left">Прогрес</th>
                      <th className="px-2 py-1 text-right">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminJobs.map(job => {
                      const meta = getJobMeta(job);
                      const progress = getJobProgress(job);
                      const isStoppable = job.status === 'running' || job.status === 'queued';
                      return (
                        <tr
                          key={job.id}
                          className={isDark ? 'border-t border-slate-800' : 'border-t border-slate-100'}
                          onClick={() => {
                            setAdminJobId(job.id);
                            setAdminJob(job);
                            setAdminJobExpectedDuration(
                              adminJobExpectedMapRef.current.get(job.id) ?? null
                            );
                            setAdminHistoryOpen(false);
                          }}
                        >
                          <td className="px-2 py-1" title={meta.tooltip || undefined}>
                            {meta.label}
                          </td>
                          <td className="px-2 py-1 text-slate-400">{job.status}</td>
                          <td className="px-2 py-1">
                            {progress === null ? (
                              <span className="text-slate-400">—</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-slate-200/40 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-indigo-500"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="text-slate-400">{Math.round(progress)}%</span>
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setAdminJobId(job.id);
                                setAdminJob(job);
                                setAdminJobExpectedDuration(
                                  adminJobExpectedMapRef.current.get(job.id) ?? null
                                );
                                setAdminHistoryOpen(false);
                              }}
                              className={`text-[10px] px-2 py-1 rounded border ${isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-500 hover:bg-slate-100'}`}
                            >
                              Відкрити
                            </button>
                            <button
                              onClick={() => stopAdminJob(job.id)}
                              disabled={!isStoppable}
                              className={`ml-2 text-[10px] px-2 py-1 rounded border disabled:opacity-40 ${isDark ? 'border-rose-700 text-rose-400 hover:bg-rose-900/30' : 'border-rose-300 text-rose-500 hover:bg-rose-50'}`}
                            >
                              Зупинити
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {adminJobs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2 py-4 text-center text-slate-400">
                          Немає job-ів
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }

      {/* SIDEBAR */}
      {
        isFocusMode && focusSideOpen && (
          <div
            className="fixed inset-0 z-[9995] bg-black/50"
            onClick={() => setFocusSideOpen(false)}
          />
        )
      }
      {
        (!isFocusMode || focusSideOpen) && (
          <div
            className={`border-r flex flex-col flex-shrink-0 transition-colors relative ${isFocusMode
              ? 'fixed left-0 top-0 h-full z-[9996]'
              : 'z-20 hidden md:flex'
              } ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
            style={{ width: isFocusMode ? 320 : sidebarWidth }}
          >
            {!isFocusMode && (
              <div
                className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'
                  }`}
                onMouseDown={startSidebarResize}
                title="Змінити ширину"
              />
            )}
            <div className={`p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  <Film className="w-5 h-5 text-indigo-500" />
                  {isFocusMode && <span className="text-xs">Список</span>}
                </h2>
                <div className="flex items-center gap-2">
                  {isFocusMode && (
                    <button
                      onClick={() => setFocusSideOpen(false)}
                      className="text-slate-400 hover:text-slate-200 text-lg leading-none"
                      title="Закрити"
                    >
                      ×
                    </button>
                  )}
                  {activeGroupItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSelectAll}
                        className={`text-[11px] leading-none hover:underline ${isDark ? 'text-indigo-400' : 'text-indigo-600'
                          }`}
                      >
                        {isAllSelected ? 'Зняти все' : 'Обрати все'}
                      </button>
                      <button
                        onClick={() => setPlaylist(prev => prev.map(p => ({ ...p, checked: false })))}
                        className="text-[11px] leading-none text-slate-400 hover:text-slate-600"
                      >
                        Очистити
                      </button>
                      <button
                        onClick={() =>
                          setPlaylist(prev =>
                            prev.map(p =>
                              activeGroupItems.some(item => item.id === p.id)
                                ? { ...p, checked: true }
                                : p
                            )
                          )
                        }
                        className="text-[11px] leading-none text-slate-400 hover:text-slate-600"
                      >
                        Видимі
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full text-[10px] rounded border px-2 py-1 ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  placeholder="Пошук по назві..."
                />
              </div>
            </div>
            <div className="px-2 pt-2">
              {filteredPlaylist.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActiveGroupKey('__all__')}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border ${activeGroupKey === '__all__'
                      ? isDark
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-indigo-600 border-indigo-500 text-white'
                      : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      }`}
                    title="Усі відео"
                  >
                    Усі ({allCount})
                  </button>
                  <button
                    onClick={() => setActiveGroupKey('__multi__')}
                    disabled={multiCount === 0}
                    className={`px-2 py-1 rounded-full text-[10px] font-bold border disabled:opacity-40 ${activeGroupKey === '__multi__'
                      ? isDark
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-indigo-600 border-indigo-500 text-white'
                      : isDark
                        ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                      }`}
                    title="Відео з кількома каналами"
                  >
                    2+ канали ({multiCount})
                  </button>
                  {groupedPlaylist.map(([groupKey, items]) => {
                    const label = groupKey === '__none__' ? 'Без суфіксу' : groupKey;
                    const isActive = groupKey === activeGroupKey;
                    return (
                      <button
                        key={groupKey}
                        onClick={() => setActiveGroupKey(groupKey)}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold border ${isActive
                          ? isDark
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-indigo-600 border-indigo-500 text-white'
                          : isDark
                            ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                          }`}
                        title={label}
                      >
                        {label} ({items.length})
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              ref={playlistScrollRef}
              onScroll={e => setPlaylistScrollTop(e.currentTarget.scrollTop)}
              className="flex-1 overflow-y-auto p-2"
            >
              {playlist.length === 0 && (
                <div className="text-center p-4 text-xs text-slate-400">Список порожній</div>
              )}
              {playlist.length > 0 && filteredPlaylist.length === 0 && (
                <div className="text-center p-4 text-xs text-slate-400">Немає відео для цього фільтра</div>
              )}
              {filteredPlaylist.length > 0 && activeGroupItems.length === 0 && (
                <div className="text-center p-4 text-xs text-slate-400">Немає відео для цієї групи</div>
              )}
              {activeGroupItems.length > 0 && (
                <>
                  <div style={{ height: `${playlistPaddingTop}px` }} />
                  {playlistVisibleItems.map(vid => {
                    const meta = edits[vid.id]?.meta;
                    const sizeLabel =
                      meta?.width && meta?.height ? `${meta.width}x${meta.height}` : '';
                    const durationLabel =
                      meta?.duration ? `${meta.duration.toFixed(1)}s` : '';
                    const metaLabel = [sizeLabel, durationLabel].filter(Boolean).join(' • ');
                    return (
                      <div key={vid.id} style={{ height: `${playlistItemHeight}px` }}>
                        <div
                          onClick={() => switchVideo(vid.id)}
                          className={`h-full p-3 rounded-lg cursor-pointer group relative flex items-start gap-2 transition ${currentId === vid.id
                            ? isDark
                              ? 'bg-indigo-900/50 border border-indigo-700'
                              : 'bg-indigo-50 border border-indigo-200 shadow-sm'
                            : isDark
                              ? 'hover:bg-slate-800 border border-transparent'
                              : 'hover:bg-slate-50 border border-transparent'
                            } ${dragOverId === vid.id && draggingId !== vid.id ? 'ring-2 ring-indigo-400' : ''}`}
                          draggable
                          onDragStart={e => {
                            setDraggingId(vid.id);
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', vid.id);
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            if (dragOverId !== vid.id) setDragOverId(vid.id);
                          }}
                          onDragLeave={() => {
                            if (dragOverId === vid.id) setDragOverId(null);
                          }}
                          onDrop={e => {
                            e.preventDefault();
                            const fromId = draggingId || e.dataTransfer.getData('text/plain');
                            reorderPlaylist(fromId, vid.id);
                            setDraggingId(null);
                            setDragOverId(null);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setDragOverId(null);
                          }}
                        >
                          <button
                            onClick={e => toggleSelection(e, vid.id)}
                            className={`mt-0.5 flex-shrink-0 p-1 ${vid.checked ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'
                              }`}
                          >
                            {vid.checked ? <CheckSquare className="w-5 h-5" /> : <SquareIcon className="w-5 h-5" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div
                              className={`font-medium text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
                              title={getVideoTooltip(vid)}
                            >
                              {getDisplayName(vid.name)}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                              <span>ID: {getShortId(vid.id)}</span>
                              {metaLabel && <span className="text-[10px]">{metaLabel}</span>}
                              {isVideoEdited(edits[vid.id]) && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                                  Змінено
                                </span>
                              )}
                              {getVideoChannelBadges(vid).map(mode => (
                                <span
                                  key={`${vid.id}-${mode.id}`}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${mode.dot}`}
                                >
                                  {mode.label}
                                </span>
                              ))}
                              {vid.notRelevant && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 text-[10px] font-bold">
                                  Not relevant
                                </span>
                              )}
                              {vid.isLoading && <span className="text-[10px] text-indigo-500">Завантаження...</span>}
                            </div>
                          </div>
                          <button
                            onClick={e => removeVideo(e, vid.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: `${playlistPaddingBottom}px` }} />
                </>
              )}
            </div>

            <div
              className={`p-4 border-t space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}
            >
              {playlist.length > 0 && (
                <button
                  onClick={deleteSelectedVideos}
                  disabled={selectedCount === 0}
                  className="w-full py-2 border border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg text-xs font-bold"
                >
                  Видалити обрані ({selectedCount})
                </button>
              )}
            </div>
            <div className={`p-4 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <label className="flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white w-full py-2.5 rounded-lg transition font-medium shadow-sm text-sm">
                <Plus className="w-4 h-4" /> Додати відео
                <input type="file" accept="video/*" multiple onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          </div>
        )
      }

      {/* MAIN AREA */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
        {/* TOP BAR */}
        <div
          className={`${isFocusMode ? 'h-12' : 'h-16'} border-b flex items-center justify-between px-6 flex-shrink-0 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}
        >
          {!isFocusMode && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-500 p-1.5 rounded-lg text-white">
                  <Scissors className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1
                      onClick={() => copyVideoName(activeVideo?.name, activeVideo?.id)}
                      className={`font-bold text-lg leading-tight cursor-pointer select-none ${isDark ? 'text-slate-100 hover:text-emerald-300' : 'text-slate-800 hover:text-emerald-600'
                        }`}
                      title="Натисніть, щоб скопіювати назву"
                    >
                      {activeVideo ? activeVideo.name : "Відео Майстер"}
                    </h1>
                    {activeVideo && copiedNameId === activeVideo.id && (
                      <span className="text-[10px] font-bold text-emerald-500">Скопійовано</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded font-medium border border-green-200 dark:border-green-800">
                      <ShieldCheck className="w-3 h-3" /> Local Processing
                    </span>
                    <div className="flex items-center gap-1">
                      {SUFFIX_PRESETS.map(preset => {
                        const isActive = activeSuffix === preset;
                        return (
                          <button
                            key={preset}
                            onClick={() =>
                              activeVideo && setVideoSuffix(activeVideo.id, isActive ? '' : preset)
                            }
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border transition ${isActive
                              ? isDark
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'bg-indigo-600 border-indigo-500 text-white'
                              : isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                              }`}
                            title="Вибір суфіксу для імені"
                          >
                            {preset}
                          </button>
                        );
                      })}
                      {activeSuffixPreset && (
                        <span className="text-[10px] text-indigo-500 font-bold">Обрано</span>
                      )}
                    </div>
                  </div>
                  {activeVideo && activeChannelChips.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[10px] text-slate-400">Канали:</span>
                      {activeChannelChips.map(chip => {
                        const isActive = currentEdit.segmentMode === chip.modeId;
                        return (
                          <button
                            key={chip.id}
                            onClick={() =>
                              chip.suffix
                                ? copyText(chip.suffix, "Суфікс скопійовано")
                                : null
                            }
                            disabled={!chip.suffix}
                            title={chip.title}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border transition ${isActive
                              ? chip.meta.active
                              : isDark
                                ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                              } ${chip.suffix ? '' : 'opacity-50 cursor-default'}`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            {activeVideo && (
              <>
                <div className="flex items-center border rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 dark:border-slate-700">
                  <button
                    onClick={() => zoomToSelected(zoom - 0.1)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Зменшити"
                  >
                    <ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <span className="px-2 text-xs font-mono text-slate-500 dark:text-slate-400 w-12 text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => zoomToSelected(zoom + 0.1)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Збільшити"
                  >
                    <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  </button>
                  <button
                    onClick={() => {
                      zoomToSelected(1);
                    }}
                    className="p-1.5 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    title="Скинути зум"
                  >
                    <Maximize className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
                <button
                  onClick={() => {
                    const next = !isCanvasExpanded;
                    setIsCanvasExpanded(next);
                    if (isFocusMode && typeof window !== 'undefined') {
                      const factor = next ? 0.9 : 0.8;
                      setFocusCanvasHeight(Math.round(window.innerHeight * factor));
                    }
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${isCanvasExpanded
                    ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-50'
                    : isDark
                      ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  title="Розгорнути плеєр"
                >
                  {isCanvasExpanded ? 'Менше' : 'Більше'}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={undo}
                    disabled={currentEdit.history.length === 0}
                    className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
                      }`}
                    title="Скасувати (Ctrl+Z)"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={currentEdit.future.length === 0}
                    className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
                      }`}
                    title="Повторити (Ctrl+Y)"
                  >
                    <Redo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      updateCurrentEdit(
                        { viewMode: currentEdit.viewMode === 'editor' ? 'preview' : 'editor' },
                        false
                      )
                    }
                    className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                      }`}
                    title={currentEdit.viewMode === 'editor' ? 'Перегляд обрізання' : 'Повернути редагування'}
                  >
                    {currentEdit.viewMode === 'editor' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={runAdminFfmpeg}
                disabled={adminLoading || (selectedCount === 0 && !activeVideo)}
                className={`p-2 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                title={
                  selectedCount > 0
                    ? `Запустити обрані (${selectedCount}) (FFmpeg job runner)`
                    : 'Запустити поточне (FFmpeg job runner)'
                }
              >
                <Play className="w-4 h-4" />
              </button>
              <button
                onClick={addVideosFromServer}
                disabled={adminLoading}
                className={`p-2 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                title="Підтягнути з теки (сервер)"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => setAdminOpen(true)}
              className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                }`}
              title="Адмінка"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setAdminOpen(true);
                setAdminHistoryOpen(false);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition flex items-center gap-1.5 ${isDark
                ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              title="AI інспекція"
            >
              <Bot className="w-3.5 h-3.5" /> AI інспекція
            </button>
            {isFocusMode && (
              <button
                onClick={() => setFocusSideOpen(true)}
                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                  }`}
                title="Відкрити меню"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsFocusMode(prev => !prev)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${isFocusMode
                ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-50'
                : isDark
                  ? 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              title="Режим перегляду"
            >
              {isFocusMode ? 'Звичайний' : 'Перегляд'}
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition ${isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              title="Змінити тему"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* WORKSPACE */}
        {!activeVideo ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Video className="w-16 h-16 opacity-10 mb-4" />
            <p>Оберіть або додайте відео</p>
            <label className="mt-4 flex items-center gap-2 cursor-pointer bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
              <Upload className="w-4 h-4" /> Завантажити
              <input type="file" accept="video/*" multiple onChange={handleFileChange} className="hidden" />
            </label>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
            {/* LEFT: PLAYER */}
            <div className="flex-1 flex flex-col p-4 lg:p-6 min-w-0 overflow-hidden relative">
              <div
                ref={viewportRef}
                className={`rounded-t-xl shadow-lg relative flex flex-col items-center justify-center flex-shrink-1 min-h-[300px] ${viewportHeightClass} select-none group border-b ${isFocusMode ? 'p-0' : 'p-8'
                  } overflow-auto ${isDark ? 'bg-black border-slate-800' : 'bg-zinc-900 border-zinc-800'
                  }`}
                style={isFocusMode ? { height: focusHeightPx } : undefined}
                onMouseEnter={() => {
                  viewportHoverRef.current = true;
                }}
                onMouseLeave={() => {
                  viewportHoverRef.current = false;
                  spacePanRef.current = false;
                }}
              >
                <div
                  ref={overlayRef}
                  className={`relative shadow-2xl inline-block ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  style={getPreviewStyle()}
                  onMouseDown={startPan}
                  onContextMenu={e => e.preventDefault()}
                >
                  <video
                    ref={videoRef}
                    src={activeVideo.url}
                    className="max-w-full block"
                    style={{ maxHeight: videoMaxHeight }}
                    onLoadedMetadata={handleMetadata}
                  />
                  {!(isProcessing && processingJob?.videoId === currentId) && currentEdit.meta.width > 0 && (
                    <div
                      className="absolute inset-0"
                      style={isFocusMode ? { zIndex: 9999, opacity: 0.7 } : undefined}
                    >
                      {currentEdit.viewMode === 'editor' && (
                        <>
                          <div className="absolute bg-black/60" style={{ left: 0, top: 0, right: 0, height: `${currentEdit.crop.t}%` }} />
                          <div className="absolute bg-black/60" style={{ left: 0, bottom: 0, right: 0, height: `${currentEdit.crop.b}%` }} />
                          <div className="absolute bg-black/60" style={{ left: 0, top: `${currentEdit.crop.t}%`, bottom: `${currentEdit.crop.b}%`, width: `${currentEdit.crop.l}%` }} />
                          <div className="absolute bg-black/60" style={{ right: 0, top: `${currentEdit.crop.t}%`, bottom: `${currentEdit.crop.b}%`, width: `${currentEdit.crop.r}%` }} />
                          <div
                            className="absolute border-2 border-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,0.3)] cursor-move"
                            style={{
                              top: `${currentEdit.crop.t}%`,
                              bottom: `${currentEdit.crop.b}%`,
                              left: `${currentEdit.crop.l}%`,
                              right: `${currentEdit.crop.r}%`
                            }}
                            onMouseDown={e => startDrag(e, { type: 'crop', action: 'move' })}
                          >
                            <div
                              className="absolute -top-2 -left-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nw-resize z-30"
                              onMouseDown={e => startDrag(e, { type: 'crop', action: 'resize', corner: 'tl' })}
                            />
                            <div
                              className="absolute -top-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-ne-resize z-30"
                              onMouseDown={e => startDrag(e, { type: 'crop', action: 'resize', corner: 'tr' })}
                            />
                            <div
                              className="absolute -bottom-2 -left-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-sw-resize z-30"
                              onMouseDown={e => startDrag(e, { type: 'crop', action: 'resize', corner: 'bl' })}
                            />
                            <div
                              className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-se-resize z-30"
                              onMouseDown={e => startDrag(e, { type: 'crop', action: 'resize', corner: 'br' })}
                            />
                          </div>
                        </>
                      )}
                      {currentEdit.elements.map(el => {
                        const isVisible = currentTime >= el.startTime && currentTime <= el.endTime;
                        if (!(isVisible || (currentEdit.viewMode === 'editor' && currentEdit.selectedId === el.id)))
                          return null;
                        return (
                          <div
                            key={el.id}
                            onMouseDown={e =>
                              currentEdit.viewMode === 'editor' &&
                              startDrag(e, { type: 'element', id: el.id, action: 'move' })
                            }
                            onClick={e => {
                              e.stopPropagation();
                              updateCurrentEdit({ selectedId: el.id }, false);
                            }}
                            className={`absolute ${currentEdit.viewMode === 'editor' ? 'cursor-grab active:cursor-grabbing hover:opacity-90' : ''
                              } ${currentEdit.selectedId === el.id && currentEdit.viewMode === 'editor' ? 'ring-1 ring-blue-400' : ''}`}
                            style={{
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.w}%`,
                              height: `${el.h}%`,
                              zIndex: 40,
                              opacity: isVisible ? 1 : 0.4
                            }}
                          >
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: el.isOutline ? 'transparent' : el.color,
                                border: el.isOutline ? `1px solid ${el.color}` : 'none',
                                borderRadius: el.type === 'circle' ? '9999px' : '0'
                              }}
                            />
                            {currentEdit.selectedId === el.id && currentEdit.viewMode === 'editor' && (
                              <>
                                <div
                                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-se-resize z-50 shadow"
                                  onMouseDown={e =>
                                    startDrag(e, { type: 'element', id: el.id, action: 'resize', corner: 'br' })
                                  }
                                />
                                <div
                                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-sw-resize z-50 shadow"
                                  onMouseDown={e =>
                                    startDrag(e, { type: 'element', id: el.id, action: 'resize', corner: 'bl' })
                                  }
                                />
                                <div
                                  className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-nw-resize z-50 shadow"
                                  onMouseDown={e =>
                                    startDrag(e, { type: 'element', id: el.id, action: 'resize', corner: 'tl' })
                                  }
                                />
                                <div
                                  className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-ne-resize z-50 shadow"
                                  onMouseDown={e =>
                                    startDrag(e, { type: 'element', id: el.id, action: 'resize', corner: 'tr' })
                                  }
                                />
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {isFocusMode && (
                  <div
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-2 rounded-full bg-white/20 border border-white/30 cursor-ns-resize"
                    onMouseDown={startFocusResize}
                    title="Змінити висоту відео"
                  />
                )}
              </div>

              {/* CONTROLS */}
              <div
                className={`${isFocusMode
                  ? 'absolute left-6 right-6 bottom-4 z-20 bg-transparent border-transparent shadow-none'
                  : 'p-4 rounded-b-xl shadow-sm border'
                  } ${isFocusMode
                    ? ''
                    : isDark
                      ? 'bg-slate-900 border-slate-800'
                      : 'bg-white border-slate-200'
                  }`}
              >
                {isFocusMode ? (
                  <div className="mb-2 space-y-2">
                    <div className="flex items-center gap-3 text-[11px] text-white/80">
                      <span className="font-mono">{currentTime.toFixed(3)} / {currentEdit.meta.duration.toFixed(3)}s</span>
                      <span className="text-white/60">Крок: {seekStep}s</span>
                      {activeSegments.length > 0 && (
                        <button
                          onClick={() => setPlaySegmentsOnly(prev => !prev)}
                          className={`px-2 py-0.5 rounded-full border text-[10px] ${playSegmentsOnly
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-white/10 border-white/30 text-white/70'
                            }`}
                          title="Грати лише сегменти"
                        >
                          Сегменти: {playSegmentsOnly ? 'ON' : 'OFF'}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeSegmentModesMeta.map(mode => {
                        const isActive = activeSegmentMode === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => setActiveSegmentMode(mode.id)}
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${isActive
                              ? mode.active
                              : 'bg-white/10 border-white/30 text-white/70 hover:border-white/60'
                              }`}
                          >
                            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${mode.dot}`} />
                            {mode.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={togglePlayback}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow ${isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                    </button>
                    <div className="font-mono text-sm opacity-60">
                      {currentTime.toFixed(3)} / {currentEdit.meta.duration.toFixed(3)}s
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Крок: {seekStep}s
                    </div>
                    {activeSegments.length > 0 && (
                      <button
                        onClick={() => setPlaySegmentsOnly(prev => !prev)}
                        className={`px-2 py-1 text-[10px] rounded-full border transition ${playSegmentsOnly
                          ? isDark
                            ? 'bg-emerald-700/40 border-emerald-500 text-emerald-200'
                            : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : isDark
                            ? 'bg-slate-800 border-slate-600 text-slate-300'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        title="Грати лише сегменти"
                      >
                        Сегменти: {playSegmentsOnly ? 'ON' : 'OFF'}
                      </button>
                    )}
                    <div className="flex-1"></div>
                    {currentEdit.processedUrl && !isProcessing && (
                      <span className="text-xs text-green-600 font-bold animate-pulse">Файл скачано!</span>
                    )}
                  </div>
                )}
                <div
                  className={`relative h-14 rounded-lg border select-none cursor-pointer group overflow-hidden ${isFocusMode
                    ? 'bg-black/20 border-white/20 backdrop-blur-sm'
                    : isDark
                      ? 'bg-slate-800 border-slate-700'
                      : 'bg-slate-100 border-slate-200'
                    }`}
                  ref={timelineRef}
                  onMouseDown={handleSeek}
                >
                  <div className={`absolute top-0 bottom-0 left-0 pointer-events-none ${isDark ? 'bg-slate-600/50' : 'bg-slate-200/50'}`} style={{ width: `${getPct(currentTime)}%` }} />
                  <div className="absolute top-0 bottom-0 left-0 bg-black/40 backdrop-blur-[1px] pointer-events-none border-r border-white/20 z-10" style={{ width: `${getPct(currentEdit.trim.start)}%` }}></div>
                  <div className="absolute top-0 bottom-0 right-0 bg-black/40 backdrop-blur-[1px] pointer-events-none border-l border-white/20 z-10" style={{ width: `${100 - getPct(currentEdit.trim.end)}%` }}></div>
                  <div
                    className="absolute top-0 bottom-0 border-t-2 border-b-2 border-indigo-500/30 pointer-events-none"
                    style={{ left: `${getPct(currentEdit.trim.start)}%`, right: `${100 - getPct(currentEdit.trim.end)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-4 bg-indigo-600 cursor-ew-resize z-20 hover:brightness-110 shadow-lg flex items-center justify-center group/handle"
                    style={{ left: `${getPct(currentEdit.trim.start)}%`, transform: 'translateX(-50%)' }}
                    onMouseDown={e => startDrag(e, { type: 'trim-start' })}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-6 bg-white/50 rounded-full"></div>
                  </div>
                  <div
                    className="absolute top-0 bottom-0 w-4 bg-indigo-600 cursor-ew-resize z-20 hover:brightness-110 shadow-lg flex items-center justify-center group/handle"
                    style={{ left: `${getPct(currentEdit.trim.end)}%`, transform: 'translateX(-50%)' }}
                    onMouseDown={e => startDrag(e, { type: 'trim-end' })}
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="w-0.5 h-6 bg-white/50 rounded-full"></div>
                  </div>
                  {allSegmentsByMode.map(group =>
                    group.segments.map(seg => {
                      const isActive = group.meta.id === activeSegmentMode;
                      return (
                        <div
                          key={`${group.meta.id}-${seg.id}`}
                          className={`absolute top-7 h-3 rounded border ${group.meta.track} ${isActive ? 'cursor-grab' : 'pointer-events-none opacity-40'
                            }`}
                          style={{ left: `${getPct(seg.start)}%`, width: `${getPct(seg.end - seg.start)}%` }}
                          onMouseDown={
                            isActive
                              ? e => startDrag(e, { type: 'segment', id: seg.id, action: 'move' })
                              : undefined
                          }
                        >
                          {isActive && (
                            <>
                              <div
                                className={`absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 border rounded-full cursor-ew-resize ${activeSegmentMeta.handle}`}
                                onMouseDown={e => startDrag(e, { type: 'segment', id: seg.id, action: 'resize-start' })}
                              />
                              <div
                                className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 border rounded-full cursor-ew-resize ${activeSegmentMeta.handle}`}
                                onMouseDown={e => startDrag(e, { type: 'segment', id: seg.id, action: 'resize-end' })}
                              />
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                  {currentEdit.elements.map(el => (
                    <div
                      key={el.id}
                      className={`absolute top-1 h-1.5 rounded-full pointer-events-none opacity-60 ${currentEdit.selectedId === el.id ? 'bg-yellow-500 z-10' : isDark ? 'bg-slate-500' : 'bg-slate-400'
                        }`}
                      style={{ left: `${getPct(el.startTime)}%`, width: `${getPct(el.endTime - el.startTime)}%` }}
                    />
                  ))}
                  <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-[0_0_5px_rgba(239,68,68,0.8)]" style={{ left: `${getPct(currentTime)}%` }}>
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 transform rotate-45"></div>
                  </div>
                </div>
                {segmentTotal > 0 && (
                  <div
                    className={`relative mt-3 h-10 rounded-lg border select-none cursor-pointer overflow-hidden ${isFocusMode
                      ? 'bg-black/20 border-white/20 backdrop-blur-sm'
                      : isDark
                        ? 'bg-slate-900 border-slate-700'
                        : 'bg-white border-slate-200'
                      }`}
                    onMouseDown={handleSegmentSeek}
                    title="Навігація по сегментах"
                  >
                    <div
                      className={`absolute inset-0 ${isFocusMode ? 'bg-black/10' : isDark ? 'bg-slate-800/40' : 'bg-slate-50'
                        }`}
                    />
                    {activeSegments.map((seg, index) => {
                      const segLen = Math.max(0, seg.end - seg.start);
                      const left =
                        segmentTotal > 0
                          ? (getSegmentTotal(activeSegments.slice(0, index)) / segmentTotal) * 100
                          : 0;
                      const width = segmentTotal > 0 ? (segLen / segmentTotal) * 100 : 0;
                      return (
                        <div
                          key={seg.id}
                          className={`absolute top-2 bottom-2 rounded border ${activeSegmentMeta.track}`}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none shadow-[0_0_5px_rgba(244,63,94,0.8)]"
                      style={{
                        left: `${segmentTotal > 0 ? (segmentOffset / segmentTotal) * 100 : 0}%`
                      }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-rose-500 transform rotate-45"></div>
                    </div>
                  </div>
                )}
              </div>
              <video ref={processingVideoRef} src={processingSrc || activeVideo?.url || undefined} className="hidden" />
            </div>

            {/* RIGHT: PROPERTIES */}
            {!isFocusMode && (
              <div
                className={`w-full lg:w-80 border-l p-6 overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
              >
                <div className="mb-8">
                <button
                  onClick={addCircle}
                  className={`mt-3 w-full py-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Circle className="w-4 h-4" /> Додати коло
                </button>
              </div>
                <div className={`mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    onClick={openFfmpegModal}
                    disabled={!activeVideo}
                    className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-400"
                  >
                    Показати команду
                  </button>
                  <button
                    onClick={openFfmpegBatchModal}
                    disabled={playlist.filter(p => p.checked).length === 0}
                    className="mt-2 w-full py-2 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white disabled:bg-slate-400"
                  >
                    Масовий експорт (обрані)
                  </button>
                </div>
                <div className={`mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <button
                    onClick={() => activeVideo && toggleNotRelevant(activeVideo.id)}
                    disabled={!activeVideo}
                    className={`mt-3 w-full py-2 rounded-lg text-xs font-bold border ${activeVideo?.notRelevant
                      ? 'bg-rose-600 border-rose-500 text-white'
                      : isDark
                        ? 'bg-slate-900 border-slate-700 text-slate-200'
                        : 'bg-white border-slate-300 text-slate-700'
                      }`}
                  >
                    {activeVideo?.notRelevant ? 'Not relevant: ON' : 'Not relevant: OFF'}
                  </button>
                </div>
                <div className={`mb-8 p-4 rounded-xl border space-y-3 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">Сегменти (експорт)</h3>
                    <button
                      onClick={clearSegments}
                      disabled={activeSegments.length === 0}
                      className="text-[10px] text-red-500 disabled:opacity-40"
                    >
                      Очистити
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeSegmentModesMeta.map(mode => {
                      const isActive = activeSegmentMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          onClick={() => setActiveSegmentMode(mode.id)}
                          className={`px-2 py-1 rounded-full text-[10px] font-bold border ${isActive
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] opacity-50">Початок</label>
                        <button
                          onClick={() => setSegmentDraft(prev => ({ ...prev, start: currentTime }))}
                          className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          title="Встановити поточний (M)"
                        >
                          <Target className="w-3 h-3" /> M
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={Number.isFinite(segmentDraft.start) ? segmentDraft.start.toFixed(3) : ''}
                        onChange={e =>
                          setSegmentDraft(prev => ({
                            ...prev,
                            start: e.target.value === '' ? null : parseNumericInput(e.target.value)
                          }))
                        }
                        data-segment-input="true"
                        ref={segmentStartRef}
                        className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                          }`}
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] opacity-50">Кінець</label>
                        <button
                          onClick={() => setSegmentDraft(prev => ({ ...prev, end: currentTime }))}
                          className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                            }`}
                          title="Встановити поточний (/)"
                        >
                          <Target className="w-3 h-3" /> /
                        </button>
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={Number.isFinite(segmentDraft.end) ? segmentDraft.end.toFixed(3) : ''}
                        onChange={e =>
                          setSegmentDraft(prev => ({
                            ...prev,
                            end: e.target.value === '' ? null : parseNumericInput(e.target.value)
                          }))
                        }
                        data-segment-input="true"
                        ref={segmentEndRef}
                        className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                          }`}
                        placeholder="0.0"
                      />
                    </div>
                  </div>
                  <button
                    onClick={addSegmentFromDraft}
                    className="w-full py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Додати сегмент
                  </button>
                  <div className="space-y-2">
                    {activeSegments.length === 0 && (
                      <div className="text-[10px] text-slate-400">Немає сегментів для експорту</div>
                    )}
                    {activeSegments.map((seg, idx) => (
                      <div key={seg.id} className="flex items-center gap-2 text-[10px]">
                        <div className="text-slate-400 w-5 text-right">{idx + 1}</div>
                        <input
                          type="number"
                          step="0.1"
                          value={seg.start.toFixed(3)}
                          onChange={e => {
                            const next = parseNumericInput(e.target.value);
                            if (!Number.isFinite(next)) return;
                            updateSegment(seg.id, { start: next });
                          }}
                          className={`w-16 p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                            }`}
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          step="0.1"
                          value={seg.end.toFixed(3)}
                          onChange={e => {
                            const next = parseNumericInput(e.target.value);
                            if (!Number.isFinite(next)) return;
                            updateSegment(seg.id, { end: next });
                          }}
                          className={`w-16 p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                            }`}
                        />
                        <button
                          onClick={() => moveSegment(seg.id, -1)}
                          className="px-1 text-slate-400 hover:text-slate-700"
                          title="Вгору"
                        >
                          Up
                        </button>
                        <button
                          onClick={() => moveSegment(seg.id, 1)}
                          className="px-1 text-slate-400 hover:text-slate-700"
                          title="Вниз"
                        >
                          Down
                        </button>
                        <button
                          onClick={() => removeSegment(seg.id)}
                          className="px-1 text-red-500"
                          title="Видалити"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Під час експорту використовуються сегменти. Якщо сегментів немає — застосовується Trim.
                  </div>
                </div>
                {selectedElement ? (
                  <div className={`p-4 rounded-xl border space-y-4 animate-in fade-in ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <h3 className="font-bold text-sm">Налаштування</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={() => duplicateElement(selectedElement.id)}
                          className={`p-1.5 rounded transition ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
                          title="Дублювати"
                        >
                          <Repeat className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => copyAttributes(selectedElement)}
                          className={`p-1.5 rounded transition ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'}`}
                          title="Копіювати налаштування"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => pasteAttributes(selectedElement.id)}
                          disabled={!copiedAttributes}
                          className={`p-1.5 rounded transition disabled:opacity-30 disabled:hover:bg-transparent ${isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'
                            }`}
                          title="Вставити налаштування"
                        >
                          <Clipboard className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteElement(selectedElement.id)}
                          className="p-1.5 rounded transition hover:bg-red-100 text-red-500"
                          title="Видалити"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-bold opacity-70">
                        <Clock className="w-3 h-3" /> Час появи (M /)
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] opacity-50">З</label>
                            <button
                              onClick={() => updateElement(selectedElement.id, { startTime: currentTime })}
                              className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                }`}
                              title="Встановити поточний (M)"
                            >
                              <Target className="w-3 h-3" /> M
                            </button>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedElement.startTime.toFixed(3)}
                            onChange={e => updateElement(selectedElement.id, { startTime: Number(e.target.value) })}
                            className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                              }`}
                          />
                        </div>
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] opacity-50">До</label>
                            <button
                              onClick={() => updateElement(selectedElement.id, { endTime: currentTime })}
                              className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                                }`}
                              title="Встановити поточний (/)"
                            >
                              <Target className="w-3 h-3" /> /
                            </button>
                          </div>
                          <input
                            type="number"
                            step="0.1"
                            value={selectedElement.endTime.toFixed(3)}
                            onChange={e => updateElement(selectedElement.id, { endTime: Number(e.target.value) })}
                            className={`w-full text-xs p-1 rounded border ${isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                              }`}
                          />
                        </div>а
                      </div>
                    </div>
                    <div className={`space-y-2 pt-2 border-t ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                      <label className="text-xs font-bold opacity-70 block">Стиль</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateElement(selectedElement.id, { isOutline: true, color: '#ffffff', thickness: 1 })}
                          className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${selectedElement.isOutline
                            ? isDark
                              ? 'bg-slate-700 border-slate-500'
                              : 'bg-slate-800 text-white'
                            : isDark
                              ? 'bg-slate-800 border-slate-700'
                              : 'bg-white border-slate-300'
                            }`}
                          title="Контур"
                        >
                          <BoxSelect className="w-4 h-4" /> <span className="text-[10px]">Контур</span>
                        </button>
                        <button
                          onClick={() => updateElement(selectedElement.id, { isOutline: false, color: '#000000' })}
                          className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${!selectedElement.isOutline
                            ? isDark
                              ? 'bg-slate-700 border-slate-500'
                              : 'bg-slate-800 text-white'
                            : isDark
                              ? 'bg-slate-800 border-slate-700'
                              : 'bg-white border-slate-300'
                            }`}
                          title="Заливка"
                        >
                          <Square className="w-4 h-4 fill-current" /> <span className="text-[10px]">Заливка</span>
                        </button>
                      </div>
                      <div className="flex gap-2 items-center justify-center pt-2">
                        <button
                          onClick={() => updateElement(selectedElement.id, { color: '#000000', isOutline: false })}
                          className="w-8 h-8 bg-black rounded border border-slate-500 hover:scale-110 transition shadow-sm"
                          title="Чорний"
                        ></button>
                        <button
                          onClick={() => updateElement(selectedElement.id, { color: '#ffffff' })}
                          className="w-8 h-8 bg-white rounded border border-slate-300 hover:scale-110 transition shadow-sm"
                          title="Білий"
                        ></button>
                        <input
                          type="color"
                          value={selectedElement.color}
                          onChange={e => updateElement(selectedElement.id, { color: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                    {selectedElement.isOutline && (
                      <div className="space-y-1">
                        <label className="text-[10px] opacity-50">Товщина</label>
                        <div className="text-[10px] text-slate-400">1px (фіксована)</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-8 text-center text-xs border border-dashed rounded-xl ${isDark ? 'border-slate-700 bg-slate-800 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                    Натисніть на фігуру на відео або таймлайні, щоб редагувати її
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div >
  );
}
