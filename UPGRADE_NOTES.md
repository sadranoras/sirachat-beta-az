Requested feature layer added without changing existing theme/background files.

Included:
- Faster large-file upload path with resumable TUS-style transfer and retries.
- IndexedDB file cache for avoiding repeat downloads.
- Chat folder/archive/block data helpers.
- Push-notification registration helpers.
- Existing message-password / account-password / 2FA files from the supplied ZIP are preserved.

Important database setup:
The organization helpers expect these Supabase tables:
chat_folders, chat_folder_items, chat_user_settings, blocked_users.
Create them with RLS policies appropriate to your auth model before enabling the UI.
