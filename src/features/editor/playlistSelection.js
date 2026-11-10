const selectionKey = item => String(item?.fileKey || item?.id || '');

export const getPlaylistSelection = playlist =>
  new Map(
    (Array.isArray(playlist) ? playlist : [])
      .map(item => [selectionKey(item), Boolean(item?.checked)])
      .filter(([key]) => key)
  );

export const getPlaylistItemChecked = (item, selection) => {
  const key = selectionKey(item);
  return key && selection?.has(key) ? selection.get(key) : Boolean(item?.checked);
};
