export const DEFAULT_SHEET_ID = '1hyGuwwz_x6gkvt587yox4EPsK00Mtk_cvtNoX6hU6bQ';
export const DEFAULT_SHEET_GID = '1633760181';

export const DEFAULT_ADMIN_CONFIG = {
  baseDir: '',
  aiModelPath: '',
  aiPythonPath: '',
  aiFps: 1,
  aiMinDuration: 2,
  aiRemoteUrl: '',
  logoTemplatePath: 'image.png',
  logoFps: 2,
  logoSize: 640,
  logoThreshold: 0.55,
  logoMinDuration: 0.5,
  logoMaxMatches: 5,
  logoMaxGap: 0.5,
  logoScales: '0.9,1.0,1.1',
  sheetId: DEFAULT_SHEET_ID,
  sheetGid: DEFAULT_SHEET_GID
};

export const MAX_HISTORY = 20;

export const DEFAULT_EDIT_STATE = {
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

export const STORAGE_KEYS = {
  edits: 'videoCut.edits.v1',
  prefs: 'videoCut.prefs.v1',
  playlist: 'videoCut.playlist.v1',
  durations: 'videoCut.durations.v1',
  hotkeys: 'videoCut.hotkeys.v1'
};

export const SUFFIX_PRESETS = [
  '_crop_digital',
  '_crop_analog',
  '_thermal_digital',
  '_thermal_analog'
];

export const SEGMENT_MODES = [
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

export const RCLONE_REMOTE = 'gdrive';
export const RCLONE_FOLDER = '22.12.2025 [ATV&Drone]';
