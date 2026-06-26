function qEscape(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function makeSafeDriveName(name, fallback = 'untitled') {
  const cleaned = String(name || fallback)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
  return cleaned || fallback;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function getNoteTxtFileName(tab, idx = 0) {
  return `${pad3(idx + 1)}_${makeSafeDriveName(tab?.name || tab?.id || '메모')}.txt`;
}

function getBookmarkTabFolderName(tab, idx = 0) {
  return `${pad3(idx + 1)}_${makeSafeDriveName(tab?.name || tab?.id || '북마크')}`;
}

function getSortedBookmarkTabs(list) {
  const tabs =
    Array.isArray(list) && list.length ? list : [{ id: 'default', name: '기본', order: 0 }];
  return [...tabs].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
}

function getBookmarkTabFolderInfo(tabId, list) {
  const tabs = getSortedBookmarkTabs(list);
  let idx = tabs.findIndex((t) => (t.id || 'default') === (tabId || 'default'));
  if (idx < 0) idx = 0;
  const tab = tabs[idx] || { id: 'default', name: '기본', order: 0 };
  return { tab, idx, folderName: getBookmarkTabFolderName(tab, idx) };
}

export function formatDriveFileTime(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function fileExtFromBlob(file) {
  const name = file && file.name ? String(file.name) : '';
  const found = name.match(/\.([a-zA-Z0-9]{1,8})$/);
  if (found) return '.' + found[1].toLowerCase();
  const type = file && file.type ? String(file.type) : '';
  if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  return '.png';
}

export function createDriveFilesStore({
  driveFetch,
  firebaseEnabled,
  folders: folderConfig = {},
  files: fileConfig = {},
  getBookmarkTabList = () => [],
  canUseDrive = () => true
}) {
  const DRIVE_APP_FOLDER = folderConfig.app || 'magamiscoming';
  const DRIVE_SYSTEM_FOLDER = folderConfig.system || 'system';
  const DRIVE_CALENDAR_FOLDER = folderConfig.calendar || '달력';
  const DRIVE_NOTES_FOLDER = folderConfig.notes || '메모';
  const DRIVE_BOOKMARKS_FOLDER = folderConfig.bookmarks || '북마크';
  const DRIVE_WORKMUSIC_FOLDER = folderConfig.workmusic || '노동요';
  const DRIVE_CLIP_FOLDER = folderConfig.clipviewer || '클립뷰어';
  const DRIVE_CLIP_CURRENT_FOLDER = folderConfig.clipCurrent || 'current';
  const DRIVE_NOTES_FILE = fileConfig.notes || 'notes-index.json';
  const DRIVE_OLD_NOTES_FILE = fileConfig.oldNotes || 'notes.json';
  const DRIVE_CALENDAR_FILE = fileConfig.calendar || 'calendar.json';
  const DRIVE_BOOKMARKS_FILE = fileConfig.bookmarks || 'bookmarks.json';
  const DRIVE_WORKMUSIC_FILE = fileConfig.workmusic || 'workmusic.json';
  const DRIVE_CLIP_FILE = fileConfig.clipviewer || 'clipviewer.json';

  let driveFolders = null;

  async function findFile(name, parentId = null, mimeType = null) {
    const q = [`name='${qEscape(name)}'`, 'trashed=false'];
    if (parentId) q.push(`'${parentId}' in parents`);
    if (mimeType) q.push(`mimeType='${mimeType}'`);
    const url =
      'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent(q.join(' and ')) +
      '&fields=files(id,name,mimeType,modifiedTime)&spaces=drive';
    const data = await driveFetch(url).then((r) => r.json());
    return data.files?.[0] || null;
  }

  async function listFilesInFolder(parentId) {
    if (!parentId) return [];
    const q = [`'${parentId}' in parents`, 'trashed=false'];
    const url =
      'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent(q.join(' and ')) +
      '&fields=files(id,name,mimeType,modifiedTime)&spaces=drive&pageSize=1000';
    const data = await driveFetch(url).then((r) => r.json());
    return data.files || [];
  }

  async function createFolder(name, parentId = null) {
    const meta = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) meta.parents = [parentId];
    return await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meta)
    }).then((r) => r.json());
  }

  async function getOrCreateFolder(name, parentId = null) {
    return (
      (await findFile(name, parentId, 'application/vnd.google-apps.folder')) ||
      (await createFolder(name, parentId))
    );
  }

  async function findFolder(name, parentId = null) {
    return await findFile(name, parentId, 'application/vnd.google-apps.folder');
  }

  async function ensureFolders() {
    if (driveFolders) return driveFolders;
    const app = await getOrCreateFolder(DRIVE_APP_FOLDER);
    const bookmarks = await getOrCreateFolder(DRIVE_BOOKMARKS_FOLDER, app.id);
    const clip = await getOrCreateFolder(DRIVE_CLIP_FOLDER, app.id);
    const system = firebaseEnabled ? null : await getOrCreateFolder(DRIVE_SYSTEM_FOLDER, app.id);
    const notes = firebaseEnabled ? null : await getOrCreateFolder(DRIVE_NOTES_FOLDER, app.id);
    const bookmarkImages = bookmarks;
    const clipCurrent = await getOrCreateFolder(DRIVE_CLIP_CURRENT_FOLDER, clip.id);
    driveFolders = { app, system, notes, bookmarks, bookmarkImages, clip, clipCurrent };
    return driveFolders;
  }

  function resetFolders() {
    driveFolders = null;
  }

  async function getLegacyFolder(name) {
    const folders = await ensureFolders();
    return await findFolder(name, folders.app.id);
  }

  async function getBookmarkTabFolder(tabId) {
    const folders = await ensureFolders();
    const { folderName } = getBookmarkTabFolderInfo(tabId, getBookmarkTabList());
    return await getOrCreateFolder(folderName, folders.bookmarks.id);
  }

  async function uploadMultipart({
    name,
    blob,
    parentId,
    fileId = null,
    mimeType = 'application/octet-stream'
  }) {
    const meta = { name, mimeType };
    if (parentId && !fileId) meta.parents = [parentId];
    const boundary = 'drive_' + Math.random().toString(36).slice(2);
    const delimiter = '\r\n--' + boundary + '\r\n';
    const close = '\r\n--' + boundary + '--';
    const body = new Blob(
      [
        delimiter,
        'Content-Type: application/json; charset=UTF-8\r\n\r\n',
        JSON.stringify(meta),
        delimiter,
        'Content-Type: ' + mimeType + '\r\n\r\n',
        blob,
        close
      ],
      { type: 'multipart/related; boundary=' + boundary }
    );
    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime';
    return await driveFetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
      body
    }).then((r) => r.json());
  }

  async function updateFileMetadata(fileId, metadata) {
    if (!fileId) return null;
    return await driveFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      }
    ).then((r) => r.json());
  }

  async function renameBookmarkTabFolder(tabId, prevList, nextList) {
    if (!canUseDrive()) return;
    const prev = getBookmarkTabFolderInfo(tabId, prevList);
    const next = getBookmarkTabFolderInfo(tabId, nextList);
    if (prev.folderName === next.folderName) return;
    const folders = await ensureFolders();
    let oldFolder = await findFolder(prev.folderName, folders.bookmarks.id);
    if (!oldFolder) oldFolder = await findFolder(prev.folderName, folders.app.id);
    if (!oldFolder) return;
    await updateFileMetadata(oldFolder.id, { name: next.folderName });
  }

  async function deleteFile(fileId) {
    if (!fileId) return;
    try {
      await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Drive delete skipped', e);
    }
  }

  async function downloadBlob(fileId) {
    return await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`).then(
      (r) => r.blob()
    );
  }

  async function downloadText(fileId) {
    return await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`).then(
      (r) => r.text()
    );
  }

  async function saveJson(folderId, fileName, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const existing = await findFile(fileName, folderId, 'application/json');
    return await uploadMultipart({
      name: fileName,
      blob,
      parentId: folderId,
      fileId: existing?.id || null,
      mimeType: 'application/json'
    });
  }

  async function loadJson(folderId, fileName) {
    const file = await findFile(fileName, folderId, 'application/json');
    if (!file) return null;
    try {
      return JSON.parse(await downloadText(file.id));
    } catch (e) {
      console.warn('JSON load failed', fileName, e);
      return null;
    }
  }

  async function saveNotes(folderId, systemFolderId, notesPart) {
    notesPart = notesPart || {};
    const tabs = [...(notesPart.notesTabList || [{ id: 'memo', name: '메모', order: 0 }])].sort(
      (a, b) => Number(a.order || 0) - Number(b.order || 0)
    );
    const notes = notesPart.notesTabs || {};
    const expectedNames = new Set();
    const indexTabs = await Promise.all(
      tabs.map(async (tab, i) => {
        const fileName = getNoteTxtFileName(tab, i);
        expectedNames.add(fileName);
        const textBlob = new Blob([notes[tab.id] || ''], { type: 'text/plain;charset=utf-8' });
        const existing = await findFile(fileName, folderId, 'text/plain');
        const uploaded = await uploadMultipart({
          name: fileName,
          blob: textBlob,
          parentId: folderId,
          fileId: existing?.id || null,
          mimeType: 'text/plain'
        });
        return { ...tab, noteFileName: fileName, noteFileId: uploaded.id };
      })
    );
    const files = await listFilesInFolder(folderId);
    await Promise.all(
      files.map(async (f) => {
        if (
          String(f.name || '')
            .toLowerCase()
            .endsWith('.txt') &&
          !expectedNames.has(f.name)
        ) {
          await deleteFile(f.id);
        }
      })
    );
    const index = {
      version: 1,
      updatedAt: notesPart.updatedAt || new Date().toISOString(),
      notesActiveTabId: notesPart.notesActiveTabId || tabs[0]?.id || 'memo',
      notesTabList: indexTabs
    };
    await saveJson(systemFolderId, DRIVE_NOTES_FILE, index);
    await Promise.all(
      [DRIVE_NOTES_FILE, DRIVE_OLD_NOTES_FILE].map(async (legacyName) => {
        const legacy = await findFile(legacyName, folderId, 'application/json');
        if (legacy) await deleteFile(legacy.id);
      })
    );
    return index;
  }

  async function loadNotes(folderId, systemFolderId) {
    const index =
      (await loadJson(systemFolderId, DRIVE_NOTES_FILE)) ||
      (await loadJson(folderId, DRIVE_NOTES_FILE));
    if (index && Array.isArray(index.notesTabList)) {
      const notesTabs = {};
      const notesTabList = index.notesTabList.map(
        ({ noteFileName: _noteFileName, noteFileId: _noteFileId, ...tab }) => tab
      );
      for (const tab of index.notesTabList) {
        let loaded = false;
        try {
          let file = null;
          if (tab.noteFileId) file = { id: tab.noteFileId, name: tab.noteFileName };
          if (file) {
            notesTabs[tab.id] = await downloadText(file.id);
            loaded = true;
          }
        } catch (e) {
          console.warn('note txt id load failed', tab.name, e);
        }
        if (!loaded && tab.noteFileName) {
          try {
            const file = await findFile(tab.noteFileName, folderId, 'text/plain');
            if (file) {
              notesTabs[tab.id] = await downloadText(file.id);
              loaded = true;
            }
          } catch (e) {
            console.warn('note txt name load failed', tab.name, e);
          }
        }
        if (!loaded) {
          notesTabs[tab.id] = '';
        }
      }
      return {
        notesTabList: notesTabList.length ? notesTabList : [{ id: 'memo', name: '메모', order: 0 }],
        notesTabs,
        notesActiveTabId: index.notesActiveTabId || notesTabList[0]?.id || 'memo',
        updatedAt: index.updatedAt || new Date().toISOString()
      };
    }

    const old =
      (await loadJson(systemFolderId, DRIVE_OLD_NOTES_FILE)) ||
      (await loadJson(folderId, DRIVE_OLD_NOTES_FILE));
    if (old) return old;

    return null;
  }

  async function deleteJsonIfExists(folderId, fileName) {
    if (!folderId) return;
    const file = await findFile(fileName, folderId, 'application/json');
    if (file) await deleteFile(file.id);
  }

  async function cleanupLegacyJsonFiles() {
    const folders = await ensureFolders();
    const legacyCalendar = await getLegacyFolder(DRIVE_CALENDAR_FOLDER);
    const legacyWorkmusic = await getLegacyFolder(DRIVE_WORKMUSIC_FOLDER);
    const legacyClipviewer = await getLegacyFolder(DRIVE_CLIP_FOLDER);
    await Promise.all([
      deleteJsonIfExists(legacyCalendar?.id, DRIVE_CALENDAR_FILE),
      deleteJsonIfExists(folders.bookmarks.id, DRIVE_BOOKMARKS_FILE),
      deleteJsonIfExists(legacyWorkmusic?.id, DRIVE_WORKMUSIC_FILE),
      deleteJsonIfExists(legacyClipviewer?.id, DRIVE_CLIP_FILE)
    ]);
  }

  return {
    cleanupLegacyJsonFiles,
    deleteFile,
    downloadBlob,
    downloadText,
    ensureFolders,
    fileExtFromBlob,
    findFile,
    formatDriveFileTime,
    getBookmarkTabFolder,
    getLegacyFolder,
    loadJson,
    loadNotes,
    renameBookmarkTabFolder,
    resetFolders,
    saveJson,
    saveNotes,
    uploadMultipart
  };
}
