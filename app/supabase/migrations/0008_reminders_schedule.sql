-- Every minute, pg_cron asks the `push` Edge Function to send due reminders (see 0007).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every minute: ask the Edge Function to send due reminders. The function only ever
-- sends reminders that are really due, so this call needs no secret.
select cron.schedule('send-reminders', '* * * * *', $$
  select net.http_post(
    url := 'https://ecgskwekeitfqtjvprao.supabase.co/functions/v1/push',
    body := '{"action":"tick"}'::jsonb,
    headers := '{"Content-Type":"application/json"}'::jsonb
  )
$$);
