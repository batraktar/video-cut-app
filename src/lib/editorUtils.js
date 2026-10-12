import { DEFAULT_SHEET_GID, DEFAULT_SHEET_ID, SEGMENT_MODES } from './editorConstants';

export const getSheetCsvUrl = (config) => {
  const id = config?.sheetId || DEFAULT_SHEET_ID;
  const gid = config?.sheetGid || DEFAULT_SHEET_GID;
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};

export const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

export const normalizeCropPx = (crop, meta) => {
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

export const loadFromStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

export const saveToStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
};

export const parseNumericInput = value => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return value;
  const normalized = String(value).trim().replace(',', '.');
  if (normalized === '') return NaN;
  return Number(normalized);
};

export const normalizeName = value => String(value || '').trim().toLowerCase();

export const parseLabelTokens = value => {
  if (!value) return [];
  return String(value)
    .replace(/[;,]+/g, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean);
};

export const mergeLabelTokens = (base, incoming) => {
  const map = new Map();
  (base || []).forEach(label => {
    const key = normalizeName(label);
    if (key && !map.has(key)) map.set(key, label);
  });
  (incoming || []).forEach(label => {
    const key = normalizeName(label);
    if (key && !map.has(key)) map.set(key, label);
  });
  return Array.from(map.values());
};

export const isElementForMode = (element, mode) => {
  if (!element) return false;
  const channelMode = element.channelMode;
  if (Array.isArray(channelMode)) {
    if (channelMode.length === 0) return true;
    const normalizedModes = channelMode.map(entry => normalizeName(entry));
    if (normalizedModes.includes('all')) return true;
    const desired = normalizeName(mode);
    return desired ? normalizedModes.includes(desired) : false;
  }
  const target = normalizeName(channelMode);
  if (!target || target === 'all') return true;
  const desired = normalizeName(mode);
  if (!desired) return false;
  return target === desired;
};

export const filterElementsForMode = (elements, mode) =>
  (Array.isArray(elements) ? elements : []).filter(el => isElementForMode(el, mode));

export const parseCsv = text => {
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

export const getFileKey = file => `${file.name}|${file.size}|${file.lastModified}`;

export const hasBothValue = value => normalizeName(value).includes('both');

export const entriesHaveBoth = entries =>
  Array.isArray(entries) &&
  entries.some(
    entry =>
      entry &&
      (hasBothValue(entry.analogDigital) ||
        hasBothValue(entry.cameraType) ||
        hasBothValue(entry.status))
  );

export const getFileKeyCounts = list => {
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

export const getDefaultSegmentSets = () => ({
  digital: [],
  analog: [],
  thermal_digital: [],
  thermal_analog: []
});

export const normalizeSegmentSets = (segmentSets, fallbackSegments, fallbackMode = 'digital') => {
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

export const getSegmentsForMode = (edit, mode) => {
  if (!edit) return [];
  const resolvedMode = mode || edit.segmentMode || 'digital';
  const sets = normalizeSegmentSets(edit.segmentSets, edit.segments, resolvedMode);
  return sets[resolvedMode] || [];
};

export const updateSegmentsForMode = (edit, mode, nextSegments) => {
  const resolvedMode = mode || edit.segmentMode || 'digital';
  const sets = normalizeSegmentSets(edit.segmentSets, edit.segments, resolvedMode);
  return { ...sets, [resolvedMode]: nextSegments };
};

export const resolveSegmentModeFromMeta = (mode, cameraType) => {
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

export const resolveSegmentModeFromSuffix = suffix => {
  const value = normalizeName(suffix);
  if (value.includes('thermal') && value.includes('analog')) return 'thermal_analog';
  if (value.includes('thermal') && value.includes('digital')) return 'thermal_digital';
  if (value.includes('thermal')) return 'thermal_digital';
  if (value.includes('analog')) return 'analog';
  if (value.includes('digital')) return 'digital';
  return '';
};

export const getSuffixForSegmentMode = mode => {
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

export const resolveSuffixFromMode = (mode, cameraType) => {
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

export const sortChannels = channels => {
  if (!Array.isArray(channels)) return [];
  const order = SEGMENT_MODES.map(mode => mode.id);
  return [...channels].sort(
    (a, b) => order.indexOf(a.mode) - order.indexOf(b.mode)
  );
};

export const buildChannelsFromEntries = entries => {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const byMode = new Map();
  entries.forEach(entry => {
    if (!entry) return;
    const mode = resolveSegmentModeFromMeta(entry.analogDigital, entry.cameraType);
    if (!mode || byMode.has(mode)) return;
    const rawLabels = entry.labels ? String(entry.labels) : '';
    const normalizedLabels = normalizeName(rawLabels);
    const hasSnowLabel = normalizedLabels.includes('snow') || normalizedLabels.includes('сніг');
    byMode.set(mode, {
      mode,
      suffix: resolveSuffixFromMode(entry.analogDigital, entry.cameraType),
      sheetMode: entry.analogDigital || '',
      sheetCameraType: entry.cameraType || '',
      sheetStatus: entry.status || '',
      sheetRow: entry.rowIndex || null,
      sheetLink: entry.link || '',
      labels: rawLabels,
      hasSnow: hasSnowLabel
    });
  });
  return sortChannels(Array.from(byMode.values()));
};

export const mergeChannelLists = (base, incoming) => {
  const next = new Map();
  (base || []).forEach(item => {
    if (item?.mode) next.set(item.mode, item);
  });
  (incoming || []).forEach(item => {
    if (item?.mode && !next.has(item.mode)) next.set(item.mode, item);
  });
  return sortChannels(Array.from(next.values()));
};

export const resolveImportSuffix = (existingSuffix, channels) =>
  existingSuffix || channels?.[0]?.suffix || '_crop_digital';

export const getServerFileKey = (baseDir, relativePath) =>
  `server:${baseDir}|${relativePath}`;

export const getSegmentOffsetForTime = (time, segments) => {
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

export const getTimeForSegmentOffset = (offset, segments) => {
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

export const parseTimeToSeconds = value => {
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

export const extractFfmpegTime = log => {
  if (!log) return null;
  const matches = log.match(/time=([0-9:.]+)/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace('time=', '');
  return parseTimeToSeconds(last);
};

export const getExportDurationForEdit = (edit, mode) => {
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

export const getEntryOrder = entry => {
  if (!entry) return 99;
  const camera = normalizeName(entry.cameraType);
  const mode = normalizeName(entry.analogDigital);
  if (camera.includes('thermal') || camera.includes('infrared')) return 2;
  if (mode.includes('digital')) return 0;
  if (mode.includes('analog')) return 1;
  return 1;
};
