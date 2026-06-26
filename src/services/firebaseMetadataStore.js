function toPlainData(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function createFirebaseMetadataStore({ enabled, config, normalizeTabList, genId }) {
  let firebaseApi = null;
  let firebaseReadyPromise = null;
  let firebaseUser = null;

  function getUid() {
    return firebaseUser?.uid || firebaseApi?.auth?.currentUser?.uid || null;
  }

  function isActive() {
    return !!(firebaseApi?.db && getUid());
  }

  function assertReady() {
    if (enabled && !isActive()) {
      throw new Error(
        'Firebase 연결이 필요합니다. Firebase Authentication/Firestore 설정을 확인해 주세요.'
      );
    }
  }

  function getDocRef(section, id = 'main') {
    const uid = getUid();
    if (!uid) throw new Error('Firebase 로그인이 필요합니다.');
    return firebaseApi.doc(firebaseApi.db, 'users', uid, 'app', `${section}_${id}`);
  }

  function getCollectionRef(name) {
    const uid = getUid();
    if (!uid) throw new Error('Firebase 로그인이 필요합니다.');
    return firebaseApi.collection(firebaseApi.db, 'users', uid, name);
  }

  async function setup() {
    if (!enabled) return false;
    if (firebaseApi) return true;
    if (firebaseReadyPromise) return firebaseReadyPromise;
    firebaseReadyPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
    ])
      .then(([appMod, authMod, firestoreMod]) => {
        const firebaseApp = appMod.initializeApp(config);
        const auth = authMod.getAuth(firebaseApp);
        const db = firestoreMod.getFirestore(firebaseApp);
        firebaseApi = {
          auth,
          db,
          GoogleAuthProvider: authMod.GoogleAuthProvider,
          browserLocalPersistence: authMod.browserLocalPersistence,
          collection: firestoreMod.collection,
          deleteDoc: firestoreMod.deleteDoc,
          doc: firestoreMod.doc,
          getDoc: firestoreMod.getDoc,
          getDocs: firestoreMod.getDocs,
          setDoc: firestoreMod.setDoc,
          signInWithCredential: authMod.signInWithCredential,
          signOut: authMod.signOut,
          writeBatch: firestoreMod.writeBatch
        };
        return authMod
          .setPersistence(auth, authMod.browserLocalPersistence)
          .then(() => {
            firebaseUser = auth.currentUser || null;
            return true;
          })
          .catch(() => true);
      })
      .catch((e) => {
        console.warn('Firebase init skipped', e);
        firebaseApi = null;
        return false;
      });
    return firebaseReadyPromise;
  }

  async function signInWithGoogleToken(accessToken) {
    if (!accessToken || !(await setup())) return null;
    try {
      const credential = firebaseApi.GoogleAuthProvider.credential(null, accessToken);
      const result = await firebaseApi.signInWithCredential(firebaseApi.auth, credential);
      firebaseUser = result.user || firebaseApi.auth.currentUser || null;
      return firebaseUser;
    } catch (e) {
      console.error('Firebase sign-in failed', e);
      firebaseUser = null;
      if (enabled) throw e;
      return null;
    }
  }

  async function signOut() {
    if (!firebaseApi?.auth) return;
    try {
      await firebaseApi.signOut(firebaseApi.auth);
    } catch (e) {
      console.warn('Firebase sign-out skipped', e);
    } finally {
      firebaseUser = null;
    }
  }

  async function getDocument(section, id = 'main') {
    if (!isActive()) return null;
    const snap = await firebaseApi.getDoc(getDocRef(section, id));
    return snap.exists() ? snap.data() : null;
  }

  async function setDocument(section, id, data) {
    if (!isActive()) return false;
    await firebaseApi.setDoc(getDocRef(section, id), toPlainData(data));
    return true;
  }

  async function syncCollection(name, rows, getId) {
    if (!isActive()) return false;
    const collectionRef = getCollectionRef(name);
    const existing = await firebaseApi.getDocs(collectionRef);
    const nextIds = new Set(rows.map(getId).filter(Boolean));
    let batch = firebaseApi.writeBatch(firebaseApi.db);
    let count = 0;
    const commitIfNeeded = async () => {
      if (!count) return;
      await batch.commit();
      batch = firebaseApi.writeBatch(firebaseApi.db);
      count = 0;
    };
    for (const row of rows) {
      const id = getId(row);
      if (!id) continue;
      batch.set(firebaseApi.doc(collectionRef, id), toPlainData(row));
      count++;
      if (count >= 450) await commitIfNeeded();
    }
    existing.forEach((snap) => {
      if (!nextIds.has(snap.id)) {
        batch.delete(snap.ref);
        count++;
      }
    });
    await commitIfNeeded();
    return true;
  }

  async function readCollection(name) {
    if (!isActive()) return [];
    const snap = await firebaseApi.getDocs(getCollectionRef(name));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  async function saveNotesPart(notesPart) {
    const tabs = [
      ...normalizeTabList(notesPart?.notesTabList, { id: 'memo', name: '메모', order: 0 })
    ];
    const notes = notesPart?.notesTabs || {};
    await setDocument('notes', 'meta', {
      version: 1,
      updatedAt: notesPart?.updatedAt || new Date().toISOString(),
      notesActiveTabId: notesPart?.notesActiveTabId || tabs[0]?.id || 'memo',
      notesTabList: tabs
    });
    await syncCollection(
      'notesTabs',
      tabs.map((tab) => ({ ...tab, text: notes[tab.id] || '' })),
      (tab) => tab.id
    );
  }

  async function loadNotesPart() {
    const meta = await getDocument('notes', 'meta');
    if (!meta?.notesTabList) return null;
    const rows = await readCollection('notesTabs');
    const textById = Object.fromEntries(rows.map((row) => [row.id, row.text || '']));
    const notesTabList = normalizeTabList(meta.notesTabList, {
      id: 'memo',
      name: '메모',
      order: 0
    });
    const notesTabs = {};
    notesTabList.forEach((tab) => {
      notesTabs[tab.id] = textById[tab.id] || '';
    });
    return {
      notesTabList,
      notesTabs,
      notesActiveTabId: meta.notesActiveTabId || notesTabList[0]?.id || 'memo',
      updatedAt: meta.updatedAt || new Date().toISOString()
    };
  }

  async function saveBookmarksPart(bookmarksPart) {
    const rows = (bookmarksPart?.imageBookmarks || []).map((bookmark) => ({
      ...bookmark,
      id: bookmark.id || genId('bm')
    }));
    await setDocument('bookmarks', 'meta', {
      version: 1,
      updatedAt: bookmarksPart?.updatedAt || new Date().toISOString(),
      bookmarkTabList: bookmarksPart?.bookmarkTabList || [
        { id: 'default', name: '기본', order: 0 }
      ],
      bookmarkActiveTabId: bookmarksPart?.bookmarkActiveTabId || 'default'
    });
    await syncCollection('bookmarks', rows, (bookmark) => bookmark.id);
  }

  async function loadBookmarksPart() {
    const meta = await getDocument('bookmarks', 'meta');
    if (!meta) return null;
    const imageBookmarks = await readCollection('bookmarks');
    return {
      imageBookmarks,
      bookmarkTabList: meta.bookmarkTabList || [{ id: 'default', name: '기본', order: 0 }],
      bookmarkActiveTabId: meta.bookmarkActiveTabId || 'default',
      updatedAt: meta.updatedAt || new Date().toISOString()
    };
  }

  async function saveWorkmusicPart(workmusicPart) {
    const rows = (workmusicPart?.workMusicSongs || []).map((song) => ({
      ...song,
      id: song.id || genId('wm')
    }));
    await setDocument('workmusic', 'meta', {
      version: 1,
      updatedAt: workmusicPart?.updatedAt || new Date().toISOString(),
      workMusicMode: workmusicPart?.workMusicMode || 'sequential',
      workMusicCurrentIndex: Number(workmusicPart?.workMusicCurrentIndex || 0),
      workMusicVolume: Number(workmusicPart?.workMusicVolume ?? 80),
      workMusicLastVolume: Number(workmusicPart?.workMusicLastVolume ?? 80),
      workMusicIsMuted: !!workmusicPart?.workMusicIsMuted,
      workMusicTabList: workmusicPart?.workMusicTabList || [
        { id: 'default', name: '기본', order: 0 }
      ],
      workMusicActiveTabId: workmusicPart?.workMusicActiveTabId || 'default'
    });
    await syncCollection('workmusicSongs', rows, (song) => song.id);
  }

  async function loadWorkmusicPart() {
    const meta = await getDocument('workmusic', 'meta');
    if (!meta) return null;
    return {
      workMusicSongs: await readCollection('workmusicSongs'),
      workMusicMode: meta.workMusicMode || 'sequential',
      workMusicCurrentIndex: Number(meta.workMusicCurrentIndex || 0),
      workMusicVolume: Number(meta.workMusicVolume ?? 80),
      workMusicLastVolume: Number(meta.workMusicLastVolume ?? 80),
      workMusicIsMuted: !!meta.workMusicIsMuted,
      workMusicTabList: meta.workMusicTabList || [{ id: 'default', name: '기본', order: 0 }],
      workMusicActiveTabId: meta.workMusicActiveTabId || 'default',
      updatedAt: meta.updatedAt || new Date().toISOString()
    };
  }

  async function saveAppParts(parts, { notes = true, nonNotes = true } = {}) {
    if (!isActive()) return false;
    const jobs = [];
    if (nonNotes) {
      jobs.push(
        setDocument('calendar', 'main', parts.calendar),
        saveBookmarksPart(parts.bookmarks),
        saveWorkmusicPart(parts.workmusic),
        setDocument('clipviewer', 'main', parts.clipviewer)
      );
    }
    if (notes) jobs.push(saveNotesPart(parts.notes));
    await Promise.all(jobs);
    return true;
  }

  async function loadAppParts({ includeCalendar = true, includeDeferred = true } = {}) {
    if (!isActive()) return null;
    const parts = {};
    if (includeCalendar) parts.calendar = await getDocument('calendar', 'main');
    if (includeDeferred) {
      parts.notes = await loadNotesPart();
      parts.bookmarks = await loadBookmarksPart();
      parts.workmusic = await loadWorkmusicPart();
      parts.clipviewer = await getDocument('clipviewer', 'main');
    }
    return Object.values(parts).some(Boolean) ? parts : null;
  }

  return {
    assertReady,
    getUid,
    isActive,
    loadAppParts,
    saveAppParts,
    signInWithGoogleToken,
    signOut
  };
}
