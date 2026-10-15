-- Family access-rule checks. Run against the Supabase project (SQL editor or the
-- Supabase connector's execute_sql). Everything happens inside a transaction that is
-- rolled back, so no data is kept. Every row of the result should read as expected:
-- counts as noted in the check name, and "blocked" for every attack.
begin;
insert into auth.users (id, email, aud, role) values
 ('00000000-0000-0000-0000-0000000000a1','a@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000b1','b@test.local','authenticated','authenticated'),
 ('00000000-0000-0000-0000-0000000000a2','a2@test.local','authenticated','authenticated');
create temp table results (n serial, check_name text, value text) on commit drop;
grant all on results to authenticated; grant usage on sequence results_n_seq to authenticated;

set local role authenticated;
-- Alice starts Family A
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
select public.create_family('Family A','Alice');
insert into public.categories (family_id, name) values (private.my_family_id(), 'Kitchen');
insert into public.items (family_id, name) values (private.my_family_id(), 'Milk');
insert into public.tasks (family_id, title, visibility) values (private.my_family_id(), 'Alice private', 'private');
insert into public.tasks (family_id, title) values (private.my_family_id(), 'Shared task');
insert into results(check_name,value) select 'A sees own items (want 1)', count(*)::text from public.items;
do $$ begin
  begin insert into public.items (family_id, name) values (private.my_family_id(), 'milk');
    insert into results(check_name,value) values ('duplicate item name', 'ALLOWED - BAD');
  exception when unique_violation then insert into results(check_name,value) values ('duplicate item name', 'blocked'); end;
end $$;

reset role;
create temp table ids on commit drop as
  select f.id fid, f.invite_code code,
         (select id from public.categories c where c.family_id = f.id and c.name = 'Kitchen') cid
  from public.families f where f.name = 'Family A';
grant select on ids to authenticated;
set local role authenticated;

-- Bob starts Family B and tries to reach Family A
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);
select public.create_family('Family B','Bob');
insert into results(check_name,value) select 'B sees A items (want 0)', count(*)::text from public.items where name='Milk';
insert into results(check_name,value) select 'B sees families (want 1)', count(*)::text from public.families;
insert into results(check_name,value) select 'B sees members (want 1)', count(*)::text from public.family_members;
do $$ begin
  begin insert into public.items (family_id, name) select fid, 'Hack' from ids;
    insert into results(check_name,value) values ('B writes item into A by id', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('B writes item into A by id', 'blocked'); end;
  begin insert into public.items (family_id, name, category_id) select private.my_family_id(), 'Sneaky', cid from ids;
    insert into results(check_name,value) values ('B files item under A category', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('B files item under A category', 'blocked'); end;
  update public.families set name = 'pwned' where id = (select fid from ids);
  insert into results(check_name,value)
    select 'B renames A', case when exists (select 1 from ids join public.families f on f.id = ids.fid where f.name = 'pwned') then 'ALLOWED - BAD' else 'blocked' end;
  begin perform public.create_family('Second','Bob');
    insert into results(check_name,value) values ('second family for same person', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('second family for same person', 'blocked'); end;
end $$;

-- A second adult joins Family A with the invite code
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}',true);
select public.join_family((select lower(code) from ids), 'A2');
insert into results(check_name,value) select 'joiner sees family items (want 1)', count(*)::text from public.items;
insert into results(check_name,value) select 'joiner sees tasks (want: Shared task)', string_agg(title, ', ') from public.tasks;
do $$ begin
  begin perform public.new_invite_code();
    insert into results(check_name,value) values ('member issues new invite code', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('member issues new invite code', 'blocked'); end;
end $$;

-- Notifications: A2 turns them on for a device
select public.save_push_subscription('https://push.example/a2', 'p256', 'auth', 'America/Los_Angeles');
insert into results(check_name,value) select 'A2 sees own device (want 1)', count(*)::text from public.push_subscriptions;

-- Bob tries to see or remove A2's device, or use server-only functions
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}',true);
insert into results(check_name,value) select 'B sees A2 device (want 0)', count(*)::text from public.push_subscriptions;
select public.remove_push_subscription('https://push.example/a2');
do $$ begin
  begin insert into public.push_subscriptions (endpoint, family_id, p256dh, auth) select 'https://push.example/b', fid, 'x', 'y' from ids;
    insert into results(check_name,value) values ('B adds device straight into table', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('B adds device straight into table', 'blocked'); end;
  begin perform public.push_due_reminders();
    insert into results(check_name,value) values ('B reads due reminders (server only)', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('B reads due reminders (server only)', 'blocked'); end;
  begin perform public.push_keys();
    insert into results(check_name,value) values ('B reads push keys (server only)', 'ALLOWED - BAD');
  exception when others then insert into results(check_name,value) values ('B reads push keys (server only)', 'blocked'); end;
end $$;
insert into results(check_name,value) select 'B sees reminders_sent rows (want 0)', count(*)::text from public.reminders_sent;
reset role;
insert into results(check_name,value)
  select 'A2 device survives B''s removal (want 1)', count(*)::text from public.push_subscriptions where endpoint = 'https://push.example/a2';
set local role authenticated;

select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',true);
insert into results(check_name,value) select 'owner sees tasks (want 2)', count(*)::text from public.tasks;

reset role;
select check_name, value from results order by n;
rollback;
