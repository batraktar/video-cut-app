import React, { memo } from 'react';
import { Pause, Play } from 'lucide-react';

function PlayerTimeline({
  isFocusMode,
  isDark,
  currentTime,
  duration,
  trim,
  selectedElementId,
  seekStep,
  activeSegments,
  activeSegmentModesMeta,
  activeSegmentMode,
  onSetActiveSegmentMode,
  playSegmentsOnly,
  onTogglePlaySegments,
  togglePlayback,
  isPlaying,
  isProcessing,
  getPct,
  timelineRef,
  onSeek,
  onDragStart,
  allSegmentsByMode,
  activeSegmentMeta,
  getSegmentTotal,
  segmentTotal,
  segmentOffset,
  onSegmentSeek,
  processingVideoRef,
  processingSrc,
  processedUrl,
  activeVideo,
  visibleElements
}) {
  return (
    <>
      <div
        className={`${isFocusMode
          ? 'absolute left-6 right-6 bottom-4 z-20 bg-transparent border-transparent shadow-none'
          : 'p-4 rounded-b-xl shadow-sm border'
          } ${isFocusMode
            ? ''
            : isDark
              ? 'bg-slate-900 border-slate-800'
              : 'bg-white border-slate-200'
          }`}
      >
        {isFocusMode ? (
          <div className="mb-2 space-y-2">
            <div className="flex items-center gap-3 text-[11px] text-white/80">
              <span className="font-mono">{currentTime.toFixed(3)} / {duration.toFixed(3)}s</span>
              <span className="text-white/60">Крок: {seekStep}s</span>
              {activeSegments.length > 0 && (
                <button
                  onClick={onTogglePlaySegments}
                  className={`px-2 py-0.5 rounded-full border text-[10px] ${playSegmentsOnly
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-white/10 border-white/30 text-white/70'
                    }`}
                  title="Грати лише сегменти"
                >
                  Сегменти: {playSegmentsOnly ? 'ON' : 'OFF'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSegmentModesMeta.map(mode => {
                const isActive = activeSegmentMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => onSetActiveSegmentMode(mode.id)}
                    className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${isActive
                      ? mode.active
                      : 'bg-white/10 border-white/30 text-white/70 hover:border-white/60'
                      }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${mode.dot}`} />
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={togglePlayback}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow ${isDark ? 'bg-white text-slate-900 hover:bg-slate-200' : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <div className="font-mono text-sm opacity-60">
              {currentTime.toFixed(3)} / {duration.toFixed(3)}s
            </div>
            <div className="text-[10px] text-slate-400">
              Крок: {seekStep}s
            </div>
            {activeSegments.length > 0 && (
              <button
                onClick={onTogglePlaySegments}
                className={`px-2 py-1 text-[10px] rounded-full border transition ${playSegmentsOnly
                  ? isDark
                    ? 'bg-emerald-700/40 border-emerald-500 text-emerald-200'
                    : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                  : isDark
                    ? 'bg-slate-800 border-slate-600 text-slate-300'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                  }`}
                title="Грати лише сегменти"
              >
                Сегменти: {playSegmentsOnly ? 'ON' : 'OFF'}
              </button>
            )}
            <div className="flex-1"></div>
            {(processedUrl || processingSrc) && !isProcessing && (
              <span className="text-xs text-green-600 font-bold animate-pulse">Файл скачано!</span>
            )}
          </div>
        )}
        <div
          className={`relative h-14 rounded-lg border select-none cursor-pointer group overflow-hidden ${isFocusMode
            ? 'bg-black/20 border-white/20 backdrop-blur-sm'
            : isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-slate-100 border-slate-200'
            }`}
          ref={timelineRef}
          onMouseDown={onSeek}
        >
          <div className={`absolute top-0 bottom-0 left-0 pointer-events-none ${isDark ? 'bg-slate-600/50' : 'bg-slate-200/50'}`} style={{ width: `${getPct(currentTime)}%` }} />
          <div data-trim-start-mask className="absolute top-0 bottom-0 left-0 bg-black/40 backdrop-blur-[1px] pointer-events-none border-r border-white/20 z-10" style={{ width: `${getPct(trim.start)}%` }}></div>
          <div data-trim-end-mask className="absolute top-0 bottom-0 right-0 bg-black/40 backdrop-blur-[1px] pointer-events-none border-l border-white/20 z-10" style={{ width: `${100 - getPct(trim.end)}%` }}></div>
          <div
            data-trim-box
            className="absolute top-0 bottom-0 border-t-2 border-b-2 border-indigo-500/30 pointer-events-none"
            style={{ left: `${getPct(trim.start)}%`, right: `${100 - getPct(trim.end)}%` }}
          />
          <div
            data-trim-start
            className="absolute top-0 bottom-0 w-4 bg-indigo-600 cursor-ew-resize z-20 hover:brightness-110 shadow-lg flex items-center justify-center group/handle"
            style={{ left: `${getPct(trim.start)}%`, transform: 'translateX(-50%)' }}
            onMouseDown={e => onDragStart(e, { type: 'trim-start' })}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-0.5 h-6 bg-white/50 rounded-full"></div>
          </div>
          <div
            data-trim-end
            className="absolute top-0 bottom-0 w-4 bg-indigo-600 cursor-ew-resize z-20 hover:brightness-110 shadow-lg flex items-center justify-center group/handle"
            style={{ left: `${getPct(trim.end)}%`, transform: 'translateX(-50%)' }}
            onMouseDown={e => onDragStart(e, { type: 'trim-end' })}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-0.5 h-6 bg-white/50 rounded-full"></div>
          </div>
          {allSegmentsByMode.map(group =>
            group.segments.map(seg => {
              const isActive = group.meta.id === activeSegmentMode;
              return (
                <div
                  key={`${group.meta.id}-${seg.id}`}
                  className={`absolute top-7 h-3 rounded border ${group.meta.track} ${isActive ? 'cursor-grab' : 'pointer-events-none opacity-40'
                    }`}
                  style={{ left: `${getPct(seg.start)}%`, width: `${getPct(seg.end - seg.start)}%` }}
                  onMouseDown={
                    isActive
                      ? e => onDragStart(e, { type: 'segment', id: seg.id, action: 'move' })
                      : undefined
                  }
                >
                  {isActive && (
                    <>
                      <div
                        className={`absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 border rounded-full cursor-ew-resize ${activeSegmentMeta.handle}`}
                        onMouseDown={e => onDragStart(e, { type: 'segment', id: seg.id, action: 'resize-start' })}
                      />
                      <div
                        className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-2 border rounded-full cursor-ew-resize ${activeSegmentMeta.handle}`}
                        onMouseDown={e => onDragStart(e, { type: 'segment', id: seg.id, action: 'resize-end' })}
                      />
                    </>
                  )}
                </div>
              );
            })
          )}
          {visibleElements.map(el => {
            const label = el.channelMode && el.channelMode !== 'all' ? el.channelMode : null;
            return (
              <div
                key={el.id}
                className={`absolute top-1 h-1.5 rounded-full pointer-events-none opacity-60 ${selectedElementId === el.id ? 'bg-yellow-500 z-10' : isDark ? 'bg-slate-500' : 'bg-slate-400'
                  }`}
                style={{ left: `${getPct(el.startTime)}%`, width: `${getPct(el.endTime - el.startTime)}%` }}
              >
                {label && (
                  <span className="absolute -top-3 left-0 text-[9px] px-1 rounded bg-black/60 text-white">
                    {label}
                  </span>
                )}
              </div>
            );
          })}
          <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none shadow-[0_0_5px_rgba(239,68,68,0.8)]" style={{ left: `${getPct(currentTime)}%` }}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 transform rotate-45"></div>
          </div>
        </div>
        {segmentTotal > 0 && (
          <div
            className={`relative mt-3 h-10 rounded-lg border select-none cursor-pointer overflow-hidden ${isFocusMode
              ? 'bg-black/20 border-white/20 backdrop-blur-sm'
              : isDark
                ? 'bg-slate-900 border-slate-700'
                : 'bg-white border-slate-200'
              }`}
            onMouseDown={onSegmentSeek}
            title="Навігація по сегментах"
          >
            <div
              className={`absolute inset-0 ${isFocusMode ? 'bg-black/10' : isDark ? 'bg-slate-800/40' : 'bg-slate-50'
                }`}
            />
            {activeSegments.map((seg, index) => {
              const segLen = Math.max(0, seg.end - seg.start);
              const left =
                segmentTotal > 0
                  ? (getSegmentTotal(activeSegments.slice(0, index)) / segmentTotal) * 100
                  : 0;
              const width = segmentTotal > 0 ? (segLen / segmentTotal) * 100 : 0;
              return (
                <div
                  key={seg.id}
                  className={`absolute top-2 bottom-2 rounded border ${activeSegmentMeta.track}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              );
            })}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 pointer-events-none shadow-[0_0_5px_rgba(244,63,94,0.8)]"
              style={{
                left: `${segmentTotal > 0 ? (segmentOffset / segmentTotal) * 100 : 0}%`
              }}
            >
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-rose-500 transform rotate-45"></div>
            </div>
          </div>
        )}
      </div>
      <video ref={processingVideoRef} src={processingSrc || activeVideo?.url || undefined} className="hidden" />
    </>
  );
}

export default memo(PlayerTimeline);
