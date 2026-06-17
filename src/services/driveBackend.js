export function initDriveBackend({ initCalendar, initNotes, initBookmarks, initWorkMusic, initClipViewer }) {
// ===== Inlined main.js : Google Drive backend =====
// 모든 데이터는 로그인한 사용자의 Google Drive 안에 저장됩니다.

    const DRIVE_APP_CONFIG = window.APP_CONFIG || {};
    const DRIVE_CONFIG = DRIVE_APP_CONFIG.drive || {};
    const DRIVE_FOLDERS = DRIVE_CONFIG.folders || {};
    const DRIVE_FILES = DRIVE_CONFIG.files || {};
    const DRIVE_SCOPE = DRIVE_CONFIG.scope || 'https://www.googleapis.com/auth/drive.file';
    const DRIVE_APP_FOLDER = DRIVE_FOLDERS.app || '코믹서포터';
    const DRIVE_SYSTEM_FOLDER = DRIVE_FOLDERS.system || 'system';
    const DRIVE_CALENDAR_FOLDER = DRIVE_FOLDERS.calendar || '달력';
    const DRIVE_NOTES_FOLDER = DRIVE_FOLDERS.notes || '메모';
    const DRIVE_BOOKMARKS_FOLDER = DRIVE_FOLDERS.bookmarks || '북마크';
    const DRIVE_BOOKMARK_IMAGES_FOLDER = DRIVE_FOLDERS.bookmarkImages || ''; // 북마크 이미지 중간 폴더 사용 안 함
    const DRIVE_WORKMUSIC_FOLDER = DRIVE_FOLDERS.workmusic || '노동요';
    const DRIVE_CLIP_FOLDER = DRIVE_FOLDERS.clipviewer || '클립뷰어';
    const DRIVE_CLIP_CURRENT_FOLDER = DRIVE_FOLDERS.clipCurrent || 'current';
    const DRIVE_CALENDAR_FILE = DRIVE_FILES.calendar || 'calendar.json';
    const DRIVE_NOTES_FILE = DRIVE_FILES.notes || 'notes-index.json';
    const DRIVE_OLD_NOTES_FILE = DRIVE_FILES.oldNotes || 'notes.json';
    const DRIVE_BOOKMARKS_FILE = DRIVE_FILES.bookmarks || 'bookmarks.json';
    const DRIVE_WORKMUSIC_FILE = DRIVE_FILES.workmusic || 'workmusic.json';
    const DRIVE_CLIP_FILE = DRIVE_FILES.clipviewer || 'clipviewer.json';
    const DEFAULT_GOOGLE_CLIENT_ID = DRIVE_APP_CONFIG.googleClientId || '';

    const signInBtn=document.getElementById('signInBtn');
    const signOutBtn=document.getElementById('signOutBtn');
    const userInfoEl=document.getElementById('userInfo');
    const loadingOverlay=document.getElementById('loading-overlay');
    const driveSaveIndicator=document.getElementById('driveSaveIndicator');

    let googleTokenClient=null;
    let driveAccessToken=null;
    let driveUser=null;
    let driveReady=false;
    let driveFolders=null;
    let appDataFileId=null;
    let driveSaveTimer=null;
    let driveImageUrlCache=new Map();
    window.__unsubs=[];

    function getGoogleClientId(){
      return DEFAULT_GOOGLE_CLIENT_ID;
    }

    function nowMs(){ return Date.now(); }
    function driveTimestamp(ms){ return { toMillis:()=>Number(ms||0) }; }
    function genId(prefix='id'){ return prefix+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8); }

    let driveStatusTimer=null;
    function setDriveStatus(text, autoHide=true){
      if(!driveSaveIndicator) return;
      driveSaveIndicator.textContent=text;
      driveSaveIndicator.classList.add('show');
      clearTimeout(driveStatusTimer);
      if(autoHide){
        driveStatusTimer=setTimeout(()=>driveSaveIndicator.classList.remove('show'),1800);
      }
    }
    function setDriveBusy(text){ setDriveStatus(text,false); }
    function hideDriveStatus(){ if(driveSaveIndicator) driveSaveIndicator.classList.remove('show'); }

    function getDefaultAppData(){
      return {
        version:1,
        updatedAt:new Date().toISOString(),
        customTasks:[],
        imageBookmarks:[],
        state:{
          taskStatus:{},
          notesTabList:[{id:'memo',name:'메모',order:0}],
          notesTabs:{},
          notesActiveTabId:'memo',
          bookmarkTabList:[{id:'default',name:'기본',order:0}],
          bookmarkActiveTabId:'default',
          workMusicSongs:[],
          workMusicMode:'sequential',
          workMusicCurrentIndex:0,
          workMusicVolume:80,
          workMusicLastVolume:80,
          workMusicIsMuted:false,
          workMusicTabList:[{id:'default',name:'기본',order:0}],
          workMusicActiveTabId:'default',
          clipPages:[]
        }
      };
    }

    let currentAppData=getDefaultAppData();

    function collectState(){
      return {
        taskStatus: window.taskStatus || {},
        notesTabList: window.__notesTabList || [{id:'memo',name:'메모',order:0}],
        notesTabs: window.__notesTabs || {},
        notesActiveTabId: window.__notesActiveTabId || 'memo',
        bookmarkTabList: window.__bookmarkTabList || [{id:'default',name:'기본',order:0}],
        bookmarkActiveTabId: window.__bookmarkActiveTabId || 'default',
        workMusicSongs: window.workMusicSongs || [],
        workMusicMode: window.workMusicMode || 'sequential',
        workMusicCurrentIndex: Number(window.workMusicCurrentIndex || 0),
        workMusicVolume: Number(window.workMusicVolume ?? 80),
        workMusicLastVolume: Number(window.workMusicLastVolume ?? 80),
        workMusicIsMuted: !!window.workMusicIsMuted,
        workMusicTabList: window.__workMusicTabList || [{id:'default',name:'기본',order:0}],
        workMusicActiveTabId: window.__workMusicActiveTabId || 'default',
        clipPages: (currentAppData.state && currentAppData.state.clipPages) || []
      };
    }

    function serializableBookmarks(){
      return (window.imageBookmarks||[]).map(b=>{
        const copy={...b};
        if(copy.driveFileId){
          copy.url=null;
        }
        if(copy.previewDriveFileId){ copy.previewImageUrl=null; }
        if(copy.timestamp?.toMillis){ copy.timestampMs=copy.timestamp.toMillis(); delete copy.timestamp; }
        return copy;
      });
    }

    function buildAppData(){
      return {
        version:1,
        updatedAt:new Date().toISOString(),
        customTasks: window.customTasks || [],
        imageBookmarks: serializableBookmarks(),
        state: collectState()
      };
    }

    function applyAppData(data){
      currentAppData = data && typeof data==='object' ? data : getDefaultAppData();
      const st=currentAppData.state || {};
      window.customTasks = Array.isArray(currentAppData.customTasks) ? currentAppData.customTasks : [];
      window.taskStatus = st.taskStatus || {};
      window.__notesTabList = Array.isArray(st.notesTabList)&&st.notesTabList.length ? st.notesTabList : [{id:'memo',name:'메모',order:0}];
      window.__notesTabs = st.notesTabs || {};
      window.__notesActiveTabId = st.notesActiveTabId || 'memo';
      window.__bookmarkTabList = Array.isArray(st.bookmarkTabList)&&st.bookmarkTabList.length ? st.bookmarkTabList : [{id:'default',name:'기본',order:0}];
      window.__bookmarkActiveTabId = st.bookmarkActiveTabId || 'default';
      window.workMusicSongs = Array.isArray(st.workMusicSongs) ? st.workMusicSongs : [];
      window.__workMusicTabList = Array.isArray(st.workMusicTabList)&&st.workMusicTabList.length ? st.workMusicTabList : [{id:'default',name:'기본',order:0}];
      window.__workMusicActiveTabId = st.workMusicActiveTabId || 'default';
      window.workMusicMode = st.workMusicMode || 'sequential';
      window.workMusicCurrentIndex = Number(st.workMusicCurrentIndex || 0);
      window.workMusicVolume = Number(st.workMusicVolume ?? 80);
      window.workMusicLastVolume = Number(st.workMusicLastVolume ?? 80);
      window.workMusicIsMuted = !!st.workMusicIsMuted;
      window.imageBookmarks = (Array.isArray(currentAppData.imageBookmarks)?currentAppData.imageBookmarks:[]).map(b=>({
        ...b,
        timestamp: driveTimestamp(b.timestampMs || Date.parse(b.timestamp || '') || 0)
      }));
    }

    function renderEverything(){
      if(typeof window.renderCalendar==='function') window.renderCalendar();
      if(typeof window.renderImageBookmarks==='function') window.renderImageBookmarks();
      if(typeof window.renderWorkMusicAll==='function') window.renderWorkMusicAll();
      if(typeof window.renderNotesUI==='function') window.renderNotesUI();
      if(typeof window.renderBookmarkTabsUI==='function') window.renderBookmarkTabsUI();
    }

    async function waitForGoogle(){
      for(let i=0;i<80;i++){
        if(window.google?.accounts?.oauth2) return true;
        await new Promise(r=>setTimeout(r,100));
      }
      return false;
    }

    async function setupTokenClient(){
      const clientId=getGoogleClientId();
      if(!clientId) return false;
      const ok=await waitForGoogle();
      if(!ok){ window.showAlert('Google 로그인 스크립트를 불러오지 못했습니다.'); return false; }
      googleTokenClient=google.accounts.oauth2.initTokenClient({
        client_id:clientId,
        scope:DRIVE_SCOPE,
        callback:async(resp)=>{
          if(resp?.access_token){
            driveAccessToken=resp.access_token;
            await afterGoogleLogin();
          }else{
            window.showAlert('구글 로그인에 실패했습니다.');
          }
        }
      });
      return true;
    }

    async function doSignIn(){
      if(!googleTokenClient){
        const ok=await setupTokenClient();
        if(!ok) return;
      }
      googleTokenClient.requestAccessToken({prompt: driveAccessToken ? '' : 'consent'});
    }

    async function driveFetch(url, options={}){
      if(!driveAccessToken) throw new Error('구글 로그인이 필요합니다.');
      const headers=new Headers(options.headers||{});
      headers.set('Authorization','Bearer '+driveAccessToken);
      const res=await fetch(url,{...options,headers});
      if(res.status===401){ driveAccessToken=null; throw new Error('Google 인증이 만료되었습니다. 다시 로그인하세요.'); }
      if(!res.ok){ throw new Error(await res.text() || ('Drive API 오류 '+res.status)); }
      return res;
    }

    async function getUserProfile(){
      try{
        return await driveFetch('https://www.googleapis.com/oauth2/v3/userinfo').then(r=>r.json());
      }catch(e){ return {}; }
    }

    function qEscape(v){ return String(v).replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }
    function makeSafeDriveName(name,fallback='untitled'){
      const cleaned=String(name||fallback)
        .replace(/[\\/:*?"<>|#%{}~&]/g,'_')
        .replace(/\s+/g,' ')
        .trim()
        .slice(0,90);
      return cleaned || fallback;
    }
    function pad2(n){ return String(n).padStart(2,'0'); }
    function pad3(n){ return String(n).padStart(3,'0'); }
    function formatDriveFileTime(ms=Date.now()){
      const d=new Date(ms);
      // 보기 좋게 날짜_시간까지만 사용
      return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
    }
    function fileExtFromBlob(file){
      const name=(file && file.name) ? String(file.name) : '';
      const found=name.match(/\.([a-zA-Z0-9]{1,8})$/);
      if(found) return '.'+found[1].toLowerCase();
      const type=(file && file.type) ? String(file.type) : '';
      if(type.includes('jpeg')||type.includes('jpg')) return '.jpg';
      if(type.includes('webp')) return '.webp';
      if(type.includes('gif')) return '.gif';
      return '.png';
    }
    function getNoteTxtFileName(tab,idx=0){
      const order=Number.isFinite(Number(tab?.order)) ? Number(tab.order) : idx*10;
      return `${pad3(order)}_${makeSafeDriveName(tab?.name||tab?.id||'메모')}.txt`;
    }
    function getBookmarkTabFolderName(tab,idx=0){
      // Drive에서 보기 쉽게 탭 순서대로 001_기본, 002_자료 형식
      return `${pad3(idx+1)}_${makeSafeDriveName(tab?.name||tab?.id||'북마크')}`;
    }
    function getSortedBookmarkTabs(list){
      const tabs=Array.isArray(list)&&list.length ? list : [{id:'default',name:'기본',order:0}];
      return [...tabs].sort((a,b)=>(Number(a.order||0)-Number(b.order||0)));
    }
    function getBookmarkTabFolderInfo(tabId,list){
      const tabs=getSortedBookmarkTabs(list);
      let idx=tabs.findIndex(t=>(t.id||'default')===(tabId||'default'));
      if(idx<0) idx=0;
      const tab=tabs[idx] || {id:'default',name:'기본',order:0};
      return {tab,idx,folderName:getBookmarkTabFolderName(tab,idx)};
    }
    async function findDriveFile(name,parentId=null,mimeType=null){
      const q=[`name='${qEscape(name)}'`,'trashed=false'];
      if(parentId) q.push(`'${parentId}' in parents`);
      if(mimeType) q.push(`mimeType='${mimeType}'`);
      const url='https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q.join(' and '))+'&fields=files(id,name,mimeType,modifiedTime)&spaces=drive';
      const data=await driveFetch(url).then(r=>r.json());
      return data.files?.[0] || null;
    }

    async function listDriveFilesInFolder(parentId){
      if(!parentId) return [];
      const q=[`'${parentId}' in parents`,'trashed=false'];
      const url='https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q.join(' and '))+'&fields=files(id,name,mimeType,modifiedTime)&spaces=drive&pageSize=1000';
      const data=await driveFetch(url).then(r=>r.json());
      return data.files || [];
    }

    async function createDriveFolder(name,parentId=null){
      const meta={name,mimeType:'application/vnd.google-apps.folder'};
      if(parentId) meta.parents=[parentId];
      return await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(meta)}).then(r=>r.json());
    }
    async function getOrCreateDriveFolder(name,parentId=null){
      return await findDriveFile(name,parentId,'application/vnd.google-apps.folder') || await createDriveFolder(name,parentId);
    }
    async function findDriveFolder(name,parentId=null){
      return await findDriveFile(name,parentId,'application/vnd.google-apps.folder');
    }

    async function ensureDriveFolders(){
      if(driveFolders) return driveFolders;
      const app=await getOrCreateDriveFolder(DRIVE_APP_FOLDER);
      const system=await getOrCreateDriveFolder(DRIVE_SYSTEM_FOLDER,app.id);
      const notes=await getOrCreateDriveFolder(DRIVE_NOTES_FOLDER,app.id);
      const bookmarks=await getOrCreateDriveFolder(DRIVE_BOOKMARKS_FOLDER,app.id);
      // 북마크 이미지는 중간 '이미지' 폴더 없이 북마크 폴더 바로 아래 탭별 폴더에 저장
      const bookmarkImages=bookmarks;
      const clipCurrent=await getOrCreateDriveFolder(DRIVE_CLIP_CURRENT_FOLDER,system.id);
      driveFolders={app,system,notes,bookmarks,bookmarkImages,clipCurrent};
      return driveFolders;
    }

    async function getLegacyDriveFolder(name){
      const folders=await ensureDriveFolders();
      return await findDriveFolder(name,folders.app.id);
    }

    async function getBookmarkTabDriveFolder(tabId){
      const folders=await ensureDriveFolders();
      const {folderName}=getBookmarkTabFolderInfo(tabId,window.__bookmarkTabList);
      return await getOrCreateDriveFolder(folderName,folders.bookmarks.id);
    }

    async function uploadDriveMultipart({name,blob,parentId,fileId=null,mimeType='application/octet-stream'}){
      const meta={name,mimeType};
      if(parentId && !fileId) meta.parents=[parentId];
      const boundary='drive_'+Math.random().toString(36).slice(2);
      const delimiter='\r\n--'+boundary+'\r\n';
      const close='\r\n--'+boundary+'--';
      const body=new Blob([delimiter,'Content-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(meta),delimiter,'Content-Type: '+mimeType+'\r\n\r\n',blob,close],{type:'multipart/related; boundary='+boundary});
      const url=fileId ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,name,mimeType,modifiedTime` : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime';
      return await driveFetch(url,{method:fileId?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body}).then(r=>r.json());
    }

    async function updateDriveFileMetadata(fileId,metadata){
      if(!fileId) return null;
      return await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime`,{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(metadata)
      }).then(r=>r.json());
    }

    async function renameBookmarkTabDriveFolder(tabId,prevList,nextList){
      if(!driveReady || !driveAccessToken) return;
      const prev=getBookmarkTabFolderInfo(tabId,prevList);
      const next=getBookmarkTabFolderInfo(tabId,nextList);
      if(prev.folderName===next.folderName) return;
      const folders=await ensureDriveFolders();
      let oldFolder=await findDriveFolder(prev.folderName,folders.bookmarks.id);
      if(!oldFolder) oldFolder=await findDriveFolder(prev.folderName,folders.app.id);
      if(!oldFolder) return;
      await updateDriveFileMetadata(oldFolder.id,{name:next.folderName});
    }

    async function deleteDriveFile(fileId){
      if(!fileId) return;
      try{ await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`,{method:'DELETE'}); }catch(e){ console.warn('Drive delete skipped',e); }
    }

    async function downloadDriveBlob(fileId){
      return await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`).then(r=>r.blob());
    }
    async function downloadDriveText(fileId){
      return await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`).then(r=>r.text());
    }

    function splitAppDataForDrive(data){
      data=data||getDefaultAppData();
      const st=data.state||{};
      return {
        calendar:{customTasks:data.customTasks||[],taskStatus:st.taskStatus||{},updatedAt:data.updatedAt||new Date().toISOString()},
        notes:{notesTabList:st.notesTabList||[{id:'memo',name:'메모',order:0}],notesTabs:st.notesTabs||{},notesActiveTabId:st.notesActiveTabId||'memo',updatedAt:data.updatedAt||new Date().toISOString()},
        bookmarks:{imageBookmarks:data.imageBookmarks||[],bookmarkTabList:st.bookmarkTabList||[{id:'default',name:'기본',order:0}],bookmarkActiveTabId:st.bookmarkActiveTabId||'default',updatedAt:data.updatedAt||new Date().toISOString()},
        workmusic:{workMusicSongs:st.workMusicSongs||[],workMusicMode:st.workMusicMode||'sequential',workMusicCurrentIndex:Number(st.workMusicCurrentIndex||0),workMusicVolume:Number(st.workMusicVolume??80),workMusicLastVolume:Number(st.workMusicLastVolume??80),workMusicIsMuted:!!st.workMusicIsMuted,workMusicTabList:st.workMusicTabList||[{id:'default',name:'기본',order:0}],workMusicActiveTabId:st.workMusicActiveTabId||'default',updatedAt:data.updatedAt||new Date().toISOString()},
        clipviewer:{clipPages:st.clipPages||[],updatedAt:data.updatedAt||new Date().toISOString()}
      };
    }

    function mergeDriveParts(parts){
      const base=getDefaultAppData();
      if(parts.calendar){ base.customTasks=parts.calendar.customTasks||[]; base.state.taskStatus=parts.calendar.taskStatus||{}; }
      if(parts.notes){ base.state.notesTabList=parts.notes.notesTabList||base.state.notesTabList; base.state.notesTabs=parts.notes.notesTabs||{}; base.state.notesActiveTabId=parts.notes.notesActiveTabId||'memo'; }
      if(parts.bookmarks){ base.imageBookmarks=parts.bookmarks.imageBookmarks||[]; base.state.bookmarkTabList=parts.bookmarks.bookmarkTabList||base.state.bookmarkTabList; base.state.bookmarkActiveTabId=parts.bookmarks.bookmarkActiveTabId||'default'; }
      if(parts.workmusic){ base.state.workMusicSongs=parts.workmusic.workMusicSongs||[]; base.state.workMusicMode=parts.workmusic.workMusicMode||'sequential'; base.state.workMusicCurrentIndex=Number(parts.workmusic.workMusicCurrentIndex||0); base.state.workMusicVolume=Number(parts.workmusic.workMusicVolume??80); base.state.workMusicLastVolume=Number(parts.workmusic.workMusicLastVolume??80); base.state.workMusicIsMuted=!!parts.workmusic.workMusicIsMuted; base.state.workMusicTabList=parts.workmusic.workMusicTabList||base.state.workMusicTabList; base.state.workMusicActiveTabId=parts.workmusic.workMusicActiveTabId||'default'; }
      if(parts.clipviewer){ base.state.clipPages=parts.clipviewer.clipPages||[]; }
      base.updatedAt=new Date().toISOString();
      return base;
    }

    async function saveJsonToDrive(folderId,fileName,obj){
      const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
      const existing=await findDriveFile(fileName,folderId,'application/json');
      return await uploadDriveMultipart({name:fileName,blob,parentId:folderId,fileId:existing?.id||null,mimeType:'application/json'});
    }

    async function loadJsonFromDrive(folderId,fileName){
      const file=await findDriveFile(fileName,folderId,'application/json');
      if(!file) return null;
      try{ return JSON.parse(await downloadDriveText(file.id)); }catch(e){ console.warn('JSON load failed',fileName,e); return null; }
    }

    async function saveNotesToDrive(folderId,systemFolderId,notesPart){
      notesPart=notesPart||{};
      const tabs=[...(notesPart.notesTabList||[{id:'memo',name:'메모',order:0}])]
        .sort((a,b)=>(Number(a.order||0)-Number(b.order||0)));
      const notes=notesPart.notesTabs||{};
      const expectedNames=new Set();
      const indexTabs=[];
      for(let i=0;i<tabs.length;i++){
        const tab=tabs[i];
        const fileName=getNoteTxtFileName(tab,i);
        expectedNames.add(fileName);
        const textBlob=new Blob([notes[tab.id]||''],{type:'text/plain;charset=utf-8'});
        const existing=await findDriveFile(fileName,folderId,'text/plain');
        const uploaded=await uploadDriveMultipart({name:fileName,blob:textBlob,parentId:folderId,fileId:existing?.id||null,mimeType:'text/plain'});
        indexTabs.push({...tab,noteFileName:fileName,noteFileId:uploaded.id});
      }
      const files=await listDriveFilesInFolder(folderId);
      for(const f of files){
        if(String(f.name||'').toLowerCase().endsWith('.txt') && !expectedNames.has(f.name)){
          await deleteDriveFile(f.id);
        }
      }
      const index={
        version:1,
        updatedAt:notesPart.updatedAt||new Date().toISOString(),
        notesActiveTabId:notesPart.notesActiveTabId||tabs[0]?.id||'memo',
        notesTabList:indexTabs
      };
      await saveJsonToDrive(systemFolderId,DRIVE_NOTES_FILE,index);
      for(const legacyName of [DRIVE_NOTES_FILE, DRIVE_OLD_NOTES_FILE]){
        const legacy=await findDriveFile(legacyName,folderId,'application/json');
        if(legacy) await deleteDriveFile(legacy.id);
      }
      return index;
    }

    async function loadNotesFromDrive(folderId,systemFolderId){
      const index=await loadJsonFromDrive(systemFolderId,DRIVE_NOTES_FILE) || await loadJsonFromDrive(folderId,DRIVE_NOTES_FILE);
      if(index && Array.isArray(index.notesTabList)){
        const notesTabs={};
        const notesTabList=index.notesTabList.map(({noteFileName,noteFileId,...tab})=>tab);
        for(const tab of index.notesTabList){
          try{
            let file=null;
            if(tab.noteFileId) file={id:tab.noteFileId,name:tab.noteFileName};
            if(!file && tab.noteFileName) file=await findDriveFile(tab.noteFileName,folderId,'text/plain');
            notesTabs[tab.id]=file ? await downloadDriveText(file.id) : '';
          }catch(e){
            console.warn('note txt load failed',tab.name,e);
            notesTabs[tab.id]='';
          }
        }
        return {
          notesTabList:notesTabList.length?notesTabList:[{id:'memo',name:'메모',order:0}],
          notesTabs,
          notesActiveTabId:index.notesActiveTabId||notesTabList[0]?.id||'memo',
          updatedAt:index.updatedAt||new Date().toISOString()
        };
      }

      const old=await loadJsonFromDrive(systemFolderId,DRIVE_OLD_NOTES_FILE) || await loadJsonFromDrive(folderId,DRIVE_OLD_NOTES_FILE);
      if(old) return old;

      return null;
    }

    async function deleteJsonIfExists(folderId,fileName){
      if(!folderId) return;
      const file=await findDriveFile(fileName,folderId,'application/json');
      if(file) await deleteDriveFile(file.id);
    }

    async function cleanupLegacyJsonFiles(){
      const folders=await ensureDriveFolders();
      const legacyCalendar=await getLegacyDriveFolder(DRIVE_CALENDAR_FOLDER);
      const legacyWorkmusic=await getLegacyDriveFolder(DRIVE_WORKMUSIC_FOLDER);
      const legacyClipviewer=await getLegacyDriveFolder(DRIVE_CLIP_FOLDER);
      await deleteJsonIfExists(legacyCalendar?.id,DRIVE_CALENDAR_FILE);
      await deleteJsonIfExists(folders.bookmarks.id,DRIVE_BOOKMARKS_FILE);
      await deleteJsonIfExists(legacyWorkmusic?.id,DRIVE_WORKMUSIC_FILE);
      await deleteJsonIfExists(legacyClipviewer?.id,DRIVE_CLIP_FILE);
    }

    async function saveAppDataNow(){
      if(!driveReady || !driveAccessToken) return;
      setDriveBusy('Google Drive 저장 중...');
      try{
        const folders=await ensureDriveFolders();
        const data=buildAppData();
        currentAppData=data;
        const parts=splitAppDataForDrive(data);
        await saveJsonToDrive(folders.system.id,DRIVE_CALENDAR_FILE,parts.calendar);
        await saveNotesToDrive(folders.notes.id,folders.system.id,parts.notes);
        await saveJsonToDrive(folders.system.id,DRIVE_BOOKMARKS_FILE,parts.bookmarks);
        await saveJsonToDrive(folders.system.id,DRIVE_WORKMUSIC_FILE,parts.workmusic);
        await saveJsonToDrive(folders.system.id,DRIVE_CLIP_FILE,parts.clipviewer);
        await cleanupLegacyJsonFiles();
        setDriveStatus('Google Drive 저장 완료');
      }catch(e){
        console.error(e);
        setDriveStatus('Drive 저장 실패', true);
        throw e;
      }
    }
    async function saveNonNotesDataNow(){
      if(!driveReady || !driveAccessToken) return;
      setDriveBusy('Google Drive 저장 중...');
      try{
        const folders=await ensureDriveFolders();
        const data=buildAppData();
        currentAppData=data;
        const parts=splitAppDataForDrive(data);
        await saveJsonToDrive(folders.system.id,DRIVE_CALENDAR_FILE,parts.calendar);
        await saveJsonToDrive(folders.system.id,DRIVE_BOOKMARKS_FILE,parts.bookmarks);
        await saveJsonToDrive(folders.system.id,DRIVE_WORKMUSIC_FILE,parts.workmusic);
        await saveJsonToDrive(folders.system.id,DRIVE_CLIP_FILE,parts.clipviewer);
        await cleanupLegacyJsonFiles();
        setDriveStatus('Google Drive 저장 완료');
      }catch(e){
        console.error(e);
        setDriveStatus('Drive 저장 실패', true);
        throw e;
      }
    }
    function scheduleSaveNonNotesData(){
      clearTimeout(driveSaveTimer);
      setDriveStatus('로컬 반영됨 · Drive 저장 예약됨');
      driveSaveTimer=setTimeout(()=>saveNonNotesDataNow().catch(e=>console.error(e)),700);
    }

    function scheduleSaveAppData(){
      clearTimeout(driveSaveTimer);
      setDriveStatus('저장 예약됨');
      driveSaveTimer=setTimeout(()=>saveAppDataNow().catch(e=>console.error(e)),900);
    }

    async function loadAppDataFromDrive(){
      const folders=await ensureDriveFolders();
      const legacyCalendar=await getLegacyDriveFolder(DRIVE_CALENDAR_FOLDER);
      const legacyBookmarks=await getLegacyDriveFolder(DRIVE_BOOKMARKS_FOLDER);
      const legacyWorkmusic=await getLegacyDriveFolder(DRIVE_WORKMUSIC_FOLDER);
      const legacyClipviewer=await getLegacyDriveFolder(DRIVE_CLIP_FOLDER);
      const parts={
        calendar:await loadJsonFromDrive(folders.system.id,DRIVE_CALENDAR_FILE) || (legacyCalendar ? await loadJsonFromDrive(legacyCalendar.id,DRIVE_CALENDAR_FILE) : null),
        notes:await loadNotesFromDrive(folders.notes.id,folders.system.id),
        bookmarks:await loadJsonFromDrive(folders.system.id,DRIVE_BOOKMARKS_FILE) || (legacyBookmarks ? await loadJsonFromDrive(legacyBookmarks.id,DRIVE_BOOKMARKS_FILE) : null),
        workmusic:await loadJsonFromDrive(folders.system.id,DRIVE_WORKMUSIC_FILE) || (legacyWorkmusic ? await loadJsonFromDrive(legacyWorkmusic.id,DRIVE_WORKMUSIC_FILE) : null),
        clipviewer:await loadJsonFromDrive(folders.system.id,DRIVE_CLIP_FILE) || (legacyClipviewer ? await loadJsonFromDrive(legacyClipviewer.id,DRIVE_CLIP_FILE) : null)
      };
      const hasAny=Object.values(parts).some(Boolean);
      if(!hasAny){
        currentAppData=getDefaultAppData();
        applyAppData(currentAppData);
        await saveAppDataNow();
        return;
      }
      applyAppData(mergeDriveParts(parts));
      await resolveDriveBookmarkImages();
      await window.loadClipPagesFromDrive?.(false);
    }

    async function resolveDriveBookmarkImages(){
      for(const b of (window.imageBookmarks||[])){
        if(b.driveFileId && !b.url){
          try{
            const blob=await downloadDriveBlob(b.driveFileId);
            const url=URL.createObjectURL(blob);
            driveImageUrlCache.set(b.driveFileId,url);
            b.url=url;
          }catch(e){ console.warn('bookmark image load failed',b.name,e); }
        }
        if(b.previewDriveFileId && !b.previewImageUrl){
          try{
            const blob=await downloadDriveBlob(b.previewDriveFileId);
            const url=URL.createObjectURL(blob);
            driveImageUrlCache.set(b.previewDriveFileId,url);
            b.previewImageUrl=url;
          }catch(e){ console.warn('preview image load failed',b.name,e); }
        }
      }
    }

    async function afterGoogleLogin(){
      loadingOverlay.classList.remove('hidden');
      try{
        driveUser=await getUserProfile();
        userInfoEl.textContent=`${driveUser.name || '로그인됨'} (${driveUser.email || ''})`;
        signInBtn.classList.add('hidden');
        signOutBtn.classList.remove('hidden');
        driveReady=true; window.isAuthReady=true;
        await loadAppDataFromDrive();
        renderEverything();
        await window.loadClipPagesFromDrive?.(true);
        window.showFeedbackMessage('Google Drive 데이터를 불러왔습니다.');
      }catch(e){
        console.error(e); window.showAlert('Google Drive 데이터 로드 실패: '+(e.message||e));
      }finally{ loadingOverlay.classList.add('hidden'); }
    }

    signInBtn.onclick=()=>doSignIn();
    signOutBtn.onclick=()=>{
      driveAccessToken=null; driveReady=false; driveUser=null; driveFolders=null; appDataFileId=null;
      userInfoEl.textContent=''; signOutBtn.classList.add('hidden'); signInBtn.classList.remove('hidden');
      window.isAuthReady=true;
      window.customTasks=[]; window.taskStatus={}; window.imageBookmarks=[]; window.__notesTabs={}; window.__notesTabList=[{id:'memo',name:'메모',order:0}]; window.__notesActiveTabId='memo'; window.__bookmarkTabList=[{id:'default',name:'기본',order:0}]; window.__bookmarkActiveTabId='default'; window.__workMusicTabList=[{id:'default',name:'기본',order:0}]; window.__workMusicActiveTabId='default'; window.workMusicSongs=[];
      renderEverything();
      if(typeof clearClipLocal==='function') clearClipLocal();
      window.showClipMessage?.('로그인하면 Drive에 저장된 CLIP 원고가 표시됩니다.');
      window.setClipStatus?.('로그아웃됨');
    };

    window.ensureLogin=()=>{
      if(!window.isAuthReady){ window.showAlert('데이터 로딩 중입니다.'); return false; }
      if(!driveAccessToken){ window.showAlert('구글 로그인 후 이용해 주세요.'); return false; }
      return true;
    };

    // ===== 기존 UI가 호출하는 저장 함수들을 Drive 저장으로 연결 =====
    let notesTimer=null, notesPending=null;
    window.cloudSaveNotesDebounced=function(tabId,value){
      clearTimeout(notesTimer);
      if(tabId) notesPending={tabId,value:value??''};
      notesTimer=setTimeout(()=>{
        if(notesPending){ window.cloudSaveNotesFor(notesPending.tabId,notesPending.value); notesPending=null; }
        else window.cloudSaveNotes();
      },800);
    };
    window.cloudSaveAll=async()=>{ if(!ensureLogin()) return; scheduleSaveNonNotesData(); };
    window.cloudSaveStateOnly=async()=>{ if(!ensureLogin()) return; scheduleSaveNonNotesData(); };
    function writeNoteToState(tabIdArg,valueArg){
      const hasExplicitTabId=tabIdArg!==undefined && tabIdArg!==null;
      const id=hasExplicitTabId ? tabIdArg : (window.__notesActiveTabId || 'memo');
      let val=valueArg;
      if(val===undefined){
        const el=document.getElementById('notesArea');
        val=el?el.value:'';
      }
      window.__notesTabs=window.__notesTabs||{};
      window.__notesTabs[id]=val;
      return id;
    }
    window.cloudSaveNotes=async(tabIdArg,valueArg)=>{
      if(!ensureLogin()) return;
      writeNoteToState(tabIdArg,valueArg);
      scheduleSaveAppData();
    };
    window.cloudSaveNotesFor=(tabId,value)=>window.cloudSaveNotes(tabId,value);
    window.cloudSaveNotesNow=async(tabId,value)=>{
      if(!ensureLogin()) return;
      const savedTabId=writeNoteToState(tabId,value);
      if(notesPending?.tabId===savedTabId){
        notesPending=null;
        clearTimeout(notesTimer);
      }
      clearTimeout(driveSaveTimer);
      await saveAppDataNow();
    };
    window.cloudSetActiveNotesTab=async(tabId)=>{ window.__notesActiveTabId=tabId; scheduleSaveAppData(); };
    window.cloudAddNotesTab=async({id,name})=>{ const list=window.__notesTabList||[]; const max=list.reduce((m,t)=>Math.max(m,Number(t.order||0)),0); window.__notesTabList=[...list,{id,name,order:max+10}]; window.__notesActiveTabId=id; window.__notesTabs=window.__notesTabs||{}; window.__notesTabs[id]=''; renderEverything(); scheduleSaveAppData(); };
    window.cloudRenameNotesTab=async(tabId,newName)=>{ window.__notesTabList=(window.__notesTabList||[]).map(t=>t.id===tabId?{...t,name:newName}:t); renderEverything(); scheduleSaveAppData(); };
    window.cloudReorderNotesTabs=async(list)=>{ window.__notesTabList=list; renderEverything(); scheduleSaveAppData(); };
    window.cloudDeleteNotesTab=async(tabId)=>{ let list=(window.__notesTabList||[]).filter(t=>t.id!==tabId); window.__notesTabs=window.__notesTabs||{}; delete window.__notesTabs[tabId]; if(!list.length) list=[{id:'memo',name:'메모',order:0}]; window.__notesTabList=list; if(window.__notesActiveTabId===tabId) window.__notesActiveTabId=list[0].id; renderEverything(); scheduleSaveAppData(); };

    window.cloudSetActiveBookmarkTab=async(tabId)=>{ window.__bookmarkActiveTabId=tabId||'default'; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudAddBookmarkTab=async({id,name})=>{ const list=window.__bookmarkTabList||[{id:'default',name:'기본',order:0}]; const max=list.reduce((m,t)=>Math.max(m,Number(t.order||0)),0); window.__bookmarkTabList=[...list,{id,name,order:max+10}]; window.__bookmarkActiveTabId=id; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudRenameBookmarkTab=async(tabId,name)=>{
      const prevList=(window.__bookmarkTabList||[{id:'default',name:'기본',order:0}]).map(t=>({...t}));
      const nextList=prevList.map(t=>t.id===tabId?{...t,name}:t);
      window.__bookmarkTabList=nextList;
      renderEverything();
      try{
        await renameBookmarkTabDriveFolder(tabId,prevList,nextList);
      }catch(e){
        console.warn('bookmark tab folder rename skipped',e);
        setDriveStatus('폴더 이름 변경 실패 · 탭 이름은 저장 예약됨',true);
      }
      scheduleSaveNonNotesData();
    };
    window.cloudReorderBookmarkTabs=async(list)=>{
      const prevList=(window.__bookmarkTabList||[{id:'default',name:'기본',order:0}]).map(t=>({...t}));
      window.__bookmarkTabList=list;
      renderEverything();
      for(const tab of list){
        try{
          await renameBookmarkTabDriveFolder(tab.id,prevList,list);
        }catch(e){
          console.warn('bookmark tab folder reorder rename skipped',tab?.name,e);
        }
      }
      scheduleSaveNonNotesData();
    };
    window.cloudDeleteBookmarkTab=async(tabId)=>{ window.imageBookmarks=(window.imageBookmarks||[]).filter(b=>(b.bookmarkTabId||'default')!==tabId); let list=(window.__bookmarkTabList||[]).filter(t=>t.id!==tabId); if(!list.length) list=[{id:'default',name:'기본',order:0}]; window.__bookmarkTabList=list; if(window.__bookmarkActiveTabId===tabId) window.__bookmarkActiveTabId=list[0].id; renderEverything(); scheduleSaveNonNotesData(); };
    window.moveBookmarkToTab=async(id,tabId)=>{ const b=(window.imageBookmarks||[]).find(x=>x.id===id); if(b){ b.bookmarkTabId=tabId||'default'; renderEverything(); scheduleSaveNonNotesData(); } };

    window.cloudEnsureWorkMusicDefaultTab=async()=>{ if(!window.__workMusicTabList?.length) window.__workMusicTabList=[{id:'default',name:'기본',order:0}]; scheduleSaveNonNotesData(); };
    window.cloudSetActiveWorkMusicTab=async(tabId)=>{ window.__workMusicActiveTabId=tabId||'default'; window.workMusicCurrentIndex=0; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudAddWorkMusicTab=async(tab)=>{ const list=window.__workMusicTabList||[{id:'default',name:'기본',order:0}]; const max=list.reduce((m,t)=>Math.max(m,Number(t.order||0)),0); window.__workMusicTabList=[...list,{...tab,order:tab.order??max+10}]; window.__workMusicActiveTabId=tab.id; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudRenameWorkMusicTab=async(tabId,name)=>{ window.__workMusicTabList=(window.__workMusicTabList||[]).map(t=>t.id===tabId?{...t,name}:t); renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudReorderWorkMusicTabs=async(list)=>{ window.__workMusicTabList=list; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudDeleteWorkMusicTab=async(tabId)=>{ let list=(window.__workMusicTabList||[]).filter(t=>t.id!==tabId); if(!list.length) list=[{id:'default',name:'기본',order:0}]; window.__workMusicTabList=list; window.workMusicSongs=(window.workMusicSongs||[]).filter(s=>(s.workMusicTabId||'default')!==tabId); if(window.__workMusicActiveTabId===tabId) window.__workMusicActiveTabId=list[0].id; renderEverything(); scheduleSaveNonNotesData(); };
    window.cloudSaveWorkMusic=async()=>{ if(!ensureLogin()) return; scheduleSaveNonNotesData(); };

    window.deleteTask=async()=>{ if(!ensureLogin()||!window.currentTask?.id){ window.closeTaskModal?.(); return; } window.customTasks=(window.customTasks||[]).filter(t=>t.id!==window.currentTask.id); renderEverything(); scheduleSaveNonNotesData(); };

    async function uploadFileToDrive(file,folderId,namePrefix='file'){
      const ms=nowMs();
      let parentId=folderId;
      if(!parentId){
        const tabId=window.__bookmarkActiveTabId||'default';
        const tabFolder=await getBookmarkTabDriveFolder(tabId);
        parentId=tabFolder.id;
      }
      const ext=fileExtFromBlob(file);
      const name=`${formatDriveFileTime(ms)}${ext}`;
      const uploaded=await uploadDriveMultipart({name,blob:file,parentId,mimeType:file.type||'image/png'});
      uploaded.createdName=name;
      uploaded.createdMs=ms;
      return uploaded;
    }

    window.addVideoBookmark=async(url)=>{ if(!ensureLogin()) return; window.imageBookmarks.push({id:genId('bm'),pageUrl:url,url:null,type:'video',title:null,sourceDomain:window.extractDomain?.(url)||'Unknown',bookmarkTabId:window.__bookmarkActiveTabId||'default',timestamp:driveTimestamp(nowMs()),timestampMs:nowMs()}); renderEverything(); scheduleSaveAppData(); };
    window.addGenericBookmark=async(url)=>{ if(!ensureLogin()) return; window.imageBookmarks.push({id:genId('bm'),pageUrl:url,url:null,type:'link',title:null,sourceDomain:window.extractDomain?.(url)||'Unknown',bookmarkTabId:window.__bookmarkActiveTabId||'default',timestamp:driveTimestamp(nowMs()),timestampMs:nowMs()}); renderEverything(); scheduleSaveAppData(); };
    window.addInstagramBookmark=async(embedCode)=>{ if(!ensureLogin()) return; let pageUrl='인스타그램 게시물'; try{ const doc=new DOMParser().parseFromString(embedCode,'text/html'); const b=doc.querySelector('blockquote.instagram-media'); if(b?.cite) pageUrl=b.cite; }catch(_){} window.imageBookmarks.push({id:genId('bm'),pageUrl,embedCode,url:null,type:'instagram',title:null,sourceDomain:window.extractDomain?.(pageUrl)||'Unknown',bookmarkTabId:window.__bookmarkActiveTabId||'default',timestamp:driveTimestamp(nowMs()),timestampMs:nowMs()}); renderEverything(); scheduleSaveAppData(); };
    window.addRemoteImage=async(url,pageUrl)=>{ if(!ensureLogin()) return; window.imageBookmarks.push({id:genId('bm'),url,pageUrl:pageUrl||null,type:'remote',sourceDomain:window.extractDomain?.(pageUrl||url)||'Unknown',bookmarkTabId:window.__bookmarkActiveTabId||'default',timestamp:driveTimestamp(nowMs()),timestampMs:nowMs()}); renderEverything(); scheduleSaveAppData(); };
    window.addImage=async(file,pageUrl)=>{ if(!ensureLogin()) return; if(typeof file==='string') return window.addRemoteImage(file,pageUrl||file); try{ const url=URL.createObjectURL(file); const ms=nowMs(); const row={id:genId('bm'),url,pageUrl:pageUrl||null,type:'local_pending_image',driveFileId:null,title:null,sourceDomain:pageUrl?(window.extractDomain?.(pageUrl)||'Unknown'):'로컬 캐시',bookmarkTabId:window.__bookmarkActiveTabId||'default',timestamp:driveTimestamp(ms),timestampMs:ms,uploadStatus:'pending'}; window.imageBookmarks.push(row); renderEverything(); scheduleSaveNonNotesData(); setDriveStatus('이미지 로컬 반영됨 · Drive 업로드 중...'); uploadFileToDrive(file,null,'bookmark').then(uploaded=>{ const b=(window.imageBookmarks||[]).find(x=>x.id===row.id); if(!b) return; b.driveFileId=uploaded.id; b.type='drive_image'; b.sourceDomain=pageUrl?(window.extractDomain?.(pageUrl)||'Unknown'):'Google Drive'; b.uploadStatus='done'; if(uploaded.createdMs){ b.timestamp=driveTimestamp(uploaded.createdMs); b.timestampMs=uploaded.createdMs; } renderEverything(); return saveNonNotesDataNow(); }).then(()=>{ setDriveStatus('이미지 Drive 저장 완료'); }).catch(e=>{ console.error(e); const b=(window.imageBookmarks||[]).find(x=>x.id===row.id); if(b) b.uploadStatus='error'; renderEverything(); setDriveStatus('이미지 Drive 업로드 실패', true); }); }catch(e){ window.showAlert('이미지 추가 실패: '+(e.message||e)); } };
    window.updateBookmarkTitle=async(id,newTitle)=>{ const b=(window.imageBookmarks||[]).find(x=>x.id===id); if(b){ b.title=newTitle||null; renderEverything(); scheduleSaveNonNotesData(); } };
    window.uploadBookmarkPreviewImage=async(bookmarkId,file)=>{ if(!ensureLogin()) return; const b=(window.imageBookmarks||[]).find(x=>x.id===bookmarkId); if(!b) return; b.previewImageUrl=URL.createObjectURL(file); b.previewUploadStatus='pending'; renderEverything(); scheduleSaveNonNotesData(); setDriveStatus('미리보기 로컬 반영됨 · Drive 업로드 중...'); uploadFileToDrive(file,null,'bookmark_preview').then(uploaded=>{ const row=(window.imageBookmarks||[]).find(x=>x.id===bookmarkId); if(!row) return; row.previewDriveFileId=uploaded.id; row.previewUploadStatus='done'; renderEverything(); return saveNonNotesDataNow(); }).then(()=>setDriveStatus('미리보기 Drive 저장 완료')).catch(e=>{ console.error(e); const row=(window.imageBookmarks||[]).find(x=>x.id===bookmarkId); if(row) row.previewUploadStatus='error'; renderEverything(); setDriveStatus('미리보기 Drive 업로드 실패', true); }); };
    window.deleteImage=async(id)=>{ if(!ensureLogin()) return; const row=(window.imageBookmarks||[]).find(b=>b.id===id); if(row){ await deleteDriveFile(row.driveFileId); await deleteDriveFile(row.previewDriveFileId); } window.imageBookmarks=(window.imageBookmarks||[]).filter(b=>b.id!==id); renderEverything(); scheduleSaveNonNotesData(); window.showFeedbackMessage('북마크가 삭제되었습니다.'); };

    // 자동 초기 상태
    window.isAuthReady=true;
    setTimeout(async()=>{
      await setupTokenClient();
      if(!driveAccessToken){
        window.setClipStatus?.('구글 로그인하면 Drive 데이터를 자동으로 불러옵니다.');
      }
    },500);

    initCalendar();
    initNotes();
    initBookmarks();
    initWorkMusic?.();
    initClipViewer?.({
      ensureLogin,
      ensureClipCurrentFolder: async()=> (await ensureDriveFolders()).clipCurrent,
      findDriveFile,
      uploadDriveMultipart,
      downloadDriveBlob,
      getClipPages:()=> (currentAppData.state&&currentAppData.state.clipPages)||[],
      saveClipManifest:async(manifest)=>{ currentAppData.state=currentAppData.state||{}; currentAppData.state.clipPages=manifest; await saveAppDataNow(); },
      loadAppDataFromDrive,
      renderEverything
    });
}
