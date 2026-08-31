-- Create a trigger that fires when a new message is inserted
-- It calls the send-push edge function to deliver push notifications
-- to all chat members except the sender.

CREATE OR REPLACE FUNCTION public.notify_message_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url text;
  v_anon_key text;
BEGIN
  SELECT value INTO v_supabase_url FROM public.app_config WHERE key = 'supabase_url' LIMIT 1;
  SELECT value INTO v_anon_key FROM public.app_config WHERE key = 'supabase_anon_key' LIMIT 1;

  IF v_supabase_url IS NULL OR v_anon_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'chat_id', NEW.chat_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'content', COALESCE(NEW.content, ''),
      'message_type', NEW.message_type
    )
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create fresh
DROP TRIGGER IF EXISTS on_message_insert_push ON public.messages;
CREATE TRIGGER on_message_insert_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_message_push();
