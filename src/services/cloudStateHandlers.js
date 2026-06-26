export function installCloudStateHandlers({
  clearScheduledNotesSave,
  ensureLogin,
  notesInputDelayMs,
  normalizeTabList,
  queueNotesSave,
  renameBookmarkTabDriveFolder,
  renderEverything,
  saveNonNotesDataNow,
  scheduleSaveNonNotesData,
  scheduleSaveNotesData,
  setDriveStatus
}) {
  let notesTimer = null;
  let notesPending = null;

  function writeNoteToState(tabIdArg, valueArg) {
    const hasExplicitTabId = tabIdArg !== undefined && tabIdArg !== null;
    const id = hasExplicitTabId ? tabIdArg : window.__notesActiveTabId || 'memo';
    let val = valueArg;
    if (val === undefined) {
      const el = document.getElementById('notesArea');
      val = el ? el.value : '';
    }
    window.__notesTabs = window.__notesTabs || {};
    window.__notesTabs[id] = val;
    return id;
  }

  window.cloudSaveNotesDebounced = function (tabId, value) {
    clearTimeout(notesTimer);
    if (tabId) notesPending = { tabId, value: value ?? '' };
    notesTimer = setTimeout(() => {
      if (notesPending) {
        window.cloudSaveNotesFor(notesPending.tabId, notesPending.value);
        notesPending = null;
      } else window.cloudSaveNotes();
    }, notesInputDelayMs);
  };

  window.cloudSaveAll = async () => {
    if (!ensureLogin()) return;
    await saveNonNotesDataNow();
  };

  window.cloudSaveStateOnly = async () => {
    if (!ensureLogin()) return;
    await saveNonNotesDataNow();
  };

  window.cloudSaveNotes = async (tabIdArg, valueArg) => {
    if (!ensureLogin()) return;
    writeNoteToState(tabIdArg, valueArg);
    scheduleSaveNotesData();
  };

  window.cloudSaveNotesFor = (tabId, value) => window.cloudSaveNotes(tabId, value);

  window.cloudSaveNotesNow = async (tabId, value) => {
    if (!ensureLogin()) return;
    const savedTabId = writeNoteToState(tabId, value);
    if (notesPending?.tabId === savedTabId) {
      notesPending = null;
      clearTimeout(notesTimer);
    }
    clearScheduledNotesSave();
    await queueNotesSave();
  };

  window.cloudSetActiveNotesTab = async (tabId) => {
    window.__notesActiveTabId = tabId;
    scheduleSaveNotesData();
  };

  window.cloudAddNotesTab = async ({ id, name }) => {
    const list = normalizeTabList(window.__notesTabList, { id: 'memo', name: '메모', order: 0 });
    if (list.some((tab) => tab.id === id)) return;
    const max = list.reduce((m, t) => Math.max(m, Number(t.order || 0)), 0);
    window.__notesTabList = [...list, { id, name, order: max + 10 }];
    window.__notesActiveTabId = id;
    window.__notesTabs = window.__notesTabs || {};
    window.__notesTabs[id] = '';
    renderEverything();
    scheduleSaveNotesData();
  };

  window.cloudRenameNotesTab = async (tabId, newName) => {
    window.__notesTabList = (window.__notesTabList || []).map((tab) =>
      tab.id === tabId ? { ...tab, name: newName } : tab
    );
    renderEverything();
    scheduleSaveNotesData();
  };

  window.cloudReorderNotesTabs = async (list) => {
    window.__notesTabList = list;
    renderEverything();
    scheduleSaveNotesData();
  };

  window.cloudDeleteNotesTab = async (tabId) => {
    let list = (window.__notesTabList || []).filter((tab) => tab.id !== tabId);
    window.__notesTabs = window.__notesTabs || {};
    delete window.__notesTabs[tabId];
    if (!list.length) list = [{ id: 'memo', name: '메모', order: 0 }];
    window.__notesTabList = list;
    if (window.__notesActiveTabId === tabId) window.__notesActiveTabId = list[0].id;
    renderEverything();
    scheduleSaveNotesData();
  };

  window.cloudSetActiveBookmarkTab = async (tabId) => {
    window.__bookmarkActiveTabId = tabId || 'default';
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudAddBookmarkTab = async ({ id, name }) => {
    const list = window.__bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }];
    const max = list.reduce((m, tab) => Math.max(m, Number(tab.order || 0)), 0);
    window.__bookmarkTabList = [...list, { id, name, order: max + 10 }];
    window.__bookmarkActiveTabId = id;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudRenameBookmarkTab = async (tabId, name) => {
    const prevList = (window.__bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }]).map(
      (tab) => ({ ...tab })
    );
    const nextList = prevList.map((tab) => (tab.id === tabId ? { ...tab, name } : tab));
    window.__bookmarkTabList = nextList;
    renderEverything();
    try {
      await renameBookmarkTabDriveFolder(tabId, prevList, nextList);
    } catch (e) {
      console.warn('bookmark tab folder rename skipped', e);
      setDriveStatus('폴더 이름 변경 실패 · 탭 이름은 저장 예약됨', true);
    }
    scheduleSaveNonNotesData();
  };

  window.cloudReorderBookmarkTabs = async (list) => {
    const prevList = (window.__bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }]).map(
      (tab) => ({ ...tab })
    );
    window.__bookmarkTabList = list;
    renderEverything();
    for (const tab of list) {
      try {
        await renameBookmarkTabDriveFolder(tab.id, prevList, list);
      } catch (e) {
        console.warn('bookmark tab folder reorder rename skipped', tab?.name, e);
      }
    }
    scheduleSaveNonNotesData();
  };

  window.cloudDeleteBookmarkTab = async (tabId) => {
    window.imageBookmarks = (window.imageBookmarks || []).filter(
      (bookmark) => (bookmark.bookmarkTabId || 'default') !== tabId
    );
    let list = (window.__bookmarkTabList || []).filter((tab) => tab.id !== tabId);
    if (!list.length) list = [{ id: 'default', name: '기본', order: 0 }];
    window.__bookmarkTabList = list;
    if (window.__bookmarkActiveTabId === tabId) window.__bookmarkActiveTabId = list[0].id;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.moveBookmarkToTab = async (id, tabId) => {
    const bookmark = (window.imageBookmarks || []).find((item) => item.id === id);
    if (bookmark) {
      bookmark.bookmarkTabId = tabId || 'default';
      renderEverything();
      scheduleSaveNonNotesData();
    }
  };

  window.cloudEnsureWorkMusicDefaultTab = async () => {
    if (!window.__workMusicTabList?.length)
      window.__workMusicTabList = [{ id: 'default', name: '기본', order: 0 }];
    scheduleSaveNonNotesData();
  };

  window.cloudSetActiveWorkMusicTab = async (tabId) => {
    window.__workMusicActiveTabId = tabId || 'default';
    window.workMusicCurrentIndex = 0;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudAddWorkMusicTab = async (tab) => {
    const list = window.__workMusicTabList || [{ id: 'default', name: '기본', order: 0 }];
    const max = list.reduce((m, item) => Math.max(m, Number(item.order || 0)), 0);
    window.__workMusicTabList = [...list, { ...tab, order: tab.order ?? max + 10 }];
    window.__workMusicActiveTabId = tab.id;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudRenameWorkMusicTab = async (tabId, name) => {
    window.__workMusicTabList = (window.__workMusicTabList || []).map((tab) =>
      tab.id === tabId ? { ...tab, name } : tab
    );
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudReorderWorkMusicTabs = async (list) => {
    window.__workMusicTabList = list;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudDeleteWorkMusicTab = async (tabId) => {
    let list = (window.__workMusicTabList || []).filter((tab) => tab.id !== tabId);
    if (!list.length) list = [{ id: 'default', name: '기본', order: 0 }];
    window.__workMusicTabList = list;
    window.workMusicSongs = (window.workMusicSongs || []).filter(
      (song) => (song.workMusicTabId || 'default') !== tabId
    );
    if (window.__workMusicActiveTabId === tabId) window.__workMusicActiveTabId = list[0].id;
    renderEverything();
    scheduleSaveNonNotesData();
  };

  window.cloudSaveWorkMusic = async () => {
    if (!ensureLogin()) return;
    scheduleSaveNonNotesData();
  };

  window.deleteTask = async () => {
    if (!ensureLogin() || !window.currentTask?.id) {
      window.closeTaskModal?.();
      return;
    }
    window.customTasks = (window.customTasks || []).filter(
      (task) => task.id !== window.currentTask.id
    );
    renderEverything();
    await saveNonNotesDataNow();
  };
}
