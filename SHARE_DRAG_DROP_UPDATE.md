# SiraChat — Share & Drag/Drop update

Applied:
- Native share for received image/video/file messages via Web Share API, with file sharing when supported and URL fallback.
- Drag & drop upload: dropping one or multiple files anywhere in the chat opens the existing multi-file media composer.
- PWA Web Share Target: files shared from other apps/messengers can be received by the installed SiraChat PWA.
- Shared files are stored temporarily in IndexedDB by the service worker and consumed by the active chat composer.
- Service worker cache bumped to v17.
