import { useEffect, useRef } from 'react';
import { STORAGE_KEYS } from '../../lib/editorConstants';
import {
  loadFromStorage,
  resolveSegmentModeFromMeta,
  resolveSegmentModeFromSuffix,
  resolveSuffixFromMode,
  saveToStorage
} from '../../lib/editorUtils';

export default function usePlaylistPersistence({
  savedEditsRef,
  buildEditFromSaved,
  getSavedEditForVideo,
  dedupePlaylistAndEdits,
  getFileKeyCounts,
  setPlaylist,
  setEdits,
  currentId,
  setCurrentId,
  playlist,
  playlistRef,
  currentEdit,
  buildServerFileUrl,
  showHud,
  disableIdb = false,
  localHydrationEnabled = true,
  autoSaveEnabled = true
}) {
  const dbRef = useRef(null);
  const editsLoadedRef = useRef(false);
  const localHydratedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const MAX_IDB_VIDEOS = 150;
  const MAX_IDB_EDITS = 500;

  const openDb = () =>
    new Promise((resolve, reject) => {
      if (disableIdb) {
        reject(new Error('IndexedDB вимкнено'));
        return;
      }
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB недоступна'));
        return;
      }
      const request = indexedDB.open('video-cut-db', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'fileKey' });
        }
        if (!db.objectStoreNames.contains('edits')) {
          db.createObjectStore('edits', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  const getDb = async () => {
    if (dbRef.current) return dbRef.current;
    const db = await openDb();
    dbRef.current = db;
    return db;
  };

  const trimIdbStore = async (storeName, maxItems) => {
    if (disableIdb) return false;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        if (items.length <= maxItems) return;
        const sorted = items.slice().sort((a, b) => {
          const aTime = a.updatedAt || a.savedAt || a.lastModified || 0;
          const bTime = b.updatedAt || b.savedAt || b.lastModified || 0;
          return bTime - aTime;
        });
        sorted.slice(maxItems).forEach(item => {
          const key = storeName === 'videos' ? item.fileKey : item.id;
          if (key) store.delete(key);
        });
      };
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbPutVideo = async record => {
    if (disableIdb) return false;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      const payload = { ...record, savedAt: record.savedAt || Date.now() };
      tx.objectStore('videos').put(payload);
      tx.oncomplete = () => {
        resolve(true);
        trimIdbStore('videos', MAX_IDB_VIDEOS).catch(() => void 0);
      };
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbGetVideo = async fileKey => {
    if (disableIdb) return null;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readonly');
      const req = tx.objectStore('videos').get(fileKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  };

  const idbDeleteVideo = async fileKey => {
    if (disableIdb) return false;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('videos', 'readwrite');
      tx.objectStore('videos').delete(fileKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbSaveEdit = async (id, snapshot) => {
    if (!id) return;
    if (disableIdb) return;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edits', 'readwrite');
      tx.objectStore('edits').put({ id, snapshot, updatedAt: Date.now() });
      tx.oncomplete = () => {
        resolve(true);
        trimIdbStore('edits', MAX_IDB_EDITS).catch(() => void 0);
      };
      tx.onerror = () => reject(tx.error);
    });
  };

  const idbLoadEdits = async () => {
    if (disableIdb) return null;
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('edits', 'readonly');
      const req = tx.objectStore('edits').getAll();
      req.onsuccess = () => {
        const result = {};
        (req.result || []).forEach(item => {
          if (item?.id && item.snapshot) result[item.id] = item.snapshot;
        });
        resolve(result);
      };
      req.onerror = () => reject(req.error);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const hydrateFromIdb = async () => {
      if (disableIdb) return;
      if (editsLoadedRef.current) return;
      try {
        const idbEdits = await idbLoadEdits();
        if (cancelled || !idbEdits || Object.keys(idbEdits).length === 0) {
          editsLoadedRef.current = true;
          return;
        }
        const current = savedEditsRef.current || {};
        if (Object.keys(current).length === 0) {
          savedEditsRef.current = idbEdits;
          saveToStorage(STORAGE_KEYS.edits, idbEdits);
          setEdits(prev => {
            const next = { ...prev };
            Object.entries(idbEdits).forEach(([key, snap]) => {
              const restored = buildEditFromSaved(snap);
              if (restored) next[key] = restored;
            });
            return next;
          });
        }
      } catch {
        void 0;
      } finally {
        editsLoadedRef.current = true;
      }
    };
    hydrateFromIdb();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    trimIdbStore('videos', MAX_IDB_VIDEOS).catch(() => void 0);
    trimIdbStore('edits', MAX_IDB_EDITS).catch(() => void 0);
  }, []);

  useEffect(() => {
    if (!localHydrationEnabled) return;
    if (localHydratedRef.current) return;
    const savedList = loadFromStorage(STORAGE_KEYS.playlist, []);
    if (!Array.isArray(savedList) || savedList.length === 0) return;
    const normalized = savedList
      .filter(item => item?.fileKey)
      .map(item => {
        const fallbackMode =
          resolveSegmentModeFromMeta(item.sheetMode, item.sheetCameraType) ||
          resolveSegmentModeFromSuffix(item.suffix);
        const fallbackChannels = fallbackMode
          ? [
              {
                mode: fallbackMode,
                suffix: item.suffix || resolveSuffixFromMode(item.sheetMode, item.sheetCameraType),
                sheetMode: item.sheetMode || '',
                sheetCameraType: item.sheetCameraType || '',
                sheetStatus: item.sheetStatus || '',
                sheetRow: item.sheetRow || null
              }
            ]
          : [];
        return {
          ...item,
          url: null,
          file: null,
          checked: false,
          isLoading: false,
          suffix: item.suffix || '',
          sheetRow: item.sheetRow || null,
          sheetMode: item.sheetMode || '',
          sheetCameraType: item.sheetCameraType || '',
          sheetStatus: item.sheetStatus || '',
          notRelevant: !!item.notRelevant,
          hasSnow: !!item.hasSnow,
          source: item.source || '',
          sourcePath: item.sourcePath || '',
          sourceBaseDir: item.sourceBaseDir || '',
          channels: Array.isArray(item.channels) ? item.channels : fallbackChannels
        };
      });
    const { playlist: deduped } = dedupePlaylistAndEdits(normalized, {});
    const fileKeyCounts = getFileKeyCounts(deduped);
    const savedEdits = savedEditsRef.current || {};
    setPlaylist(deduped);
    setEdits(prev => {
      const next = { ...prev };
      deduped.forEach(item => {
        const restored = buildEditFromSaved(getSavedEditForVideo(savedEdits, item, fileKeyCounts));
        if (restored) next[item.id] = restored;
      });
      return next;
    });
    if (!currentId && deduped[0]) setCurrentId(deduped[0].id);
    localHydratedRef.current = true;
  }, [
    localHydrationEnabled,
    buildEditFromSaved,
    currentId,
    dedupePlaylistAndEdits,
    getFileKeyCounts,
    getSavedEditForVideo,
    savedEditsRef,
    setCurrentId,
    setEdits,
    setPlaylist
  ]);

  useEffect(() => {
    if (!currentId) return;
    const currentVideo = playlist.find(v => v.id === currentId);
    if (!currentVideo?.id) return;
    const snapshot = {
      trim: currentEdit.trim,
      crop: currentEdit.crop,
      elements: currentEdit.elements,
      segments: currentEdit.segments,
      segmentSets: currentEdit.segmentSets,
      segmentMode: currentEdit.segmentMode,
      viewMode: currentEdit.viewMode,
      meta: {
        duration: currentEdit.meta.duration,
        width: currentEdit.meta.width,
        height: currentEdit.meta.height
      }
    };
    const saved = { ...(savedEditsRef.current || {}) };
    saved[currentVideo.id] = snapshot;
    if (currentVideo.fileKey && currentVideo.fileKey !== currentVideo.id) {
      saved[currentVideo.fileKey] = snapshot;
    }
    savedEditsRef.current = saved;
    pendingSaveRef.current = { currentVideo, snapshot };
    if (!autoSaveEnabled) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingSaveRef.current;
      if (!pending) return;
      pendingSaveRef.current = null;
      saveToStorage(STORAGE_KEYS.edits, savedEditsRef.current || {});
      idbSaveEdit(pending.currentVideo.id, pending.snapshot).catch(() => {
        void 0;
      });
      if (pending.currentVideo.fileKey && pending.currentVideo.fileKey !== pending.currentVideo.id) {
        idbSaveEdit(pending.currentVideo.fileKey, pending.snapshot).catch(() => {
          void 0;
        });
      }
    }, 200);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [currentId, currentEdit, playlist, autoSaveEnabled]);

  useEffect(() => {
    if (!currentId) return;
    const currentVideo = playlistRef.current.find(v => v.id === currentId);
    if (!currentVideo || currentVideo.url) return;
    if (currentVideo.source === 'server' && currentVideo.sourcePath) {
      let canceled = false;
      const remoteUrl = buildServerFileUrl(currentVideo.sourcePath);
      const loadServerFile = async () => {
        setPlaylist(prev => prev.map(v => (v.id === currentId ? { ...v, isLoading: true } : v)));
        try {
          const res = await fetch(remoteUrl);
          if (!res.ok) throw new Error('fetch_failed');
          const blob = await res.blob();
          if (canceled) return;
          const file = new File([blob], currentVideo.name || 'video.mp4', {
            type: blob.type || currentVideo.type || 'video/mp4',
            lastModified: currentVideo.lastModified || Date.now()
          });
          const url = URL.createObjectURL(file);
          setPlaylist(prev =>
            prev.map(v =>
              v.id === currentId
                ? {
                    ...v,
                    file,
                    url,
                    isLoading: false,
                    size: file.size,
                    type: file.type || v.type
                  }
                : v
            )
          );
        } catch {
          if (canceled) return;
          setPlaylist(prev =>
            prev.map(v =>
              v.id === currentId
                ? {
                    ...v,
                    url: remoteUrl,
                    isLoading: false
                  }
                : v
            )
          );
        }
      };
      loadServerFile();
      return () => {
        canceled = true;
      };
    }
    if (disableIdb) return;
    if (!currentVideo.fileKey) return;
    let canceled = false;
    const load = async () => {
      setPlaylist(prev => prev.map(v => (v.id === currentId ? { ...v, isLoading: true } : v)));
      let record = null;
      try {
        record = await idbGetVideo(currentVideo.fileKey);
      } catch {
        void 0;
      }
      if (canceled) return;
      if (!record?.blob) {
        setPlaylist(prev => prev.map(v => (v.id === currentId ? { ...v, isLoading: false } : v)));
        showHud("Файл не знайдено в кеші");
        return;
      }
      const file =
        record.blob instanceof File
          ? record.blob
          : new File([record.blob], record.name || currentVideo.name, {
              type: record.type || currentVideo.type || 'video/mp4',
              lastModified: record.lastModified || currentVideo.lastModified || Date.now()
            });
      const url = URL.createObjectURL(file);
      setPlaylist(prev =>
        prev.map(v =>
          v.id === currentId
            ? {
                ...v,
                file,
                url,
                isLoading: false,
                name: record.name || v.name,
                type: record.type || v.type,
                size: record.size || v.size,
                lastModified: record.lastModified || v.lastModified
              }
            : v
        )
      );
    };
    load();
    return () => {
      canceled = true;
    };
  }, [currentId]);

  return { idbPutVideo, idbDeleteVideo };
}
