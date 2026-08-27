-- =====================================================================
-- NammaSahaay AI — PostgreSQL / Supabase schema
--
-- The prototype runs on the in-memory demo database by default. Set the
-- Supabase environment variables to switch the same Database interface
-- onto Postgres; no application code changes.
--
-- Design note: each table carries proper relational columns for the fields
-- that are queried, filtered or joined, plus a `payload` jsonb column that
-- holds the full typed record. This keeps indexes and foreign keys real
-- while allowing the rich content blocks of a chat message or the step data
-- of a workflow task to evolve without a migration for every field.
-- =====================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- users
create table if not exists users (
  id            text primary key,
  email         text not null,
  mobile        text not null,
  created_at    timestamptz not null default now(),
  is_demo       boolean not null default true
);

create table if not exists profiles (
  user_id                 text primary key references users (id) on delete cascade,
  name                    text not null,
  age                     int,
  gender                  text,
  state                   text,
  city                    text,
  marital_status          text,
  employment_status       text,
  education               text,
  annual_household_income numeric,
  payload                 jsonb not null,
  updated_at              timestamptz not null default now()
);

create index if not exists profiles_state_idx on profiles (state);

-- ------------------------------------------------------- conversations
create table if not exists conversations (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  title       text not null,
  preview     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on conversations (user_id, updated_at desc);

create table if not exists messages (
  id               text primary key,
  conversation_id  text not null references conversations (id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  payload          jsonb not null,
  created_at       timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on messages (conversation_id, created_at);

-- ------------------------------------------------------------ documents
create table if not exists documents (
  id            text primary key,
  user_id       text not null references users (id) on delete cascade,
  name          text not null,
  file_name     text not null,
  category      text not null,
  source        text not null,
  verification  text not null,
  purposes      text[] not null default '{}',
  payload       jsonb not null,
  added_at      timestamptz not null default now()
);

create index if not exists documents_user_category_idx on documents (user_id, category);
create index if not exists documents_purposes_idx on documents using gin (purposes);

create table if not exists digilocker_documents (
  id         text primary key,
  user_id    text not null references users (id) on delete cascade,
  name       text not null,
  issuer     text not null,
  imported   boolean not null default false,
  payload    jsonb not null
);

-- ---------------------------------------------------------------- tasks
-- The citizen task engine: one row per workflow the citizen has started.
create table if not exists tasks (
  id               text primary key,
  user_id          text not null references users (id) on delete cascade,
  conversation_id  text references conversations (id) on delete set null,
  service_type     text not null,
  workflow_id      text not null,
  title            text not null,
  status           text not null,
  current_step     text not null,
  application_id   text,
  payload          jsonb not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists tasks_user_updated_idx on tasks (user_id, updated_at desc);
create index if not exists tasks_status_idx on tasks (status);

-- --------------------------------------------------------- applications
-- Read model over tasks. My Applications reads this view, so a workflow and
-- its application record can never drift apart.
create or replace view applications as
select
  coalesce(t.application_id, t.id) as reference,
  t.id                             as task_id,
  t.user_id,
  t.service_type,
  t.title,
  t.status,
  t.current_step,
  t.created_at,
  t.updated_at,
  t.payload
from tasks t;

-- --------------------------------------------------------------- schemes
create table if not exists schemes (
  id                 text primary key,
  name               text not null,
  category           text not null,
  state              text not null,
  description        text not null,
  official_source    text not null,
  source_url         text,
  application_method text,
  processing_time    text,
  status             text not null,
  data_type          text not null check (data_type in ('verified_public_information', 'demo_dataset')),
  is_demo_scheme     boolean not null default true,
  last_verified      date,
  payload            jsonb not null
);

create index if not exists schemes_state_category_idx on schemes (state, category);

create table if not exists scheme_matches (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  scheme_id   text not null references schemes (id) on delete cascade,
  level       text not null check (level in ('potential_match', 'more_information_required', 'not_matching')),
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists scheme_matches_user_idx on scheme_matches (user_id, created_at desc);

-- ------------------------------------------------------------ complaints
create table if not exists complaints (
  id           text primary key,
  user_id      text not null references users (id) on delete cascade,
  task_id      text references tasks (id) on delete set null,
  department   text not null,
  subject      text not null,
  description  text not null,
  status       text not null,
  reference    text,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------- train searches
create table if not exists train_searches (
  id           text primary key,
  user_id      text not null references users (id) on delete cascade,
  origin       text not null,
  destination  text not null,
  travel_date  date not null,
  passengers   int not null default 1,
  payload      jsonb not null,
  created_at   timestamptz not null default now()
);

-- --------------------------------------------------------- notifications
create table if not exists notifications (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  task_id     text references tasks (id) on delete set null,
  title       text not null,
  body        text not null,
  tone        text not null,
  read        boolean not null default false,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- ------------------------------------------------------------- downloads
create table if not exists downloads (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  task_id     text references tasks (id) on delete set null,
  file_name   text not null,
  title       text not null,
  kind        text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- emails
create table if not exists emails (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  task_id     text references tasks (id) on delete set null,
  subject     text not null,
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists emails_user_created_idx on emails (user_id, created_at desc);

-- ---------------------------------------------------------- audit events
create table if not exists audit_events (
  id          text primary key,
  user_id     text not null references users (id) on delete cascade,
  task_id     text references tasks (id) on delete set null,
  event_type  text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_events_user_created_idx
  on audit_events (user_id, created_at desc);

-- =====================================================================
-- Row level security
-- Every citizen-owned table is readable and writable only by its owner.
-- The service-role key used by server routes bypasses RLS; the anon key
-- never touches these tables directly from the browser.
-- =====================================================================
alter table profiles              enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table documents             enable row level security;
alter table digilocker_documents  enable row level security;
alter table tasks                 enable row level security;
alter table scheme_matches        enable row level security;
alter table complaints            enable row level security;
alter table train_searches        enable row level security;
alter table notifications         enable row level security;
alter table downloads             enable row level security;
alter table emails                enable row level security;
alter table audit_events          enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'conversations', 'documents', 'digilocker_documents', 'tasks',
    'scheme_matches', 'complaints', 'train_searches', 'notifications',
    'downloads', 'emails', 'audit_events'
  ]
  loop
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text)',
      t || '_owner_policy', t
    );
  end loop;
end $$;

-- Messages are owned through their conversation.
create policy messages_owner_policy on messages
  for all
  using (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()::text
    )
  );
