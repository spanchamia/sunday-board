-- To-dos can repeat and can have reminders.
--   repeat_unit / repeat_every: "every 2 weeks" = ('week', 2). Needs a date.
--     When a repeating to-do is done, the app adds the next one (same series_id).
--   remind_before: minutes before the to-do to remind (0 = at the time). A to-do
--     without a time counts from 9:00 that day.
alter table public.tasks
  add column repeat_unit   text check (repeat_unit in ('day', 'week', 'month', 'year')),
  add column repeat_every  smallint check (repeat_every between 1 and 366),
  add column series_id     uuid,
  add column remind_before int[] not null default '{}'
    check (remind_before <@ array[0, 10, 60, 1440, 2880, 10080] and cardinality(remind_before) <= 6),
  add constraint tasks_repeat_needs_date check (repeat_unit is null or (due_on is not null and repeat_every is not null));
create index on public.tasks (series_id) where series_id is not null;
