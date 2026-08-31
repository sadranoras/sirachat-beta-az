/*
# Add forward_enabled column to chats

1. Changes
- Adds `forward_enabled` (boolean, NOT NULL, default true) to the `chats` table.
- Lets group/channel owners disable message forwarding for that chat.
2. Security
- No RLS changes. Existing UPDATE policies on `chats` already restrict
  writes to owners/admins, so only they can toggle this setting.
3. Notes
- Defaults to `true` so all existing chats keep current behavior.
- Direct chats and "saved messages" are unaffected; the UI only exposes
  the toggle for groups and channels.
*/
ALTER TABLE chats ADD COLUMN IF NOT EXISTS forward_enabled boolean NOT NULL DEFAULT true;