import { DEFAULT_EDIT_STATE } from '../../lib/editorConstants';
import { normalizeSegmentSets } from '../../lib/editorUtils';

export const buildEditFromSaved = saved => {
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

export const getSavedEditForVideo = (savedEdits, video, fileKeyCounts) => {
  if (!savedEdits || !video) return null;
  if (savedEdits[video.id]) return savedEdits[video.id];
  if (video.fileKey && savedEdits[video.fileKey]) return savedEdits[video.fileKey];
  if (video.source === 'server' && video.sourceBaseDir && video.sourcePath) {
    const legacyPrefix = `server:${video.sourceBaseDir}|${video.sourcePath}|`;
    const legacyKey = Object.keys(savedEdits).find(key => key.startsWith(legacyPrefix));
    if (legacyKey) return savedEdits[legacyKey];
  }
  if (fileKeyCounts?.get(video.fileKey) === 1) return savedEdits[video.fileKey] || null;
  return null;
};

