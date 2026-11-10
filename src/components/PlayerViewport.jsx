import React, { memo, useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { formatHotkeyList } from '../features/editor/hotkeys';

function PlayerViewport({
  viewportRef,
  overlayRef,
  videoRef,
  isFocusMode,
  focusHeightPx,
  viewportHeightClass,
  zoom,
  getPreviewStyle,
  onPanStart,
  onViewportMouseEnter,
  onViewportMouseLeave,
  activeVideo,
  currentEdit,
  currentTime,
  isProcessing,
  processingJob,
  currentId,
  videoMaxHeight,
  onMetadata,
  onDragStart,
  onSelectElement,
  hotkeys,
  copiedAttributes,
  duplicateElement,
  copyAttributes,
  pasteAttributes,
  deleteElement,
  updateElement,
  onSaveTrainingExample,
  onFocusResizeStart,
  visibleElements,
  canvasTool
}) {
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeOnOutsidePointer = event => {
      if (!event.target.closest?.('[data-element-context-menu]')) setContextMenu(null);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const hasSnowSegments = edit => {
    if (!edit) return false;
    const sets = edit.segmentSets;
    if (sets && typeof sets === 'object') {
      return Object.values(sets).some(
        list => Array.isArray(list) && list.some(seg => !!seg?.isSnow)
      );
    }
    const flat = edit.segments;
    return Array.isArray(flat) && flat.some(seg => !!seg?.isSnow);
  };
  const showSnow = !!activeVideo?.hasSnow || hasSnowSegments(currentEdit);

  return (
    <div
      ref={viewportRef}
      tabIndex={-1}
      className={`cvat-canvas-bg relative flex min-h-[280px] flex-1 flex-col items-center justify-center overflow-hidden select-none group ${viewportHeightClass} ${
        canvasTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={isFocusMode ? { height: focusHeightPx } : undefined}
      onMouseEnter={onViewportMouseEnter}
      onMouseLeave={onViewportMouseLeave}
      onMouseDownCapture={event => event.currentTarget.focus({ preventScroll: true })}
      onMouseDown={canvasTool === 'pan' ? onPanStart : undefined}
    >
      {showSnow && (
        <div
          className="snow-overlay absolute inset-0 pointer-events-none z-0"
          aria-hidden="true"
        />
      )}
      <div
        ref={overlayRef}
        className={`relative z-10 inline-block border border-black/80 shadow-[0_16px_48px_rgba(0,0,0,0.55)] ${
          canvasTool === 'pan' || zoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={getPreviewStyle()}
        onMouseDown={onPanStart}
        onContextMenu={e => e.preventDefault()}
      >
        <video
          ref={videoRef}
          src={activeVideo?.url}
          className="max-w-full block"
          style={{ maxHeight: videoMaxHeight }}
          onLoadedMetadata={onMetadata}
        />
        {!(isProcessing && processingJob?.videoId === currentId) && currentEdit.meta.width > 0 && (
          <div
            className="absolute inset-0"
            style={isFocusMode ? { zIndex: 9999, opacity: 0.7 } : undefined}
          >
            {currentEdit.viewMode === 'editor' && (
              <>
                <div data-crop-top className="absolute bg-black/60" style={{ left: 0, top: 0, right: 0, height: `${currentEdit.crop.t}%` }} />
                <div data-crop-bottom className="absolute bg-black/60" style={{ left: 0, bottom: 0, right: 0, height: `${currentEdit.crop.b}%` }} />
                <div data-crop-left className="absolute bg-black/60" style={{ left: 0, top: `${currentEdit.crop.t}%`, bottom: `${currentEdit.crop.b}%`, width: `${currentEdit.crop.l}%` }} />
                <div data-crop-right className="absolute bg-black/60" style={{ right: 0, top: `${currentEdit.crop.t}%`, bottom: `${currentEdit.crop.b}%`, width: `${currentEdit.crop.r}%` }} />
                <div
                  data-crop-box
                  className="absolute border-2 border-indigo-500 shadow-[0_0_0_1px_rgba(255,255,255,0.3)] cursor-move"
                  style={{
                    top: `${currentEdit.crop.t}%`,
                    bottom: `${currentEdit.crop.b}%`,
                    left: `${currentEdit.crop.l}%`,
                    right: `${currentEdit.crop.r}%`
                  }}
                  onMouseDown={e => onDragStart(e, { type: 'crop', action: 'move' })}
                >
                  <div
                    className="absolute -top-2 -left-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-nw-resize z-30"
                    onMouseDown={e => onDragStart(e, { type: 'crop', action: 'resize', corner: 'tl' })}
                  />
                  <div
                    className="absolute -top-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-ne-resize z-30"
                    onMouseDown={e => onDragStart(e, { type: 'crop', action: 'resize', corner: 'tr' })}
                  />
                  <div
                    className="absolute -bottom-2 -left-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-sw-resize z-30"
                    onMouseDown={e => onDragStart(e, { type: 'crop', action: 'resize', corner: 'bl' })}
                  />
                  <div
                    className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-indigo-600 rounded-full cursor-se-resize z-30"
                    onMouseDown={e => onDragStart(e, { type: 'crop', action: 'resize', corner: 'br' })}
                  />
                </div>
              </>
            )}
            {visibleElements.map(el => {
              const isVisible = currentTime >= el.startTime && currentTime <= el.endTime;
              if (!(isVisible || (currentEdit.viewMode === 'editor' && currentEdit.selectedId === el.id)))
                return null;
              return (
                <div
                  key={el.id}
                  onMouseDown={e =>
                    currentEdit.viewMode === 'editor' &&
                    onDragStart(e, { type: 'element', id: el.id, action: 'move' })
                  }
                  onClick={e => {
                    e.stopPropagation();
                    onSelectElement(el.id);
                  }}
                  onContextMenu={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (currentEdit.viewMode !== 'editor') return;
                    onSelectElement(el.id);
                    setContextMenu({
                      id: el.id,
                      element: el,
                      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 228)),
                      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 332))
                    });
                  }}
                  className={`absolute ${currentEdit.viewMode === 'editor' ? 'cursor-grab active:cursor-grabbing hover:opacity-90' : ''
                    } ${currentEdit.selectedId === el.id && currentEdit.viewMode === 'editor' ? 'ring-1 ring-blue-400' : ''}`}
                  data-el-id={el.id}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                    zIndex: 40,
                    opacity: isVisible ? 1 : 0.4,
                    transform: `rotate(${Number(el.rotation) || 0}deg)`,
                    transformOrigin: 'center'
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
                      <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center z-50">
                        <div className="h-3 border-l border-blue-500" />
                        <button
                          type="button"
                          onMouseDown={e =>
                            onDragStart(e, { type: 'element', id: el.id, action: 'rotate' })
                          }
                          className="flex h-6 w-6 items-center justify-center rounded-full border border-blue-500 bg-white text-blue-600 shadow cursor-grab active:cursor-grabbing"
                          title={`Повернути фігуру (${Math.round(Number(el.rotation) || 0)}°)`}
                          aria-label={`Повернути фігуру, зараз ${Math.round(Number(el.rotation) || 0)} градусів`}
                        >
                          <RotateCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div
                        className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-se-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'br' })
                        }
                      />
                      <div
                        className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-sw-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'bl' })
                        }
                      />
                      <div
                        className="absolute -top-2 -left-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-nw-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'tl' })
                        }
                      />
                      <div
                        className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 border border-white rounded-full cursor-ne-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'tr' })
                        }
                      />
                      <div
                        className="absolute top-1/2 -left-2 w-4 h-4 -translate-y-1/2 bg-blue-500 border border-white rounded-full cursor-ew-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'l' })
                        }
                      />
                      <div
                        className="absolute top-1/2 -right-2 w-4 h-4 -translate-y-1/2 bg-blue-500 border border-white rounded-full cursor-ew-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'r' })
                        }
                      />
                      <div
                        className="absolute -top-2 left-1/2 w-4 h-4 -translate-x-1/2 bg-blue-500 border border-white rounded-full cursor-ns-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 't' })
                        }
                      />
                      <div
                        className="absolute -bottom-2 left-1/2 w-4 h-4 -translate-x-1/2 bg-blue-500 border border-white rounded-full cursor-ns-resize z-50 shadow"
                        onMouseDown={e =>
                          onDragStart(e, { type: 'element', id: el.id, action: 'resize', corner: 'b' })
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
      {contextMenu && (
        <div
          data-element-context-menu
          role="menu"
          aria-label={`Дії з фігурою ${contextMenu.element.type === 'circle' ? 'коло' : 'прямокутник'}`}
          className="fixed z-[10000] w-56 rounded-md border border-slate-600 bg-slate-900 p-1.5 text-xs text-slate-100 shadow-2xl"
          style={{ left: contextMenu.left, top: contextMenu.top }}
          onMouseDown={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          {[
            { label: 'Дублювати', run: () => duplicateElement(contextMenu.id) },
            {
              label: 'Копіювати налаштування',
              hotkey: 'copyAttributes',
              run: () => copyAttributes(contextMenu.element)
            },
            {
              label: 'Вставити налаштування',
              hotkey: 'pasteAttributes',
              disabled: !copiedAttributes,
              run: () => pasteAttributes(contextMenu.id)
            },
            {
              label: 'Поставити початок',
              hotkey: 'markStart',
              run: () => updateElement(contextMenu.id, { startTime: currentTime })
            },
            {
              label: 'Поставити кінець',
              hotkey: 'markEnd',
              run: () => updateElement(contextMenu.id, { endTime: currentTime })
            },
            {
              label: 'Увімкнути контур',
              hotkey: 'outline',
              run: () => updateElement(contextMenu.id, { isOutline: true })
            },
            {
              label: 'Увімкнути заливку',
              hotkey: 'fill',
              run: () => updateElement(contextMenu.id, { isOutline: false })
            },
            ...(onSaveTrainingExample && ['rect', 'circle'].includes(contextMenu.element.type)
              ? [{
                  label: 'Зберегти кадр у датасет',
                  hotkey: 'saveCoverTrainingExample',
                  run: () => onSaveTrainingExample(contextMenu.id)
                }]
              : []),
            {
              label: 'Видалити',
              hotkey: 'deleteElement',
              danger: true,
              run: () => deleteElement(contextMenu.id)
            }
          ].map((action, index) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                setContextMenu(null);
                action.run();
              }}
              className={`flex w-full items-center justify-between gap-3 rounded px-2.5 py-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                action.danger ? 'text-red-300 hover:bg-red-950/70' : 'hover:bg-slate-700'
              } ${index === 7 ? 'mt-1 border-t border-slate-700 pt-2' : ''}`}
            >
              <span>{action.label}</span>
              {action.hotkey && (
                <kbd className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  {formatHotkeyList(hotkeys?.[action.hotkey])}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}
      {isFocusMode && (
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-2 rounded-full bg-white/20 border border-white/30 cursor-ns-resize"
          onMouseDown={onFocusResizeStart}
          title="Змінити висоту відео"
        />
      )}
    </div>
  );
}

export default memo(PlayerViewport);
