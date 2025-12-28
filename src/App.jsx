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
  BoxSelect
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
  const [suffixFilter, setSuffixFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

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
  const sidebarResizingRef = useRef(false);
  const sidebarResizeStartRef = useRef({ x: 0, width: 256 });

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
  const activeSuffix = activeVideo?.suffix || '';
  const activeSuffixPreset = SUFFIX_PRESETS.includes(activeSuffix) ? activeSuffix : null;
  const RCLONE_REMOTE = 'gdrive';
  const RCLONE_FOLDER = '22.12.2025 [ATV&Drone]';
  const SHEET_ID = '1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ';
  const SHEET_GID = '1651996986';
  const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
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
    } catch (e) {}
  };
  const getFileKey = file => `${file.name}|${file.size}|${file.lastModified}`;
  const buildEditFromSaved = saved => {
    if (!saved) return null;
    return {
      ...defaultEditState,
      trim: saved.trim ? { ...saved.trim } : defaultEditState.trim,
      crop: saved.crop ? { ...saved.crop } : defaultEditState.crop,
      elements: Array.isArray(saved.elements) ? saved.elements.map(el => ({ ...el })) : [],
      segments: Array.isArray(saved.segments) ? saved.segments.map(seg => ({ ...seg })) : [],
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
  }, []);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.prefs, {
      isDark,
      batchSuffix,
      seekStep,
      uploadToDrive,
      sidebarWidth
    });
  }, [isDark, batchSuffix, seekStep, uploadToDrive, sidebarWidth]);

  useEffect(() => {
    const savedList = loadFromStorage(STORAGE_KEYS.playlist, []);
    if (!Array.isArray(savedList) || savedList.length === 0) return;
    const normalized = savedList
      .filter(item => item?.fileKey)
      .map(item => ({
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
        notRelevant: !!item.notRelevant
      }));
    const fileKeyCounts = new Map();
    normalized.forEach(item => {
      if (!item?.fileKey) return;
      fileKeyCounts.set(item.fileKey, (fileKeyCounts.get(item.fileKey) || 0) + 1);
    });
    const savedEdits = savedEditsRef.current || {};
    setPlaylist(normalized);
    setEdits(prev => {
      const next = { ...prev };
      normalized.forEach(item => {
        const restored = buildEditFromSaved(
          getSavedEditForVideo(savedEdits, item, fileKeyCounts)
        );
        if (restored) next[item.id] = restored;
      });
      return next;
    });
    if (!currentId && normalized[0]) setCurrentId(normalized[0].id);
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
      notRelevant: !!v.notRelevant
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
      segments: oldEdit.segments,
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
        const relevantKeys = ['trim', 'crop', 'elements', 'segments'];
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
      segments: currentEdit.segments,
      meta: currentEdit.meta
    };
    const newEdit = {
      ...currentEdit,
      ...previousState,
      history: remainingHistory,
      future: [currentStateSnapshot, ...currentEdit.future].slice(0, MAX_HISTORY)
    };
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
      segments: currentEdit.segments,
      meta: currentEdit.meta
    };
    const newEdit = {
      ...currentEdit,
      ...nextState,
      history: [currentStateSnapshot, ...currentEdit.history].slice(0, MAX_HISTORY),
      future: remainingFuture
    };
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
        const res = await fetch(SHEET_CSV_URL);
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
        vid.play().catch(() => {});
      }
      return;
    }
    const currentSeg = segments[inIndex];
    if (isPlayingRef.current && time >= currentSeg.end - epsilon) {
      const next = segments[inIndex + 1];
      if (next) {
        vid.currentTime = next.start;
        vid.play().catch(() => {});
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
      counts.set(item.fileKey, (counts.get(item.fileKey) || 0) + 1);
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
    const mode = normalizeName(video?.sheetMode);
    if (mode.includes('analog')) return true;
    const suffix = normalizeName(video?.suffix);
    return suffix.includes('analog');
  };
  const isThermalVariant = video => {
    const camera = normalizeName(video?.sheetCameraType);
    if (camera.includes('thermal') || camera.includes('infrared')) return true;
    const suffix = normalizeName(video?.suffix);
    return suffix.includes('thermal');
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
    const outputDir = options.outputDir || 'cutted';
    const useBatchSuffix = options.useBatchSuffix || false;
    const allowRenameOriginal = options.allowRenameOriginal !== false;
    const doneDir = options.doneDir || 'done';
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
    const baseSegments =
      Array.isArray(edit.segments) && edit.segments.length > 0
        ? edit.segments
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
    const name = video.name || 'input.mp4';
    const dot = name.lastIndexOf('.');
    const baseName = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot + 1) : 'mp4';
    const perVideoSuffix = video?.suffix || '';
    const extraBatchSuffix = useBatchSuffix && batchSuffix ? batchSuffix : '';
    const suffix = `${perVideoSuffix}${extraBatchSuffix}`;
    const outputName = `${baseName}${suffix}.${ext}`;
    const inputPath = name.startsWith('./') ? name : `./${name}`;
    const outputPath = `${outputDir}/${outputName}`;
    if (video.notRelevant) {
      const notRelevantPath = `${doneDir}/${baseName}_not_relevant.${ext}`;
      const moveLine = `[ -e "${inputPath}" ] && [ ! -e "${notRelevantPath}" ] && mkdir -p "${doneDir}" && mv "${inputPath}" "${notRelevantPath}"`;
      return { lines: [moveLine], usesTemp: false, needsOutputDir: false };
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
            `ffmpeg -ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
              3
            )} -i "${inputPath}" -c copy -an -movflags +faststart "${outputPath}"`,
            ...(rcloneLine ? [rcloneLine] : []),
            ...(renameLine ? [renameLine] : [])
          ],
          usesTemp: false,
          needsOutputDir: true
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
            `ffmpeg -ss ${seg.start.toFixed(3)} -to ${seg.end.toFixed(
              3
            )} -i "${inputPath}" -c copy -an "${seg.path}"`
        ),
        `printf "${listLines}\\n" > "${listPath}"`,
        `ffmpeg -f concat -safe 0 -i "${listPath}" -c copy -an "${outputPath}"`,
        ...(rcloneLine ? [rcloneLine] : []),
        `rm -f "${listPath}" ${segmentFiles.map(seg => `"${seg.path}"`).join(' ')}`,
        ...(renameLine ? [renameLine] : [])
      ];
      return { lines, usesTemp: true, needsOutputDir: true };
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
        `${segmentLabels.map(label => `[${label}]`).join('')}concat=n=${
          segmentLabels.length
        }:v=1:a=0[${outputLabel}]`
      );
    }
    const graph = filterLines.join(';');
    const rcloneLine = buildRcloneCopyLine(outputPath);
    return {
      lines: [
        `ffmpeg -i "${inputPath}" -filter_complex "${graph}" -map "[${outputLabel}]" -an -c:v libx264 -crf 18 -preset slow -movflags +faststart "${outputPath}"`,
        ...(rcloneLine ? [rcloneLine] : []),
        ...(renameLine ? [renameLine] : [])
      ],
      usesTemp: false,
      needsOutputDir: true
    };
  };
  const buildFfmpegCommand = () => {
    if (!activeVideo) return '';
    const edit = currentEdit || defaultEditState;
    const currentList = playlistRef.current.length ? playlistRef.current : playlist;
    const fileKeyCounts = getFileKeyCounts(currentList);
    const fileKeyVariants = getFileKeyVariants(currentList);
    const allowRenameOriginal = allowDoneForVideo(activeVideo, fileKeyCounts, fileKeyVariants);
    const result = buildFfmpegLinesFor(activeVideo, edit, {
      useBatchSuffix: false,
      allowRenameOriginal
    });
    if (result.error) return '';
    const needsTemp = result.usesTemp;
    const needsOutputDir = result.needsOutputDir !== false;
    const lines = [
      ...(needsOutputDir ? [`mkdir -p "cutted"`] : []),
      ...(needsOutputDir && needsTemp ? [`mkdir -p "cutted/_tmp"`] : []),
      ...result.lines
    ];
    return lines.join('\n');
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
    let needsOutputDir = false;
    selected.forEach(video => {
      const edit = edits[video.id] || defaultEditState;
      const allowRenameOriginal = allowDoneForVideo(video, fileKeyCounts, fileKeyVariants);
      const result = buildFfmpegLinesFor(video, edit, {
        useBatchSuffix: true,
        allowRenameOriginal
      });
      if (result.error) {
        skipped.push(video.name || video.id);
        return;
      }
      if (result.usesTemp) needsTemp = true;
      if (result.needsOutputDir !== false) needsOutputDir = true;
      lines.push(`# ${video.name || video.id}`);
      lines.push(...result.lines);
      lines.push('');
    });
    if (lines.length === 0) {
      showHud("Немає валідних відео для FFmpeg");
      return;
    }
    const header = [
      ...(needsOutputDir ? [`mkdir -p "cutted"`] : []),
      ...(needsOutputDir && needsTemp ? [`mkdir -p "cutted/_tmp"`] : []),
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
  const toggleGroupCollapsed = key => {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }));
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
  // --- BATCH LOGIC ---
  const toggleSelection = (e, id) => {
    e.stopPropagation();
    setPlaylist(prev =>
      prev.map(vid => (vid.id === id ? { ...vid, checked: !vid.checked } : vid))
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = new Set(filteredPlaylist.map(p => p.id));
    const allSelected = filteredPlaylist.length > 0 && filteredPlaylist.every(p => p.checked);
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
    const existingById = new Map(playlistRef.current.map(v => [v.id, v]));
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
      orderedEntries.forEach(entry => {
        const rowIndex = entry?.rowIndex;
        const id = rowIndex ? `${fileKey}::row${rowIndex}` : fileKey;
        const existingItem = existingById.get(id);
        const suffix = entry
          ? resolveSuffixFromMode(entry.analogDigital, entry.cameraType)
          : '';
        if (existingItem && (existingItem.file || existingItem.url)) return;
        const url = URL.createObjectURL(file);
        const baseItem = {
          id,
          file,
          url,
          name: file.name,
          checked: false,
          suffix,
          notRelevant: existingItem?.notRelevant || false,
          fileKey,
          type: file.type,
          size: file.size,
          lastModified: file.lastModified,
          isLoading: false,
          sheetRow: rowIndex || null,
          sheetMode: entry?.analogDigital || '',
          sheetCameraType: entry?.cameraType || '',
          sheetStatus: entry?.status || ''
        };
        if (existingItem) {
          replacements.push({ ...baseItem, suffix: existingItem.suffix || suffix });
          return;
        }
        newVideos.push(baseItem);
      });
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
      if (isPlayingRef.current) vid.play().catch(() => {});
      setCurrentTime(vid.currentTime);
    }
    if (isPlayingRef.current) segmentLoopStartRef.current?.();
  }, [playSegmentsOnly, currentId]);

  useEffect(() => {
    segmentsRef.current = (currentEdit.segments || [])
      .map(seg => ({
        start: Number.isFinite(seg.start) ? seg.start : 0,
        end: Number.isFinite(seg.end) ? seg.end : 0
      }))
      .filter(seg => seg.end > seg.start)
      .sort((a, b) => a.start - b.start);
  }, [currentEdit.segments, currentId]);

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
    if (!currentVideo || currentVideo.url || !currentVideo.fileKey) return;
    let canceled = false;
    const load = async () => {
      setPlaylist(prev =>
        prev.map(v => (v.id === currentId ? { ...v, isLoading: true } : v))
      );
      let record = null;
      try {
        record = await idbGetVideo(currentVideo.fileKey);
      } catch (e) {}
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
    const nextSegments = currentEdit.segments.map(seg => {
      const start = clampTime(seg.start ?? 0);
      let end = clampTime(seg.end ?? duration);
      if (end <= start) end = clampTime(start + 0.1);
      return { ...seg, start, end };
    });
    updateCurrentEdit(
      {
        meta: { duration, width: vid.videoWidth, height: vid.videoHeight },
        trim: nextTrim,
        elements: nextElements,
        segments: nextSegments
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
    if (!videoRef.current || currentEdit.segments.length === 0) return;
    const total = getSegmentTotal(currentEdit.segments);
    if (!total) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const perc = Math.max(0, Math.min(1, x / rect.width));
    const offset = perc * total;
    const nextTime = getTimeForSegmentOffset(offset, currentEdit.segments);
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
    updateCurrentEdit({ segments: [...currentEdit.segments, newSegment] });
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
    updateCurrentEdit({
      segments: currentEdit.segments.map(seg =>
        seg.id === id ? normalizeSegment({ ...seg, ...updates }) : seg
      )
    });
  };

  const removeSegment = id => {
    updateCurrentEdit({ segments: currentEdit.segments.filter(seg => seg.id !== id) });
  };

  const moveSegment = (id, direction) => {
    const index = currentEdit.segments.findIndex(seg => seg.id === id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= currentEdit.segments.length) return;
    const next = [...currentEdit.segments];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    updateCurrentEdit({ segments: next });
  };

  const clearSegments = () => {
    if (currentEdit.segments.length === 0) return;
    if (!window.confirm("Очистити всі сегменти?")) return;
    updateCurrentEdit({ segments: [] });
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
      } catch (e) {}
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
      idbDeleteVideo(currentVideo.fileKey).catch(() => {});
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
    }).catch(() => {});
    const resetEdit = {
      ...defaultEditState,
      trim: { ...defaultEditState.trim },
      crop: { ...defaultEditState.crop },
      elements: [],
      segments: [],
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
      const seg = currentEdit.segments.find(s => s.id === targetInfo.id);
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
    if (!jobVideo.file) {
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
    const { trim, elements, meta, segments } = jobEdit;

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
        } catch (e) {}
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
    } catch (e) {}
    const stream = canvas.captureStream(targetFps);
    const frameEpsilon = targetFps > 0 ? 1 / targetFps : 0.04;

    let mimeType = 'video/webm';
    if (jobVideo.file.type.includes('mp4') && MediaRecorder.isTypeSupported('video/mp4'))
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
        } catch (e) {}
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
    const hasSegments = Array.isArray(edit.segments) && edit.segments.length > 0;
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
  const filteredPlaylist = useMemo(() => {
    const query = normalizeName(searchQuery);
    return playlist.filter(p => {
      if (suffixFilter === 'none' && p.suffix) return false;
      if (suffixFilter !== 'all' && suffixFilter !== 'none' && p.suffix !== suffixFilter) {
        return false;
      }
      if (!query) return true;
      return normalizeName(p.name).includes(query);
    });
  }, [playlist, suffixFilter, searchQuery]);
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
  const selectedCount = playlist.filter(p => p.checked).length;
  const isAllSelected =
    filteredPlaylist.length > 0 && filteredPlaylist.every(p => p.checked);
  // Batch Progress: (Total - Queue) / Total
  const batchProgressPercent =
    batchTotal > 0 ? ((batchTotal - batchQueue.length) / batchTotal) * 100 : 0;
  const segmentTotal = currentEdit.segments.length > 0 ? getSegmentTotal(currentEdit.segments) : 0;
  const segmentOffset = segmentTotal > 0 ? getSegmentOffsetForTime(currentTime, currentEdit.segments) : 0;

  return (
    <div
      tabIndex={0}
      className={`flex h-screen overflow-hidden ${
        isDark ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'
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
                className={`rounded-lg border shadow-lg p-3 ${
                  isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
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
                    className={`h-full transition-all ${
                      note.status === 'done' ? 'bg-emerald-500' : note.status === 'canceled' ? 'bg-rose-400' : 'bg-indigo-500'
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

      {/* SIDEBAR */}
      <div
        className={`border-r flex flex-col flex-shrink-0 z-20 hidden md:flex transition-colors relative ${
          isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
        }`}
        style={{ width: sidebarWidth }}
      >
        <div
          className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize ${
            isDark ? 'bg-slate-800/60' : 'bg-slate-100'
          }`}
          onMouseDown={startSidebarResize}
          title="Змінити ширину"
        />
        <div className={`p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
              <Film className="w-5 h-5 text-indigo-500" />
            </h2>
            {filteredPlaylist.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleSelectAll}
                  className={`text-[11px] leading-none hover:underline ${
                    isDark ? 'text-indigo-400' : 'text-indigo-600'
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
                        filteredPlaylist.some(item => item.id === p.id)
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
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">Суфікс</span>
              <select
                value={suffixFilter}
                onChange={e => setSuffixFilter(e.target.value)}
                className={`text-[10px] rounded border px-2 py-1 ${
                  isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <option value="all">Усі</option>
                <option value="none">Без суфіксу</option>
                {suffixOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full text-[10px] rounded border px-2 py-1 ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
              }`}
              placeholder="Пошук по назві..."
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {groupedPlaylist.map(([groupKey, items]) => {
            const label = groupKey === '__none__' ? 'Без суфіксу' : groupKey;
            const isCollapsed = !!collapsedGroups[groupKey];
            return (
              <div key={groupKey} className="space-y-2">
                <button
                  onClick={() => toggleGroupCollapsed(groupKey)}
                  className={`w-full flex items-center justify-between text-xs font-bold px-2 py-1 rounded border ${
                    isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px]">{isCollapsed ? '>' : 'v'}</span>
                    {label}
                  </span>
                  <span className="text-[10px] opacity-60">{items.length}</span>
                </button>
                {!isCollapsed &&
                  items.map(vid => {
                    const meta = edits[vid.id]?.meta;
                    const sizeLabel =
                      meta?.width && meta?.height ? `${meta.width}x${meta.height}` : '';
                    const durationLabel =
                      meta?.duration ? `${meta.duration.toFixed(1)}s` : '';
                    const metaLabel = [sizeLabel, durationLabel].filter(Boolean).join(' • ');
                    return (
                      <div
                        key={vid.id}
                        onClick={() => switchVideo(vid.id)}
                        className={`p-3 rounded-lg cursor-pointer group relative flex items-start gap-2 transition ${
                          currentId === vid.id
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
                          className={`mt-0.5 flex-shrink-0 p-1 ${
                            vid.checked ? 'text-indigo-600' : 'text-slate-300 hover:text-slate-400'
                          }`}
                        >
                          {vid.checked ? <CheckSquare className="w-5 h-5" /> : <SquareIcon className="w-5 h-5" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium text-sm truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                            {vid.name}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span>ID: {vid.id.substr(0, 4)}</span>
                            {metaLabel && <span className="text-[10px]">{metaLabel}</span>}
                            {isVideoEdited(edits[vid.id]) && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">
                                Змінено
                              </span>
                            )}
                            {vid.sheetCameraType && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                {vid.sheetCameraType}
                              </span>
                            )}
                            {vid.sheetMode && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                                {vid.sheetMode}
                              </span>
                            )}
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
                    );
                  })}
              </div>
            );
          })}
          {playlist.length === 0 && <div className="text-center p-4 text-xs text-slate-400">Список порожній</div>}
          {playlist.length > 0 && filteredPlaylist.length === 0 && (
            <div className="text-center p-4 text-xs text-slate-400">Немає відео для цього фільтра</div>
          )}
        </div>

        <div
          className={`p-4 border-t space-y-3 ${
            isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
            <Save className="w-3 h-3" /> Налаштування експорту
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">Завантажувати в Drive</span>
            <button
              onClick={() => setUploadToDrive(prev => !prev)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                uploadToDrive
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-slate-200 border-slate-300 text-slate-600'
              }`}
            >
              {uploadToDrive ? 'ON' : 'OFF'}
            </button>
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Додатковий суфікс масового експорту</label>
            <input
              type="text"
              value={batchSuffix}
              onChange={e => setBatchSuffix(e.target.value)}
              className={`w-full text-xs p-1.5 rounded border ${
                isDark ? 'bg-slate-700 border-slate-600 text-slate-200' : 'bg-white border-slate-300'
              }`}
              placeholder="(необов'язково)"
            />
          </div>

          {isBatchMode && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Обробка черги...</span>
                <span>
                  {batchTotal - batchQueue.length} / {batchTotal}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${batchProgressPercent}%` }}></div>
              </div>
            </div>
          )}

          {playlist.length > 0 && (
            <button
              onClick={startBatchExport}
              disabled={isBatchMode || isProcessing}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2"
            >
              {isBatchMode ? (
                'В роботі...'
              ) : (
                <>
                  <Layers className="w-3 h-3" /> Масовий експорт (командами) ({selectedCount})
                </>
              )}
            </button>
          )}
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

      {/* MAIN AREA */}
      <div className={`flex-1 flex flex-col min-w-0 ${isDark ? 'bg-slate-950' : 'bg-slate-100'}`}>
        {/* TOP BAR */}
        <div
          className={`h-16 border-b flex items-center justify-between px-6 flex-shrink-0 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-500 p-1.5 rounded-lg text-white">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    onClick={() => copyVideoName(activeVideo?.name, activeVideo?.id)}
                    className={`font-bold text-lg leading-tight cursor-pointer select-none ${
                      isDark ? 'text-slate-100 hover:text-emerald-300' : 'text-slate-800 hover:text-emerald-600'
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
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition ${
                            isActive
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
              </div>
            </div>
          </div>
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={undo}
                    disabled={currentEdit.history.length === 0}
                    className={`p-2 rounded-lg transition ${
                      isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
                    }`}
                    title="Скасувати (Ctrl+Z)"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                  <button
                    onClick={redo}
                    disabled={currentEdit.future.length === 0}
                    className={`p-2 rounded-lg transition ${
                      isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
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
                    className={`p-2 rounded-lg transition ${
                      isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
                    }`}
                    title={currentEdit.viewMode === 'editor' ? 'Перегляд обрізання' : 'Повернути редагування'}
                  >
                    {currentEdit.viewMode === 'editor' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              </>
            )}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition ${
                isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            <div className="flex-1 flex flex-col p-4 lg:p-6 min-w-0 overflow-hidden">
              <div
                ref={viewportRef}
                className={`rounded-t-xl shadow-lg relative flex flex-col items-center justify-center flex-shrink-1 min-h-[300px] lg:h-[60vh] select-none group border-b p-8 overflow-auto ${
                  isDark ? 'bg-black border-slate-800' : 'bg-zinc-900 border-zinc-800'
                }`}
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
                    className="max-h-[calc(60vh-4rem)] max-w-full block"
                    onLoadedMetadata={handleMetadata}
                  />
                  {!(isProcessing && processingJob?.videoId === currentId) && currentEdit.meta.width > 0 && (
                    <div className="absolute inset-0">
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
                            className={`absolute ${
                              currentEdit.viewMode === 'editor' ? 'cursor-grab active:cursor-grabbing hover:opacity-90' : ''
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
              </div>

              {/* CONTROLS */}
              <div className={`p-4 rounded-b-xl shadow-sm border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={togglePlayback}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow ${
                      isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'
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
                  {currentEdit.segments.length > 0 && (
                    <button
                      onClick={() => setPlaySegmentsOnly(prev => !prev)}
                      className={`px-2 py-1 text-[10px] rounded-full border transition ${
                        playSegmentsOnly
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
                <div
                  className={`relative h-14 rounded-lg border select-none cursor-pointer group overflow-hidden ${
                    isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
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
                  {currentEdit.segments.map(seg => (
                    <div
                      key={seg.id}
                      className="absolute top-7 h-3 rounded bg-emerald-500/70 border border-emerald-300/40 cursor-grab"
                      style={{ left: `${getPct(seg.start)}%`, width: `${getPct(seg.end - seg.start)}%` }}
                      onMouseDown={e => startDrag(e, { type: 'segment', id: seg.id, action: 'move' })}
                    >
                      <div
                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-200 border border-emerald-600 rounded-full cursor-ew-resize"
                        onMouseDown={e => startDrag(e, { type: 'segment', id: seg.id, action: 'resize-start' })}
                      />
                      <div
                        className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-200 border border-emerald-600 rounded-full cursor-ew-resize"
                        onMouseDown={e => startDrag(e, { type: 'segment', id: seg.id, action: 'resize-end' })}
                      />
                    </div>
                  ))}
                  {currentEdit.elements.map(el => (
                    <div
                      key={el.id}
                      className={`absolute top-1 h-1.5 rounded-full pointer-events-none opacity-60 ${
                        currentEdit.selectedId === el.id ? 'bg-yellow-500 z-10' : isDark ? 'bg-slate-500' : 'bg-slate-400'
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
                    className={`relative mt-3 h-10 rounded-lg border select-none cursor-pointer overflow-hidden ${
                      isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}
                    onMouseDown={handleSegmentSeek}
                    title="Навігація по сегментах"
                  >
                    <div className={`absolute inset-0 ${isDark ? 'bg-slate-800/40' : 'bg-slate-50'}`} />
                    {currentEdit.segments.map((seg, index) => {
                      const segLen = Math.max(0, seg.end - seg.start);
                      const left =
                        segmentTotal > 0
                          ? (getSegmentTotal(currentEdit.segments.slice(0, index)) / segmentTotal) * 100
                          : 0;
                      const width = segmentTotal > 0 ? (segLen / segmentTotal) * 100 : 0;
                      return (
                        <div
                          key={seg.id}
                          className="absolute top-2 bottom-2 rounded bg-emerald-500/70 border border-emerald-300/40"
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
            <div className={`w-full lg:w-80 border-l p-6 overflow-y-auto ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="mb-8">
                <button
                  onClick={addRect}
                  className={`w-full py-3 border rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition ${
                    isDark ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <Square className="w-4 h-4" /> Додати прямокутник
                </button>
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
                  onClick={() => setApplyModalOpen(true)}
                  disabled={!activeVideo || isProcessing}
                  className="w-full py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white"
                >
                  Застосувати обрізання
                </button>
                <div className="mt-2 text-[10px] text-slate-400">
                  Замінює відео обрізаним результатом. Прямокутники не включаються.
                </div>
              </div>
              <div className={`mb-8 p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                <div className="text-xs font-bold">FFmpeg експорт (якість 1:1)</div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Дає точну якість і FPS. Вивід без `_done` зберігається у `cutted/`, а оригінал після успішного експорту отримує `_done` і переїжджає в `done/` (якщо є thermal — `_done` ставиться на thermal, інакше на analog). Може завантажуватись у `gdrive:22.12.2025 [ATV&Drone]`.
                </div>
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
                <div className="text-xs font-bold">Позначення</div>
                <div className="mt-1 text-[10px] text-slate-400">
                  Not relevant перемістить оригінал у `done/` з суфіксом `_not_relevant` і не завантажить у Drive.
                </div>
                <button
                  onClick={() => activeVideo && toggleNotRelevant(activeVideo.id)}
                  disabled={!activeVideo}
                  className={`mt-3 w-full py-2 rounded-lg text-xs font-bold border ${
                    activeVideo?.notRelevant
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
                    disabled={currentEdit.segments.length === 0}
                    className="text-[10px] text-red-500 disabled:opacity-40"
                  >
                    Очистити
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] opacity-50">Початок</label>
                      <button
                        onClick={() => setSegmentDraft(prev => ({ ...prev, start: currentTime }))}
                        className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${
                          isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
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
                      className={`w-full text-xs p-1 rounded border ${
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                      }`}
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] opacity-50">Кінець</label>
                      <button
                        onClick={() => setSegmentDraft(prev => ({ ...prev, end: currentTime }))}
                        className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${
                          isDark ? 'text-emerald-300 bg-emerald-900/40 hover:bg-emerald-900' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
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
                      className={`w-full text-xs p-1 rounded border ${
                        isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
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
                  {currentEdit.segments.length === 0 && (
                    <div className="text-[10px] text-slate-400">Немає сегментів для експорту</div>
                  )}
                  {currentEdit.segments.map((seg, idx) => (
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
                        className={`w-16 p-1 rounded border ${
                          isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                        }`}
                      />
                      <span className="text-slate-400">-</span>
                      <input
                        type="number"
                        step="0.1"
                        value={seg.end.toFixed(3)}
                        onChange={e => {
                          const next = parseNumericInput(e.target.value);
                          if (!Number.isFinite(next)) return;
                          updateSegment(seg.id, { end: next });
                        }}
                        className={`w-16 p-1 rounded border ${
                          isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
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
                        className={`p-1.5 rounded transition disabled:opacity-30 disabled:hover:bg-transparent ${
                          isDark ? 'hover:bg-indigo-900 text-indigo-400' : 'hover:bg-indigo-100 text-indigo-600'
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
                            className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${
                              isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
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
                          className={`w-full text-xs p-1 rounded border ${
                            isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-[10px] opacity-50">До</label>
                          <button
                            onClick={() => updateElement(selectedElement.id, { endTime: currentTime })}
                            className={`text-[10px] px-1 rounded flex items-center gap-0.5 ${
                              isDark ? 'text-indigo-300 bg-indigo-900/50 hover:bg-indigo-900' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
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
                          className={`w-full text-xs p-1 rounded border ${
                            isDark ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-300'
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
                        className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${
                          selectedElement.isOutline
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
                        className={`flex-1 py-2 rounded border transition flex items-center justify-center gap-2 ${
                          !selectedElement.isOutline
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
              <div className="mt-auto pt-8">
                <button
                  onClick={() => startProcessing({ autoDownload: true })}
                  disabled={!activeVideo || isProcessing}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition shadow-lg flex items-center justify-center gap-2 font-bold text-sm"
                >
                  {isProcessing ? (
                    processingJob?.videoId !== currentId ? (
                      <>Експорт у фоні...</>
                    ) : (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Обробка {Math.round(progress)}%
                      </>
                    )
                  ) : (
                    <>
                      <Scissors className="w-4 h-4" /> Експорт та Скачати
                    </>
                  )}
                </button>
                {isProcessing && (
                  <button
                    onClick={stopExport}
                    className="mt-2 w-full py-2 border border-red-500 text-red-500 hover:bg-red-50 rounded-xl transition text-xs font-bold"
                  >
                    Зупинити експорт
                  </button>
                )}
                {errorMsg && <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded text-center">{errorMsg}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
