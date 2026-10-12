import { useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../lib/editorConstants';
import { normalizeName, saveToStorage } from '../lib/editorUtils';

export default function usePlaylist({
  suffixPresets = [],
  getFileKeyCounts,
  isSnowVideo,
  getVideoDuration,
  isVideoEdited
}) {
  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupKey, setActiveGroupKey] = useState('__none__');
  const [activeLabelFilters, setActiveLabelFilters] = useState([]);
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [playlistScrollTop, setPlaylistScrollTop] = useState(0);
  const [playlistViewportHeight, setPlaylistViewportHeight] = useState(0);

  const playlistRef = useRef([]);
  const hasPersistedPlaylistRef = useRef(false);
  const playlistScrollRef = useRef(null);
  const searchInputRef = useRef(null);

  const activeVideo = useMemo(
    () => playlist.find(v => v.id === currentId) || null,
    [playlist, currentId]
  );

  const suffixOptions = useMemo(() => {
    const known = new Set(suffixPresets);
    playlist.forEach(item => {
      if (item?.suffix) known.add(item.suffix);
    });
    return Array.from(known);
  }, [playlist, suffixPresets]);

  const fileKeyCountsAll = useMemo(
    () => (getFileKeyCounts ? getFileKeyCounts(playlist) : new Map()),
    [playlist, getFileKeyCounts]
  );
  const searchFilteredPlaylist = useMemo(() => {
    const query = normalizeName(searchQuery);
    if (!query) return playlist;
    return playlist.filter(p => normalizeName(p.name).includes(query));
  }, [playlist, searchQuery]);
  const labelOptions = useMemo(() => {
    const map = new Map();
    playlist.forEach(item => {
      (item?.labels || []).forEach(label => {
        const key = normalizeName(label);
        if (!key) return;
        const current = map.get(key) || { key, label, count: 0 };
        current.count += 1;
        if (!current.label || current.label.length < label.length) current.label = label;
        map.set(key, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });
  }, [playlist]);
  const labelFilterSet = useMemo(
    () => new Set(activeLabelFilters),
    [activeLabelFilters]
  );
  const filteredPlaylist = useMemo(() => {
    if (labelFilterSet.size === 0) return searchFilteredPlaylist;
    return searchFilteredPlaylist.filter(item => {
      const labels = Array.isArray(item.labels) ? item.labels : [];
      return labels.some(label => labelFilterSet.has(normalizeName(label)));
    });
  }, [labelFilterSet, searchFilteredPlaylist]);
  const sortedFilteredPlaylist = useMemo(() => {
    if (!filteredPlaylist.length) return filteredPlaylist;
    const withMeta = filteredPlaylist.map((item, index) => {
      const duration = getVideoDuration ? getVideoDuration(item) : Number.POSITIVE_INFINITY;
      const edited = isVideoEdited ? isVideoEdited(item) : false;
      return { item, index, duration, edited };
    });
    withMeta.sort((a, b) => {
      if (a.edited !== b.edited) return a.edited ? -1 : 1;
      const aDuration = Number.isFinite(a.duration) ? a.duration : Number.POSITIVE_INFINITY;
      const bDuration = Number.isFinite(b.duration) ? b.duration : Number.POSITIVE_INFINITY;
      if (aDuration !== bDuration) return aDuration - bDuration;
      return a.index - b.index;
    });
    return withMeta.map(entry => entry.item);
  }, [filteredPlaylist, getVideoDuration, isVideoEdited]);
  const snowPlaylist = useMemo(() => {
    const predicate = typeof isSnowVideo === 'function' ? isSnowVideo : p => !!p?.hasSnow;
    return sortedFilteredPlaylist.filter(predicate);
  }, [sortedFilteredPlaylist, isSnowVideo]);
  const multiChannelPlaylist = useMemo(
    () => sortedFilteredPlaylist.filter(p => (fileKeyCountsAll.get(p.fileKey) || 0) > 1),
    [sortedFilteredPlaylist, fileKeyCountsAll]
  );
  const groupOrder = useMemo(() => ['__none__', ...suffixOptions], [suffixOptions]);
  const groupedPlaylist = useMemo(() => {
    const groups = new Map();
    sortedFilteredPlaylist.forEach(item => {
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
  }, [sortedFilteredPlaylist, groupOrder]);
  const activeGroupItems = useMemo(() => {
    if (activeGroupKey === '__all__') return sortedFilteredPlaylist;
    if (activeGroupKey === '__multi__') return multiChannelPlaylist;
    if (activeGroupKey === '__snow__') return snowPlaylist;
    const entry = groupedPlaylist.find(([key]) => key === activeGroupKey);
    return entry ? entry[1] : [];
  }, [groupedPlaylist, activeGroupKey, sortedFilteredPlaylist, multiChannelPlaylist, snowPlaylist]);

  useEffect(() => {
    if (groupedPlaylist.length === 0) return;
    if (activeGroupKey === '__all__' || activeGroupKey === '__multi__' || activeGroupKey === '__snow__') return;
    const exists = groupedPlaylist.some(([key]) => key === activeGroupKey);
    if (!exists) setActiveGroupKey(groupedPlaylist[0][0]);
  }, [groupedPlaylist, activeGroupKey]);

  useEffect(() => {
    if (!playlistScrollRef.current) return;
    playlistScrollRef.current.scrollTop = 0;
    setPlaylistScrollTop(0);
  }, [activeGroupKey, searchQuery]);

  const selectedCount = useMemo(
    () => playlist.filter(p => p.checked).length,
    [playlist]
  );
  const isAllSelected = useMemo(
    () => activeGroupItems.length > 0 && activeGroupItems.every(p => p.checked),
    [activeGroupItems]
  );

  const playlistItemHeight = 78;
  const playlistOverscan = 6;
  const playlistStartIndex = Math.max(
    0,
    Math.floor(playlistScrollTop / playlistItemHeight) - playlistOverscan
  );
  const playlistEndIndex = Math.min(
    activeGroupItems.length,
    Math.ceil((playlistScrollTop + playlistViewportHeight) / playlistItemHeight) +
      playlistOverscan
  );
  const playlistVisibleItems = activeGroupItems.slice(playlistStartIndex, playlistEndIndex);
  const playlistPaddingTop = playlistStartIndex * playlistItemHeight;
  const playlistPaddingBottom =
    (activeGroupItems.length - playlistEndIndex) * playlistItemHeight;

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

  const clearSelection = () =>
    setPlaylist(prev => prev.map(p => ({ ...p, checked: false })));

  const selectVisible = () => {
    if (activeGroupItems.length === 0) return;
    setPlaylist(prev =>
      prev.map(p =>
        activeGroupItems.some(item => item.id === p.id)
          ? { ...p, checked: true }
          : p
      )
    );
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

  const handlePlaylistScroll = e => {
    setPlaylistScrollTop(e.currentTarget.scrollTop);
  };

  const toggleLabelFilter = labelKey => {
    if (!labelKey) return;
    setActiveLabelFilters(prev => {
      if (prev.includes(labelKey)) return prev.filter(item => item !== labelKey);
      return [...prev, labelKey];
    });
  };

  const clearLabelFilters = () => setActiveLabelFilters([]);

  useEffect(() => {
    playlistRef.current = playlist;
    if (playlist.length > 0) hasPersistedPlaylistRef.current = true;
    if (!hasPersistedPlaylistRef.current) return;
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
      hasSnow: !!v.hasSnow,
      labels: Array.isArray(v.labels) ? v.labels : [],
      channels: Array.isArray(v.channels) ? v.channels : [],
      source: v.source || '',
      sourcePath: v.sourcePath || '',
      sourceBaseDir: v.sourceBaseDir || ''
    }));
    saveToStorage(STORAGE_KEYS.playlist, payload);
  }, [playlist]);

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

  return {
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
    setLabelFilters: setActiveLabelFilters,
    draggingId,
    setDraggingId,
    dragOverId,
    setDragOverId,
    playlistRef,
    playlistScrollRef,
    searchInputRef,
    filteredPlaylist: sortedFilteredPlaylist,
    groupedPlaylist,
    activeGroupItems,
    selectedCount,
    isAllSelected,
    allCount: sortedFilteredPlaylist.length,
    multiCount: multiChannelPlaylist.length,
    snowCount: snowPlaylist.length,
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
  };
}
