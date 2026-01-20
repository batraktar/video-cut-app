import { useEffect, useMemo, useRef, useState } from 'react';
import { STORAGE_KEYS } from '../lib/editorConstants';
import { normalizeName, saveToStorage } from '../lib/editorUtils';

export default function usePlaylist({ suffixPresets = [], getFileKeyCounts, isSnowVideo }) {
  const [playlist, setPlaylist] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupKey, setActiveGroupKey] = useState('__none__');
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [playlistScrollTop, setPlaylistScrollTop] = useState(0);
  const [playlistViewportHeight, setPlaylistViewportHeight] = useState(0);

  const playlistRef = useRef([]);
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
  const filteredPlaylist = useMemo(() => {
    const query = normalizeName(searchQuery);
    if (!query) return playlist;
    return playlist.filter(p => normalizeName(p.name).includes(query));
  }, [playlist, searchQuery]);
  const snowPlaylist = useMemo(() => {
    const predicate = typeof isSnowVideo === 'function' ? isSnowVideo : p => !!p?.hasSnow;
    return filteredPlaylist.filter(predicate);
  }, [filteredPlaylist, isSnowVideo]);
  const multiChannelPlaylist = useMemo(
    () => filteredPlaylist.filter(p => (fileKeyCountsAll.get(p.fileKey) || 0) > 1),
    [filteredPlaylist, fileKeyCountsAll]
  );
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
    if (activeGroupKey === '__snow__') return snowPlaylist;
    const entry = groupedPlaylist.find(([key]) => key === activeGroupKey);
    return entry ? entry[1] : [];
  }, [groupedPlaylist, activeGroupKey, filteredPlaylist, multiChannelPlaylist, snowPlaylist]);

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
      hasSnow: !!v.hasSnow,
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
    allCount: filteredPlaylist.length,
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
