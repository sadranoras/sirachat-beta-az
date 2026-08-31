-- ==========================
-- CHAT FOLDERS
-- ==========================

CREATE TABLE IF NOT EXISTS chat_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);


CREATE TABLE IF NOT EXISTS chat_folder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES chat_folders(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, folder_id, chat_id)
);


-- ==========================
-- ARCHIVE CHAT
-- ==========================

CREATE TABLE IF NOT EXISTS chat_user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, chat_id)
);


-- ==========================
-- BLOCK USERS
-- ==========================

CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at timestamptz DEFAULT now(),

  UNIQUE(user_id, blocked_user_id)
);


-- ==========================
-- REPORT SYSTEM
-- ==========================

CREATE TABLE IF NOT EXISTS message_reports (

  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,

  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  reason text NOT NULL,

  status text DEFAULT 'pending',

  created_at timestamptz DEFAULT now()

);


-- ==========================
-- INDEXES
-- ==========================

CREATE INDEX IF NOT EXISTS idx_folder_user
ON chat_folders(user_id);


CREATE INDEX IF NOT EXISTS idx_folder_items_chat
ON chat_folder_items(chat_id);


CREATE INDEX IF NOT EXISTS idx_reports_status
ON message_reports(status);


-- ==========================
-- REALTIME
-- ==========================

ALTER PUBLICATION supabase_realtime
ADD TABLE chat_folders;

ALTER PUBLICATION supabase_realtime
ADD TABLE chat_folder_items;

ALTER PUBLICATION supabase_realtime
ADD TABLE chat_user_settings;

ALTER PUBLICATION supabase_realtime
ADD TABLE message_reports;