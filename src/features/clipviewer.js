export function initClipViewer({
  ensureLogin = () => window.ensureLogin?.(),
  isDriveLoggedIn = () => false,
  ensureClipCurrentFolder,
  findDriveFile,
  uploadDriveMultipart,
  downloadDriveBlob,
  getClipPages = () => [],
  saveClipManifest = async () => {},
  beginDriveUploadBatch = () => () => {},
  loadAppDataFromDrive = async () => {},
  renderEverything = () => {}
} = {}) {
  const clipFolderInput = document.getElementById('clipFolderInput');
  const clipRefreshBtn = document.getElementById('clipRefreshBtn');
  const clipClearBtn = document.getElementById('clipClearBtn');
  const clipViewer = document.getElementById('clipViewer');
  const clipMessage = document.getElementById('clipMessage');
  const clipStatus = document.getElementById('clipStatus');
  let clipFiles = [];
  let clipLocalPages = [];
  let clipSQLPromise = null;
  let clipAutoSyncRunning = false;
  const isMobileView = () => window.matchMedia?.('(max-width: 768px)').matches;
  const getEmptyClipMessage = () =>
    isMobileView()
      ? `
      <div class="clip-empty-title">PC에서 올린 CLIP 미리보기를 확인하세요</div>
      <div class="clip-empty-body">PC에서 CLIP 폴더를 열면 미리보기가 Drive에 저장되고, 모바일에서는 로그인만 하면 같은 화면을 볼 수 있습니다.</div>
    `
      : `
      <div class="clip-empty-title">CLIP 폴더를 열어주세요</div>
      <div class="clip-empty-body">원고가 들어있는 폴더를 이곳에 끌어다 놓거나, 위의 폴더 아이콘으로 선택하면 미리보기를 펼쳐볼 수 있습니다.</div>
    `;

  function setClipStatus(t) {
    if (clipStatus) clipStatus.textContent = t;
  }
  function showClipMessage(t) {
    if (clipMessage) {
      clipMessage.style.display = 'flex';
      clipMessage.innerHTML = t;
    }
  }
  function hideClipMessage() {
    if (clipMessage) clipMessage.style.display = 'none';
  }
  function clearClipLocal() {
    for (const p of clipLocalPages) {
      if (p.url) URL.revokeObjectURL(p.url);
    }
    clipLocalPages = [];
    if (clipViewer) clipViewer.innerHTML = '';
  }
  window.clearClipLocal = clearClipLocal;

  async function getClipSQL() {
    if (!clipSQLPromise) {
      clipSQLPromise = initSqlJs({
        locateFile: (file) => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/' + file
      });
    }
    return clipSQLPromise;
  }

  function findAsciiBytes(bytes, text) {
    const p = [...text].map((c) => c.charCodeAt(0));
    outer: for (let i = 0; i <= bytes.length - p.length; i++) {
      for (let j = 0; j < p.length; j++) {
        if (bytes[i + j] !== p[j]) continue outer;
      }
      return i;
    }
    return -1;
  }
  function detectImageTypeBytes(bytes) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
      return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
    return null;
  }
  async function extractClipPreview(file, SQL) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const off = findAsciiBytes(bytes, 'SQLite format 3');
    if (off < 0) return null;
    const db = new SQL.Database(bytes.slice(off));
    let result;
    try {
      result = db.exec(
        'SELECT ImageData FROM CanvasPreview WHERE ImageData IS NOT NULL ORDER BY ImageWidth * ImageHeight DESC LIMIT 1'
      );
    } catch (e) {
      db.close();
      return null;
    }
    if (!result.length || !result[0].values.length) {
      db.close();
      return null;
    }
    const imageData = result[0].values[0][0];
    db.close();
    if (!imageData) return null;
    const imgBytes = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);
    const type = detectImageTypeBytes(imgBytes);
    if (!type) return null;
    return new Blob([imgBytes], { type });
  }

  async function loadClipFiles(files) {
    clearClipLocal();
    showClipMessage('CLIP 파일 불러오는 중...');
    setClipStatus('파일 확인 중...');
    const list = files
      .filter((f) => f.name.toLowerCase().endsWith('.clip'))
      .sort((a, b) =>
        (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      );
    if (!list.length) {
      showClipMessage('.clip 파일을 찾지 못했습니다.');
      setClipStatus('실패: .clip 없음');
      return;
    }
    const SQL = await getClipSQL();
    let ok = 0,
      fail = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setClipStatus(`${i + 1} / ${list.length} 추출 중\n${file.name}`);
      try {
        const blob = await extractClipPreview(file, SQL);
        if (!blob) {
          fail++;
          continue;
        }
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.className = 'clip-page';
        img.alt = file.name;
        img.src = url;
        clipViewer.appendChild(img);
        clipLocalPages.push({
          name: file.name.replace(/\.clip$/i, '.png'),
          blob,
          url,
          type: blob.type
        });
        ok++;
        if (ok === 1) hideClipMessage();
      } catch (e) {
        console.error(e);
        fail++;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    if (ok) {
      hideClipMessage();
      setClipStatus(`완료\n표시: ${ok}개 / 실패: ${fail}개`);
      syncClipPagesToDriveIfReady();
    } else {
      showClipMessage('미리보기 이미지를 찾지 못했습니다.');
      setClipStatus(`실패: ${fail}개`);
    }
  }

  function readDirectoryEntries(reader) {
    return new Promise((resolve, reject) => {
      const entries = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }
          entries.push(...batch);
          readBatch();
        }, reject);
      };
      readBatch();
    });
  }

  async function collectEntryFiles(entry, path = '') {
    if (entry.isFile) {
      return await new Promise((resolve, reject) => {
        entry.file((file) => {
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: path + file.name,
              configurable: true
            });
          } catch (_) {}
          resolve([file]);
        }, reject);
      });
    }
    if (entry.isDirectory) {
      const entries = await readDirectoryEntries(entry.createReader());
      const nested = await Promise.all(
        entries.map((child) => collectEntryFiles(child, path + entry.name + '/'))
      );
      return nested.flat();
    }
    return [];
  }

  async function getDroppedClipFiles(dataTransfer) {
    const items = [...(dataTransfer?.items || [])];
    if (items.length) {
      const entries = items.map((item) => item.webkitGetAsEntry?.()).filter(Boolean);
      if (entries.length) {
        const nested = await Promise.all(entries.map((entry) => collectEntryFiles(entry)));
        return nested.flat();
      }
    }
    return [...(dataTransfer?.files || [])];
  }

  function setClipDropActive(active) {
    clipMessage?.classList.toggle('drag-over', active);
    clipViewer?.classList.toggle('drag-over', active);
  }

  function attachClipDropZone(el) {
    if (!el) return;
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      setClipDropActive(true);
    });
    el.addEventListener('dragleave', (e) => {
      if (el.contains(e.relatedTarget)) return;
      setClipDropActive(false);
    });
    el.addEventListener('drop', async (e) => {
      e.preventDefault();
      setClipDropActive(false);
      try {
        const files = await getDroppedClipFiles(e.dataTransfer);
        const clipList = files.filter((file) => file.name?.toLowerCase().endsWith('.clip'));
        if (!clipList.length) {
          showClipMessage('드롭한 폴더에서 .clip 파일을 찾지 못했습니다.');
          setClipStatus('실패: .clip 없음');
          return;
        }
        clipFiles = clipList;
        if (clipFolderInput) clipFolderInput.value = '';
        await loadClipFiles(clipFiles);
      } catch (err) {
        console.error(err);
        showClipMessage(
          '이 브라우저에서는 폴더 드롭을 읽지 못했습니다. 위의 폴더 아이콘으로 열어주세요.'
        );
        setClipStatus('폴더 드롭 실패');
      }
    });
  }

  async function uploadClipPagesToDrive({ auto = false } = {}) {
    if (!ensureLogin()) return;
    if (!clipLocalPages.length) {
      setClipStatus('먼저 CLIP 폴더를 열어주세요.');
      return;
    }
    const clipCurrent = await ensureClipCurrentFolder();
    const manifest = [];
    const finishUploadBatch = beginDriveUploadBatch(clipLocalPages.length, 'CLIP Drive 업로드');
    try {
      for (let i = 0; i < clipLocalPages.length; i++) {
        const p = clipLocalPages[i];
        setClipStatus(`${i + 1} / ${clipLocalPages.length} Drive 업로드 중\n${p.name}`);
        const existing = await findDriveFile(p.name, clipCurrent.id);
        const uploaded = await uploadDriveMultipart({
          name: p.name,
          blob: p.blob,
          parentId: clipCurrent.id,
          fileId: existing?.id || null,
          mimeType: p.type || 'image/png'
        });
        manifest.push({
          index: i,
          name: p.name,
          fileId: uploaded.id,
          mimeType: uploaded.mimeType || p.type || 'image/png'
        });
      }
    } finally {
      finishUploadBatch();
    }
    await saveClipManifest(manifest);
    setClipStatus(`Drive 업로드 완료\n페이지: ${manifest.length}개`);
    if (!auto) window.showFeedbackMessage?.('CLIP 미리보기가 Drive에 저장되었습니다.');
  }

  async function syncClipPagesToDriveIfReady() {
    if (clipAutoSyncRunning || !clipLocalPages.length) return;
    if (!isDriveLoggedIn()) {
      setClipStatus('로그인 후 CLIP 폴더를 다시 열면 Drive에 자동 저장됩니다.');
      return;
    }
    clipAutoSyncRunning = true;
    try {
      await uploadClipPagesToDrive({ auto: true });
      window.showFeedbackMessage?.('다른 기기에서도 볼 수 있게 CLIP 미리보기를 저장했습니다.');
    } catch (err) {
      console.error(err);
      setClipStatus('CLIP Drive 자동 저장 실패');
    } finally {
      clipAutoSyncRunning = false;
    }
  }

  async function loadClipPagesFromDrive(render = true) {
    clearClipLocal();
    const pages = getClipPages();
    if (!pages.length) {
      if (render) showClipMessage(getEmptyClipMessage());
      return;
    }
    if (render) showClipMessage('Google Drive에서 CLIP 미리보기를 다운로드 중...');
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (render) setClipStatus(`${i + 1} / ${pages.length} Google Drive 다운로드 중\n${p.name}`);
      try {
        const blob = await downloadDriveBlob(p.fileId);
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.className = 'clip-page';
        img.alt = p.name;
        img.src = url;
        clipViewer.appendChild(img);
        clipLocalPages.push({ name: p.name, blob, url, type: blob.type || p.mimeType });
        if (i === 0) hideClipMessage();
      } catch (e) {
        console.warn(e);
      }
    }
    if (render) {
      hideClipMessage();
      setClipStatus(`Drive 불러오기 완료\n표시: ${clipLocalPages.length}개`);
    }
  }

  clipFolderInput?.addEventListener('change', async (e) => {
    clipFiles = Array.from(e.target.files || []);
    await loadClipFiles(clipFiles);
  });
  clipRefreshBtn?.addEventListener('click', async () => {
    if (isMobileView()) {
      if (!ensureLogin()) return;
      setClipStatus('Drive 최신 미리보기 확인 중...');
      await loadAppDataFromDrive();
      renderEverything();
      await loadClipPagesFromDrive(true);
      return;
    }
    if (!clipFiles.length) {
      setClipStatus('먼저 CLIP 폴더를 열어주세요.');
      return;
    }
    await loadClipFiles(clipFiles);
  });
  clipClearBtn?.addEventListener('click', () => {
    clipFiles = [];
    if (clipFolderInput) clipFolderInput.value = '';
    clearClipLocal();
    showClipMessage(getEmptyClipMessage());
    setClipStatus('');
  });
  attachClipDropZone(clipMessage);
  attachClipDropZone(clipViewer);
  showClipMessage(getEmptyClipMessage());
  window.matchMedia?.('(max-width: 768px)').addEventListener?.('change', () => {
    if (!clipLocalPages.length) showClipMessage(getEmptyClipMessage());
  });

  window.setClipStatus = setClipStatus;
  window.showClipMessage = showClipMessage;
  window.loadClipPagesFromDrive = loadClipPagesFromDrive;
}
