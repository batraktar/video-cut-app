import { useCallback, useRef, useState } from 'react';
import { DEFAULT_EDIT_STATE, STORAGE_KEYS } from '../../lib/editorConstants';
import {
  clamp,
  filterElementsForMode,
  getDefaultSegmentSets,
  getFileKey,
  getSegmentsForMode,
  normalizeCropPx,
  saveToStorage
} from '../../lib/editorUtils';

export default function useExportProcessing({
  activeVideo,
  currentEdit,
  currentId,
  playlistRef,
  setPlaylist,
  setEdits,
  savedEditsRef,
  setSegmentDraft,
  showHud,
  isBatchMode,
  batchSuffix,
  setBatchQueue,
  queueServerRename,
  allowDoneForVideo,
  getFileKeyVariants,
  getSegmentModeForVideo,
  idbPutVideo,
  idbDeleteVideo
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingJob, setProcessingJob] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [processingSrc, setProcessingSrc] = useState(null);

  const canvasRef = useRef(null);
  const processingVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const stopLoopRef = useRef(null);
  const cancelProcessingRef = useRef(false);

  const addNotification = useCallback(note => {
    setNotifications(prev => [...prev, note]);
  }, []);

  const updateNotification = useCallback((id, updates) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, ...updates } : n)));
  }, []);

  const removeNotification = useCallback(id => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const replaceVideoById = useCallback(
    (videoId, blob, ext, mimeType) => {
      const currentVideo = playlistRef.current.find(v => v.id === videoId);
      if (!currentVideo) return;
      const baseName =
        currentVideo.name?.lastIndexOf('.') !== -1
          ? currentVideo.name.substring(0, currentVideo.name.lastIndexOf('.'))
          : currentVideo.name || 'video';
      const newName = `${baseName}_crop.${ext}`;
      const file = new File([blob], newName, { type: mimeType, lastModified: Date.now() });
      const newFileKey = getFileKey(file);
      const url = URL.createObjectURL(file);
      if (currentVideo.url) URL.revokeObjectURL(currentVideo.url);

      setPlaylist(prev =>
        prev.map(v =>
          v.id === videoId
            ? {
                ...v,
                file,
                url,
                name: newName,
                type: file.type,
                size: file.size,
                lastModified: file.lastModified,
                fileKey: newFileKey,
                isLoading: false
              }
            : v
        )
      );
      if (currentVideo.fileKey && currentVideo.fileKey !== newFileKey) {
        idbDeleteVideo(currentVideo.fileKey).catch(() => {
          void 0;
        });
        const saved = { ...(savedEditsRef.current || {}) };
        delete saved[currentVideo.id];
        savedEditsRef.current = saved;
        saveToStorage(STORAGE_KEYS.edits, saved);
      }
      idbPutVideo({
        fileKey: newFileKey,
        name: newName,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        blob: file
      }).catch(() => {
        void 0;
      });
      const resetEdit = {
        ...DEFAULT_EDIT_STATE,
        trim: { ...DEFAULT_EDIT_STATE.trim },
        crop: { ...DEFAULT_EDIT_STATE.crop },
        elements: [],
        segments: [],
        segmentMode: 'digital',
        segmentSets: getDefaultSegmentSets(),
        meta: { duration: 0, width: 0, height: 0 },
        history: [],
        future: []
      };
      setEdits(prev => ({ ...prev, [videoId]: resetEdit }));
      setSegmentDraft({ start: null, end: null });
      showHud("Відео замінено");
    },
    [
      idbDeleteVideo,
      idbPutVideo,
      playlistRef,
      savedEditsRef,
      setEdits,
      setPlaylist,
      setSegmentDraft,
      showHud
    ]
  );

  const startProcessing = useCallback(
    async (options = {}) => {
      const { autoDownload = false, includeElements = true, replaceSource = false } = options;
      if (!processingVideoRef.current || !activeVideo) return;
      const jobVideo = activeVideo;
      const jobEdit = currentEdit;
      const jobVideoId = currentId;
      const jobId = Date.now().toString();
      const jobName = jobVideo?.name || 'video';
      const jobType = replaceSource ? 'crop' : 'export';
      if (jobVideo.notRelevant) {
        if (jobVideo.source === 'server') {
          await queueServerRename(jobVideo, 'not_relevant');
          showHud("Not relevant: перенесено в done");
        } else {
          showHud("Not relevant доступний лише для файлів з теки");
        }
        return;
      }
      setProcessingJob({
        id: jobId,
        videoId: jobVideoId,
        name: jobName,
        progress: 0,
        status: 'running',
        type: jobType
      });
      addNotification({
        id: jobId,
        videoId: jobVideoId,
        name: jobName,
        progress: 0,
        status: 'running',
        type: jobType
      });
      setProcessingSrc(jobVideo.url);
      cancelProcessingRef.current = false;
      setIsProcessing(true);
      if (!jobVideo.file && jobVideo.source !== 'server') {
        setIsProcessing(false);
        showHud("Файл ще завантажується");
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }
      if (!jobEdit.meta.duration) {
        setIsProcessing(false);
        showHud("Метадані ще не готові");
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }

      const vid = processingVideoRef.current;
      if (vid.src !== jobVideo.url) {
        vid.src = jobVideo.url;
        vid.load();
      }
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: false });
      if (!ctx) {
        setIsProcessing(false);
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';

      const ensureVideoReady = () =>
        new Promise((resolve, reject) => {
          if (vid.readyState >= 2) return resolve();
          const onReady = () => resolve();
          const onError = () => reject(new Error('Не вдалося завантажити відео'));
          vid.addEventListener('loadeddata', onReady, { once: true });
          vid.addEventListener('error', onError, { once: true });
          vid.load();
        });
      try {
        await ensureVideoReady();
      } catch {
        setIsProcessing(false);
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }

      const cropPx = normalizeCropPx(jobEdit.crop, jobEdit.meta);
      if (cropPx.w <= 0 || cropPx.h <= 0) {
        setIsProcessing(false);
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }
      canvas.width = cropPx.w;
      canvas.height = cropPx.h;
      const { trim, meta } = jobEdit;
      const segmentMode = getSegmentModeForVideo(jobVideo);
      const elements = filterElementsForMode(jobEdit.elements, segmentMode);
      const segments = getSegmentsForMode(jobEdit, segmentMode);

      const exportSegments =
        Array.isArray(segments) && segments.length > 0
          ? segments
              .map(seg => ({
                start: clamp(seg.start, 0, meta.duration || 0),
                end: clamp(seg.end, 0, meta.duration || 0)
              }))
              .filter(seg => seg.end > seg.start)
          : [
              {
                start: clamp(trim.start, 0, meta.duration || 0),
                end: clamp(trim.end, 0, meta.duration || 0)
              }
            ];
      if (exportSegments.length === 1 && exportSegments[0].end <= exportSegments[0].start) {
        exportSegments[0] = { start: 0, end: meta.duration };
      }
      if (exportSegments.length === 0) {
        setIsProcessing(false);
        showHud("Немає валідних сегментів");
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }
      const totalDuration = exportSegments.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
      if (totalDuration <= 0.05) {
        setIsProcessing(false);
        showHud("Надто короткий фрагмент для експорту");
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        return;
      }
      let animationId;
      let vfcId = null;
      const useVfc = typeof vid.requestVideoFrameCallback === 'function';
      const stopLoop = () => {
        if (useVfc && vfcId !== null) vid.cancelVideoFrameCallback(vfcId);
        if (!useVfc && animationId) cancelAnimationFrame(animationId);
      };
      stopLoopRef.current = stopLoop;
      let segmentIndex = 0;
      const scheduleNextFrame = () => {
        if (useVfc) vfcId = vid.requestVideoFrameCallback(processFrame);
        else animationId = requestAnimationFrame(processFrame);
      };
      const waitForFrame = () =>
        new Promise(resolve => {
          if (useVfc) {
            vid.requestVideoFrameCallback(() => resolve());
          } else {
            setTimeout(resolve, 0);
          }
        });
      const seekToSegment = async (index, shouldPlay = true) => {
        vid.pause();
        await new Promise(r => {
          vid.onseeked = r;
          vid.currentTime = exportSegments[index].start;
        });
        if (shouldPlay) {
          try {
            await vid.play();
          } catch {
            void 0;
          }
          await waitForFrame();
          scheduleNextFrame();
        }
      };
      await seekToSegment(0, false);

      let targetFps = 30;
      try {
        const sourceStream = vid.captureStream ? vid.captureStream() : null;
        const sourceTrack = sourceStream?.getVideoTracks?.()[0];
        const sourceFps = sourceTrack?.getSettings?.().frameRate;
        if (Number.isFinite(sourceFps) && sourceFps > 0) targetFps = Math.round(sourceFps);
      } catch {
        void 0;
      }
      const stream = canvas.captureStream(targetFps);
      const frameEpsilon = targetFps > 0 ? 1 / targetFps : 0.04;

      let mimeType = 'video/webm';
      const sourceType = jobVideo.file?.type || '';
      if (sourceType.includes('mp4') && MediaRecorder.isTypeSupported('video/mp4'))
        mimeType = 'video/mp4';
      else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
        mimeType = 'video/webm;codecs=vp9';

      let mediaRecorder;
      try {
        let videoBitsPerSecond = null;
        if (jobVideo.file?.size && meta.duration > 0) {
          const totalBps = Math.floor((jobVideo.file.size * 8) / meta.duration);
          videoBitsPerSecond = Math.max(1_000_000, totalBps);
        }
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: videoBitsPerSecond || undefined,
          bitsPerSecond: videoBitsPerSecond || undefined
        });
      } catch {
        mediaRecorder = new MediaRecorder(stream, { mimeType });
      }
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];
      let finalizeCalled = false;
      let hardStopTimer = null;
      const onVideoEnded = () => {
        if (!finalizeCalled) finalizeRecording('ended');
      };
      const cleanupFinalize = () => {
        if (hardStopTimer) clearTimeout(hardStopTimer);
        vid.removeEventListener('ended', onVideoEnded);
      };
      const finalizeRecording = () => {
        if (finalizeCalled) return;
        finalizeCalled = true;
        cleanupFinalize();
        stopLoop();
        if (mediaRecorder.state !== 'inactive') {
          try {
            mediaRecorder.stop();
          } catch {
            void 0;
          }
        }
      };
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorder.onerror = () => {
        setIsProcessing(false);
        updateNotification(jobId, { status: 'canceled' });
        setTimeout(() => removeNotification(jobId), 3000);
        setProcessingJob(null);
        setProcessingSrc(null);
        finalizeRecording();
      };
      mediaRecorder.onstop = () => {
        cleanupFinalize();
        const canceled = cancelProcessingRef.current;
        cancelProcessingRef.current = false;
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        setIsProcessing(false);
        vid.pause();
        mediaRecorderRef.current = null;
        stopLoopRef.current = null;
        setProcessingSrc(null);
        setProcessingJob(null);
        if (canceled) {
          updateNotification(jobId, { status: 'canceled' });
          setTimeout(() => removeNotification(jobId), 3000);
          return;
        }
        const blob = new Blob(chunks, { type: mimeType });
        if (replaceSource) {
          replaceVideoById(jobVideoId, blob, ext, mimeType);
          updateNotification(jobId, { status: 'done', progress: 100 });
          setTimeout(() => removeNotification(jobId), 4000);
          return;
        }
        const url = URL.createObjectURL(blob);
        setEdits(prev => {
          const existing = prev[jobVideoId] || DEFAULT_EDIT_STATE;
          return { ...prev, [jobVideoId]: { ...existing, processedUrl: url, processedExt: ext } };
        });
        updateNotification(jobId, { status: 'done', progress: 100 });
        setTimeout(() => removeNotification(jobId), 4000);

        if (autoDownload) {
          const a = document.createElement('a');
          a.href = url;
          const baseName =
            jobVideo.name.lastIndexOf('.') !== -1
              ? jobVideo.name.substring(0, jobVideo.name.lastIndexOf('.'))
              : jobVideo.name;
          const perVideoSuffix = jobVideo?.suffix || '';
          const extraBatchSuffix = isBatchMode && batchSuffix ? batchSuffix : '';
          const downloadSuffix = `${perVideoSuffix}${extraBatchSuffix}`;
          a.download = `${baseName}${downloadSuffix}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          if (jobVideo.source === 'server') {
            const fileKeyCounts = new Map();
            playlistRef.current.forEach(item => {
              if (!item?.fileKey) return;
              fileKeyCounts.set(item.fileKey, (fileKeyCounts.get(item.fileKey) || 0) + 1);
            });
            const variants = getFileKeyVariants(playlistRef.current);
            const allowRenameOriginal = allowDoneForVideo(jobVideo, fileKeyCounts, variants);
            if (allowRenameOriginal) {
              queueServerRename(jobVideo, 'done');
            }
          }
          if (isBatchMode) setBatchQueue(prev => prev.slice(1));
        }
      };

      mediaRecorder.start();
      vid.addEventListener('ended', onVideoEnded);
      hardStopTimer = setTimeout(() => {
        if (!finalizeCalled) finalizeRecording('timeout');
      }, Math.max(2000, Math.ceil((totalDuration + 1) * 1000)));
      vid.muted = true;
      vid.volume = 0.0;
      try {
        await vid.play();
      } catch (e) {
        console.error(e);
      }
      await waitForFrame();

      let lastVideoTime = vid.currentTime || 0;
      let lastAdvanceAt = performance.now();
      const processFrame = () => {
        if (!isProcessing && vid.paused) return;
        if (vid.readyState < 2) {
          scheduleNextFrame();
          return;
        }
        const now = performance.now();
        if (vid.currentTime > lastVideoTime + 0.0005) {
          lastVideoTime = vid.currentTime;
          lastAdvanceAt = now;
        } else if (now - lastAdvanceAt > 2000) {
          finalizeRecording('stalled');
          return;
        }
        const currentSegment = exportSegments[segmentIndex];
        if (vid.ended || currentSegment.end - vid.currentTime <= frameEpsilon) {
          if (segmentIndex < exportSegments.length - 1) {
            segmentIndex += 1;
            seekToSegment(segmentIndex);
            return;
          }
          finalizeRecording();
          return;
        }

        ctx.drawImage(vid, cropPx.x, cropPx.y, cropPx.w, cropPx.h, 0, 0, cropPx.w, cropPx.h);
        if (includeElements) {
          elements.forEach(el => {
            if (vid.currentTime < el.startTime || vid.currentTime > el.endTime) return;
            const elRealX = (el.x / 100) * meta.width;
            const elRealY = (el.y / 100) * meta.height;
            const elRealW = (el.w / 100) * meta.width;
            const elRealH = (el.h / 100) * meta.height;
            const canvasX = elRealX - cropPx.x;
            const canvasY = elRealY - cropPx.y;
            ctx.fillStyle = el.color;
            ctx.strokeStyle = el.color;
            ctx.lineWidth = el.isOutline ? 1 : Math.max(1, (el.thickness / 100) * meta.width * 0.5);
            if (el.type === 'circle') {
              const cx = canvasX + elRealW / 2;
              const cy = canvasY + elRealH / 2;
              ctx.beginPath();
              ctx.ellipse(cx, cy, elRealW / 2, elRealH / 2, 0, 0, Math.PI * 2);
              if (el.isOutline) ctx.stroke();
              else ctx.fill();
            } else {
              if (el.isOutline) ctx.strokeRect(canvasX, canvasY, elRealW, elRealH);
              else ctx.fillRect(canvasX, canvasY, elRealW, elRealH);
            }
          });
        }

        const currentOffset = exportSegments
          .slice(0, segmentIndex)
          .reduce((sum, seg) => sum + (seg.end - seg.start), 0);
        const currentProgress = currentOffset + (vid.currentTime - currentSegment.start);
        const pct = Math.min(100, (currentProgress / totalDuration) * 100);
        setProcessingJob(prev => (prev?.id === jobId ? { ...prev, progress: pct } : prev));
        updateNotification(jobId, { progress: pct });
        scheduleNextFrame();
      };
      processFrame();
    },
    [
      activeVideo,
      addNotification,
      allowDoneForVideo,
      batchSuffix,
      currentEdit,
      currentId,
      getFileKeyVariants,
      getSegmentModeForVideo,
      isBatchMode,
      isProcessing,
      playlistRef,
      queueServerRename,
      removeNotification,
      replaceVideoById,
      setBatchQueue,
      setEdits,
      showHud,
      updateNotification
    ]
  );

  return {
    isProcessing,
    processingJob,
    processingSrc,
    notifications,
    canvasRef,
    processingVideoRef,
    mediaRecorderRef,
    stopLoopRef,
    cancelProcessingRef,
    addNotification,
    updateNotification,
    removeNotification,
    replaceVideoById,
    startProcessing
  };
}
