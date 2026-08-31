/*
# Add forwarded_from column to messages

1. Modified Tables
- `messages`: adds `forwarded_from` (text, nullable) — stores the display name or username
  of the original sender when a message is forwarded from another chat. Null for
  non-forwarded messages.
2. Security
- No RLS changes; existing message policies cover the new column automatically.
*/

ALTER TABLE messages ADD COLUMN IF NOT EXISTS forwarded_from text;
