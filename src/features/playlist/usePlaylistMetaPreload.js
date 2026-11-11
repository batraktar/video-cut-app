import { useEffect, useRef, useState } from 'react';

// Фонова прогрузка метаданих (розмір + тривалість) для відео у списку, щоб
// підписи «1024x1280 • 94.5s» зʼявлялись самі, без відкриття кожного відео.
// Навмисно НЕ чіпає edits і не запускає плеєр: лише окремий кеш для списку,
// тож відкриття відео й експорт працюють як раніше.
function loadMeta(url) {
  return new Promise(resolve => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const done = value => {
      el.removeAttribute('src');
      try { el.load(); } catch { /* noop */ }
      resolve(value);
    };
    el.addEventListener('loadedmetadata', () => {
      done({
        width: el.videoWidth || 0,
        height: el.videoHeight || 0,
        duration: Number.isFinite(el.duration) ? el.duration : 0
      });
    }, { once: true });
    el.addEventListener('error', () => done(null), { once: true });
    el.src = url;
  });
}

export default function usePlaylistMetaPreload({ playlist, edits, buildUrl, concurrency = 3 }) {
  const [metaCache, setMetaCache] = useState({});
  const cacheRef = useRef({});
  const inflightRef = useRef(new Set());

  useEffect(() => {
    const missing = (playlist || []).filter(video => {
      if (!video?.id || !video?.sourcePath) return false;
      const meta = edits?.[video.id]?.meta;
      if (meta?.width && meta?.duration) return false;
      if (cacheRef.current[video.id] || inflightRef.current.has(video.id)) return false;
      return true;
    });
    if (missing.length === 0) return undefined;
    let cancelled = false;
    const queue = [...missing];
    const worker = async () => {
      while (!cancelled && queue.length > 0) {
        const video = queue.shift();
        inflightRef.current.add(video.id);
        try {
          const meta = await loadMeta(buildUrl(video.sourcePath));
          if (!cancelled && meta && (meta.width || meta.duration)) {
            cacheRef.current[video.id] = meta;
            setMetaCache(prev => ({ ...prev, [video.id]: meta }));
          }
        } catch {
          // Файл недоступний — рядок просто лишиться без підпису.
        } finally {
          inflightRef.current.delete(video.id);
        }
      }
    };
    for (let i = 0; i < Math.min(concurrency, queue.length); i += 1) {
      worker();
    }
    return () => { cancelled = true; };
  }, [playlist, edits, buildUrl]);

  return metaCache;
}
