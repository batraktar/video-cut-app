import React, { memo } from 'react';

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
  onFocusResizeStart,
  visibleElements,
  canvasTool
}) {
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
      className={`cvat-canvas-bg relative flex min-h-[280px] flex-1 flex-col items-center justify-center overflow-hidden select-none group ${viewportHeightClass} ${
        canvasTool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
      style={isFocusMode ? { height: focusHeightPx } : undefined}
      onMouseEnter={onViewportMouseEnter}
      onMouseLeave={onViewportMouseLeave}
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
                  className={`absolute ${currentEdit.viewMode === 'editor' ? 'cursor-grab active:cursor-grabbing hover:opacity-90' : ''
                    } ${currentEdit.selectedId === el.id && currentEdit.viewMode === 'editor' ? 'ring-1 ring-blue-400' : ''}`}
                  data-el-id={el.id}
                  style={{
                    left: `${el.x}%`,
                    top: `${el.y}%`,
                    width: `${el.w}%`,
                    height: `${el.h}%`,
                    zIndex: 40,
                    opacity: isVisible ? 1 : 0.4
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
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
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
