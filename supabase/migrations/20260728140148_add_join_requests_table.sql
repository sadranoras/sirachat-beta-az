/*
# Join Requests for Private Chats

1. New Tables
- `join_requests`
  - `id` (uuid, primary key)
  - `chat_id` (uuid, FK to chats, ON DELETE CASCADE)
  - `user_id` (uuid, FK to auth.users, ON DELETE CASCADE)
  - `status` (text: 'pending' | 'approved' | 'rejected', default 'pending')
  - `created_at` (timestamptz, default now())
  - `resolved_at` (timestamptz, nullable)
  - UNIQUE(chat_id, user_id) — one pending request per user per chat

2. Security (RLS)
- Enable RLS.
- Users can INSERT their own request (auth.uid() = user_id).
- Users can SELECT their own requests (to check status).
- Chat admins/owner can SELECT pending requests for their chats (via chat_members role check).
- Chat admins/owner can UPDATE (approve/reject) requests for their chats.
- Realtime enabled for join_requests so admins get live notifications.
*/

CREATE TABLE IF NOT EXISTS join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (chat_id, user_id)
);

ALTER TABLE join_requests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own join request
DROP POLICY IF EXISTS "insert_own_join_request" ON join_requests;
CREATE POLICY "insert_own_join_request" ON join_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests (any status)
DROP POLICY IF EXISTS "select_own_join_requests" ON join_requests;
CREATE POLICY "select_own_join_requests" ON join_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Chat admins/owners can view pending requests for chats they manage
DROP POLICY IF EXISTS "select_admin_join_requests" ON join_requests;
CREATE POLICY "select_admin_join_requests" ON join_requests
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = join_requests.chat_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Chat admins/owners can approve/reject requests
DROP POLICY IF EXISTS "update_admin_join_requests" ON join_requests;
CREATE POLICY "update_admin_join_requests" ON join_requests
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = join_requests.chat_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_members cm
      WHERE cm.chat_id = join_requests.chat_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- Add to realtime
ALTER TABLE join_requests REPLICA IDENTITY FULL;
