import { useEffect } from 'react';

export default function useBatchAutoExport({
  isBatchMode,
  batchQueue,
  setIsBatchMode,
  currentId,
  switchVideo,
  isProcessing,
  activeVideo,
  currentEdit,
  processingVideoRef,
  startProcessing
}) {
  useEffect(() => {
    if (!isBatchMode) return;
    if (batchQueue.length === 0) {
      setIsBatchMode(false);
      alert("Всі обрані файли успішно оброблено та завантажено!");
      return;
    }
    const nextId = batchQueue[0];
    if (currentId !== nextId) switchVideo(nextId);
  }, [batchQueue, currentId, isBatchMode, setIsBatchMode, switchVideo]);

  useEffect(() => {
    if (!isBatchMode || isProcessing || batchQueue.length === 0) return;
    if (batchQueue[0] !== currentId) return;
    if (!activeVideo?.url || !activeVideo?.file) return;
    if (!currentEdit?.meta?.duration) return;
    const vid = processingVideoRef?.current;
    if (!vid) return;

    const startWhenReady = () => startProcessing({ autoDownload: true });

    if (vid.readyState >= 1) {
      const timer = setTimeout(startWhenReady, 300);
      return () => clearTimeout(timer);
    }

    const onReady = () => startWhenReady();
    vid.addEventListener('loadedmetadata', onReady, { once: true });
    return () => vid.removeEventListener('loadedmetadata', onReady);
  }, [
    activeVideo?.file,
    activeVideo?.url,
    batchQueue,
    currentEdit?.meta?.duration,
    currentId,
    isBatchMode,
    isProcessing,
    processingVideoRef,
    startProcessing
  ]);
}
