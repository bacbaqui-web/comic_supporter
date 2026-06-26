export function createDriveImageUrlStore({ downloadBlob, getBookmarks = () => [] }) {
  const cache = new Map();

  function revoke(fileId) {
    const url = cache.get(fileId);
    if (url) URL.revokeObjectURL(url);
    cache.delete(fileId);
  }

  function revokeAll() {
    for (const url of cache.values()) {
      URL.revokeObjectURL(url);
    }
    cache.clear();
  }

  async function getObjectUrl(fileId) {
    let url = cache.get(fileId);
    if (!url) {
      const blob = await downloadBlob(fileId);
      url = URL.createObjectURL(blob);
      cache.set(fileId, url);
    }
    return url;
  }

  async function resolveBookmarkImages() {
    for (const bookmark of getBookmarks() || []) {
      if (bookmark.driveFileId && !bookmark.url) {
        try {
          bookmark.url = await getObjectUrl(bookmark.driveFileId);
        } catch (e) {
          console.warn('bookmark image load failed', bookmark.name, e);
        }
      }
      if (bookmark.previewDriveFileId && !bookmark.previewImageUrl) {
        try {
          bookmark.previewImageUrl = await getObjectUrl(bookmark.previewDriveFileId);
        } catch (e) {
          console.warn('preview image load failed', bookmark.name, e);
        }
      }
    }
  }

  return {
    clear: revokeAll,
    resolveBookmarkImages,
    revoke,
    revokeAll
  };
}
