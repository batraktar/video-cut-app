import { useState } from 'react';
import CanvasTools from './CanvasTools';
import EmptyState from './EmptyState';
import InspectorDrawer from './InspectorDrawer';
import PlayerTimeline from './PlayerTimeline';
import PlayerViewport from './PlayerViewport';
import PropertiesPanel from './PropertiesPanel';

export default function WorkspaceArea({
  activeVideo,
  onFileChange,
  isFocusMode,
  isDark,
  focusHeightPx,
  viewportHeightClass,
  zoom,
  onZoomToSelected,
  onFitCanvas,
  getPreviewStyle,
  onPanStart,
  onViewportMouseEnter,
  onViewportMouseLeave,
  viewportRef,
  overlayRef,
  videoRef,
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
  seekStep,
  activeSegments,
  activeSegmentModesMeta,
  activeSegmentMode,
  onSetActiveSegmentMode,
  playSegmentsOnly,
  onTogglePlaySegments,
  togglePlayback,
  isPlaying,
  getPct,
  timelineRef,
  onSeek,
  allSegmentsByMode,
  activeSegmentMeta,
  getSegmentTotal,
  segmentTotal,
  segmentOffset,
  onSegmentSeek,
  processingVideoRef,
  processingSrc,
  visibleElements,
  processedUrl,
  selectedElementId,
  selectedCount,
  openFfmpegModal,
  openFfmpegBatchModal,
  toggleNotRelevant,
  addRect,
  addCircle,
  clearSegments,
  segmentDraft,
  setSegmentDraft,
  parseNumericInput,
  segmentStartRef,
  segmentEndRef,
  addSegmentFromDraft,
  updateSegment,
  moveSegment,
  removeSegment,
  activeSegmentId,
  setActiveSegmentId,
  onCycleSegmentChannel,
  selectedElement,
  duplicateElement,
  copyAttributes,
  pasteAttributes,
  copiedAttributes,
  deleteElement,
  updateElement,
  hotkeys,
  setHotkeys,
  hotkeyCaptureRef,
  snowSpeed,
  setSnowSpeed
}) {
  const [canvasTool, setCanvasTool] = useState('select');

  if (!activeVideo) {
    return <EmptyState onFileChange={onFileChange} />;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-slate-800">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!isFocusMode && (
          <CanvasTools
            tool={canvasTool}
            zoom={zoom}
            onToolChange={setCanvasTool}
            onFit={onFitCanvas}
            onZoomIn={() => onZoomToSelected(zoom + 0.1)}
            onZoomOut={() => onZoomToSelected(zoom - 0.1)}
            onAddRect={addRect}
            onAddCircle={addCircle}
          />
        )}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#202124]">
          <PlayerViewport
          viewportRef={viewportRef}
          overlayRef={overlayRef}
          videoRef={videoRef}
          isDark={isDark}
          isFocusMode={isFocusMode}
          focusHeightPx={focusHeightPx}
          viewportHeightClass={viewportHeightClass}
          zoom={zoom}
          getPreviewStyle={getPreviewStyle}
          onPanStart={event => onPanStart(event, canvasTool === 'pan')}
          onViewportMouseEnter={onViewportMouseEnter}
          onViewportMouseLeave={onViewportMouseLeave}
          activeVideo={activeVideo}
          currentEdit={currentEdit}
          currentTime={currentTime}
          isProcessing={isProcessing}
          processingJob={processingJob}
          currentId={currentId}
          videoMaxHeight={videoMaxHeight}
          onMetadata={onMetadata}
          onDragStart={
            canvasTool === 'pan'
              ? event => onPanStart(event, true)
              : onDragStart
          }
          onSelectElement={onSelectElement}
          onFocusResizeStart={onFocusResizeStart}
          visibleElements={visibleElements}
          canvasTool={canvasTool}
        />
        </main>

        {!isFocusMode && (
          <InspectorDrawer isDark={isDark} segmentCount={activeSegments.length}>
	          <PropertiesPanel
	          isDark={isDark}
	          activeVideo={activeVideo}
            selectedCount={selectedCount}
            openFfmpegModal={openFfmpegModal}
            openFfmpegBatchModal={openFfmpegBatchModal}
            toggleNotRelevant={toggleNotRelevant}
            addRect={addRect}
            addCircle={addCircle}
            clearSegments={clearSegments}
            activeSegments={activeSegments}
            activeSegmentModesMeta={activeSegmentModesMeta}
            activeSegmentMode={activeSegmentMode}
            setActiveSegmentMode={onSetActiveSegmentMode}
            segmentDraft={segmentDraft}
            setSegmentDraft={setSegmentDraft}
            currentTime={currentTime}
            parseNumericInput={parseNumericInput}
            segmentStartRef={segmentStartRef}
            segmentEndRef={segmentEndRef}
            addSegmentFromDraft={addSegmentFromDraft}
            updateSegment={updateSegment}
            moveSegment={moveSegment}
            removeSegment={removeSegment}
            activeSegmentId={activeSegmentId}
            setActiveSegmentId={setActiveSegmentId}
            onCycleSegmentChannel={onCycleSegmentChannel}
            selectedElement={selectedElement}
            duplicateElement={duplicateElement}
            copyAttributes={copyAttributes}
            pasteAttributes={pasteAttributes}
	          copiedAttributes={copiedAttributes}
	          deleteElement={deleteElement}
	          updateElement={updateElement}
	          hotkeys={hotkeys}
	          setHotkeys={setHotkeys}
	          hotkeyCaptureRef={hotkeyCaptureRef}
	          snowSpeed={snowSpeed}
	          setSnowSpeed={setSnowSpeed}
	          />
	        </InspectorDrawer>
	      )}
      </div>

      <div className={isFocusMode ? '' : 'shrink-0 border-t border-slate-700'}>
        <PlayerTimeline
          isFocusMode={isFocusMode}
          isDark={isDark}
          currentTime={currentTime}
          duration={currentEdit.meta.duration}
          trim={currentEdit.trim}
          selectedElementId={selectedElementId}
          seekStep={seekStep}
          activeSegments={activeSegments}
          activeSegmentModesMeta={activeSegmentModesMeta}
          activeSegmentMode={activeSegmentMode}
          onSetActiveSegmentMode={onSetActiveSegmentMode}
          playSegmentsOnly={playSegmentsOnly}
          onTogglePlaySegments={onTogglePlaySegments}
          togglePlayback={togglePlayback}
          isPlaying={isPlaying}
          isProcessing={isProcessing}
          getPct={getPct}
          timelineRef={timelineRef}
          onSeek={onSeek}
          onDragStart={onDragStart}
          allSegmentsByMode={allSegmentsByMode}
          activeSegmentMeta={activeSegmentMeta}
          getSegmentTotal={getSegmentTotal}
          segmentTotal={segmentTotal}
          segmentOffset={segmentOffset}
          onSegmentSeek={onSegmentSeek}
          processingVideoRef={processingVideoRef}
          processingSrc={processingSrc}
          processedUrl={processedUrl}
          activeVideo={activeVideo}
          visibleElements={visibleElements}
          activeSegmentId={activeSegmentId}
          onSelectSegment={setActiveSegmentId}
          onCycleSegmentChannel={onCycleSegmentChannel}
        />
      </div>
	    </div>
	  );
}
