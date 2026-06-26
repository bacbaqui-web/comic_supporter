export function normalizeTabList(tabs, fallback) {
  const seen = new Set();
  const normalized = (Array.isArray(tabs) ? tabs : [])
    .filter((tab) => tab?.id && !seen.has(tab.id) && seen.add(tab.id))
    .map((tab, index) => ({
      ...tab,
      name: String(tab.name || fallback?.name || '탭').trim() || fallback?.name || '탭',
      order: Number.isFinite(Number(tab.order)) ? Number(tab.order) : index * 10
    }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return normalized.length ? normalized : [fallback];
}

export function driveTimestamp(ms) {
  return { toMillis: () => Number(ms || 0) };
}

export function getDefaultAppData() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    customTasks: [],
    imageBookmarks: [],
    state: {
      taskStatus: {},
      notesTabList: [{ id: 'memo', name: '메모', order: 0 }],
      notesTabs: {},
      notesActiveTabId: 'memo',
      bookmarkTabList: [{ id: 'default', name: '기본', order: 0 }],
      bookmarkActiveTabId: 'default',
      workMusicSongs: [],
      workMusicMode: 'sequential',
      workMusicCurrentIndex: 0,
      workMusicVolume: 80,
      workMusicLastVolume: 80,
      workMusicIsMuted: false,
      workMusicTabList: [{ id: 'default', name: '기본', order: 0 }],
      workMusicActiveTabId: 'default',
      clipPages: []
    }
  };
}

export function collectState(currentAppData = getDefaultAppData()) {
  return {
    taskStatus: window.taskStatus || {},
    notesTabList: normalizeTabList(window.__notesTabList, { id: 'memo', name: '메모', order: 0 }),
    notesTabs: window.__notesTabs || {},
    notesActiveTabId: window.__notesActiveTabId || 'memo',
    bookmarkTabList: window.__bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }],
    bookmarkActiveTabId: window.__bookmarkActiveTabId || 'default',
    workMusicSongs: window.workMusicSongs || [],
    workMusicMode: window.workMusicMode || 'sequential',
    workMusicCurrentIndex: Number(window.workMusicCurrentIndex || 0),
    workMusicVolume: Number(window.workMusicVolume ?? 80),
    workMusicLastVolume: Number(window.workMusicLastVolume ?? 80),
    workMusicIsMuted: !!window.workMusicIsMuted,
    workMusicTabList: window.__workMusicTabList || [{ id: 'default', name: '기본', order: 0 }],
    workMusicActiveTabId: window.__workMusicActiveTabId || 'default',
    clipPages: (currentAppData.state && currentAppData.state.clipPages) || []
  };
}

export function serializableBookmarks(bookmarks = window.imageBookmarks || []) {
  return bookmarks
    .filter((b) => b.driveFileId || b.type !== 'local_pending_image')
    .map((b) => {
      const copy = { ...b };
      if (copy.driveFileId || String(copy.url || '').startsWith('blob:')) {
        copy.url = null;
      }
      if (copy.previewDriveFileId || String(copy.previewImageUrl || '').startsWith('blob:')) {
        copy.previewImageUrl = null;
      }
      if (copy.timestamp?.toMillis) {
        copy.timestampMs = copy.timestamp.toMillis();
        delete copy.timestamp;
      }
      return copy;
    });
}

export function buildAppData(currentAppData = getDefaultAppData()) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    customTasks: window.customTasks || [],
    imageBookmarks: serializableBookmarks(),
    state: collectState(currentAppData)
  };
}

export function applyStoredAppData(data, { revokeAllDriveImageUrls = () => {} } = {}) {
  const currentAppData = data && typeof data === 'object' ? data : getDefaultAppData();
  const st = currentAppData.state || {};
  window.customTasks = Array.isArray(currentAppData.customTasks) ? currentAppData.customTasks : [];
  window.taskStatus = st.taskStatus || {};
  window.__notesTabList =
    Array.isArray(st.notesTabList) && st.notesTabList.length
      ? normalizeTabList(st.notesTabList, { id: 'memo', name: '메모', order: 0 })
      : [{ id: 'memo', name: '메모', order: 0 }];
  window.__notesTabs = st.notesTabs || {};
  window.__notesActiveTabId = st.notesActiveTabId || 'memo';
  window.__bookmarkTabList =
    Array.isArray(st.bookmarkTabList) && st.bookmarkTabList.length
      ? st.bookmarkTabList
      : [{ id: 'default', name: '기본', order: 0 }];
  window.__bookmarkActiveTabId = st.bookmarkActiveTabId || 'default';
  window.workMusicSongs = Array.isArray(st.workMusicSongs) ? st.workMusicSongs : [];
  window.__workMusicTabList =
    Array.isArray(st.workMusicTabList) && st.workMusicTabList.length
      ? st.workMusicTabList
      : [{ id: 'default', name: '기본', order: 0 }];
  window.__workMusicActiveTabId = st.workMusicActiveTabId || 'default';
  window.workMusicMode = st.workMusicMode || 'sequential';
  window.workMusicCurrentIndex = Number(st.workMusicCurrentIndex || 0);
  window.workMusicVolume = Number(st.workMusicVolume ?? 80);
  window.workMusicLastVolume = Number(st.workMusicLastVolume ?? 80);
  window.workMusicIsMuted = !!st.workMusicIsMuted;
  revokeAllDriveImageUrls();
  window.imageBookmarks = (
    Array.isArray(currentAppData.imageBookmarks) ? currentAppData.imageBookmarks : []
  ).map((b) => ({
    ...b,
    timestamp: driveTimestamp(b.timestampMs || Date.parse(b.timestamp || '') || 0)
  }));
  return currentAppData;
}

export function splitAppDataForDrive(data) {
  data = data || getDefaultAppData();
  const st = data.state || {};
  return {
    calendar: {
      customTasks: data.customTasks || [],
      taskStatus: st.taskStatus || {},
      updatedAt: data.updatedAt || new Date().toISOString()
    },
    notes: {
      notesTabList: st.notesTabList || [{ id: 'memo', name: '메모', order: 0 }],
      notesTabs: st.notesTabs || {},
      notesActiveTabId: st.notesActiveTabId || 'memo',
      updatedAt: data.updatedAt || new Date().toISOString()
    },
    bookmarks: {
      imageBookmarks: data.imageBookmarks || [],
      bookmarkTabList: st.bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }],
      bookmarkActiveTabId: st.bookmarkActiveTabId || 'default',
      updatedAt: data.updatedAt || new Date().toISOString()
    },
    workmusic: {
      workMusicSongs: st.workMusicSongs || [],
      workMusicMode: st.workMusicMode || 'sequential',
      workMusicCurrentIndex: Number(st.workMusicCurrentIndex || 0),
      workMusicVolume: Number(st.workMusicVolume ?? 80),
      workMusicLastVolume: Number(st.workMusicLastVolume ?? 80),
      workMusicIsMuted: !!st.workMusicIsMuted,
      workMusicTabList: st.workMusicTabList || [{ id: 'default', name: '기본', order: 0 }],
      workMusicActiveTabId: st.workMusicActiveTabId || 'default',
      updatedAt: data.updatedAt || new Date().toISOString()
    },
    clipviewer: {
      clipPages: st.clipPages || [],
      updatedAt: data.updatedAt || new Date().toISOString()
    }
  };
}

export function mergeDriveParts(parts) {
  const base = getDefaultAppData();
  if (parts.calendar) {
    base.customTasks = parts.calendar.customTasks || [];
    base.state.taskStatus = parts.calendar.taskStatus || {};
  }
  if (parts.notes) {
    base.state.notesTabList = parts.notes.notesTabList || base.state.notesTabList;
    base.state.notesTabs = parts.notes.notesTabs || {};
    base.state.notesActiveTabId = parts.notes.notesActiveTabId || 'memo';
  }
  if (parts.bookmarks) {
    base.imageBookmarks = parts.bookmarks.imageBookmarks || [];
    base.state.bookmarkTabList = parts.bookmarks.bookmarkTabList || base.state.bookmarkTabList;
    base.state.bookmarkActiveTabId = parts.bookmarks.bookmarkActiveTabId || 'default';
  }
  if (parts.workmusic) {
    base.state.workMusicSongs = parts.workmusic.workMusicSongs || [];
    base.state.workMusicMode = parts.workmusic.workMusicMode || 'sequential';
    base.state.workMusicCurrentIndex = Number(parts.workmusic.workMusicCurrentIndex || 0);
    base.state.workMusicVolume = Number(parts.workmusic.workMusicVolume ?? 80);
    base.state.workMusicLastVolume = Number(parts.workmusic.workMusicLastVolume ?? 80);
    base.state.workMusicIsMuted = !!parts.workmusic.workMusicIsMuted;
    base.state.workMusicTabList = parts.workmusic.workMusicTabList || base.state.workMusicTabList;
    base.state.workMusicActiveTabId = parts.workmusic.workMusicActiveTabId || 'default';
  }
  if (parts.clipviewer) {
    base.state.clipPages = parts.clipviewer.clipPages || [];
  }
  base.updatedAt = new Date().toISOString();
  return base;
}
