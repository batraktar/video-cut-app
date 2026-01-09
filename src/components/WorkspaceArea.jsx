import EmptyState from './EmptyState';
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
  selectedCount,
  openFfmpegModal,
  openFfmpegBatchModal,
  toggleNotRelevant,
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
  selectedElement,
  duplicateElement,
  copyAttributes,
  pasteAttributes,
  copiedAttributes,
  deleteElement,
  updateElement
}) {
  if (!activeVideo) {
    return <EmptyState onFileChange={onFileChange} />;
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
      {/* LEFT: PLAYER */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 min-w-0 overflow-hidden relative">
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
          onPanStart={onPanStart}
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
          onDragStart={onDragStart}
          onSelectElement={onSelectElement}
          onFocusResizeStart={onFocusResizeStart}
        />
        <PlayerTimeline
          isFocusMode={isFocusMode}
          isDark={isDark}
          currentTime={currentTime}
          currentEdit={currentEdit}
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
          activeVideo={activeVideo}
        />
      </div>

      {/* RIGHT: PROPERTIES */}
      {!isFocusMode && (
        <PropertiesPanel
          isDark={isDark}
          activeVideo={activeVideo}
          selectedCount={selectedCount}
          openFfmpegModal={openFfmpegModal}
          openFfmpegBatchModal={openFfmpegBatchModal}
          toggleNotRelevant={toggleNotRelevant}
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
          selectedElement={selectedElement}
          duplicateElement={duplicateElement}
          copyAttributes={copyAttributes}
          pasteAttributes={pasteAttributes}
          copiedAttributes={copiedAttributes}
          deleteElement={deleteElement}
          updateElement={updateElement}
        />
      )}
    </div>
  );
}
