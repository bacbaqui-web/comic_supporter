export function initNotes(){
  const notesArea = document.getElementById('notesArea');
  const tabsContainer = document.getElementById('notesTabsContainer');
  const addTabBtn = document.getElementById('addNotesTabBtn');
  const downloadNotesBtn = document.getElementById('downloadNotesBtn');
  const toggleEditBtn = document.getElementById('toggleNotesEditBtn');

  if(!tabsContainer || !notesArea) return;

  // Local UI state
  let editMode = false;

  // Helpers
  const genId = ()=> 'tab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);

  const getState = ()=>({
    tabs: window.__notesTabList || [{ id:'memo', name:'메모', order:0 }],
    notes: window.__notesTabs || {},
    activeId: window.__notesActiveTabId || 'memo'
  });

  const setActive = async (tabId)=>{
    // 1) 현재 탭 내용을 먼저 로컬/클라우드에 확정 저장 (탭 전환 중 유실 방지)
    const prevId = window.__notesActiveTabId || 'memo';
    try{
      if(notesArea){
        window.__notesTabs = window.__notesTabs || {};
        window.__notesTabs[prevId] = notesArea.value ?? '';
        // 디바운스가 남아있더라도 이전 탭은 즉시 저장(최소 1회 보장)
        if(window.cloudSaveNotesNow){
          await window.cloudSaveNotesNow(prevId, window.__notesTabs[prevId]);
        }else if(window.cloudSaveNotesFor){
          await window.cloudSaveNotesFor(prevId, window.__notesTabs[prevId]);
        }else if(window.cloudSaveNotes){
          await window.cloudSaveNotes();
        }
      }
    }catch(_){}

    // 2) active tab 변경 + 서버에 activeId 기록
    window.__notesActiveTabId = tabId;
    try{
      window.cloudSetActiveNotesTab && await window.cloudSetActiveNotesTab(tabId);
    }catch(_){}

    // 3) UI 갱신
    render();
    const { notes } = getState();
    notesArea.value = notes[tabId] || '';
  };

  const render = ()=>{
    const { tabs, activeId, notes } = getState();
    // normalize tabs ordering
    const sorted = [...tabs].sort((a,b)=>(a.order??0)-(b.order??0));
    tabsContainer.innerHTML = '';

    sorted.forEach((t)=>{
      const btn = document.createElement('button');
      btn.className = 'notes-tab' + (t.id===activeId ? ' active' : '');
      btn.dataset.tabId = t.id;
      btn.draggable = editMode;
      btn.innerHTML = `
        <span class="tab-label">${escapeHtml(t.name || '')}</span>
        ${editMode ? `<span class="tab-del" title="삭제">×</span>` : ``}
      `;
      tabsContainer.appendChild(btn);
    });

    // Ensure textarea shows active note
    const activeExists = sorted.some(t=>t.id===activeId);
    const useId = activeExists ? activeId : (sorted[0]?.id || 'memo');
    if(useId !== activeId){
      window.__notesActiveTabId = useId;
    }
    notesArea.value = notes[useId] || '';

    // Toggle button icon
    if(toggleEditBtn){
      toggleEditBtn.innerHTML = editMode
        ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
    }
  };

  const escapeHtml = (s)=> String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  const promptName = (title, current='')=>{
    const name = window.prompt(title, current);
    if(name===null) return null;
    const trimmed = name.trim();
    if(!trimmed) return null;
    return trimmed.slice(0, 20);
  };


  const downloadAllNotes = ()=>{
    // 다운로드는 저장값을 건드리지 않고, 현재 화면의 메모만 로컬 캐시에 반영해서 txt로 내보냅니다.
    const activeId = window.__notesActiveTabId || 'memo';
    window.__notesTabs = window.__notesTabs || {};
    if(notesArea){
      window.__notesTabs[activeId] = notesArea.value ?? '';
    }

    const tabs = [...(window.__notesTabList || [{ id:'memo', name:'메모', order:0 }])]
      .sort((a,b)=>(a.order??0)-(b.order??0));
    const notes = window.__notesTabs || {};
    const now = new Date();
    const pad = (n)=>String(n).padStart(2,'0');
    const dateText = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const lines = [];
    lines.push('메모 전체 백업');
    lines.push(`다운로드 시각: ${dateText}`);
    lines.push('');
    lines.push('========================================');
    lines.push('');

    if(!tabs.length){
      lines.push('(메모 탭 없음)');
    }else{
      tabs.forEach((tab, idx)=>{
        const title = tab?.name || `탭 ${idx+1}`;
        const id = tab?.id || '';
        const body = notes[id] ?? '';
        lines.push(`[${idx+1}] ${title}`);
        lines.push('----------------------------------------');
        lines.push(body || '(내용 없음)');
        lines.push('');
        lines.push('========================================');
        lines.push('');
      });
    }

    const blob = new Blob(['\ufeff' + lines.join('\n')], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memo_backup_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    if(window.showFeedbackMessage) window.showFeedbackMessage('메모를 txt로 다운로드했습니다.');
  };

  if(downloadNotesBtn){
    downloadNotesBtn.addEventListener('click', downloadAllNotes);
  }

  // Events: select / rename / delete
  tabsContainer.addEventListener('click', async (e)=>{
    const tabBtn = e.target.closest('.notes-tab');
    if(!tabBtn) return;
    const tabId = tabBtn.dataset.tabId;

    // delete in edit mode
    if(editMode && e.target.classList.contains('tab-del')){
      if(!confirm('이 탭과 탭 안의 메모를 삭제할까요?')) return;
      window.cloudDeleteNotesTab && await window.cloudDeleteNotesTab(tabId);
      return;
    }

    // select
    await setActive(tabId);
  });

  tabsContainer.addEventListener('dblclick', async (e)=>{
    const tabBtn = e.target.closest('.notes-tab');
    if(!tabBtn) return;
    const tabId = tabBtn.dataset.tabId;
    const { tabs } = getState();
    const cur = tabs.find(t=>t.id===tabId);
    const newName = promptName('탭 이름 변경', cur?.name || '');
    if(!newName) return;
    window.cloudRenameNotesTab && await window.cloudRenameNotesTab(tabId, newName);
  });

  // Drag reorder (edit mode only) - live reflow + smooth-ish
  let dragFromId = null;
  let draggingEl = null;
  let placeholderEl = null;

  function ensurePlaceholder(width){
    if(placeholderEl) return;
    placeholderEl = document.createElement('div');
    placeholderEl.className = 'notes-tab placeholder';
    placeholderEl.style.width = (width || 80) + 'px';
    placeholderEl.style.height = '32px';
    placeholderEl.style.borderRadius = '10px 10px 0 0';
    placeholderEl.style.border = '1px dashed rgba(255,255,255,.25)';
    placeholderEl.style.background = 'transparent';
  }

  function getDragAfterElement(container, x){
    const els = [...container.querySelectorAll('.notes-tab:not(.dragging):not(.placeholder)')];
    let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
    for(const child of els){
      const box = child.getBoundingClientRect();
      const offset = x - (box.left + box.width/2);
      if(offset < 0 && offset > closest.offset){
        closest = { offset, element: child };
      }
    }
    return closest.element;
  }

  tabsContainer.addEventListener('dragstart', (e)=>{
    if(!editMode) return;
    const tabBtn = e.target.closest('.notes-tab');
    if(!tabBtn) return;
    dragFromId = tabBtn.dataset.tabId;
    draggingEl = tabBtn;
    draggingEl.classList.add('dragging');

    // placeholder for live layout
    const w = tabBtn.getBoundingClientRect().width;
    ensurePlaceholder(w);
    placeholderEl.style.width = w + 'px';
    tabBtn.after(placeholderEl);

    // Better drag image (avoid huge ghost)
    if(e.dataTransfer){
      e.dataTransfer.effectAllowed = 'move';
      try{
        const img = tabBtn.cloneNode(true);
        img.style.position = 'absolute';
        img.style.top = '-9999px';
        img.style.left = '-9999px';
        img.style.opacity = '0.9';
        document.body.appendChild(img);
        e.dataTransfer.setDragImage(img, 10, 10);
        setTimeout(()=>img.remove(), 0);
      }catch(_){}
    }
  });

  tabsContainer.addEventListener('dragover', (e)=>{
    if(!editMode || !draggingEl) return;
    e.preventDefault();
    const afterEl = getDragAfterElement(tabsContainer, e.clientX);
    if(!afterEl){
      tabsContainer.appendChild(placeholderEl);
    }else{
      tabsContainer.insertBefore(placeholderEl, afterEl);
    }
  });

  async function finalizeReorder(){
    if(!draggingEl || !placeholderEl) return;
    placeholderEl.replaceWith(draggingEl);
    draggingEl.classList.remove('dragging');

    // compute order from DOM
    const ids = [...tabsContainer.querySelectorAll('.notes-tab')].filter(el=>!el.classList.contains('placeholder')).map(el=>el.dataset.tabId).filter(Boolean);
    const { tabs } = getState();
    const map = new Map(tabs.map(t=>[t.id, t]));
    const next = ids.map((id,i)=>({ ...map.get(id), order: i*10 })).filter(Boolean);
    window.cloudReorderNotesTabs && await window.cloudReorderNotesTabs(next);

    dragFromId = null;
    draggingEl = null;
    placeholderEl = null;
  }

  tabsContainer.addEventListener('drop', async (e)=>{
    if(!editMode) return;
    e.preventDefault();
    await finalizeReorder();
  });

  tabsContainer.addEventListener('dragend', async ()=>{
    if(!editMode) return;
    // If dropped outside, still finalize to clean placeholder
    if(placeholderEl && draggingEl){
      await finalizeReorder();
    }
  });

  // Add tab
  if(addTabBtn){
    addTabBtn.addEventListener('click', async ()=>{
      const name = promptName('새 탭 이름', '새 탭');
      if(!name) return;
      const id = genId();
      window.cloudAddNotesTab && await window.cloudAddNotesTab({ id, name });
      await setActive(id);
    });
  }

  // Toggle edit mode
  if(toggleEditBtn){
    toggleEditBtn.addEventListener('click', ()=>{
      editMode = !editMode;
      render();
    });
  }

  // Save note content (tab-safe)
// - 입력 시점의 tabId/value를 캡처하여 저장(탭 전환 중 덮어쓰기/유실 방지)
// - 로컬 캐시(window.__notesTabs)도 즉시 갱신하여 탭 전환 시 내용 유지
if(notesArea){
  const syncLocal = ()=>{
    const tabId = window.__notesActiveTabId || 'memo';
    window.__notesTabs = window.__notesTabs || {};
    window.__notesTabs[tabId] = notesArea.value ?? '';
    return { tabId, value: window.__notesTabs[tabId] };
  };

  notesArea.addEventListener('input', ()=>{
    const { tabId, value } = syncLocal();
    window.cloudSaveNotesDebounced && window.cloudSaveNotesDebounced(tabId, value);
  });

  // 포커스가 빠질 때는 즉시 저장(디바운스 대기 중 유실 방지)
  notesArea.addEventListener('blur', ()=>{
    const { tabId, value } = syncLocal();
    if(window.cloudSaveNotesNow) window.cloudSaveNotesNow(tabId, value).catch(e=>console.error(e));
    else window.cloudSaveNotesFor && window.cloudSaveNotesFor(tabId, value);
  });
}
// Expose renderer for realtime updates
  window.renderNotesUI = render;

  // Initial render
  render();
}
