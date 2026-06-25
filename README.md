# magamiscoming

마감이 오고있다.

magamiscoming은 웹툰 작가를 위한 작업 지원 플랫폼입니다. 작업 자료 정리, 창작 보조 기능, 작업 관리 등 작품 제작 과정에 필요한 다양한 기능을 제공합니다.

Homepage:
https://bacbaqui-web.github.io/magamiscoming/

Contact:
cockrott@gmail.com

Privacy Policy:
https://bacbaqui-web.github.io/magamiscoming/privacy.html

Terms of Service:
https://bacbaqui-web.github.io/magamiscoming/terms.html

## Storage

The app supports a hybrid storage mode:

- Firebase Authentication + Firestore: user-specific app metadata such as calendar, notes, bookmark lists, work music lists, and CLIP manifests
- Google Drive: large user files such as bookmark images and CLIP preview images

Set `window.APP_CONFIG.firebase.enabled` to `true` and fill the Firebase web app config in `src/config.js` to enable Firebase metadata storage. If Firebase is not configured or sign-in fails, the app falls back to the existing Google Drive JSON storage.

Recommended Firestore rule shape:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
