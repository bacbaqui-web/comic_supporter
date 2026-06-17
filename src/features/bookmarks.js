export function initBookmarks(){
  const imageGrid=document.getElementById('image-grid');
  const dragArea=document.getElementById('drag-area');
  const tabsContainer=document.getElementById('bookmarkTabsContainer');
  const addTabBtn=document.getElementById('addBookmarkTabBtn');
  const toggleEditBtn=document.getElementById('toggleBookmarkEditBtn');
  const imageModal = document.getElementById('imageModal');
  const modalImage = document.getElementById('modalImage');
  const closeImageModalBtn = document.getElementById('closeImageModalBtn');
  const goToPageBtn = document.getElementById('goToPageBtn');
  const openImageNewTabBtn = document.getElementById('openImageNewTabBtn');
  const moveBookmarkTabSelect = document.getElementById('moveBookmarkTabSelect');
  const moveBookmarkTabBtn = document.getElementById('moveBookmarkTabBtn');
  const editTitleModal = document.getElementById('editTitleModal');
  const editTitleInput = document.getElementById('editTitleInput');
  const saveTitleBtn = document.getElementById('saveTitleBtn');
  const cancelTitleBtn = document.getElementById('cancelTitleBtn');
  const currentUrlDisplay = document.getElementById('currentUrlDisplay');
  let editMode=false;
  let currentModalBookmark=null;
  let tabClickTimer=null;
  const TAB_CLICK_DELAY_MS=220;
  const genId=()=> 'btab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
  const escapeHtml=(str)=>String(str??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
  const promptTabName=(title,current='')=>{
    const name=prompt(title,current);
    if(name===null) return null;
    const trimmed=name.trim().slice(0,20);
    return trimmed || null;
  };
  const getTabs=()=>{
    const tabs=Array.isArray(window.__bookmarkTabList)&&window.__bookmarkTabList.length ? window.__bookmarkTabList : [{id:'default',name:'기본',order:0}];
    return [...tabs].sort((a,b)=>(a.order??0)-(b.order??0));
  };
  const renderTabs=()=>{
    if(!tabsContainer) return;
    const tabs=getTabs();
    if(!tabs.some(t=>t.id===window.__bookmarkActiveTabId)) window.__bookmarkActiveTabId=tabs[0]?.id||'default';
    tabsContainer.innerHTML='';
    tabs.forEach(t=>{
      const btn=document.createElement('button');
      btn.className='bookmark-tab'+(t.id===window.__bookmarkActiveTabId?' active':'');
      btn.dataset.tabId=t.id;
      btn.draggable=editMode;
      btn.innerHTML=`<span class="tab-label">${escapeHtml(t.name||'탭')}</span>${editMode?`<span class="tab-del" title="삭제">×</span>`:''}`;
      tabsContainer.appendChild(btn);
    });
    if(toggleEditBtn){
      toggleEditBtn.innerHTML= editMode
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
    }
  };
  function getYoutubeThumbnail(url) {
    let videoId = null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = String(url || '').match(regExp);
    if (match && match[2].length === 11) {
      videoId = match[2];
    }
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  }

  function initializeInstagramEmbeds() {
    if (window.instgrm?.Embeds) {
      window.instgrm.Embeds.process();
      return;
    }

    const scriptId = 'instagram-embed-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = '//www.instagram.com/embed.js';
      document.head.appendChild(script);
      script.onload = () => window.instgrm?.Embeds?.process();
    }
  }

  const openImageModal = (imageUrl, pageUrl, bookmark=null) => {
    currentModalBookmark = bookmark;
    if(modalImage) modalImage.src = imageUrl || '';
    if(openImageNewTabBtn){
      openImageNewTabBtn.onclick = () => {
        const url = imageUrl || pageUrl;
        if(url) window.open(url, '_blank');
      };
    }
    if (moveBookmarkTabSelect){
      const tabs = getTabs();
      moveBookmarkTabSelect.innerHTML = tabs.map(t=>`<option value="${t.id}">${escapeHtml(t.name||'탭')}</option>`).join('');
      moveBookmarkTabSelect.value = bookmark?.bookmarkTabId || 'default';
    }
    if (goToPageBtn) goToPageBtn.style.display='none';
    document.getElementById('imageModalControls')?.classList.remove('move-open');
    if(imageModal) imageModal.style.display='flex';
  };

  const closeImageModal = () => {
    if(imageModal) imageModal.style.display = 'none';
    currentModalBookmark = null;
  };

  const openEditModal = (bookmark) => {
    window.currentEditingBookmark = bookmark;
    const currentTitle = bookmark.title || '';
    const displayUrl = String(bookmark.pageUrl || '').length > 50 ? String(bookmark.pageUrl).substring(0, 47) + '...' : String(bookmark.pageUrl || '');
    if(currentUrlDisplay) currentUrlDisplay.textContent = `URL: ${displayUrl}`;
    if(editTitleInput) editTitleInput.value = currentTitle;
    if(editTitleModal) editTitleModal.style.display = 'flex';
  };

  const closeEditModal = () => {
    window.currentEditingBookmark = null;
    if(editTitleModal) editTitleModal.style.display = 'none';
  };

  const saveEditedTitle = async () => {
    if (!window.currentEditingBookmark || !window.ensureLogin?.()) return;

    const newTitle = editTitleInput?.value.trim() || '';
    const bookmark = window.currentEditingBookmark;
    if (bookmark.type === 'link' || bookmark.type === 'video' || bookmark.type === 'instagram') {
      await window.updateBookmarkTitle?.(bookmark.id, newTitle);
    }

    closeEditModal();
    window.showFeedbackMessage?.('제목이 저장되었습니다.');
    renderImageBookmarks();
  };

  const renderImageBookmarks=()=>{
    if(!imageGrid) return;
    imageGrid.innerHTML='';

    const activeBookmarkTabId = window.__bookmarkActiveTabId || 'default';
    const sortedBookmarks = [...(window.imageBookmarks || [])]
      .filter(d => (d.bookmarkTabId || 'default') === activeBookmarkTabId)
      .sort((a, b) => ((b.timestamp?.toMillis?.() || b.timestampMs || 0) - (a.timestamp?.toMillis?.() || a.timestampMs || 0)));

    sortedBookmarks.forEach(d=>{
      const isVideo = d.type === 'video';
      const isLink = d.type === 'link';
      const isInstagram = d.type === 'instagram';
      const isImage = d.type === 'drive_image' || d.type === 'remote' || !!d.driveFileId;
      const isEditable = isVideo || isLink || isInstagram;
      const imageUrl = d.url;
      const pageUrl = d.pageUrl;
      const sourceDomain = d.sourceDomain || 'Unknown Source';

      let thumbnail = isVideo ? getYoutubeThumbnail(pageUrl) : imageUrl;
      let iconHtml = '';
      let urlToOpen = pageUrl;

      if (isLink) {
        const prevImg = d.previewImageUrl || null;
        if (prevImg) {
          iconHtml = `<img src="${prevImg}" alt="링크 미리보기" loading="lazy" decoding="async" class="img-fit-cover" onerror="this.onerror=null;this.src='https://placehold.co/100x120/444/fff?text=미리보기+오류'"/>`;
        } else {
          iconHtml = `<div class="icon-overlay">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:44px;height:44px;opacity:.9">
                                <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4"/>
                                <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 20"/>
                              </svg>
                            </div>`;
        }
      } else if (isInstagram) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(d.embedCode || '', 'text/html');
        const blockquote = doc.querySelector('blockquote.instagram-media');
        urlToOpen = blockquote?.cite || pageUrl;
        const displayTitle = d.title || 'Instagram Post (클릭 시 원본 이동)';
        iconHtml = `
                <div class="w-full h-full relative z-0">
                    ${d.embedCode || ''}
                    <div class="absolute top-0 left-0 right-0 p-2 bg-black bg-opacity-70 text-white text-sm font-bold z-10">${displayTitle}</div>
                </div>
             `;
      } else if (isVideo && !thumbnail) {
        const displayTitle = d.title || '동영상 북마크 (제목 편집 가능)';
        const displayUrl = String(pageUrl || '').replace(/^https?:\/\//, '').substring(0, 30) + '...';
        iconHtml = `<div class="video-title-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-red-400 mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg>
                            <span class="video-title-text">${displayTitle}</span>
                            <span class="video-url-text">${displayUrl}</span>
                        </div>`;
      } else if (isImage) {
        iconHtml = `<img src="${imageUrl || ''}" alt="북마크된 이미지" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://placehold.co/100x120/444/fff?text=이미지+오류'"/>`;
      } else if (isVideo) {
        const displayTitle = d.title || 'YouTube 영상';
        iconHtml = `<img src="${thumbnail}" alt="동영상 썸네일" loading="lazy" decoding="async" class="img-fit-cover" onerror="this.onerror=null;this.src='https://placehold.co/100x120/444/fff?text=동영상+썸네일'"/>
                        <div class="icon-overlay flex-col">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4l12 8-12 8z"/></svg>
                            <span class="text-xs mt-1 font-bold">${displayTitle}</span>
                        </div>`;
      } else {
        iconHtml = `<div class="link-title-overlay">
                            <span class="link-title-text">알 수 없는 북마크</span>
                        </div>`;
      }

      const card=document.createElement('div');
      card.className='bookmark-card relative group cursor-pointer';
      card.innerHTML=`
          <div class="content">
            ${iconHtml}
          </div>
          <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-2 py-1 truncate z-10 opacity-70">
              ${sourceDomain}
          </div>
          <button class="absolute top-2 right-2 bg-[#424242] text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" data-id="${d.id}" data-action="delete">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
          ${isEditable ? `
          <button class="absolute top-2 right-9 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" data-id="${d.id}" data-action="edit">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          ` : ''}
          `;
      imageGrid.appendChild(card);

      card.addEventListener('click',(e)=>{
        if (e.target.closest('button[data-action]')) return;
        if (isVideo || isLink || isInstagram) {
          if(urlToOpen) window.open(urlToOpen, '_blank');
        } else if (isImage) {
          openImageModal(imageUrl, pageUrl, d);
        }
      });
    });

    imageGrid.querySelectorAll('button[data-action]').forEach(btn=>{
      btn.onclick=async(e)=>{
        e.stopPropagation();
        const id=e.currentTarget.dataset.id;
        const action=e.currentTarget.dataset.action;
        const bookmark = (window.imageBookmarks || []).find(d => d.id === id);

        if (action === 'delete') {
          try{
            await window.deleteImage?.(id);
          }catch(err){
            console.error(err);
            window.showAlert?.('북마크 삭제 중 오류가 발생했습니다.');
          }
        } else if (action === 'edit' && bookmark) {
          if (bookmark.type === 'link') {
            window.openPreviewUploadModal?.(bookmark);
          } else {
            openEditModal(bookmark);
          }
        }
      };
    });

    initializeInstagramEmbeds();
  };

  const attachModalListeners=()=>{
    closeImageModalBtn?.addEventListener('click', closeImageModal);
    imageModal?.addEventListener('click',(e)=>{ if(e.target===imageModal) closeImageModal(); });
    document.querySelector('#imageModal .modal-content')?.addEventListener('click', (e) => {
      if (!e.target.closest('#imageModalControls')) closeImageModal();
    });

    moveBookmarkTabBtn?.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(!currentModalBookmark || !moveBookmarkTabSelect) return;
      document.getElementById('imageModalControls')?.classList.toggle('move-open');
    });
    moveBookmarkTabSelect?.addEventListener('click', (e)=>e.stopPropagation());
    moveBookmarkTabSelect?.addEventListener('change', async (e)=>{
      e.stopPropagation();
      if(!currentModalBookmark || !moveBookmarkTabSelect) return;
      const nextTabId = moveBookmarkTabSelect.value || 'default';
      if(window.moveBookmarkToTab){
        await window.moveBookmarkToTab(currentModalBookmark.id, nextTabId);
        currentModalBookmark.bookmarkTabId = nextTabId;
        window.showFeedbackMessage?.('탭을 이동했습니다.');
        closeImageModal();
      }
    });

    cancelTitleBtn?.addEventListener('click', closeEditModal);
    saveTitleBtn?.addEventListener('click', saveEditedTitle);
    editTitleModal?.addEventListener('click', (e) => { if (e.target === editTitleModal) closeEditModal(); });
    editTitleInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEditedTitle();
      }
    });
  };

  const renderAll=()=>{ renderTabs(); renderImageBookmarks(); };
  window.renderImageBookmarks=renderImageBookmarks;
  window.renderBookmarkTabsUI=renderTabs;

  tabsContainer?.addEventListener('click', async (e)=>{
    const tabBtn=e.target.closest('.bookmark-tab');
    if(!tabBtn) return;
    const tabId=tabBtn.dataset.tabId;
    if(editMode && e.target.classList.contains('tab-del')){
      clearTimeout(tabClickTimer);
      if(!confirm('이 탭과 탭 안의 북마크를 삭제할까요?')) return;
      window.cloudDeleteBookmarkTab && await window.cloudDeleteBookmarkTab(tabId);
      return;
    }
    clearTimeout(tabClickTimer);
    tabClickTimer=setTimeout(async()=>{
      window.__bookmarkActiveTabId=tabId;
      window.cloudSetActiveBookmarkTab && await window.cloudSetActiveBookmarkTab(tabId);
      renderAll();
    },TAB_CLICK_DELAY_MS);
  });
  tabsContainer?.addEventListener('dblclick', async (e)=>{
    e.preventDefault();
    e.stopPropagation();
    clearTimeout(tabClickTimer);
    if(e.target.classList.contains('tab-del')) return;
    const tabBtn=e.target.closest('.bookmark-tab'); if(!tabBtn) return;
    if(!window.ensureLogin?.()) return;
    const tabId=tabBtn.dataset.tabId;
    const cur=getTabs().find(t=>t.id===tabId);
    const trimmed=promptTabName('탭 이름 변경', cur?.name||'');
    if(!trimmed || trimmed===(cur?.name||'')) return;
    window.cloudRenameBookmarkTab && await window.cloudRenameBookmarkTab(tabId, trimmed);
    window.showFeedbackMessage?.('북마크 탭 이름이 변경되었습니다.');
  });
  addTabBtn?.addEventListener('click', async ()=>{
    const trimmed=promptTabName('새 북마크 탭 이름','새 탭');
    if(!trimmed) return;
    const id=genId();
    window.cloudAddBookmarkTab && await window.cloudAddBookmarkTab({id,name:trimmed});
  });
  toggleEditBtn?.addEventListener('click',()=>{ editMode=!editMode; renderTabs(); });

  let draggingEl=null, placeholderEl=null;
  function ensurePlaceholder(width){
    if(placeholderEl) return;
    placeholderEl=document.createElement('div');
    placeholderEl.className='bookmark-tab placeholder';
    placeholderEl.style.width=(width||80)+'px';
    placeholderEl.style.height='32px';
    placeholderEl.style.border='1px dashed rgba(255,255,255,.25)';
    placeholderEl.style.background='transparent';
  }
  function getDragAfterElement(container,x){
    const els=[...container.querySelectorAll('.bookmark-tab:not(.dragging):not(.placeholder)')];
    let closest={offset:Number.NEGATIVE_INFINITY,element:null};
    for(const child of els){
      const box=child.getBoundingClientRect();
      const offset=x-(box.left+box.width/2);
      if(offset<0 && offset>closest.offset) closest={offset,element:child};
    }
    return closest.element;
  }
  tabsContainer?.addEventListener('dragstart',(e)=>{
    if(!editMode) return;
    const tabBtn=e.target.closest('.bookmark-tab'); if(!tabBtn) return;
    draggingEl=tabBtn; draggingEl.classList.add('dragging');
    ensurePlaceholder(tabBtn.getBoundingClientRect().width);
    placeholderEl.style.width=tabBtn.getBoundingClientRect().width+'px';
    tabBtn.after(placeholderEl);
    if(e.dataTransfer) e.dataTransfer.effectAllowed='move';
  });
  tabsContainer?.addEventListener('dragover',(e)=>{
    if(!editMode || !draggingEl) return;
    e.preventDefault();
    const afterEl=getDragAfterElement(tabsContainer,e.clientX);
    if(!afterEl) tabsContainer.appendChild(placeholderEl); else tabsContainer.insertBefore(placeholderEl,afterEl);
  });
  async function finalizeReorder(){
    if(!draggingEl || !placeholderEl) return;
    placeholderEl.replaceWith(draggingEl); draggingEl.classList.remove('dragging');
    const ids=[...tabsContainer.querySelectorAll('.bookmark-tab')].filter(el=>!el.classList.contains('placeholder')).map(el=>el.dataset.tabId).filter(Boolean);
    const map=new Map(getTabs().map(t=>[t.id,t]));
    const next=ids.map((id,i)=>({...map.get(id),order:i*10})).filter(Boolean);
    window.cloudReorderBookmarkTabs && await window.cloudReorderBookmarkTabs(next);
    draggingEl=null; placeholderEl=null;
  }
  tabsContainer?.addEventListener('drop',async(e)=>{ if(!editMode) return; e.preventDefault(); await finalizeReorder(); });
  tabsContainer?.addEventListener('dragend',async()=>{ if(editMode && placeholderEl && draggingEl) await finalizeReorder(); });


  const previewUploadModal = document.getElementById('previewUploadModal');
  const closePreviewUploadBtn = document.getElementById('closePreviewUploadBtn');
  const previewPasteArea = document.getElementById('previewPasteArea');
  let currentPreviewEditingBookmark = null;

// 링크 미리보기 모달
    const openPreviewUploadModal = (bookmark) => {
        currentPreviewEditingBookmark = bookmark;
        if (previewUploadModal) previewUploadModal.style.display = 'flex';
    };
    window.openPreviewUploadModal = openPreviewUploadModal;
    const closePreviewUploadModal = () => {
        currentPreviewEditingBookmark = null;
        if (previewUploadModal) previewUploadModal.style.display = 'none';
};
    closePreviewUploadBtn?.addEventListener('click', closePreviewUploadModal);
    previewUploadModal?.addEventListener('click', (e)=>{ if(e.target===previewUploadModal) closePreviewUploadModal(); });

    const uploadPreviewFile = async (file) => {
        if (!currentPreviewEditingBookmark) return;
        if (!file) return;
        // 이미지 파일만 허용
        if (!file.type || !file.type.startsWith('image/')) {
            window.showAlert?.('이미지 파일만 업로드할 수 있습니다.');
            return;
        }
        try {
            window.showFeedbackMessage?.('미리보기 이미지 업로드 중...');
            await window.uploadBookmarkPreviewImage(currentPreviewEditingBookmark.id, file);
            window.showFeedbackMessage?.('미리보기 이미지가 저장되었습니다.');
            closePreviewUploadModal();
        } catch (err) {
            console.error(err);
            window.showAlert?.('미리보기 이미지 업로드 중 오류가 발생했습니다.');
        }
    };


    // 붙여넣기 처리(모달이 열려 있을 때만)
    document.addEventListener('paste', async (e)=>{
        if(!previewUploadModal || previewUploadModal.style.display !== 'flex') return;
        if(!currentPreviewEditingBookmark) return;
        const items = e.clipboardData?.items;
        if(!items) return;
        const imgItem = [...items].find(it=>it.type && it.type.startsWith('image/'));
        if(!imgItem) return;
        e.preventDefault();
        const blob = imgItem.getAsFile();
        if(!blob) return;
        const fileName = `preview_${currentPreviewEditingBookmark.id}.png`;
        const file = new File([blob], fileName, { type: blob.type || 'image/png' });
        try{
            window.showFeedbackMessage?.('미리보기 이미지 업로드 중...');
            await window.uploadBookmarkPreviewImage(currentPreviewEditingBookmark.id, file);
            window.showFeedbackMessage?.('미리보기 이미지가 저장되었습니다.');
            closePreviewUploadModal();
        }catch(err){
            console.error(err);
            window.showAlert?.('미리보기 이미지 업로드 중 오류가 발생했습니다.');
        }
    });



    // ===== D&D/붙여넣기/클릭-자동붙여넣기 =====
    function isImageUrl(u){
      try{ new URL(u); }catch{ return false; }
      return /\.(jpe?g|png|gif|webp|svg|avif)(\?|$)/i.test(u);
    }

    function isVideoUrl(u){
        if (!u) return false;
        try { new URL(u); } catch { return false; }
        // YouTube, Vimeo, 또는 일반적인 동영상 확장자 검사
        return /youtu\.be|youtube\.com|vimeo\.com|\.(mp4|webm|ogg|mov)(\?|$)|missav\.com/i.test(u);
    }

    // 인스타그램 퍼가기 코드 확인 (blockquote 태그를 포함하는지 확인)
    function isInstagramEmbed(text) {
        return /<blockquote class="instagram-media".*<\/blockquote>/.test(text);
    }

    // **신규: 도메인 추출 유틸리티**
    function extractDomain(url) {
        if (!url) return 'Unknown';
        try {
            const urlObj = new URL(url.includes('://') ? url : 'https://' + url);
            let domain = urlObj.hostname;
            if (domain.startsWith('www.')) domain = domain.substring(4);
            return domain;
        } catch {
            return 'Unknown';
        }
    }
    window.extractDomain = extractDomain;


    // 새로운 유틸리티: 이미지/동영상/인스타그램 URL이 아닌 일반 URL인지 확인
    function isGenericUrl(u) {
        if (!u) return false;
        try {
            const urlObj = new URL(u);
            // http 또는 https 프로토콜을 사용하며, 이미지/비디오/인스타그램 URL이 아닌 경우
            // **수정된 부분: URL에 . (점)이 포함되어야 유효한 도메인으로 간주합니다.**
            return (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') && urlObj.hostname.includes('.') && !isImageUrl(u) && !isVideoUrl(u) && !/instagram\.com/.test(u);
        } catch {
            return false;
        }
    }

    // 클릭: 클립보드 접근 및 자동 붙여넣기 시도
    dragArea?.addEventListener('click', async ()=>{
      try{
        let processed = false;

        // 1. 클립보드 이미지 처리
        if(navigator.clipboard?.read){
          const items=await navigator.clipboard.read();
          for(const it of items){
            for(const type of it.types){
              if(type.startsWith('image/')){
                const blob=await it.getType(type);
                if(window.addImage){ await window.addImage(new File([blob],'clipboard-image',{type:blob.type}), null); window.showFeedbackMessage?.('클립보드 이미지 업로드됨'); processed=true; return; }
              }
            }
          }
        }

        // 2. 클립보드 텍스트 (URL/퍼가기 코드) 처리
        const t = await navigator.clipboard.readText();
        if(t){
            if (isInstagramEmbed(t)) {
                if(window.addInstagramBookmark) { await window.addInstagramBookmark(t); window.showFeedbackMessage?.('클립보드 인스타그램 게시물 북마크됨'); processed=true; return; }
            } else if(isImageUrl(t)){
                if(window.addRemoteImage){ await window.addRemoteImage(t,t); window.showFeedbackMessage?.('클립보드 이미지 URL 북마크됨'); processed=true; return; }
            } else if(isVideoUrl(t)){
                if(window.addVideoBookmark) { await window.addVideoBookmark(t); window.showFeedbackMessage?.('클립보드 동영상 URL 북마크됨'); processed=true; return; }
            } else if(isGenericUrl(t)) {
                if(window.addGenericBookmark) { await window.addGenericBookmark(t); window.showFeedbackMessage?.('클립보드 페이지 URL 북마크됨'); processed=true; return; }
            }
        }

        if(!processed) window.showAlert?.('클립보드에서 유효한 콘텐츠를 읽지 못했습니다.');
      }catch(e){ console.error(e); window.showAlert?.('클립보드 권한을 허용하세요.'); }
    });

    // 붙여넣기 핸들러
    dragArea?.addEventListener('paste', async (e)=>{
      e.preventDefault();
      const items=[...(e.clipboardData||e.originalEvent?.clipboardData)?.items||[]];
      let foundText = null;

      for(const item of items){
        // 1. 이미지 파일 처리
        if(item.kind==='file' && item.type.startsWith('image/')){
          const file=item.getAsFile();
          if(file && window.addImage){ await window.addImage(file,null); window.showFeedbackMessage?.('이미지 업로드됨'); return; }
        }
        // 2. 텍스트 처리
        if(item.kind==='string'){
          const txt=await new Promise(r=>item.getAsString(r));
          if(txt){
             if (isInstagramEmbed(txt)) {
                 if(window.addInstagramBookmark) { await window.addInstagramBookmark(txt); window.showFeedbackMessage?.('인스타그램 게시물 북마크됨'); return; }
             } else if(isImageUrl(txt)){
                if(window.addRemoteImage){ await window.addRemoteImage(txt,txt); window.showFeedbackMessage?.('URL 북마크됨'); return; }
             } else if(isVideoUrl(txt)){
                 if(window.addVideoBookmark) { await window.addVideoBookmark(txt); window.showFeedbackMessage?.('동영상 URL 북마크됨'); return; }
             } else if(isGenericUrl(txt)){
                 if(window.addGenericBookmark) { await window.addGenericBookmark(txt); window.showFeedbackMessage?.('페이지 URL 북마크됨'); return; }
             }
             foundText = txt;
          }
        }
      }

      // Fallback: plain text
      if (!foundText) {
          const plain=e.clipboardData?.getData('text/plain');
          if(plain){
             if (isInstagramEmbed(plain)) {
                 if(window.addInstagramBookmark) { await window.addInstagramBookmark(plain); window.showFeedbackMessage?.('인스타그램 게시물 북마크됨'); return; }
             } else if(isImageUrl(plain)){
                if(window.addRemoteImage){ await window.addRemoteImage(plain,plain); window.showFeedbackMessage?.('URL 북마크됨'); return; }
             } else if(isVideoUrl(plain)){
                if(window.addVideoBookmark) { await window.addVideoBookmark(plain); window.showFeedbackMessage?.('동영상 URL 북마크됨'); return; }
             } else if(isGenericUrl(plain)){
                if(window.addGenericBookmark) { await window.addGenericBookmark(plain); window.showFeedbackMessage?.('페이지 URL 북마크됨'); return; }
             }
          }
      }

      window.showAlert?.('붙여넣기한 항목에 유효한 이미지, 동영상 URL, 일반 페이지 URL 또는 인스타그램 퍼가기 코드가 없습니다.');
    });

  attachModalListeners();
  renderAll();
}
