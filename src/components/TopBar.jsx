import {
  Bot,
  Eye,
  EyeOff,
  Maximize,
  Menu,
  Moon,
  Play,
  Redo,
  Scissors,
  Settings,
  ShieldCheck,
  Sun,
  Undo,
  Upload,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

export default function TopBar({
  isFocusMode,
  isDark,
  activeVideo,
  activeSuffix,
  activeSuffixPreset,
  suffixPresets,
  activeChannelChips,
  currentEdit,
  copiedNameId,
  zoom,
  isCanvasExpanded,
  selectedCount,
  adminLoading,
  adminSyncState,
  onCopyVideoName,
  onSetVideoSuffix,
  onCopyText,
  onZoomToSelected,
  onToggleCanvasExpand,
  onUndo,
  onRedo,
  onToggleViewMode,
  onRunAdminFfmpeg,
  onAddVideosFromServer,
  onOpenImportPicker,
  onOpenAdmin,
  onOpenAdminAi,
  onOpenFocusMenu,
  onToggleFocusMode,
  onToggleTheme
}) {
  const syncTimeLabel = adminSyncState?.updatedAt
    ? new Date(adminSyncState.updatedAt).toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : '—';
  const syncStatus = adminSyncState?.status || 'idle';
  const syncTextClass =
    syncStatus === 'ok'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : syncStatus === 'error'
        ? 'text-red-600 bg-red-50 border-red-200'
        : 'text-slate-500 bg-slate-100 border-slate-200';
  const syncDotClass =
    syncStatus === 'ok'
      ? 'bg-emerald-500'
      : syncStatus === 'error'
        ? 'bg-red-500'
        : 'bg-slate-400';

  return (
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
                  onClick={() => onCopyVideoName(activeVideo?.name, activeVideo?.id)}
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
                <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${syncTextClass}`}>
                  <span className={`inline-block w-2 h-2 rounded-full ${syncDotClass}`} />
                  Sync: {syncTimeLabel}
                </span>
                <div className="flex items-center gap-1">
                  {suffixPresets.map(preset => {
                    const isActive = activeSuffix === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() =>
                          activeVideo && onSetVideoSuffix(activeVideo.id, isActive ? '' : preset)
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
                            ? onCopyText(chip.suffix, "Суфікс скопійовано")
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
                onClick={() => onZoomToSelected(zoom - 0.1)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Зменшити"
              >
                <ZoomOut className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              <span className="px-2 text-xs font-mono text-slate-500 dark:text-slate-400 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => onZoomToSelected(zoom + 0.1)}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Збільшити"
              >
                <ZoomIn className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
              <button
                onClick={() => {
                  onZoomToSelected(1);
                }}
                className="p-1.5 border-l border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                title="Скинути зум"
              >
                <Maximize className="w-3 h-3 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
            <button
              onClick={onToggleCanvasExpand}
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
                onClick={onUndo}
                disabled={currentEdit.history.length === 0}
                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
                  }`}
                title="Скасувати (Ctrl+Z)"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                onClick={onRedo}
                disabled={currentEdit.future.length === 0}
                className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300 disabled:text-slate-700' : 'hover:bg-slate-200 text-slate-600 disabled:text-slate-300'
                  }`}
                title="Повторити (Ctrl+Y)"
              >
                <Redo className="w-4 h-4" />
              </button>
              <button
                onClick={onToggleViewMode}
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
            onClick={onRunAdminFfmpeg}
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
            onClick={onOpenImportPicker || onAddVideosFromServer}
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
          onClick={onOpenAdmin}
          className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
            }`}
          title="Адмінка"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenAdminAi}
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
            onClick={onOpenFocusMenu}
            className={`p-2 rounded-lg transition ${isDark ? 'hover:bg-slate-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'
              }`}
            title="Відкрити меню"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onToggleFocusMode}
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
          onClick={onToggleTheme}
          className={`p-2 rounded-lg transition ${isDark ? 'bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          title="Змінити тему"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
