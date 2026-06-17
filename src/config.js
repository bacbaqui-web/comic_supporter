(function () {
  window.APP_CONFIG = Object.freeze({
    googleClientId: '75399802933-ob5opqbukj1enr6v069rocbjo9508b35.apps.googleusercontent.com',
    youtubeApiKey: 'AIzaSyAxMNbkyUocpD_r-jnvQH_fiuYtxL952CY',
    drive: {
      scope: 'https://www.googleapis.com/auth/drive.file',
      folders: {
        app: '코믹서포터',
        system: 'system',
        calendar: '달력',
        notes: '메모',
        bookmarks: '북마크',
        bookmarkImages: '',
        workmusic: '노동요',
        clipviewer: '클립뷰어',
        clipCurrent: 'current'
      },
      files: {
        calendar: 'calendar.json',
        notes: 'notes-index.json',
        oldNotes: 'notes.json',
        bookmarks: 'bookmarks.json',
        workmusic: 'workmusic.json',
        clipviewer: 'clipviewer.json'
      }
    }
  });
})();
