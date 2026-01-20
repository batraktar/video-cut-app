import {
  buildChannelsFromEntries,
  entriesHaveBoth,
  getEntryOrder,
  getFileKey,
  mergeChannelLists,
  normalizeName
} from '../../lib/editorUtils';
import { buildEditFromSaved, getSavedEditForVideo } from './editRestore';

const entryHasSnow = entry => {
  if (!entry) return false;
  const rawLabels = entry.labels ? String(entry.labels) : '';
  const value = normalizeName(rawLabels);
  return value.includes('snow') || value.includes('сніг');
};

export default function usePlaylistActions({
  playlistRef,
  setPlaylist,
  setEdits,
  currentId,
  setCurrentId,
  savedEditsRef,
  idbPutVideo,
  showHud,
  loadSheetMap
}) {
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
      const hasSnow = orderedEntries.some(entryHasSnow);
      const existingItem = existingByFileKey.get(fileKey);
      if (existingItem && (existingItem.file || existingItem.url)) {
        if (channels.length > 0) {
          replacements.push({
            ...existingItem,
            file,
            url: existingItem.url || URL.createObjectURL(file),
            channels: mergeChannelLists(existingItem.channels, channels),
            sheetHasBoth: existingItem.sheetHasBoth || sheetHasBoth,
            hasSnow: existingItem.hasSnow || hasSnow
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
        hasSnow: existingItem?.hasSnow || hasSnow,
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

  return { handleFileChange, removeVideo, deleteSelectedVideos };
}
