-- School timetables: each kid's weekly classes, separate from the family calendar.
-- Kids are names in the family (no sign-in of their own); anyone in the family can
-- view and edit. A kid has one timetable at a time (a "term", e.g. Fall 2026); a new
-- semester replaces it. Exceptions cover a day or a run of days (field trip, no school).

create table public.kids (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, family_id)
);
create unique index kids_family_name on public.kids (family_id, lower(name));

create table public.school_terms (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  kid_id     uuid not null,
  name       text not null check (length(trim(name)) between 1 and 40),   -- "Fall 2026"
  starts_on  date,
  ends_on    date,
  created_at timestamptz not null default now(),
  unique (id, family_id),
  unique (kid_id),                                                         -- one timetable per kid
  check (starts_on is null or ends_on is null or ends_on >= starts_on),
  foreign key (kid_id, family_id) references public.kids (id, family_id) on delete cascade
);

create table public.school_classes (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  term_id    uuid not null,
  weekday    smallint not null check (weekday between 1 and 7),          -- 1 = Monday … 7 = Sunday
  starts_at  time not null,
  ends_at    time not null check (ends_at > starts_at),
  title      text not null check (length(trim(title)) between 1 and 60),
  room       text check (length(room) <= 40),
  teacher    text check (length(teacher) <= 60),
  created_at timestamptz not null default now(),
  foreign key (term_id, family_id) references public.school_terms (id, family_id) on delete cascade
);
create index on public.school_classes (term_id, weekday, starts_at);
create index on public.school_classes (family_id);

create table public.school_exceptions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  term_id         uuid not null,
  from_date       date not null,
  to_date         date not null check (to_date >= from_date),
  title           text not null check (length(trim(title)) between 1 and 60),   -- "Field trip"
  note            text check (length(note) <= 200),
  replaces_classes boolean not null default true,     -- false = a note on top of normal classes
  created_at      timestamptz not null default now(),
  foreign key (term_id, family_id) references public.school_terms (id, family_id) on delete cascade
);
create index on public.school_exceptions (term_id, from_date);
create index on public.school_exceptions (family_id);
create index on public.school_terms (family_id);

-- Same rule as every other family table: your family's rows only.
alter table public.kids enable row level security;
alter table public.school_terms enable row level security;
alter table public.school_classes enable row level security;
alter table public.school_exceptions enable row level security;
create policy "family rows" on public.kids for all to authenticated
  using (family_id = (select private.my_family_id())) with check (family_id = (select private.my_family_id()));
create policy "family rows" on public.school_terms for all to authenticated
  using (family_id = (select private.my_family_id())) with check (family_id = (select private.my_family_id()));
create policy "family rows" on public.school_classes for all to authenticated
  using (family_id = (select private.my_family_id())) with check (family_id = (select private.my_family_id()));
create policy "family rows" on public.school_exceptions for all to authenticated
  using (family_id = (select private.my_family_id())) with check (family_id = (select private.my_family_id()));

-- Live sync: a timetable edited on the iPad shows up on phones straight away.
alter publication supabase_realtime add table
  public.kids, public.school_terms, public.school_classes, public.school_exceptions;
