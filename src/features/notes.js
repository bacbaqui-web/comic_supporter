import { downloadTextFile, openTabSettings, renderManagedTab } from './tabSettings.js';

export function initNotes() {
  const notesArea = document.getElementById('notesArea');
  const tabsContainer = document.getElementById('notesTabsContainer');
  if (!tabsContainer || !notesArea) return;

  const genId = () =>
    'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  const getTabs = () => {
    const tabs =
      Array.isArray(window.__notesTabList) && window.__notesTabList.length
        ? window.__notesTabList
        : [{ id: 'memo', name: '메모', order: 0 }];
    return [...tabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };
  const getState = () => ({
    tabs: getTabs(),
    notes: window.__notesTabs || {},
    activeId: window.__notesActiveTabId || 'memo'
  });

  const syncActiveNote = () => {
    const tabId = window.__notesActiveTabId || 'memo';
    window.__notesTabs = window.__notesTabs || {};
    window.__notesTabs[tabId] = notesArea.value ?? '';
    return { tabId, value: window.__notesTabs[tabId] };
  };

  const setActive = async (tabId) => {
    const prev = syncActiveNote();
    if (window.cloudSaveNotesNow)
      window.cloudSaveNotesNow(prev.tabId, prev.value).catch((e) => console.error(e));
    else if (window.cloudSaveNotesFor)
      Promise.resolve(window.cloudSaveNotesFor(prev.tabId, prev.value)).catch((e) =>
        console.error(e)
      );

    window.__notesActiveTabId = tabId;
    if (window.cloudSetActiveNotesTab)
      Promise.resolve(window.cloudSetActiveNotesTab(tabId)).catch((e) => console.error(e));
    render();
    notesArea.value = (window.__notesTabs || {})[tabId] || '';
  };

  const render = () => {
    const { tabs, activeId, notes } = getState();
    const useId = tabs.some((t) => t.id === activeId) ? activeId : tabs[0]?.id || 'memo';
    if (useId !== activeId) window.__notesActiveTabId = useId;
    tabsContainer.innerHTML =
      tabs
        .map((t) =>
          renderManagedTab({
            className: 'notes-tab',
            id: t.id,
            label: t.name || '메모',
            active: t.id === useId
          })
        )
        .join('') + renderManagedTab({ className: 'notes-tab', newTab: true });
    notesArea.value = notes[useId] || '';
  };

  const backupTab = (tabId) => {
    syncActiveNote();
    const tab = getTabs().find((t) => t.id === tabId);
    const text = (window.__notesTabs || {})[tabId] || '';
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const safeName =
      String(tab?.name || 'memo')
        .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
        .trim() || 'memo';
    const lines = [
      `메모 탭 백업`,
      `탭: ${tab?.name || '메모'}`,
      `다운로드 시각: ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
      '',
      text || '(내용 없음)'
    ];
    downloadTextFile(
      `${safeName}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`,
      lines.join('\n')
    );
    window.showFeedbackMessage?.('메모 탭을 다운로드했습니다.');
  };

  const downloadAllNotes = () => {
    syncActiveNote();
    const tabs = getTabs();
    const notes = window.__notesTabs || {};
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const lines = [
      '메모 전체 백업',
      `다운로드 시각: ${dateText}`,
      '',
      '========================================',
      ''
    ];
    tabs.forEach((tab, idx) => {
      lines.push(`[${idx + 1}] ${tab?.name || `탭 ${idx + 1}`}`);
      lines.push('----------------------------------------');
      lines.push(notes[tab.id] || '(내용 없음)');
      lines.push('', '========================================', '');
    });
    downloadTextFile(
      `memo_backup_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`,
      lines.join('\n')
    );
    window.showFeedbackMessage?.('메모를 txt로 다운로드했습니다.');
  };
  window.downloadAllNotesBackup = downloadAllNotes;

  function openSettings(tabId) {
    const tab = getTabs().find((t) => t.id === tabId);
    if (!tab) return;
    openTabSettings({
      title: '메모 탭 설정',
      tab,
      getTabs,
      onSave: async (id, name) => {
        await window.cloudRenameNotesTab?.(id, name);
      },
      onDelete: async (id) => {
        await window.cloudDeleteNotesTab?.(id);
      },
      onBackup: async (id) => backupTab(id),
      onReorder: async (next) => {
        await window.cloudReorderNotesTabs?.(next);
      },
      onCreate: null
    });
  }

  function openCreate() {
    openTabSettings({
      title: '메모 새 탭',
      create: true,
      defaultName: '새 탭',
      getTabs,
      onCreate: async (name) => {
        const prev = syncActiveNote();
        if (window.cloudSaveNotesNow)
          window.cloudSaveNotesNow(prev.tabId, prev.value).catch((e) => console.error(e));
        const id = genId();
        await window.cloudAddNotesTab?.({ id, name });
        await setActive(id);
      }
    });
  }

  tabsContainer.addEventListener('click', async (e) => {
    const settingsBtn = e.target.closest('[data-action="tab-settings"]');
    if (settingsBtn) {
      e.preventDefault();
      e.stopPropagation();
      const tabBtn = settingsBtn.closest('.notes-tab');
      if (tabBtn?.dataset.tabId) openSettings(tabBtn.dataset.tabId);
      return;
    }
    if (e.target.closest('[data-action="new-tab"]')) {
      openCreate();
      return;
    }
    const tabBtn = e.target.closest('.notes-tab');
    if (!tabBtn?.dataset.tabId) return;
    await setActive(tabBtn.dataset.tabId);
  });

  notesArea.addEventListener('input', () => {
    const { tabId, value } = syncActiveNote();
    window.cloudSaveNotesDebounced?.(tabId, value);
  });
  notesArea.addEventListener('blur', () => {
    const { tabId, value } = syncActiveNote();
    if (window.cloudSaveNotesNow)
      window.cloudSaveNotesNow(tabId, value).catch((e) => console.error(e));
    else window.cloudSaveNotesFor?.(tabId, value);
  });

  window.renderNotesUI = render;
  render();
}
