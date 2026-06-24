import { downloadTextFile, openTabSettings, renderManagedTab } from './tabSettings.js';

export function initWorkMusic({ showTab = (tabId) => window.showTab?.(tabId) } = {}) {
  const APP_CONFIG = window.APP_CONFIG || {};
  const YOUTUBE_API_KEY = APP_CONFIG.youtubeApiKey || '';
  window.workMusicSongs = window.workMusicSongs || [];
  window.__workMusicTabList = window.__workMusicTabList || [
    { id: 'default', name: '기본', order: 0 }
  ];
  window.__workMusicActiveTabId = window.__workMusicActiveTabId || 'default';
  window.workMusicMode = window.workMusicMode || 'sequential';
  window.workMusicCurrentIndex = window.workMusicCurrentIndex || 0;
  window.workMusicVolume = window.workMusicVolume ?? 80;
  window.workMusicLastVolume =
    window.workMusicLastVolume ??
    (Number(window.workMusicVolume) > 0 ? Number(window.workMusicVolume) : 80);
  window.workMusicIsMuted = window.workMusicIsMuted || Number(window.workMusicVolume) === 0;
  window.workMusicIsPlaying = window.workMusicIsPlaying || false;
  window.currentWorkMusicSettingIndex = null;

  const workMusicTabsContainer = document.getElementById('workmusicTabsContainer');
  const workMusicDragArea = document.getElementById('workmusic-drag-area');
  const workMusicPrevBtn = document.getElementById('workMusicPrevBtn');
  const workMusicPlayBtn = document.getElementById('workMusicPlayBtn');
  const workMusicNextBtn = document.getElementById('workMusicNextBtn');
  const workMusicModeBtn = document.getElementById('workMusicModeBtn');
  const workMusicMuteBtn = document.getElementById('workMusicMuteBtn');
  const workMusicVolumeRange = document.getElementById('workMusicVolumeRange');
  const workMusicVolumePercent = document.getElementById('workMusicVolumePercent');
  const workMusicList = document.getElementById('workMusicList');
  const workMusicSettingsModal = document.getElementById('workMusicSettingsModal');
  const workMusicTitleInput = document.getElementById('workMusicTitleInput');
  const workMusicSaveTitleBtn = document.getElementById('workMusicSaveTitleBtn');
  const workMusicOpenYoutubeBtn = document.getElementById('workMusicOpenYoutubeBtn');
  const workMusicDeleteBtn = document.getElementById('workMusicDeleteBtn');
  const workMusicCloseSettingsBtn = document.getElementById('workMusicCloseSettingsBtn');
  const workMusicRemote = document.getElementById('workMusicRemote');
  const workMusicRemoteInfo = document.getElementById('workMusicRemoteInfo');
  const workMusicRemoteThumb = document.getElementById('workMusicRemoteThumb');
  const workMusicRemoteTitle = document.getElementById('workMusicRemoteTitle');
  const workMusicRemoteArtist = document.getElementById('workMusicRemoteArtist');
  const workMusicRemotePrevBtn = document.getElementById('workMusicRemotePrevBtn');
  const workMusicRemotePlayBtn = document.getElementById('workMusicRemotePlayBtn');
  const workMusicRemoteNextBtn = document.getElementById('workMusicRemoteNextBtn');
  const workMusicRemoteMuteBtn = document.getElementById('workMusicRemoteMuteBtn');
  const workMusicRemoteVolumeRange = document.getElementById('workMusicRemoteVolumeRange');
  const workMusicRemoteVolumePercent = document.getElementById('workMusicRemoteVolumePercent');
  let workMusicIframe = null;
  let workMusicPlayer = null;
  let workMusicSyncTimer = null;
  let workMusicDurationSaveTimer = null;
  let workMusicPlaybackWatchTimer = null;
  let workMusicPlaybackWatchToken = 0;
  let workMusicFailureSkipTimer = null;
  let workMusicAutoSkipSession = null;
  window.workMusicCurrentPlayOrder = window.workMusicCurrentPlayOrder || [];

  const showFeedbackMessage = (message) => window.showFeedbackMessage?.(message);
  const showAlert = (message) => window.showAlert?.(message);
  const WORK_MUSIC_PLAYBACK_TIMEOUT_MS = 12000;
  const WORK_MUSIC_FAILURE_SKIP_DELAY_MS = 1200;
  const WORK_MUSIC_PLAYBACK_ERROR_LABELS = {
    2: '잘못된 링크',
    5: '재생 오류',
    100: '삭제/비공개',
    101: '임베드 불가',
    150: '임베드 불가',
    invalid: '잘못된 링크',
    timeout: '응답 없음'
  };

  // ===== 노동요(YouTube) =====
  // 일반 embed iframe + YouTube postMessage 제어. 재생/일시정지는 iframe을 다시 만들지 않고 명령만 보냅니다.
  function escapeHtml(str) {
    return String(str ?? '').replace(
      /[&<>"']/g,
      (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]
    );
  }

  const workMusicPlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
  const workMusicPauseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>`;
  const workMusicPlaylistMarkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h12"/><path d="M3 12h10"/><path d="M3 18h8"/><path d="M17 10v8"/><path d="M13 14h8"/></svg>`;
  const workMusicSettingsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h8"/><path d="M16 7h4"/><circle cx="14" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/></svg>`;
  const workMusicVolumeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>`;
  const workMusicMutedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/></svg>`;

  function ensureWorkMusicDefaultTabs() {
    const fallback = [{ id: 'default', name: '기본', order: 0 }];
    if (!Array.isArray(window.__workMusicTabList) || window.__workMusicTabList.length === 0) {
      window.__workMusicTabList = fallback;
    }
    if (
      !window.__workMusicTabList.some((t) => t.id === (window.__workMusicActiveTabId || 'default'))
    ) {
      window.__workMusicActiveTabId = window.__workMusicTabList[0]?.id || 'default';
    }
    return window.__workMusicTabList;
  }

  async function persistWorkMusicDefaultTabsIfNeeded() {
    ensureWorkMusicDefaultTabs();
    if (!window.ensureLogin || !window.ensureLogin()) return;
    try {
      await window.cloudEnsureWorkMusicDefaultTab?.();
    } catch (err) {
      console.warn('work music default tab init failed', err);
    }
  }

  function getWorkMusicTabs() {
    const tabs = ensureWorkMusicDefaultTabs();
    return [...tabs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  function getActiveWorkMusicTabId() {
    const tabs = getWorkMusicTabs();
    if (!tabs.some((t) => t.id === window.__workMusicActiveTabId))
      window.__workMusicActiveTabId = tabs[0]?.id || 'default';
    return window.__workMusicActiveTabId || 'default';
  }
  function getActiveWorkMusicSongs() {
    const activeTabId = getActiveWorkMusicTabId();
    return (window.workMusicSongs || []).filter(
      (s) => (s.workMusicTabId || 'default') === activeTabId
    );
  }
  function getWorkMusicTabPlaylistId(tabId) {
    const tab = getWorkMusicTabs().find((t) => t.id === tabId);
    if (tab?.sourcePlaylistId) return tab.sourcePlaylistId;
    const found = (window.workMusicSongs || []).find(
      (s) => (s.workMusicTabId || 'default') === tabId && s.sourcePlaylistId
    );
    return found?.sourcePlaylistId || '';
  }
  function normalizeWorkMusicCurrentIndex(songs = getActiveWorkMusicSongs()) {
    if (!songs.length) {
      window.workMusicCurrentIndex = 0;
      return 0;
    }
    let idx = Number(window.workMusicCurrentIndex || 0);
    if (idx < 0 || idx >= songs.length) idx = 0;
    window.workMusicCurrentIndex = idx;
    return idx;
  }

  function renderWorkMusicPlayButton() {
    if (workMusicPlayBtn) {
      workMusicPlayBtn.innerHTML = window.workMusicIsPlaying ? workMusicPauseSvg : workMusicPlaySvg;
      workMusicPlayBtn.title = window.workMusicIsPlaying ? '일시정지' : '재생';
      workMusicPlayBtn.setAttribute('aria-label', window.workMusicIsPlaying ? '일시정지' : '재생');
    }
    if (workMusicRemotePlayBtn) {
      workMusicRemotePlayBtn.innerHTML = window.workMusicIsPlaying
        ? workMusicPauseSvg
        : workMusicPlaySvg;
      workMusicRemotePlayBtn.title = window.workMusicIsPlaying ? '일시정지' : '재생';
      workMusicRemotePlayBtn.setAttribute(
        'aria-label',
        window.workMusicIsPlaying ? '일시정지' : '재생'
      );
    }
  }

  function updateWorkMusicRemoteUI() {
    if (!workMusicRemote) return;
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) {
      workMusicRemote.classList.remove('show');
      return;
    }
    normalizeWorkMusicCurrentIndex(songs);
    const song = songs[Number(window.workMusicCurrentIndex || 0)] || songs[0];
    if (!song) {
      workMusicRemote.classList.remove('show');
      return;
    }
    const title = song.title || `YouTube ${song.videoId || ''}`;
    const artist = getSongArtist(song) || song.channelTitle || '';
    const thumb =
      song.thumbnail ||
      (song.videoId ? `https://img.youtube.com/vi/${song.videoId}/mqdefault.jpg` : '');
    workMusicRemote.classList.add('show');
    if (workMusicRemoteTitle) workMusicRemoteTitle.textContent = title;
    if (workMusicRemoteArtist)
      workMusicRemoteArtist.textContent =
        artist || (window.workMusicIsPlaying ? '재생 중' : '일시정지');
    if (workMusicRemoteThumb && thumb && workMusicRemoteThumb.src !== thumb)
      workMusicRemoteThumb.src = thumb;
    renderWorkMusicPlayButton();
    renderWorkMusicVolumeUI();
  }

  function extractYoutubeVideoId(url) {
    if (!url) return null;
    const text = String(url).trim();
    try {
      const u = new URL(text.includes('://') ? text : 'https://' + text);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') return (u.pathname.split('/').filter(Boolean)[0] || '').slice(0, 11);
      if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
        if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
        const parts = u.pathname.split('/').filter(Boolean);
        const keys = ['embed', 'shorts', 'live'];
        if (keys.includes(parts[0]) && parts[1]) return parts[1].slice(0, 11);
      }
    } catch (_) {
      /* 정규식 fallback */
    }
    const m = text.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
  }

  function normalizeYoutubeUrl(url) {
    const id = extractYoutubeVideoId(url);
    return id ? `https://www.youtube.com/watch?v=${id}` : String(url || '').trim();
  }

  function looksAutoTitle(song) {
    const t = String(song?.title || '').trim();
    return (
      !!song?.autoTitle ||
      !t ||
      t === `YouTube ${song?.videoId}` ||
      t === '제목 불러오기 실패' ||
      /^YouTube [A-Za-z0-9_-]{11}$/.test(t)
    );
  }

  function cleanYoutubeTitle(title) {
    let t = String(title || '').trim();
    t = t.replace(/\s*-\s*YouTube\s*$/i, '').trim();
    t = t.replace(/^YouTube\s*[-:]\s*/i, '').trim();
    return t;
  }

  function parseYoutubeISODuration(iso) {
    const m = String(iso || '').match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 0;
    return (
      Number(m[1] || 0) * 86400 +
      Number(m[2] || 0) * 3600 +
      Number(m[3] || 0) * 60 +
      Number(m[4] || 0)
    );
  }

  async function youtubeApiGet(path, params = {}) {
    if (!YOUTUBE_API_KEY) throw new Error('YouTube API 키가 없습니다.');
    const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
    url.searchParams.set('key', YOUTUBE_API_KEY);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') url.searchParams.set(k, String(v));
    });
    const res = await fetch(url.toString(), { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `${res.status} ${res.statusText}`;
      throw new Error(msg);
    }
    return data;
  }

  async function fetchYoutubeVideosMeta(videoIds) {
    const ids = [...new Set((videoIds || []).filter(Boolean))];
    const meta = {};
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const data = await youtubeApiGet('videos', {
        part: 'snippet,contentDetails',
        id: chunk.join(','),
        maxResults: 50
      });
      (data.items || []).forEach((item) => {
        const seconds = parseYoutubeISODuration(item?.contentDetails?.duration);
        const channelTitle = cleanYoutubeArtistName(item?.snippet?.channelTitle || '');
        meta[item.id] = {
          videoId: item.id,
          title: cleanYoutubeTitle(item?.snippet?.title || `YouTube ${item.id}`),
          durationSeconds: seconds,
          durationText: formatWorkMusicDuration(seconds),
          thumbnail:
            item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url || '',
          channelTitle,
          artist: channelTitle
        };
      });
    }
    return meta;
  }

  function formatWorkMusicDuration(seconds) {
    const n = Math.floor(Number(seconds || 0));
    if (!Number.isFinite(n) || n <= 0) return '';
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const sec = n % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function parseDurationTextToSeconds(text) {
    const parts = String(text || '')
      .trim()
      .split(':')
      .map((v) => Number(v));
    if (!parts.length || parts.some((v) => !Number.isFinite(v))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function parseDurationFromHtml(html) {
    const text = String(html || '');
    const length = text.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/i);
    if (length) return Number(length[1]) || 0;
    const dur = text.match(/"duration"\s*:\s*"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/i);
    if (dur) return Number(dur[1] || 0) * 3600 + Number(dur[2] || 0) * 60 + Number(dur[3] || 0);
    return 0;
  }

  async function fetchYoutubeDuration(videoIdOrUrl) {
    const videoId = extractYoutubeVideoId(videoIdOrUrl) || String(videoIdOrUrl || '').trim();
    if (!videoId) return 0;
    try {
      const meta = await fetchYoutubeVideosMeta([videoId]);
      if (meta[videoId]?.durationSeconds) return meta[videoId].durationSeconds;
    } catch (err) {
      console.warn('YouTube API duration failed', err);
    }
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const endpoints = [
      { type: 'json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}` },
      {
        type: 'text',
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`
      }
    ];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint.url, { cache: 'no-store' });
        if (!res.ok) continue;
        let html = '';
        if (endpoint.type === 'json') {
          const data = await res.json();
          html = data.contents || data.data || '';
        } else {
          html = await res.text();
        }
        const seconds = parseDurationFromHtml(html);
        if (seconds) return seconds;
      } catch (_) {
        /* 다음 endpoint 시도 */
      }
    }
    return 0;
  }

  function parseTitleFromHtml(html) {
    const text = String(html || '');
    const og =
      text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      text.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!og) return '';
    const textarea = document.createElement('textarea');
    textarea.innerHTML = og[1];
    return cleanYoutubeTitle(textarea.value);
  }

  async function fetchYoutubeTitle(url) {
    const cleanUrl = normalizeYoutubeUrl(url);
    const videoId = extractYoutubeVideoId(cleanUrl);
    if (videoId) {
      try {
        const meta = await fetchYoutubeVideosMeta([videoId]);
        if (meta[videoId]?.title) return meta[videoId].title;
      } catch (err) {
        console.warn('YouTube API title failed', err);
      }
    }
    const endpoints = [
      {
        type: 'json',
        url: `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(cleanUrl)}`
      },
      { type: 'json', url: `https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}` },
      { type: 'json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}` },
      {
        type: 'text',
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`
      }
    ];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint.url, { cache: 'no-store' });
        if (!res.ok) continue;
        if (endpoint.type === 'json') {
          const data = await res.json();
          const title = cleanYoutubeTitle(data.title || parseTitleFromHtml(data.contents || ''));
          if (title) return title;
        } else {
          const html = await res.text();
          const title = parseTitleFromHtml(html);
          if (title) return title;
        }
      } catch (_) {
        /* 다음 endpoint 시도 */
      }
    }
    return '';
  }

  async function fillMissingWorkMusicTitles() {
    const songs = window.workMusicSongs || [];
    const targets = songs.filter(looksAutoTitle);
    if (!targets.length) return;
    let changed = false;
    for (const song of targets) {
      const title = await fetchYoutubeTitle(
        song.url || `https://www.youtube.com/watch?v=${song.videoId}`
      );
      if (title) {
        song.title = title;
        song.autoTitle = false;
        changed = true;
      }
    }
    if (changed) {
      await window.cloudSaveWorkMusic?.();
      renderWorkMusic();
    }
  }

  async function fillMissingWorkMusicDurations() {
    const songs = window.workMusicSongs || [];
    const targets = songs.filter((s) => s?.videoId && !s.durationSeconds);
    if (!targets.length) return;
    let changed = false;
    for (const song of targets.slice(0, 25)) {
      const seconds = await fetchYoutubeDuration(song.videoId);
      if (seconds) {
        song.durationSeconds = seconds;
        changed = true;
      }
    }
    if (changed) {
      await window.cloudSaveWorkMusic?.();
      renderWorkMusic();
    }
  }

  function rememberWorkMusicDuration(index, seconds) {
    const songs = getActiveWorkMusicSongs();
    const song = songs[index];
    const n = Math.floor(Number(seconds || 0));
    if (!song || !n || song.durationSeconds) return;
    song.durationSeconds = n;
    renderWorkMusic();
    clearTimeout(workMusicDurationSaveTimer);
    workMusicDurationSaveTimer = setTimeout(() => window.cloudSaveWorkMusic?.(), 800);
  }

  function getWorkMusicNextIndex(step = 1) {
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) return -1;
    const cur = Math.max(0, Number(window.workMusicCurrentIndex || 0));
    if (window.workMusicMode === 'random' && songs.length > 1) {
      let next = cur;
      while (next === cur) next = Math.floor(Math.random() * songs.length);
      return next;
    }
    return (cur + step + songs.length) % songs.length;
  }

  function shuffledWorkMusicIndexes(startIndex) {
    const songs = getActiveWorkMusicSongs();
    const indexes = songs.map((_, i) => i).filter((i) => i !== startIndex);
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return [startIndex, ...indexes];
  }

  function getWorkMusicPlayOrder(startIndex) {
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) return [];
    if (window.workMusicMode === 'random') return shuffledWorkMusicIndexes(startIndex);
    return songs.map((_, offset) => (startIndex + offset) % songs.length);
  }

  function getWorkMusicSongKey(song, index) {
    const activeTabId = song?.workMusicTabId || getActiveWorkMusicTabId();
    return String(song?.id || `${activeTabId}:${song?.videoId || index}`);
  }

  function getWorkMusicPlaybackErrorReason(code) {
    const key = code === undefined || code === null ? '' : String(code);
    return WORK_MUSIC_PLAYBACK_ERROR_LABELS[key] || '재생 실패';
  }

  function clearWorkMusicPlaybackWatch() {
    workMusicPlaybackWatchToken += 1;
    clearTimeout(workMusicPlaybackWatchTimer);
    workMusicPlaybackWatchTimer = null;
  }

  function clearWorkMusicFailureSkipTimer() {
    clearTimeout(workMusicFailureSkipTimer);
    workMusicFailureSkipTimer = null;
  }

  function resetWorkMusicAutoSkipSession() {
    workMusicAutoSkipSession = null;
  }

  function getWorkMusicCurrentPlayerIndex() {
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) return 0;
    try {
      if (workMusicPlayer && typeof workMusicPlayer.getPlaylistIndex === 'function') {
        const ytIndex = Number(workMusicPlayer.getPlaylistIndex());
        const order = window.workMusicCurrentPlayOrder || [];
        const mapped = Number.isFinite(ytIndex) ? order[ytIndex] : undefined;
        if (Number.isInteger(mapped) && mapped >= 0 && mapped < songs.length) return mapped;
      }
    } catch (err) {
      console.warn('work music current index read failed', err);
    }
    const fallback = Number(window.workMusicCurrentIndex || 0);
    return fallback >= 0 && fallback < songs.length ? fallback : 0;
  }

  function scheduleWorkMusicPlaybackWatch(index) {
    const songs = getActiveWorkMusicSongs();
    const song = songs[index];
    if (!song) return;
    clearWorkMusicPlaybackWatch();
    const expectedTabId = getActiveWorkMusicTabId();
    const expectedSongKey = getWorkMusicSongKey(song, index);
    const token = workMusicPlaybackWatchToken;
    workMusicPlaybackWatchTimer = setTimeout(() => {
      if (token !== workMusicPlaybackWatchToken) return;
      if (!window.workMusicIsPlaying || getActiveWorkMusicTabId() !== expectedTabId) return;
      const currentIndex = Number(window.workMusicCurrentIndex || 0);
      const currentSong = getActiveWorkMusicSongs()[currentIndex];
      if (
        currentIndex !== index ||
        getWorkMusicSongKey(currentSong, currentIndex) !== expectedSongKey
      ) {
        return;
      }
      handleWorkMusicPlaybackFailure(index, 'timeout');
    }, WORK_MUSIC_PLAYBACK_TIMEOUT_MS);
  }

  function markWorkMusicPlaybackError(index, code) {
    const songs = getActiveWorkMusicSongs();
    const song = songs[index];
    if (!song) return false;
    const reason = getWorkMusicPlaybackErrorReason(code);
    const errorCode = code === undefined || code === null ? '' : String(code);
    const changed =
      song.playbackStatus !== 'error' ||
      song.playbackErrorReason !== reason ||
      String(song.playbackErrorCode || '') !== errorCode;
    song.playbackStatus = 'error';
    song.playbackErrorReason = reason;
    song.playbackErrorCode = errorCode;
    song.playbackErrorAt = new Date().toISOString();
    if (changed) window.cloudSaveWorkMusic?.();
    return changed;
  }

  function clearWorkMusicPlaybackError(index) {
    const songs = getActiveWorkMusicSongs();
    const song = songs[index];
    if (
      !song ||
      (song.playbackStatus !== 'error' &&
        !song.playbackErrorReason &&
        !song.playbackErrorCode &&
        !song.playbackErrorAt)
    ) {
      return false;
    }
    delete song.playbackStatus;
    delete song.playbackErrorReason;
    delete song.playbackErrorCode;
    delete song.playbackErrorAt;
    window.cloudSaveWorkMusic?.();
    return true;
  }

  function getNextWorkMusicIndexAfterFailure(failedIndex) {
    const songs = getActiveWorkMusicSongs();
    if (songs.length <= 1) return -1;
    const activeTabId = getActiveWorkMusicTabId();
    if (!workMusicAutoSkipSession || workMusicAutoSkipSession.tabId !== activeTabId) {
      workMusicAutoSkipSession = { tabId: activeTabId, triedKeys: new Set() };
    }
    const failedSong = songs[failedIndex];
    if (failedSong) {
      workMusicAutoSkipSession.triedKeys.add(getWorkMusicSongKey(failedSong, failedIndex));
    }

    const rawOrder = window.workMusicCurrentPlayOrder?.length
      ? window.workMusicCurrentPlayOrder
      : getWorkMusicPlayOrder(failedIndex);
    const order = rawOrder.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < songs.length);
    const start = Math.max(0, order.indexOf(failedIndex));
    for (let offset = 1; offset <= order.length; offset += 1) {
      const idx = order[(start + offset) % order.length];
      const song = songs[idx];
      if (!song) continue;
      const songKey = getWorkMusicSongKey(song, idx);
      if (workMusicAutoSkipSession.triedKeys.has(songKey)) continue;
      if (song.playbackStatus === 'error') continue;
      return idx;
    }
    return -1;
  }

  function handleWorkMusicPlaybackFailure(index = getWorkMusicCurrentPlayerIndex(), code = '') {
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) return;
    const failedIndex =
      index >= 0 && index < songs.length ? index : getWorkMusicCurrentPlayerIndex();
    const failedSong = songs[failedIndex];
    if (!failedSong) return;
    clearWorkMusicPlaybackWatch();
    stopWorkMusicSyncTimer();
    window.workMusicCurrentIndex = failedIndex;
    window.workMusicIsPlaying = false;
    markWorkMusicPlaybackError(failedIndex, code);
    renderWorkMusicPlayButton();
    updateWorkMusicRemoteUI();
    renderWorkMusic();

    const nextIndex = getNextWorkMusicIndexAfterFailure(failedIndex);
    if (nextIndex < 0) {
      resetWorkMusicAutoSkipSession();
      showFeedbackMessage('재생 가능한 다음 곡을 찾지 못했습니다.');
      return;
    }

    const failedTitle = failedSong.title || `YouTube ${failedSong.videoId || ''}`;
    showFeedbackMessage(`${failedTitle} 재생 실패, 다음 곡으로 넘어갑니다.`);
    clearWorkMusicFailureSkipTimer();
    const expectedTabId = getActiveWorkMusicTabId();
    const expectedSongKey = getWorkMusicSongKey(failedSong, failedIndex);
    workMusicFailureSkipTimer = setTimeout(() => {
      workMusicFailureSkipTimer = null;
      if (getActiveWorkMusicTabId() !== expectedTabId) return;
      const currentSongs = getActiveWorkMusicSongs();
      const currentSong = currentSongs[failedIndex];
      if (
        Number(window.workMusicCurrentIndex || 0) !== failedIndex ||
        getWorkMusicSongKey(currentSong, failedIndex) !== expectedSongKey
      ) {
        return;
      }
      playWorkMusicAt(nextIndex, { resetSkipSession: false });
    }, WORK_MUSIC_FAILURE_SKIP_DELAY_MS);
  }

  function getWorkMusicDisplayOrder(songs) {
    const count = songs.length;
    if (!count) return [];
    if (window.workMusicMode !== 'random') return songs.map((_, i) => i);
    const activeTabId = getActiveWorkMusicTabId();
    const idsKey = songs.map((s) => s.id || s.videoId || '').join('|');
    const cache = window.__workMusicDisplayShuffle || {};
    const cached = cache[activeTabId];
    if (
      cached &&
      cached.idsKey === idsKey &&
      Array.isArray(cached.order) &&
      cached.order.length === count
    ) {
      return cached.order.filter((i) => i >= 0 && i < count);
    }
    const order = songs.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    window.__workMusicDisplayShuffle = { ...cache, [activeTabId]: { idsKey, order } };
    return order;
  }

  function getWorkMusicInitialDisplayIndex(songs = getActiveWorkMusicSongs()) {
    if (!songs.length) return 0;
    if (window.workMusicMode !== 'random') return 0;
    const order = getWorkMusicDisplayOrder(songs);
    return Number.isInteger(order[0]) ? order[0] : 0;
  }

  function resetWorkMusicDisplayShuffle(tabId = getActiveWorkMusicTabId()) {
    window.__workMusicDisplayShuffle = window.__workMusicDisplayShuffle || {};
    delete window.__workMusicDisplayShuffle[tabId];
  }

  function sendWorkMusicCommand(func, args = []) {
    try {
      if (workMusicPlayer && typeof workMusicPlayer[func] === 'function') {
        workMusicPlayer[func](...(args || []));
        return;
      }
      if (!workMusicIframe?.contentWindow) return;
      workMusicIframe.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch (err) {
      console.warn('YouTube command failed', err);
    }
  }

  function renderWorkMusicVolumeUI() {
    const raw = Math.max(0, Math.min(100, Number(window.workMusicVolume ?? 80)));
    const muted = !!window.workMusicIsMuted || raw === 0;
    const display = muted ? 0 : raw;
    if (workMusicVolumeRange) workMusicVolumeRange.value = String(display);
    if (workMusicVolumePercent) workMusicVolumePercent.textContent = `${display}%`;
    if (workMusicRemoteVolumeRange) workMusicRemoteVolumeRange.value = String(display);
    if (workMusicRemoteVolumePercent) workMusicRemoteVolumePercent.textContent = `${display}%`;
    if (workMusicMuteBtn) {
      workMusicMuteBtn.innerHTML = muted ? workMusicMutedSvg : workMusicVolumeSvg;
      workMusicMuteBtn.title = muted ? '음소거 해제' : '음소거';
      workMusicMuteBtn.setAttribute('aria-label', muted ? '음소거 해제' : '음소거');
    }
    if (workMusicRemoteMuteBtn) {
      workMusicRemoteMuteBtn.innerHTML = muted ? workMusicMutedSvg : workMusicVolumeSvg;
      workMusicRemoteMuteBtn.title = muted ? '음소거 해제' : '음소거';
      workMusicRemoteMuteBtn.setAttribute('aria-label', muted ? '음소거 해제' : '음소거');
    }
  }

  function applyWorkMusicVolume() {
    const raw = Math.max(0, Math.min(100, Number(window.workMusicVolume ?? 80)));
    const muted = !!window.workMusicIsMuted || raw === 0;
    const playerVolume = muted ? 0 : raw;
    renderWorkMusicVolumeUI();
    sendWorkMusicCommand('setVolume', [playerVolume]);
    if (muted) sendWorkMusicCommand('mute');
    else sendWorkMusicCommand('unMute');
  }

  async function setWorkMusicVolume(value, { save = true } = {}) {
    const v = Math.max(0, Math.min(100, Math.round(Number(value || 0) / 5) * 5));
    window.workMusicVolume = v;
    window.workMusicIsMuted = v === 0;
    if (v > 0) window.workMusicLastVolume = v;
    applyWorkMusicVolume();
    if (save) await window.cloudSaveWorkMusic?.();
  }

  async function toggleWorkMusicMute() {
    if (window.workMusicIsMuted || Number(window.workMusicVolume || 0) === 0) {
      const restore = Math.max(5, Math.min(100, Number(window.workMusicLastVolume || 80)));
      window.workMusicVolume = restore;
      window.workMusicIsMuted = false;
    } else {
      window.workMusicLastVolume = Math.max(5, Number(window.workMusicVolume || 80));
      window.workMusicIsMuted = true;
    }
    applyWorkMusicVolume();
    await window.cloudSaveWorkMusic?.();
  }

  function ensureYouTubeIframeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (window.__workMusicYTApiPromise) return window.__workMusicYTApiPromise;
    window.__workMusicYTApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function')
          try {
            prev();
          } catch (_) {
            /* ignore */
          }
        resolve();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(check);
          resolve();
        }
      }, 200);
    });
    return window.__workMusicYTApiPromise;
  }

  function syncWorkMusicFromPlayer() {
    try {
      if (!workMusicPlayer || typeof workMusicPlayer.getPlaylistIndex !== 'function') return;
      const ytIndex = Number(workMusicPlayer.getPlaylistIndex());
      const order = window.workMusicCurrentPlayOrder || [];
      const mapped = Number.isFinite(ytIndex) ? order[ytIndex] : undefined;
      const songs = getActiveWorkMusicSongs();
      if (
        Number.isInteger(mapped) &&
        mapped >= 0 &&
        mapped < songs.length &&
        mapped !== Number(window.workMusicCurrentIndex || 0)
      ) {
        window.workMusicCurrentIndex = mapped;
        renderWorkMusic();
        window.cloudSaveWorkMusic?.();
      }
      if (
        Number.isInteger(Number(window.workMusicCurrentIndex)) &&
        typeof workMusicPlayer.getDuration === 'function'
      ) {
        const seconds = workMusicPlayer.getDuration();
        rememberWorkMusicDuration(Number(window.workMusicCurrentIndex || 0), seconds);
      }
    } catch (err) {
      console.warn('work music sync failed', err);
    }
  }

  function startWorkMusicSyncTimer() {
    clearInterval(workMusicSyncTimer);
    workMusicSyncTimer = setInterval(syncWorkMusicFromPlayer, 900);
  }

  function stopWorkMusicSyncTimer() {
    clearInterval(workMusicSyncTimer);
    workMusicSyncTimer = null;
  }

  function onWorkMusicPlayerStateChange(event) {
    const state = event?.data;
    if (window.YT && state === window.YT.PlayerState.PLAYING) {
      clearWorkMusicPlaybackWatch();
      resetWorkMusicAutoSkipSession();
      window.workMusicIsPlaying = true;
      syncWorkMusicFromPlayer();
      clearWorkMusicPlaybackError(Number(window.workMusicCurrentIndex || 0));
      renderWorkMusicPlayButton();
      renderWorkMusic();
      startWorkMusicSyncTimer();
    } else if (
      window.YT &&
      (state === window.YT.PlayerState.PAUSED || state === window.YT.PlayerState.ENDED)
    ) {
      clearWorkMusicPlaybackWatch();
      window.workMusicIsPlaying = false;
      renderWorkMusicPlayButton();
      renderWorkMusic();
      if (state === window.YT.PlayerState.PAUSED) stopWorkMusicSyncTimer();
    }
  }

  function onWorkMusicPlayerError(event) {
    handleWorkMusicPlaybackFailure(getWorkMusicCurrentPlayerIndex(), event?.data || '');
  }

  async function renderWorkMusicIframe(index, autoplay = true) {
    const box = document.getElementById('workMusicPlayerBox');
    const songs = getActiveWorkMusicSongs();
    if (!box) return;
    stopWorkMusicSyncTimer();
    clearWorkMusicPlaybackWatch();
    if (workMusicPlayer && typeof workMusicPlayer.destroy === 'function') {
      try {
        workMusicPlayer.destroy();
      } catch (_) {
        /* ignore */
      }
    }
    workMusicPlayer = null;
    workMusicIframe = null;
    if (!songs.length) {
      box.innerHTML =
        '<div style="color:#777;padding:24px;text-align:center">유튜브 링크를 추가하면 여기에 재생됩니다.</div>';
      window.workMusicIsPlaying = false;
      window.workMusicCurrentPlayOrder = [];
      renderWorkMusicPlayButton();
      updateWorkMusicRemoteUI();
      return;
    }
    if (index < 0 || index >= songs.length) index = 0;
    const song = songs[index];
    if (!song?.videoId) {
      box.innerHTML =
        '<div style="color:#777;padding:24px;text-align:center">유튜브 링크를 확인해주세요.</div>';
      window.workMusicIsPlaying = false;
      window.workMusicCurrentPlayOrder = [];
      renderWorkMusicPlayButton();
      updateWorkMusicRemoteUI();
      if (autoplay) handleWorkMusicPlaybackFailure(index, 'invalid');
      return;
    }
    const order = getWorkMusicPlayOrder(index);
    window.workMusicCurrentPlayOrder = order;
    const playlistIds = order.map((i) => songs[i]?.videoId).filter(Boolean);
    const firstId = playlistIds[0] || song.videoId;
    box.innerHTML = `<div id="workMusicYoutubeIframe" style="width:100%;height:100%"></div>`;
    window.workMusicIsPlaying = !!autoplay;
    renderWorkMusicPlayButton();
    await ensureYouTubeIframeAPI();
    workMusicPlayer = new YT.Player('workMusicYoutubeIframe', {
      width: '100%',
      height: '100%',
      videoId: firstId,
      playerVars: {
        autoplay: autoplay ? 1 : 0,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        playlist: playlistIds.join(',')
      },
      events: {
        onReady: (event) => {
          workMusicIframe = document.getElementById('workMusicYoutubeIframe');
          applyWorkMusicVolume();
          if (autoplay) event.target.playVideo();
          setTimeout(syncWorkMusicFromPlayer, 500);
          if (autoplay) {
            scheduleWorkMusicPlaybackWatch(index);
            startWorkMusicSyncTimer();
          }
        },
        onStateChange: onWorkMusicPlayerStateChange,
        onError: onWorkMusicPlayerError
      }
    });
  }

  function playWorkMusicAt(index, { resetSkipSession = true } = {}) {
    const songs = getActiveWorkMusicSongs();
    clearWorkMusicFailureSkipTimer();
    if (resetSkipSession) resetWorkMusicAutoSkipSession();
    if (!songs.length) {
      renderWorkMusic();
      showFeedbackMessage('먼저 유튜브 링크를 추가해주세요.');
      return;
    }
    if (index < 0 || index >= songs.length) index = 0;
    window.workMusicCurrentIndex = index;
    window.workMusicIsPlaying = true;
    renderWorkMusic();
    updateWorkMusicRemoteUI();
    renderWorkMusicIframe(index, true);
    window.cloudSaveWorkMusic?.();
  }

  function toggleWorkMusicPlay() {
    const songs = getActiveWorkMusicSongs();
    if (!songs.length) {
      renderWorkMusic();
      showFeedbackMessage('먼저 유튜브 링크를 추가해주세요.');
      return;
    }
    if (!workMusicIframe) {
      renderWorkMusicIframe(window.workMusicCurrentIndex || 0, true);
      window.workMusicIsPlaying = true;
    } else if (window.workMusicIsPlaying) {
      clearWorkMusicPlaybackWatch();
      clearWorkMusicFailureSkipTimer();
      sendWorkMusicCommand('pauseVideo');
      window.workMusicIsPlaying = false;
    } else {
      resetWorkMusicAutoSkipSession();
      sendWorkMusicCommand('playVideo');
      window.workMusicIsPlaying = true;
      scheduleWorkMusicPlaybackWatch(Number(window.workMusicCurrentIndex || 0));
    }
    renderWorkMusicPlayButton();
    updateWorkMusicRemoteUI();
    renderWorkMusic();
  }

  function renderWorkMusic() {
    const songs = getActiveWorkMusicSongs();
    normalizeWorkMusicCurrentIndex(songs);
    if (workMusicModeBtn) {
      workMusicModeBtn.classList.toggle('random', window.workMusicMode === 'random');
      workMusicModeBtn.title =
        window.workMusicMode === 'random' ? '랜덤 재생 켜짐' : '순서대로 재생 중';
    }
    renderWorkMusicPlayButton();
    renderWorkMusicVolumeUI();
    updateWorkMusicRemoteUI();
    if (!songs.length) renderWorkMusicIframe(getWorkMusicInitialDisplayIndex(), false);
    if (!workMusicList) return;
    workMusicList.innerHTML = '';
    const activeTabForList = getWorkMusicTabs().find((t) => t.id === getActiveWorkMusicTabId());
    function isWorkMusicAudioCard(song) {
      const typeText = String(song?.sourceType || activeTabForList?.sourceType || '').toLowerCase();
      const rawArtist = String(song?.artist || song?.channelTitle || song?.ownerChannelTitle || '');
      const rawTitle = String(song?.title || '');
      // 예전 버전에서 가져온 유튜브뮤직 곡은 sourceType이 저장되지 않았을 수 있어서
      // "OOO - Topic" 채널명도 음악 카드로 판정합니다.
      return (
        typeText.includes('music') ||
        /-\s*topic$/i.test(rawArtist) ||
        /provided to youtube by/i.test(rawTitle)
      );
    }
    const allAudioCards = songs.length > 0 && songs.every(isWorkMusicAudioCard);
    workMusicList.classList.toggle('music-compact-list', allAudioCards);
    const displayOrder = getWorkMusicDisplayOrder(songs);
    if (
      window.workMusicMode === 'random' &&
      !window.workMusicIsPlaying &&
      Number.isInteger(displayOrder[0]) &&
      displayOrder[0] !== Number(window.workMusicCurrentIndex || 0)
    ) {
      // 랜덤 모드에서는 화면에 보이는 첫 번째 카드가 선택된 곡이 되도록 맞춥니다.
      // 단, 재생 중에는 사용자가 듣는 곡이 갑자기 바뀌지 않게 건드리지 않습니다.
      window.workMusicCurrentIndex = displayOrder[0];
    }
    displayOrder.forEach((idx) => {
      const song = songs[idx];
      if (!song) return;
      const row = document.createElement('div');
      const isActive = idx === (window.workMusicCurrentIndex || 0);
      const isMusicTrack = isWorkMusicAudioCard(song);
      const hasPlaybackError = song.playbackStatus === 'error';
      row.className = [
        'workmusic-item',
        isMusicTrack ? 'music-track' : '',
        isActive ? 'active' : '',
        hasPlaybackError ? 'playback-error' : ''
      ]
        .filter(Boolean)
        .join(' ');
      const title = song.title || `YouTube ${song.videoId}`;
      const artist = getSongArtist(song);
      const durationText = song.durationText || formatWorkMusicDuration(song.durationSeconds);
      const thumbSrc =
        song.thumbnail || `https://img.youtube.com/vi/${escapeHtml(song.videoId)}/mqdefault.jpg`;
      const playbackErrorReason = song.playbackErrorReason || '재생 실패';
      const rowTitle = artist ? `${title} - ${artist}` : title;
      row.setAttribute(
        'title',
        hasPlaybackError ? `${rowTitle} (${playbackErrorReason})` : rowTitle
      );
      const playbackErrorBadge = hasPlaybackError
        ? `<div class="workmusic-error-badge" title="${escapeHtml(playbackErrorReason)}">재생 실패</div>`
        : '';
      if (isMusicTrack) {
        row.innerHTML = `
            <img class="workmusic-thumb" src="${escapeHtml(thumbSrc)}" alt="앨범커버" onerror="this.onerror=null;this.src='https://placehold.co/100x100/333/fff?text=♪'">
            <div class="workmusic-play-overlay">
              ${isActive && window.workMusicIsPlaying ? workMusicPauseSvg : workMusicPlaySvg}
            </div>
            <div class="workmusic-music-info">
              <div class="workmusic-music-title">${escapeHtml(title)}</div>
              <div class="workmusic-music-artist">${escapeHtml(artist || 'YouTube Music')}</div>
            </div>
            ${playbackErrorBadge}
            ${durationText ? `<div class="workmusic-duration-badge">${escapeHtml(durationText)}</div>` : ''}
            <div class="workmusic-actions">
              <button class="workmusic-small-btn" data-action="settings" data-index="${idx}" title="설정" aria-label="설정">
                ${workMusicSettingsSvg}
              </button>
            </div>`;
      } else {
        row.innerHTML = `
            <img class="workmusic-thumb" src="${escapeHtml(thumbSrc)}" alt="썸네일" onerror="this.onerror=null;this.src='https://placehold.co/320x180/333/fff?text=YouTube'">
            <div class="workmusic-play-overlay">
              ${isActive && window.workMusicIsPlaying ? workMusicPauseSvg : workMusicPlaySvg}
            </div>
            <div class="workmusic-title-overlay">${escapeHtml(title)}</div>
            ${playbackErrorBadge}
            ${durationText ? `<div class="workmusic-duration-badge">${escapeHtml(durationText)}</div>` : ''}
            <div class="workmusic-actions">
              <button class="workmusic-small-btn" data-action="settings" data-index="${idx}" title="설정" aria-label="설정">
                ${workMusicSettingsSvg}
              </button>
            </div>`;
      }
      row.addEventListener('click', () => {
        if (isActive) toggleWorkMusicPlay();
        else playWorkMusicAt(idx);
      });
      workMusicList.appendChild(row);
    });
    workMusicList.querySelectorAll('button[data-action="settings"]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openWorkMusicSettings(Number(e.currentTarget.dataset.index));
      };
    });
  }

  function openWorkMusicSettings(index) {
    const songs = getActiveWorkMusicSongs();
    const song = songs[index];
    if (!song) return;
    window.currentWorkMusicSettingIndex = index;
    if (workMusicTitleInput) workMusicTitleInput.value = song.title || '';
    if (workMusicSettingsModal) workMusicSettingsModal.style.display = 'flex';
    setTimeout(() => {
      workMusicTitleInput?.focus();
      workMusicTitleInput?.select();
    }, 50);
  }

  function closeWorkMusicSettings() {
    window.currentWorkMusicSettingIndex = null;
    if (workMusicSettingsModal) workMusicSettingsModal.style.display = 'none';
  }

  async function saveWorkMusicTitle() {
    if (!window.ensureLogin || !window.ensureLogin()) return;
    const idx = Number(window.currentWorkMusicSettingIndex);
    const songs = getActiveWorkMusicSongs();
    if (!songs[idx]) return;
    const nextTitle = (workMusicTitleInput?.value || '').trim() || `YouTube ${songs[idx].videoId}`;
    if (songs[idx].title === nextTitle && songs[idx].autoTitle === false) return;
    songs[idx].title = nextTitle;
    songs[idx].autoTitle = false;
    await window.cloudSaveWorkMusic?.();
    renderWorkMusic();
  }

  async function deleteCurrentWorkMusic() {
    if (confirm('이 영상을 삭제할까요?') !== true) return;
    if (!window.ensureLogin || !window.ensureLogin()) return;
    const idx = Number(window.currentWorkMusicSettingIndex);
    const songs = getActiveWorkMusicSongs();
    if (!songs[idx]) return;
    const deletingCurrent = idx === Number(window.workMusicCurrentIndex || 0);
    const deleteId = songs[idx].id;
    window.workMusicSongs = (window.workMusicSongs || []).filter((s) => s.id !== deleteId);
    resetWorkMusicDisplayShuffle(getActiveWorkMusicTabId());
    const nextSongs = getActiveWorkMusicSongs();
    if (window.workMusicCurrentIndex >= nextSongs.length)
      window.workMusicCurrentIndex = Math.max(0, nextSongs.length - 1);
    if (deletingCurrent) window.workMusicIsPlaying = false;
    await window.cloudSaveWorkMusic?.();
    closeWorkMusicSettings();
    renderWorkMusic();
    renderWorkMusicIframe(window.workMusicCurrentIndex || 0, false);
    showFeedbackMessage('삭제했습니다.');
  }

  async function openCurrentWorkMusicOnYoutube() {
    await saveWorkMusicTitle();
    const idx = Number(window.currentWorkMusicSettingIndex);
    const song = getActiveWorkMusicSongs()[idx];
    const videoId = song?.videoId || extractYoutubeVideoId(song?.url);
    const url = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '';
    if (url) window.open(url, '_blank', 'noopener');
  }

  function extractYoutubePlaylistId(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
      const u = new URL(text.includes('://') ? text : 'https://' + text);
      const list = u.searchParams.get('list');
      if (list && list.length >= 10) return list;
    } catch (_) {
      /* regex fallback */
    }
    const m =
      text.match(/[?&]list=([A-Za-z0-9_-]+)/) || text.match(/(?:playlist\?list=)([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }

  function isYoutubeMusicUrl(raw) {
    try {
      const u = new URL(
        String(raw || '').includes('://') ? String(raw || '') : 'https://' + String(raw || '')
      );
      return u.hostname
        .replace(/^www\./, '')
        .toLowerCase()
        .includes('music.youtube.com');
    } catch (_) {
      return /music\.youtube\.com/i.test(String(raw || ''));
    }
  }

  function cleanYoutubeArtistName(name) {
    return String(name || '')
      .trim()
      .replace(/\s*-\s*Topic$/i, '')
      .replace(/\s*-\s*Official$/i, '')
      .replace(/\s*VEVO$/i, '')
      .trim();
  }

  function getSongArtist(song) {
    const explicit = cleanYoutubeArtistName(
      song?.artist || song?.channelTitle || song?.ownerChannelTitle || ''
    );
    if (explicit) return explicit;
    const title = String(song?.title || '');
    const parts = title.split(/\s[-–—]\s/);
    if (parts.length >= 2) return cleanYoutubeArtistName(parts[0]);
    return '';
  }

  function decodeHtmlEntities(str) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(str || '');
    return textarea.value;
  }

  function extractYtInitialData(html) {
    const text = String(html || '');
    const key = 'ytInitialData';
    let pos = text.indexOf(key);
    if (pos < 0) return null;
    pos = text.indexOf('{', pos);
    if (pos < 0) return null;
    let depth = 0,
      inString = false,
      esc = false;
    for (let i = pos; i < text.length; i++) {
      const ch = text[i];
      if (inString) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(pos, i + 1));
          } catch (_) {
            return null;
          }
        }
      }
    }
    return null;
  }

  function ytText(node) {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.simpleText) return String(node.simpleText);
    if (Array.isArray(node.runs))
      return node.runs
        .map((r) => r.text || '')
        .join('')
        .trim();
    return '';
  }

  function parsePlaylistFeedXml(xmlText, playlistId) {
    const items = [];
    const seen = new Set();
    let playlistTitle = '';
    try {
      const xml = new DOMParser().parseFromString(String(xmlText || ''), 'text/xml');
      const feedTitle = xml.querySelector('feed > title');
      playlistTitle = cleanYoutubeTitle(feedTitle?.textContent || '새 재생목록');
      xml.querySelectorAll('entry').forEach((entry) => {
        const videoId = entry.querySelector('videoId, yt\\:videoId')?.textContent?.trim();
        const title = cleanYoutubeTitle(entry.querySelector('title')?.textContent || '');
        const thumb =
          entry.querySelector('thumbnail, media\\:thumbnail')?.getAttribute('url') || '';
        if (videoId && !seen.has(videoId)) {
          seen.add(videoId);
          items.push({
            videoId,
            title: title || `YouTube ${videoId}`,
            thumbnail: thumb,
            durationText: '',
            durationSeconds: 0
          });
        }
      });
    } catch (err) {
      console.warn('playlist feed parse failed', err);
    }
    return { title: playlistTitle || '새 재생목록', items, playlistId };
  }

  function parsePlaylistFromHtml(html, playlistId) {
    const items = [];
    const seen = new Set();
    let playlistTitle = '';
    const data = extractYtInitialData(html);
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.playlistVideoRenderer) {
        const r = node.playlistVideoRenderer;
        const videoId = r.videoId;
        const title = cleanYoutubeTitle(ytText(r.title));
        const durationText =
          ytText(r.lengthText) ||
          ytText(
            r.thumbnailOverlays?.find?.((o) => o.thumbnailOverlayTimeStatusRenderer)
              ?.thumbnailOverlayTimeStatusRenderer?.text
          );
        const durationSeconds = parseDurationTextToSeconds(durationText);
        const thumb = r.thumbnail?.thumbnails?.slice?.(-1)?.[0]?.url || '';
        if (videoId && !seen.has(videoId)) {
          seen.add(videoId);
          items.push({
            videoId,
            title: title || `YouTube ${videoId}`,
            thumbnail: thumb,
            durationText: durationText || '',
            durationSeconds: durationSeconds || 0
          });
        }
      }
      if (node.videoId && node.title && !node.playlistVideoRenderer) {
        const videoId = node.videoId;
        const title = cleanYoutubeTitle(ytText(node.title));
        if (/^[A-Za-z0-9_-]{11}$/.test(videoId) && !seen.has(videoId)) {
          seen.add(videoId);
          items.push({
            videoId,
            title: title || `YouTube ${videoId}`,
            durationText: '',
            durationSeconds: 0
          });
        }
      }
      if (node.playlistMetadataRenderer?.title && !playlistTitle) {
        playlistTitle = cleanYoutubeTitle(node.playlistMetadataRenderer.title);
      }
      if (node.playlistHeaderRenderer?.title && !playlistTitle) {
        playlistTitle = cleanYoutubeTitle(ytText(node.playlistHeaderRenderer.title));
      }
      if (node.microformatDataRenderer?.title && !playlistTitle) {
        playlistTitle = cleanYoutubeTitle(node.microformatDataRenderer.title);
      }
      for (const v of Object.values(node)) {
        if (v && typeof v === 'object') {
          if (Array.isArray(v)) v.forEach(visit);
          else visit(v);
        }
      }
    };
    if (data) visit(data);

    if (!items.length) {
      const htmlText = String(html || '');
      const re =
        /"playlistVideoRenderer"\s*:\s*\{[\s\S]*?"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"[\s\S]*?"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([\s\S]*?)"/g;
      let m;
      while ((m = re.exec(htmlText))) {
        const videoId = m[1];
        if (seen.has(videoId)) continue;
        seen.add(videoId);
        items.push({
          videoId,
          title:
            cleanYoutubeTitle(decodeHtmlEntities(m[2].replace(/\\u0026/g, '&'))) ||
            `YouTube ${videoId}`,
          durationText: '',
          durationSeconds: 0
        });
      }
    }
    if (!items.length) {
      const htmlText = String(html || '');
      const re = /"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/g;
      let m;
      while ((m = re.exec(htmlText))) {
        const videoId = m[1];
        if (seen.has(videoId)) continue;
        seen.add(videoId);
        items.push({ videoId, title: `YouTube ${videoId}`, durationText: '', durationSeconds: 0 });
      }
    }
    if (!playlistTitle) {
      const og =
        String(html || '').match(
          /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
        ) || String(html || '').match(/<title[^>]*>([^<]+)<\/title>/i);
      if (og)
        playlistTitle = cleanYoutubeTitle(
          decodeHtmlEntities(og[1]).replace(/\s*-\s*YouTube\s*$/i, '')
        );
    }
    return { title: playlistTitle || '새 재생목록', items, playlistId };
  }

  async function fetchTextThroughProxies(targetUrl) {
    const endpoints = [
      { type: 'text', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}` },
      { type: 'json', url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}` },
      {
        type: 'text',
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
      },
      { type: 'text', url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}` }
    ];
    let lastError = '';
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint.url, { cache: 'no-store' });
        if (!res.ok) {
          lastError = `${res.status} ${res.statusText}`;
          continue;
        }
        if (endpoint.type === 'json') {
          const data = await res.json();
          const text = data.contents || data.data || '';
          if (text) return text;
        } else {
          const text = await res.text();
          if (text) return text;
        }
      } catch (err) {
        lastError = err?.message || String(err);
        console.warn('playlist proxy failed', endpoint.url, err);
      }
    }
    console.warn('playlist all proxies failed', targetUrl, lastError);
    return '';
  }

  async function fetchYoutubePlaylistData(playlistId) {
    const cleanId = String(playlistId || '').trim();
    if (!cleanId) return { title: '새 재생목록', items: [], playlistId: cleanId };

    // 1차: YouTube Data API v3. 공개/일부공개 재생목록은 이 방식이 가장 안정적입니다.
    try {
      let playlistTitle = '새 재생목록';
      try {
        const plist = await youtubeApiGet('playlists', {
          part: 'snippet',
          id: cleanId,
          maxResults: 1
        });
        playlistTitle = cleanYoutubeTitle(plist?.items?.[0]?.snippet?.title || playlistTitle);
      } catch (err) {
        console.warn('YouTube API playlist title failed', err);
      }

      const rawItems = [];
      let pageToken = '';
      do {
        const data = await youtubeApiGet('playlistItems', {
          part: 'snippet,contentDetails',
          playlistId: cleanId,
          maxResults: 50,
          pageToken
        });
        (data.items || []).forEach((item) => {
          const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
          const title = cleanYoutubeTitle(item?.snippet?.title || '');
          // 삭제/비공개 영상은 제목이 이런 식으로 내려올 수 있으므로 제외
          if (!videoId || /^Deleted video$/i.test(title) || /^Private video$/i.test(title)) return;
          rawItems.push({
            videoId,
            title: title || `YouTube ${videoId}`,
            ownerChannelTitle: cleanYoutubeArtistName(
              item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || ''
            )
          });
        });
        pageToken = data.nextPageToken || '';
      } while (pageToken);

      if (rawItems.length) {
        const meta = await fetchYoutubeVideosMeta(rawItems.map((v) => v.videoId)).catch((err) => {
          console.warn('YouTube API videos meta failed', err);
          return {};
        });
        const seen = new Set();
        const items = rawItems
          .filter((v) => {
            if (seen.has(v.videoId)) return false;
            seen.add(v.videoId);
            return true;
          })
          .map((v) => ({
            videoId: v.videoId,
            title: meta[v.videoId]?.title || v.title || `YouTube ${v.videoId}`,
            durationSeconds: meta[v.videoId]?.durationSeconds || 0,
            durationText: meta[v.videoId]?.durationText || '',
            thumbnail: meta[v.videoId]?.thumbnail || '',
            artist: meta[v.videoId]?.artist || v.ownerChannelTitle || '',
            channelTitle: meta[v.videoId]?.channelTitle || v.ownerChannelTitle || ''
          }));
        return { title: playlistTitle || '새 재생목록', items, playlistId: cleanId };
      }
    } catch (err) {
      console.warn('YouTube API playlist failed. fallback start:', err);
    }

    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(cleanId)}`;
    const playlistUrl = `https://www.youtube.com/playlist?list=${encodeURIComponent(cleanId)}`;
    const musicPlaylistUrl = `https://music.youtube.com/playlist?list=${encodeURIComponent(cleanId)}`;

    // 2차: YouTube 공식 RSS 피드.
    const feedText = await fetchTextThroughProxies(feedUrl);
    if (feedText) {
      const parsedFeed = parsePlaylistFeedXml(feedText, cleanId);
      if (parsedFeed.items.length) return parsedFeed;
    }

    // 3차: 일반 YouTube 재생목록 페이지 HTML 파싱.
    const html = await fetchTextThroughProxies(playlistUrl);
    if (html) {
      const parsed = parsePlaylistFromHtml(html, cleanId);
      if (parsed.items.length) return parsed;
    }

    // 4차: YouTube Music 재생목록 페이지 HTML 파싱.
    const musicHtml = await fetchTextThroughProxies(musicPlaylistUrl);
    if (musicHtml) {
      const parsedMusic = parsePlaylistFromHtml(musicHtml, cleanId);
      if (parsedMusic.items.length) return parsedMusic;
    }

    return { title: '새 재생목록', items: [], playlistId: cleanId };
  }

  async function importWorkMusicPlaylistFromLink(raw) {
    if (!window.ensureLogin || !window.ensureLogin()) return;
    const playlistId = extractYoutubePlaylistId(raw);
    if (!playlistId) {
      showAlert('유튜브/유튜브뮤직 재생목록 링크를 넣어주세요.');
      return;
    }
    showFeedbackMessage('재생목록을 불러오는 중입니다...');
    const data = await fetchYoutubePlaylistData(playlistId);
    const playlistSourceType = isYoutubeMusicUrl(raw)
      ? 'youtube-music-playlist'
      : 'youtube-playlist';
    if (!data.items.length) {
      showAlert('재생목록을 읽지 못했습니다. 공개 재생목록인지 확인해주세요.');
      return;
    }
    ensureWorkMusicDefaultTabs();
    const tabs = getWorkMusicTabs();
    const id = 'wtab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const order = tabs.length ? Math.max(...tabs.map((t) => Number(t.order || 0))) + 10 : 0;
    const tabName = (data.title || '새 재생목록').trim().slice(0, 20) || '새 재생목록';
    window.__workMusicTabList = [
      ...tabs,
      {
        id,
        name: tabName,
        order,
        sourcePlaylistId: data.playlistId,
        sourceType: playlistSourceType
      }
    ];
    window.__workMusicActiveTabId = id;
    resetWorkMusicDisplayShuffle(id);
    const existingIds = new Set(
      (window.workMusicSongs || []).map((s) => `${s.workMusicTabId || 'default'}:${s.videoId}`)
    );
    const now = Date.now();
    const newSongs = data.items
      .filter((item) => item.videoId && !existingIds.has(`${id}:${item.videoId}`))
      .map((item, idx) => ({
        id: now + idx,
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        videoId: item.videoId,
        title: item.title || `YouTube ${item.videoId}`,
        artist: item.artist || item.channelTitle || '',
        channelTitle: item.channelTitle || item.artist || '',
        thumbnail: item.thumbnail || '',
        autoTitle: false,
        durationText: item.durationText || formatWorkMusicDuration(item.durationSeconds),
        durationSeconds: item.durationSeconds || 0,
        addedAt: now + idx,
        workMusicTabId: id,
        sourcePlaylistId: data.playlistId,
        sourceType: playlistSourceType
      }));
    window.workMusicSongs = [...(window.workMusicSongs || []), ...newSongs];
    window.workMusicCurrentIndex = 0;
    window.workMusicIsPlaying = false;
    renderWorkMusicAll();
    renderWorkMusicIframe(getWorkMusicInitialDisplayIndex(), false);
    await window.cloudSaveWorkMusic?.();
    showFeedbackMessage(`${tabName} 탭에 ${newSongs.length}개를 추가했습니다.`);
  }

  async function addWorkMusicFromText(raw) {
    if (!window.ensureLogin || !window.ensureLogin()) return false;
    if (extractYoutubePlaylistId(raw)) {
      await importWorkMusicPlaylistFromLink(raw);
      return true;
    }
    const videoId = extractYoutubeVideoId(raw);
    if (!videoId) {
      showAlert('유튜브 링크만 추가할 수 있습니다.');
      return false;
    }
    window.workMusicSongs = window.workMusicSongs || [];
    const url = normalizeYoutubeUrl(raw);
    const activeTabId = getActiveWorkMusicTabId();
    if (getActiveWorkMusicSongs().some((s) => s.videoId === videoId)) {
      showFeedbackMessage('현재 탭에 이미 추가된 영상입니다.');
      return false;
    }
    let meta = {};
    try {
      meta = await fetchYoutubeVideosMeta([videoId]);
    } catch (_) {
      meta = {};
    }
    const fetchedTitle = meta[videoId]?.title || (await fetchYoutubeTitle(url));
    const durationSeconds = meta[videoId]?.durationSeconds || (await fetchYoutubeDuration(videoId));
    const activeTab = getWorkMusicTabs().find((t) => t.id === activeTabId);
    const sourceType =
      isYoutubeMusicUrl(raw) || String(activeTab?.sourceType || '').includes('music')
        ? 'youtube-music'
        : 'youtube';
    window.workMusicSongs.push({
      id: Date.now(),
      url,
      videoId,
      title: fetchedTitle || `제목 불러오기 실패`,
      artist: meta[videoId]?.artist || '',
      channelTitle: meta[videoId]?.channelTitle || '',
      thumbnail: meta[videoId]?.thumbnail || '',
      autoTitle: !fetchedTitle,
      durationSeconds: durationSeconds || 0,
      durationText: formatWorkMusicDuration(durationSeconds),
      addedAt: Date.now(),
      workMusicTabId: activeTabId,
      sourceType
    });
    resetWorkMusicDisplayShuffle(activeTabId);
    await window.cloudSaveWorkMusic?.();
    renderWorkMusic();
    return true;
  }

  async function addWorkMusicFromClipboard() {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) {
        showAlert('클립보드에 유튜브 링크가 없습니다.');
        return;
      }
      await addWorkMusicFromText(t);
    } catch (err) {
      console.error(err);
      showAlert('클립보드 권한을 허용하거나, + 영역을 선택한 뒤 Ctrl/Cmd+V로 붙여넣어주세요.');
    }
  }

  function renderWorkMusicTabsUI() {
    if (!workMusicTabsContainer) return;
    const tabs = getWorkMusicTabs();
    if (!tabs.some((t) => t.id === window.__workMusicActiveTabId))
      window.__workMusicActiveTabId = tabs[0]?.id || 'default';
    workMusicTabsContainer.innerHTML =
      tabs
        .map((t) => {
          const playlistId = getWorkMusicTabPlaylistId(t.id);
          const mark = playlistId
            ? `<span class="playlist-mark" title="재생목록 탭">${workMusicPlaylistMarkSvg}</span>`
            : '';
          return renderManagedTab({
            className: 'workmusic-tab',
            id: t.id,
            label: t.name || '탭',
            active: t.id === window.__workMusicActiveTabId,
            prefix: mark
          });
        })
        .join('') + renderManagedTab({ className: 'workmusic-tab', newTab: true });
  }

  function renderWorkMusicAll() {
    renderWorkMusicTabsUI();
    renderWorkMusic();
  }
  window.renderWorkMusicTabsUI = renderWorkMusicTabsUI;
  window.renderWorkMusicAll = renderWorkMusicAll;

  async function switchWorkMusicTab(tabId) {
    window.__workMusicActiveTabId = tabId || 'default';
    window.workMusicCurrentIndex = 0;
    window.workMusicIsPlaying = false;
    await window.cloudSetActiveWorkMusicTab?.(window.__workMusicActiveTabId);
    renderWorkMusicAll();
    renderWorkMusicIframe(getWorkMusicInitialDisplayIndex(), false);
  }

  function backupWorkMusicTab(tabId) {
    const tab = getWorkMusicTabs().find((t) => t.id === tabId);
    if (!tab) return;
    const songs = (window.workMusicSongs || []).filter(
      (s) => (s.workMusicTabId || 'default') === tabId
    );
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const safeName =
      String(tab.name || 'workmusic')
        .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
        .trim() || 'workmusic';
    downloadTextFile(
      `${safeName}_workmusic_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.json`,
      JSON.stringify({ tab, songs, exportedAt: now.toISOString() }, null, 2),
      'application/json;charset=utf-8'
    );
    showFeedbackMessage('노동요 탭을 백업했습니다.');
  }

  function openWorkMusicTabSettings(tabId) {
    const tab = getWorkMusicTabs().find((t) => t.id === tabId);
    if (!tab) return;
    const playlistId = getWorkMusicTabPlaylistId(tabId);
    openTabSettings({
      title: '노동요 탭 설정',
      tab,
      getTabs: getWorkMusicTabs,
      onSave: async (id, name) => {
        await window.cloudRenameWorkMusicTab?.(id, name);
      },
      onDelete: async (id) => {
        await window.cloudDeleteWorkMusicTab?.(id);
      },
      onBackup: async (id) => backupWorkMusicTab(id),
      onRefresh: playlistId ? async (id) => refreshWorkMusicPlaylistTab(id) : null,
      onReorder: async (next) => {
        await window.cloudReorderWorkMusicTabs?.(next);
      }
    });
  }

  function openWorkMusicTabCreate() {
    openTabSettings({
      title: '노동요 새 탭',
      create: true,
      defaultName: '새 탭',
      getTabs: getWorkMusicTabs,
      onCreate: async (name) => {
        if (!window.ensureLogin || !window.ensureLogin()) return;
        ensureWorkMusicDefaultTabs();
        const id = 'wtab_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
        const tabs = getWorkMusicTabs();
        const order = tabs.length ? Math.max(...tabs.map((t) => Number(t.order || 0))) + 10 : 0;
        window.__workMusicTabList = [...tabs, { id, name, order }];
        window.__workMusicActiveTabId = id;
        window.workMusicCurrentIndex = 0;
        window.workMusicIsPlaying = false;
        renderWorkMusicAll();
        await window.cloudAddWorkMusicTab?.({ id, name, order });
      }
    });
  }

  async function refreshWorkMusicPlaylistTab(tabId) {
    if (!window.ensureLogin || !window.ensureLogin()) return;
    const playlistId = getWorkMusicTabPlaylistId(tabId);
    if (!playlistId) {
      showFeedbackMessage('재생목록으로 만든 탭만 새로고침할 수 있습니다.');
      return;
    }
    const tab = getWorkMusicTabs().find((t) => t.id === tabId);
    const playlistSourceType = tab?.sourceType || 'youtube-playlist';
    showFeedbackMessage('재생목록을 새로고침 중입니다...');
    const data = await fetchYoutubePlaylistData(playlistId);
    if (!data.items.length) {
      showAlert('재생목록을 다시 읽지 못했습니다.');
      return;
    }
    const oldSongs = (window.workMusicSongs || []).filter(
      (s) => (s.workMusicTabId || 'default') === tabId
    );
    const oldMap = new Map(oldSongs.map((s) => [s.videoId, s]));
    const now = Date.now();
    const nextSongsForTab = data.items.map((item, idx) => {
      const old = oldMap.get(item.videoId);
      const keepManualTitle =
        old && old.autoTitle === false && old.title && old.title !== `YouTube ${old.videoId}`;
      return {
        ...(old || {}),
        id: old?.id || now + idx,
        url: `https://www.youtube.com/watch?v=${item.videoId}`,
        videoId: item.videoId,
        title: keepManualTitle ? old.title : item.title || old?.title || `YouTube ${item.videoId}`,
        artist: item.artist || item.channelTitle || old?.artist || old?.channelTitle || '',
        channelTitle: item.channelTitle || item.artist || old?.channelTitle || old?.artist || '',
        thumbnail: item.thumbnail || old?.thumbnail || '',
        autoTitle: keepManualTitle ? false : false,
        durationText:
          item.durationText ||
          formatWorkMusicDuration(item.durationSeconds) ||
          old?.durationText ||
          '',
        durationSeconds: item.durationSeconds || old?.durationSeconds || 0,
        addedAt: old?.addedAt || now + idx,
        workMusicTabId: tabId,
        sourcePlaylistId: data.playlistId || playlistId,
        sourceType: playlistSourceType
      };
    });
    window.workMusicSongs = [
      ...(window.workMusicSongs || []).filter((s) => (s.workMusicTabId || 'default') !== tabId),
      ...nextSongsForTab
    ];
    resetWorkMusicDisplayShuffle(tabId);
    window.__workMusicTabList = getWorkMusicTabs().map((t) =>
      t.id === tabId
        ? { ...t, sourcePlaylistId: data.playlistId || playlistId, sourceType: playlistSourceType }
        : t
    );
    if (window.__workMusicActiveTabId !== tabId) window.__workMusicActiveTabId = tabId;
    window.workMusicCurrentIndex = 0;
    window.workMusicIsPlaying = false;
    renderWorkMusicAll();
    renderWorkMusicIframe(getWorkMusicInitialDisplayIndex(), false);
    await window.cloudSaveWorkMusic?.();
    showFeedbackMessage(
      `${tab?.name || data.title || '재생목록'} 새로고침 완료: ${nextSongsForTab.length}개`
    );
  }

  function initializeWorkMusic() {
    ensureWorkMusicDefaultTabs();
    renderWorkMusicAll();
    setTimeout(persistWorkMusicDefaultTabsIfNeeded, 300);
    setTimeout(fillMissingWorkMusicTitles, 600);
    setTimeout(fillMissingWorkMusicDurations, 1200);
    workMusicTabsContainer?.addEventListener('click', async (e) => {
      const settingsBtn = e.target.closest('[data-action="tab-settings"]');
      if (settingsBtn) {
        e.preventDefault();
        e.stopPropagation();
        const tabBtn = settingsBtn.closest('.workmusic-tab');
        if (tabBtn?.dataset.tabId) openWorkMusicTabSettings(tabBtn.dataset.tabId);
        return;
      }
      if (e.target.closest('[data-action="new-tab"]')) {
        openWorkMusicTabCreate();
        return;
      }
      const tabBtn = e.target.closest('.workmusic-tab');
      if (!tabBtn) return;
      const tabId = tabBtn.dataset.tabId;
      await switchWorkMusicTab(tabId);
    });
    let workMusicDraggingEl = null,
      workMusicPlaceholderEl = null;
    function ensureWorkMusicPlaceholder(width) {
      if (workMusicPlaceholderEl) return;
      workMusicPlaceholderEl = document.createElement('div');
      workMusicPlaceholderEl.className = 'workmusic-tab placeholder';
      workMusicPlaceholderEl.style.width = (width || 80) + 'px';
      workMusicPlaceholderEl.style.height = '32px';
      workMusicPlaceholderEl.style.border = '1px dashed rgba(255,255,255,.25)';
      workMusicPlaceholderEl.style.background = 'transparent';
    }
    function getWorkMusicDragAfterElement(container, x) {
      const els = [
        ...container.querySelectorAll('.workmusic-tab:not(.dragging):not(.placeholder)')
      ];
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      for (const child of els) {
        const box = child.getBoundingClientRect();
        const offset = x - (box.left + box.width / 2);
        if (offset < 0 && offset > closest.offset) closest = { offset, element: child };
      }
      return closest.element;
    }
    workMusicTabsContainer?.addEventListener('dragstart', (e) => {
      if (!window.__workMusicEditMode) return;
      const tabBtn = e.target.closest('.workmusic-tab');
      if (!tabBtn) return;
      workMusicDraggingEl = tabBtn;
      workMusicDraggingEl.classList.add('dragging');
      ensureWorkMusicPlaceholder(tabBtn.getBoundingClientRect().width);
      workMusicPlaceholderEl.style.width = tabBtn.getBoundingClientRect().width + 'px';
      tabBtn.after(workMusicPlaceholderEl);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    });
    workMusicTabsContainer?.addEventListener('dragover', (e) => {
      if (!window.__workMusicEditMode || !workMusicDraggingEl) return;
      e.preventDefault();
      const afterEl = getWorkMusicDragAfterElement(workMusicTabsContainer, e.clientX);
      if (!afterEl) workMusicTabsContainer.appendChild(workMusicPlaceholderEl);
      else workMusicTabsContainer.insertBefore(workMusicPlaceholderEl, afterEl);
    });
    async function finalizeWorkMusicTabReorder() {
      if (!workMusicDraggingEl || !workMusicPlaceholderEl) return;
      workMusicPlaceholderEl.replaceWith(workMusicDraggingEl);
      workMusicDraggingEl.classList.remove('dragging');
      const ids = [...workMusicTabsContainer.querySelectorAll('.workmusic-tab')]
        .filter((el) => !el.classList.contains('placeholder'))
        .map((el) => el.dataset.tabId)
        .filter(Boolean);
      const map = new Map(getWorkMusicTabs().map((t) => [t.id, t]));
      const next = ids.map((id, i) => ({ ...map.get(id), order: i * 10 })).filter(Boolean);
      await window.cloudReorderWorkMusicTabs?.(next);
      workMusicDraggingEl = null;
      workMusicPlaceholderEl = null;
    }
    workMusicTabsContainer?.addEventListener('drop', async (e) => {
      if (!window.__workMusicEditMode) return;
      e.preventDefault();
      await finalizeWorkMusicTabReorder();
    });
    workMusicTabsContainer?.addEventListener('dragend', async () => {
      if (window.__workMusicEditMode && workMusicPlaceholderEl && workMusicDraggingEl)
        await finalizeWorkMusicTabReorder();
    });

    workMusicDragArea?.addEventListener('click', addWorkMusicFromClipboard);
    workMusicDragArea?.addEventListener('paste', async (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain') || '';
      await addWorkMusicFromText(text);
    });
    workMusicDragArea?.addEventListener('dragover', (e) => {
      e.preventDefault();
      workMusicDragArea.classList.add('active');
    });
    workMusicDragArea?.addEventListener('dragleave', () =>
      workMusicDragArea.classList.remove('active')
    );
    workMusicDragArea?.addEventListener('drop', async (e) => {
      e.preventDefault();
      workMusicDragArea.classList.remove('active');
      const text =
        e.dataTransfer?.getData('text/plain') || e.dataTransfer?.getData('text/uri-list') || '';
      await addWorkMusicFromText(text);
    });
    workMusicPlayBtn?.addEventListener('click', toggleWorkMusicPlay);
    workMusicPrevBtn?.addEventListener('click', () => playWorkMusicAt(getWorkMusicNextIndex(-1)));
    workMusicNextBtn?.addEventListener('click', () => playWorkMusicAt(getWorkMusicNextIndex(1)));
    workMusicRemotePlayBtn?.addEventListener('click', toggleWorkMusicPlay);
    workMusicRemotePrevBtn?.addEventListener('click', () =>
      playWorkMusicAt(getWorkMusicNextIndex(-1))
    );
    workMusicRemoteNextBtn?.addEventListener('click', () =>
      playWorkMusicAt(getWorkMusicNextIndex(1))
    );
    workMusicRemoteInfo?.addEventListener('click', () => showTab('workmusic'));
    workMusicModeBtn?.addEventListener('click', async () => {
      window.workMusicMode = window.workMusicMode === 'random' ? 'sequential' : 'random';
      resetWorkMusicDisplayShuffle();
      await window.cloudSaveWorkMusic?.();
      renderWorkMusic();
      if (getActiveWorkMusicSongs().length)
        renderWorkMusicIframe(window.workMusicCurrentIndex || 0, window.workMusicIsPlaying);
    });
    workMusicMuteBtn?.addEventListener('click', toggleWorkMusicMute);
    workMusicRemoteMuteBtn?.addEventListener('click', toggleWorkMusicMute);
    workMusicVolumeRange?.addEventListener('input', async (e) => {
      await setWorkMusicVolume(Number(e.target.value || 0));
    });
    workMusicRemoteVolumeRange?.addEventListener('input', async (e) => {
      await setWorkMusicVolume(Number(e.target.value || 0));
    });
    const handleWorkMusicVolumeKey = async (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 5 : -5;
      const base = window.workMusicIsMuted ? 0 : Number(window.workMusicVolume || 0);
      await setWorkMusicVolume(base + delta);
    };
    workMusicVolumeRange?.addEventListener('keydown', handleWorkMusicVolumeKey);
    workMusicRemoteVolumeRange?.addEventListener('keydown', handleWorkMusicVolumeKey);
    workMusicSaveTitleBtn?.addEventListener('click', saveWorkMusicTitle);
    workMusicDeleteBtn?.addEventListener('click', deleteCurrentWorkMusic);
    workMusicOpenYoutubeBtn?.addEventListener('click', openCurrentWorkMusicOnYoutube);
    workMusicCloseSettingsBtn?.addEventListener('click', closeWorkMusicSettings);
    workMusicSettingsModal?.addEventListener('click', async (e) => {
      if (e.target === workMusicSettingsModal) {
        await saveWorkMusicTitle();
        closeWorkMusicSettings();
      }
    });
    workMusicTitleInput?.addEventListener('blur', saveWorkMusicTitle);
    workMusicTitleInput?.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await saveWorkMusicTitle();
        closeWorkMusicSettings();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWorkMusicSettings();
      }
    });
  }

  document.addEventListener('paste', async (e) => {
    const section = document.getElementById('workmusic-section');
    if (!section || !section.classList.contains('active')) return;
    const previewUploadModal = document.getElementById('previewUploadModal');
    if (previewUploadModal && previewUploadModal.style.display === 'flex') return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (extractYoutubeVideoId(text)) {
      e.preventDefault();
      await addWorkMusicFromText(text);
    }
  });

  window.extractYoutubeVideoId = extractYoutubeVideoId;
  window.addWorkMusicFromText = addWorkMusicFromText;
  initializeWorkMusic();
}
