import { CheckSquare, Film, Plus, Square as SquareIcon, Trash2 } from 'lucide-react';

export default function SidebarPlaylist({
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
  isAllSelected,
  searchQuery,
  onSearchChange,
  searchInputRef,
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
              onMouseDown={onStartResize}
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
                onClick={onDeleteSelected}
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
              <input type="file" accept="video/*" multiple onChange={onFileChange} className="hidden" />
            </label>
          </div>
        </div>
      )}
    </>
  );
}
