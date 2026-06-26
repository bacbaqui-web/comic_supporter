(function () {
  window.APP_CONFIG = Object.freeze({
    googleClientId: '75399802933-ob5opqbukj1enr6v069rocbjo9508b35.apps.googleusercontent.com',
    youtubeApiKey: 'AIzaSyAxMNbkyUocpD_r-jnvQH_fiuYtxL952CY',
    firebase: {
      enabled: true,
      apiKey: 'AIzaSyDiRl8wz7HDb8HUOUFnhDQlHmuZ-sImVhI',
      authDomain: 'magamiscoming.firebaseapp.com',
      projectId: 'magamiscoming',
      storageBucket: 'magamiscoming.firebasestorage.app',
      messagingSenderId: '158360808387',
      appId: '1:158360808387:web:4eec7b636ac2ab3b562b76'
    },
    drive: {
      scope: 'https://www.googleapis.com/auth/drive.file',
      folders: {
        app: 'magamiscoming',
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
