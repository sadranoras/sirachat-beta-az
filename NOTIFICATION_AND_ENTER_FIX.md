# Notification + Enter key fix

- Desktop: Enter sends the message; Shift+Enter inserts a newline.
- Touch/mobile keyboards: Enter remains a newline action.
- Incoming messages in the active chat can show a native notification when the tab is not focused and trigger device vibration when supported.
- Background/closed-app push remains handled by the Push API + service worker.
- Service-worker cache version was bumped to v16 so deployed clients receive the updated worker.
- Notification permission is requested through the existing notification subscription/settings flow.

For background push, the Supabase `send-push` Edge Function and the `on_message_insert_push` database trigger must be deployed/configured, with VAPID keys present in `app_config`.
