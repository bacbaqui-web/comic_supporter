export function escapeHtml(str) {
  return String(str ?? '').replace(
    /[&<>"']/g,
    (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
  );
}

export function downloadTextFile(fileName, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob(['\ufeff' + String(text ?? '')], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function tabSettingsButtonSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
}

export function renderManagedTab({
  className,
  id,
  label,
  active = false,
  prefix = '',
  newTab = false
}) {
  if (newTab) {
    return `<button class="${className} new-inner-tab" data-action="new-tab" type="button"><span class="tab-label">새탭</span></button>`;
  }
  return `
    <button class="${className}${active ? ' active' : ''}" data-tab-id="${escapeHtml(id)}" type="button">
      ${prefix || ''}
      <span class="tab-label">${escapeHtml(label || '탭')}</span>
      ${active ? `<span class="tab-settings-trigger" data-action="tab-settings" role="button" tabindex="0" title="탭 설정" aria-label="탭 설정">${tabSettingsButtonSvg()}</span>` : ''}
    </button>`;
}

export function openTabSettings({
  title = '탭 설정',
  create = false,
  defaultName = '새 탭',
  tab = null,
  getTabs = () => [],
  onCreate,
  onSave,
  onDelete,
  onBackup,
  onRefresh,
  onReorder
} = {}) {
  const modal = document.getElementById('tabSettingsModal');
  const titleEl = document.getElementById('tabSettingsTitle');
  const input = document.getElementById('tabSettingsNameInput');
  const saveBtn = document.getElementById('tabSettingsSaveBtn');
  const deleteBtn = document.getElementById('tabSettingsDeleteBtn');
  const backupBtn = document.getElementById('tabSettingsBackupBtn');
  const refreshBtn = document.getElementById('tabSettingsRefreshBtn');
  const leftBtn = document.getElementById('tabSettingsMoveLeftBtn');
  const rightBtn = document.getElementById('tabSettingsMoveRightBtn');
  if (!modal || !input) return;

  const close = () => {
    modal.style.display = 'none';
  };
  const getIndex = () => {
    const tabs = getTabs();
    return { tabs, index: tabs.findIndex((t) => t.id === tab?.id) };
  };
  const updateMoveState = () => {
    const { tabs, index } = getIndex();
    const disabled = create || index < 0;
    if (leftBtn) leftBtn.disabled = disabled || index <= 0;
    if (rightBtn) rightBtn.disabled = disabled || index >= tabs.length - 1;
  };
  const setActionVisibility = () => {
    [deleteBtn, backupBtn, leftBtn, rightBtn].forEach((btn) => {
      if (btn) btn.style.display = create ? 'none' : 'inline-flex';
    });
    if (refreshBtn) refreshBtn.style.display = !create && onRefresh ? 'inline-flex' : 'none';
  };

  if (titleEl) titleEl.textContent = create ? title.replace('설정', '새 탭') : title;
  input.value = create ? defaultName : tab?.name || '';
  setActionVisibility();
  updateMoveState();

  saveBtn.onclick = async () => {
    const name = input.value.trim().slice(0, 20);
    if (!name) return;
    if (create) await onCreate?.(name);
    else if (tab?.id) await onSave?.(tab.id, name);
    close();
  };
  deleteBtn.onclick = async () => {
    if (!tab?.id) return;
    if (!confirm('이 탭과 탭 안의 내용을 삭제할까요?')) return;
    await onDelete?.(tab.id);
    close();
  };
  backupBtn.onclick = async () => {
    if (!tab?.id) return;
    await onBackup?.(tab.id);
  };
  if (refreshBtn) {
    refreshBtn.onclick = async () => {
      if (!tab?.id) return;
      await onRefresh?.(tab.id);
      updateMoveState();
    };
  }
  const move = async (delta) => {
    const { tabs, index } = getIndex();
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= tabs.length) return;
    const next = [...tabs];
    const [picked] = next.splice(index, 1);
    next.splice(nextIndex, 0, picked);
    const reordered = next.map((item, i) => ({ ...item, order: i * 10 }));
    await onReorder?.(reordered);
    updateMoveState();
  };
  leftBtn.onclick = () => move(-1);
  rightBtn.onclick = () => move(1);
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveBtn.click();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  modal.onclick = (e) => {
    if (e.target === modal) close();
  };
  modal.style.display = 'flex';
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}
