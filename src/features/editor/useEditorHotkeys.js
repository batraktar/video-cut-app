import { useEffect, useRef } from 'react';
import { SEGMENT_MODES } from '../../lib/editorConstants';
import { normalizeName } from '../../lib/editorUtils';
import { getSegmentModeForVideo } from './videoMeta';
import { eventMatchesAction } from './hotkeys';

export default function useEditorHotkeys(params) {
  const paramsRef = useRef(params);
  const lastSeekHudRef = useRef(0);
  useEffect(() => {
    paramsRef.current = params;
  });

  useEffect(() => {
    const handleKeyDown = e => {
      const {
        hotkeys,
        hotkeyCaptureRef,
        altDownRef,
        altUsedWithOtherRef,
        spacePanRef,
        viewportHoverRef,
        searchInputRef,
        videoRef,
        activeVideo,
        isProcessing,
        processingJob,
        currentId,
        currentEdit,
        activeSegmentMode,
        seekStep,
        setCurrentTime,
        setIsFocusMode,
        setFocusSideOpen,
        undo,
        redo,
        cycleSegmentMode,
        cycleSeekStep,
        addSegmentFromDraft,
        addRect,
        updateElement,
        setSegmentDraft,
        toggleSegmentSnowAtTime,
        togglePlayback,
        copyAttributes,
        pasteAttributes,
        deleteElement,
        showHud
      } = paramsRef.current;

      if (hotkeyCaptureRef?.current) return;

      if (e.code === 'AltLeft' || e.code === 'AltRight') {
        if (!altDownRef.current) {
          altDownRef.current = true;
          altUsedWithOtherRef.current = false;
        }
        return;
      }
      if (altDownRef.current) altUsedWithOtherRef.current = true;
      if (!activeVideo || (isProcessing && processingJob?.videoId === currentId)) return;

      if (eventMatchesAction(e, hotkeys, 'undo')) {
        e.preventDefault();
        undo();
        return;
      }
      if (eventMatchesAction(e, hotkeys, 'redo')) {
        e.preventDefault();
        redo();
        return;
      }
      if (eventMatchesAction(e, hotkeys, 'focusSearch')) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      if (
        eventMatchesAction(e, hotkeys, 'toggleFocusMode') &&
        e.target?.tagName !== 'INPUT' &&
        e.target?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsFocusMode(prev => {
          const next = !prev;
          if (!next) setFocusSideOpen(false);
          return next;
        });
        return;
      }
      if (
        eventMatchesAction(e, hotkeys, 'cycleSegmentMode') &&
        e.target?.tagName !== 'INPUT' &&
        e.target?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        cycleSegmentMode();
        return;
      }

      if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') {
        if (eventMatchesAction(e, hotkeys, 'addSegment') && e.target?.dataset?.segmentInput === 'true') {
          e.preventDefault();
          addSegmentFromDraft();
        }
        return;
      }

      if (
        eventMatchesAction(e, hotkeys, 'panHold') &&
        viewportHoverRef.current &&
        currentEdit.viewMode === 'editor'
      ) {
        e.preventDefault();
        spacePanRef.current = true;
        return;
      }

      const vid = videoRef.current;
      if (!vid) return;

      if (eventMatchesAction(e, hotkeys, 'addRect')) {
        e.preventDefault();
        addRect();
        showHud("Додано прямокутник");
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'toggleElementChannel')) {
        e.preventDefault();
        if (!currentEdit.selectedId) {
          showHud("Спочатку оберіть елемент");
          return;
        }
        const selected = currentEdit.elements.find(el => el.id === currentEdit.selectedId);
        if (!selected) return;
        const mode =
          activeSegmentMode || currentEdit.segmentMode || getSegmentModeForVideo(activeVideo) || 'digital';
        const normalizedActive = normalizeName(mode);
        const currentMode = normalizeName(selected.channelMode);
        const nextMode = currentMode === normalizedActive ? 'all' : mode;
        updateElement(selected.id, { channelMode: nextMode });
        if (nextMode === 'all') {
          showHud("Канал: всі");
        } else {
          const label = SEGMENT_MODES.find(item => item.id === mode)?.label || mode;
          showHud(`Канал: ${label}`);
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'addSegment')) {
        e.preventDefault();
        addSegmentFromDraft();
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'toggleSnowSegment')) {
        e.preventDefault();
        toggleSegmentSnowAtTime?.();
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'outline')) {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { isOutline: true });
          showHud("Контур");
        } else {
          showHud("Спочатку оберіть елемент");
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'fill')) {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { isOutline: false });
          showHud("Заливка");
        } else {
          showHud("Спочатку оберіть елемент");
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'copyAttributes')) {
        e.preventDefault();
        const selected = currentEdit.elements.find(el => el.id === currentEdit.selectedId);
        if (selected) copyAttributes(selected);
        else showHud("Спочатку оберіть елемент");
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'pasteAttributes')) {
        e.preventDefault();
        if (currentEdit.selectedId) pasteAttributes(currentEdit.selectedId);
        else showHud("Спочатку оберіть елемент");
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'deleteElement')) {
        if (currentEdit.selectedId) {
          e.preventDefault();
          deleteElement(currentEdit.selectedId);
          showHud("Елемент видалено");
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'togglePlayback')) {
        e.preventDefault();
        togglePlayback();
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'seekBackLarge')) {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - 2);
        const now = Date.now();
        if (now - lastSeekHudRef.current > 120) {
          lastSeekHudRef.current = now;
          showHud(`⏪ ${vid.currentTime.toFixed(3)}s`);
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'seekForwardLarge')) {
        e.preventDefault();
        vid.currentTime = Math.min(currentEdit.meta.duration, vid.currentTime + 2);
        const now = Date.now();
        if (now - lastSeekHudRef.current > 120) {
          lastSeekHudRef.current = now;
          showHud(`⏩ ${vid.currentTime.toFixed(3)}s`);
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'seekForwardSmall')) {
        e.preventDefault();
        vid.currentTime = Math.min(currentEdit.meta.duration, vid.currentTime + seekStep);
        const now = Date.now();
        if (now - lastSeekHudRef.current > 120) {
          lastSeekHudRef.current = now;
          showHud(`+${seekStep}s: ${vid.currentTime.toFixed(3)}s`);
        }
        setCurrentTime(vid.currentTime);
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'seekBackSmall')) {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - seekStep);
        const now = Date.now();
        if (now - lastSeekHudRef.current > 120) {
          lastSeekHudRef.current = now;
          showHud(`-${seekStep}s: ${vid.currentTime.toFixed(3)}s`);
        }
        setCurrentTime(vid.currentTime);
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'markStart')) {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { startTime: vid.currentTime });
          showHud(`Початок: ${vid.currentTime.toFixed(2)}s`);
        } else {
          setSegmentDraft(prev => ({ ...prev, start: vid.currentTime }));
          showHud(`Сегмент початок: ${vid.currentTime.toFixed(2)}s`);
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'markEnd')) {
        e.preventDefault();
        if (currentEdit.selectedId) {
          updateElement(currentEdit.selectedId, { endTime: vid.currentTime });
          showHud(`Кінець: ${vid.currentTime.toFixed(2)}s`);
        } else {
          setSegmentDraft(prev => ({ ...prev, end: vid.currentTime }));
          showHud(`Сегмент кінець: ${vid.currentTime.toFixed(2)}s`);
        }
        return;
      }

      if (eventMatchesAction(e, hotkeys, 'cycleSeekStep')) {
        e.preventDefault();
        cycleSeekStep();
      }
    };

    const handleKeyUp = e => {
      const { hotkeys, hotkeyCaptureRef, altDownRef, altUsedWithOtherRef, spacePanRef, cycleSeekStep } =
        paramsRef.current;

      if (hotkeyCaptureRef?.current) return;

      if (eventMatchesAction(e, hotkeys, 'panHold')) {
        spacePanRef.current = false;
      }

      if (e.code !== 'AltLeft' && e.code !== 'AltRight') return;
      if (altDownRef.current && !altUsedWithOtherRef.current) {
        cycleSeekStep();
      }
      altDownRef.current = false;
      altUsedWithOtherRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
}
