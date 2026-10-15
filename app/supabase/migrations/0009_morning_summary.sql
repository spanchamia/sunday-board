-- Morning summary: each device with notifications on can ask for a daily summary at a
-- time it chooses (in the family's time zone): today's meals, today's to-dos and how
-- many are overdue. Sent by the `push` Edge Function on its every-minute run.
alter table public.push_subscriptions
  add column summary_time    time,   -- null = no summary
  add column summary_sent_on date;   -- the family-local day it last went out

-- Turn the summary on (a time) or off (null) for one of my devices.
create function public.set_push_summary(p_endpoint text, p_time time)
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions
     set summary_time = p_time,
         -- choosing a time later today still sends today; an earlier one waits for tomorrow
         summary_sent_on = case when p_time is not null
                                 and p_time <= (now() at time zone (select timezone from public.families f where f.id = family_id))::time
                                then (now() at time zone (select timezone from public.families f where f.id = family_id))::date
                                else null end
   where endpoint = p_endpoint and user_id = (select auth.uid());
$$;
revoke all on function public.set_push_summary(text, time) from public, anon;
grant execute on function public.set_push_summary(text, time) to authenticated;

-- Server only: claim the summaries due now (up to 2 hours late) and return their text.
-- Claiming marks today as sent, so each device gets one summary a day.
create function public.push_claim_summaries()
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
revoke all on function public.push_claim_summaries() from public, anon, authenticated;
grant execute on function public.push_claim_summaries() to service_role;
