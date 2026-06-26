export function createDriveStatusStore(indicatorEl) {
  let statusTimer = null;
  let pendingUploads = 0;
  let uploadProgress = {
    active: false,
    planned: false,
    pending: 0,
    completed: 0,
    total: 0,
    label: 'Drive 업로드'
  };

  function setStatus(text, autoHide = true) {
    if (!indicatorEl) return;
    indicatorEl.textContent = text;
    indicatorEl.classList.add('show');
    clearTimeout(statusTimer);
    if (autoHide) {
      statusTimer = setTimeout(() => indicatorEl.classList.remove('show'), 1800);
    }
  }

  function setBusy(text) {
    setStatus(text, false);
  }

  function hide() {
    if (indicatorEl) indicatorEl.classList.remove('show');
  }

  function hasPendingUploads() {
    return pendingUploads > 0 || uploadProgress.active;
  }

  function updateUploadProgress(autoHide = false) {
    const total = Math.max(1, Number(uploadProgress.total || 0));
    const completed = Math.min(total, Number(uploadProgress.completed || 0));
    const percent = Math.floor((completed / total) * 100);
    setStatus(`${uploadProgress.label} ${completed}/${total} (${percent}%)`, autoHide);
  }

  function beginUploadBatch(total, label = 'Drive 업로드') {
    uploadProgress = {
      active: true,
      planned: true,
      pending: 0,
      completed: 0,
      total: Math.max(1, Number(total || 0)),
      label
    };
    updateUploadProgress(false);
    let ended = false;
    return () => {
      if (ended) return;
      ended = true;
      if (uploadProgress.pending <= 0 && uploadProgress.completed < uploadProgress.total) {
        uploadProgress.active = false;
      }
    };
  }

  function beginUpload(label = 'Drive 업로드') {
    if (!uploadProgress.active) {
      uploadProgress = {
        active: true,
        planned: false,
        pending: 0,
        completed: 0,
        total: 0,
        label
      };
    }
    pendingUploads += 1;
    uploadProgress.pending += 1;
    if (!uploadProgress.planned) uploadProgress.total += 1;
    updateUploadProgress(false);
  }

  function finishUpload() {
    pendingUploads = Math.max(0, pendingUploads - 1);
    uploadProgress.pending = Math.max(0, uploadProgress.pending - 1);
    uploadProgress.completed = Math.min(
      Math.max(1, uploadProgress.total),
      uploadProgress.completed + 1
    );
    const complete =
      uploadProgress.pending <= 0 && uploadProgress.completed >= uploadProgress.total;
    updateUploadProgress(complete);
    if (complete) {
      uploadProgress.active = false;
      uploadProgress.planned = false;
    }
  }

  return {
    beginUpload,
    beginUploadBatch,
    finishUpload,
    hasPendingUploads,
    hide,
    setBusy,
    setStatus
  };
}
