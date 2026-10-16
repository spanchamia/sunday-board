-- Keep phones subscribed when their push address changes.
-- Push services (Google, Apple) can retire a phone's address at any time. Before this,
-- the server deleted the device when that happened, while the phone still showed "On".
-- Now: the server marks it gone (gone_at), and the app renews the address when it next
-- opens (or the service worker does it in the background), keeping its settings.
alter table public.push_subscriptions add column gone_at timestamptz;

-- Save this device's address (replaces save_push_subscription from 0007, which stays for
-- older app versions). p_replaces = the address it had before (renewal): its settings
-- (morning summary) carry over and the old row goes.
create function public.save_push_device(p_endpoint text, p_p256dh text, p_auth text,
                                        p_tz text default null, p_replaces text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  fid uuid := private.my_family_id();
  me  uuid := (select auth.uid());
  carried time;
begin
  if fid is null then raise exception 'Join or create a family first'; end if;
  if p_replaces is not null and p_replaces <> p_endpoint then
    select summary_time into carried from public.push_subscriptions where endpoint = p_replaces and user_id = me;
    delete from public.push_subscriptions where endpoint = p_replaces and user_id = me;
  end if;
  insert into public.push_subscriptions as s (endpoint, user_id, family_id, p256dh, auth, summary_time)
    values (p_endpoint, me, fid, p_p256dh, p_auth, carried)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, family_id = excluded.family_id, gone_at = null,
        -- same person on this browser keeps their summary; someone else starts fresh
        summary_time = case when s.user_id = excluded.user_id then coalesce(s.summary_time, excluded.summary_time) else excluded.summary_time end,
        summary_sent_on = case when s.user_id = excluded.user_id then s.summary_sent_on else null end,
        user_id = excluded.user_id;
  if p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    update public.families set timezone = p_tz where id = fid;
  end if;
end $$;
revoke all on function public.save_push_device(text, text, text, text, text) from public, anon;
grant execute on function public.save_push_device(text, text, text, text, text) to authenticated;

-- Server only: the service worker got a new address in the background and reports
-- it with the old one (which only that phone knows).
create function public.push_replace_endpoint(p_old text, p_new text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_old = p_new then
    update public.push_subscriptions set p256dh = p_p256dh, auth = p_auth, gone_at = null where endpoint = p_old;
  else
    delete from public.push_subscriptions where endpoint = p_new;
    update public.push_subscriptions set endpoint = p_new, p256dh = p_p256dh, auth = p_auth, gone_at = null where endpoint = p_old;
  end if;
  return found;
end $$;
revoke all on function public.push_replace_endpoint(text, text, text, text) from public, anon, authenticated;
grant execute on function public.push_replace_endpoint(text, text, text, text) to service_role;

-- Summaries skip devices whose address is gone (same as 0009 otherwise).
create or replace function public.push_claim_summaries()
returns table (endpoint text, p256dh text, auth text, title text, body text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with claimed as (
    update public.push_subscriptions s
       set summary_sent_on = (now() at time zone f.timezone)::date
      from public.families f
     where f.id = s.family_id
       and s.gone_at is null
       and s.summary_time is not null
       and ((now() at time zone f.timezone)::time - s.summary_time) between interval '0' and interval '2 hours'
       and s.summary_sent_on is distinct from (now() at time zone f.timezone)::date
    returning s.endpoint, s.p256dh, s.auth, s.user_id, s.family_id, (now() at time zone f.timezone)::date as today
  ), parts as (
    select c.*,
      (select string_agg(x.line, E'\n' order by x.sort)
         from (select mt.sort, mt.name || ': ' || string_agg(coalesce(d.name, i.name, 'something'), ', ' order by pm.created_at) as line
                 from public.planned_meals pm
                 join public.meal_types mt on mt.id = pm.meal_type_id
                 left join public.dishes d on d.id = pm.dish_id
                 left join public.items i on i.id = pm.item_id
                where pm.family_id = c.family_id and pm.date = c.today
                group by mt.id, mt.sort, mt.name) x) as meals,
      (select count(*) from public.tasks k
        where k.family_id = c.family_id and k.done_at is null and k.due_on = c.today
          and (k.visibility = 'family' or k.owner_id = c.user_id)) as n_today,
      (select string_agg(y.t, ', ' order by y.ord)
         from (select k.title || coalesce(' ' || to_char(k.due_time, 'FMHH12:MI AM'), '') as t,
                      row_number() over (order by k.due_time nulls last, k.created_at) as ord
                 from public.tasks k
                where k.family_id = c.family_id and k.done_at is null and k.due_on = c.today
                  and (k.visibility = 'family' or k.owner_id = c.user_id)) y
        where y.ord <= 3) as todos,
      (select count(*) from public.tasks k
        where k.family_id = c.family_id and k.done_at is null and k.due_on < c.today and k.due_on >= c.today - 60
          and (k.visibility = 'family' or k.owner_id = c.user_id)) as n_overdue
    from claimed c
  )
  select p.endpoint, p.p256dh, p.auth,
         'Today: ' || to_char(p.today, 'FMDay, Mon FMDD'),
         coalesce(nullif(concat_ws(E'\n',
           p.meals,
           case when p.n_today = 1 then '1 to-do: ' || p.todos
                when p.n_today > 1 then p.n_today || ' to-dos: ' || p.todos || case when p.n_today > 3 then ', +' || (p.n_today - 3) || ' more' else '' end end,
           case when p.n_overdue > 0 then p.n_overdue || ' still to do from earlier' end), ''),
           'Nothing planned for today.')
  from parts p;
end $$;
