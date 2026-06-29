import React, { memo, useEffect, useRef, useState } from 'react';
import { Select } from 'antd';
import {
  CheckSquare,
  Film,
  PanelLeftOpen,
  Pin,
  PinOff,
  Plus,
  Snowflake,
  Square as SquareIcon,
  Trash2
} from 'lucide-react';

const PIN_STORAGE_KEY = 'videoCut.playlistPinned.v1';

function SidebarPlaylist({
  isFocusMode,
  focusSideOpen,
  isDark,
  sidebarWidth,
  onFocusSideClose,
  onStartResize,
  activeGroupItems,
  filteredPlaylist,
  groupedPlaylist,
  activeGroupKey,
  allCount,
  multiCount,
  snowCount,
  isAllSelected,
  searchQuery,
  onSearchChange,
  searchInputRef,
  labelOptions,
  activeLabelFilters,
  onLabelFiltersChange,
  onClearLabelFilters,
  onToggleSelectAll,
  onClearSelection,
  onSelectVisible,
  onSetActiveGroupKey,
  playlistScrollRef,
  onScroll,
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
  onDeleteSelected,
  onFileChange
}) {
  const [pinned, setPinned] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(PIN_STORAGE_KEY) === 'true';
  });
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const closeTimerRef = useRef(null);
  const panelOpen = isFocusMode || pinned || hovered || focused;

  const cancelClose = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    setHovered(true);
  };

  const scheduleClose = () => {
    if (isFocusMode || pinned || focused) return;
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => setHovered(false), 380);
  };

  useEffect(() => {
    window.localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
  }, [pinned]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

  const handleResizeStart = event => {
    setPinned(true);
    onStartResize(event);
  };

  const hasSnowSegments = videoId => {
    const edit = edits?.[videoId];
    const sets = edit?.segmentSets;
    if (sets && typeof sets === 'object') {
      return Object.values(sets).some(
        list => Array.isArray(list) && list.some(seg => !!seg?.isSnow)
      );
    }
    const flat = edit?.segments;
    return Array.isArray(flat) && flat.some(seg => !!seg?.isSnow);
  };
  return (
    <>
      {isFocusMode && focusSideOpen && (
        <div
          className="fixed inset-0 z-[9995] bg-black/50"
          onClick={onFocusSideClose}
        />
      )}
      {(!isFocusMode || focusSideOpen) && (
        <div
          className={`relative shrink-0 transition-[width] duration-200 ${isFocusMode
            ? 'fixed left-0 top-0 h-full z-[9996]'
            : 'z-40 hidden h-full md:block'
            }`}
          style={{ width: isFocusMode ? 320 : pinned ? sidebarWidth : 56 }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onFocusCapture={() => {
            setFocused(true);
            cancelClose();
          }}
          onBlurCapture={event => {
            if (event.currentTarget.contains(event.relatedTarget)) return;
            setFocused(false);
            if (!pinned) {
              if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
              closeTimerRef.current = window.setTimeout(() => setHovered(false), 380);
            }
          }}
        >
          {!isFocusMode && !pinned && (
            <aside
              className={`absolute inset-0 z-30 flex w-14 flex-col items-center gap-1 border-r px-2 py-2 ${
                isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-300 bg-white'
              }`}
            >
              <button
                type="button"
                onClick={cancelClose}
                className={`relative flex h-10 w-10 items-center justify-center rounded-md transition ${
                  panelOpen ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:bg-slate-700/20'
                }`}
                title="Відео"
              >
                <Film className="h-4 w-4" />
                {allCount > 0 && (
                  <span className="absolute right-0 top-0 min-w-4 rounded-full bg-indigo-500 px-1 text-center text-[8px] font-bold text-white">
                    {allCount > 99 ? '99+' : allCount}
                  </span>
                )}
              </button>
              {selectedCount > 0 && (
                <div className="mt-1 rounded bg-emerald-500/15 px-1.5 py-1 text-[9px] font-bold text-emerald-400">
                  ✓ {selectedCount}
                </div>
              )}
              <button
                type="button"
                onClick={() => setPinned(true)}
                className="mt-auto flex h-10 w-10 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-700/20"
                title="Закріпити список"
              >
                <Pin className="h-4 w-4" />
              </button>
              <PanelLeftOpen className="h-4 w-4 text-slate-600" />
            </aside>
          )}

          <div
            className={`absolute bottom-0 top-0 z-20 flex flex-col border-r shadow-[18px_0_36px_rgba(0,0,0,0.28)] transition-[opacity,transform,background-color] duration-200 ${
              isFocusMode || pinned ? 'left-0' : 'left-14'
            } ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${
              panelOpen ? 'translate-x-0 opacity-100' : '-translate-x-2 pointer-events-none opacity-0'
            }`}
            style={{ width: isFocusMode ? 320 : sidebarWidth }}
          >
          {!isFocusMode && (
            <div
              className={`absolute right-0 top-0 h-full w-1.5 cursor-col-resize ${isDark ? 'bg-slate-800/60' : 'bg-slate-100'
                }`}
              onMouseDown={handleResizeStart}
              title="Змінити ширину"
            />
          )}
          <div className={`p-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`font-bold flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                <Film className="w-5 h-5 text-indigo-500" />
                {isFocusMode && <span className="text-xs">Список</span>}
              </h2>
              <div className="flex items-center gap-2">
                {!isFocusMode && (
                  <button
                    type="button"
                    onClick={() => setPinned(value => !value)}
                    className={`rounded p-1.5 transition ${
                      pinned ? 'bg-indigo-500/15 text-indigo-400' : 'text-slate-400 hover:bg-slate-700/20'
                    }`}
                    title={pinned ? 'Відкріпити список' : 'Закріпити список'}
                  >
                    {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  </button>
                )}
                {isFocusMode && (
                  <button
                    onClick={onFocusSideClose}
                    className="text-slate-400 hover:text-slate-200 text-lg leading-none"
                    title="Закрити"
                  >
                    ×
                  </button>
                )}
                {activeGroupItems.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onToggleSelectAll}
                      className={`text-[11px] leading-none hover:underline ${isDark ? 'text-indigo-400' : 'text-indigo-600'
                        }`}
                    >
                      {isAllSelected ? 'Зняти все' : 'Обрати все'}
                    </button>
                    <button
                      onClick={onClearSelection}
                      className="text-[11px] leading-none text-slate-400 hover:text-slate-600"
                    >
                      Очистити
                    </button>
                    <button
                      onClick={onSelectVisible}
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
                onChange={e => onSearchChange(e.target.value)}
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
                  onClick={() => onSetActiveGroupKey('__all__')}
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
                  onClick={() => onSetActiveGroupKey('__multi__')}
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
                <button
                  onClick={() => onSetActiveGroupKey('__snow__')}
                  disabled={snowCount === 0}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold border disabled:opacity-40 ${activeGroupKey === '__snow__'
                    ? isDark
                      ? 'bg-sky-600 border-sky-500 text-white'
                      : 'bg-sky-600 border-sky-500 text-white'
                    : isDark
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                    }`}
                  title="Відео зі snow сегментами або snow лейблом"
                >
                  <span className="inline-flex items-center gap-1">
                    <Snowflake className="w-3 h-3" /> snow ({snowCount})
                  </span>
                </button>
                {groupedPlaylist.map(([groupKey, items]) => {
                  const label = groupKey === '__none__' ? 'Без суфіксу' : groupKey;
                  const isActive = groupKey === activeGroupKey;
                  return (
                    <button
                      key={groupKey}
                      onClick={() => onSetActiveGroupKey(groupKey)}
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
            {labelOptions.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Labels</span>
                  {activeLabelFilters.length > 0 && (
                    <button
                      onClick={onClearLabelFilters}
                      className="text-[10px] text-slate-400 hover:text-slate-600"
                    >
                      Очистити
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <Select
                    mode="multiple"
                    showSearch
                    allowClear
                    value={activeLabelFilters}
                    onChange={onLabelFiltersChange}
                    optionFilterProp="label"
                    className={`w-full text-xs ${isDark ? 'text-white' : ''}`}
                    dropdownClassName={isDark ? 'bg-slate-800 text-slate-100' : ''}
                    style={{ width: '100%' }}
                    placeholder="Оберіть labels"
                    options={labelOptions.map(option => ({
                      label: `${option.label} (${option.count})`,
                      value: option.key
                    }))}
                  />
                </div>
              </div>
            )}
          </div>
          <div
            ref={playlistScrollRef}
            onScroll={onScroll}
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
                  const dangerClass = vid.sheetHasBoth
                    ? isDark
                      ? 'ring-1 ring-red-500/70 bg-red-900/30'
                      : 'ring-1 ring-red-400 bg-red-50'
                    : '';
	                  const isSnow = !!vid.hasSnow || hasSnowSegments(vid.id);
	                  const snowClass = isSnow
	                    ? isDark
	                      ? 'ring-1 ring-sky-400/60 bg-sky-900/20'
	                      : 'ring-1 ring-sky-300 bg-sky-50'
	                    : '';
                  return (
	                    <div key={vid.id} style={{ height: `${playlistItemHeight}px` }}>
	                      <div
	                        onClick={() => switchVideo(vid.id)}
                        className={`h-full p-2 rounded-md cursor-pointer group relative flex items-start gap-2 transition ${currentId === vid.id
                          ? isDark
                            ? 'bg-indigo-900/50 border border-indigo-700'
                            : 'bg-indigo-50 border border-indigo-200 shadow-sm'
                          : isDark
                            ? 'hover:bg-slate-800 border border-transparent'
                            : 'hover:bg-slate-50 border border-transparent'
	                          } ${dragOverId === vid.id && draggingId !== vid.id ? 'ring-2 ring-indigo-400' : ''} ${dangerClass} ${snowClass}`}
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
                                className={`font-medium text-xs truncate ${isDark ? 'text-slate-200' : 'text-slate-700'}`}
	                            title={getVideoTooltip(vid)}
	                          >
                            {getDisplayName(vid.name)}
	                            {isSnow && (
	                              <span className={`ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${isDark ? 'bg-sky-900/40 text-sky-200 border-sky-700' : 'bg-sky-100 text-sky-700 border-sky-200'}`}>
	                                <Snowflake className="w-3 h-3" /> SNOW
	                              </span>
	                            )}
                            {vid.sheetHasBoth && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                BOTH
                              </span>
	                            )}
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
            className={`p-3 border-t space-y-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'
              }`}
          >
            {playlist.length > 0 && (
              <button
                onClick={onDeleteSelected}
                disabled={selectedCount === 0}
                className="w-full py-2 border border-red-400 text-red-600 hover:bg-red-50 disabled:opacity-40 rounded-lg text-xs font-bold"
              >
                Видалити обрані ({selectedCount})
              </button>
            )}
          </div>
          <div className={`p-3 border-t ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <label className="flex items-center justify-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white w-full py-2.5 rounded-lg transition font-medium shadow-sm text-sm">
              <Plus className="w-4 h-4" /> Додати відео
              <input type="file" accept="video/*" multiple onChange={onFileChange} className="hidden" />
            </label>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

export default memo(SidebarPlaylist);
